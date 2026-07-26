export const meta = {
  name: 'mission-executor',
  description: 'Walk a frozen mission DAG, verify reviewed nodes, repair bounded audit failures, and persist the terminal result',
  phases: [
    { title: 'Execute', detail: 'run ready mission nodes and record evidence' },
    { title: 'Audit', detail: 'audit, persist, repair at most twice, and terminalize' },
  ],
}

const MAX_NODE_REPAIR_CYCLES = 1
const MAX_AUDIT_REPAIR_CYCLES = 2

const FINDING = {
  type: 'object',
  required: ['locus', 'criterion', 'evidence', 'consequence', 'recommendation'],
  additionalProperties: false,
  properties: {
    locus: { type: 'string' },
    criterion: { type: 'string' },
    evidence: { type: 'string' },
    consequence: { type: 'string' },
    recommendation: { type: 'string' },
  },
}

const NODE_RESULT = {
  type: 'object',
  required: ['outcome', 'summary', 'files_changed', 'witness', 'commit_sha', 'notes'],
  additionalProperties: false,
  properties: {
    outcome: { enum: ['done', 'blocked', 'plan_assumption_false', 'failed'] },
    summary: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    witness: {
      type: 'object',
      required: ['status', 'method', 'evidence'],
      additionalProperties: false,
      properties: {
        status: { enum: ['passed', 'failed', 'deferred'] },
        method: { type: 'string' },
        evidence: { type: 'string' },
      },
    },
    commit_sha: { type: ['string', 'null'], pattern: '^[0-9a-fA-F]{7,64}$' },
    notes: { type: 'string' },
  },
}

const REVIEW_RESULT = {
  type: 'object',
  required: ['status', 'findings', 'summary'],
  additionalProperties: false,
  properties: {
    status: { enum: ['passed', 'failed'] },
    findings: { type: 'array', items: FINDING },
    summary: { type: 'string' },
  },
}

const CHECKPOINT_RESULT = {
  type: 'object',
  required: ['commit_sha', 'summary'],
  additionalProperties: false,
  properties: {
    commit_sha: { type: 'string', pattern: '^[0-9a-fA-F]{7,64}$' },
    summary: { type: 'string' },
  },
}

const REPAIR_RESULT = {
  type: 'object',
  required: ['outcome', 'summary', 'commit_sha', 'notes'],
  additionalProperties: false,
  properties: {
    outcome: { enum: ['repaired', 'blocked'] },
    summary: { type: 'string' },
    commit_sha: { type: ['string', 'null'], pattern: '^[0-9a-fA-F]{7,64}$' },
    notes: { type: 'string' },
  },
}

