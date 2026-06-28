# Heartbeat resume-loop drain + the cost decisions it exposed (2026-06-10)

Status: **fixes (A) applied + committed; decisions (B, C) drafted for the Human, nothing applied.**

Triggered by a Fable 5 session that drained the 5-hour usage window "almost instantly," with the
suspicion that the v0.1→v0.2 cost fix (operating card) had either not worked or not deployed.

## TL;DR

The operating-card fix is deployed and working — but it was always a **minor** lever (~8–19K
tok/agent) and a **red herring** for this drain. The actual cost was two other things:

1. **A broken §11 heartbeat — fixed in this batch.** It re-fired `claude --resume` every 30 min,
   **23×** overnight on `natalie-fable-revision-20260609`, each cold-reloading the full session
   transcript (~400 K tok) for **zero** progress. Still armed and firing when diagnosed; disarmed
   live at 09:55, one minute before its next beat.
2. **Inherent M2 fan-out cost** — FIGHT critics + EXECUTE actor/critic/improver per node, each
   re-processing its growing context over many tool-call turns. "Multi-million tokens" is the
   *cumulative cache-read* total across ~15–20 subagents, not a single file read. (Cf. the v0.1
   natalie run: 17 agents, ~1.26 M subagent tokens.) The mission-class system right-sizes *small*
   missions; it does nothing to cap a legitimately-large M2.

## A. Applied this batch (committed)

| Fix | Where | What it does |
|---|---|---|
| **Bound the resume loop** | `scripts/mission_heartbeat.ps1` | Resume ledger + `-MaxResumes` (default 3) + no-progress detection. A dead/futile resume → self-disarm + `heartbeat.dead` marker (§12 alarm), never loop. Bookkeeping files excluded from the activity scan; `arm` clears stale ledgers. Smoke-tested: budget-exhausted beat disarms without launching `claude`. |
| **Frugal FIGHT critics** | `skills/mission.md` §3 | Operating card (not the 36 KB constitution), pinned artifacts (`plan.json` + `brief.md`), spot-check repo budget instead of open-ended "explore the repo." |

These bound the damage; they do **not** make the two decisions below.

## B. Decision — headless auto-resume vs the Workflow permission prompt (perimeter-adjacent, human-only)

**The reason all 23 resumes made zero progress is structural, not a bug I can patch away.** A
heartbeat-resumed mission runs `claude --resume … -p …` under the **default permission mode**, but
the executor dispatches through the **Workflow tool, which carries its own permission prompt** (the
autonomy-gate note already in `mission.md` §4). Headless, that prompt can't be answered, so the
resumed session can re-orient but can never relaunch the executor. My fix now detects this (no
progress → give up after ≤1 futile resume) instead of grinding, but auto-resume of an executor
mission is **non-functional** until the Workflow tool is pre-granted.

**Fork:**
- **(a) Pre-grant the Workflow tool in `settings.json`** so headless resume can actually drive the
  executor. This is a **human settings action** (§9.1) — the mission must not self-grant it; I will
  not. It widens standing autonomy, so it's your call, not the framework's.
- **(b) Accept that auto-resume only *re-orients and reports*, never re-drives the executor headless**
  — and rescope §11 to that: a beat resumes once to checkpoint/report state and push the Human, then
  stops. Cheaper and perimeter-clean, but overnight missions won't self-continue across a usage reset.

Recommendation: **(b) as the default, (a) only for runs you explicitly bless.** "(a) for everything"
turns every dead mission into a standing headless agent with broad autonomy — exactly the blast
radius the perimeter exists to bound.

> **Resolution (Human, 2026-06-28, via /mission-log-audit item 1 = "1a").** Chose **(a) pre-grant
> the Workflow tool for *blessed* runs only** (not blanket — blanket = the rejected wider-blast-radius
> option), **plus investigate the new "control-character" dispatch guard.** Two things follow, kept
> distinct:
> 1. **"Blessed-only" is launch-time, not a `settings.json` blanket allow.** A `permissions.allow`
>    entry for Workflow is global and would *be* option (b)'s blast radius — which the Human did
>    NOT choose. So the blessing stays per-invocation, authorized when the heartbeat is armed for a
>    specific mission (exactly the model already written in `skills/mission.md` §autonomy-gate: "No
>    `settings.json` pre-grant; scoped to that single headless invocation, authorized by the human at
>    launch"). **Action: no global settings grant; confirm the launch-time grant path actually
>    threads through to the resumed headless executor.** Surface back to the Human if it can't be done
>    per-invocation and genuinely needs a standing grant.
> 2. **The June-27 control-character guard is a separate, attended-session bug** (it blocked dispatch
>    even with a human present, where the permission prompt is answerable). Owner: orchestrator to
>    reproduce with a minimal Workflow probe and characterize what the guard inspects (the venue
>    mission proved an ASCII-clean copy still failed — so it is not the box-drawing glyphs).
>    `[believed, not yet reproduced this session]`

## C. Decision — a verifier model-tier lever (cost vs gate quality)

I deliberately **did not** downgrade the EXECUTE-phase critics/improvers to a cheaper model, even
though `agent()` supports `opts.model` and §3.5/§6.4 already speak of `[model]` as a quality lever.
Reasoning: the actor–critic **gate** is the product (§3.1 makes critics mandatory). Silently running
the gate on a weaker model than the session the Human chose trades away the one thing the framework
sells, invisibly. That's a value call, not a pure optimization.

**Where a cheaper tier is actually safe (if you want the lever):**
- **Cold-improver (§3.5)** — explicitly *advisory, never a gate*; the actor judges its suggestions.
  A cheaper model here can only fail to *help*, never wrongly *close*. Safe to downgrade.
- **Critics / cold-verifier / audit** — these *close or block*. Keep on the full session model.

**Fork:**
- **(a) Leave as-is** — everything inherits the session model. Simplest; gates stay sharp. *(current)*
- **(b) Add a plan-driven, default-off `review_model`** the planner may set for cold-improver nodes
  only; undefined ⇒ session model ⇒ no behavior change. Opt-in cost lever without weakening gates.

Recommendation: **(a) now; (b) only if a real mission shows improver cost is material.** The dominant
cost was the heartbeat loop (now fixed) and FIGHT crawl (now bounded) — re-measure on the next M2
mission before adding model-tier machinery nobody has yet needed.
