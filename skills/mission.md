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
deps, `parallelizable` + `write_set` (the blast radius — globs/namespaces/section-ids it
mutates; `[]` = read-only, fans out freely; §6.5), `v_class` (round up under uncertainty; honor categorical V2 floors
§2.2) **+ `v_class_rationale` on every boundary call** (one line, captured now — it becomes the
decision-ledger row the Human calibrates against at DELIVER; a §2.2 round-up or a near-V1 V2
without a rationale is a ledger hole), `ac_required` (true for all V2 / outward-facing / final-deliverable nodes — the
floors), `review_tier` + `review_rationale` (R0–R3 per §3.1 — the V→R floor table binds:
V0/V1-closed nodes may take R0, V2 nodes take ≥R2, final deliverable R3; above the floor
choose freely, one line of rationale each; an all-one-tier plan must justify the uniformity
in the brief), `acceptance_criteria` (named, citable), caps (only if overriding defaults,
with reason), `compute_role_required`. Leave `check` as TBD — it binds at close time.
Optionally set `model_tier` + `model_rationale` (§3.6 — model intelligence tracks stake of
judgement): leave it absent and the executor uses the role floor (gates Opus; V0/V1 actors
Sonnet); raise toward Opus where a V0/V1 node's judgement is subtler than its check; drop a
V0/V1 actor to Haiku **only** with a rationale asserting pure transport (extract/reformat/
down-sample). When the call is blurry, leave it absent and let the floor round you up.

**Propose the mission budget (§6.4).** For M1/M2, set mission-level `token_budget`
(executor-observable output tokens) and `agent_budget` (total spawns) — start from class
defaults (M1: 200K/12; M2: 800K/40) adjusted for plan size, and record the reasoning in one
line. These freeze with the plan, surface at the go-gate, and exhaustion finalizes the
mission as `DIVERGED(budget)` (§6.3) — they are proxies the run-record calibrates over time,
not quality levers: a budget narrows scope, it never skips a gate.

