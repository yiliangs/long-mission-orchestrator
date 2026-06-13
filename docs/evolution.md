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
  recurs (add a check);
- a ceremony element with **zero yield across ≥10 same-version missions** → propose deleting
  it (the deletion pattern: the zero count is machine evidence, §2.2-licensed — mechanism
  deflates as models improve, by record instead of by forecast). Yield stats partition by
  model generation as well as constitution version; a generation change re-baselines them.

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

## The JS-vs-prose leak audit (a recurring diagnostic)

A standing failure mode of a self-documenting framework: the prose claims "the executor does X"
while the runtime does not enforce X — X lives only in a spawned agent's *prompt* (advisory, an
honor request) or in a doc paragraph (aspirational), not in the deterministic shell. Each such gap
is a place where "designed protocol" silently overstates "reference runtime." The README §"honest
pitch" makes this distinction in prose; this section makes it *checkable*, claim by claim.

**How to re-run this diagnostic** (the evolution loop folds it into a Tier-3 pass): walk every
load-bearing "the executor / the framework does X" claim across `README.md`,
`docs/agent-constitution.md`, and `skills/mission.md`. Mark each:

- **ENFORCED-IN-JS** — a deterministic code path in `executors/mission-executor.workflow.js`
  makes X true regardless of any agent's cooperation. Cite `file:line`.
- **PROSE-ONLY** — X is asserted in markdown and/or *requested* in a spawn prompt, but no JS path
  guarantees it. A cooperating agent satisfies it; a non-cooperating or confused one is not caught.
  Cite the markdown `file:line` (and the prompt line if the request lives in the executor).

The distinction is not "prose is bad." Much of the protocol is *correctly* prose — judgment work
the gate is meant to catch downstream. The point is to keep the inventory honest about *which*
claims are mechanically guaranteed, so no reader (or future amendment) mistakes a prompt-level
request for an enforced invariant. PROSE-ONLY is a finding only when the surrounding text *reads*
as if it were enforced.

Seed inventory (re-derive `:line` cites when files move — they drift across versions):

