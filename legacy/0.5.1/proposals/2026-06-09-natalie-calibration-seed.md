# Calibration-corpus seed #1 — natalie Block/ run (WRITTEN to fieldnotes 2026-06-12)

Status: **written to fieldnotes** — `mission_records/block-hygiene-20260608.json
classification_calibration`, via /mission-log-audit 2026-06-12 after the Human's blanket
agreement on the 06-11 walkthrough. Entries landed as `should_have_been:"V3"` (schema enum;
the V1-with-harness nuance is in each entry's `note`), `evidence_source:"critic_opinion"`
(the 06-12 human-diff showed *no* V2-gate miss, so per the upgrade rule below no `human_diff`
upgrade was licensed), `may_lower:false`. Kept here as provenance. This is the first
`classification_calibration` data point (§7), drawn from the natalie daylight mission
(run `a11bb840…`). It is **critic-evidence only**, so every `may_lower` is `false`: a critic's
opinion may flag/raise a class but can **never** authorize lowering one (§2.2 asymmetry). To
license a down-classification you must supply the human-diff via `/mission-log-audit` — at which
point I upgrade these entries to `evidence_source: "human_diff"` and `may_lower: true` where your
review agrees.

**Regime caveat:** this run executed under **constitution v0.1**. Per the version guardrail
(evolution.md), the calibration loop must not compare across versions, so this seed is tagged
v0.1 and is a *qualitative* first example, not a statistical sample.

## The labelled mistake

The plan-fight's verification-adequacy critic found that several nodes asserting **Rhino-runtime
behavior** were classified V2 (model-judged) when no model or machine could actually confirm them
— they are runtime claims, i.e. V3-residue, **or V1 once an invariant harness exists** (see the
geometric-verification discussion: NO-DOUBLE-REGISTER is a counter assertion, NO-DEAD-BBOX is a
bbox-scaling assertion — both machine-checkable with a harness, not taste).

```json
{
  "run_id": "a11bb840-natalie-block-fixes",
  "constitution_version": "0.1",
  "mission_class": "M1-or-M2 (not computed; predates §2.4)",
  "classification_calibration": {
    "node_class_verdicts": [
      {
        "node": "impl-reentrancy",
        "features": {
          "path_globs": ["Natalie/Block/BlockManager.Events.cs", "Natalie/Block/BlockDeriv.cs"],
          "applicable_verifier": null,
          "planner_first_class": "V2",
          "instruction_gist": "guard re-entrant block registration (NO-DOUBLE-REGISTER)"
        },
        "v_class_assigned": "V2",
        "should_have_been": "V1-with-harness (counter assertion) | else V3",
        "evidence_source": "critic_opinion",
        "may_lower": false
      },
      {
        "node": "impl-localized",
        "features": {
          "path_globs": ["Natalie/Block/BlockDeriv.cs", "Natalie/Block/BlockManager.Events.cs"],
          "applicable_verifier": null,
          "planner_first_class": "V2",
          "instruction_gist": "suppress unit-change dialog storm (NO-DIALOG-STORM); bbox after unit change (NO-DEAD-BBOX)"
        },
        "v_class_assigned": "V2",
        "should_have_been": "V1-with-harness (bbox-scaling assertion) | else V3",
        "evidence_source": "critic_opinion",
        "may_lower": false
      }
    ]
  }
}
```

## The pattern this seeds

> A node whose acceptance criterion is a **Rhino-runtime behavior** and whose
> `applicable_verifier` is `null` (no machine check exists) tends to be assigned V2, but a
> correlated critic cannot actually confirm it. Two correct moves: (a) build the invariant
> harness so it becomes V1; (b) until then, mark it V3-residue and route to the human — not V2.

## To confirm / upgrade

- **Run `/mission-log-audit` on the natalie run.** Where your human-diff shows one of these nodes
  shipped a defect the V2 gate missed, I set `evidence_source: "human_diff"` and `may_lower:true`
  on that entry, and (with your nod) write the record to `fieldnotes/mission_records/`.
- Or tell me to **discard** this seed if you'd rather start the corpus clean from the first v0.2
  mission.
