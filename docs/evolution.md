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
| `human_review` block of the record | when you review | `/mission-accept` | (same record) |

All three live in **claude-fieldnotes** (telemetry repo), synced across machines, so both
the light box and the 5090 feed one dataset. The governance repo (long-mission-orchestrator) holds the
*rules*; fieldnotes holds the *evidence*. Never mix them.

### The gold signal

The single most valuable field is `human_review.human_diff_stat`: the diff between what the
mission **delivered** and what you **accepted**. It is the only ground truth for where the
framework misjudged — everything else is the framework grading its own homework. This is the
same epistemology as the ml-literacy consolidation protocol: *the diff is the evidence.*
Without `/mission-accept`, the loop is blind.

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
/evolve calibrate  ──▶  proposed diff to §6.2 cap table  ──▶  you approve  ──▶  version bump + redeploy
```

Most of this is deterministic arithmetic over the jsonl; the model only judges the margins.
The heuristics live in `schema/cap-log.format.md`. The count-vs-hours question we left open
resolves itself here — the log *shows* which caps bind wrongly.

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

`/evolve` runs through the same plan → critic-fight → audit protocol. Consequences that fall
out for free:
- the evolution proposal gets **adversarially critiqued** before you see it (a critic that
  refutes weak amendments);
- proposals without cited records are **invalid findings** — same rule as everywhere;
- the deliverable is reviewed and merged by **you** — self-modification cannot self-approve.

## Guardrails (because self-modifying systems have known pathologies)

1. **Batch** — one amendment batch per cycle. Constant churn destroys the run-to-run
   comparability that makes records meaningful.
2. **Versioned** — every record stamps the governing `constitution_version`; analysis never
   crosses versions. The version bump on each amendment is what keeps the dataset honest.
3. **Perimeter off-limits** — §9 clauses (blast radius, merge authority, blocker waiver,
   verification floors, confidentiality) are never in an autonomous batch; a proposal
   touching them is flagged `PERIMETER` and waits for you directly.
4. **Human merge, always** — `/evolve` proposes; you apply. No exception.

## Triggering (automated generation, granted application)

The cycle runs in the background; you only enter at the grant step.

```
schedule fires ──▶ /evolve generates batch ──▶ writes proposals/<id>.md ──▶ EMAILS you
                                                                              │
                                          you reply / comment / grant ◀───────┘
                                                   │
                                  /evolve apply <id> ──▶ edit constitution, bump version,
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

**Activation is deferred until run-records exist** (post Phase 1). `/evolve` over an empty
corpus has nothing to propose.