| # | Claim ("the executor/framework does X") | Asserted at | Classification | Evidence |
|---|---|---|---|---|
| 1 | **Punchlist items re-enter EXECUTE** (capped 2 cycles, then ledger) | `skills/mission.md:245` | **PROSE-ONLY** | No re-entry path exists. AUDIT emits `punchlist` (`mission-executor.workflow.js:790`); a `plan_assumption_false` node is only marked done-with-defect and the runtime *continues* — `// a fuller adapter would re-plan the subtree here … marks the node done-with-defect and continues` (`mission-executor.workflow.js:689-694`). The punchlist→new-node→re-enter loop is not wired. |
| 2 | **A blocker (and any surviving major) triggers a capped fix→re-review→re-adjudicate loop at the gate** | `docs/agent-constitution.md:271-282`, `README.md:170-173` | **ENFORCED-IN-JS** | The gate-fix `while` loop re-dispatches the actor on `[...blockers, ...majors, ...minors]`, re-runs the effective-tier critic, re-adjudicates, and adopts only on lexicographic progress — `mission-executor.workflow.js:575-596`. Cap `gate_fix_cycles` default 2 at `:84`. *(Was PROSE-ONLY pre-N1; the major-fix path is now code.)* |
| 3 | **Each surviving major closes with a written accept-with-reason** | `docs/agent-constitution.md:273`, `README.md:173` | **ENFORCED-IN-JS** | Deterministic per-major reason stamped on every uncovered major after the loop — `mission-executor.workflow.js:601-605`. |
| 4 | **The gating critic reviews in a read-only / bounded-read sandbox** (R1 no repo access; R2 ≤5 reads of the critic's own choosing; "do not explore the repo") | `docs/agent-constitution.md:223-224,546-547`; requested in-prompt at `mission-executor.workflow.js:306,326-329` | **PROSE-ONLY** | No tool restriction is passed to `spawn` for any critic — the `spawn` opts carry only `label/phase/schema/model` (`:558`, `:585`, `:616`); there is no `tools`/`allowedTools`/permission field anywhere (grep: zero hits). "≤5 reads," "no repo access," and "do not explore" are *instructions in the prompt string*, honored by a cooperating agent, not enforced by the shell. |
| 5 | **A blocker is invalid unless its citation RESOLVES to a clause or named criterion** | `docs/agent-constitution.md:269`, `README.md:94` | **ENFORCED-IN-JS** | `_citationResolves` deterministically checks `§N` or fuzzy-matches a named acceptance criterion; `adjudicate` demotes uncited/non-resolving blockers to major — `mission-executor.workflow.js:405-423`. |
| 6 | **An actor writing outside its declared write_set raises a machine-evidence blocker (human-only to waive)** | `docs/agent-constitution.md` §6.5 region; `README.md:174` | **ENFORCED-IN-JS** | `writeSetBreach` diffs touched files vs declaration and emits a blocker; injected into the verdict and gated at every tier incl. R0 — `mission-executor.workflow.js:447-462,533-534,561,582,587`. |
| 7 | **V0/V1 nodes with no valid passing closure record downgrade to V2 (a critic spawns)** | `docs/agent-constitution.md:100`, `:223` | **ENFORCED-IN-JS** | `selfClosed` requires `closure_record.exit_status === 0`; `reviewFloor` raises non-self-closed V0/V1 to R2 (a fresh critic) — `mission-executor.workflow.js:115-122,526-528`. |
| 8 | **The mission class floors deterministically — a hand-edited/under-classified plan cannot run below its facts** | `docs/agent-constitution.md` §2.4; `README.md:176` ("deterministic class guard") | **ENFORCED-IN-JS** | `_classFloor` re-derives the floor from node V-classes + zone overlap; `MCLASS` is `max(claimed, floor)` — `mission-executor.workflow.js:63-76`, discrepancy logged at `:638-639`. |
| 9 | **A budget ceiling crossing is recorded as a machine-readable cap_hit, never prose-only** | `docs/agent-constitution.md` §6.4; `README.md` budget telemetry | **ENFORCED-IN-JS** | `budgetReport` pushes `cap_hits` entries for token/agent overrun into the run-record — `mission-executor.workflow.js:706-722`. |
| 10 | **Disjoint mutating nodes fan out in parallel under worktree isolation** | `README.md:187-188` (explicitly listed as *not yet wired*); §6.5 | **PROSE-ONLY** | Correctly disclosed as unwired: the disjoint set is *computed and logged* but run serially — `mission-executor.workflow.js:676-685` (`worktree+merge wiring pending`). Listed here so the audit stays exhaustive; this row is *consistent* (prose already says "specified but not wired"), not a leak. |
| 11 | **A `plan_assumption_false` outcome re-plans the affected subtree** | `docs/agent-constitution.md` §6.1 tier 3; `README.md:188-191` (disclosed as not-wired) | **PROSE-ONLY** | Same site as #1: surfaced, budget-counted, logged to AUDIT, node marked done-with-defect — but the subtree is *not* re-derived (`mission-executor.workflow.js:687-697`). Consistent with the README's "specified but not yet wired" list; not a leak. |

**One-line verdict per claim:**
1. Leak — prose reads as a wired loop; it is not. Either wire punchlist re-entry or soften mission.md to "candidate nodes for a follow-up mission."
2. Clean — enforced post-N1 (the major path was the known leak; now code).
3. Clean — deterministic per-major reason.
4. Leak — the critic "sandbox" is a prompt request, not a shell constraint; the prose should say "instructed to" not imply enforcement, or the spawn should pass an actual tool restriction.
5. Clean — citation resolution is deterministic.
6. Clean — write_set breach is machine-enforced.
7. Clean — close-time downgrade is mechanical.
8. Clean — class floor is re-derived in code.
9. Clean — cap_hits are machine-recorded.
10. Clean (consistent) — already disclosed as unwired; no overstatement.
11. Clean (consistent) — already disclosed as unwired; no overstatement.

**Composite read:** of the load-bearing claims, two are genuine leaks (#1 punchlist re-entry, #4
critic sandbox) — both PROSE-ONLY presented as if enforced. The major-fix path (#2), historically
the third known leak, is closed as of N1. The two remaining PROSE-ONLY rows (#10, #11) are *not*
leaks because the README already labels them unwired; they are included so a future re-run inherits
the full inventory rather than re-discovering them. The recurring discipline: when a new "the
executor does X" sentence is added to any doc, this table gets a row, and the row's classification
must be defensible against the actual `spawn`/control-flow code — not against the sentence next to it.
