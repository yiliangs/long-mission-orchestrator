export const meta = {
  name: 'mission-executor',
  description: 'Claude Code executor adapter: walks a frozen plan.json DAG — fan-out, actor-critic gating, problem-solving ladder, subtree replan — per the agent constitution.',
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
const MCLASS = plan.mission_class || 'M1'   // orchestration depth (§2.4); scales AUDIT here

// Default caps (constitution §6.2). Per-node overrides live on node.caps.
const DEFAULT_CAPS = {
  micro_loop_retries: 3,
  sub_loop_iterations: 5,
  subtree_replans: 2,
  cold_swaps: 1,            // §3.4 cold-reviewer rotation; evolution-tuned
}

// ── Structured-output schemas ────────────────────────────────────────────────

const ACTOR_SCHEMA = {
  type: 'object',
  required: ['outcome', 'artifact_summary'],
  additionalProperties: false,
  properties: {
    outcome: { enum: ['done', 'plan_assumption_false', 'failed'] },
    artifact_summary: { type: 'string' },
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

// Workers carry the distilled operating card, NOT the full ~26 KB constitution (§6.4): fresh
// context means re-derived state, not re-read governance. The orchestrator holds the full text;
// the army carries the card. Falls back to the full constitution only if a rule is ambiguous.
const govern = `You operate under the mission operating card ~/.claude/docs/operating-card.md ` +
  `(constitution version ${C}; consult the full ~/.claude/docs/agent-constitution.md only if a ` +
  `rule is ambiguous). Repo: ${REPO}. Deliverable zones (V2 floor): ${JSON.stringify(ZONES)}.`

function actorPrompt(node) {
  return `${govern}

MISSION GOAL: ${plan.goal}
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
  judgment-bound, say so in notes (it will be downgraded to V2).
- If you discover the node's acceptance criteria are themselves wrong / a dependency
  surprise makes them unreachable: outcome="plan_assumption_false" with replan_reason.
- Additive only: commit to the agent branch. Never merge, force-push, or act outward.`
}

function criticPrompt(node, artifact, lens) {
  return `${govern}

You are an ADVERSARIAL CRITIC. Your job is to find what is WRONG with the artifact below,
defaulting to REJECT under uncertainty. You see the ARTIFACT ONLY — not the actor's
reasoning. ${lens ? `Apply specifically the ${lens} lens.` : ''}

TASK NODE [${node.id}] ${node.title}
ACCEPTANCE CRITERIA (named): ${JSON.stringify(node.acceptance_criteria)}
ARTIFACT UNDER REVIEW:
${artifact}

Return findings. Each finding needs {severity, claim, evidence}. A "blocker" is ONLY valid
if it cites a specific named acceptance criterion or constitution clause in cited_criterion
— an uncited blocker is invalid and will be discarded. When severity is uncertain, choose
"major", not "blocker".`
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

function isReady(node, doneSet) {
  return (node.deps || []).every(d => doneSet.has(d))
}

// ── Execute one node: actor + (micro-loop) + critic gate ─────────────────────
async function runNode(node) {
  if (completed[node.id]) return completed[node.id]

  let actor = await agent(actorPrompt(node), {
    label: `actor:${node.id}`, phase: 'Execute', schema: ACTOR_SCHEMA,
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
    actor = await agent(
      `${actorPrompt(node)}\n\nPRIOR ATTEMPT FAILED: ${actor.notes || ''}. Retry (attempt ${tries + 1}).`,
      { label: `actor:${node.id}:retry${tries}`, phase: 'Execute', schema: ACTOR_SCHEMA },
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
    (MCLASS === 'M2' ? node.improve_pass !== false : node.improve_pass === true)
  if (actor.outcome === 'done' && improverOn) {
    const improver = await agent(improverPrompt(node, actor.artifact_summary),
      { label: `improver:${node.id}`, phase: 'Execute', schema: CRITIC_SCHEMA })
    const suggestions = (improver && improver.findings) || []
    if (suggestions.length > 0) {
      const revised = await agent(reviseActorPrompt(node, suggestions),
        { label: `actor:${node.id}:revise`, phase: 'Execute', schema: ACTOR_SCHEMA })
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
  const needsCritic = node.ac_required || node.is_final_deliverable ||
    ((node.v_class === 'V0' || node.v_class === 'V1') && !selfClosed)

  if (!needsCritic) {
    return { node: node.id, status: actor.outcome, actor, closed_by: selfClosed ? 'check' : 'executor' }
  }

  // Actor-critic gate (§3). Panel for the final deliverable, else 1 critic. Trimmed to 2
  // lenses: criteria-conformance duplicated correctness in practice (first daylight mission),
  // so the third agent bought ~no distinct findings. Budget relocated to the cold-improver above.
  const lenses = node.is_final_deliverable
    ? ['correctness', 'completeness']
    : [null]
  const findingSets = await parallel(lenses.map(lens => () =>
    agent(criticPrompt(node, actor.artifact_summary, lens),
      { label: `critic:${node.id}${lens ? ':' + lens : ''}`, phase: 'Execute', schema: CRITIC_SCHEMA })))

  const verdict = adjudicate(findingSets)

  // Cold-reviewer rotation (§3.4), token-frugal. Detection is FREE (the boolean below, no
  // model call). Fire ONE cold reviewer only to double-check a *clean* verdict on the final
  // deliverable: a stale green is the only dangerous case, so a review that already found
  // issues gets no cold pass, and routine nodes get none ever. Net cost ≤1 critic call/mission.
  let coldConfirmed = false
  const candidateClean = verdict.blockers.length === 0 && verdict.majors.length === 0
  if (node.is_final_deliverable && candidateClean && capFor(node, 'cold_swaps') > 0) {
    const cold = await agent(coldCriticPrompt(node, actor.artifact_summary),
      { label: `critic:${node.id}:cold`, phase: 'Execute', schema: CRITIC_SCHEMA })
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
    closed_by: 'critic', critic: verdict,
    cold_confirmed: coldConfirmed,
    blocked: verdict.blockers.length > 0,
  }
}

// ── Main DAG walk: wave-based ready-set (correct for general DAG + dynamic replan) ──
phase('Execute')
log(`Mission ${plan.run_id} — ${plan.nodes.length} nodes, mode=${MODE}, constitution=${C}`)

const doneSet = new Set(Object.keys(completed))
const results = { ...completed }
let nodes = plan.nodes.slice()
let replanBudget = (DEFAULT_CAPS.subtree_replans * 2) // mission-level ceiling (§6.2: 3/mission; kept conservative)

while (doneSet.size < nodes.length) {
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
    verdict: (blockers.length === 0 && !failed) ? 'DELIVERED' : 'DIVERGED',
    unresolved_blockers: blockers,
    accepted_majors: majors,
    replans: replans.map(r => ({ node: r.node, reason: r.reason })),
    punchlist: [],
    ledger,
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

const audit = await agent(`${govern}

AUDIT PHASE for mission ${plan.run_id} (class ${MCLASS}), goal: ${plan.goal}.
Per-node execution results:
${auditSummary}

Unresolved blockers (human-only to waive): ${JSON.stringify(blockers)}
Open majors (agent accept-with-reason allowed): ${JSON.stringify(majors)}
Plan-assumption-false nodes: ${JSON.stringify(replans.map(r => ({ node: r.node, reason: r.reason })))}

${recheckInstruction} Assemble the punchlist (each item is a candidate new node) and the
defect ledger (majors accepted-with-reason + minors + unreached criteria). Verdict DELIVERED
unless the mission diverged (§6.3) or an unwaived blocker remains.`,
  { label: 'audit', phase: 'Audit', schema: AUDIT_SCHEMA })

return {
  run_id: plan.run_id,
  mission_class: MCLASS,
  verdict: audit ? audit.verdict : 'DIVERGED',
  unresolved_blockers: blockers,            // human-only; drive the "Needs you" report section
  accepted_majors: majors,
  replans: replans.map(r => ({ node: r.node, reason: r.reason })),
  punchlist: audit ? audit.punchlist : [],
  ledger: audit ? audit.ledger : [],
  node_results: results,
}
