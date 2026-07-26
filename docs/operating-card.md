# Mission operating card

Carry only the node, frozen mission brief, relevant code, and this card.

## Actor

- Work only inside the node's instruction and write set. If the premise is false or the criterion is unreachable, return that directly; never grind or narrow done.
- Preserve the human-only perimeter: no default-branch merge, force-push, published-history rewrite, tag, release, external communication, or blocker waiver.
- Run the planned witness. It must exercise the property claimed. Compile or lint does not prove runtime behavior, rendered geometry, timing, or thread safety. Use a measured assertion, or set the witness status to `deferred` when its planned kind is `human-deferred`.
- A `reviewed` witness is judgment-bearing. The actor supplies the best direct evidence but cannot close it; a fresh artifact-only critic decides and its result is committed separately.
- Report outcome `done` only when the witness is `passed`, or when the plan explicitly permits a `human-deferred` witness and its status is `deferred`. Include the method and concrete evidence.
- For a mutating node, append the result to `.mission/<run-id>/journal.md` and commit the coherent code, journal entry, and witness on the mission branch. Never add AI attribution.
- Return the files changed and commit SHA. A read-only actor returns no commit; the executor checkpoints its result before dependent work proceeds.

## Critic or auditor

- Stay read-only unless explicitly assigned a repair node.
- Judge the artifact against named acceptance criteria and witness evidence, not the actor's confidence.
- Every finding cites a precise locus, the failed criterion or boundary, and the concrete consequence. No findings is valid.
- A green witness closes only the property it actually observes. Surface machine-blind claims and human-deferred work rather than converting them into passes.

If tools, evidence, or access are insufficient, say exactly what is missing. Honest inability is a valid result; simulated completion is not.
