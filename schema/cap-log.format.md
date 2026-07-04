# cap-log format (`mission-caps.jsonl`)

Append-only. **One line per mission**, written at DELIVER — even when nothing hit a cap
(`"cap_hits": []`); a missing line is a missing mission, not a clean one. Lives at
`claude-fieldnotes/mission-caps.jsonl` (synced, so both machines feed one dataset). This is
the narrow, fast-to-scan feed the **Tier-2 calibration** loop reads; the full story is in
the mission-record (`mission-record.schema.json`).

One JSON object per line:

```json
{"run_id":"arch-cleanup-20260612","constitution_version":"0.3.2","date":"2026-06-12","mission_class":"M1","plan_fight_rounds_used":1,"plan_fight_rounds_cap":3,"audit_cycles_used":1,"audit_cycles_cap":2,"cold_swaps_used":0,"cold_swaps_cap":1,"tokens_spent":228417,"token_budget":350000,"agents_spawned":25,"agent_budget":24,"cap_hits":[{"node":"mission","cap":"agent_budget","limit":24,"used":25,"would_have_converged":null}]}
```

| Field | Meaning |
|---|---|
| `run_id` | the mission |
| `constitution_version` | governing version — **mandatory**; Tier-2 partitions strictly by it and silently drops unstamped lines |
| `mission_class` | M0 \| M1 \| M2 (§2.4) |
| `<cap>_used` / `<cap>_cap` | usage vs limit for each mission-level cap exercised this run |
| `tokens_spent` / `token_budget`, `agents_spawned` / `agent_budget` | §6.4 budget planned-vs-actual |
| `cap_hits[]` | one entry per **crossed** cap: `{node, cap, limit, used, would_have_converged}`. `node` is the node id, or `"mission"` for mission-level caps (budgets, fight rounds, audit cycles) |
| `would_have_converged` | audit judgment on a hit: `true` = effort-shaped (raise candidate), `false` = structural (cap was right), `null` = unknown |

`cap` names: `micro_loop_retries` \| `sub_loop_iterations` \| `subtree_replans` \|
`plan_fight_rounds` \| `audit_cycles` \| `gate_fix_cycles` \| `cold_swaps` \|
`token_budget` \| `agent_budget`.

**Legacy heterogeneity (honest note):** lines written before this shape settled (v0.1–v0.3.x)
vary — a per-node flat form, a `caps_hit` spelling, one `"cap_hits": 0`. The log is
append-only: never rewrite old lines. Tier-2 parses defensively — a line without
`constitution_version` is dropped; older shapes count within their own version group only
where fields are recognizable.

## How Tier-2 reads it (the adjustment heuristics, constitution §6.2 / §7)

This section is the **single source** for the thresholds — `docs/evolve.md` cites it and must
not restate the numbers. Per `(constitution_version, cap)` group:

- **Raise candidate:** >20% of missions hit the limit AND most hits were `would_have_converged: true`.
- **Lower candidate:** 95th-percentile `used` sits under half of `limit`.
- **Leave:** everything else.

Tier-2 proposes the diff; the Human approves; the cap table in the constitution is amended
and the version bumped. Caps are constitutional text — never self-adjusting.
