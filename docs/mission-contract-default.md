# Mission Contract

This repository is eligible for `/mission`. This baseline records only facts safe to assume for an eligible Git repository.

## Checks

| Claim | Command | Basis |
|---|---|---|
| The current tracked, uncommitted patch has no whitespace or conflict-marker errors | `git diff HEAD --check` | Git worktree |

## Critical paths

| Path | Why | Basis |
|---|---|---|
| `.mission/contract.md` | Defines this repository's mission checks and constraints | LMO fixed location |

## Machine-blind properties

- The default check does not inspect untracked files, committed mission changes, or behavior.

## Mission boundaries

- **Established:** local Git checkout.
- **Unknown until evidenced:** project toolchain, generated-deliverable policy, credentials, remote services, paid resources, deployment targets, and publication channels.

Unknown concerns availability, not authorization.
