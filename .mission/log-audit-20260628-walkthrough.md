# Mission log audit — 2026-06-28

**Plain version first.** Since the last review (June 19), four missions ran: a venue-decision
report for the 3×-desk-rejected MILP paper, two web-UI ports into Natalie's overlay (the
thumbnail bar and the command bar), and an email-pipeline smoke test. Both UI ports shipped and
you then fixed them by hand in Rhino — those fixes are exactly the signal the system learns
from, and they all landed in the *same place*: the live, running overlay that the automated
screenshot tests are blind to. The smoke test and an older plumbing item are settled and
archived below.

What needs you, in order: **(1)** a perimeter call — the mission executor itself keeps failing
to launch, and every mission is being hand-walked as a workaround; **(2)** the venue lock for
the paper (yours alone); **(3)** a one-tap confirm on the two UI-port corrections; **(4)** a
recurring-weakness flag — every escaped defect for months has landed in the live overlay the
tests can't see; **(5)** a small budget-tuning nudge.

Item 1 is a **perimeter decision — yours alone, not part of any batch.**

---

## 1. PERIMETER — the mission executor can't launch; it's all hand-walked right now

**What & why you:** The Workflow tool that is *supposed* to run missions automatically has now
failed three times. Twice it's a permission prompt a headless/auto-resumed mission can't answer
— so the mission re-orients but never re-drives itself (open since June 10). The third time —
the June 27 venue mission — the harness rejected the executor script outright with "script
contains control characters," *even after a verified ASCII-clean copy*, which means the guard is
inspecting something beyond the script text. The practical result: every mission right now is
run by the orchestrator hand-walking the plan instead of the executor driving it. This is the
execution substrate of the whole system and it's been quietly broken-and-worked-around for 18
days. Because it changes what's pre-authorized to run unattended, it's a perimeter call — yours
alone.

**Rec:** (a) Pre-grant the Workflow tool for *blessed* runs only (not blanket — a blanket grant
widens the headless-autonomy blast radius the perimeter exists to bound), **and** let me open
the "control-characters" guard as a separate harness bug. Reasoning: the pre-grant unblocks
headless auto-resume; the guard is what's blocking even *attended* dispatch, and the ASCII-clean
failure says it's not just the box-drawing glyphs in the canonical executor — it's fixable once
we know what it actually inspects.

**Options:** (a) accept — pre-grant for blessed runs + I investigate the guard ·
(b) pre-grant blanket for all mission runs (simpler, wider blast radius) ·
(c) no pre-grant — keep hand-walking, just fix the guard bug · (d) defer

**Evidence:** `proposals/2026-06-10-heartbeat-resume-loop-and-cost.md` §B (perimeter-adjacent,
human-only, open 18 days); `claude-fieldnotes/mission_records/mission-20260627-venue-decision.md`
→ "Deviations — EXECUTION SUBSTRATE."

## 2. Venue lock — where does the MILP paper go next? (your call alone)

**What & why you:** After three desk rejects (AiC / JCCE / JOBE), the June 27 decision mission
ranked free, reputable, desk-safe venues and deliberately left the final lock to you — it's a
V3 (a commit only you can make). It found that your original want (mid-high impact factor)
trades against desk-safety, so it split the answer into lanes rather than silently resolving to
one. The mission's "human-diff" slot is unfilled, waiting on your lock.

**Rec:** This is yours to commit, not mine to pick — but the report's own call is **IJAC** (SAGE;
free; reframes the work from operations-research to design-support; desk-safest, and a
near-sibling paper is already in there) as primary, with **ESWA** (Elsevier, IF 12.2) as the
Lane-B option *if* you'll accept operations-research-novelty risk at peer review for the higher
impact factor. It's a rubicon — worth a `/scrutiny` decision-mode pass before you lock.

**Options:** (a) lock IJAC primary (desk-safest) · (b) Lane B — ESWA, accept the risk for IF
12.2 · (c) understudy route — SASBE or ASR · (d) defer — I'll read the report myself first

**Evidence:** `claude-fieldnotes/mission_records/mission-20260627-venue-decision.md`;
`MILP-solver-paper/.mission/mission-20260627-venue-decision/REPORT.md` + `VENUE-2026-06-27.md`.

## 3. Confirm the two UI-port corrections (the gold signal)

**What & why you:** Both web-UI ports shipped and you then fixed them in Rhino. The machine
classifier calls both **corrections** — your commits modify lines the mission wrote, not
housekeeping. (a) **Thumbnail bar:** one follow-up commit, 3 lines — you hit a hard Rhino freeze
on first smoke; root cause was the new data path blocking Rhino's UI thread two ways. Fixed, but
an in-Rhino *re-smoke* is still pending. (b) **Command bar:** six in-Rhino rounds — a mix of your
design refinements (drop the wordmark, full-pill profile, wider main divider) and genuine agent
defects (window jump on popup open, tooltip clipping off-screen, and a "concentric" claim I
shipped *without measuring* that you caught). I need your nod to stamp both as confirmed
corrections.

