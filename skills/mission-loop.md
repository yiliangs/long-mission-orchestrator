---
description: Run an open-ended exploration loop — a chain of governed mission-cycles over a living artifact, steered asynchronously by the Human, that diverges (breadth), converges (depth), or both (mania) without a fixed definition-of-done.
argument-hint: "<core concept>" [--breadth | --depth | --mania [--feral]] [--slug <slug>] [--cycles N] [--budget TOKENS] [--unattended] | --resume <loop-id>
---

# /mission-loop

The open-ended sibling of `/mission`. Where `/mission` turns a goal into one delivered
artifact and stops, `/mission-loop` keeps a **living artifact** improving — exploring a design
space wide, refining a champion deep, or both — and **never terminates on a definition-of-done**.
It terminates on a budget ceiling, a contact leash, or the Human saying stop.

The mechanism is not one immortal mission. It is an **outer driver that chains bounded
mission-cycles**: every cycle is a complete `/mission` (it freezes its own small plan, executes
under the constitution, audits, commits, records), so every governance invariant holds *per
cycle*. What persists *across* cycles is the artifact lineage, stored in **git** — branch per
milestone / variation, committed all the way, never merged. You are the **orchestrator and the
supervisor of diversity**; the Human is the **sole merge authority and the only steering input**.

## Before anything — load governance

Identical to `/mission` (this command inherits the whole constitution; it only changes the
*outer loop* and the *grill*, never a floor or the perimeter). Read in order:

1. `~/.claude/docs/agent-constitution.md` — all of it binds, unchanged.
2. The target repo's `CLAUDE.md` → its `## Agent contract`.
3. `~/.claude/docs/machine-profile.md` — this machine's roles/hardware.
4. The target project's fieldnotes **project card** if present.

## Eligibility gate

Same as `/mission` (uncontracted repo → offer to auto-draft a contract; no machine-profile →
auto-draft; confidential repos default to local execution per perimeter §9.5). **Additionally:**
the loop only runs in a **git repo with a clean-ish working tree** — branch-per-cycle is the
lineage store; a loop cannot run where it cannot commit.

## What the perimeter forbids (unchanged, restated because the loop is autonomous longer)

- Additive only: commit/push `agent/loop-*` branches, draft PRs. **Never** merge, force-push,
  rebase published branches, tag/release, or communicate outward beyond the report channel.
- **The Human merges. The Human waives blockers. The Human steers.** All human-only, always.
- The loop produces an ever-better **draft**, never a published thing. Drift is recoverable
  (`git reset` a branch); it is never destructive.
- **The budget ceiling is never waived** — not by `--feral`, not by `--unattended`. It is the
  intended floor that keeps "let it explore" from becoming an open tab. (Honesty caveat: at the
  *loop* level it is orchestrator-enforced today, not yet a runtime gate — see Stop conditions.)

## Mode

Parse `$ARGUMENTS` for the core concept (quoted) and flags:

- `--breadth` → **diverge**: fan out distinct variations around the fixed core. Gallery of
  siblings; keep-all-distinct. Risk guarded: redundancy + clustering.
- `--depth` → **converge**: refine one champion down a lineage. Hill-climb; keep-best. Risk
  guarded: drift.
- `--mania` → **both**, as beam search: fan → prune to a beam → descend → re-fan. The
  indulgent mode; opt-in, "not very often." `--feral` (mania-exclusive, double-opt-in) subtracts
  **exactly two things** — the beam and the contact-staleness leash; it does **not** touch the
  budget ceiling or any per-cycle `/mission` governance. A deliberate "show me where it goes."
  **Feral-terminator note:** removing the beam and the leash, with novelty-saturation only *soft*
  (surface-and-wait, not a hard stop), leaves feral mania with **only two live terminators — the
  budget ceiling and a Human stop.** That collapse is the whole reason feral is double-opt-in; it
  is intended, not an oversight, but it means the budget ceiling (orchestrator-counted, see Stop
  conditions) is doing nearly all the bounding.
- (no mode flag) → ask in the grill; do not default silently.
- `--unattended` → proceed-on-silence with no live opener beyond the grill (queued posture).
- `--cycles N` / `--budget TOKENS` → set the frozen ceilings (`max_cycles` / `budget_ceiling`) to
  a chosen number — this picks the number, it does **not** remove the gate; the ceiling still
  binds (see Stop conditions).
