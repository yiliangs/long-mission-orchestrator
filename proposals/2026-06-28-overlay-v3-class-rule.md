# Promote the live-overlay failure CLASS to an agent-facing preventive rule (2026-06-28)

Status: **APPLIED 2026-06-28** (fork (a) — full mechanism, on explicit Human instruction
"wire the full mechanism in", which supersedes the proposal's own conservative (c)
recommendation). What landed:

- **Teeth — constitution §2.1a "Coverage honesty"** (both copies, version 0.4.0 → **0.4.1**,
  CHANGELOG + operating-card worker line + deployed): a passing check only closes the property
  it exercises; in a machine-blind zone a green-but-blind check is no close — measure or ship
  `V3-deferred: <property>` open in the defect ledger.
- **Engine — fieldnotes synth made class-first / filtered / promote-not-append**:
  `schemas/project_card_schema.md` (the filter test + "what earns a rule" + promote-organ→class)
  and both synth paths (`synthesizer.py`, `rebuild_cards.py`).
- **Loop — `evolve.md` Tier-3** gained the **revealed-hardness (clarification) signal** as a
  typed, positive-only escalator, applied by the human-in-loop audit (NOT auto-counted in the
  synth — deliberately staged, see caveats).

### Retro-test (replay command-bar's actual defects against §2.1a) — reasoning, not execution

| command-bar defect | Under §2.1a |
|---|---|
| concentricity claimed unmeasured | **Direct catch.** Geometry property, webshot-blind → cannot close on "looks right"; must measure (catches 17px ≠ 6px) or mark `V3-deferred`. |
| window-jump (measure-resize) | Runtime/geometry, webshot-blind → measured assertion or open marker; not silently "done". |
| tooltip clip / lingering | Live click-through runtime, webshot-blind → same: surfaced, not closed green. |

