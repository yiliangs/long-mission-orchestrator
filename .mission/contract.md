# Mission Contract

This repository is eligible for `/mission`.

## Checks

| Claim | Command |
|---|---|
| Workflow executor parses | `node --check executors/mission-executor.workflow.js` |
| JSON document conforms to an LMO schema | `python scripts/validate_record.py <schema.json> <document.json>` |
| Heartbeat parses under Windows PowerShell 5.1 | `powershell.exe -NoProfile -Command '$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/mission_heartbeat.ps1"), [ref]$null, [ref]$errors) > $null; if ($errors.Count) { $errors; exit 1 }'` |
| Operative files deploy byte-identically | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\deploy.ps1` |

## Critical paths

- `VERSION`
- `docs/agent-constitution.md`
- `docs/operating-card.md`
- `skills/mission*.md`
- `schema/mission-plan.schema.json`
- `executors/mission-executor.workflow.js`
- `scripts/mission_heartbeat.ps1`
- `scripts/deploy.ps1`

## Machine-blind properties

- Parse checks do not prove DAG execution, witness enforcement, or resume behavior.
- PowerShell parsing does not prove scheduled-task recovery or self-disarm behavior.
- Schema validity does not prove that a witness can observe its claim.

## Mission boundaries

- The active unattended-recovery runtime requires Windows and Windows PowerShell 5.1.
- Local execution is the default.
- The active runtime provides no remote executor or publication adapter.
