# long-mission-orchestrator

Brain/hands split for governed autonomous missions: a planner freezes a `plan.json`
DAG, an executor walks it under actor-critic gating, and the agent constitution
(`docs/agent-constitution.md`) governs the whole. This file carries the repo-local
facts the constitution (§8) requires before any mission may run here.

## Agent contract

This repo is mission-eligible. The contract supplies the repo-local facts the
constitution (§8) leaves open: a verifier registry, deliverable zones, and the
precedence it sits under. It is intentionally minimal — every named check below maps
to a tool or script that exists in this repo or the standard toolchain.

### Verifier registry

The vocabulary executors bind from at close time. Each is a real, runnable command;
ad-hoc commands outside this registry are permitted but must be recorded in full and
are force-audited.

| Check | Command | Applies to |
|---|---|---|
| Executor JS parses | `node --check <file>` | `executors/*.js` (the canonical n-class check the plan uses for `executors/mission-executor.workflow.js`) |
| Run-record / report valid | `python scripts/validate_record.py <schema> <record>` | mission records & reports under `.mission/**` against `schema/mission-record.schema.json` / `schema/mission-report.schema.json` |
| Plan / schema valid | `python scripts/validate_record.py <schema> <document>` | `plan.json` against `schema/mission-plan.schema.json`; the `schema/*.json` files are JSON-Schema documents validated by the same deterministic validator (`scripts/validate_record.py`, stdlib-only, no model call) |

Notes on accuracy (do not invent checks):
- `node --check` is the only JS-parse gate that exists; there is no `package.json`,
  no test runner, no linter in this repo. `executors/mission-executor.workflow.js`
  is an ES module without a `.mjs` extension or `"type":"module"`, so a bare
  `node --check` on it currently surfaces an `export`-token syntax error — closing
  that gate (and stripping the file's stray null byte) is the executor node's job,
  not a defect in the check itself.
- `scripts/validate_record.py` is both the run-record validator and the JSON-Schema
  validator; they are one tool with different inputs, not two tools. It implements
  the JSON-Schema subset the LMO schemas use (type/enum/const/required/properties/
  additionalProperties/items) and exits 0 on valid, 1 on violation.

### Deliverable zones (V2 floor)

Path globs that are outward-facing and therefore carry a categorical V2 floor (§2.2):
any node touching them closes at V2 or higher, never V0/V1 alone.

| Zone | Glob | Why |
|---|---|---|
| Policy core | `docs/agent-constitution.md` | governs every mission; changes are policy |
| Policy core | `docs/operating-card.md` | the worker-facing distillation of the constitution |
| Mechanism core | `executors/**` | the runtime that walks frozen plans; behavior-bearing |

### Precedence

**explicit user instruction > repo contract > this constitution.** The repo contract
may only **tighten** the constitution, never loosen it — any zone, floor, or check
here narrows discretion relative to the constitutional defaults; it cannot waive a
constitutional floor (e.g. the §2.2 V2 floors or the §9 perimeter remain in force
regardless of anything written above).