const AUDIT_RESULT = {
  type: 'object',
  required: ['status', 'findings', 'human_deferred', 'summary'],
  additionalProperties: false,
  properties: {
    status: { enum: ['passed', 'failed', 'human_required'] },
    findings: { type: 'array', items: FINDING },
    human_deferred: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const AUDIT_FRONTIER_RESULT = {
  type: 'object',
  required: ['status', 'next_sequence', 'repair_cycles', 'reason'],
  additionalProperties: false,
  properties: {
    status: { enum: ['ready', 'terminal', 'invalid'] },
    next_sequence: { type: 'integer', minimum: 1 },
    repair_cycles: { type: 'integer', minimum: 0, maximum: 2 },
    reason: { type: 'string' },
  },
}

const AUDIT_PERSIST_RESULT = {
  type: 'object',
  required: ['commit_sha', 'audited_commit', 'audit_path', 'summary'],
  additionalProperties: false,
  properties: {
    commit_sha: { type: 'string', pattern: '^[0-9a-fA-F]{7,64}$' },
    audited_commit: { type: 'string', pattern: '^[0-9a-fA-F]{7,64}$' },
    audit_path: { type: 'string' },
    summary: { type: 'string' },
  },
}

const TERMINAL_RESULT = {
  type: 'object',
  required: ['commit_sha', 'result_path', 'report_path', 'notification_status', 'disarm_status', 'summary'],
  additionalProperties: false,
  properties: {
    commit_sha: { type: 'string', pattern: '^[0-9a-fA-F]{7,64}$' },
    result_path: { type: 'string' },
    report_path: { type: 'string' },
    notification_status: { enum: ['sent', 'already-sent', 'ambiguous', 'reconciliation-required', 'failed', 'skipped'] },
    disarm_status: { enum: ['verified', 'failed', 'not-armed', 'skipped'] },
    summary: { type: 'string' },
  },
}

const raw = typeof args === 'string' ? JSON.parse(args) : args
const plan = raw && raw.plan ? raw.plan : raw
const completed = { ...((raw && raw.completed) || {}) }
const terminalPolicy = {
  notify: !(raw && raw.terminal && raw.terminal.notify === false),
  disarm: !(raw && raw.terminal && raw.terminal.disarm === false),
}
let auditSequence = 1
let repairCycles = 0

function assertPlan(p) {
  if (!p || p.schema_version !== '1.0') throw new Error('mission plan schema_version must be 1.0')
  for (const key of ['run_id', 'goal', 'repo', 'mode', 'branch']) {
    if (!p[key]) throw new Error(`mission plan missing ${key}`)
  }
  if (!Array.isArray(p.acceptance_criteria) || !p.acceptance_criteria.length) {
    throw new Error('mission plan needs acceptance_criteria')
  }
  if (!Array.isArray(p.nodes) || !p.nodes.length) throw new Error('mission plan needs nodes')
  const ids = new Set()
  for (const node of p.nodes) {
    if (!node.id || ids.has(node.id)) throw new Error(`invalid or duplicate node id: ${node.id}`)
    ids.add(node.id)
    for (const key of ['title', 'instruction', 'deps', 'parallelizable', 'write_set', 'acceptance_criteria', 'witness']) {
      if (node[key] === undefined) throw new Error(`node ${node.id} missing ${key}`)
    }
  }
  for (const node of p.nodes) {
    for (const dep of node.deps) if (!ids.has(dep)) throw new Error(`node ${node.id} has unknown dep ${dep}`)
  }
}

function expectedWitness(node) {
  return node.witness.kind === 'human-deferred' ? 'deferred' : 'passed'
}

function reviewConsistent(review) {
  return Boolean(review) && (
    (review.status === 'passed' && review.findings.length === 0) ||
    (review.status === 'failed' && review.findings.length > 0)
  )
}

function auditConsistent(audit) {
  return Boolean(audit) && (
    (audit.status === 'passed' && audit.findings.length === 0 && audit.human_deferred.length === 0) ||
    (audit.status === 'failed' && audit.findings.length > 0) ||
    (audit.status === 'human_required' && audit.findings.length === 0 && audit.human_deferred.length > 0)
  )
}

function assertCompleted(p, done) {
  const nodes = new Map(p.nodes.map(node => [node.id, node]))
  for (const [id, result] of Object.entries(done)) {
    const node = nodes.get(id)
    if (!node) throw new Error(`completed map contains unknown node ${id}`)
    if (!result || result.outcome !== 'done') throw new Error(`completed node ${id} lacks a done result`)
    for (const dep of node.deps) {
      if (!done[dep]) throw new Error(`completed map is not dependency-closed: ${id} lacks ${dep}`)
    }
    if (!result.witness || result.witness.status !== expectedWitness(node)) {
      throw new Error(`completed node ${id} lacks its expected ${expectedWitness(node)} witness`)
    }
    if (node.witness.kind === 'reviewed') {
      if (!reviewConsistent(result.review) || result.review.status !== 'passed') {
        throw new Error(`completed reviewed node ${id} lacks a passing independent review`)
      }
      if (!/^[0-9a-fA-F]{7,64}$/.test(result.review.commit_sha || '')) {
        throw new Error(`completed reviewed node ${id} lacks a committed review checkpoint`)
      }
    }
    if (!/^[0-9a-fA-F]{7,64}$/.test(result.commit_sha || '')) {
      throw new Error(`completed node ${id} lacks a valid recovery commit SHA`)
    }
  }
}

function actorPrompt(node) {
  const mutable = node.write_set.length > 0
  const reviewed = node.witness.kind === 'reviewed'
  return `You are the actor for one frozen mission node.

MISSION: ${plan.goal}
REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
BOUNDARIES: ${JSON.stringify(plan.boundaries || [])}
NODE: ${node.id} - ${node.title}
OWNER: ${node.owner || 'derive from the task'}
INSTRUCTION: ${node.instruction}
DEPENDENCIES: ${JSON.stringify(node.deps)}
WRITE SET: ${JSON.stringify(node.write_set)}
ACCEPTANCE CRITERIA: ${JSON.stringify(node.acceptance_criteria)}
WITNESS CLAIM: ${node.witness.claim}
WITNESS KIND: ${node.witness.kind}
WITNESS METHOD: ${node.witness.method}

Read ~/.claude/docs/operating-card.md and ${plan.repo}/.mission/contract.md. Work only inside the node scope. Run the witness and report concrete evidence. A witness must exercise the claimed property. If the premise is false, return plan_assumption_false rather than improvising a new goal.

${reviewed ? 'This is a reviewed witness. Your passing check does not close the judgment-bearing claim. A fresh artifact-only reviewer will decide after you return.' : ''}
${mutable ? `After the witness passes, append this node's result to .mission/${plan.run_id}/JOURNAL.md and commit the coherent code, journal entry, and witness on ${plan.branch}. Never add AI attribution. Return the commit SHA.` : 'This node is read-only. Do not modify files or create a commit.'}

Your structured result is the complete node result.`
}

function nodeReviewPrompt(node, actor) {
  return `You are the fresh read-only reviewer for one reviewed mission witness.

MISSION: ${plan.goal}
REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
NODE: ${node.id} - ${node.title}
ACCEPTANCE CRITERIA: ${JSON.stringify(node.acceptance_criteria)}
WITNESS CLAIM: ${node.witness.claim}
PLANNED METHOD: ${node.witness.method}
ACTOR RESULT: ${JSON.stringify(actor)}

Read ~/.claude/docs/operating-card.md and ${plan.repo}/.mission/contract.md. Inspect the actual committed artifact, not the actor's reasoning. Rerun bounded checks or spot measurements where feasible. Return failed with concrete findings when the judgment-bearing claim does not hold. Return passed only with zero findings. Do not edit files.`
}

function nodeRepairPrompt(node, actor, review, cycle) {
  return `You are the repair actor for a reviewed mission node that failed independent review.

MISSION: ${plan.goal}
REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
NODE: ${node.id} - ${node.title}
INSTRUCTION: ${node.instruction}
WRITE SET: ${JSON.stringify(node.write_set)}
ACCEPTANCE CRITERIA: ${JSON.stringify(node.acceptance_criteria)}
WITNESS: ${JSON.stringify(node.witness)}
PRIOR ACTOR RESULT: ${JSON.stringify(actor)}
REVIEW FINDINGS: ${JSON.stringify(review.findings)}
REPAIR CYCLE: ${cycle} of ${MAX_NODE_REPAIR_CYCLES}

Read ~/.claude/docs/operating-card.md and ${plan.repo}/.mission/contract.md. Fix the cited defects without narrowing the node or changing the frozen plan. Run the planned witness, append the repair and evidence to .mission/${plan.run_id}/JOURNAL.md, and commit only the coherent node repair. Never add AI attribution. Return blocked if the finding requires a changed goal, waived criterion, or human authority.`
}

function checkpointPrompt(records, label) {
  return `You are the recovery-state writer for completed read-only or independently reviewed mission work.

REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
RECORDS: ${JSON.stringify(records)}

Do not modify deliverable files. Write each complete record under .mission/${plan.run_id}/nodes/ using the node id and the suffix ${label}. Append a concise closure entry to .mission/${plan.run_id}/JOURNAL.md, and commit only those recovery artifacts on ${plan.branch}. Never add AI attribution. Return the commit SHA.`
}

function auditFrontierPrompt() {
  return `You are the read-only recovery-state loader for a governed mission.

REPOSITORY: ${plan.repo}
RUN ID: ${plan.run_id}
RUN DIRECTORY: ${plan.repo}/.mission/${plan.run_id}

Inspect result.json, audit.json, audit-repair.json, and every audits/NNN.json without editing. Validate existing numbered audits with ~/.claude/docs/mission-audit.schema.json and audit-repair.json, when present, with ~/.claude/docs/mission-repair.schema.json. Numbered audit sequence values must be unique, contiguous from 1, and match their file names. The cumulative repair count is the greater of the latest audit's repair_cycles and a valid in-flight audit-repair.json count; it may never exceed ${MAX_AUDIT_REPAIR_CYCLES}. An in-flight repair must cite the latest numbered audit as source_audit_sequence.

- If no audits exist and no result exists, return ready with next_sequence 1 and repair_cycles 0.
- If valid audits exist and no result exists, return ready with next_sequence max(sequence)+1 and the cumulative repair count from the latest audit plus any valid in-flight repair checkpoint.
- If result.json exists, run ~/.claude/scripts/validate_terminal.py on the run directory. Return terminal only when it passes.
- Return invalid for malformed, duplicate, noncontiguous, contradictory, or uncommitted state. Never repair or overwrite recovery state here.`
}

function auditPrompt() {
  return `You are the fresh read-only auditor for an integrated mission.

MISSION: ${plan.goal}
REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
FROZEN GOVERNANCE: ${JSON.stringify(plan.governance || null)}
MISSION ACCEPTANCE CRITERIA: ${JSON.stringify(plan.acceptance_criteria)}
BOUNDARIES: ${JSON.stringify(plan.boundaries || [])}
NODE RESULTS: ${JSON.stringify(completed)}

Read ~/.claude/docs/agent-constitution.md, ~/.claude/docs/operating-card.md, ~/.claude/docs/lmo-version.txt, ~/.claude/workflows/mission-executor.workflow.js, and ${plan.repo}/.mission/contract.md. Inspect the actual integrated artifact and rerun the relevant witnesses where feasible. When frozen governance is present, compare the deployed runtime version and SHA-256 digests of the constitution, contract, and executor against every frozen value; any unexplained mismatch is a finding. A green check closes only the property it observes. Return failed when any non-deferred finding survives, human_required only when there are no findings and the remaining criteria are explicitly human-deferred, and passed only when every criterion has evidence with nothing deferred. Do not edit files.`
}

function auditPersistPrompt(audit, sequence, cumulativeRepairCycles) {
  return `You are the canonical audit-state writer for a governed mission.

REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
AUDIT SEQUENCE: ${sequence}
CUMULATIVE REPAIR CYCLES: ${cumulativeRepairCycles}
AUDIT: ${JSON.stringify(audit)}

Before writing, capture the current Git HEAD as audited_commit. Read the deployed runtime version from ~/.claude/docs/lmo-version.txt. Compute SHA-256 for ~/.claude/docs/agent-constitution.md, ${plan.repo}/.mission/contract.md, and ~/.claude/workflows/mission-executor.workflow.js.

Refuse to overwrite an existing numbered audit. If .mission/${plan.run_id}/audit-repair.json exists, require its repair_cycles to equal ${cumulativeRepairCycles}, then delete it as part of this audit-state commit. Write the exact structured record to .mission/${plan.run_id}/audits/${String(sequence).padStart(3, '0')}.json and replace .mission/${plan.run_id}/audit.json with the same bytes. The record must conform to ~/.claude/docs/mission-audit.schema.json and contain schema_version, run_id, sequence, cumulative repair_cycles, audited_commit, runtime_version, governance digests, and the exact audit object. Validate both files with ~/.claude/scripts/validate_record.py. Append a concise audit entry to .mission/${plan.run_id}/JOURNAL.md and commit only these audit-state artifacts. Never add AI attribution. Return the audited commit, audit path, and new commit SHA.`
}

function auditRepairPrompt(audit, cycle) {
  return `You are the bounded repair actor for a failed canonical mission audit.

MISSION: ${plan.goal}
REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
BOUNDARIES: ${JSON.stringify(plan.boundaries || [])}
FROZEN ACCEPTANCE CRITERIA: ${JSON.stringify(plan.acceptance_criteria)}
AUDIT FINDINGS: ${JSON.stringify(audit.findings)}
REPAIR CYCLE: ${cycle} of ${MAX_AUDIT_REPAIR_CYCLES}

Read ~/.claude/docs/agent-constitution.md, ~/.claude/docs/operating-card.md, and ${plan.repo}/.mission/contract.md. Fix every surviving non-deferred finding in one coherent pass. Do not alter the frozen goal, acceptance criteria, or human boundaries. Restrict edits to the cited implementation, its direct tests, and documentation required to keep the mechanism coherent. Run the relevant integrated witnesses. Write .mission/${plan.run_id}/audit-repair.json with schema_version 1.0, run_id ${plan.run_id}, repair_cycles ${cycle}, and source_audit_sequence ${auditSequence}; validate it against ~/.claude/docs/mission-repair.schema.json. Append the repair and evidence to .mission/${plan.run_id}/JOURNAL.md, and commit the code, witness, journal, and repair checkpoint together on ${plan.branch}. Never add AI attribution. Return blocked when any surviving finding requires a human waiver, changed goal, or unavailable authority. If you committed partial repairs before discovering that blocker, still return the commit SHA so a fresh audit can judge the changed artifact before terminalization; return a null commit only when nothing changed.`
}

function terminalPrompt(audit, persisted, sequence, repairCycles) {
  return `You are the terminal-state writer for a governed mission. This role is the sole owner of the persistent result, terminal email, and recovery disarm.

REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
GOAL: ${plan.goal}
AUDIT SEQUENCE: ${sequence}
AUDIT FILE: ${persisted.audit_path}
AUDITED COMMIT: ${persisted.audited_commit}
REPAIR CYCLES: ${repairCycles}
AUDIT: ${JSON.stringify(audit)}

1. Write .mission/${plan.run_id}/result.json conforming to ~/.claude/docs/mission-result.schema.json. Status is the audit status; success is true only for passed. Include the audit sequence, audited commit, audit file, repair cycle count, exact findings, exact human_deferred list, summary, and current ISO timestamp.
2. Write .mission/${plan.run_id}/REPORT.md for every terminal status, including failed. Lead with the status and plain-language summary, then Needs you, Findings, Deferred, and Evidence sections. A failed report is a terminal handoff, not a success claim.
3. Create .mission/${plan.run_id}/mission.success only when status is passed; otherwise ensure it is absent.
4. Validate result.json with ~/.claude/scripts/validate_record.py, append the terminal entry to .mission/${plan.run_id}/JOURNAL.md, and commit the result, report, success marker if any, and journal. Then run `python ~/.claude/scripts/validate_terminal.py "${plan.repo}/.mission/${plan.run_id}"`; do not notify or disarm unless it passes. Never add AI attribution.
5. ${terminalPolicy.notify ? `Run: python ~/.claude/scripts/mission_notify.py --run-dir "${plan.repo}/.mission/${plan.run_id}". Never automatically replay an ambiguous or prepared notification. Commit notification.json if it changed, even when sending failed.` : 'Do not send email for this nested executor call. Return notification_status skipped.'}
6. ${terminalPolicy.disarm ? `Disarm recovery with: powershell.exe -NoProfile -ExecutionPolicy Bypass -File ~/.claude/scripts/mission_heartbeat.ps1 disarm -RunDir "${plan.repo}/.mission/${plan.run_id}". A terminal result disarms for passed, failed, and human_required alike. Record whether disarm was verified.` : 'Do not disarm recovery for this nested executor call. Return disarm_status skipped.'}

${terminalPolicy.notify ? 'Invoking /mission authorizes exactly this one configured terminal report email. Do not perform any other external communication.' : 'This nested call has no external communication authority.'} Return the latest commit SHA and the actual notification and disarm statuses.`
}

function failureAudit(locus, criterion, evidence, consequence, recommendation, summary) {
  return {
    status: 'failed',
    findings: [{ locus, criterion, evidence, consequence, recommendation }],
    human_deferred: [],
    summary,
  }
}

function isReady(node, pending) {
  return node.deps.every(dep => completed[dep] && !pending.has(dep))
}

async function checkpoint(records, label) {
  return agent(checkpointPrompt(records, label), {
    label: `checkpoint:${records.map(record => record.node_id).join(',')}`,
    phase: 'Execute',
    schema: CHECKPOINT_RESULT,
  })
}

async function reviewNode(node, result) {
  let actorResult = result
  let review = await agent(nodeReviewPrompt(node, actorResult), {
    label: `review:${node.id}`,
    phase: 'Execute',
    schema: REVIEW_RESULT,
  })
  if (!reviewConsistent(review)) {
    return { result: actorResult, review: null, error: 'independent review failed or contradicted its findings' }
  }

  for (let cycle = 1; review.status === 'failed' && cycle <= MAX_NODE_REPAIR_CYCLES; cycle++) {
    const repaired = await agent(nodeRepairPrompt(node, actorResult, review, cycle), {
      label: `repair:${node.id}:${cycle}`,
      phase: 'Execute',
      schema: NODE_RESULT,
    })
    if (!repaired || repaired.outcome !== 'done' || repaired.witness.status !== 'passed' || !repaired.commit_sha) {
      return { result: actorResult, review, error: 'reviewed node repair did not close with evidence' }
    }
    actorResult = repaired
    review = await agent(nodeReviewPrompt(node, actorResult), {
      label: `review:${node.id}:after-repair`,
      phase: 'Execute',
      schema: REVIEW_RESULT,
    })
    if (!reviewConsistent(review)) {
      return { result: actorResult, review: null, error: 'post-repair review failed or contradicted its findings' }
    }
  }

  if (review.status !== 'passed') {
    return { result: actorResult, review, error: 'independent review still has findings after the bounded repair' }
  }
  return { result: actorResult, review, error: null }
}

async function loadAuditFrontier() {
  return agent(auditFrontierPrompt(), {
    label: 'audit-state:load',
    phase: 'Execute',
    schema: AUDIT_FRONTIER_RESULT,
  })
}

async function persistAudit(audit, sequence, cumulativeRepairCycles) {
  return agent(auditPersistPrompt(audit, sequence, cumulativeRepairCycles), {
    label: `audit-state:${sequence}`,
    phase: 'Audit',
    schema: AUDIT_PERSIST_RESULT,
  })
}

async function terminalize(audit, persisted, sequence, repairCycles) {
  return agent(terminalPrompt(audit, persisted, sequence, repairCycles), {
    label: 'mission:terminal',
    phase: 'Audit',
    schema: TERMINAL_RESULT,
  })
}

async function closeEarly(audit, completedState) {
  phase('Audit')
  const persisted = await persistAudit(audit, auditSequence, repairCycles)
  if (!persisted) return { status: 'failed', completed: completedState, audit, reason: 'audit persistence failed' }
  const terminal = await terminalize(audit, persisted, auditSequence, repairCycles)
  if (!terminal) return { status: 'failed', completed: completedState, audit, persisted, reason: 'terminal persistence failed' }
  return { status: audit.status, completed: completedState, audit, persisted, terminal }
}

assertPlan(plan)
assertCompleted(plan, completed)
phase('Execute')
const frontier = await loadAuditFrontier()
if (!frontier || frontier.status === 'invalid') {
  return {
    status: 'failed',
    completed,
    reason: frontier ? frontier.reason : 'audit recovery frontier could not be loaded',
  }
}
if (frontier.status === 'terminal') {
  return { status: 'terminal', completed, reason: frontier.reason }
}
auditSequence = frontier.next_sequence
repairCycles = frontier.repair_cycles
const pending = new Map(plan.nodes.filter(node => !completed[node.id]).map(node => [node.id, node]))
const orderedIds = plan.nodes.map(node => node.id)
while (pending.size) {
  const ready = orderedIds.map(id => pending.get(id)).filter(Boolean).filter(node => isReady(node, pending))
  if (!ready.length) {
    return await closeEarly(failureAudit(
      'plan dependency graph',
      'The frozen plan must be dependency-complete and executable.',
      `No ready node remained while pending nodes were ${JSON.stringify([...pending.keys()])}.`,
      'The mission cannot continue or recover deterministically.',
      'Correct the invalid frozen plan only through human reopening.',
      'Mission stopped because the frozen plan contains a dependency deadlock.'
    ), completed)
  }

  const readOnlyBatch = ready.filter(node => node.parallelizable && node.write_set.length === 0)
  const batch = readOnlyBatch.length ? readOnlyBatch : [ready[0]]
  log(`Running mission nodes: ${batch.map(node => node.id).join(', ')}`)

  const outputs = await parallel(batch.map(node => () =>
    agent(actorPrompt(node), {
      label: `node:${node.id}`,
      phase: 'Execute',
      schema: NODE_RESULT,
    }).then(result => ({ node, result }))
  ))

  const accepted = []
  for (let index = 0; index < outputs.length; index++) {
    const output = outputs[index]
    const node = batch[index]
    if (!output) {
      return await closeEarly(failureAudit(
        node.id,
        node.acceptance_criteria.join(' | '),
        'The actor agent returned no result.',
        'The node has no trustworthy closure evidence.',
        'Resume the node with a fresh actor after inspecting the failure.',
        `Mission stopped because actor ${node.id} failed.`
      ), completed)
    }

    let result = output.result
    if (!result || result.outcome !== 'done') {
      return await closeEarly(failureAudit(
        node.id,
        node.acceptance_criteria.join(' | '),
        JSON.stringify(result || null),
        'The node did not satisfy its frozen completion contract.',
        result && result.outcome === 'plan_assumption_false' ? 'Humanly reopen the affected premise before replanning.' : 'Repair or explicitly reopen the node.',
        `Mission stopped at node ${node.id} with outcome ${result ? result.outcome : 'failed'}.`
      ), completed)
    }

    const expected = expectedWitness(node)
    if (result.witness.status !== expected) {
      return await closeEarly(failureAudit(
        node.id,
        node.witness.claim,
        `Expected witness ${expected}, received ${result.witness.status}: ${result.witness.evidence}`,
        'The completion claim is not licensed by its planned evidence.',
        'Run the planned witness or defer only through a frozen human-deferred witness.',
        `Mission stopped because node ${node.id} lacked its expected witness.`
      ), completed)
    }

    if (node.write_set.length > 0 && !result.commit_sha) {
      return await closeEarly(failureAudit(
        node.id,
        'Every mutating node must commit its code, journal entry, and witness.',
        'The node returned done without a commit SHA.',
        'Recovery cannot reconstruct the completed mutation.',
        'Commit the coherent node closure before resuming.',
        `Mission stopped because node ${node.id} lacked committed recovery state.`
      ), completed)
    }

    if (node.witness.kind === 'reviewed') {
      const reviewed = await reviewNode(node, result)
      if (reviewed.error) {
        return await closeEarly(failureAudit(
          node.id,
          node.witness.claim,
          reviewed.review ? JSON.stringify(reviewed.review.findings) : reviewed.error,
          'The judgment-bearing node lacks independent closure.',
          'Address the surviving review findings or reopen the criterion.',
          `Mission stopped because reviewed node ${node.id} did not pass independent review.`
        ), completed)
      }
      result = { ...reviewed.result, review: reviewed.review }
    }
    accepted.push({ node, result })
  }

  if (accepted.every(({ node }) => node.write_set.length === 0)) {
    const records = accepted.map(({ node, result }) => ({ node_id: node.id, ...result }))
    const recovery = await checkpoint(records, 'closure.json')
    if (!recovery) {
      return await closeEarly(failureAudit(
        batch[0].id,
        'Completed read-only work must have a committed recovery checkpoint.',
        'The checkpoint writer returned no result.',
        'Resume cannot reconstruct the completed batch.',
        'Persist the complete node results before continuing.',
        'Mission stopped because read-only recovery state was not committed.'
      ), completed)
    }
    for (const item of accepted) {
      item.result = { ...item.result, commit_sha: recovery.commit_sha }
      if (item.result.review) item.result.review = { ...item.result.review, commit_sha: recovery.commit_sha }
    }
  } else {
    for (const item of accepted.filter(({ node, result }) => node.witness.kind === 'reviewed' && result.review)) {
      const recovery = await checkpoint([{ node_id: item.node.id, review: item.result.review }], 'review.json')
      if (!recovery) {
        return await closeEarly(failureAudit(
          item.node.id,
          'Independent reviewed-witness closure must be committed.',
          'The review checkpoint writer returned no result.',
          'Recovery would lose the independent judgment that closed the node.',
          'Persist the review before continuing.',
          `Mission stopped because reviewed node ${item.node.id} lacked committed review state.`
        ), completed)
      }
      item.result.review = { ...item.result.review, commit_sha: recovery.commit_sha }
    }
  }

  for (const { node, result } of accepted) {
    completed[node.id] = result
    pending.delete(node.id)
  }
}

phase('Audit')
let audit = null
let persisted = null
let repairsBlocked = false

while (true) {
  audit = await agent(auditPrompt(), {
    label: `mission:audit:${auditSequence}`,
    phase: 'Audit',
    schema: AUDIT_RESULT,
  })
  if (!auditConsistent(audit)) {
    audit = failureAudit(
      'canonical integrated audit',
      'The final audit status must agree with its findings and deferred criteria.',
      JSON.stringify(audit || null),
      'An internally contradictory audit cannot govern delivery.',
      'Run a fresh canonical audit.',
      'Mission failed because the canonical audit was missing or internally contradictory.'
    )
  }

  persisted = await persistAudit(audit, auditSequence, repairCycles)
  if (!persisted) {
    return { status: 'failed', completed, audit, reason: 'canonical audit could not be persisted' }
  }

  if (audit.status !== 'failed' || repairCycles >= MAX_AUDIT_REPAIR_CYCLES || repairsBlocked) break

  const repair = await agent(auditRepairPrompt(audit, repairCycles + 1), {
    label: `mission:audit-repair:${repairCycles + 1}`,
    phase: 'Audit',
    schema: REPAIR_RESULT,
  })
  if (!repair || !repair.commit_sha) break

  repairCycles += 1
  auditSequence += 1
  repairsBlocked = repair.outcome === 'blocked'
}

const terminal = await terminalize(audit, persisted, auditSequence, repairCycles)
if (!terminal) {
  return {
    status: 'failed',
    completed,
    audit,
    persisted,
    repair_cycles: repairCycles,
    reason: 'terminal result could not be persisted',
  }
}

return {
  status: audit.status,
  completed,
  audit,
  persisted,
  terminal,
  repair_cycles: repairCycles,
}
