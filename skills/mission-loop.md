---
description: Explore or improve a living artifact through recoverable mission cycles in breadth, depth, or mania mode.
argument-hint: "<artifact or concept> [--breadth|--depth|--mania] [--cycles N] [--budget TOKENS] [--unattended] | --resume <loop-id>"
---

# Mission Loop

$ARGUMENTS

Run a recoverable sequence of bounded mission cycles over one living artifact. Each cycle must produce a distinct verified result, not more discussion about the same result.

Apply `/mission`'s LOAD behavior before starting or resuming: load the constitution and fieldnotes, instantiate a missing `<repo>/.mission/contract.md` from `~/.claude/docs/mission-contract-default.md` without asking, specialize it only with established repository facts, then load it.

For a new loop:

1. **META-GRILL.** Run `/grill-me` once to freeze the charter: the core concept, first principles, hard boundaries, direction of improvement, mode, cycle and token ceilings, contact leash for unattended work, and any known exploration axes. Honor supplied `--cycles N` and `--budget TOKENS`; otherwise resolve those ceilings in the meta-grill. Do not force a detailed destination; the loop needs a gradient and fences. Save the charter at `.mission/loop-<slug>/charter.md`.

2. **MODE.** `--breadth` generates meaningfully different alternatives. `--depth` improves one champion. `--mania` runs beam search: fan out, prune to the strongest small frontier, deepen, then fan again from what was learned. If no mode is supplied, resolve it in the meta-grill. Cosmetic reskins do not count as alternatives.

3. **STATE AND HEARTBEAT.** Keep `plan.json`, `journal.md`, retained `agent/loop-*` branch names, evidence, current champion or frontier, budget spent, and last human contact under the loop directory. For `--unattended` or a loop likely to outlive the session, ask the user to arm one loop-level heartbeat:

   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ~/.claude/scripts/mission_heartbeat.ps1 arm -RunDir <repo>/.mission/loop-<slug>`

   Individual cycles do not arm their own heartbeat. Commit state after every cycle so a resumed driver can reconstruct the frontier. Foreground operation may use `/loop /mission-loop --resume <loop-id>` for one persisted cycle per wake.

4. **CYCLE.** Derive one bounded mission brief from the charter, current state, and latest steering. Build its plan with the canonical mission schema and run it through the canonical mission executor, with cycle-level heartbeat arming suppressed. Run FIGHT when warranted, FREEZE, EXECUTE, and AUDIT without reopening the human grill. Retain a result only when its claim-observing witness passes.

   Breadth and mania maintain a spectrum map: name the real axes revealed by the alternatives, place each retained branch, and mark uncovered regions. Depth compares every candidate with the current champion against the charter's direction and cumulative drift, not only the previous commit.

5. **STEER.** After each cycle, report only the verified change, current champion or frontier, spectrum gaps where applicable, cumulative drift, and remaining budget. Apply user steering at the next boundary. In unattended mode, pause when the contact leash expires; silence never authorizes a direction change, merge, publication, or destructive action.

Stop at the cycle or token ceiling, two consecutive cycles with no verified improvement or distinct alternative, a charter boundary, contact-leash expiry, or an explicit stop. Per-cycle reports must not be named `REPORT.md`; reserve `.mission/loop-<slug>/REPORT.md` for finalization so the heartbeat disarms only when the loop ends.

For `--resume <loop-id>`, load the charter, plan, journal, branches, and evidence; confirm no live driver; reconstruct the champion or frontier from committed state; and continue at the next cycle boundary without re-running the meta-grill.
