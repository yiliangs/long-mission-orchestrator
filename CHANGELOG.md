# Changelog

Notable changes to long-mission-orchestrator. The version tracks the governing constitution
version (`docs/agent-constitution.md`). Format follows [Keep a Changelog](https://keepachangelog.com).

## [0.3.2] — 2026-06-11

Hardening driven by the first four v0.3.1 missions (web-ui-port, jobe-submit-audit, and the
natalie transition pair). The machinery held — layered defense caught a silent-ship defect,
FIGHT killed a would-have-shipped blocker, deferral discipline was exemplary — but the
**telemetry pipeline leaked**: the record schema was unsatisfiable, two runs skipped their
records entirely, and a budget-ceiling breach reached the report only as prose. The theme of
this release: **a signal that exists only as prose does not exist for calibration.**

### Added
- **`schema/mission-report.schema.json`** — `report.json` (§12) gets a schema; the first two
  v0.3.1 runs disagreed on field names (`ask` vs `item`) within the same day. Canonical field
  is `needs_you[].ask`.
- **`scripts/validate_record.py`** — stdlib-only validator (the JSON-Schema subset the LMO
  schemas use) so "schema-validated" is an executable claim. Wired into the DELIVER step as a
  **hard, unconditional** gate; records with `schema_version` 0.1/absent are warn-only legacy.
- **External-resource preflight (§6 PLAN)** — any AC naming a fetchable external resource is
  reachability-probed before FREEZE; never freeze an AC the executor provably cannot meet
  (jobe froze "LIVE GfA" against a page that 403'd to agents).
- **write_set enforcement (§6.5, executor)** — deterministic diff-vs-declaration check at node
  close; an out-of-set write raises a **machine-evidence blocker** (human-only to waive). The
  jobe run's out-of-write_set `backmatter.tex` edit was honest but ad hoc; now it's gated.
- **HTML email rendering (`scripts/md2html.py`)** — the §12 channel rendered reports as escaped
  raw markdown in monospace; now a stdlib markdown→HTML converter (inline CSS, email-safe:
  headings, tables, lists, code, blockquotes, links) with the raw md retained as the
  text/plain fallback.

### Changed
- **Record schema 0.1 → 0.2** — v0.1 was *unsatisfiable*: `nodes_executed` was required but
  undefined under `additionalProperties:false`, so validation could never pass — which is why
  it never ran and records drifted. v0.2 defines `nodes_executed` and adopts the telemetry
  blocks the v0.3 constitution requires but the schema predated: `compute_tiers` (§3.6),
  `r_tier_escape_outcomes` (§7), `escalation_precision` (§3.3), `budget_planned_vs_actual`
  (§6.4), `audit`. `cap_hits.cap` gains `token_budget` / `agent_budget` (node sentinel
  `"mission"`).
- **§6.4 budget semantics** — a ceiling crossed mid-wave (in-flight nodes completing) is
  sanctioned but never silent: the executor logs the crossing and records a mission-level
  `cap_hit`. The jobe overrun (38/36 agents) reached the report only as prose — invisible to
  §7 calibration.
- **§12 reporting** — the run-record is a DELIVER step, not a courtesy: re-scoped, lean-pivoted,
  and human-interrupted missions still write + validate records (the natalie pair, both
  governed by 0.3.1, wrote none — and their pending human verdicts had nowhere to land).
- **Constitution 0.3.1 → 0.3.2** — the four amendments above.

### Fixed
- **Fieldnotes corpus repaired** — jobe + web-ui-port records now validate (jobe's agent-budget
  breach backfilled as a `cap_hit`; web-ui-port's missing `human_review` block added); minimal
  v0.2 records backfilled for the two natalie runs (transcribed from REPORT.md + plan.json) so
  `/mission-log-audit` verdicts have a landing file.

## [0.3.1] — 2026-06-10

Compute tier as the third frozen dial, and a sharper heartbeat futility signal. Both fall out
of the same principle the project keeps re-deriving: **a cost-reducing choice is only safe where
a wrong answer has no uncaught consequence — and when it's blurry, round up.**

### Added
- **Compute tier R-tier sibling (§3.6)** — model intelligence tracks stake of judgement, a
  per-node `model_tier` (+ `model_rationale`) frozen in `plan.json` beside V-class and R-tier.
  The strongest model is the default; a weaker one is permitted only where the wrong answer is
  caught downstream. Floors are assigned **per role**, derived from V-class: every gating critic,
  the cold verifier, AUDIT, and the final-deliverable actor are **always Opus** (the model *is*
  the gate); a **V0/V1 actor floors at Sonnet** (the binding closure record, not the model,
  defines correctness); the advisory improver floors at Sonnet (backstopped by the gate that
  follows it). **Haiku is opt-in, never derived** — a V0/V1 actor drops to it only with a
  rationale asserting information-preserving transport. A **failed V0/V1 close rounds the retry
  up one tier**. The executor floors any below-floor request up and logs it; FREEZE shows the
  model histogram beside the R-tier histogram; `compute_tiers` lands in the run-record for
  escape-rate calibration (§7). Economically self-placing: gates are the minority of spawns,
  descent-eligible actors are the mass, so Opus lands on stake and the savings land elsewhere.

### Changed
- **Constitution 0.3 → 0.3.1** — new §3.6; the model-tier dial threaded through `/mission`
  (PLAN node fields, the go-gate model histogram, run-record telemetry).
- **Plan schema** — adds node-level `model_tier` + `model_rationale` (additive; absent ⇒ executor
  uses the role floor, so 0.3 plans run unchanged).

### Fixed
- **Heartbeat futility detector keyed off transcript noise (`scripts/mission_heartbeat.ps1`).**
  The 0.3 one-futile-resume cap compared progress against `$newest`, which folded in the session
  transcript's mtime — but a resumed `claude` dirties its transcript just by loading and echoing
  the prompt, even when it makes zero mission progress. So an unproductive-but-churning resume
  looked like progress and slipped past the cap to the RunawayStop=20 backstop (the cousin of the
  original 23-firing loop). Split the signal: `$artifactMark` (run-dir artifacts minus
  bookkeeping, **transcript excluded**) now drives futility; `$newest` (incl. transcript) still
  drives staleness. The exact observed failure stays capped at one futile resume, and the churn
  cousin now trips the same cap. Parse-clean.

## [0.3] — 2026-06-10

Token frugality as a design principle, review depth as a dial, and recovery plumbing separated
from work-quality machinery. Driven by the §11 resume-loop incident (23 futile overnight
firings) and the grilling that followed it.

### Added
- **Review tiers R0–R3 (§3.1)** — review depth becomes a per-node dial beside V-class and
  M-class: R0 adversarial self-audit (two-phase actor prompt, rides the actor's own cached
  context), R1 spec-blind diff review (raw diff, no actor narrative), R2 cold-eye + bounded
  ≤5-read spot-check, R3 lens panel. **V→R floors bind in the constitution body** (V0/V1-closed
  ⇒ R0 permitted; V2/outward ⇒ ≥R2; final deliverable ⇒ R3); above the floor the planner has
  full discretion with a one-line `review_rationale` per node, an R-tier histogram at the FREEZE
  go-gate, and per-node **escape-rate telemetry** in the run-record so cheap tiers are validated
  on evidence.
- **Mission budget (§6.4)** — dual ceiling frozen in `plan.json` at PLAN: `token_budget`
  (executor-observable output tokens via the Workflow `budget` global) + `agent_budget` (total
  spawns — the proxy for the cache-read fan-out cost the token meter can't see). Exhaustion is
  a **divergence** (§6.3): no new nodes, in-flight nodes close, AUDIT runs, verdict
  `DIVERGED(budget)`; never a mid-node kill, never a skipped gate. Planned-vs-actual lands in
  the run-record for class-default calibration.
- **Canonical context pack (§6.4)** — the executor puts a byte-identical shared prefix
  (operating card pointer + mission facts + plan summary) at the top of every spawn's prompt so
  agents after the first hit the prompt cache; actors return **pushed evidence** (raw diff +
  files touched) that reviewers judge from directly. Kills the "spawn a bunch and each one reads
  from the start" cost shape — and incidentally strengthens the gate: critics previously judged
  from the actor's narrative summary alone, with no diff at all.
- **Per-invocation Workflow grant for headless resume (§11)** — the heartbeat's `claude` lines
  carry `--allowedTools "Workflow"`, scoped to the single invocation, so a resumed mission can
  actually re-dispatch the executor (all 23 incident resumes were structurally futile without
  it). Authorized by the human at launch — arming the heartbeat is part of the launch they
  approve; no standing `settings.json` grant.

### Changed
- **Constitution 0.2 → 0.3** — §3.1 rewritten as the R-tier ladder + floors; §3.2 fresh-context
  rule scoped to *gating* critics (R0 gates nothing — the closure record is the gate); §6.3/§6.4
  budget-exhaustion-as-divergence + the context-pack discipline; §11 rewritten (below).
- **§11 resume semantics: futility-only (resume is plumbing, attempts are work-quality).**
  Recovery resumes are **uncounted** — a mission spanning N usage windows legitimately resumes N
  times; the invariant is "a stale heartbeat survives at most one *futile* firing." The
  `-MaxResumes 3` total cap from the initial fix conflated recovery plumbing with work-quality
  bounds (which belong to the executor, §6.2) and would have killed legitimate multi-window
  missions; replaced by one-futile-resume → disarm + `heartbeat.dead`, plus a `-RunawayStop 20`
  hard brake documented as insurance against a fooled progress detector, not policy. Smoke-tested:
  futile → disarm; productive 4th resume → proceeds; 20 resumes → runaway disarm.
- **Plan schema 0.2** — adds `token_budget`, `agent_budget` (mission level), `review_tier` +
  `review_rationale` (node level); still accepts 0.1 plans (executor derives R floors when
  `review_tier` is absent).

### Earlier in this batch (committed 2026-06-10 before the grilling)

### Added (pre-grilling)
- **§11 heartbeat plumbing** (`scripts/mission_heartbeat.ps1`) — the constitution described the
  orchestrator-armed auto-resume abstractly, but no concrete implementation existed; the first M2
  mission (`natalie-fable-revision-20260609`) died at the usage limit mid-PLAN with nothing armed
  and had to be resumed by hand. `arm` writes `mission.lock` + registers `LMO\Heartbeat-<run-id>`
  (per-run scheduled task through `run_hidden.vbs`, every 30 min); each `beat` is idempotent
  (active → exit; stale ≥45 min → `claude --resume` headless from committed state, queued shape;
  complete/absent marker → self-disarm); `disarm` removes task + markers. Resume runs under the
  default permission mode — pre-granting autonomy stays a human settings action.

### Changed (pre-grilling)
- **`/mission` arms at PLAN, not FREEZE** — §11 says arming happens at launch; a session that
  dies grilling or fighting cannot schedule its own resurrection. The arming step now carries the
  concrete `mission_heartbeat.ps1 arm` / `disarm` commands.
- **FIGHT-phase critics are now provisioned frugally** (`skills/mission.md` §3) — the operating-card
  discipline lives in the EXECUTE-phase workflow and never reached the plan-critics `/mission` spawns
  directly, so they re-read the full 36 KB constitution and free-crawled the repo. They now carry the
  operating card, read only `plan.json` + `brief.md`, and bound repo exploration to a spot-check
  budget against the paths a node actually names.

### Fixed (pre-grilling; resume-cap semantics superseded above)
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