**Then classify the mission (§2.4) — by the deterministic classifier, NOT by reasoning.** Write
the drafted DAG to a `plan.json` and run
`node ~/.claude/scripts/classify-mission.js <plan.json> --write`. The script computes the binding
class **floor** from deterministic facts (`n` = node count, `v_max` = highest v_class, `zone` =
any node's `write_set` hits a deliverable zone) and writes `mission_class`. M0 is granted only
when its crisp gate provably holds in code — the LLM never self-labels its way into skipping the
go-gate. The gate the script enforces:
- **M0 (errand):** `n ≤ 2` ∧ `v_max ≤ V1` ∧ ¬`zone` ∧ ¬`outward`.
- **M2 (campaign):** `v_max = V3` ∨ `outward` ∨ large `n` ∨ explicitly overnight/high-stakes.
- **M1 (standard):** everything else (the default).

You may **raise** the script's result to M2 on documented high-stakes judgment (§2.2 round-up),
**never lower it** — the floor is binding and the executor re-derives it as a backstop. The class
sizes the *ceremony* below (FIGHT / heartbeat / go-gate / AUDIT) — it never lowers a V-class floor
or skips a §3.1-mandated critic. Record `mission_class` and the four classifier inputs in
`plan.json`.

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

**Provision each critic frugally (§6.4 cost) — FIGHT critics are spawned by you, the
orchestrator, so the operating-card discipline the executor applies does NOT reach them
automatically; apply it here by hand.** Hand each critic the **operating card**
(`~/.claude/docs/operating-card.md`), *not* the 36 KB constitution. Pin the artifacts to read —
`plan.json` + `brief.md` only — and **bound repo exploration to a spot-check budget**: read only
the specific paths a node's `write_set`/instruction names, read-only, to test a *specific*
premise; trust declared paths unless a concrete claim needs checking. Do **not** instruct a
critic to "explore the repo" open-endedly. A fan-out of N critics each free-crawling a large
repo and re-reading full governance is the dominant FIGHT-phase cost (the natalie-fable-revision
run: every round-2 critic re-read the full constitution + 36 KB plan + 12 KB brief + crawled the
worktree, and the mission fought twice — a multi-million-token bill before EXECUTE even began).

**Round budget scales with class (§2.4):** M1 → 1 round, lenses scaled to plan size, and
**early-exit** if the round surfaces no blocker/major. M2 → up to 3 rounds, full lens panel.

**External-resource preflight (§6 PLAN, before FREEZE):** for every acceptance criterion that
names a fetchable external resource (URL, API, registry page), probe reachability now —
deterministic fetch, no model judgment. Unreachable → re-word the AC with a designated fallback
source or carry it to Needs-you; never freeze an AC the executor provably cannot meet (the
jobe-submit-audit run froze a "LIVE GfA" AC against a page that 403'd to agents).

### 4. FREEZE
Write `plan.json` to `<repo>/.mission/<run-id>/plan.json`. Compute and record `eta`. Commit
on an `agent/mission-<slug>` branch. **Go-gate scales with class (§2.4):** in **attended**
mode show the frozen plan and wait for go — **except M0, which proceeds on freeze** (an errand
does not earn a gate). In unattended/queued, proceed on freeze at every class.

**The go-gate display includes the cost contract:** the `token_budget` / `agent_budget` pair,
the **R-tier histogram** (how many nodes at R0/R1/R2/R3, with the floor-driven minimums
marked), and the **model histogram** (actor tiers Haiku/Sonnet/Opus, gates always Opus; §3.6) —
an all-R0 cheap-out, an all-R3 gold-plate, or a Haiku creeping onto a generative node should
each be one glance to catch before go.

**Arm the heartbeat (constitution §11) for M1/M2** — as soon as `.mission/<run-id>/` exists
at PLAN, **not** here at freeze: §11 requires arming at launch, because a session that dies
grilling or fighting cannot schedule its own resurrection (the natalie-fable-revision run died
exactly there — usage limit mid-PLAN, no heartbeat armed, recovery was manual). Arm with:

```
powershell -NoProfile -ExecutionPolicy Bypass -File ~/.claude/scripts/mission_heartbeat.ps1 arm -RunDir <repo>/.mission/<run-id>
```

This writes the `mission.lock` marker and registers `LMO\Heartbeat-<run-id>` (every 30 min;
each beat is idempotent per §11: active → exit, dead → headless resume from committed state,
complete/absent → self-disarm). **M0 skips the heartbeat** (a ≤2-node errand is cheaper to
restart than to checkpoint).

> **Autonomy-gate note (perimeter-safe).** The executor dispatches via the Workflow tool,
> which carries its own harness permission prompt. In a **live session** the human answers it
> at dispatch — no standing grant needed. For **heartbeat-resumed** sessions (§11), the
> heartbeat's `claude` command carries a **per-invocation** `--allowedTools "Workflow"` grant,
> scoped to that single headless invocation and authorized by the human at launch (arming the
> heartbeat is part of the launch they approve). No `settings.json` pre-grant; the mission
> must never widen the grant itself (§9.1).

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
review-gate each node at its frozen **R-tier** (§3.1 — R0 two-phase self-audit, R1 spec-blind
diff, R2 cold-eye + spot-check, R3 panel), climb the problem-solving ladder (§6.1),
subtree-replan on "plan assumption false". Honor caps (§6.2) and the **mission budget**
(§6.4): every spawn shares the canonical context pack (byte-identical prefix → cache hits),
evidence is pushed to reviewers rather than re-explored, and exhausting `token_budget` or
`agent_budget` finalizes as `DIVERGED(budget)` — no new nodes, in-flight nodes close, never a
mid-node kill. Bind and record closure records for V0/V1 (§2.1). Finalize on divergence,
never on a clock (§6.3).

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
  inverted pyramid, one screen, Needs-you items phrased as one-tap verdicts; `report.json`
  per `~/.claude/docs/mission-report.schema.json` — `needs_you[].ask`, not `item`).
  **Compose for the reader (§12):**
  - **Plain layer leads** — what happened and what needs the Human, in sentences with zero
    V/R/M vocabulary (translate in place where shorthand must appear). The evidence ledger
    follows below a `---` divider. Layered, never cut.
  - **Decision ledger** — the contested/boundary role decisions only, one line each
    (*role → decision → against what → because*, from `v_class_rationale` /
    `review_rationale` / critic findings): boundary classifications, critic rejections +
    accepted-majors, escapes, tier floor-ups, budget crossings. Compress the rest to a
    visible suppressed-count line ("11 suppressed: 9 uncontested passes, …"). **Every 5th
    mission** (count from fieldnotes `mission_records/`) ship the ledger unfiltered so the
    filter itself gets audited. Mirror into `report.json` (`plain_summary`,
    `decision_ledger`, `decisions_suppressed`).
- Write the **run-record** to fieldnotes (`mission_records/`), record schema **v0.3**, authored
  by you — not synthesized. Include the human-diff slot (filled when the Human reviews).
  Populate `classification_calibration`: `mission_class` + per-node `features` and assigned
  classes. Leave the hindsight verdicts **null** — AUDIT fills any machine-check verdicts
  (`evidence_source:"machine_check"`), `/mission-log-audit` fills the human-diff verdicts. A critic
  opinion may write a verdict but **never** `may_lower:true` (§2.2 / schema).
- Record **budget planned-vs-actual** (token + agent counts from the executor's return), the
  **compute-tier histogram** (`compute_tiers` from the executor's return), and **per-node
  R-tier escape outcomes** (did AUDIT/punchlist catch a defect the node's review tier missed?)
  in the run-record — this is the telemetry that calibrates class budget defaults, the V→R floor
  table, and the §3.6 model floors (a cheap tier that leaks defects past its gate tightens) (§7).
- Append cap stats to `mission-caps.jsonl` (fieldnotes).
- **Validate before sending (hard step, §12):** run
  `python ~/.claude/scripts/validate_record.py ~/.claude/docs/mission-record.schema.json <record>`
  and the same against `mission-report.schema.json` for `report.json` — exit 0 or fix the
  document before the report goes out. **This step is unconditional**: a re-scoped, lean-pivoted,
  or human-interrupted mission still writes and validates its record (two of the first four
  v0.3.1 runs skipped the record entirely and their human verdicts had nowhere to land).
- **Push** the verdict line (notification). **Email** REPORT.md via the deployed §12 channel:
  `python ~/.claude/scripts/mission_mailbox.py report <run-id>` (mints a reply-id so the Human's
  reply threads back and is routed by `LMO\MailboxPoll` into the run-record).
- **Disarm the heartbeat**: `powershell -NoProfile -ExecutionPolicy Bypass -File
  ~/.claude/scripts/mission_heartbeat.ps1 disarm -RunDir <repo>/.mission/<run-id>`; leave
  `.mission/<run-id>/` for review (archived on branch merge).

## Hard rules (perimeter — never violate)

- Additive only: commit/push `agent/*`, draft PRs. **Never** merge, force-push, rebase
  published branches, tag/release, or communicate outward beyond the report.
- **the Human merges. The Human waives blockers.** Both human-only, always.
- A V0/V1 node with no closure record **downgrades to V2** — no self-report closes work.
- Never block waiting on a human; deliver best-within-caps + defect ledger (§5).

$ARGUMENTS