- `--resume <loop-id>` → resume a paused/dead loop from committed branches (see Resume).

## Phase 0 — THE META-GRILL (the one synchronous conversation)

This is the load-bearing difference from `/mission`. The grill is **constitutional, not
specificational** — it does not pin every spec detail (the whole point is to let the agent
explore freely). It pins the **charter**: the five things that make free exploration *safe and
legible*, frozen like a plan and never re-opened mid-loop.

The charter (the grill's required output, written to `.mission/loop-<slug>/charter.md`):

1. **First principles** — the design schema every output must honor. The values, not the steps.
2. **Boundaries** — what is *never* touched. **This is the load-bearing output.** Because you
   have removed the per-cycle human spec-check, the boundary list *is* the safety catch, up
   front. In a normal mission the Human vetoes a bad move at delivery; here the boundaries do
   that veto in advance. Spend the grill's rigor here.
3. **Preferred direction** — the gradient, not the destination. Where "better" points.
4. **Mode** — breadth / depth / mania (confirm or elicit if no flag).
5. **Spanning axes** — the dimensions the exploration should cover (breadth/mania). Often the
   Human *does not know these yet* ("I have an idea, I don't know how to design it beautifully")
   — that is fine: leave them to be **induced and confirmed** from the first batch (see §
   spectrum map). Declare them only when the Human already has them.

**A critic checks the charter before freeze** (as `/mission` critiques the brief), but the
question shifts: not "is this specific enough" but **"are the boundaries tight enough to make
unsupervised exploration safe?"** A vague boundary is a variation the Human did not want — or,
in unsupervised depth, a where-would-it-go with no fence. An under-bounded charter goes back to
the grill, not forward to cycle 1.

**Freeze the loop identity and the ceilings here.** The loop's id is its run-dir leaf
`loop-<slug>` — that exact string is the single identifier `--resume`, the `report` channel, and
the heartbeat `-RunDir` all take; `<loop-id>` everywhere in this command means precisely that
string (there is no second, bare-slug form). `<slug>` is slugified from the core concept (or an
explicit `--slug`), minted once here and frozen for the loop's life. Freeze the ceilings (Stop conditions, below):
`budget_ceiling`, `max_cycles`, `contact_leash_k`, recorded in `charter.md`. They bind for the
whole loop.

## Phase 1..N — THE CYCLE

Each cycle is a **full `/mission`** with two changes: the grill is replaced by automated
brief-synthesis, and the deliverable is committed to the lineage instead of delivered-and-done.

1. **Read the Human's reply** — the loop's only steering input. The driving session (live, or
   §11 heartbeat-resumed) reads the reply to the last report **directly from the inbox**. Do
   **not** rely on `mission_mailbox.py poll` to deliver steering: that router is **telemetry-only**
   — it writes mission-record verdicts and *explicitly declines* free-form steering ("anything
   else in the reply: do NOT act on it — note it back instead", `mission_mailbox.py`
   `_VERDICT_PROMPT`). So `poll` still runs to capture per-cycle blocker/accept verdicts into each
   cycle's run-record, but **the orchestrator interprets steering itself** — there is no wired
   steering-reply kind, and pretending `poll` provides one would be the exact leak evolution.md
   audits for. Map the reply to the mode's verbs:
   - **Depth:** "don't like this direction" → REJECT (reset to the last milestone branch,
     re-aim); "keep going" → CONTINUE; "better idea, implement that" → REDIRECT (new brief).
   - **Breadth:** "more like #3" → fan near #3; "these are samey" → push novelty hard;
     "go deep on #3 and #7" → hand those branches to depth-reach (breadth feeds depth).
   - **Silence** → proceed on the current heading. Silence is *not* consent (see contact leash).
2. **Synthesize the brief** (replaces the grill for cycle ≥ 1): charter + current lineage state
   (champion / gallery / beam) + routed steering + open threads from the last cycle's audit.
   Criticality-split like `/mission`'s `--queued` mode (defined in `skills/mission.md`; §4
   "Interaction modes"): low-criticality assume+log, blocking-critical push to phone. Cycle 0's artifact (the first batch / champion v0) comes from a normal attended-ish
   first pass right after the grill.
