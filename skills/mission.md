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
that matter, and resolve every branch that would otherwise become a 2am guess. This is the
last point a human is in the loop before autonomous flight, so the whole mission's quality is
bottlenecked here — it is load-bearing, and it gets a contract, not a vibe.

**The grill must output a brief** (the input to PLAN) that pins down:
- **Scope** — what is in, what is explicitly out.
- **Definition of done** — the success condition, in the human's words.
- **Named acceptance criteria** — concrete, citable conditions (these become the nodes'
  `acceptance_criteria` and the only things a blocker may cite, §3.3).
- **Resolved assumptions** — every branch you would otherwise guess at, with the human's call
  recorded.
- **Standards to learn** — if a fieldnotes human-diff corpus exists for this repo, pull the
  recurring acceptance criteria and critic prompts mined from it (evolution §"corpus") and
  confirm them here, so the grill front-loads what the human has historically changed.

Before freezing, **a critic checks the brief itself**: does it actually pin down "done," or
will PLAN have to guess? An under-specified brief is sent back to the grill, not forward to
PLAN — a vague grill is the cheapest place to fail and the most expensive place to skip.

### 2. PLAN
Draft a DAG conforming to `~/.claude/docs/mission-plan.schema.json`. For each node assign:
deps, `parallelizable`, `v_class` (round up under uncertainty; honor categorical V2 floors
§2.2), `ac_required` (true for all V2 / outward-facing / final-deliverable nodes — the
floors), `acceptance_criteria` (named, citable), caps (only if overriding defaults, with
reason), `compute_role_required`. Leave `check` as TBD — it binds at close time.

**Then classify the mission (§2.4).** From deterministic inputs only — `n` = node count,
`v_max` = highest v_class, `zone` = any node hits a deliverable zone, `outward` = any node
outward-facing/irreversible — assign `mission_class`:
- **M0 (errand):** `n ≤ 2` ∧ `v_max ≤ V1` ∧ ¬`zone` ∧ ¬`outward`.
- **M2 (campaign):** `v_max = V3` ∨ `outward` ∨ large `n` ∨ explicitly overnight/high-stakes.
- **M1 (standard):** everything else (the default).

Round **up** under uncertainty (§2.2 asymmetry); grant M0 only when its gate provably holds.
The class sizes the *ceremony* below (FIGHT / heartbeat / go-gate / AUDIT) — it never lowers a
V-class floor or skips a §3.1-mandated critic. Record `mission_class` and the four classifier
inputs in `plan.json`.

**Flag the cold-improver pass (§3.5).** For **M1**, set `improve_pass:true` on the riskiest 1–2
implementation nodes — a cold-improver→revision pass yields most on complex first-draft code.
**M2** defaults it on for all a-c implementation nodes (opt out with `improve_pass:false`); M0
never runs it. (The final-deliverable node is excluded — its panel + cold verifier already cover
it.)

**Also capture the classification features (§7, record-now-match-later).** Per node, note the
**path globs** it will touch, the **applicable verifier-registry entry** (or none — itself a
strong V2 signal), and the **v_class you first reached for *before* §2.2 round-up**. These feed
`classification_calibration` at DELIVER so a future matcher has signal. Recording is free and
automatic; the matcher that consumes it is deferred (evolution.md).

### 3. FIGHT
**M0 → skip FIGHT entirely** (a ≤2-node V0/V1 plan has no plan-level risk surface to attack;
go straight to FREEZE). Otherwise spawn a critic panel against the **plan** with diverse
lenses: feasibility, completeness, dependency-correctness, scope, **verification-adequacy**
(attack the v_class column for under-classification — including the M-class itself for
under-provisioning). Severity + triangulated adjudication per §3.3 — actor gets one rebuttal
per finding, you (orchestrator) rule. Blockers must cite. Do **not** loop to consensus.

**Round budget scales with class (§2.4):** M1 → 1 round, lenses scaled to plan size, and
**early-exit** if the round surfaces no blocker/major. M2 → up to 3 rounds, full lens panel.

### 4. FREEZE
Write `plan.json` to `<repo>/.mission/<run-id>/plan.json`. Compute and record `eta`. Commit
on an `agent/mission-<slug>` branch. **Go-gate scales with class (§2.4):** in **attended**
mode show the frozen plan and wait for go — **except M0, which proceeds on freeze** (an errand
does not earn a gate). In unattended/queued, proceed on freeze at every class.

**Arm the heartbeat (constitution §11) for M1/M2** — before execution, so a token-dead session
can still be resumed; write the marker `<repo>/.mission/<run-id>/mission.lock`. **M0 skips the
heartbeat** (a ≤2-node errand is cheaper to restart than to checkpoint).

> **Autonomy-gate note (perimeter-safe).** The executor dispatches via the Workflow tool,
> which carries its own harness permission prompt — this fires regardless of `mission_class`
> or `mode`, so an `--unattended` overnight run still stalls on it unless the human has
> pre-granted it in `settings.json`. Pre-granting is a **human settings action**, not an
> autonomous perimeter relaxation (§9.1); the mission must not weaken it. Surface it as a
> launch prerequisite for unattended runs, do not route around it.

### 5. EXECUTE
Dispatch the frozen plan to the executor adapter for this harness:
- **Claude Code:** run `~/.claude/workflows/mission-executor.workflow.js` via the Workflow
  tool, passing the **parsed plan.json object** as `args` — read the file and pass its
  *contents*, not the path (the Workflow sandbox has no filesystem access). Pass it as a real
  JSON value, not a hand-built string; the executor also parses a JSON string defensively, but
  the path will not work.
- **Codex:** use `~/.claude/docs/mission-executor.codex.md` (deferred — not yet
  daylight-tested).

The executor walks the DAG: fan out parallelizable ready nodes (worktree isolation for
concurrent file mutation), run the cold-improver→revision loop (§3.5) on a-c impl nodes,
critic-gate a-c nodes, climb the problem-solving ladder (§6.1),
subtree-replan on "plan assumption false". Honor caps (§6.2). Bind and record closure
records for V0/V1 (§2.1). Finalize on divergence, never on a clock (§6.3).

### 6. AUDIT → DELIVER
Whole-deliverable review against the plan's own acceptance criteria + constitution. **Depth
scales with class (§2.4):**
- **M0 →** no separate AUDIT agent; the node's own close-time check *is* the audit (re-running
  a single just-passed check from a fresh agent buys nothing). Go straight to DELIVER.
- **M1 →** **sample** the rechecks (judge-sample 2–3 recorded checks + 2–3 self-closures for
  sufficiency) rather than re-running every check.
- **M2 →** re-run **all** recorded checks; judge-sample 2–3 self-closures.

Punchlist items → new nodes → re-enter EXECUTE (capped: 2 cycles, then ledger).

Then **deliver**:
- Write `REPORT.md` + `report.json` to `.mission/<run-id>/` (format: constitution §12 —
  inverted pyramid, one screen, Needs-you items phrased as one-tap verdicts).
- Write the **run-record** to fieldnotes (`mission_records/`), schema-validated, authored
  by you — not synthesized. Include the human-diff slot (filled when the Human reviews).
  Populate `classification_calibration`: `mission_class` + per-node `features` and assigned
  classes. Leave the hindsight verdicts **null** — AUDIT fills any machine-check verdicts
  (`evidence_source:"machine_check"`), `/mission-accept` fills the human-diff verdicts. A critic
  opinion may write a verdict but **never** `may_lower:true` (§2.2 / schema).
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
