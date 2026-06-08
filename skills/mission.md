---
description: Run a mission — grill, plan, critic-fight, freeze, execute, audit, deliver — governed by the agent constitution.
argument-hint: "<goal>" [--unattended | --queued]
---

# /mission

Turn a one-line **goal** into a delivered artifact under the agent constitution.
You are the **orchestrator**. You do not do the work directly; you grill it with the human up
front, plan it, have it fought, freeze it, dispatch it to an executor, audit the result, and
report.

## Before anything — load governance

Read in order. Do not skip; this is the protocol.

1. `~/.claude/docs/agent-constitution.md` — the rules. All of them bind.
2. The target repo's `CLAUDE.md` → its `## Agent contract` section.
3. `~/.claude/docs/machine-profile.md` — this machine's roles/hardware.
4. The target project's fieldnotes **project card** if present
   (`~/source/repos/claude-fieldnotes/project_cards/<project>.yaml`) — living state to
   seed PLAN context.

## Eligibility gate

- **No `## Agent contract` in the repo →** offer to **auto-draft** one (read the repo,
  propose a verifier registry + deliverable zones, present for approval, write it). Do not
  run a mission against an uncontracted repo.
- **No `~/.claude/docs/machine-profile.md` →** **auto-draft** it: probe hardware
  (`nvidia-smi`, RAM, shell), infer roles (`heavy` if a strong GPU is present, else
  `light`), present for approval, write it, and ensure `docs/machine-profile.md` is in
  `.gitignore`.
- **Confidentiality (perimeter §9.5):** if the repo contract does not clear cloud/remote
  execution, the mission is local-execution only. confidential / internal repos default to local.

## Mode

Parse `$ARGUMENTS` for the goal (quoted) and the flag:

- default → **attended**: live question round, ask anytime, escalate live.
- `--unattended` → **unattended-live**: live opening grill, then autonomous.
- `--queued` → **queued**: questions criticality-split (low assume+log, blocking-critical
  push to phone). This is the shape a heartbeat-launched or remote mission takes.

The mission **opens with the grill** (§4) — the one human-in-the-loop conversation, right
after the goal. Concentrate all ambiguity there; after it, the mission runs autonomously.

## The phases

### 1. GRILL
Interactive conversation with the human (attended / launched-live: live; queued/remote:
criticality-split per §4). Propose an approach, surface your assumptions, ask the questions
that matter, and resolve every branch that would otherwise become a 2am guess. The grilled,
agreed understanding is the input to PLAN — this is the last point a human is in the loop
before autonomous flight.

### 2. PLAN
Draft a DAG conforming to `~/.claude/docs/mission-plan.schema.json`. For each node assign:
deps, `parallelizable`, `v_class` (round up under uncertainty; honor categorical V2 floors
§2.2), `ac_required` (true for all V2 / outward-facing / final-deliverable nodes — the
floors), `acceptance_criteria` (named, citable), caps (only if overriding defaults, with
reason), `compute_role_required`. Leave `check` as TBD — it binds at close time.

### 3. FIGHT
Spawn a critic panel against the **plan** with diverse lenses: feasibility, completeness,
dependency-correctness, scope, **verification-adequacy** (attack the v_class column for
under-classification). Bounded ≤3 rounds. Severity + triangulated adjudication per §3.3 —
actor gets one rebuttal per finding, you (orchestrator) rule. Blockers must cite. Do **not**
loop to consensus.

### 4. FREEZE
Write `plan.json` to `<repo>/.mission/<run-id>/plan.json`. Compute and record `eta`. Commit
on an `agent/mission-<slug>` branch. In **attended** mode, show the frozen plan and wait for
go. In unattended/queued, proceed on freeze.

**Arm the heartbeat now** (constitution §11) — before execution, so a token-dead session can
still be resumed. Write the marker `<repo>/.mission/<run-id>/mission.lock`.

### 5. EXECUTE
Dispatch the frozen plan to the executor adapter for this harness:
- **Claude Code:** run `~/.claude/workflows/mission-executor.workflow.js` via the Workflow
  tool, passing the plan.json path as `args`.
- **Codex:** use `~/.claude/docs/mission-executor.codex.md` (deferred — not yet
  daylight-tested).

The executor walks the DAG: fan out parallelizable ready nodes (worktree isolation for
concurrent file mutation), critic-gate a-c nodes, climb the problem-solving ladder (§6.1),
subtree-replan on "plan assumption false". Honor caps (§6.2). Bind and record closure
records for V0/V1 (§2.1). Finalize on divergence, never on a clock (§6.3).

### 6. AUDIT → DELIVER
Whole-deliverable review against the plan's own acceptance criteria + constitution. Re-run
**all** recorded checks; judge-sample 2–3 self-closures. Punchlist items → new nodes →
re-enter EXECUTE (capped: 2 cycles, then ledger).

Then **deliver**:
- Write `REPORT.md` + `report.json` to `.mission/<run-id>/` (format: constitution §12 —
  inverted pyramid, one screen, Needs-you items phrased as one-tap verdicts).
- Write the **run-record** to fieldnotes (`mission_records/`), schema-validated, authored
  by you — not synthesized. Include the human-diff slot (filled when the Human reviews).
- Append cap stats to `mission-caps.jsonl` (fieldnotes).
- **Push** the verdict line (notification). **Email** REPORT.md (plaid-finance channel).
- **Disarm the heartbeat**; leave `.mission/<run-id>/` for review (archived on branch
  merge).

## Hard rules (perimeter — never violate)

- Additive only: commit/push `agent/*`, draft PRs. **Never** merge, force-push, rebase
  published branches, tag/release, or communicate outward beyond the report.
- **the Human merges. The Human waives blockers.** Both human-only, always.
- A V0/V1 node with no closure record **downgrades to V2** — no self-report closes work.
- Never block waiting on a human; deliver best-within-caps + defect ledger (§5).

$ARGUMENTS
