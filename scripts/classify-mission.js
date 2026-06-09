#!/usr/bin/env node
// Deterministic mission classifier (constitution §2.4).
//
// The mission class decides how much ceremony a mission gets — M0 skips FIGHT, the audit agent,
// the heartbeat, AND the attended go-gate — so it must NOT hang on an LLM self-label. This
// computes the class FLOOR from deterministic plan facts; the planner's self-assigned class may
// only RAISE ceremony above the floor (judgment like "high-stakes" → M2), never lower it
// (§2.2 round-up). M0 is granted only when the crisp gate provably holds in code.
//
// The orchestrator runs this at PLAN on the drafted plan (`--write` sets plan.mission_class).
// The Workflow executor mirrors classFloor() inline as a backstop (it cannot require this file).
//
//   node classify-mission.js <plan.json> [--write]
//   → prints the enforced class to stdout; diagnostics to stderr.

const V = { V0: 0, V1: 1, V2: 2, V3: 3 }
const CEREMONY = { M0: 0, M1: 1, M2: 2 }

// The deterministic floor: the LEAST ceremony the plan's facts permit.
function classFloor(plan) {
  const nodes = (plan && plan.nodes) || []
  if (nodes.length === 0) return 'M1'
  const vMax = nodes.reduce((m, n) => Math.max(m, V[n.v_class] != null ? V[n.v_class] : 2), 0)
  const zones = (plan && plan.deliverable_zones) || []
  const matchesZone = w => zones.some(z => w === z || w.includes(z) || z.includes(w))
  const touchesZone = nodes.some(n => Array.isArray(n.write_set) && n.write_set.some(matchesZone))
  const unknownReach = nodes.some(n => !Array.isArray(n.write_set)) // can't prove it avoids a zone
  if (vMax >= V.V3) return 'M2'                                     // human-only work ⇒ full machinery
  // M0 only when the crisp gate PROVABLY holds; otherwise at least M1. The M1↔M2 line ("large n",
  // "high-stakes") is the planner's judgment and may only RAISE — enforced by enforceClass().
  const m0ok = nodes.length <= 2 && vMax <= V.V1 && !touchesZone && !unknownReach
  return m0ok ? 'M0' : 'M1'
}

// The planner may raise above the floor (judgment), never below it.
function enforceClass(plan) {
  const floor = classFloor(plan)
  const claimed = plan && plan.mission_class
  if (claimed == null) return floor
  return (CEREMONY[claimed] != null ? CEREMONY[claimed] : 1) >= CEREMONY[floor] ? claimed : floor
}

if (require.main === module) {
  const fs = require('fs')
  const file = process.argv[2]
  if (!file) { console.error('usage: node classify-mission.js <plan.json> [--write]'); process.exit(2) }
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
  const floor = classFloor(plan)
  const enforced = enforceClass(plan)
  const claimed = plan.mission_class != null ? plan.mission_class : '(none)'
  process.stderr.write(`floor=${floor} claimed=${claimed} enforced=${enforced}` +
    (enforced !== claimed ? '  [RAISED — planner under-classified the floor]' : '') + '\n')
  if (process.argv.includes('--write')) {
    plan.mission_class = enforced
    fs.writeFileSync(file, JSON.stringify(plan, null, 2))
    process.stderr.write(`wrote mission_class=${enforced} to ${file}\n`)
  }
  process.stdout.write(enforced + '\n')
}

module.exports = { classFloor, enforceClass }
