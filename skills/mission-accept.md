---
description: Capture the human-diff and blocker verdicts for a delivered mission, closing the evidence loop.
argument-hint: <run-id> [legit|noise verdicts for escalated blockers]
---

# /mission-accept

You run this when you review a delivered mission. It captures the **gold signal** of the
whole framework (constitution §7): the difference between what the framework *delivered* and
what you *accepted* is ground truth for where it misjudged. Without this step, the evolution
loop has no teeth — it would only see what the framework did, never how wrong it was.

## What it does

Given `<run-id>`, locate `<repo>/.mission/<run-id>/` and the run-record in
`claude-fieldnotes/mission_records/<run-id>.json`. Then:

1. **Compute the human-diff.** Diff the delivered artifact (the agent branch at delivery, or
   the `.mission/<run-id>/` snapshot) against the current working tree (your post-review
   edits):
   - `git diff --stat <delivered-ref>..HEAD` → `human_diff_stat`
   - Summarize *what* changed and *why* in one or two lines → `human_diff_summary`.
   - **Attribute the diff to nodes.** A large edit on a node the framework **self-closed
     (V0/V1)** is a verification gap — flag it loudly; that is exactly the misclassification
     §2.1 guards against, caught in the wild.
   - **Fill classification verdicts (the calibration corpus, §7).** Where the diff shows a node
     was mis-classified — a V2 node you left untouched (over-verified), or a self-closed V0/V1
     node you heavily edited (under-verified) — set the matching
     `classification_calibration.node_class_verdicts[]` entry with `evidence_source:"human_diff"`.
     This is ground truth, so you may set `may_lower:true` — the **only** evidence that licenses
     *lowering* a class on a like-shaped task next time (§2.2). A critic's opinion never can.
2. **Record blocker verdicts.** For each blocker the mission escalated to you, mark
   `legit` or `noise` (from `$ARGUMENTS` or by asking). This is the escalation-precision
   telemetry; a falling legit-rate is evidence to tighten critic prompts (§3.3). Alert
   fatigue kills the safety channel — this metric is how we catch it early.
3. **Mark acceptance.** Did you merge the agent branch (with or without edits)? Set
   `accepted`. (You merge — perimeter §9.2. This skill never merges for you.)
4. **Patch the run-record** `human_review` block and save. Validate against
   `mission-record.schema.json`.

## Output

A one-line confirmation + the categorized lesson, e.g.:

> Recorded run-2026-06-08-hardware-errata. Human-diff: 12 lines across paper/body.tex,
> all on node n4 (V2, critic-passed) — framework's prose needed tightening, no verification
> gap. 1 blocker escalated, verdict: legit. Accepted (merged). 7 missions since last
> calibration.

The trailing count is the **Tier-2 trigger** (see `/evolve`): at ≥10 it nudges you to run a
calibration review.

$ARGUMENTS
