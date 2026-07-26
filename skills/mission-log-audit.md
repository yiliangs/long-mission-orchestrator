---
description: Find unresolved human decisions, stalled recovery, and follow-up work across mission state, branches, and corrective commits.
argument-hint: "[run-id or loop-id]"
---

# Mission Log Audit

$ARGUMENTS

Surface only mission state that still needs human judgment or recovery. The deliverable is a short decision queue, not a history of agent activity.

Inspect the requested run or, with no argument, recent `.mission/*/plan.json`, journals, reports, heartbeat markers, `agent/mission-*` branches, loop branches, related pull requests, and post-delivery commits. For schema 1.0 runs, load `.mission/contract.md`; a missing contract is an eligibility defect, and its checks, critical paths, machine-blind properties, and boundaries frame the audit. When auditing a mission you drove, use a fresh read-only reviewer to assemble candidates, then verify each item against current repository and GitHub state yourself.

Look for:

- a run with no valid `result.json`, no active driver, and incomplete journal tasks;
- a latest canonical `audit.json` that is missing, uncommitted, older than the audited branch, or inconsistent with `result.json`;
- a terminal result with missing, ambiguous, or unreconciled `notification.json`;
- a heartbeat that is dead, repeatedly resuming without progress, or still armed after any terminal result;
- a paused loop whose contact leash, charter boundary, or budget requires a decision;
- acceptance criteria without an observable passing witness;
- reported assumptions, blockers, or plan premises awaiting human reopening;
- unmerged or abandoned mission branches and blocked pull requests;
- corrective commits that changed mission-authored behavior after delivery;
- proposed outward, destructive, or architectural actions never authorized.

Ignore resolved, superseded, duplicate, and informational entries. Do not infer a live problem from an old warning when current state removed it.

Rank surviving items by consequence, then age. For each, report the decision or recovery action, why it matters now, your recommendation, the strongest alternative, and exact evidence. Ask about one item at a time when the user is present. Apply an answer only in the system that owns it; do not copy the same decision into multiple ledgers.

If nothing needs judgment or recovery, say so in one line and stop. Never arm or disarm a heartbeat, send email, push notifications, merge, or modify external state merely because an audit ran.
