---
description: Run a self-evolution review — calibrate caps (Tier 2) or amend rules (Tier 3) from accumulated run-records. Runs scheduled in the background; emails proposals for async grant.
argument-hint: [calibrate | evolve | apply <proposal-id>] [--since <run-id>]
---

# /evolve

The framework improving itself (constitution §7). **This review is itself a mission** — it
goes through plan → critic-fight → audit like any other, and its deliverable is a batch of
**proposed amendments, each citing run-records as evidence.** A proposal without supporting
records is invalid.

**This runs autonomously in the background** (scheduled) and **emails you the proposal**. You
review async (comment or grant); on grant, the agent applies and deploys. The split that
keeps the perimeter intact: **generating a proposal is automated** (proposing is additive and
safe), but **applying an amendment always waits for your grant** — a system never rewrites its
own constitution ungranted (§9).

Two tiers, selected by `$ARGUMENTS` (default: `calibrate`):

## Tier 2 — `calibrate` (every ~10 missions)

Cheap, narrow, numeric. Tune the cap table (§6.2) from evidence.

1. Read `claude-fieldnotes/mission-caps.jsonl`, filtered to the **current
   constitution_version** (never aggregate across regimes).
2. Per `(cap)` group, apply the heuristics in `schema/cap-log.format.md`:
   - raise if >20% hit the limit and most were `would_have_converged`;
   - lower if p95(used) < limit/2;
   - else leave.
3. Emit a proposed diff to the constitution's §6.2 table: `{cap, current, proposed,
   evidence_stats, rationale}[]`. Much of this is deterministic arithmetic over the jsonl —
   keep the model's role to judgment at the margins, not to inventing numbers.

## Tier 3 — `evolve` (periodic, broader)

Reads the full run-records, not just caps. Looks for **patterns that justify rule changes**:

- **Verification gaps** — human-diffs concentrated on self-closed (V0/V1) nodes → propose
  sharper close-time binding, or move a task pattern to a categorical V2 floor (§2.2).
- **Escalation precision** — falling blocker legit-rate → propose tighter critic prompts or
  sharper acceptance-criteria conventions (§3.3).
- **Replan churn** — recurring `plan_assumption_false` on similar nodes → propose a planning
  rule or a contract-template field that pre-empts it.
- **Accepted-major patterns** — the same major repeatedly accepted-with-reason → maybe it
  isn't a defect; propose relaxing the criterion. Or it always recurs → propose a check.

Each proposal carries: the claim, the **run-record ids that evidence it**, the exact edit,
and a predicted effect.

## The autonomous cycle (generate → email → grant → apply)

1. **Generate (automated).** The scheduled run produces the amendment batch and writes it to
   `long-mission-orchestrator/proposals/<proposal-id>.md` (a draft, uncommitted to the constitution).
   One batch per cycle — constant churn destroys the comparability that makes records
   meaningful (§7).
2. **Perimeter guard.** Any proposal touching a §9 perimeter clause (blast radius, merge
   authority, blocker waiver, verification floors, confidentiality, the perimeter list) is
   flagged **`PERIMETER`** in the batch. It is still emailed, but its grant is explicit and
   per-clause — never bundled into a blanket approval.
3. **Email (automated).** Send each proposal via the deployed §12 channel:
   `python ~/.claude/scripts/mission_mailbox.py proposal <proposal-id>` — the email carries the
   claim, cited record ids, the exact diff, and predicted effect, and instructs the Human to reply
   `GRANT <secret>` to apply. Then **stop** — do not apply.
4. **Grant (you, async).** You reply or, next session, comment or grant. Partial grants are
   fine ("take 1 and 3, drop 2"). A reply carrying the shared `GRANT_SECRET` is polled by
   `LMO\MailboxPoll` and triggers step 5 automatically; a reply *without* it is recorded as a
   comment and applies nothing (the secret is what authorizes a §9 human-only action over email).
5. **Apply (`/evolve apply <proposal-id>`).** On your grant, apply the granted edits to
   `docs/agent-constitution.md` (or §6.2 cap table), **bump the version**, commit
   (`evolve: constitution vX.Y -> vX.Z`), run `scripts/deploy`, and confirm by email. The
   version bump is what keeps future records comparable. Ungranted or PERIMETER-without-
   explicit-grant items are never applied.

## Trigger (scheduled, not hand-opened)

- **Tier 2 `calibrate`** runs on a schedule keyed to mission volume (fires when the
  `mission-caps.jsonl` line count since the last calibration crosses ~10).
- **Tier 3 `evolve`** runs on a calendar cadence (e.g. monthly, or post-venue-milestone).
- Both are wired as background routines (Claude Code Routine / Task Scheduler) that invoke
  this skill headless, generate, and email. **Activation is deferred until run-records
  exist** (post Phase 1) — an `/evolve` with an empty corpus has nothing to propose.

$ARGUMENTS
