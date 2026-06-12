# Self-evolution — how it actually works

The framework improves itself through three nested loops (constitution §7). This doc is the
**implementation**: what writes what, what reads what, what triggers what. The design
principle throughout: *the system evolves on evidence, never on vibes, and the human is the
merge authority at every tier above doing-the-work.*

## The data backbone

Evolution is only as good as the record it learns from. Three artifacts, written during a
mission, are the entire substrate:

| Artifact | Written when | By whom | Schema |
|---|---|---|---|
| `mission_records/<run-id>.json` | at DELIVER | orchestrator, **not synthesized** | `schema/mission-record.schema.json` |
| `mission-caps.jsonl` (append) | at DELIVER | orchestrator | `schema/cap-log.format.md` |
| `human_review` block of the record | when you review | `/mission-log-audit` | (same record) |

All three live in **claude-fieldnotes** (telemetry repo), synced across machines, so both
the light box and the 5090 feed one dataset. The governance repo (long-mission-orchestrator) holds the
*rules*; fieldnotes holds the *evidence*. Never mix them.

### The gold signal

The single most valuable field is `human_review.human_diff_stat`: the diff between what the
mission **delivered** and what you **accepted**. It is the only ground truth for where the
framework misjudged — everything else is the framework grading its own homework. This is the
same epistemology as the ml-literacy consolidation protocol: *the diff is the evidence.*
`/mission-log-audit` **pushes** this capture to the Human on a cadence (§7 active intake) — it is
not awaited — so the loop is never blind merely because the Human forgot to review. Human
attention is the scarcest resource; the system batches what it needs and pulls it, rather than
depending on the Human to initiate.

## Tier 1 — Missions (per goal)

Just running `/mission`. Each run emits the records above. No evolution here; this is the
data-generating layer.

## Tier 2 — Calibration (every ~10 missions)

Numeric, cheap, narrow: tune the cap table (§6.2).

```
mission-caps.jsonl  ──filter by constitution_version──▶  per-cap stats
                                                          (p95 used, %-hit, would-converge rate)
        │
        ▼
Tier-2 calibrate  ──▶  proposed diff to §6.2 cap table  ──▶  you approve  ──▶  version bump + redeploy
```

Most of this is deterministic arithmetic over the jsonl; the model only judges the margins.
The heuristics live in `schema/cap-log.format.md`. The count-vs-hours question we left open
resolves itself here — the log *shows* which caps bind wrongly.

### Classification calibration — the V/M dials (record-and-match)

The naive orchestrator sets two depth dials, V-class (per node) and M-class (per mission,
§2.4), from static gates. Static gates mis-fire: a node escalated to a critic that found
nothing was over-classified; a mission that "marched an army for an errand" was over-provisioned.
The `classification_calibration` block of each run-record is the **corpus** that lets these
dials sharpen with experience — the same record-and-match idea as cap-hit `would_have_converged`,
generalized to the class decisions.

Two parts, deliberately split by maturity:

- **Record (now, cheap).** Every mission stamps `mission_class` + the per-node/per-mission
  hindsight verdicts. The corpus is the irreplaceable asset (§10); you cannot match on data you
  did not capture, so recording starts on mission #1.
- **Match (deferred, the valuable part).** A matcher that biases a *new* classification from
  near-neighbours in the corpus ("tasks shaped like this were M0 the last five times") is built
  only once same-version N is large enough to beat the static gate — on an empty corpus it is the
  static heuristic with extra machinery. Same posture as the Codex adapter: specified, deferred.

**The load-bearing guardrail — truth-source asymmetry.** Mis-classification evidence is not all
equal, and the `may_lower` flags in the schema enforce the split:

| Evidence source | May license |
|---|---|
| `human_diff` / `machine_check` | **lower** a class (less ceremony next time) *and* raise it |
| `critic_opinion` ("didn't need the army") | **raise** a class, or **flag for the human** — never lower one |

A correlated model (§2.3) talking the system into skipping its own gates is the precise failure
§9.4 exists to prevent. So down-classification is gated to ground truth; up-classification is free
on any evidence — the §2.2 round-up asymmetry, carried into the learning loop. The matcher, when
built, inherits this: it may *demote* a class only on accumulated human/machine evidence, and may
*promote* on any signal including critic pattern.

## Tier 3 — Evolution (periodic / milestone)

Broad: read full run-records, find patterns that justify **rule** changes, not just numbers.

