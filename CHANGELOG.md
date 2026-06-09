# Changelog

Notable changes to long-mission-orchestrator. The version tracks the governing constitution
version (`docs/agent-constitution.md`). Format follows [Keep a Changelog](https://keepachangelog.com).

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
