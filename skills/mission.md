---
description: Run a governed multi-agent mission from a grilled goal to a verified, recoverable terminal result.
argument-hint: "<goal> [--unattended] | --resume <run-id>"
---

# Mission

$ARGUMENTS

Turn the goal into a verified terminal result through LOAD, GRILL, PLAN, FIGHT, FREEZE, RECOVER, EXECUTE, AUDIT, and DELIVER.

0. **LOAD.** Read `~/.claude/docs/agent-constitution.md` and the project's fieldnotes card when present. If `<repo>/.mission/contract.md` is absent, instantiate it from `~/.claude/docs/mission-contract-default.md` without asking. On every load, inspect tracked architecture, CI, build, test, dependency, deployment, and validation files. Record exact runnable checks, concrete critical paths, blind spots, boundaries, and resource facts only with a named basis; leave unsupported facts unknown and remove entries whose basis is stale. Do not restate constitutional authority or lifecycle procedure in the contract. Load the contract as the repository's factual operating map. Record the deployed runtime version plus SHA-256 digests of the loaded constitution, contract, and canonical executor in the `governance` field of `plan.json` so the final audit can detect regime drift.

For a new mission:

1. **GRILL.** Run `/grill-me` on the goal. Resolve scope, exclusions, definition of done, named acceptance criteria, consequential assumptions, and what would make the result good rather than merely complete. Explore the repository instead of asking questions the code can answer. Produce a short brief; do not proceed while PLAN would still need to guess.

2. **PLAN.** Baseline the relevant contract checks. Probe every external URL, API, registry, or fetchable dependency required by an acceptance criterion; replace an unreachable dependency with an explicit fallback or surface it before go.

   Build the smallest task graph that satisfies the brief and write `plan.json` conforming to `~/.claude/docs/mission-plan.schema.json`. Decompose by dependency and write ownership; give every node named acceptance criteria and a witness whose method can observe its claim. Use `reviewed` when a judgment-bearing or architectural claim needs a fresh artifact-only critic, `machine` for deterministic checks, `measured` for direct instrumentation, and `human-deferred` only for genuine human judgment. The schema is the sole representation contract; do not invent parallel metadata.

3. **FIGHT.** For a non-trivial plan, give the brief and plan to fresh critics with distinct feasibility, dependency, scope, and verification lenses. Scale the panel to the plan; a small obvious mission may skip it. Require evidence, adjudicate findings, revise valid blockers once, and do not loop toward consensus.

4. **FREEZE.** Create `agent/mission-<slug>` and `.mission/<run-id>/`. Validate the plan against the schema, then commit the brief, frozen plan, and initial journal before execution. In attended mode, show the frozen plan and wait for go; `--unattended` proceeds after freeze. Later replanning must obey the constitution's goal-integrity rule.

5. **RECOVER.** For `--unattended` or work likely to outlive the session, ask the user to arm one heartbeat before execution:

   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ~/.claude/scripts/mission_heartbeat.ps1 arm -RunDir <repo>/.mission/<run-id>`

   Keep one driver. After each mutating node closes, commit its coherent code, journal entry, and witness.

6. **EXECUTE.** Read the frozen plan as a parsed object and run `~/.claude/workflows/mission-executor.workflow.js` through the Workflow tool with `args: { plan: <parsed plan>, completed: {} }`. Do not substitute an improvised executor. The canonical executor independently closes `reviewed` witnesses, persists every audit, repairs a failed integrated audit at most twice without changing the frozen goal, and then terminalizes.

7. **AUDIT and DELIVER.** Treat the executor's latest persisted audit as canonical. Every terminal outcome writes `audit.json`, an immutable numbered audit, `result.json`, and `REPORT.md`. `REPORT.md` is a human report, not a success marker. Only `mission.success` means passed. A failed or `human_required` mission still reports, sends one idempotent configured terminal email, and disarms recovery. Verify the result and notification artifacts rather than recreating them in chat. Deliver only within the constitution's human-authority boundary.

For `--resume <run-id>`, load the frozen plan, numbered audits, latest `audit.json`, journal, branch commits, node and review evidence, result if present, and notification state. A valid `result.json` is terminal; report it and do not resume execution. Otherwise confirm the process identity in `mission.lock` is no longer live, then claim the run by recording the current `CLAUDE_PID`, process start time, and `CLAUDE_CODE_SESSION_ID`. Reconstruct completed nodes only from committed closure evidence and pass `args: { plan, completed }` to the canonical executor. Do not repeat GRILL or rewrite the brief. If the frozen plan is invalid, stop and name the premise requiring human reopening.