3. **Run the cycle as a `/mission`** — GRILL is the synthesized brief; PLAN → FIGHT → FREEZE →
   EXECUTE → AUDIT exactly as `/mission` specifies, governed by the constitution, honoring
   `ac_required`, R-tiers, the problem-solving ladder, caps. The cycle writes a normal
   run-record at its DELIVER (the data backbone stays intact — one record per cycle). Two
   framework-fit requirements, both load-bearing against the §11 heartbeat and `/mission`'s own
   path conventions:
   - **Canonical sibling run-dir, flat id.** The cycle's `/mission` uses an ordinary run-dir
     `.mission/<cycle-run-id>/` with a **flat** `<cycle-run-id>` = `loop-<slug>-cycle-<NN>` (no
     slash); its `REPORT.md` / `report.json` / `mission_records/<cycle-run-id>.json` are written as
     for any `/mission`. Do **not** nest it under `loop-<slug>/`: the heartbeat derives the repo
     root by stripping exactly two path segments (`Resolve-Roots`, `mission_heartbeat.ps1:48`) and
     its task id by `Split-Path -Leaf` (`:73`), both of which assume the canonical
     `<repo>/.mission/<run-id>` shape — a three-deep path breaks the root derivation and collides
     every loop's leaf to `cycle-<NN>`. A flat id also keeps `mission_records/<cycle-run-id>.json`
     a flat file.
   - **One driver only — cycles run heartbeat-suppressed.** The loop owns a **single** heartbeat at
     the loop level (`.mission/loop-<slug>/`, Driver §) — the §11 one-driver-only invariant; a loop
     must **not** let each cycle arm its own. **Honesty caveat — this suppression is discipline, not
     yet a mechanism:** `/mission` arms its heartbeat automatically at PLAN
     (`skills/mission.md:193`) and there is no `--no-heartbeat` flag today, so "cycles don't arm" is
     **orchestrator discipline, not a gate** — same class as the budget ceiling below. Until
     `/mission` grows a launched-under-loop no-arm mode (**specified, not yet wired**), the loop
     refrains from per-cycle arming by hand. A cycle that arms anyway self-disarms at its own DELIVER
     (its `REPORT.md` lands in its flat sibling run-dir, `:128`) — bounded and self-cleaning — but
     until the no-arm mode lands it transiently risks a second §11 driver; that is the one real
     hazard this gap leaves open, flagged not hidden. The loop keeps its single heartbeat fed by
     writing its **own**
     per-cycle progress into `loop-<slug>/` each cycle (the `cycle-<NN>.report.md` overlay + the
     lineage-ledger update), which the heartbeat's recursive artifact-mark scan (`:153-155`) reads
     as liveness — so a live driver is never misjudged futile (`:180`) without ever reaching into a
     cycle's sibling run-dir. Self-disarm safety comes from the **filename reservation** (the loop
     writes `loop-<slug>/REPORT.md` only at finalization, so the root-only self-disarm `:128` fires
     only when the loop ends), not from any nesting.
4. **Commit to the lineage** (replaces deliver-and-stop):
   - **Depth:** commit on `agent/loop-<slug>`; at a milestone cut `agent/loop-<slug>/m<NN>`.
     Keep-best — a successor that does not improve on the champion is rejected and logged, not
     committed over it.
   - **Breadth:** commit each variation on its own `agent/loop-<slug>/v<NN>`. Keep-all-distinct;
     the gallery is the set of variation branches.
   - **Mania:** the beam branches form a tree; to prune, **mark a branch dropped in the ledger —
     never `git branch -d` it** (§9.1); the pruned branch stays for the Human.
