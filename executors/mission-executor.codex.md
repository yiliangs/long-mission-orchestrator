# Mission executor — Codex adapter (STUB, deferred)

**Status:** specified, NOT yet daylight-tested. The Workflow adapter
(`~/.claude/workflows/mission-executor.workflow.js`) is the proven substrate; this binding
gets its own daylight test when the Human first drives a Codex session (constitution §10).

This adapter walks the **same** harness-neutral `plan.json` (see
`~/.claude/docs/mission-plan.schema.json`). It contains no policy — policy is in
`agent-constitution.md`. Only the *mechanics of walking the DAG* differ from the Workflow
adapter.

## Contract with the spec (must match the Workflow adapter's behavior)

| Concern | Requirement |
|---|---|
| **Input** | The frozen `plan.json` at `<repo>/.mission/<run-id>/plan.json`. Codex has filesystem access, so it reads the path directly (unlike the Workflow sandbox, which receives the parsed object via `args`). |
| **DAG walk** | Wave-based ready-set: a node is ready when all `deps` are complete. Fan out `parallelizable` ready nodes; run the rest sequentially. |
| **Fan-out isolation** | A node fans out only when concurrency is safe (§6.5 blast radius): read-only nodes (`write_set:[]`) freely; mutating nodes only as a write-set-DISJOINT subset under worktree isolation, merged conflict-free by construction. Absent `write_set` ⇒ serial. |
| **Actor** | One agent per node. Returns the same actor result shape: `{outcome, artifact_summary, closure_record?, replan_reason?}`. |
| **Close-time binding (§2.1)** | V0/V1 node ⇒ executor selects + runs a concrete check (prefer the repo contract's verifier registry vocabulary), records `{check_command, exit_status, output_digest, timestamp}`. No valid passing record ⇒ downgrade to V2 + spawn critic. |
| **Problem-solving ladder (§6.1)** | micro-loop (retry, cap 3) → structured sub-loop (fresh agent per iteration) → subtree replan. Same caps as §6.2 unless `node.caps` overrides. |
| **Actor-critic (§3)** | a-c-required nodes ⇒ fresh-context, artifact-only, refute-framed critic. Findings `{severity, claim, evidence, cited_criterion}`. Adjudicate: uncited blocker ⇒ invalid/demote to major. Blocker ⇒ human-only. Major ⇒ accept-with-reason or fix. 3-lens panel for the final deliverable. |
| **Mission class (§2.4)** | Read `plan.mission_class`. It scales **AUDIT** here: `M0` ⇒ no separate audit agent (deterministic verdict from node state); `M1` ⇒ sample the rechecks; `M2` ⇒ re-run all. FIGHT/heartbeat/go-gate scaling is the orchestrator's, not the executor's. Never let class lower a V-class floor or skip a §3.1 critic. |
| **Operating card (§6.4)** | Hand spawned workers the distilled `~/.claude/docs/operating-card.md`, not the full constitution — fresh context is re-derived *state*, not re-read *governance*. Full constitution is the orchestrator's. |
| **Cold-improver loop (§3.5)** | On a-c implementation nodes (NOT the final deliverable), scoped by `mission_class` + `node.improve_pass`: run a cold-improver on the first draft → actor revises with its own judgment → adopt only a clean revision (never regress). Quality lever, logged `[model]`; never closes a gate. |
| **Resume** | **Node-granular** from committed state. On restart, skip nodes already marked complete in `.mission/<run-id>/` (Codex has no Workflow journal; the DAG *is* the journal at node granularity). |
| **Finalization (§6.3)** | Kill on divergence (remaining work not shrinking), never on a clock. |
| **Output** | Same result object the Workflow adapter returns: `{run_id, verdict, unresolved_blockers, accepted_majors, replans, punchlist, ledger, node_results}` — consumed by AUDIT/DELIVER in `/mission`. |

## Implementation note

Codex's own orchestration (its hooks / scheduled tasks / sub-agent spawning) plays the role
the Workflow tool's `agent()`/`parallel()`/`pipeline()` play here. Whatever the mechanism,
the observable behavior above is the contract. If a behavior cannot be matched on Codex, that
is a finding to surface in the first Codex daylight test — do not silently diverge from the
spec.
