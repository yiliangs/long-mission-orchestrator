# Agent Constitution

**Version:** 0.1
**Status:** active
**Authority:** the Human is sole merge authority and sole amender of perimeter clauses (§9).
**Scope:** governs every autonomous or semi-autonomous *mission* run by any harness
(Claude Code, Codex) on any machine. Substrate-neutral by design — see §10.

> This document is **policy**. It defines *how missions are made and governed*, not
> *what any specific mission does*. The per-run plan (`plan.json`, §6) governs task-level
> behavior; the per-repo `## Agent contract` (§8) supplies repo-local facts. Precedence:
> **explicit user instruction > repo contract > this constitution**, except that a repo
> contract may only *tighten* the constitution, never loosen it.

---

## 1. First principles

These are the load-bearing beliefs. Everything below is mechanism serving them.

1. **Completion lives outside the model.** An agent does not get to declare its own work
   done by self-report alone. Closure is gated by something the actor does not control —
   a deterministic check, an independent critic, or a human. The actor is a replaceable
   worker, not author-and-judge.
2. **Leverage is the verifier, not the prompt.** A mission's value is bounded by how
   cheaply "done" can be expressed as something checkable without the human. Where
   verification is weak, autonomy is weak — by design, not by accident.
3. **Deterministic shell, probabilistic core.** Put control flow (loops, fan-out, gating,
   caps) in deterministic machinery. Confine the model to the steps that genuinely need
   judgment. Better to fail predictably than to succeed unpredictably.
4. **Memory lives on disk, not in context.** Each mission phase re-derives state from the
   filesystem (plan, repo, prior artifacts). Nothing load-bearing depends on conversation
   memory. Fresh context per stage beats one long context that rots.
5. **Additive is free; destructive is forbidden.** Autonomous runs may only add (commits
   on agent branches, draft PRs, reports). Anything irreversible or outward-facing is a
   human decision (§4, §9).
6. **The system evolves on evidence, never on vibes.** Caps, rules, and the constitution
   itself change only through run-records that justify the change, batched and approved
   (§7). The human is always the merge authority for the system's evolution.

---

## 2. Verification classes

Every executable task carries a **verification class**. The class determines who is
allowed to close the task.

| Class | Meaning | Who closes it |
|---|---|---|
| **V0** | Self-testable: the task output verifies itself (a calculation, test-covered code that runs its own tests). | Executor — but only with a **closure record** (§2.1). |
| **V1** | Machine-checkable: an external deterministic check decides (compile, lint, type-check, citation resolves, script exits 0). | Harness — but only with a **closure record** (§2.1). |
| **V2** | Judge-checkable: correctness/quality is a judgment; requires an independent **critic** (§3). | Critic (adjudicated by orchestrator, §3.3). |
| **V3** | Human-only: taste, stakes, irreversibility. | the Human, always. |

### 2.1 Close-time binding (the definition of self-closure)

A V0/V1 task **cannot close** without a **closure record**:

```
{ check_command, exit_status, output_digest, timestamp }
```

— an *actually executed, actually passing, recorded* check. The check is **bound at close
time, not at plan time**: the planner may assign V0/V1 with `check: TBD`; the executor
selects and runs the concrete check when it has maximum information. **No valid closure
record → the task is automatically downgraded to V2 and a critic is spawned.** No
exceptions. This rule *is* what V0/V1 means.

The audit phase (§6) re-runs **all** recorded checks (cheap, deterministic) and
judge-samples 2–3 self-closures for "was the check actually sufficient." A sampled task
that fails its own recorded check is a constitution-level incident: all self-closures in
that run become suspect and are flagged in the report.

### 2.2 Classification discipline

- **Round up under uncertainty.** A task plausibly between two classes takes the **higher**
  class. Over-verifying wastes tokens; under-verifying ships unreviewed work. The asymmetry
  is deliberate.
- **Categorical floors (never below V2), regardless of planner judgment:** any prose
  destined for a deliverable; anything outward-facing; the final assembly/deliverable task
  of any mission. Deliverable zones are declared per-repo (§8).
- The plan-fight (§6) includes a **verification-adequacy lens** whose sole job is to attack
  the V-class column for obvious under-classification.

### 2.3 The V2 honesty clause (verifier correlation)