5. **Supervise diversity** (breadth / mania — the orchestrator's named job, § diversity below).
6. **Report** (differential, §reporting below) and **loop** (§driver below).

## Diversity supervision (breadth / mania) — two levels, both required

Generating "10 unique variations" fails two different ways; supervise both.

- **Local / pairwise — anti-redundancy.** Before accepting a variation, the orchestrator checks
  it is *meaningfully* distinct from its siblings, not an identical twin reskinned. A variation
  that fails goes back for a genuinely different take, citing which sibling it duplicates.
- **Global / spectrum — anti-clustering.** Distinct siblings can still bunch in one corner with
  whole regions empty. The orchestrator induces a **spectrum map**: cluster the batch, **name
  the axes it observes**, plot the variations, and **mark the gaps**. Coverage is unfalsifiable
  without axes — so the map is how coverage becomes checkable instead of self-graded. Surface
  the map to the Human to confirm or add an axis the batch missed; aim the next batch at the
  marked gaps.

The breadth/mania **deliverable is the map, not a flat list** — "a map of the space, variations
plotted, gaps named" is what lets the Human answer "did this cover what I asked." A list cannot.

## Stop conditions (no definition-of-done — these are the only terminators)

- **Budget ceiling** (universal, never waived): cumulative tokens / agents / cycles across the
  whole loop. Crossing it finalizes the loop as `DIVERGED(budget)` (§6.3 vocabulary) — finish
  in-flight cycles, no new ones, report, **pause** (never silent death). **Enforcement caveat
  (evolution.md's JS-vs-prose discipline):** only each *cycle's own* `/mission` budget is
  JS-enforced (§6.4, `budgetReport`); the *cumulative loop* ceiling is enforced by the
  orchestrator counting across cycles — prose, not a runtime gate. A hard cumulative floor needs
  a spend accumulator the driver reads each cycle (a `loop-budget.json` counter in the loop dir) —
  **specified, not yet wired**. Until it is, this floor is only as hard as the driver is honest;
  it is the one place the autonomy argument leans on discipline rather than mechanism — flagged
  here, not hidden.
- **Contact-staleness leash** (binds in **any `--unattended` run — all three modes**; the risk it
  guards is Human-*absence*, not drift, so it is mode-independent, including breadth, whose own
  saturation terminator is only soft; moot in attended foreground where the Human is present each
  cycle; off only under `--feral`): after `contact_leash_k`
  consecutive cycles with **zero Human contact**, the orchestrator pauses and waits. Silence
  buys K cycles, not infinity — overnight silence means the Human is asleep, not consenting.
  **This is orchestrator discipline, not a runtime gate** — no script enforces it (unlike the §11
  heartbeat's own scripted staleness logic); a confused driver could sail past it. The cap is a
  frozen count the orchestrator must check each cycle, not a deterministic guarantee.
- **Novelty saturation** (breadth/mania, **soft**): when new variations stop being distinct, the
  space is mapped. Do not hard-stop — **surface saturation and wait** ("the space looks
  saturated; here are the distinct clusters — go deeper on one, or push for more novelty?").
- **Human `stop` / `pause` / `hold`** over the channel — explicit, immediate.
- **Drift, depth** — the cumulative diff vs champion-v0 (not just vs HEAD~1) crosses what the
  charter allows → forced Human checkpoint. Per-cycle diffs each look reasonable while the
  endpoint drifts; the cumulative diff is the only thing that catches boiling-frog. (Like the
  leash, this is orchestrator discipline, not a gate — the orchestrator must compute the
  cumulative diff each cycle; nothing computes "what the charter allows" for it.)

## Reporting (differential — keep the inbound signal scarce, or the channel re-blinds)

Do **not** flatten every cycle into an equal-volume report; report fatigue makes drift invisible
again. Instead:

- **Light** (default, every cycle): one progress line — cycle index, mode, what changed, "no
  direction change," budget burned / remaining. A heartbeat, not a wall of text.
- **Loud** (milestone / direction-change / needs-you / saturation / drift / pause): the full §12
  report — **plain layer leads**, evidence below a divider, Needs-you items as one-tap verdicts.
  **Always include the cumulative state**: depth → the diff vs champion-v0; breadth/mania → the
  current spectrum map with gaps. A loud per-cycle report is loop-authored (it carries the
  overlay the cycle's own `/mission` report does not) — write it to
  `.mission/loop-<slug>/cycle-<NN>.report.md` and email it **threaded under the cycle's run-id**:
  `python ~/.claude/scripts/mission_mailbox.py report <cycle-run-id> --file
  .mission/loop-<slug>/cycle-<NN>.report.md`. Two consequences, both load-bearing:
  - **Telemetry routes correctly with no fan-out hack.** The verdict router writes to
    `mission_records/{ref}.json` (`mission_mailbox.py` `cmd_report` sends `ref=run_id`); threading
    under `<cycle-run-id>` means a reply ruling on the cycle (blocker legit/noise, accept) lands in
    that cycle's own `mission_records/<cycle-run-id>.json` — the record the cycle's `/mission`
    already wrote (each cycle runs at **M1+** — a brief-synthesized DAG committing to a deliverable
    lineage never floors to M0 — so the per-cycle record always exists). (Threading a per-cycle
    report under `loop-<slug>` instead would route to a `mission_records/loop-<slug>.json` that no
    cycle created.)
  - **The filename is deliberately not `REPORT.md`.** The §11 heartbeat self-disarms the instant a
    `REPORT.md` appears in its run-dir (`mission_heartbeat.ps1:128`, "DELIVER leaves
    REPORT.md"). A loop that wrote `loop-<slug>/REPORT.md` every loud cycle would kill its own
    overnight driver on cycle 1. So **`.mission/loop-<slug>/REPORT.md` is reserved for loop
    finalization only** (budget ceiling / Human stop) — and writing it there is exactly what makes
    the heartbeat self-disarm fire correctly, when the loop has actually ended.
  - **Steering is separate.** A reply *steering the loop* ("go deep on #3", "I don't like this") is
    read by the orchestrator directly (Phase-1 step 1); the verdict router neither expects nor
    handles it.
- **Mania reporting is mandatory-map, never differential-light**: a fan of descents is unreadable
  as a list. Every mania report is a **live tree/frontier map** — what is in the beam, what was
  pruned, where the depth is heading. In mania the orchestrator's hardest job is keeping the tree
  legible; that is the work.

## Driver (how the outer loop actually turns)

- **Foreground (ship first):** the native `/loop`. `/loop /mission-loop --resume <loop-id>`
  self-paces or runs on an interval — "iterate while I work." You stay at the keyboard and can
  interrupt any cycle. Default cadence is **self-paced, one cycle then surface** — not a hot
  interval; a full-mission cycle is a real spend.
- **Overnight (designed, deferred):** the §11 heartbeat as the driver. **Arming the cron is a
  USER action** — the classifier denies agent-side `schtasks`, so the loop hands the Human the
  arm command and does not run it itself:
  ```
  powershell -NoProfile -ExecutionPolicy Bypass -File ~/.claude/scripts/mission_heartbeat.ps1 arm -RunDir <repo>/.mission/loop-<slug>
  ```
  Overnight runs `--unattended` (proceed-on-silence) under the contact leash + budget ceiling.
  This is correct only because per-cycle reports are written as `cycle-<NN>.report.md` (above) and
  `loop-<slug>/REPORT.md` appears **only at finalization** — so the heartbeat's REPORT.md-means-
  delivered self-disarm (`mission_heartbeat.ps1:128`) fires when the loop ends, not mid-loop.
  Feral overnight is the maximum-trust combo — require the explicit `--feral` double-opt-in, and
  see the feral-terminator note in Mode: under feral the only live terminators are the budget
  ceiling (orchestrator-counted) and a Human stop.

## Resume (`--resume <loop-id>`)

Like `/mission --resume`, but the frontier is the **lineage**, not a single DAG. Reconstruct the
champion / gallery / beam from committed branches only (`agent/loop-<slug>*`), re-read
`charter.md` for the frozen principles/boundaries/ceilings, replay the last report's routed
steering, and re-enter the cycle loop. One driver only (§11): check the heartbeat lock
(`.mission/loop-<slug>/mission.lock`, written by `arm`) + recent commits
before flying; evidence of a live driver → stop and report, do not double-drive. A cycle with no
committed branch is not done — re-run it (idempotent by §10 design).

## Hard rules (perimeter — never violate)

- Everything `/mission`'s perimeter forbids, plus: the loop never merges a milestone/variation to
  the default branch, never removes the budget ceiling (orchestrator-enforced until the
  `loop-budget.json` accumulator lands — see Stop conditions), and never treats silence as consent
  past the contact leash.
- A cycle with no closure record closes nothing — same V0/V1 → V2 downgrade as `/mission`.
- Never block waiting on the Human; the loop pauses with a report + state, it does not hang.

$ARGUMENTS
