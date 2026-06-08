# cap-log format (`mission-caps.jsonl`)

Append-only. One line per **node that hit a cap**, written at mission DELIVER.
Lives at `claude-fieldnotes/mission-caps.jsonl` (synced, so both machines feed one
dataset). This is the narrow, fast-to-scan feed the **Tier-2 calibration** loop reads;
the full story is in the mission-record (`mission-record.schema.json`).

One JSON object per line:

```json
{"run_id":"...","constitution_version":"0.1","node":"n3","cap":"micro_loop_retries","limit":3,"used":3,"outcome":"cap-hit","would_have_converged":true}
```

| Field | Meaning |
|---|---|
| `run_id` | the mission |
| `constitution_version` | governing version — never aggregate across versions |
| `node` | node id |
| `cap` | which cap: `micro_loop_retries` \| `sub_loop_iterations` \| `subtree_replans` \| `plan_fight_rounds` \| `audit_cycles` \| `cold_swaps` |
| `limit` | the cap value in force |
| `used` | iterations actually consumed |
| `outcome` | `converged` (finished at/under limit) \| `cap-hit` (stopped by the cap) |
| `would_have_converged` | audit judgment on cap-hits: `true` = effort-shaped (raise candidate), `false` = structural (cap was right), `null` = unknown |

## How Tier-2 reads it (the adjustment heuristics, constitution §6.2 / §7)

Per `(constitution_version, cap)` group:
- **Raise candidate:** >20% of nodes hit the limit AND most hits were `would_have_converged: true`.
- **Lower candidate:** 95th-percentile `used` sits under half of `limit`.
- **Leave:** everything else.

Tier-2 proposes the diff; the Human approves; the cap table in the constitution is amended
and the version bumped. Caps are constitutional text — never self-adjusting.
