# Changelog

Notable changes to long-mission-orchestrator. The version tracks the governing constitution
version (`docs/agent-constitution.md`). Format follows [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

### Added
- **§11 heartbeat plumbing** (`scripts/mission_heartbeat.ps1`) — the constitution described the
  orchestrator-armed auto-resume abstractly, but no concrete implementation existed; the first M2
  mission (`natalie-fable-revision-20260609`) died at the usage limit mid-PLAN with nothing armed
  and had to be resumed by hand. `arm` writes `mission.lock` + registers `LMO\Heartbeat-<run-id>`
  (per-run scheduled task through `run_hidden.vbs`, every 30 min); each `beat` is idempotent
  (active → exit; stale ≥45 min → `claude --resume` headless from committed state, queued shape;
  complete/absent marker → self-disarm); `disarm` removes task + markers. Resume runs under the
  default permission mode — pre-granting autonomy stays a human settings action.

### Changed
- **`/mission` arms at PLAN, not FREEZE** — §11 says arming happens at launch; a session that
  dies grilling or fighting cannot schedule its own resurrection. The arming step now carries the
  concrete `mission_heartbeat.ps1 arm` / `disarm` commands.
- **FIGHT-phase critics are now provisioned frugally** (`skills/mission.md` §3) — the operating-card
  discipline lives in the EXECUTE-phase workflow and never reached the plan-critics `/mission` spawns
  directly, so they re-read the full 36 KB constitution and free-crawled the repo. They now carry the
  operating card, read only `plan.json` + `brief.md`, and bound repo exploration to a spot-check
  budget against the paths a node actually names.

### Fixed
- **Heartbeat resume loop (`scripts/mission_heartbeat.ps1`) — the §11 "a stale heartbeat survives at
  most one firing" invariant was described but never implemented.** The only guard
  (`heartbeat.spawning`) is removed in `finally`, so it blocked concurrent resumes but not the 30-min
  cadence. A mission that died without writing `REPORT.md` (so it never self-disarmed) re-fired
  `claude --resume` every 30 min — observed **23 times overnight on `natalie-fable-revision-20260609`**,
  staleness climbing 59→599 min with zero progress, each beat cold-reloading the full session
  transcript (~400 K tokens). Fix: a resume ledger (`heartbeat.resumes.json`) + `-MaxResumes` cap
  (default 3) + a no-progress check (if the prior resume failed to advance mission activity, stop);
  on give-up the beat self-disarms and writes a `heartbeat.dead` marker (a §12 dead-and-unrecoverable
  alarm) instead of looping. The activity scan now excludes the heartbeat's own bookkeeping files so a
  beat can't mistake its own writes for progress; `arm` clears stale ledgers so a deliberate re-arm
  still works.

## [0.2] — 2026-06-09

Right-sizing, cost, verification honesty, and the human-feedback loop. Driven by the first
daylight mission (the `natalie` Block/ subsystem run), whose transcript was dissected for
evidence behind each change. Still pre-first-mission *under v0.2* — a designed protocol with a
partial reference runtime.

### Added
- **Mission-size classes (M0–M2, §2.4)** — a second dial beside the V-ladder that sizes ceremony
  to the mission; an errand (M0) skips the plan-fight, heartbeat, separate audit, and go-gate.
- **Deterministic class guard** (`scripts/classify-mission.js`) — computes the class floor in
  code so M0's ceremony-skip can't be LLM-self-labelled; the planner may only raise, never lower.
- **Operating card** (`docs/operating-card.md`, §6.4) — workers carry a ~1.5 KB brief instead of
  the ~26 KB constitution, cutting the per-agent governance reload.
- **Cold-improver → actor-revision loop (§3.5)** — fresh eyes improve a first draft on a-c
  implementation nodes, fed back to the actor to revise with its own judgment.
- **Blast-radius parallelism (§6.5)** — per-node `write_set`; the executor fans out only
  write-set-disjoint nodes (decision layer; worktree fan-out deferred).
- **Active decision loop** — `/mission-log-audit` scans the log and surfaces decisions to the
  human on a cadence (the active replacement for passive review; §7).
- **§12 email channel wired** (`scripts/mailbridge.py` + `scripts/mission_mailbox.py`) — the proven
  plaid-finance transport, standalone (stdlib-only). Missions email REPORT.md / decision
  walk-throughs / proposals; an authenticated reply (sender + DMARC + an LMO-issued Message-ID)
  routes into the fieldnotes run-record (verdicts) or `/evolve apply` (token-gated grants), fenced
  by the §9 deny-list. Polled windowless by `LMO\MailboxPoll`. (Transport unit-tested; live
  round-trip pending config + first mission.)
- **Classification-calibration recording** — the pattern-observer's record half (features +
  `may_lower` truth-source asymmetry); the matcher is deferred.
- **Role org-chart** README hero (`docs/role-diagram.png`, rendered via
  `scripts/render_role_diagram.py`, IBM Plex Sans, architect palette adapted from the
  MILP-solver-paper figure standard).
- **`docs/architecture-diagrams.md`** — the conceptual mermaid diagram set, moved out of the
  README and kept as explanatory reference.

### Changed
- README rewritten for readability (390 → 165 lines, one hero figure).
- AUDIT depth scales by mission class (M0 deterministic verdict, M1 samples, M2 re-runs all).
- Final-deliverable critic panel trimmed 3 → 2 lenses (criteria-conformance duplicated correctness).
- Renamed `/mission-accept` → `/mission-log-audit`, broadened from one-mission capture to a
  standing log audit.

### Fixed
- Executor crashed on string-delivered `args` — defensive `JSON.parse` on both sides.
- Closure-record timestamp placeholders (`00:00:00Z`) and PowerShell verifier-quoting retries.

### Deferred / not yet wired
- Subtree replan, the §3.3 gate-critic rebuttal, the audit → punchlist → fix loop, worktree
  fan-out, and full multi-round cold-reviewer rotation.

## [0.1] — 2026-06-08

- Initial framework: agent constitution, plan/record/cap schemas, `/mission` + `/evolve` skills,
  the Claude Code reference executor, and the token-frugal cold-reviewer rotation (§3.4).