And the synth change means these three become **one class rule** ("live overlay is webshot-blind;
measure/smoke runtime+geometry"), so the *next* new organ inherits the guard instead of
re-teaching it.

**Honest caveats (this is wired, believed-correct, NOT verified-in-anger):**
1. §2.1a converts a *silent* close into a *required choice* (measure or mark-open) — it does not
   guarantee the agent measures *correctly*; a determined "looks right" can still rationalize. It
   is necessary, not sufficient; the critic must enforce "is this property machine-blind? then
   demand a measurement." Real proof needs the next overlay mission.
2. It currently keys off "the repo contract marks the zone machine-blind" — natalie's contract
   does not yet *declare* an explicit machine-blind zone (the rule still works via "property the
   check provably can't observe", but an explicit §8 declaration would sharpen it). Left as a
   follow-up; not edited here to keep blast radius small.
3. Maker/checker: I both diagnosed and wired this — a cold adversarial review is the right next
   check before trusting it (same blindspot risk that let command-bar ship).

## Trigger

The Human's audit verdict: *"the UI porting is generally fine with some not-machine-verifiable
errors, but the wall has been hit before and you just failed to learn. Either the failure-mode
logging mechanism is down, or the agent is too lazy to take a look. I don't like the delivery."*
And on a *mandatory* gate: *"mandatory is only effective when it is written in contract and facing
toward agent — but this is me, and I don't read contract for the agent, so [a human-facing gate] is
dead pursuing."*

## Diagnosis (which of the Human's two hypotheses is true: neither, exactly)

The failure-mode logging is **not down** and the agent is **not (purely) lazy**. Evidence from
`claude-fieldnotes/project_cards/natalie.yaml` `binding_rules` (the agent-facing block the planner
reads at PLAN time per `skills/mission.md` §"Standards to learn"):

| Binding rule (live-overlay class) | First committed | Mission it was mined from |
|---|---|---|
| RhinoCommon not thread-safe — marshal to STA main thread | 2026-06-22 12:47 | general |
| `OverlayProcessHost.Close()` must move blocking pipe I/O off the UI thread | 2026-06-22 16:19 | thumbnailbar freeze (Jun 22) |
| `CompositionWindow` popups must be fixed-size — content-driven sizing imports an async measure-resize race | **2026-06-27 19:25** | **commandbar — 45 min AFTER it delivered (18:40)** |
| `OverlayShell` SIZE_SURFACES — webshot passes green while production clips | 2026-06-28 03:40 | commandbar (after) |

So each rule is written **reactively and named after the exact organ that just broke**
(`OverlayProcessHost.Close`, `CompositionWindow popup`). The rule that would have warned commandbar
off the window-jump was distilled **from** commandbar, after delivery. The structural failure:

1. **The corpus is a list of yesterday's symptoms, not the disease.** The next mission touches a
   *different* organ of the *same* class (the headless harness cannot see the live overlay's
   geometry/sizing/threading envelope), finds no rule with that name, and re-hits it. A planner
   pattern-matching `binding_rules` as a checklist of named symptoms never generalizes
   "my new popup" ← "the prior popup's measure-resize race."
2. **The class-level lesson exists, but only as DESCRIPTIVE prose.** `natalie/CLAUDE.md:242` and
   `natalie/docs/web-overlay-architecture.md:47` correctly say "anything behavioral beyond
   compile/tsc/webshot is V2 or V3 (human smoke); the gate cannot reach these." That tells the agent
   the gate is blind — it does **not** impose a preventive obligation on the agent's *close*.
3. **The §completion-confidence trap, structurally.** Across both missions every defect was either
   (a) in the real-overlay runtime envelope the headless harness can't see, or (b) a visual-geometry
   property (concentricity, divider alignment) shipped on "looks right" without measuring — the agent
   closed on a *claim* it called a *fact*. (Commandbar round 3: reported "concentric" without
   measuring; it was 17px vs 6px. The Human: "don't you understand concentric?")

## Why a human-facing "mandatory smoke gate" is dead (the Human's point)

The /mission-log-audit item-4 rec was "make an in-Rhino smoke a required gate before DELIVER." But
that gate faces the **Human** (the Human runs the in-Rhino smoke), and the Human does not read or
execute the agent's contract — so "mandatory" buys nothing; the burden is already on the Human and
the recurrence already happens *at* the Human's smoke. The effective lever is the opposite-facing
one: a rule the **agent** must clear before it may claim a node done.

## Proposed shape — agent-facing, preventive, class-level

**(1) One class-level binding rule** (in `project_cards/natalie.yaml`, above the symptom list, marked
as a CLASS rule the symptom rules are instances of):

> **Live-overlay runtime is V3 by default.** Any node that touches the overlay's geometry, sizing,
> z-order, click-through, or thread-affinity is V3 unless a *registered machine check* covers the
> specific property. Its close MUST cite a **measured assertion** — a rendered-DOM measurement
> (settle-then-measure) or an in-Rhino smoke result — never a model-eyeballed "looks/sounds right."
> The headless webshot harness is blind to this envelope by construction; passing webshot is *not*
> evidence for any property in it. The named symptom rules below are instances of this one rule —
> a new organ (a new popup, a new sizing path, a new pipe write) inherits the rule even with no
> symptom-specific entry yet.

**(2) A close-condition for the executor / critic** (constitution §2 / §3 — the part that needs Human
sign-off because it touches policy core, a §2.2 V2-floor + §9-adjacent zone): an overlay-zone node may
not close on actor prose asserting a geometric/runtime property; the critic must require either a
machine assertion or an explicit `V3-deferred-to-human-smoke` marker that ships in the defect ledger
as an *open* item — so an unmeasured property is *visible as unverified*, not silently "done."

**(3) Corpus-mining becomes class-first, not symptom-first** (`docs/evolve.md` corpus step): when a
human-diff is distilled into `binding_rules`, the synth must ask "is this an instance of an existing
CLASS rule?" and, if so, attach it under that class rather than appending a free-standing symptom —
and must do it **at delivery**, not on the next day's synth pass (the 45-minute-too-late gap above).

## Fork

- **(a) Adopt all three.** Highest leverage; directly closes the recurring class. Cost: a constitution
  §2/§3 edit (Human-only, policy core) + a card-schema convention + an evolve.md step.
- **(b) Adopt (1) only** — the class-level binding rule in the card, no constitution change. Cheapest;
  makes the class agent-visible at PLAN time but leaves the *close* still able to accept "looks right."
- **(c) Adopt (1)+(3)**, defer (2). Get the class rule + timely class-first mining now; leave the
  harder close-condition change until a third recurrence proves the binding rule alone insufficient.

Recommendation: **(c).** (1) and (3) are card/synth-local and perimeter-clean — they make the class
visible and keep it from being re-learned symptom-by-symptom. (2) is the real teeth but it edits the
policy core (§2.2 floor / close semantics), so it deserves its own Human-gated change once (1)+(3)
show whether visibility alone moves the recurrence rate. This is the cheapest version of "we taught
the agent the disease, not the symptom."

## What I will NOT do

Unilaterally edit `docs/agent-constitution.md` or the natalie card's contract — both are policy/
agent-facing core (§9 / §2.2). This proposal is the surface; application waits on the Human's pick
per `proposals/README.md`.
