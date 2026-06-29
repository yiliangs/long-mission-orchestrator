# Mission log audit — 2026-06-19

**Plain version first.** Since the last review (June 12), one mission shipped and merged
cleanly — the Tier 0/1/2 follow-up batch that wired the executor's redo-loop and bumped the
constitution to 0.3.6. You merged it without changing a single line afterward, which is the
strongest "this was right" signal the system gets. Nothing in that mission needs you.

What does need you is a plumbing problem the last cap-tuning run uncovered: recent missions
aren't stamping which constitution version they ran under, and the tuning loop sorts evidence
*by* that stamp. So every mission you run right now is invisible to it — the loop that's
supposed to learn your real cost limits is frozen until the stamp is fixed. That's item 1.
Item 2 is a one-tap confirmation that the merged mission was clean. Item 3 is a minor "should
we look into this" flag about a mission that opened 2 more sub-agents than its budget allowed.

Three older review threads are already settled and I've archived them silently (details at the
bottom).

---

## 1. The cap-tuning loop is frozen — missions don't record their version

**What:** The June 12 cap-calibration run found that recent missions write their
cost-limit usage logs *without* recording which constitution version they ran under. The
tuning heuristics group evidence by version, so unstamped records can't be placed in any
group — they're invisible. Result: no matter how many missions you run, the loop that adjusts
your caps (how many review rounds, audit cycles, etc. are allowed) can never gather enough
evidence to propose a change. This is the single thing blocking the evolution loop from
learning anything. It has the widest blast radius of anything in the log and has sat
undelivered since June 12.

**Rec:** (a) Authorize fixing the close-time writer so every mission stamps
`constitution_version`, and back-fill the two June 11 records (`jobe-submit-audit`,
`web-ui-port`) as `0.3.3` — but only if 0.3.3 was actually governing on June 11; I'll verify
the commit dates before writing, not guess. Reasoning: the fix is mechanical and unblocks all
future tuning; the back-fill is the only way the existing two records become usable, and it's
safe because it's a provenance stamp, not a content change.

**Options:** (a) accept rec — fix writer + back-fill as 0.3.3 after I verify the date ·
(b) fix the writer only, leave the two old records unstamped (start the corpus clean) ·
(c) defer

**Evidence:** `proposals/2026-06-12-tier2-calibrate-noop.md` §H1; `schema/cap-log.format.md`
(version-partitioned heuristics); records `20260611-jobe-submit-audit`, `web-ui-port-20260611`
in `claude-fieldnotes/mission-caps.jsonl` (both missing the field).

## 2. Confirm the merged mission was a clean delivery

**What:** Mission `tier012-20260612` (6 nodes: minimal Agent contract, executor gate-fix
loop, README/constitution disclosure, leak audit, final consistency pass) delivered via
PR #1 and you merged it. The corrective-diff classifier finds **zero** commits on top of the
merge that touch any line the mission wrote — a clean, uncorrected delivery. Two of those
nodes were closed at V2 (model-checked, no machine test exists), including the executor
gate-fix change, so a clean human-diff here is the only confirmation those model-only
closures held up in practice. I need your nod to record it as the gold signal.

**Rec:** (a) Confirm clean / non-corrective. Reasoning: machine classification is
unambiguous — 0 post-merge commits, 0 mission lines touched; the merge with no follow-up edits
is itself your acceptance. (Note: no run-record file exists for this mission to stamp the
verdict into — I'd create a minimal one under `.mission/tier012-20260612/` to hold the
`human_review` block unless you'd rather not.)

**Options:** (a) accept — clean delivery, create the record to stamp it ·
(b) clean, but don't bother creating a record · (c) you actually did make fixes I should
look at — point me at them

**Evidence:** `python scripts/diff_overlap.py . b720c80 0bb2003 HEAD` →
`post_delivery_commits: 0, classification_hint: "none"`; merge `0bb2003` (= current HEAD).

## 3. Minor: a mission opened 2 sub-agents past its budget

**What:** The June 11 `jobe-submit-audit` mission spawned 38 sub-agents against a frozen
budget of 36. The constitution treats budget exhaustion as a signal to stop opening new work
and finalize gracefully (§6.4), so a 2-agent overrun is either a harmless logging artifact
(budget frozen at plan time, agents counted across replans after the fact) or a real gap where
the ceiling isn't enforced at spawn time. Low stakes; flagging so it's not lost if it recurs.

**Rec:** (c) Defer — note it and re-examine only if a second mission overruns. Reasoning:
n=1, small overrun, plausibly an artifact; not worth a code change yet. If you'd rather be
sure, (b) and I'll have the executor adapter confirm whether the spawn-time ceiling is live.

**Options:** (a) investigate now — audit the executor's spawn-time budget check ·
(b) ask the executor adapter to confirm enforcement, no full investigation ·
(c) defer until it recurs

**Evidence:** `proposals/2026-06-12-tier2-calibrate-noop.md` §H2; record
`20260611-jobe-submit-audit` (`agents_spawned: 38, agent_budget: 36`).

---

## Archived silently (already decided — no action needed)

- **Post-v0.2 pending decisions** (`proposals/2026-06-09-post-v0.2-pending-decisions.md`) —
  all resolved in that file's own "Resolutions (Human, 2026-06-09)" block: runtime-verification
  → BUILD harness; audit spot-check → YES/low-priority; worktree fan-out → WAIT; corpus seed →
  superseded by this audit loop. The one item left open then (#4b "is the gate a gate or an
  annotator?") was answered by `tier012` node n1, which wired the capped revise→re-review
  redo-loop on blockers and majors.
- **Natalie calibration seed** (`proposals/2026-06-09-natalie-calibration-seed.md`) — captured
  to fieldnotes on June 12 after your June 11 agreement. Both entries are `may_lower:false`,
  which is the correct settled state: the June 12 human-diff showed no V2-gate miss, so no
  down-classification was licensed. Nothing awaiting you.
- **Tier-2 cap calibration** — ran June 12, verdict no-op (no cap change licensed; corpus too
  small and version-unpartitioned). Not due again: trigger is ~10 records, only 3 exist. Its
  one actionable byproduct is item 1 above.

---

*Audit assembled by a fresh agent (maker/checker, §3.2). Reply inline under any item with your
pick (e.g. "1a, 2a, 3c") — `MailboxPoll` routes it into the run-record automatically.*
