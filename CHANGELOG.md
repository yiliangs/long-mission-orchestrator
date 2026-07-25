# Changelog

Notable changes to long-mission-orchestrator. Format follows [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

### Changed
- A missing repository mission contract is now instantiated automatically from a deployed baseline, then specialized only with directly evidenced checks, risk surfaces, observation gaps, boundaries, and resource facts.

## [1.0.0] - 2026-07-24

Breaking simplification of the active mission runtime.

### Changed
- Replaced the 7,995-word V/R/M constitution with a compact cross-cutting authority.
- Migrated plans to schema 1.0 with claim-observing `machine`, `measured`, and `human-deferred` witnesses.
- Replaced classification, review-tier, budget, evolution, record, and mailbox machinery with a small DAG executor and one fresh final audit.
- Restored the core lifecycle: load, grill, plan fight, freeze, recover, execute, audit, and deliver.
- Made committed node closures the recovery source and bound resume to an explicit completed-node map.
- Expanded the deterministic validator to enforce local `$ref`, lengths, patterns, item counts, and numeric bounds.
- Made deployment remove retired runtime surfaces so `agent-constitution.md` is the single active authority.
- Extracted repository mission contracts from auto-loaded `CLAUDE.md` files into the fixed `.mission/contract.md` location.
- Reduced the constitution to non-negotiable invariants and made `skills/mission.md` the sole owner of lifecycle procedure.
- Pruned mission contracts to checks, critical paths, machine-blind properties, and mission-only boundaries.
- Made the plan schema the sole representation contract and the executor audit the canonical integrated audit.
- Removed the stale machine-profile dependency from `/mission`.
- Reconnected heartbeat recovery to the constitution, repository contract, completed-map executor call, canonical audit, and the full bounded recovery tool set.
- Made deployment verify every copied file byte-for-byte and aligned deferred-witness and audit-finding result shapes.
- Made schema validation fail closed for every document; removed the retired 0.1 warn-only carve-out.
- Added committed recovery checkpoints for read-only batches so every completed node can be reconstructed without rerunning committed mutations.
- Made heartbeat task identities repository-unique, verified Task Scheduler registration, and bound liveness to the exact driver PID and process start time.
- Removed the unsupported POSIX deployment surface and stated the active unattended runtime's Windows requirement.
- Added a canonical `VERSION` file and deployed version marker for 1.0.0.

### Archived
- Moved the 0.5.1 V/R/M runtime, schemas, evolution system, Codex draft, diagrams, proposals, and mailbox channel under `legacy/0.5.1/`.
- Preserved the superseded constitution at `docs/archive/agent-constitution-v0.5.1.md`.

## [0.5.1] — 2026-07-03

Mechanization release: the 0.5.0 problem-solving amendments wired into the mechanism and
skills. **Constitution text unchanged except the version header** (bumped so run-records
partition regimes — executor semantics changed). All seven approved items:

### Executor (`executors/mission-executor.workflow.js`)
- **Rung 0 made mechanical**: `closure_record` gains optional `artifact_digest` (identity of
  the artifact the check observed); the micro-loop stops when the digest is unchanged across
  a retry — a constant digest while claiming fixes IS the disconnected oracle (thumbnailbar's
  five stale-binary rounds, tier012's /tmp false green), and the node still gates at R2.
- **`ac_amendment_proposed` actor outcome** (§6.1 anti-goal-erosion): structured
  `{ac_id, as_written, proposed, why}`; never self-closes (no closure ⇒ fresh critic fires);
  injected after the gate-fix loop as a recorded accepted-major for the Human's morning veto.
  Ordinary accepted-majors whose citation resolves to a named AC now carry `ac_related: true`
  (deterministic) so §7 can count where goal erosion concentrates.
- **`improve_stance:"refute"`** plan flag: the improver attacks the *approach* at draft time
  on approach-bearing nodes — the only pipeline position where thinking errors are cheap to
  change (corpus: post-freeze gates only ever caught execution errors).
- **Cannot-clause in the shared context pack**: lacking the tool/evidence/option, say so —
  "inventing the appearance of success is the one unforgivable output" (secretary-hallucination
  class); same clause added to all three `mission_mailbox.py` role prompts.

### Skills & card
- `mission.md`: **instrument-first rule** in machine-blind zones (instrument node → V1-closing
  implementation node; no instrument ⇒ V3-deferred at PLAN, never discovered at the smoke);
  GRILL gains the **"beyond done"** stretch-criteria question; refute-stance and
  ac-amendment noted at PLAN/EXECUTE.
- `mission-log-audit.md`: **correction → check mining** (Tier-3's first job): every
  correction-classified human-diff is asked "is this expressible as a runnable check?" —
  yes ⇒ draft it into the target repo's verifier registry as a draft PR.
- `operating-card.md`: cannot-clause (either role), `artifact_digest` in the closure shape,
  ac-amendment outcome for actors. (+~0.6 KB, worker-facing rules only.)

### Schema (`mission-record.schema.json`, additive)
- `nodes_executed[].ac_amendment`; `budget_planned_vs_actual.overrun`/`overrun_policy`
  (aligning with the 0.4.2 executor); **`human_review` now allows extension keys** — the gold
  signal is never again rejected for being richer than the schema (fixes the two INVALID
  most-reviewed records; all five regression records validate).

## [0.5.0] — 2026-07-03

Transcript-grounded amendment batch: three evidence readers swept all 19 run-records, 18
run dirs, the full heartbeat log, and 16 session long-logs; every change cites its runs.
Net size: the constitution **shrank 564 bytes** (58,005 → 57,441) — additions paid for by
cuts. Rule changes: comparability partitions at 0.5.0.

### Changed
- **§11 heartbeat demoted from pilot to watchdog.** Field record: 0/5 autonomous resumes
  produced mission progress; the same death escalated ~34 times over 21.5h
  (2026-07-02-salary-atlas); beats fired after claimed self-disarm. New job: detect death
  fast, escalate once, leave a prepared one-tap relaunch command; the Human arms (the
  classifier denies agent-side `schtasks`); disarm is verified; the "absorbs every death
  mode" claim is removed as unearned.
- **§12 DELIVER closes like a V1 node** — `validate_record.py` bound as the check on both
  record and report, the stamped cap-log line part of the same close, failure ships as a
  top-of-report alarm. (Evidence: 3 schema-invalid records, 4 run dirs with no REPORT.md,
  the one budget-DIVERGED run absent from the cap log.)
- **§6.1 rung 0: verify the loop** — the check must observe the artifact that ships
  (tier012 `/tmp` false green; thumbnailbar's five smoke rounds against a stale binary);
  mirrored into the §2.1 closure-record binding and the operating card.
- **§6.1 anti-goal-erosion clause** — an AC unmeetable as written is
  `plan_assumption_false` or a written accepted-major narrowing, never a quiet reword.
  (4 runs closed ACs on narrowed readings; 13 accepted-majors in salary-atlas; zero
  `plan_assumption_false` ever emitted across 18 runs.)
- **§2.4 M-class honesty** — the script guards the M0/M1 floor; judgment supplies M2
  (0/6 observed M2 classifications came from the script gate).
- **§6 matched to observed reality** — punchlist: capped audit cycles or a
  Human-commissioned follow-up mission (the proven pattern); the question log struck from
  DELIVER (0/18 runs produced one; nothing consumed it).
- **§3.2 evidence defined** — diff, committed artifact, or check transcript; narrative
  prose alone is not evidence (3 runs closed on prose-only evidence); mirrored to card.

### Tightened (paying for the additions)
- §1.5 perimeter shadow-list reduced to category names + §9.1 pointer (single source).
- §5 compressed to one paragraph; §6 GRILL block reduced to a §4 pointer; §3.4
  token-discipline and §3.5 provenance paragraphs compressed; §6.4 duplicate R0 line cut;
  §6.5 rationale compressed; §3.6 round-up paragraph collapsed to a §2.2 citation; §10
  heading de-forked.

## [0.4.4] — 2026-07-03

Second `/prune` pass, this time on the constitution itself. Non-normative text only — no
rule changes; non-comparability-breaking (aggregates with 0.4.2/0.4.3).

### Removed
- **§6.4** salary-atlas provenance parenthetical — the full story (run, ceiling, human
  directive) lives in this changelog's 0.4.2 entry; history belongs in the changelog and
  git, not the governing body (§13's own doctrine).
- **§12** dead "(v0.1 — expected to evolve)" tag on the report format — the format already
  evolved in place (plain layer, decision ledger); the tag tracked nothing.

### Changed
- **§6.2** "Review per a-c task" row compressed to a §3.1 pointer plus its one real number
  (R2 spot-check ≤5 reads) — the row restated the V→R floors and would silently drift
  whenever §3.1 moves.

## [0.4.3] — 2026-07-03

Doc-hygiene release from a `/prune` audit of the whole doc tree. Clarifications only — no
rule changes; non-comparability-breaking per evolution.md's amendment split, so records may
aggregate with 0.4.2.

### Changed
- **§6.4 size claims corrected**: operating card ~1–2 KB → ~5 KB (actual 4.8 KB);
  constitution ~26 KB → ~57 KB (actual 58 KB). Descriptive only.
- **`schema/cap-log.format.md` rewritten to match the real feed**: one line per mission at
  DELIVER (was: one line per node-cap-hit), `cap_hits[]` entries carrying
  `would_have_converged`, `<cap>_used`/`<cap>_cap` pairs, budget planned-vs-actual; cap enum
  extended with `gate_fix_cycles`, `token_budget`, `agent_budget` (the corpus already uses
  them); legacy line heterogeneity documented; append-only preserved.
- **Tier-2 thresholds single-sourced**: `docs/evolve.md` now cites cap-log.format.md instead
  of restating the raise/lower numbers; `docs/evolution.md` §Triggering deduplicated to
  diagram + pointer (evolve.md is the procedure authority).
- **Stale refs fixed across the tree**: README status v0.3.x → v0.4.x and the superseded
  0.4.2 budget row annotated; `/evolve apply` → email GRANT router in `proposals/README.md`;
  `skills/mission.md` heartbeat arming corrected to a Human action (the permission classifier
  denies agent-side `schtasks`); stale constitution-size figures in `skills/mission.md`;
  drifted `mission_heartbeat.ps1` line cites in `skills/mission-loop.md` replaced with stable
  function/marker anchors.
- **Deferred (flagged, not changed)**: §3.6 hard-codes "Opus" as the top tier while the
  principle says "strongest model" — to be amended at the next capability re-baseline
  (evolve.md already anticipates Opus→Fable).

## [0.4.2] — 2026-07-03

Budget-overrun release, born from §7 post-session intake: the 2026-07-02-salary-atlas M2 run
halted at its 2M token ceiling with 14/20 nodes done and the entire deliverable tail (blend,
fact-checks, explorer, QA, assembly) unopened — a DIVERGED(budget) that cost a human
round-trip solely to grant more budget. Human directive: "If budget is over estimation, keep
running, just mark the budget overrun into final results."

### Changed
- **§6.4 budget semantics: continue-and-mark, never halt.** The mission budget
  (`token_budget` / `agent_budget`) is an **estimate and reporting tripwire, not a
  kill-switch**. Overrunning it never stops node-opening, never sheds quality passes
  (improver, gate-fix cycles), never truncates a gate. The overrun is marked in the final
  results: mission-level `cap_hit`, explicit `budget.overrun` in the run-record, a prominent
  report line, and a decision-ledger row. Runaway protection is §6.3 progress-based
  divergence plus the harness's absolute spawn cap.
- **§6.3:** budget exhaustion removed from the divergence definition — divergence is a
  lack-of-progress verdict only.
- **Executor (`executors/mission-executor.workflow.js`):** wave-granularity budget halt
  replaced with a one-time overrun log; budget guards removed from the improver and gate-fix
  loops; verdict no longer keys off budget state; `budget.overrun` + `overrun_policy` added
  to the budget report. (Line endings normalized CRLF→LF — required by the Workflow
  permission layer.)
- **`schema/mission-plan.schema.json`** `token_budget` / `agent_budget` descriptions and
  **`skills/mission.md`** PLAN/EXECUTE budget language aligned.

## [0.4.1] — 2026-06-28

Coverage-honesty release. Closes the gap a `/mission-log-audit` diagnosis surfaced: a machine
check can be *executed, passing, and recorded* (§2.1) yet **blind to the property the node
claims** — webshot green while "the window doesn't jump" / "the bar is concentric" went
unverified. Two web-overlay missions (thumbnailbar freeze, commandbar's six in-Rhino rounds)
re-hit the same class because the failure corpus recorded yesterday's *organ*, not the *class*,
and nothing made "measure before claiming" a close-condition.

### Added
- **§2.1a Coverage honesty (the check must exercise the claim).** A passing check only
  licenses the property it actually exercises; in a per-repo **machine-blind zone** (runtime,
  rendered geometry, thread/timing) a green-but-blind check is never a close — the node carries
  a **measured assertion** or ships a `V3-deferred: <property>` open item in the defect ledger
  (visible, not blocking). The §2.1 audit question "was the check sufficient" gains a close-time
  twin.

### Changed (fieldnotes synth — the failure-mode corpus)
- **Binding-rule capture is now class-first, filtered, promote-not-append.** `schemas/
  project_card_schema.md` + both synth paths (`synthesizer.py`, `rebuild_cards.py`) now record
  a binding rule only if it passes a filter (non-derivable · live · costly-or-recurring ·
  checkable) and at the **smallest non-derivable class** that stays checkable — organ-specific
  symptoms of one cause are promoted into a single class rule (`(instances — …)`), not appended
  as siblings. Keeps the always-on list small *and* covering organs not yet hit.

Builds on 0.4.0 (unreleased in this changelog).

## [0.3.6] — 2026-06-12

Audit-follow-up release, closing three gaps a post-mission audit surfaced: a disclosure gap
(Tier 0), an un-built mechanism the prose already claimed (Tier 1), and an unnamed systematic
weakness (Tier 2). Theme: **the document must match the runtime, and the runtime must match
the document** — a "must be fixed otherwise" with no fix loop, and an "additive only" read as
"append-only," were both prose writing checks the machinery did not cash.

### Added
- **Gate-fix loop wired into the executor (Tier 1, §3.3 / §6.1).** §3.3's "a blocker must be
  fixed or replanned otherwise" is now a **built mechanism**: a valid blocker (or surviving
  major) at the gate re-dispatches the actor with the findings, re-runs the effective-tier
  critic, and re-adjudicates — capped (`gate_fix_cycles`, default 2) and strictly
  non-regressing (adopt only on lexicographic progress; discard a failed/empty/non-improving
  revision so the node never regresses). Surviving blockers still file to the Human as the
  sole waiver authority (§9.3); surviving majors close accepted-with-reason, each carrying a
  written reason. Implemented in `executors/mission-executor.workflow.js` (gate-fix loop after
  `adjudicate()`; per-major reason at close).
- **Three verification scopes named (Tier 2, §2.3a).** The constitution now names **verify**
  (per-item), **judge** (cross-item adjudication), and **audit** (whole-mission) as three
  non-collapsible scopes, with the rationale stated: merging any two recreates the
  correlated-checker failure (§2.3) — one viewpoint wearing three hats, one shared blind spot
  passing all three gates green. This is the systematic weakness the audit named.
- **Git-additive vs content-level distinction (§1 principle #5).** One line distinguishing
  **git-additive** (the §9.1 perimeter — never merge/force-push/delete-branches/tag, the
  load-bearing safety rule) from **content-level editing** (modify-in-place, consolidation,
  and delete-and-replace are *preferred* over accretion; the codebase is **not** append-only).
  Cross-refs the Tier-3 deletion pattern (§0.2, docs/evolve.md). Conflating the two grows cruft
  and is itself a defect.

### Changed
- **README gate-fix disclosure corrected + 'scales absence' identity promoted** — the README
  no longer overclaims a loop that did not exist; the gate-fix mechanism is described as built,
  and the "the framework scales the *absence* of ceremony as deliberately as its presence"
  identity is promoted to a first-class framing.
- **Constitution 0.3.5 → 0.3.6** — the three additions above (§1 #5, §2.3a, §3.3) plus this
  version bump. Strictly surgical; no unrelated section rewritten.

### Fixed
- **Executor parse-gate regression (integration follow-up).** The Tier-1 node had changed
  `export const meta` → `const meta` in `mission-executor.workflow.js`, reasoning that the
  `export` broke `node --check`. The opposite is true: `export` is the marker that makes Node
  (>=22.7) parse the file as a module so its top-level `await` is legal — and it is also the
  form the Workflow harness requires to read `meta`. Without it the file is CommonJS, where the
  top-level `await` is a `SyntaxError`, so the parse gate the node closes on actually FAILED
  while the node self-certified it green (a §2.1 false close — the §2.3a correlated-self-verify
  trap, ironically the weakness this release names). `export` restored; `node --check` exits 0.
  The Agent-contract note (CLAUDE.md) and the top-of-file comment that asserted the wrong
  reasoning are corrected.

### Added (telemetry)
- **Gate-fix yield telemetry (§3.3 / §7).** So the new loop can pay rent in evidence (§0.2),
  `nodes_executed[].gate_fix` now records `{cycles, adopted, blockers_resolved, majors_resolved,
  terminal}` per node (emitted only when the gate carried findings); `cycles - adopted` is the
  waste signal. `cap_hits.cap` admits `gate_fix_cycles`. The executor surfaces this in each node
  result, snapshotting before the cold-reviewer so cold-caught findings don't pollute the counts.
  Without it, Tier-2 calibration could not measure whether the cap pays rent or should be
  down-ratcheted.

## [0.3.5] — 2026-06-12

Self-knowledge release, from a second external audit ("does this deserve to live now that
Fable one-shots?"). The audit's survival analysis was adopted; its prescription (compress
now) was rejected as forecast-driven — by the repo's own epistemology, shedding is licensed
by records, not essays.

### Added
- **Constitution §0 "Two halves with opposite fates"** — names the capability-invariant
  policy core (V-ladder + truth-source asymmetry, close-time binding, perimeter,
  evidence-class reporting, human-diff loop) vs the capability-tuned mechanism (caps, retry
  loops, improver passes, tier/class ceremony defaults) that is *expected to deflate* via
  calibration. Less ceremony never means less evidence.
- **The deletion pattern (docs/evolve.md, docs/evolution.md)** — Tier-3 previously only knew
  how to tighten; now: a ceremony element with zero yield across ≥10 same-version missions is
  a machine-evidenced removal candidate (§2.2-licensed down-ratchet). Plus a capability
  re-baseline rule: yield stats partition by model generation; a generation change stales
  them — never keep ceremony alive on catches an older model needed.

## [0.3.4] — 2026-06-12

Surface-contraction release, from the Human's first principle: **the feedback surface is
exactly two channels** — one passive (the two-way §12 email loop), one active
(`/mission-log-audit`). Everything else is internal machinery.

### Hardened (same-day, from an external audit — constitution text unchanged)
An independent reviewer cloned the repo and audited it; the points that survived verification
(several were stale — fixed in 0.3.2 — or traced to outdated README claims) landed as:
- **Email router allowlisted** — the verdict/proposal routers ran `claude -p` under
  `bypassPermissions` + a deny-list; reply bodies are untrusted input, and blacklisting an
  LLM's action space against injection is the wrong polarity. Now each router gets a per-kind
  tool **allowlist** (telemetry-scoped edits, path-scoped git, validators); the §9 deny shapes
  remain as backstop.
- **Glob-aware overlap matching** — deliverable-zone checks (executor ×2, classifier) and the
  parallel-disjointness check used substring/equality matching: write_set `src/**/*.cs` vs zone
  `src/ui/` silently missed the V2 floor. All four sites now use a conservative glob-overlap
  (`_globOverlap`) that errs toward raising ceremony.
- **Blocker citations must resolve, not merely exist** — `adjudicate()` only checked that
  `cited_criterion` was non-null; a confabulated citation passed. Now it must match a
  constitution clause (`§N.N`) or one of the node's named acceptance criteria, deterministically,
  or the blocker demotes to major.
- **`check_source: registry | ad-hoc` at close-time binding** — which check closes a V0/V1 node
  is itself a judgment hiding inside the mechanical tier. Actors must declare whether the bound
  check came from the repo contract's verifier registry; **ad-hoc self-closures are
  force-included in the AUDIT judge-sample** (adequacy judged, not sampled by luck). Recorded in
  the run-record (`nodes_executed[].check_source`).
- **README status section rewritten** — it still said "no mission has run under v0.2," which
  misled the auditor into "zero empirical evidence" (8 validated run-records exist). Now states
  the actual corpus and adopts the honest narrower pitch: a disciplined overnight draft
  generator with an audit trail; V2 machinery is attention compression for the human's morning
  review (which §2 already said).

### Added
- **§12 two-channel principle** — codified as the opening of the Reporting section; a third
  human-facing feedback surface is a design defect, not a feature.
- **§7 post-session talk is intake** — when the Human raises a mission-attributable issue in
  conversation after delivery (a role that didn't do its job), that conversation is amendment
  evidence with the same standing as an email verdict: captured into the run-record at the
  time, allowed to seed proposals. Strictly scoped to talk about the mission's work.
  (0.3.3 and 0.3.4 were both born this way.)
- **`/mission --resume <run-id>`** — manual recovery of a dead mission. Re-enters the
  orchestrator at EXECUTE (never the bare executor, which would skip AUDIT/DELIVER and
  produce an unreported mission): one-driver check against the §11 heartbeat, completed-node
  frontier reconstructed from committed evidence only, executor dispatched with its
  documented `args.completed` resume contract.

### Changed
- **`/evolve` demoted from command to internal procedure** (`skills/evolve.md` →
  `docs/evolve.md`; removed from `~/.claude/commands/`). Evidence: three constitution
  amendments shipped this week, none via /evolve — the live amendment path is conversation
  under §13. What remains real is machinery, not a command: Tier-2 calibrate now fires from
  the `/mission-log-audit` cadence when due; `apply` fires from the email GRANT router. The
  human command surface is now /mission (work) + /mission-log-audit (review).

## [0.3.3] — 2026-06-12

Reader-side protocol release, driven by the Human's review of the first live §12 email
round-trip. The 0.3.2 theme was "a signal that exists only as prose does not exist for
calibration"; this release is its mirror: **a signal the Human cannot read does not exist
for calibration either.** Three changes, all from direct human feedback.

### Added
- **Plain layer first (§12)** — anything addressed to the Human leads with a jargon-free
  layer (what happened, what needs you); the full evidence ledger follows below a divider.
  Layered, never cut — readability is not bought with information loss. V/R/M shorthand is
  translated in place when it must appear; exporting it raw to the Human is a defect, not
  rigor.
- **Decision ledger (§12, report schema)** — the mission-end report carries a filtered
  ledger of contested/boundary role decisions (*role → decision → against what → because*,
  rationale captured at decision time): boundary classifications, critic rejections +
  accepted-majors, escapes, tier floor-ups, budget crossings. Routine decisions compress to
  a visible suppressed-count line so omission is auditable; every 5th mission ships
  unfiltered so the filter itself is audited. Plan schema gains `v_class_rationale`;
  report schema gains `plain_summary` / `decision_ledger` / `decisions_suppressed`.
- **`scripts/diff_overlap.py` (§7)** — deterministic corrective/non-corrective split of the
  human-diff: a post-delivery commit is correction-shaped iff it modifies/deletes
  mission-authored lines (git-blame overlap against the mission commit set). The audit
  presents the machine stat as a pre-verdict to confirm or override — never an open "was
  this a correction?" question (block-hygiene's branch-recovery commit cost an email
  round-trip to disambiguate exactly this; the script reproduces that verdict in seconds:
  13 post-delivery commits, 0 mission-authored lines touched).

### Changed
- **Record schema 0.2 → 0.3** — `human_review` gains `human_diff_classification`
  (correction / continuation / housekeeping / mixed / none) + `human_diff_overlap`
  (the machine stat, with `confirmed_by_human`). Only a correction-class diff licenses
  reading the human-diff as a verification gap.
- **`/mission` DELIVER, `/mission-log-audit`, mailbox verdict router** — updated to compose
  the plain layer + decision ledger, run the overlap pre-classification, and route confirmed
  classifications into the record.

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