**Rec:** (a) Confirm both. Reasoning: the classification is unambiguous (your commits touch
mission-authored lines) and the command-bar record already captures all six rounds in your own
words — this is the cleanest gold-signal capture the system gets. One sub-point: thumbnail-bar
node N1 was rounded up from "self-checkable" to "model-checked" for contract-shape judgment and
flagged as *possible* over-classification — but your fixes hit the runtime nodes (N4/N6), not
N1, so there's no evidence the round-up over-reached; I'd **hold it** rather than down-classify.
(Down-classifying needs your explicit say — only you can authorize it.)

**Options:** (a) confirm both corrections, hold N1 as-is · (b) confirm both, but down-classify
N1 (I'll record your authorization) · (c) one of these isn't a correction — point me at it

**Evidence:** thumbnailbar commit `202500a4` (overlap 1 commit / 3 lines); commandbar commits
`5d80cf38`→`c878d9c8` (6 rounds); both records' `human_review` blocks.

## 4. Name the recurring weakness — nothing machine-checks the live overlay

**What & why you:** This is the synthesis of item 3. Across *both* UI-port missions, every defect
that escaped to you landed in the same place — the real, running overlay the headless screenshot
tests can't see: the Rhino-thread freeze, the window-resize jump, the tooltip clipping
off-screen, divider geometry that only looks wrong once rendered, a "concentric" property never
measured. The automated gates pass clean, then you find the defect by hand in Rhino. There is no
machine gate for the live-overlay runtime — it relies entirely on your in-Rhino smoke. That's
now a named, twice-confirmed gap, not a one-off. (This is the "name the systematic weakness"
signal the evolution loop is built to catch.)

**Rec:** (a) Make an in-Rhino smoke pass a *required gate before a mission counts as delivered*
for any overlay-zone mission — so the live check is a blocking step, not something you discover
after the fact. Reasoning: the gap is structural — the headless harness is blind to the runtime
envelope by construction, so the fix isn't a smarter automated test, it's promoting the live
smoke from afterthought to gate.

**Options:** (a) adopt a mandatory pre-delivery in-Rhino smoke gate for overlay-zone missions ·
(b) record the weakness, no process change until a third occurrence · (c) defer

**Evidence:** thumbnailbar `r_tier_escape_outcomes` (N4/N6 "yes-caught-at-smoke", "inherently
V3"); commandbar `human_review` → "PATTERN ACROSS ALL FOUR ROUNDS … the V3/human gap is exactly
where every defect landed."

## 5. Budget tuning — M2 missions keep overrunning their agent ceiling (now twice)

**What & why you:** At the June 19 review I flagged a mission that opened 2 sub-agents past its
ceiling, and we agreed to revisit *only if it recurred*. It has: the thumbnail-bar mission
spawned 43 against a ceiling of 40 — and would have converged, so the overrun wasn't waste, the
ceiling was just set too low for a 9-node plan that also runs a 6-node improvement pass. The
record proposes a concrete fix: feed the improvement-pass count into the budget formula (≈48–52
for this shape). Low stakes, but the deferred condition is now met.

**Rec:** (a) Adjust the M2 agent-budget formula to add headroom for the improvement-pass count,
per the record's own number. Reasoning: n=2 now, both overruns small and convergent, and the
record already did the math — this is a cap tweak, not an architecture change.

**Options:** (a) bump the M2 agent-budget formula (improvement-pass-aware) · (b) first check
whether the spawn-time ceiling is even enforced · (c) keep deferring

**Evidence:** thumbnailbar `budget_planned_vs_actual` (agent_budget 40, spawned 43,
would_have_converged true); June 19 walkthrough item 3 (the n=1 we deferred).

---

## Archived silently (already decided / no action)

- **Email-pipeline smoke test** (`smoke-20260620`) — you already replied with the codeword; it
  was a parser check, no defect signal.
- **June 19 item 1 — missions weren't stamping their constitution version** — **RESOLVED**: all
  four new records stamp it (0.3.6 / 0.4.0). The cap-tuning loop is no longer frozen.
- **June 19 item 2 — tier012 clean delivery** — captured as confirmed-clean (your "2a";
  `confirmed_by_human: true`).
- **Goal-condition "soft mission" proposal** (`2026-06-20`) — awaiting review, but its own
  recommendation is to **not** build the new primitive (the existing sub-loop covers it); nothing
  pending action. Surfaced only so you know it's parked — say the word to put it on the active
  list.
- **Escalation precision (§3.3)** — zero blockers escalated to you across all four missions; no
  legit/noise verdicts to capture.
- **Tier-2 cap calibration** — not due (~5 missions since the June 12 run; trigger is ~10).

---

*Audit assembled by a fresh agent (maker/checker, §3.2). Reply inline under any item with your
pick (e.g. "1a, 2a, 3a, 4a, 5a") — `MailboxPoll` routes it into the run-records automatically.
Item 1 is a perimeter call — yours alone, never in an autonomous batch.*
