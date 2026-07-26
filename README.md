# long-mission-orchestrator

A compact runtime for turning a grilled goal into verified, recoverable work.

**Current version: 1.0.1**

The system scales absence, not certainty. It freezes a small task graph, delegates bounded nodes, requires evidence that observes each completion claim, commits recovery state as work closes, and leaves merge and waiver authority with the human.

## Active design

The mission sequence is:

1. **LOAD:** load the compact constitution and repository contract, creating a conservative default contract when one is absent.
2. **GRILL:** resolve consequential ambiguity and define done.
3. **PLAN:** build the smallest sufficient DAG and design claim-observing witnesses.
4. **FIGHT:** challenge non-trivial plans with fresh, evidence-bound critics.
5. **FREEZE:** validate and commit the brief, plan, and initial journal.
6. **RECOVER:** arm recovery for unattended or long-running work.
7. **EXECUTE:** walk dependencies, independently close reviewed witnesses, serialize mutations, and commit every closure.
8. **AUDIT:** inspect the integrated artifact with a fresh read-only pass, persist every verdict, and run at most two bounded repair cycles.
9. **DELIVER:** write terminal `result.json` and `REPORT.md`, email the configured report once, disarm recovery, and leave merge or waiver decisions to the human.

A witness is one of:

- `machine`: a deterministic check directly observes the claim;
- `measured`: instrumentation observes a property ordinary checks cannot see;
- `reviewed`: a fresh artifact-only critic independently closes a judgment-bearing claim;
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
| `executors/mission-executor.workflow.js` | DAG execution, reviewed closure, bounded audit repair, persistence, and terminalization |
| `docs/operating-card.md` | actor, critic, and auditor conduct |
| `docs/mission-contract-default.md` | conservative contract created when a target repository has none |
| `scripts/mission_heartbeat.ps1` | interrupted-run recovery and terminal disarm |
| `scripts/mission_notify.py` | run-scoped, concurrency-safe terminal email |
| `scripts/validate_terminal.py` | committed terminal-state consistency gate |
| `schema/mission-audit.schema.json` | persisted canonical audit and repair count |
| `schema/mission-repair.schema.json` | in-flight repair checkpoint shape |
| `schema/mission-result.schema.json` | terminal result shape |
| `.mission/contract.md` | repository-specific checks, critical paths, boundaries, and resources |

The constitution is normative and cross-repository. A mission contract is descriptive and repository-specific: executable checks, concrete risk surfaces, observation gaps, environment constraints, and available resources. It does not repeat constitutional authority or lifecycle procedure.

The mission contract has a fixed location and is loaded only by mission tooling. It does not occupy the repository's automatically loaded `CLAUDE.md` context.

The previous V/R/M runtime is preserved under `legacy/0.5.1/`, with its constitution also at `docs/archive/agent-constitution-v0.5.1.md`. Its classification ladders, review tiers, evolution telemetry, run-record schemas, Codex adapter draft, and inbound mailbox router are not part of the active runtime. The active channel is outbound-only terminal reporting.

## Repository layout

```text
long-mission-orchestrator/
|-- VERSION
|-- CLAUDE.md
|-- .mission/contract.md
|-- docs/
|   |-- agent-constitution.md
|   |-- operating-card.md
|   |-- mission-contract-default.md
|   `-- archive/agent-constitution-v0.5.1.md
|-- skills/
|   |-- mission.md
|   |-- mission-loop.md
|   `-- mission-log-audit.md
|-- schema/
|   |-- mission-plan.schema.json
|   |-- mission-audit.schema.json
|   |-- mission-repair.schema.json
|   `-- mission-result.schema.json
|-- channel/lmo.json
|-- executors/mission-executor.workflow.js
`-- scripts/
    |-- mission_heartbeat.ps1
    |-- mission_notify.py
    |-- validate_terminal.py
    |-- run_hidden.vbs
    |-- validate_record.py
    `-- deploy.ps1
```

## Deploy

This repository is the source of truth. `~/.claude` contains deployed copies only. The active unattended-recovery runtime is Windows-specific because its heartbeat uses Task Scheduler and Windows PowerShell 5.1.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

Deployment installs the version marker, active constitution, operating card, default contract, plan/audit/result schemas, three commands, workflow executor, heartbeat, terminal notifier, outbound LMO channel identity, hidden-task helper, and validator. The default is deployed globally as a source template; each target repository owns the instantiated `.mission/contract.md`. Deployment removes files from the retired V/R/M, evolution, record, and inbound mailbox systems.

## Verify

```powershell
node --check executors/mission-executor.workflow.js
python -m unittest discover -s tests -v
python scripts/validate_record.py schema/mission-plan.schema.json <plan.json>
powershell.exe -NoProfile -Command '$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/mission_heartbeat.ps1"), [ref]$null, [ref]$errors) > $null; if ($errors.Count) { $errors; exit 1 }'
```

These checks establish syntax and schema conformance. Representative mission execution remains the behavioral witness for DAG walking, committed recovery, and final audit behavior.
