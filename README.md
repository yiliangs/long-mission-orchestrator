# long-mission-orchestrator

A compact runtime for turning a grilled goal into verified, recoverable work.

**Current version: 1.0.0**

The system scales absence, not certainty. It freezes a small task graph, delegates bounded nodes, requires evidence that observes each completion claim, commits recovery state as work closes, and leaves merge and waiver authority with the human.

## Active design

The mission sequence is:

1. **LOAD:** load the compact constitution and repository contract.
2. **GRILL:** resolve consequential ambiguity and define done.
3. **PLAN:** build the smallest sufficient DAG and design claim-observing witnesses.
4. **FIGHT:** challenge non-trivial plans with fresh, evidence-bound critics.
5. **FREEZE:** validate and commit the brief, plan, and initial journal.
6. **RECOVER:** arm recovery for unattended or long-running work.
7. **EXECUTE:** walk dependencies, parallelize read-only nodes, serialize mutations, and commit every closure, batching read-only recovery checkpoints.
8. **AUDIT:** inspect the integrated artifact with a fresh read-only pass.
9. **DELIVER:** write `REPORT.md` and leave merge or waiver decisions to the human.

A witness is one of:

- `machine`: a deterministic check directly observes the claim;
- `measured`: instrumentation observes a property ordinary checks cannot see;
- `human-deferred`: the plan explicitly leaves the property open for human judgment.

A green check proves only what it can observe. Compilation does not prove live behavior, rendered geometry, timing, thread safety, or external integration.

## Authority and ownership

`docs/agent-constitution.md` contains only cross-cutting invariants. Mechanics live in one owning surface:

| Surface | Owns |
|---|---|
| `skills/mission.md` | mission lifecycle |
| `skills/mission-loop.md` | breadth, depth, and mania exploration cycles |
| `skills/mission-log-audit.md` | unresolved decisions and recovery queue |
| `schema/mission-plan.schema.json` | frozen plan representation |
| `executors/mission-executor.workflow.js` | DAG execution and the canonical integrated audit |
| `docs/operating-card.md` | actor and auditor conduct |
| `scripts/mission_heartbeat.ps1` | interrupted-run recovery |
| `.mission/contract.md` | repository-specific checks, critical paths, boundaries, and resources |

The mission contract has a fixed location and is loaded only by mission tooling. It does not occupy the repository's automatically loaded `CLAUDE.md` context.

The previous V/R/M runtime is preserved under `legacy/0.5.1/`, with its constitution also at `docs/archive/agent-constitution-v0.5.1.md`. Its classification ladders, review tiers, evolution telemetry, run-record schemas, Codex adapter draft, and mailbox channel are not part of the active runtime.

## Repository layout

```text
long-mission-orchestrator/
|-- VERSION
|-- CLAUDE.md
|-- .mission/contract.md
|-- docs/
|   |-- agent-constitution.md
|   |-- operating-card.md
|   `-- archive/agent-constitution-v0.5.1.md
|-- skills/
|   |-- mission.md
|   |-- mission-loop.md
|   `-- mission-log-audit.md
|-- schema/mission-plan.schema.json
|-- executors/mission-executor.workflow.js
`-- scripts/
    |-- mission_heartbeat.ps1
    |-- run_hidden.vbs
    |-- validate_record.py
    `-- deploy.ps1
```

## Deploy

This repository is the source of truth. `~/.claude` contains deployed copies only. The active unattended-recovery runtime is Windows-specific because its heartbeat uses Task Scheduler and Windows PowerShell 5.1.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

Deployment installs the version marker, active constitution, operating card, plan schema, three commands, workflow executor, heartbeat, hidden-task helper, and validator. Repository contracts are never deployed globally; each target repository owns `.mission/contract.md`. Deployment removes files from the retired V/R/M, evolution, record, and mailbox systems.

## Verify

```powershell
node --check executors/mission-executor.workflow.js
python scripts/validate_record.py schema/mission-plan.schema.json <plan.json>
powershell.exe -NoProfile -Command '$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/mission_heartbeat.ps1"), [ref]$null, [ref]$errors) > $null; if ($errors.Count) { $errors; exit 1 }'
```

These checks establish syntax and schema conformance. Representative mission execution remains the behavioral witness for DAG walking, committed recovery, and final audit behavior.