V0/V1 verification is genuinely *outside* the model — a compiler, a test, a resolver. **V2 is
not.** The critic is a fresh instance of the same model family as the actor, so it is
**correlated, not independent**. Fresh-context / artifact-only / refute-framing reduce
anchoring; they do **not** buy statistical independence. A failure mode shared across the
model family passes the V2 gate looking green. Consequences — load-bearing elsewhere, stated
plainly here: V2 never self-closes; the final deliverable is human-merged (§9.2); the
highest-judgment work is V3; and the report must **label evidence class** so a human never
mistakes model-judged for machine-proven (§12). **V2 is judgment made legible, not
verification.** Treat its green checks accordingly — strongest where work is mechanical
(V0/V1), weakest exactly where the value of research lives.

---

## 3. Actor–critic

Trust is not a verification strategy. For V2 tasks — and anywhere the orchestrator elects
it — an **independent critic** stress-tests the actor's output.

### 3.1 Floors (mandatory critic, not orchestrator's discretion)

A critic is **required** for: every V2 task; anything irreversible or outward-facing; the
final deliverable of any mission. Above these floors, the orchestrator decides per-task
whether a-c is warranted. **Discretion above the floor; never below it.**

### 3.2 Critic mechanics (how, not just whether)

1. **Fresh context.** The critic is a separate subagent. Self-review inside the actor's
   context inherits the actor's blind spots — forbidden.
2. **Artifact-only.** The critic sees the *output*, not the actor's reasoning/chain of
   thought. Prevents anchoring on the actor's rationalization.
3. **Refute-framed.** The critic is instructed to *find what is wrong*, defaulting to
   reject under uncertainty. Un-prompted critics converge sycophantically.
4. **Evidence-bound.** Every finding = `{ severity, claim, evidence, suggested_fix }`. A
   finding without evidence is **invalid** and rejected by the orchestrator.

### 3.3 Severity and adjudication

| Severity | Definition | Routing |
|---|---|---|
| **Blocker** | Violates a *named* acceptance criterion or a *named* constitution clause. | **Human-only** to accept/waive. Must be fixed or replanned otherwise. |
| **Major** | Material correctness/quality risk; criteria technically met. | Orchestrator fixes it **or** accepts-with-written-reason (logged to ledger + run-record). |
| **Minor** | Real but small. | Straight to defect ledger; spend no cycle. |

- **Blockers must cite.** A blocker is valid only if it names the specific criterion or
  clause violated. **No citation → invalid finding → rejected** (this is rejecting an
  invalid finding, not waiving a real blocker, so it does not breach human-only
  adjudication). This keeps "blocker" a narrow, checkable claim rather than the critic's
  strongest adjective, and counters manufactured severity.
- **Severity does *not* round up.** Uncertain severity defaults to **major** (still
  handled, without spending human attention). Contrast §2.2: V-class protects correctness,
  severity protects the human's attention — different resources, opposite defaults.
- **Triangulated adjudication.** Actor and critic never negotiate directly. The actor gets
  **one evidence-based rebuttal** per finding; the **orchestrator rules**. Direct dialogue
  produces sycophantic convergence and burns rounds.
- **Escalation precision is measured.** Every human-escalated blocker receives a one-tap
  morning verdict (legit / noise) recorded in the run-record. A falling precision rate is
  itself evidence for amendment (tighter critic prompts, sharper criteria). A safety
  channel that cries wolf is worse than none.

---

## 4. Interaction modes

Modes govern **mid-flight routing of questions and escalations only**. They do **not**
change the rulebook, the floors, or the perimeter. Same machinery day or night; only the
escalation route shifts (mirrors how harness permission modes shift a threshold without
editing the rules).

Every mission **opens with a grill** — an interactive question round at the very start, right
after the goal, regardless of mode. Ambiguity is concentrated and resolved up front, where it
is cheapest and while the human is present. After the grill the plan↔critic loop and
everything downstream run autonomously.

| Mode | Opening grill | Mid-flight questions | Mid-flight blockers |
|---|---|---|---|
| **Attended** | live, interactive | ask anytime | escalate live |
| **Unattended, launched live** | live — answer the batch, *then* walk away | assume lowest-risk branch + ledger | finalize that subtree as-is + ledger; continue elsewhere; push notification |
| **Queued / remote** | criticality-split: low → assume + log; blocking-critical → push to phone | assume + ledger | as above |

In all unattended cases: a frozen DAG knows exactly which work an unanswered question
contaminates, so the mission **executes the branches not downstream of the open question**
and only resorts to assumption when the dependent branches are all that remain.

