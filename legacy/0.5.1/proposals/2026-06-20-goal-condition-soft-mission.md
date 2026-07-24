# Goal-condition closure ("soft mission") (2026-06-20)

Status: **draft — nothing applied; awaiting Human review per §13.**

Triggered by a comparison between LMO and Claude Code's `/goal` slash command
(docs: <https://code.claude.com/docs/en/goal>). `/goal` keeps a session running across
turns until a small fast model judges a stated condition met, evaluating against the
transcript surface after every turn. Cheap, declarative, no plan.

This proposal asks: should LMO add a **condition-closed mission class** alongside the
current DAG-closed one?

## TL;DR

There is a class of work — "iterate until X holds" — where a plan.json DAG is the
wrong primitive. The honest plan is one node ("loop until condition met") and the
real interesting structure is in the condition. Today LMO either forces a DAG anyway
(ceremony for an errand) or expects the human to script the loop themselves. A
**goal-condition closure** would let a mission be expressed as `condition → loop`
under the same governance the DAG missions enjoy. The cost is one extra closure
shape in the executor and one new gate question: who judges the condition, and on
what evidence.

The proposal is non-trivial because the easy version (small model reads transcript)
**violates §1.1 and §2.1** — completion lives outside the model, V0/V1 close on a
recorded check, not on a transcript read. So either the steal is a deliberately
scoped one (machine-checkable conditions only, V0/V1 floor) or it's a §2.3 honesty
hazard the constitution exists to prevent.

## Where this is interesting (and where it isn't)

Genuine fits — work whose end-state is naturally a condition, not a deliverable:
- "lint clean on `<glob>`"
- "all migrations apply against the staging DB"
- "the schema validator green on every record in `.mission/**`"
- "the CI run on `agent/<branch>` is green"
- "every file in `<glob>` is under N lines"

These have a runnable check that **is** the gate. The condition *is* the V1 verifier.
The current LMO expression is a single-node M0 with the check as its close. The
honest gap: writing a one-node plan.json to wrap a one-line check is ceremony with
zero added safety.

Bad fits — work where the condition is a judgement:
- "the abstract reads well"
- "the design feels coherent"
- "the report is honest about what we don't know"

These need V2/V3 critics + human, not a fast-model transcript read. Forcing
`/goal`-style closure here recreates the §2.3 correlated-checker failure mode the
constitution names by name — and a § 2.3a scope collapse (verify == audit) on top.

## Proposed shape

A new closure form, **not** a new V-class:

- **`closure: { kind: "condition", verifier: <registry-entry>, max_turns: N }`** —
  a node closes when the named verifier exits 0. The executor runs (actor turn →
  verifier) in a loop, capped at `max_turns` per §6.2. Each verifier exit is a
  closure record per §2.1 (`check_command`, `exit_status`, `output_digest`,
  `timestamp`); the node only sees the *final* one but the cap log carries them all.
- **Constrained to V0/V1.** The verifier is a registered command from §8 contract.
  A condition that needs judgement is not eligible — it must use the V2 critic path,
  same as today. The honesty boundary: the cheap continuous evaluator only judges
  what a machine check can settle.
- **Mission shape — M0/M1 only.** A condition-closed mission of `n=1` (loop is the
  task) is M0; a small DAG with one condition-closed node and a few V0/V1 setup
  nodes is M1. M2 is **not** condition-closed at the mission level — the campaign
  envelope still demands FIGHT + AUDIT.
- **/mission entry point.** `/mission --condition "<verifier-name>"` synthesizes a
  one-node plan.json on the spot (planner-as-script per §1.3 — no model call to
  draft the DAG when there is no DAG). The grill still happens, but its only job is
  to confirm the verifier choice + cap.
- **No new evaluator model.** No Haiku-reads-transcript pre-screen — the
  registered verifier is the gate, full stop. This is the load-bearing distinction
  from `/goal`: LMO refuses the cheap-but-correlated reading.

## Fork

- **(a) Build it.** Adds a real expressive primitive for loop-shaped work and avoids
  the current "single-node plan.json wrapper for a one-line check" ceremony. Scope
  is narrow (V0/V1 only) by construction, so the §2.3 hazard is contained.
- **(b) Reject — current ladder already covers this.** §6.1's *structured sub-loop*
  is the existing answer: explicit cyclic subgraph, fresh-context agent per iteration,
  state on disk. Anything I'd express as a condition-closed mission can already be
  expressed as a single-subgraph M0/M1 plan today. The proposal is sugar, and the
  cost of sugar is one more closure shape in the executor — a behavior-bearing change
  in a deliverable zone.
- **(c) Reject the closure shape, steal the orientation instead.** The genuine
  novelty in `/goal` that LMO lacks is the **per-turn evaluator output surfaced to
  the human and the next agent** ("here is why we're not done yet"). That is what
  separate proposal #3 (resume telemetry, applied this batch) addresses — `last-step.md`
  in the run dir. The closure shape adds friction; the orientation hint adds
  legibility. Take the legibility, skip the shape.

Recommendation: **(c)** as the immediate move, **(a)** only if §6.1's sub-loop turns
out to be over-ceremony in practice for the verifier-is-the-gate case. The
condition-closed shape is a real primitive but the current sub-loop already does the
work; "we did not need it" is the cheapest version of "we did not build it."

## What I will not propose

A `/goal`-style **transcript-reading fast-model evaluator** at any V-class. The
constitution forbids it for §0.1 reasons (truth-source asymmetry, §2.3 correlated
checker) and there is no clever scoping that recovers safety. `/goal` is a useful
session tool; it is **not** a model LMO should adopt at the closure layer.

## Provenance

This draft came out of a comparison conversation with the Human after a Claude
terminal-crash session. Three "steals from /goal" were brainstormed:

1. cheap pre-gate before V2 critic — withdrawn (subsumed by §3.1 R0)
2. goal-condition / soft mission — **this proposal**
3. resume telemetry / `last-step.md` orientation hint — applied this batch to
   `scripts/mission_heartbeat.ps1` (additive, forward-compatible, no constitution
   change)

Nothing in this draft is applied; it waits on `/evolve apply <proposal-id>` per the
proposals/README.md grant pattern.