```
mission_records/*.json  ──▶  pattern detection  ──▶  amendment batch (each citing record ids)
   (human-diffs,                (verification gaps,        │
    escalations,                 escalation precision,     ▼
    replans,                     replan churn,          PERIMETER proposals split out
    accepted-majors)             accepted-major drift)     │
                                                           ▼
                                          present batch  ──▶  you approve  ──▶  edit constitution,
                                                                                bump version, commit, redeploy
```

Patterns → proposals (examples):
- human-diffs cluster on self-closed nodes → tighten close-time binding or add a V2 floor;
- blocker legit-rate falling → sharpen critic prompts / acceptance-criteria conventions;
- recurring `plan_assumption_false` on similar nodes → add a planning rule;
- a major accepted-with-reason every time → the criterion may be wrong (relax) or always
  recurs (add a check).

## Why "evolution is itself a mission"

The evolution review (docs/evolve.md — internal procedure, demoted from `/evolve` at 0.3.4) runs through the same plan → critic-fight → audit protocol. Consequences that fall
out for free:
- the evolution proposal gets **adversarially critiqued** before you see it (a critic that
  refutes weak amendments);
- proposals without cited records are **invalid findings** — same rule as everywhere;
- the deliverable is reviewed and merged by **you** — self-modification cannot self-approve.

## The corpus is the asset (and two honest corrections)

1. **The human-diff is a latent test suite, not just governance fuel.** The diff between
   delivered and accepted is the V2 oracle the framework keeps admitting it lacks — expressed
   as ground truth about *your* standards. Its highest use is **not** tuning the cap table; it
   is mining recurring edits into concrete **acceptance criteria and critic prompts**. So
   Tier-3's first job is *verifier construction from diffs* — turning "what you always fix"
   into checks the next mission applies before delivery. Cap-tuning (Tier-2) is the side dish.
   The accumulating corpus, not the constitution, is the irreplaceable asset (constitution
   §10).

2. **Statistical calibration is a scale claim, not a day-1 claim.** At N≈10–30 missions over
   months, "evidence, not vibes" is aspirational: few, noisy samples. Worse, the
   version-purity guardrail (never compare across constitution versions) means every amendment
   resets the comparable corpus toward zero — you cannot amend often *and* keep a large
   same-version sample. Honest resolution: (a) split **comparability-breaking** amendments
   (which reset the corpus) from **non-breaking** ones (clarifications, new fields — which do
   not), and reset only on the former; (b) early on, Tier-2/3 are a **qualitative human read**
   of individual records, not statistics — the statistical framing earns its keep only once
   same-version N is large. Until then the loop is disciplined reading of the corpus, and that
   is fine. Say so rather than dressing N≈10 as significance.

## Guardrails (because self-modifying systems have known pathologies)

1. **Batch** — one amendment batch per cycle. Constant churn destroys the run-to-run
   comparability that makes records meaningful.
2. **Versioned** — every record stamps the governing `constitution_version`; analysis never
   crosses versions. The version bump on each amendment is what keeps the dataset honest.
3. **Perimeter off-limits** — §9 clauses (blast radius, merge authority, blocker waiver,
   verification floors, confidentiality) are never in an autonomous batch; a proposal
   touching them is flagged `PERIMETER` and waits for you directly.
4. **Human merge, always** — the evolution pass proposes; you apply. No exception.

## Triggering (automated generation, granted application)

The cycle runs in the background; you only enter at the grant step.

```
audit cadence fires ──▶ evolution pass generates batch ──▶ writes proposals/<id>.md ──▶ EMAILS you
                                                                              │
                                          you reply / comment / grant ◀───────┘
                                                   │
                                  GRANT router applies <id> ──▶ edit constitution, bump version,
                                                          commit, deploy, confirm by email
```

- **Tier 2 `calibrate`** fires on mission volume (~every 10 records).
- **Tier 3 `evolve`** fires on a calendar cadence (monthly / post-milestone).
- Both are background routines that **generate and email**, then stop.

The line the perimeter draws is between *proposing* and *applying*, not between *automated*
and *manual*. **Generating a proposal is automated** — proposing is additive and safe, and
the proposal is itself adversarially critiqued before it reaches your inbox. **Applying an
amendment always waits for your grant.** A system that could silently *apply* its own
constitution change on a timer is the failure mode the perimeter prevents; a system that
*drafts and emails* one is just doing its homework. The loop is closed by evidence,
gated by you.

**Activation is deferred until run-records exist** (post Phase 1). an evolution pass over an empty
corpus has nothing to propose.