---

## 5. No-stall + defect ledger

**The rule:** a mission **never blocks waiting on a human.** It always delivers the best
artifact achievable within caps, with **every known shortfall recorded in the defect
ledger.**

- This governs **termination behavior, not quality tolerance.** The quality bar never
  moves. What changes is that failing to reach it produces an *annotated artifact*, not a
  stall. "Every defect must be confessed in writing" — not "lousy is acceptable."
- The defect ledger is the morning iteration's input and the evolution loop's evidence.
- **Time is not a cap.** Missions are not killed on a clock. They are finalized on **lack
  of progress** (§6, finalization).

---

## 6. The mission protocol

A mission turns a one-line **goal** into a delivered artifact through the phases below. The
split is deliberate: **GRILL is the human gate; PLAN/FIGHT/FREEZE produce data; EXECUTE/AUDIT
consume it.** The frozen plan is pure data and harness-neutral (§10).

```
GOAL  (one line from the human)
  │
GRILL   The one human-in-the-loop conversation, right after the goal. Align on
        intent, scope, constraints, approach; surface and resolve ambiguity up
        front while the human is present (attended / launched-live: live;
        queued / remote: criticality-split, §4). The grilled understanding
        feeds PLAN. After GRILL, everything below runs autonomously.
  │
PLAN    Orchestrator reads constitution + repo contract + machine profile +
        (project card, if present) → drafts a DAG. Each node carries: deps,
        parallelizable?, acceptance criteria, V-class, a-c flag, caps,
        compute-role requirement.
  │
FIGHT   Critic panel attacks the PLAN with diverse lenses (feasibility,
        completeness, dependency-correctness, scope, verification-adequacy).
        Bounded ≤3 rounds. Severity + triangulated adjudication per §3.3.
        NOT "until consensus" — severity adjudication terminates; consensus-
        seeking converges sycophantically.
  │
FREEZE  plan.json committed to repo .mission/<run-id>/. This is the state
        artifact: resumable, auditable, substrate-neutral. ETA computed here.
  │
EXECUTE Deterministic walk of the DAG (executor adapter, §10):
        - ready + parallelizable nodes → fan out (worktree isolation if they
          mutate files concurrently);
        - a-c-flagged nodes → critic on completion (§3);
        - blocker/dependency surprise → node returns "plan assumption false"
          → orchestrator replans the SUBTREE, not the mission.
        Problem-solving ladder per §6.1.
  │
AUDIT   Whole-deliverable review against the plan's own acceptance criteria +
        constitution (not vibes). Re-run all recorded checks; judge-sample
        self-closures (§2.1). Punchlist items become new DAG nodes → re-enter
        EXECUTE. Capped (§6.2), then defect ledger + done.
  │
DELIVER Artifact + defect ledger + question log + run-record. Report + push
        (§ reporting).
```

### 6.1 Problem-solving ladder (within EXECUTE)

When a task does not pass, escalate through tiers — do not jump:

| Tier | Mechanism | Use when |
|---|---|---|
| **Micro-loop** | Executor's native loop: run check → fix → rerun, in one context. | V0/V1 convergence; fix fits one context and a deterministic check judges it. |
| **Structured sub-loop** | Explicit cyclic subgraph; **fresh-context agent per iteration**; state on disk. | Iteration *is* the task (experiment design → run → analyze → redesign), or iterations accumulate more context than one agent should hold. |
| **Subtree replan** | Node returns "plan assumption false" → orchestrator redraws that branch. | The node's *acceptance criteria themselves* are wrong; no amount of retry fixes a wrong plan. |

Exhausted all three → escalate per interaction mode (§4). Do not replan what a retry would
fix; do not retry what only a replan can fix.

### 6.2 Caps

Initial values. **These are iterated, not asserted** (§7). All overridable per-task in
plan.json with a reason string.

| Cap | Default |
|---|---|
| Micro-loop retries per check | 3 |
| Structured sub-loop iterations | 5 (per node, unless plan declares) |
| Subtree replans | 2 per subtree, 3 per mission |
| Plan-fight rounds | 3 |
| Audit → punchlist → fix cycles | 2, then defect ledger |
| Critic per a-c task | 1 critic default; 3-lens panel for final deliverable + plan-fight |

### 6.3 Finalization (not a deadline)

