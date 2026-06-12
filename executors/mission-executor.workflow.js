export const meta = {
  name: 'mission-executor',
  description: 'Claude Code executor adapter: walks a frozen plan.json DAG — fan-out, R-tier review gating, mission budget, problem-solving ladder, subtree replan — per the agent constitution.',
  phases: [
    { title: 'Execute' },
    { title: 'Audit' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSTRATE BINDING for the mission protocol (constitution §10).
//
// This script is ONE executor of the harness-neutral plan.json spec. It contains
// no policy — policy lives in agent-constitution.md. It only *walks the DAG*.
// A Codex adapter walks the same plan.json differently; the plan does not care.
//
// INPUT: `args` is the plan.json object — OR a JSON string of it. The Workflow
//        sandbox has no FS access, so /mission reads the file and passes the
//        contents in (not the path). Workflow `args` is passed verbatim, so a
//        stringified plan arrives as one string; it is parsed defensively below.
//        Spawned agents DO have tool access and read the repo / operating card /
//        node files themselves.
//
// RESUME: node-granular. `args.completed` (optional) is a map of nodeId -> result
//        from a prior interrupted run; those nodes are skipped. The DAG is the
//        journal at node granularity (constitution §10).
// ─────────────────────────────────────────────────────────────────────────────

// Defensive arg parse: the documented contract is a parsed object, but a stringified plan
// reaches the script as one JSON string (Workflow `args` is verbatim). The first daylight
// mission hit exactly this — the canonical executor crashed on string args and had to be
// hand-patched mid-run. Accept both shapes so a producer-side contract slip can never crash
// the walk.
const _args = typeof args === 'string' ? JSON.parse(args) : args
const plan = _args
const completed = (_args && _args.completed) || {}

const C = plan.constitution_version || 'unknown'
const REPO = plan.repo
const MODE = plan.mode
const ZONES = plan.deliverable_zones || []
// Orchestration depth (§2.4). BACKSTOP for the deterministic classifier (scripts/classify-mission.js,
// run at PLAN): re-derive the class FLOOR here so a hand-edited or under-classified plan cannot make
// the executor's own decisions (audit depth) run below what the plan's facts permit. The planner may
// raise above the floor, never below it. Discrepancy is logged for the report.
const _V = { V0: 0, V1: 1, V2: 2, V3: 3 }, _CEREMONY = { M0: 0, M1: 1, M2: 2 }
function _classFloor(p) {
  const ns = (p && p.nodes) || []; if (!ns.length) return 'M1'
  const vMax = ns.reduce((m, n) => Math.max(m, _V[n.v_class] != null ? _V[n.v_class] : 2), 0)
  const zones = (p && p.deliverable_zones) || []
  const touchesZone = ns.some(n => Array.isArray(n.write_set) &&
    n.write_set.some(w => zones.some(z => w === z || w.includes(z) || z.includes(w))))
  const unknownReach = ns.some(n => !Array.isArray(n.write_set))
  if (vMax >= _V.V3) return 'M2'
  return (ns.length <= 2 && vMax <= _V.V1 && !touchesZone && !unknownReach) ? 'M0' : 'M1'
}
const _claimedClass = plan.mission_class || 'M1'
const _floorClass = _classFloor(plan)
const MCLASS = (_CEREMONY[_claimedClass] != null ? _CEREMONY[_claimedClass] : 1) >= _CEREMONY[_floorClass]
  ? _claimedClass : _floorClass

// Default caps (constitution §6.2). Per-node overrides live on node.caps.
const DEFAULT_CAPS = {
  micro_loop_retries: 3,
  sub_loop_iterations: 5,
  subtree_replans: 2,
  cold_swaps: 1,            // §3.4 cold-reviewer rotation; evolution-tuned
}

// ── Mission budget (§6.4): dual ceiling frozen at PLAN ───────────────────────
// budget.spent() counts OUTPUT tokens across the turn — an honest proxy; the cumulative
// cache-read drain is not observable mid-run, which is exactly why the agent ceiling exists:
// it bounds the fan-out multiplication the token meter cannot see. Exhausting either is a
// DIVERGENCE (§6.3): no new nodes, in-flight nodes close, AUDIT still runs. Never a mid-node
// kill, and never a reason to skip a gate or lower a floor.
const TOKEN_BUDGET = plan.token_budget || null
const AGENT_BUDGET = plan.agent_budget || null
const _startSpent = budget.spent()
let _agentsSpawned = 0
function tokensUsed() { return budget.spent() - _startSpent }
function budgetExhausted() {
  return (TOKEN_BUDGET != null && tokensUsed() >= TOKEN_BUDGET) ||
         (AGENT_BUDGET != null && _agentsSpawned >= AGENT_BUDGET)
}
// Every spawn goes through here so planned-vs-actual lands in the run-record (§7).
// A mid-wave ceiling crossing is sanctioned (§6.4: in-flight work completes) but NEVER silent:
// it is logged here and recorded as a mission-level cap_hit in budgetReport() — the first
// daylight overrun (38/36) reached the report only as prose, invisible to §7 calibration.
function spawn(prompt, opts) {
  _agentsSpawned++
  if (AGENT_BUDGET != null && _agentsSpawned === AGENT_BUDGET + 1)
    log(`⚠ Agent ceiling crossed mid-wave (${_agentsSpawned}/${AGENT_BUDGET}) — in-flight work completes (§6.4); overrun lands in cap_hits.`)
  return agent(prompt, opts)
}

// ── Review tiers (§3.1): V→R floors, planner discretion above ────────────────
const _R = { R0: 0, R1: 1, R2: 2, R3: 3 }
function reviewFloor(node, selfClosed) {
  if (node.is_final_deliverable) return 'R3'
  const touchesZone = Array.isArray(node.write_set) &&
    node.write_set.some(w => ZONES.some(z => w === z || w.includes(z) || z.includes(w)))
  if (node.v_class === 'V2' || node.v_class === 'V3' || touchesZone) return 'R2'
  if (!selfClosed) return 'R2'      // V0/V1 with no closure record downgrades to V2 (§2.1)
  return 'R0'                       // the recorded check is the gate; R0 is hygiene on top
}
function effectiveTier(node, selfClosed) {
  let floor = reviewFloor(node, selfClosed)
  // Legacy compat: ac_required=true with no explicit review_tier keeps its fresh critic.
  if (!node.review_tier && node.ac_required && _R[floor] < _R.R2) floor = 'R2'
  const planned = node.review_tier
  if (planned && _R[planned] != null) {
    if (_R[planned] >= _R[floor]) return planned
    log(`⚠ Node ${node.id}: review_tier ${planned} below floor ${floor} — floored (§3.1).`)
  }
  return floor
}

// ── Compute tier (§3.6): model intelligence tracks stake of judgement ─────────
// The strongest model is the default; a weaker one is permitted only where a wrong answer has
// NO UNCAUGHT consequence. Tier is per ROLE, not per node — gates are always Opus (the model is
// the gate); a V0/V1 actor descends (the binding check, not the model, defines correctness); the
// advisory improver descends (the gate that follows it catches a bad suggestion). Haiku is opt-in
// with a rationale, never derived. When the call is blurry, round UP.
const _M = { haiku: 0, sonnet: 1, opus: 2 }
const _MNAME = ['haiku', 'sonnet', 'opus']

// Lowest tier permitted for the ACTOR side (actor / retry / revise) of a node.
function actorModelFloor(node) {
  if (node.is_final_deliverable) return 'opus'                       // outward, last line
  if (node.v_class === 'V2' || node.v_class === 'V3') return 'opus'  // §2.3: correctness exceeds any check
  return 'sonnet'                                                    // V0/V1 binding closure record (§2.1) is the gate
}
// Resolve the actor model: planner may raise toward Opus, never below the floor. Haiku honored
// ONLY on a Sonnet-floor (V0/V1) node carrying an explicit rationale (§3.6 opt-in); else round up.
function actorModel(node) {
  const floor = actorModelFloor(node)
  const req = node.model_tier
  if (!req || _M[req] == null) return floor
  if (_M[req] >= _M[floor]) return req                              // at/above floor (e.g. Opus on a V0 node)
  if (req === 'haiku' && floor === 'sonnet' && node.model_rationale) return 'haiku'  // justified pure-transport
  log(`⚠ Node ${node.id}: model_tier ${req} below floor ${floor}` +
    `${req === 'haiku' ? ' (Haiku needs model_rationale on a V0/V1 actor)' : ''} — rounded up to ${floor} (§3.6).`)
  return floor
}
// A failed V0/V1 close rounds the retry up one tier — the cheap model could not satisfy the
// binding check, which is the signal to spend more (§3.6 round-up at the retry edge).
function retryModel(base, tries) { return _MNAME[Math.min(_M.opus, _M[base] + tries)] }

// Planned actor-tier histogram for the go-gate + run-record (§3.6/§7). Gates are Opus by rule.
function modelReport() {
  const actor_tier_histogram = {}
  for (const n of plan.nodes) { const m = actorModel(n); actor_tier_histogram[m] = (actor_tier_histogram[m] || 0) + 1 }
  return { actor_tier_histogram, gates: 'opus (§3.6)' }
}

// ── Structured-output schemas ────────────────────────────────────────────────

const ACTOR_SCHEMA = {
  type: 'object',
  required: ['outcome', 'artifact_summary'],
  additionalProperties: false,
  properties: {
    outcome: { enum: ['done', 'plan_assumption_false', 'failed'] },
    artifact_summary: { type: 'string' },
    // Pushed evidence (§6.4 context discipline): reviewers judge from this, not from
    // re-exploring the repo. The raw diff is what an R1/R2 critic reads in full.
    diff: { type: ['string', 'null'], description: 'git diff of this node\'s changes on the agent branch (raw, untruncated unless enormous — then the full diff of the most material files + a stat summary).' },
    files_touched: { type: ['array', 'null'], items: { type: 'string' } },
    // Present only for V0/V1 nodes that self-closed (constitution §2.1).
    closure_record: {
      type: ['object', 'null'],
      properties: {
        check_command: { type: 'string' },
        exit_status: { type: 'integer' },
        output_digest: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
    // R0 only: surviving concerns from the adversarial self-audit phase (§3.1).
    self_audit: { type: ['string', 'null'] },
    // Set when outcome === 'plan_assumption_false'.
    replan_reason: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
}

const CRITIC_SCHEMA = {
  type: 'object',
  required: ['findings'],
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'claim', 'evidence'],
        additionalProperties: false,
        properties: {
          severity: { enum: ['blocker', 'major', 'minor'] },
          claim: { type: 'string' },
          evidence: { type: 'string' },
          // Blockers are INVALID without a cited criterion/clause (§3.3).
          cited_criterion: { type: ['string', 'null'] },
          suggested_fix: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'rechecked', 'punchlist', 'ledger'],
  additionalProperties: false,
  properties: {
    verdict: { enum: ['DELIVERED', 'DIVERGED'] },
    rechecked: { type: 'string', description: 'Summary of re-running all recorded checks + sampled self-closures.' },
    punchlist: { type: 'array', items: { type: 'string' } },
    ledger: { type: 'array', items: { type: 'string' } },
  },
}

// ── Prompt builders ──────────────────────────────────────────────────────────

// Canonical context pack (§6.4 cache-prefix discipline). Workers carry the distilled operating
// card, NOT the full constitution: fresh context means re-derived state, not re-read governance.
// This block is BYTE-IDENTICAL and sits at the TOP of every spawn's prompt, so every agent after
// the first hits the prompt cache instead of paying fresh input — "spawn a bunch and each one
// reads from the start" is the dominant fan-out cost, and this is its antidote. Node-specific
// material always comes AFTER this shared prefix. Context is pushed, never pulled.
const govern = `=== MISSION CONTEXT (shared, identical for every agent in this run) ===
You operate under the mission operating card ~/.claude/docs/operating-card.md (constitution
version ${C}; consult the full ~/.claude/docs/agent-constitution.md only if a rule is ambiguous).
Mission ${plan.run_id} (class ${MCLASS}, mode ${MODE}) — goal: ${plan.goal}
Repo: ${REPO}. Deliverable zones (V2 floor): ${JSON.stringify(ZONES)}.
Plan: ${plan.nodes.map(n => `[${n.id}] ${n.title} (${n.v_class})`).join(' · ')}
=== END MISSION CONTEXT ===`

function actorPrompt(node) {
  // R0 (§3.1): adversarial self-audit rides the actor's own cached context — a second phase in
  // the SAME conversation, zero re-reading. Permitted as hygiene only where the V0/V1 closure
  // record is the real gate; if the check doesn't pass, the tier floors to R2 and a fresh
  // critic fires anyway (effectiveTier).
  const r0Phase = node.review_tier === 'R0' ? `
- AFTER the work passes its check: STOP. Switch roles. Re-read your own diff as an adversarial
  reviewer who assumes it was written by an intern — hunt for what is wrong, fragile, or missed,
  not for reassurance. Fix what you find, re-run the check, and report any SURVIVING concerns
  honestly in self_audit (empty self_audit = "I attacked it and found nothing", a claim you own).` : ''
  return `${govern}

TASK NODE [${node.id}] ${node.title} (verification class ${node.v_class})
INSTRUCTION: ${node.instruction || node.title}
ACCEPTANCE CRITERIA (named): ${JSON.stringify(node.acceptance_criteria)}

Do the work on the agent branch. Then:
- If this node is V0/V1: SELECT and RUN a concrete check (prefer a name from the repo
  contract's verifier registry; "${node.check || 'TBD'}" is a suggestion only). You may
  only report outcome="done" if the check actually passed — return its closure_record
  {check_command, exit_status, output_digest, timestamp}. The timestamp MUST be the real
  wall-clock time from your environment, never a placeholder like 00:00:00Z. No passing recorded check ⇒ do
  NOT claim done; report outcome="failed" with notes, OR if the task is genuinely
  judgment-bound, say so in notes (it will be downgraded to V2).${r0Phase}
- Return PUSHED EVIDENCE for review: the raw git diff of your changes in "diff" and the file
  list in "files_touched" — reviewers judge from what you push, so push the real thing.
- If you discover the node's acceptance criteria are themselves wrong / a dependency
  surprise makes them unreachable: outcome="plan_assumption_false" with replan_reason.
- Additive only: commit to the agent branch. Never merge, force-push, or act outward.`
}

// Shared closing contract for every gating critic (§3.3).
const criticRules = `Return findings. Each finding needs {severity, claim, evidence}. A "blocker" is ONLY valid
if it cites a specific named acceptance criterion or constitution clause in cited_criterion
— an uncited blocker is invalid and will be discarded. When severity is uncertain, choose
"major", not "blocker".`

// R1 (§3.1): spec-blind diff review. The critic sees the node contract and the RAW DIFF —
// deliberately NOT the actor's narrative — so it judges whether the diff satisfies the
// contract without inheriting the actor's frame. No repo access; the diff is the artifact.
function r1CriticPrompt(node, actor) {
  return `${govern}

You are an ADVERSARIAL CRITIC doing a SPEC-BLIND DIFF REVIEW, defaulting to REJECT under
uncertainty. You see the node contract and the raw diff ONLY — no author narrative, by design.
Judge ONE question: does this diff satisfy the named acceptance criteria, without collateral
damage visible in the diff itself? Do not explore the repo.

TASK NODE [${node.id}] ${node.title}
ACCEPTANCE CRITERIA (named): ${JSON.stringify(node.acceptance_criteria)}
FILES TOUCHED: ${JSON.stringify(actor.files_touched || null)}
RAW DIFF UNDER REVIEW:
${actor.diff || '(actor pushed no diff — treat that itself as a major finding)'}

${criticRules}`
}

// R2 (§3.1): cold-eye review of pushed evidence + a bounded independent spot-check. The actor
// never knows WHICH claims get verified, so all claims must be honest — trust-but-verify with
// unpredictable sampling, at a fixed cost instead of open-ended re-exploration.
function r2CriticPrompt(node, actor, lens) {
  return `${govern}

You are an ADVERSARIAL CRITIC. Your job is to find what is WRONG with the work below,
defaulting to REJECT under uncertainty. You see the actor's pushed evidence — summary, diff,
files — but NOT its reasoning. ${lens ? `Apply specifically the ${lens} lens.` : ''}
You have a SPOT-CHECK BUDGET of at most 5 file reads in the repo: spend them at YOUR OWN
choosing to independently verify the claims you find most load-bearing or most suspicious
(callers of changed code, conventions, a test the actor claims passes). Do NOT explore
open-endedly; reads beyond verifying a specific claim are waste.

TASK NODE [${node.id}] ${node.title}
ACCEPTANCE CRITERIA (named): ${JSON.stringify(node.acceptance_criteria)}
ACTOR SUMMARY: ${actor.artifact_summary}
FILES TOUCHED: ${JSON.stringify(actor.files_touched || null)}
DIFF:
${actor.diff || '(actor pushed no diff — treat that itself as a major finding)'}

${criticRules}`
}

// Cold reviewer (§3.4): fresh eyes on an artifact that tentatively PASSED, blind to the
// prior review. Both staleness-breaker and disambiguator of genuine-vs-stale convergence.
function coldCriticPrompt(node, artifact) {
  return `${govern}

You are a COLD reviewer. This artifact has tentatively PASSED review — your job is to find
what a reviewer who had stared at it for several rounds would have stopped noticing. You have
NO knowledge of the prior review (no verdicts, no debate); judge it FRESH against the
objective criteria only, defaulting to REJECT under uncertainty.

TASK NODE [${node.id}] ${node.title}
ACCEPTANCE CRITERIA (named): ${JSON.stringify(node.acceptance_criteria)}
ARTIFACT UNDER REVIEW:
${artifact}

Return findings ({severity, claim, evidence}; a "blocker" needs a cited named criterion in
cited_criterion or it is discarded). If the artifact is genuinely sound, return an EMPTY
findings list — do NOT manufacture issues to seem useful.`
}

// Cold-IMPROVER (§3.4): distinct from the cold VERIFIER above. Fresh independent eyes on a
// FIRST-DRAFT artifact whose job is to make it STRONGER — advisory, not a gate. It ALWAYS
// engages (no "return empty if sound" off-switch) and inspects the real changes on the agent
// branch, not a summary. This is the high-yield position for cold review: fresh drafts, not
// the already-scrubbed final deliverable. A quality lever ([model]); never closes a gate.
function improverPrompt(node, artifact) {
  return `${govern}

You are an independent reviewer seeing this work COLD — fresh eyes, no knowledge of how it was
produced. Your job is to make it STRONGER: surface concrete, specific improvements and anything
wrong, risky, or missed. INSPECT THE ACTUAL CHANGES on the agent branch (read the files / git
diff) — do not judge from the summary alone. You do NOT need to find a blocker to be useful;
well-grounded partial suggestions are the point. Avoid vague style nits — every finding must be
actionable and cite file:line evidence.

TASK NODE [${node.id}] ${node.title}
ACCEPTANCE CRITERIA (named): ${JSON.stringify(node.acceptance_criteria)}
ARTIFACT (first draft) UNDER REVIEW:
${artifact}

Return findings; each = {severity, claim, evidence, suggested_fix}. These are SUGGESTIONS to
the author, not gate verdicts.`
}

// Actor REVISION (§3.3): the author receives independent review and revises with its OWN
// judgment — adopt what is valid, rebut what is not. Closes the review→revise loop the
// executor previously lacked. Reuses actorPrompt so the full task contract still binds.
function reviseActorPrompt(node, findings) {
  return `${actorPrompt(node)}

INDEPENDENT EXTERNAL REVIEW of your first draft is below. Take it with your own judgment: adopt
every point that genuinely improves the work, and rebut — with evidence — any you think is wrong
or out of scope. You are NOT obligated to accept all of it. Apply the accepted changes on the
agent branch; if this node is V0/V1, RE-RUN the check and return a fresh closure_record. Return
the REVISED artifact, and in notes say briefly what you took, what you rejected, and why.

EXTERNAL REVIEW (${findings.length} item(s)):
${JSON.stringify(findings, null, 2)}`
}

// ── Adjudication (orchestrator rules; §3.3) ──────────────────────────────────
// Returns { blockers, majors, minors } after discarding invalid findings.
function adjudicate(findingSets) {
  const all = findingSets.filter(Boolean).flatMap(f => f.findings || [])
  const blockers = all.filter(f => f.severity === 'blocker' && f.cited_criterion) // uncited blocker = invalid
  const majors = all.filter(f => f.severity === 'major' ||
    (f.severity === 'blocker' && !f.cited_criterion))                              // demote uncited blockers
  const minors = all.filter(f => f.severity === 'minor')
  return { blockers, majors, minors }
}

function capFor(node, key) {
  return (node.caps && node.caps[key] != null) ? node.caps[key] : DEFAULT_CAPS[key]
}

// ── write_set conformance (§6.5, deterministic — no model call) ──────────────
// The executor DERIVES parallel-safety from declared write_sets; an actor that writes outside
// its declaration silently invalidates that derivation (and is scope creep). At node close,
// diff the touched files against the declaration: any out-of-set file raises a MACHINE-evidence
// blocker — only the Human may waive it (truth-source asymmetry, §2.2). Enforced only when the
// planner declared a write_set; undeclared nodes already run conservative-serial.
function _writeSetMatch(file, entry) {
  const f = file.replace(/\\/g, '/').replace(/^\.\//, '')
  const e = entry.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
  if (f === e || f.startsWith(e + '/')) return true                 // exact file or directory prefix
  if (e.includes('*')) {                                            // glob: ** crosses /, * does not
    const rx = new RegExp('^' + e.replace(/[.+^${}()|[\]]/g, '\\$&')
      .replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*') + '$')
    return rx.test(f)
  }
  return false
}
function writeSetBreach(node, actor) {
  if (!Array.isArray(node.write_set) || node.write_set.length === 0) return null
  const fromDiff = (actor.diff || '').split('\n')
    .filter(l => l.startsWith('+++ b/')).map(l => l.slice(6).trim())
  const touched = [...new Set([...(actor.files_touched || []), ...fromDiff])]
    .filter(f => f && f !== '/dev/null')
  const outside = touched.filter(f => !node.write_set.some(e => _writeSetMatch(f, e)))
  if (!outside.length) return null
  return {
    severity: 'blocker',
    claim: `write_set breach: node declared ${JSON.stringify(node.write_set)} but touched ${JSON.stringify(outside)}`,
    evidence: 'deterministic diff-vs-declaration check (machine evidence — human-only to waive)',
    cited_criterion: '§6.5 write_set declaration / §2.2 truth-source asymmetry',
    suggested_fix: 'revert the out-of-set edits, or have the Human waive and widen the declaration in a replan',
  }
}

function isReady(node, doneSet) {
  return (node.deps || []).every(d => doneSet.has(d))
}

// ── Execute one node: actor + (micro-loop) + critic gate ─────────────────────
async function runNode(node) {
  if (completed[node.id]) return completed[node.id]

  const aModel = actorModel(node)   // compute tier for this node's actor side (§3.6)
  let actor = await spawn(actorPrompt(node), {
    label: `actor:${node.id}@${aModel}`, phase: 'Execute', schema: ACTOR_SCHEMA, model: aModel,
  })
  if (!actor) return { node: node.id, status: 'lost', reason: 'actor died' }

  // Subtree replan signal — surface to orchestrator (handled in main loop).
  if (actor.outcome === 'plan_assumption_false') {
    return { node: node.id, status: 'replan', reason: actor.replan_reason, actor }
  }

  // Micro-loop (§6.1 tier 1): retry failed V0/V1 self-closure up to cap.
  let tries = 0
  while (actor.outcome === 'failed' && tries < capFor(node, 'micro_loop_retries')) {
    tries++
    const rModel = retryModel(aModel, tries)   // round up one tier per failed close (§3.6)
    actor = await spawn(
      `${actorPrompt(node)}\n\nPRIOR ATTEMPT FAILED: ${actor.notes || ''}. Retry (attempt ${tries + 1}).`,
      { label: `actor:${node.id}:retry${tries}@${rModel}`, phase: 'Execute', schema: ACTOR_SCHEMA, model: rModel },
    )
    if (!actor) return { node: node.id, status: 'lost', reason: 'actor died on retry' }
    if (actor.outcome === 'plan_assumption_false')
      return { node: node.id, status: 'replan', reason: actor.replan_reason, actor }
  }

  // Cold-improver + revision loop (§3.4 improver / §3.3 revision), scoped by mission class.
  // Fresh independent eyes review the FIRST-DRAFT artifact; the actor revises with its own
  // judgment. Positioned on fresh implementation drafts (NOT the final deliverable, which the
  // gate panel + cold verifier already cover) — where cold review yields most. Quality lever,
  // logged [model]; it lifts what enters the gate below, never replaces it. The loop can only
  // improve or no-op — a botched/failed revision is discarded, so a node never regresses.
  const eligibleForImprover = node.ac_required && !node.is_final_deliverable
  const improverOn = eligibleForImprover && MCLASS !== 'M0' &&
    (MCLASS === 'M2' ? node.improve_pass !== false : node.improve_pass === true) &&
    !budgetExhausted()   // advisory pass, first thing shed under budget pressure (§6.4)
  if (actor.outcome === 'done' && improverOn) {
    // Improver is advisory and backstopped by the gate that follows it (§3.6) → Sonnet floor.
    const improver = await spawn(improverPrompt(node, actor.artifact_summary),
      { label: `improver:${node.id}@sonnet`, phase: 'Execute', schema: CRITIC_SCHEMA, model: 'sonnet' })
    const suggestions = (improver && improver.findings) || []
    if (suggestions.length > 0) {
      // Revise re-runs the actor → same compute tier as the node's actor side.
      const revised = await spawn(reviseActorPrompt(node, suggestions),
        { label: `actor:${node.id}:revise@${aModel}`, phase: 'Execute', schema: ACTOR_SCHEMA, model: aModel })
      if (revised) {
        if (revised.outcome === 'plan_assumption_false')
          return { node: node.id, status: 'replan', reason: revised.replan_reason, actor: revised }
        if (revised.outcome === 'done') actor = revised   // adopt only a clean revision; never regress
        // 'failed' revision: discard, keep the original done first draft
      }
    }
  }

  // Close-time binding (§2.1): V0/V1 with no valid closure record ⇒ downgrade to V2.
  const selfClosed = (node.v_class === 'V0' || node.v_class === 'V1') &&
    actor.outcome === 'done' && actor.closure_record &&
    actor.closure_record.exit_status === 0

  // write_set conformance (§6.5): deterministic diff-vs-declaration check at close. A breach
  // is machine evidence — it gates EVERY tier, including R0 (the closure record proves the
  // check passed, not that the actor stayed inside its blast radius).
  const breach = actor.outcome === 'done' ? writeSetBreach(node, actor) : null
  if (breach) log(`⚠ Node ${node.id}: ${breach.claim} — raised as machine-evidence blocker (§6.5).`)

  // Review gate at the node's effective R-tier (§3.1): the V→R floor binds, the planner may
  // only raise. R0 already ran INSIDE the actor (two-phase prompt) and gates nothing — the
  // closure record is the gate.
  const tier = effectiveTier(node, selfClosed)
  if (tier === 'R0') {
    if (breach) {
      return { node: node.id, status: actor.outcome, actor, review_tier: tier,
               closed_by: selfClosed ? 'check' : 'executor',
               critic: { blockers: [breach], majors: [], minors: [] }, blocked: true }
    }
    return { node: node.id, status: actor.outcome, actor, review_tier: tier,
             closed_by: selfClosed ? 'check' : 'executor' }
  }

  // R1: one spec-blind diff critic. R2: one cold-eye critic with a ≤5-read spot-check budget.
  // R3: lens panel (trimmed to 2 — criteria-conformance duplicated correctness in practice on
  // the first daylight mission, so the third agent bought ~no distinct findings).
  const lenses = tier === 'R3' ? ['correctness', 'completeness'] : [null]
  const findingSets = await parallel(lenses.map(lens => () =>
    spawn(tier === 'R1' ? r1CriticPrompt(node, actor) : r2CriticPrompt(node, actor, lens),
      // Gating critic — the model IS the gate, always Opus (§3.6).
      { label: `critic:${node.id}:${tier}${lens ? ':' + lens : ''}`, phase: 'Execute', schema: CRITIC_SCHEMA, model: 'opus' })))

  const verdict = adjudicate(findingSets)
  if (breach) verdict.blockers.push(breach)   // machine evidence joins the gate verdict (§6.5)

  // Cold-reviewer rotation (§3.4), token-frugal. Detection is FREE (the boolean below, no
  // model call). Fire ONE cold reviewer only to double-check a *clean* verdict on the final
  // deliverable: a stale green is the only dangerous case, so a review that already found
  // issues gets no cold pass, and routine nodes get none ever. Net cost ≤1 critic call/mission.
  let coldConfirmed = false
  const candidateClean = verdict.blockers.length === 0 && verdict.majors.length === 0
  if (node.is_final_deliverable && candidateClean && capFor(node, 'cold_swaps') > 0) {
    const cold = await spawn(coldCriticPrompt(node, actor.artifact_summary),
      // Cold verifier on the final deliverable — a gate, always Opus (§3.6).
      { label: `critic:${node.id}:cold`, phase: 'Execute', schema: CRITIC_SCHEMA, model: 'opus' })
    coldConfirmed = true
    if (cold) {
      const c = adjudicate([cold])              // new findings ⇒ the green was stale
      verdict.blockers.push(...c.blockers)
      verdict.majors.push(...c.majors)
      verdict.minors.push(...c.minors)
    }
  }

  return {
    node: node.id, status: actor.outcome, actor,
    closed_by: 'critic', critic: verdict, review_tier: tier,
    cold_confirmed: coldConfirmed,
    blocked: verdict.blockers.length > 0,
  }
}

// ── Main DAG walk: wave-based ready-set (correct for general DAG + dynamic replan) ──
phase('Execute')
log(`Mission ${plan.run_id} — ${plan.nodes.length} nodes, mode=${MODE}, class=${MCLASS}, constitution=${C}` +
  (TOKEN_BUDGET || AGENT_BUDGET ? `, budget=${TOKEN_BUDGET || '∞'}tok/${AGENT_BUDGET || '∞'}agents` : ''))
if (MCLASS !== _claimedClass)
  log(`⚠ Mission class floored ${_claimedClass} → ${MCLASS} (§2.4 backstop): plan under-classified vs deterministic floor.`)
const _mh = modelReport().actor_tier_histogram
log(`Compute tiers (§3.6) — actors: ${Object.entries(_mh).map(([k, v]) => `${v}×${k}`).join(', ') || 'none'}; all gates Opus.`)

const doneSet = new Set(Object.keys(completed))
const results = { ...completed }
let nodes = plan.nodes.slice()
let replanBudget = (DEFAULT_CAPS.subtree_replans * 2) // mission-level ceiling (§6.2: 3/mission; kept conservative)
let budgetDiverged = false

while (doneSet.size < nodes.length) {
  // Budget gate (§6.4) at WAVE granularity: exhaustion stops opening new nodes; whatever is
  // mid-wave completes (never a mid-node kill). AUDIT still runs on what exists.
  if (budgetExhausted()) {
    budgetDiverged = true
    log(`Mission budget exhausted (${tokensUsed()} output tok / ${_agentsSpawned} agents vs ` +
      `${TOKEN_BUDGET || '∞'}/${AGENT_BUDGET || '∞'}) — DIVERGED(budget) per §6.3. ` +
      `${nodes.length - doneSet.size} node(s) unopened → defect ledger. Finalizing.`)
    break
  }
  const ready = nodes.filter(n => !doneSet.has(n.id) && isReady(n, doneSet))
  if (ready.length === 0) {
    log('No ready nodes and DAG incomplete — dependency deadlock or all-blocked. Finalizing (diverged).')
    break
  }
  // Blast-radius parallelism (§6.5): a node fans out only when concurrency is provably safe.
  //  - write_set: []  (declared read-only)  ⇒ no mutation, no race ⇒ fan out freely NOW.
  //  - write_set: [g] (declared mutating)   ⇒ safe only as a write-set-DISJOINT subset, AND
  //    only under worktree isolation + conflict-free integration merge — that mechanical wiring
  //    is a documented follow-up (harness daylight test pending), so for now the disjoint subset
  //    is COMPUTED and LOGGED but run serially (correct, just not yet concurrent).
  //  - no write_set ⇒ conservative serial. A planner earns fan-out by declaring blast radius.
  const declaresRO  = n => Array.isArray(n.write_set) && n.write_set.length === 0
  const declaresMut = n => Array.isArray(n.write_set) && n.write_set.length > 0
  const par = ready.filter(n => n.parallelizable && declaresRO(n))            // read-only ⇒ safe now
  const seq = ready.filter(n => !(n.parallelizable && declaresRO(n)))         // everything else serial

  // Surface the mutating nodes that ARE write-set-disjoint (would fan out once worktrees land).
  const disjoint = []
  for (const n of ready.filter(n => n.parallelizable && declaresMut(n)))
    if (!disjoint.some(c => c.write_set.some(x => n.write_set.includes(x)))) disjoint.push(n)
  if (disjoint.length > 1)
    log(`Write-set-disjoint, safe to fan out (worktree+merge wiring pending): ${disjoint.map(n => n.id).join(', ')}`)

  const waveResults = []
  if (par.length) waveResults.push(...await parallel(par.map(n => () => runNode(n))))
  for (const n of seq) waveResults.push(await runNode(n))

  for (const r of waveResults.filter(Boolean)) {
    if (r.status === 'replan' && replanBudget > 0) {
      // Subtree replan (§6.1 tier 3): record the surprise; a fuller adapter would
      // re-plan the subtree here. v0.1 marks the node done-with-defect and continues,
      // surfacing the replan reason to AUDIT rather than silently looping.
      replanBudget--
      log(`Node ${r.node}: plan assumption false — ${r.reason}. Replan budget left: ${replanBudget}.`)
    }
    results[r.node] = r
    doneSet.add(r.node)
  }
}

// ── Audit (§6) — depth scales with mission class (§2.4) ──────────────────────
phase('Audit')
const blockers = Object.values(results).flatMap(r => (r.critic && r.critic.blockers) || [])
const majors = Object.values(results).flatMap(r => (r.critic && r.critic.majors) || [])
const replans = Object.values(results).filter(r => r.status === 'replan')
// Planned-vs-actual for the run-record (§7) — the telemetry that calibrates class defaults.
function budgetReport() {
  // Any ceiling overrun MUST surface as a machine-readable cap_hit (schema v0.2 enum:
  // token_budget / agent_budget, node sentinel "mission") — prose-only breaches are
  // invisible to the §7 calibration corpus. would_have_converged is AUDIT's judgment.
  const cap_hits = []
  if (AGENT_BUDGET != null && _agentsSpawned > AGENT_BUDGET)
    cap_hits.push({ node: 'mission', cap: 'agent_budget', limit: AGENT_BUDGET, used: _agentsSpawned, would_have_converged: null })
  if (TOKEN_BUDGET != null && tokensUsed() > TOKEN_BUDGET)
    cap_hits.push({ node: 'mission', cap: 'token_budget', limit: TOKEN_BUDGET, used: tokensUsed(), would_have_converged: null })
  return {
    token_budget: TOKEN_BUDGET, agent_budget: AGENT_BUDGET,
    tokens_spent: tokensUsed(), agents_spawned: _agentsSpawned,
    exhausted: budgetDiverged,
    cap_hits,
    unopened_nodes: nodes.filter(n => !doneSet.has(n.id)).map(n => n.id),
  }
}

// M0 (errand): no separate audit agent. A node's own close-time check (§2.1) IS the audit;
// re-running one just-passed check from a fresh agent buys nothing. Verdict is deterministic.
if (MCLASS === 'M0') {
  const failed = Object.values(results).some(r => r.status === 'failed' || r.status === 'lost')
  const ledger = Object.values(results)
    .flatMap(r => (r.critic ? [...r.critic.majors, ...r.critic.minors] : []))
    .map(f => f.claim || String(f))
  log(`M0 errand — skipping separate AUDIT agent; verdict from deterministic node state.`)
  return {
    run_id: plan.run_id,
    mission_class: MCLASS,
    verdict: (blockers.length === 0 && !failed && !budgetDiverged) ? 'DELIVERED' : 'DIVERGED',
    diverged_reason: budgetDiverged ? 'budget' : null,
    unresolved_blockers: blockers,
    accepted_majors: majors,
    replans: replans.map(r => ({ node: r.node, reason: r.reason })),
    punchlist: [],
    ledger,
    budget: budgetReport(),
    compute_tiers: modelReport(),
    node_results: results,
  }
}

// M1 samples the rechecks; M2 re-runs every recorded check (§2.4).
const recheckInstruction = MCLASS === 'M2'
  ? 'Re-run ALL recorded closure checks and judge-sample 2-3 self-closures for sufficiency (§2.1).'
  : 'SAMPLE the rechecks: re-run 2-3 recorded closure checks and judge-sample 2-3 self-closures for sufficiency (§2.1).'

const auditSummary = Object.values(results).map(r =>
  `[${r.node}] status=${r.status} closed_by=${r.closed_by || '-'}` +
  `${r.critic ? ` blockers=${r.critic.blockers.length} majors=${r.critic.majors.length}` : ''}`).join('\n')

const audit = await spawn(`${govern}

AUDIT PHASE for mission ${plan.run_id} (class ${MCLASS}), goal: ${plan.goal}.
Per-node execution results:
${auditSummary}

Unresolved blockers (human-only to waive): ${JSON.stringify(blockers)}
Open majors (agent accept-with-reason allowed): ${JSON.stringify(majors)}
Plan-assumption-false nodes: ${JSON.stringify(replans.map(r => ({ node: r.node, reason: r.reason })))}
${budgetDiverged ? `BUDGET EXHAUSTED mid-mission (§6.4): unopened nodes ${JSON.stringify(budgetReport().unopened_nodes)} — these go to the defect ledger as unreached, and the verdict is DIVERGED.` : ''}

${recheckInstruction} Assemble the punchlist (each item is a candidate new node) and the
defect ledger (majors accepted-with-reason + minors + unreached criteria). Verdict DELIVERED
unless the mission diverged (§6.3) or an unwaived blocker remains.`,
  // AUDIT judges the whole mission — always Opus (§3.6).
  { label: 'audit', phase: 'Audit', schema: AUDIT_SCHEMA, model: 'opus' })

return {
  run_id: plan.run_id,
  mission_class: MCLASS,
  verdict: budgetDiverged ? 'DIVERGED' : (audit ? audit.verdict : 'DIVERGED'),
  diverged_reason: budgetDiverged ? 'budget' : null,
  unresolved_blockers: blockers,            // human-only; drive the "Needs you" report section
  accepted_majors: majors,
  replans: replans.map(r => ({ node: r.node, reason: r.reason })),
  punchlist: audit ? audit.punchlist : [],
  ledger: audit ? audit.ledger : [],
  budget: budgetReport(),
  compute_tiers: modelReport(),
  node_results: results,
}
