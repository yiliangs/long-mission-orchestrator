export const meta = {
  name: 'mission-executor',
  description: 'Walk a frozen mission DAG, run claim-observing witnesses, and audit the integrated result',
  phases: [
    { title: 'Execute', detail: 'run ready mission nodes and record evidence' },
    { title: 'Audit', detail: 'check the integrated artifact against mission acceptance criteria' },
  ],
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

const CHECKPOINT_RESULT = {
  type: 'object',
  required: ['commit_sha', 'summary'],
  additionalProperties: false,
  properties: {
    commit_sha: { type: 'string', pattern: '^[0-9a-fA-F]{7,64}$' },
    summary: { type: 'string' },
  },
}

const AUDIT_RESULT = {
  type: 'object',
  required: ['status', 'findings', 'human_deferred', 'summary'],
  additionalProperties: false,
  properties: {
    status: { enum: ['passed', 'failed', 'human_required'] },
    findings: {
      type: 'array',
      items: {
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
      },
    },
    human_deferred: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const raw = typeof args === 'string' ? JSON.parse(args) : args
const plan = raw && raw.plan ? raw.plan : raw
const completed = { ...((raw && raw.completed) || {}) }

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

function assertCompleted(p, done) {
  const nodes = new Map(p.nodes.map(node => [node.id, node]))
  for (const [id, result] of Object.entries(done)) {
    const node = nodes.get(id)
    if (!node) throw new Error(`completed map contains unknown node ${id}`)
    if (!result || result.outcome !== 'done') throw new Error(`completed node ${id} lacks a done result`)
    for (const dep of node.deps) {
      if (!done[dep]) throw new Error(`completed map is not dependency-closed: ${id} lacks ${dep}`)
    }
    const expected = node.witness.kind === 'human-deferred' ? 'deferred' : 'passed'
    if (!result.witness || result.witness.status !== expected) {
      throw new Error(`completed node ${id} lacks its expected ${expected} witness`)
    }
    if (!/^[0-9a-fA-F]{7,64}$/.test(result.commit_sha || '')) {
      throw new Error(`completed node ${id} lacks a valid recovery commit SHA`)
    }
  }
}

function actorPrompt(node) {
  const mutable = node.write_set.length > 0
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

Read ~/.claude/docs/operating-card.md and follow it. Work only inside the node scope. Run the witness and report concrete evidence. A witness must exercise the claimed property. If the premise is false, return plan_assumption_false rather than improvising a new goal.

${mutable ? `After the witness passes, append this node's result to .mission/${plan.run_id}/journal.md and commit the coherent code, journal entry, and witness on ${plan.branch}. Never add AI attribution. Return the commit SHA.` : 'This node is read-only. Do not modify files or create a commit.'}

Your structured result is the complete node result.`
}

function checkpointPrompt(results) {
  return `You are the recovery-state writer for a completed read-only mission batch.

REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
RUN ID: ${plan.run_id}
NODE RESULTS: ${JSON.stringify(results)}

Do not modify deliverable files. For each result, write .mission/${plan.run_id}/nodes/<node-id>.json containing the complete result, append a concise closure entry to .mission/${plan.run_id}/journal.md, and commit only those recovery artifacts on ${plan.branch}. Never add AI attribution. Return the commit SHA.`
}

function isReady(node, pending) {
  return node.deps.every(dep => completed[dep] && !pending.has(dep))
}

assertPlan(plan)
assertCompleted(plan, completed)
const pending = new Map(plan.nodes.filter(n => !completed[n.id]).map(n => [n.id, n]))
const orderedIds = plan.nodes.map(n => n.id)

phase('Execute')
while (pending.size) {
  const ready = orderedIds.map(id => pending.get(id)).filter(Boolean).filter(node => isReady(node, pending))
  if (!ready.length) {
    return { status: 'invalid_plan', completed, pending: [...pending.keys()], reason: 'dependency deadlock' }
  }

  const readOnlyBatch = ready.filter(node => node.parallelizable && node.write_set.length === 0)
  const batch = readOnlyBatch.length ? readOnlyBatch : [ready[0]]
  log(`Running mission nodes: ${batch.map(n => n.id).join(', ')}`)

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
      return { status: 'failed', blocked_node: node.id, reason: 'actor agent failed', completed }
    }
    const { result } = output
    if (!result || result.outcome !== 'done') {
      return {
        status: result ? result.outcome : 'failed',
        blocked_node: node.id,
        result: result || null,
        completed,
      }
    }

    const expected = node.witness.kind === 'human-deferred' ? 'deferred' : 'passed'
    if (result.witness.status !== expected) {
      return {
        status: 'witness_failed',
        blocked_node: node.id,
        expected_witness_status: expected,
        result,
        completed,
      }
    }

    if (node.write_set.length > 0 && !result.commit_sha) {
      return {
        status: 'recovery_state_missing',
        blocked_node: node.id,
        reason: 'mutating node closed without a committed journal and witness',
        result,
        completed,
      }
    }
    accepted.push({ node, result })
  }

  if (accepted.every(({ node }) => node.write_set.length === 0)) {
    const records = accepted.map(({ node, result }) => ({ node_id: node.id, ...result }))
    const checkpoint = await agent(checkpointPrompt(records), {
      label: `checkpoint:${batch.map(node => node.id).join(',')}`,
      phase: 'Execute',
      schema: CHECKPOINT_RESULT,
    })
    if (!checkpoint) {
      return {
        status: 'recovery_state_missing',
        blocked_node: batch[0].id,
        reason: 'read-only batch closed without a committed recovery checkpoint',
        completed,
      }
    }
    for (const item of accepted) item.result = { ...item.result, commit_sha: checkpoint.commit_sha }
  }

  for (const { node, result } of accepted) {
    completed[node.id] = result
    pending.delete(node.id)
  }
}

phase('Audit')
const audit = await agent(`You are the fresh read-only auditor for an integrated mission.

MISSION: ${plan.goal}
REPOSITORY: ${plan.repo}
BRANCH: ${plan.branch}
MISSION ACCEPTANCE CRITERIA: ${JSON.stringify(plan.acceptance_criteria)}
BOUNDARIES: ${JSON.stringify(plan.boundaries || [])}
NODE RESULTS: ${JSON.stringify(completed)}

Read ~/.claude/docs/operating-card.md. Inspect the actual integrated artifact and rerun the relevant witnesses where feasible. A green check closes only the property it observes. Return failed when any non-deferred finding survives, human_required only when there are no findings and the remaining criteria are explicitly human-deferred, and passed only when every criterion has evidence with nothing deferred. Do not edit files.`, {
  label: 'mission:audit',
  phase: 'Audit',
  schema: AUDIT_RESULT,
})

if (!audit) {
  return {
    status: 'failed',
    completed,
    audit: null,
    reason: 'final audit agent failed',
  }
}

const auditConsistent =
  (audit.status === 'passed' && audit.findings.length === 0 && audit.human_deferred.length === 0) ||
  (audit.status === 'failed' && audit.findings.length > 0) ||
  (audit.status === 'human_required' && audit.findings.length === 0 && audit.human_deferred.length > 0)
if (!auditConsistent) {
  return {
    status: 'failed',
    completed,
    audit,
    reason: 'final audit result contradicts its evidence',
  }
}

return {
  status: audit.status,
  completed,
  audit,
}