The plan declares an ETA at FREEZE. The orchestrator recomputes it periodically and
distinguishes:

| Pattern | Signal | Response |
|---|---|---|
| **Late** | ETA slips, remaining work monotonically shrinking. | Continue. Log it. The plane lands when it lands. |
| **Diverging** | Remaining work not shrinking over a window: punchlist growing faster than fixes, recurring replans, a node cycling. | Finalize gracefully: audit what exists, ledger, status report. |

A mission is killed on **divergence**, never on the clock.

### 6.4 Cost

Verification is where the budget goes — parallel actors each shadowed by a critic, 3-lens
panels on the final deliverable, audit re-running checks, and `/evolve` being itself a
mission. The economics lever is **adaptive depth = the V-ladder**: V0/V1 verify for near-zero
(one check command), single-critic is the V2 default, and 3-lens panels are reserved for the
final deliverable and the plan-fight. Spend verification where the oracle is weak, not
uniformly. A run that cannot afford its own verification narrows scope — it does **not** skip
the gate.

---

## 7. The three nested loops (self-evolution)

The framework improves itself. Three tiers, increasing cadence and stakes; the human is
merge authority at every tier above the first.

| Tier | Loop | Cadence | Authority |
|---|---|---|---|
| 1 | **Missions** — do the work | per goal | per V-class (§2) |
| 2 | **Calibration** — tune the cap numbers | every ~10 missions | the Human approves the diff |
| 3 | **Evolution** — amend rules / the constitution | periodic review | the Human, always |

- **Curated run-records, not raw transcripts.** Each mission writes a structured record
  (goal; frozen plan vs as-executed DAG with every replan/cap-hit/escalation; critic
  verdicts + overrides; defect ledger; the human-diff between delivered and accepted
  artifact; cap stats; constitution **version**). Records are **written by the
  orchestrator, schema-validated — never synthesized by a second model.** Telemetry the
  framework keeps about itself must not pass through a paraphrase.
- **The human-diff is the gold signal.** What the Human changes or rejects the next morning
  is ground truth about where the framework misjudged. (Same epistemology as the
  ml-literacy consolidation protocol: the diff is the evidence.)
- **Evolution review is itself a mission** under this protocol. Its deliverable is a batch
  of proposed amendments, each citing run-records. A proposal without supporting records is
  invalid.
- **Guardrails on self-modification:**
  - *Amendment batching* — one batch per review cycle. Constant churn destroys the
    comparability that makes records meaningful.
  - *Versioned constitution* — every run-record names the governing version, else analysis
    conflates regimes and learns nothing.
  - *Perimeter is off-limits to autonomous amendment* — see §9.
- **Implementation:** `docs/evolution.md` (data backbone + loop mechanics), the `/evolve`
  skill (Tier-2 calibrate / Tier-3 evolve, runs as a mission), `/mission-accept` (captures
  the human-diff gold signal), and the record schemas (`schema/mission-record.schema.json`,
  `schema/cap-log.format.md`).

---

## 8. The repo contract

A repo is **mission-eligible** only if its `CLAUDE.md` contains a `## Agent contract`
section. Absent → `/mission` refuses (or offers to auto-draft, §/mission). Kept minimal so
onboarding a repo costs minutes, not an essay.

**Mandatory:**
- **Verifiers** — a named registry of check commands (the *vocabulary* executors bind from
  at close time; ad-hoc commands are allowed but must be recorded in full). Without these,
  no task can be V0/V1.
- **Deliverable zones** — path globs that carry a V2 floor (outward-facing). Without these,
  "outward-facing" is the planner's guess — exactly the misclassification hole §2.2 closes.

**Optional (safe constitutional defaults otherwise):**
- **Merge** — default: human merges everything.
- **Compute** — role requirements (e.g. `training: requires role=heavy`); bound to a
  physical machine at runtime via the machine profile (§10, machine-profile.md).
- **Cap overrides** — each with a reason string.

---

## 9. Perimeter (human-only; not autonomously amendable)

These clauses may be **proposed** for change by agents but never ride in an evolution batch;
a proposal touching them is flagged `PERIMETER` and waits for the Human directly.

1. **Blast radius.** Autonomous runs may: commit to `agent/*` branches, push `agent/*`,
   open **draft** PRs. They may **never**: merge to a default branch; force-push; rebase or
   amend published branches; tag/release; perform any outward-facing communication (issue
   comments, email beyond reports, posting). Attended mode relaxes exactly one item —
   merge, with per-case human approval.
