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
// INPUT: `args` is the parsed plan.json object (the Workflow sandbox has no FS
//        access, so /mission reads the file and passes the object verbatim).
//        Spawned agents DO have tool access and read the repo / constitution /
//        node files themselves.
//
// RESUME: node-granular. `args.completed` (optional) is a map of nodeId -> result
//        from a prior interrupted run; those nodes are skipped. The DAG is the
//        journal at node granularity (constitution §10).
// ─────────────────────────────────────────────────────────────────────────────

const plan = args
const completed = (args && args.completed) || {}

const C = plan.constitution_version || 'unknown'
const REPO = plan.repo
const MODE = plan.mode
const ZONES = plan.deliverable_zones || []

// Default caps (constitution §6.2). Per-node overrides live on node.caps.
const DEFAULT_CAPS = {
  micro_loop_retries: 3,
  sub_loop_iterations: 5,
  subtree_replans: 2,
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

const govern = `You operate under ~/.claude/docs/agent-constitution.md (version ${C}). ` +
  `Read it if you have not. Repo: ${REPO}. Deliverable zones (V2 floor): ${JSON.stringify(ZONES)}.`

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
  {check_command, exit_status, output_digest, timestamp}. No passing recorded check ⇒ do
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

  // Close-time binding (§2.1): V0/V1 with no valid closure record ⇒ downgrade to V2.
  const selfClosed = (node.v_class === 'V0' || node.v_class === 'V1') &&
    actor.outcome === 'done' && actor.closure_record &&
    actor.closure_record.exit_status === 0
  const needsCritic = node.ac_required || node.is_final_deliverable ||
    ((node.v_class === 'V0' || node.v_class === 'V1') && !selfClosed)

  if (!needsCritic) {
    return { node: node.id, status: actor.outcome, actor, closed_by: selfClosed ? 'check' : 'executor' }
  }

  // Actor-critic gate (§3). Panel of 3 lenses for the final deliverable, else 1 critic.
  const lenses = node.is_final_deliverable
    ? ['correctness', 'completeness', 'criteria-conformance']
    : [null]
  const findingSets = await parallel(lenses.map(lens => () =>
    agent(criticPrompt(node, actor.artifact_summary, lens),
      { label: `critic:${node.id}${lens ? ':' + lens : ''}`, phase: 'Execute', schema: CRITIC_SCHEMA })))

  const verdict = adjudicate(findingSets)
  return {
    node: node.id, status: actor.outcome, actor,
    closed_by: 'critic', critic: verdict,
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
  // Fan out the parallelizable ready nodes together; run the rest one-by-one this wave.
  const par = ready.filter(n => n.parallelizable)
  const seq = ready.filter(n => !n.parallelizable)

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

// ── Audit (§6) ───────────────────────────────────────────────────────────────
phase('Audit')
const blockers = Object.values(results).flatMap(r => (r.critic && r.critic.blockers) || [])
const majors = Object.values(results).flatMap(r => (r.critic && r.critic.majors) || [])
const replans = Object.values(results).filter(r => r.status === 'replan')

const auditSummary = Object.values(results).map(r =>
  `[${r.node}] status=${r.status} closed_by=${r.closed_by || '-'}` +
  `${r.critic ? ` blockers=${r.critic.blockers.length} majors=${r.critic.majors.length}` : ''}`).join('\n')

const audit = await agent(`${govern}

AUDIT PHASE for mission ${plan.run_id}, goal: ${plan.goal}.
Per-node execution results:
${auditSummary}

Unresolved blockers (human-only to waive): ${JSON.stringify(blockers)}
Open majors (agent accept-with-reason allowed): ${JSON.stringify(majors)}
Plan-assumption-false nodes: ${JSON.stringify(replans.map(r => ({ node: r.node, reason: r.reason })))}

Re-run ALL recorded closure checks and judge-sample 2-3 self-closures for sufficiency
(§2.1). Assemble the punchlist (each item is a candidate new node) and the defect ledger
(majors accepted-with-reason + minors + unreached criteria). Verdict DELIVERED unless the
mission diverged (§6.3) or an unwaived blocker remains.`,
  { label: 'audit', phase: 'Audit', schema: AUDIT_SCHEMA })

return {
  run_id: plan.run_id,
  verdict: audit ? audit.verdict : 'DIVERGED',
  unresolved_blockers: blockers,            // human-only; drive the "Needs you" report section
  accepted_majors: majors,
  replans: replans.map(r => ({ node: r.node, reason: r.reason })),
  punchlist: audit ? audit.punchlist : [],
  ledger: audit ? audit.ledger : [],
  node_results: results,
}
