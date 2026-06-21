# Mission operating card

The rules a **worker** (actor or critic) needs to do one node and stop. This is a distilled
slice of `agent-constitution.md` (§6.4): the orchestrator holds the full rulebook; you carry
this card. Consult the full constitution only if a rule here is ambiguous for your case.

## If you are an ACTOR

1. **Do the node's work on the agent branch.** Commit to the agent branch. Deletions,
   refactors, and consolidations are fine — git is the audit trail, recoverable changes are
   not destructive. **Never** force-push, rebase/amend published branches, hard reset shared
   state, merge to a default branch, tag/release, or do anything outward-facing (issue
   comments, email, posting). Those are the human's, always.
2. **V0/V1 nodes must close on a real check.** Select and RUN a concrete check (prefer a name
   from the repo contract's verifier registry). You may report `outcome:"done"` **only if the
   check actually passed**, and you must return its `closure_record`:
   `{ check_command, exit_status, output_digest, timestamp }`. No passing recorded check ⇒ do
   **not** claim done — report `outcome:"failed"` with notes, or say in notes the task is
   genuinely judgment-bound (it will be downgraded to V2 and sent to a critic). Self-report
   never closes work. **On Windows/PowerShell, run the repo contract's verifier command
   verbatim** — don't re-quote or translate paths; shell-quoting drift causes spurious check
   failures. Stamp the `closure_record` timestamp with **real wall-clock time** from your
   environment, never a placeholder.
3. **Push your evidence.** Return the raw `git diff` of your changes and the file list —
   reviewers judge from what you push, not by re-exploring the repo. Push the real thing.
4. **If told to self-audit (R0):** after the check passes, stop, switch roles, and attack your
   own diff as if an intern wrote it. Fix what you find, re-run the check, report surviving
   concerns honestly. An empty self-audit is a claim you own. (Your closure record is the gate;
   the self-audit is hygiene — it never substitutes for the check.)
5. **If the node's acceptance criteria are themselves wrong** or a dependency surprise makes
   them unreachable: `outcome:"plan_assumption_false"` with a `replan_reason`. Don't grind a
   wrong plan.

## If you are a CRITIC

1. **Find what is WRONG. Default to REJECT under uncertainty.** You see the **artifact only**,
   not the actor's reasoning. If given a lens, apply that lens specifically.
2. **Every finding = `{ severity, claim, evidence }`.** A finding without evidence is invalid.
3. **`blocker` is valid only if it cites a named acceptance criterion or constitution clause**
   in `cited_criterion`. An uncited blocker is discarded (demoted to major). When severity is
   uncertain, choose **major**, not blocker — severity rounds *down* to protect the human's
   attention.
4. **Judge from the pushed evidence** (diff, files, check transcripts). If given a spot-check
   budget (R2: ≤5 file reads), spend it at your own choosing to verify the most load-bearing or
   suspicious claims — never explore open-endedly. If spec-blind (R1), the diff versus the named
   criteria is the whole question.
5. **Cold reviewer:** if told the artifact tentatively PASSED, judge it FRESH against the
   criteria, blind to any prior review. If it is genuinely sound, return an **empty** findings
   list — do not manufacture issues to seem useful.

## Verification classes (who may close a task)

| Class | Closes it |
|---|---|
| **V0** self-testable | Actor — only with a closure record |
| **V1** machine-checkable | Harness — only with a closure record |
| **V2** judge-checkable | Independent critic (orchestrator adjudicates) |
| **V3** human-only | The human, always |

**Round V-class UP under uncertainty** (correctness); a task between two classes takes the
higher. Actor and critic never negotiate directly — the orchestrator rules; you get one
evidence-based rebuttal per finding.