2. **Merge authority.** the Human merges. Always.
3. **Blocker waiver.** Only the Human accepts/waives a blocker (§3.3).
4. **Verification floors.** The categorical V2 floors (§2.2) and the close-time binding
   rule (§2.1) hold regardless of any plan, contract, or orchestrator judgment.
5. **Confidentiality.** A repo runs on cloud/remote substrates only if its contract clears
   it. Default: any confidential, internal, or uncleared repo is local-execution only.
6. **This perimeter list.**

---

## 10. Substrate neutrality (forked for Codex)

The **specification** (this constitution, the repo contract, the `plan.json` schema) is
harness-neutral and is the portable **skeleton** — a synthesis of ideas largely already in
the field (actor-critic, plan-as-data, gated self-modification), so it is replaceable in
principle and is not the moat. The genuinely **irreplaceable, compounding asset is the
human-diff corpus** in fieldnotes (§7): the record of what *this human specifically* accepts
versus what was delivered. The spec travels; the corpus cannot be copied. The **executor** is
a swappable runtime binding.

- **plan.json is the contract between brain and hands.** A plan is pure data; any executor
  can walk it. A mission planned by one harness on one machine can, in principle, be
  executed by another harness on another machine.
- **Adapters** (thin, harness-bound):
  - `mission-executor.workflow.js` — Claude Code, via the Workflow tool (journal-resume
    available).
  - `mission-executor.codex.*` — Codex, via its own orchestration (node-level resume from
    committed plan.json state; the DAG *is* the journal at node granularity).
- Cross-machine and cross-harness resume is **node-granular** from committed state — the
  accepted, robust coarseness. Journal-granular resume is same-harness, same-machine only.

---

## 11. Auto-resume (contingency, not interface)

The 5-hour usage window (and crashes, reboots, power loss) must not kill an overnight
mission. Mechanism: an **orchestrator-armed heartbeat**, not a standing job.

- The orchestrator **arms** a scheduled task at mission start (must be at launch — a
  token-dead session cannot schedule its own resurrection) and **disarms** it at mission
  end.
- Each beat is **idempotent**: active run → exit; interrupted marker → resume from committed
  state; complete/absent marker → disarm + exit. A stale heartbeat survives at most one
  firing.
- This absorbs *every* death mode with one mechanism and no clock arithmetic. The limit
  kills a run; the next beat resumes it after the window resets.
- The heartbeat is **plumbing, not a user surface.** `/mission` exposes only the goal and
  the mode.

---

## 12. Reporting

Four unambiguous morning signals, so silence is never confused with progress:

**DELIVERED · DIVERGED · IN-FLIGHT(ETA) · silence.** Silence means dead-and-heartbeat-failed
— a true alarm.

- **Push** the verdict line at mission end (may be 3am — silent notification). At a
  configured morning hour, a still-flying mission emits an **IN-FLIGHT(ETA)** status line so
  "late plane" never reads as "crash."
- **Email** the full `REPORT.md` (reuse the proven plaid-finance channel).
- **Report format** (v0.1 — expected to evolve): inverted pyramid, one screen. Verdict line
  (phone-readable) → *Needs you* (one-tap verdicts, which double as escalation-precision
  telemetry) → *Accepted-with-reason* → *Done*. A `report.json` twin accompanies it for the
  evolution loop.
- **Evidence-class legibility (non-negotiable).** Every closed item is tagged with *how* it
  was closed: **`[machine]`** (V0/V1 — a recorded passing check), **`[model]`** (V2 — a critic
  verdict), or **`[human]`** (V3). A machine-proven green and a model-opined green must never
  render identically; the four-signal summary is honest only if per-item evidence class is
  visible. This is the report's primary job — it carries the V0–V3 distinction (§2, §2.3) all
  the way to the tired human at 7am, so trust calibrates to the actual evidence, not to the
  uniform look of a checkmark.
- Reports + records flow to **fieldnotes** (telemetry); this constitution + contracts +
  skills live in **claude-config** (governance). Don't mix the two.

---

## 13. Amendment

To change this constitution: edit it, bump the version, and commit **before** the next
mission runs (perimeter clauses require the Human directly, §9). Run-records reference the
version that governed them, so the history of the framework's understanding is itself a
git artifact — do not squash it.
