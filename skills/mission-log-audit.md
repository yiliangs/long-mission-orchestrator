---
description: Periodically scan the mission log, surface every item that needs the Human's decision as a ranked walk-through with recommendations, capture the verdicts, and feed them to the evolution loop. The active replacement for passively waiting on review.
argument-hint: "[run-id to focus a single mission] | (no arg = full periodic scan)"
---

# /mission-log-audit

Human judgment is the scarcest resource in this system (§1.2, §7), and a loop that **waits for
the Human to remember to review goes blind** — the §7 evolution loop has no teeth without the
human-diff. This skill inverts that: it **pulls** the decisions to the Human on a cadence. Scan
the log, surface what needs a human call, recommend, capture the answer. The Human responds when
free; the system never depends on the Human initiating.

> Renamed from `/mission-accept` (which only captured one mission's human-diff, passively). The
> single-mission capture is still here — pass a `<run-id>` — but it is now one part of a standing
> log audit.

## Cadence (evolution-tunable caps, §6.2/§7)

Fire when **(≥3 missions delivered since the last audit) OR (≥4 days elapsed)**, whichever comes
first. **Auto-skip when empty** — if nothing needs the Human, archive silently and spend no
attention; a review that surfaces nothing is worse than none (mirrors §3.3 escalation precision).

- Multi-day cadence → a scheduled agent / cron (reuse the §11 scheduling primitive).
- "Check now while I'm working" → `/loop /mission-log-audit`.
- The cadence numbers are caps the calibration loop tunes; start at 3 missions / 4 days.

## What it scans (the log)

1. **Un-audited delivered missions** → the **human-diff** (the gold signal, §7). First run the
   deterministic classifier:
   `python ~/.claude/scripts/diff_overlap.py <repo> <fork_point> <delivered-ref>` — it splits
   post-delivery commits into **correction** (modifies/deletes mission-authored lines; blame
   overlap > 0) vs **non-corrective** (continuation/housekeeping; overlap = 0). Only
   correction-shaped commits are defect signal; a correction on a node the framework
   **self-closed (V0/V1)** is a verification gap — flag it loudly (§2.1 caught in the wild).
   Present the machine classification as a **pre-verdict to confirm or override** ("your 3
   commits touch 0 mission-authored lines — classified non-corrective; confirm?"), never as an
   open question. Record the outcome in `human_review.human_diff_classification` +
   `human_diff_overlap` (record schema v0.3).
2. **Escalated blockers without a legit/noise verdict** — escalation-precision telemetry (§3.3); a
   falling legit-rate is evidence to tighten critics.
3. **Classification-calibration entries with `may_lower:false`** awaiting human evidence (§7) — the
   Human's verdict is the *only* thing that can authorize a down-classification (§2.2 asymmetry).
4. **Open decisions / forks** flagged `NEEDS-HUMAN` in run-records or `proposals/`.
5. **Tier-2 cap-calibration due** (≥10 missions since last, §7) — when due, **run** the
   calibrate procedure (`~/.claude/docs/evolve.md`, Tier 2) as part of this audit and include
   the proposed cap diff as a walk-through item (this skill is the cadence that fires it; there
   is no separate human command). Any **PERIMETER** proposals (§9) — Human-only, never in an
   autonomous batch.

Dedupe against already-decided items so nothing is surfaced twice.

## Output: the decision walk-through

Ranked by **leverage × staleness**, phone-readable (inverted pyramid, §12). **Plain layer
first (§12):** the walk-through opens with a jargon-free paragraph — what landed, what needs
the Human — and every item's *What* line is written in plain sentences; V/R/M shorthand is
translated in place ("V2" → "model-checked; no machine test exists"), never exported raw. The
evidence refs stay precise below. Each item:

- **What & why it needs you** — one line, plain language.
- **Recommendation** — mine, reasoning compressed to a clause.
- **One-tap options** — `(a) accept rec · (b) <alternative> · (c) defer`.
- **Evidence** — a ref (run-id, file:line, ledger entry).

Deliver via **push** + **email** + a markdown file the Human can reply to inline: write the
walk-through to a file, then `python ~/.claude/scripts/mission_mailbox.py walkthrough <file.md>
--ref <run-id>` (the deployed §12 channel). The Human's reply is polled by `LMO\MailboxPoll` and
routed into the run-record `human_review` block automatically — so the *Capture* below happens
without you re-initiating. Lead with the highest-leverage item; never bury a perimeter decision
below routine ones.

## Capture (the Human's answers ARE the gold signal)

Record each verdict where it belongs — actively, not awaited:
- human-diff + blocker legit/noise → run-record `human_review`; the confirmed/overridden
  overlap pre-verdict → `human_diff_classification` + `human_diff_overlap`
  (`confirmed_by_human: true` once the Human rules);
- classification verdicts → `classification_calibration` (`evidence_source:"human_diff"`, and
  `may_lower` exactly as the Human rules — a critic opinion never can);
- accepted amendments → apply per `~/.claude/docs/evolve.md` (internal procedure — the Human's
  surface is this command + the email loop, §12);
- **in-session post-mission talk counts** (§7): when the Human raises a mission-attributable
  issue in conversation, capture it into the run-record then and there — don't wait for the
  next audit cycle to re-ask;
- merge decisions stay the Human's (§9.2) — this skill never merges.

## Maker/checker

The audit is assembled by a **fresh agent**, not the orchestrator that made the decisions — the
loop that surfaces *what needs review* must not be graded by the context that made the calls
(§3.2).

## Output confirmation

A one-line summary + the count by category, e.g.:

> Log audit (3 missions / 5 days since last). Needs you: 1 perimeter, 2 human-diffs, 1
> classification verdict. 4 items archived (auto-resolved). Walk-through emailed + pushed.

$ARGUMENTS
