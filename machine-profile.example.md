# Machine profile (NOT synced — gitignored)

Per-machine facts. Synced artifacts (constitution, contracts, plan.json) speak in
**roles**, never hostnames; this file binds roles to physical hardware at runtime
(constitution §10). Each machine writes its own as `docs/machine-profile.md` (gitignored,
local). This `.example` is a template only — never put a real hostname here.

```yaml
hostname: YOUR-HOSTNAME
roles: [light]          # light = planning, prose, smoke-tests; heavy = training, big experiments
cpu: <cpu model>
gpu: <gpu model + VRAM>
ram: <GB>
shell: PowerShell (default); bash available via tool
notes:
  - State confidentiality posture (e.g. no confidential or internal repos cleared for autonomous runs).
  - Note the GPU ceiling (what training fits locally vs. must go to the heavy machine).
  - Heavy nodes (compute_role_required=heavy) on a light machine are deferred or dispatched.
```

A `light` machine declares `roles: [light]`; the real-deal training host declares
`roles: [heavy, light]`. On first `/mission`, a new machine auto-drafts its real profile by
probing hardware — you approve it before it is written.
