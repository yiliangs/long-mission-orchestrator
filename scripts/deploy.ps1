# Deploy long-mission-orchestrator operative files into ~/.claude so Claude Code can use them.
# The repo is the single source of truth; ~/.claude holds deployed copies.
# EDIT IN THE REPO, THEN REDEPLOY. Never edit the ~/.claude copies directly.
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
$ErrorActionPreference = "Stop"
$repo   = Split-Path -Parent $PSScriptRoot
$claude = Join-Path $env:USERPROFILE ".claude"

New-Item -ItemType Directory -Force -Path "$claude\docs", "$claude\commands", "$claude\workflows", "$claude\scripts" | Out-Null

# Constitution + operating card + schemas + codex adapter spec -> docs/
Copy-Item "$repo\docs\agent-constitution.md"            "$claude\docs\agent-constitution.md"            -Force
Copy-Item "$repo\docs\operating-card.md"                "$claude\docs\operating-card.md"                -Force
Copy-Item "$repo\schema\mission-plan.schema.json"       "$claude\docs\mission-plan.schema.json"         -Force
Copy-Item "$repo\schema\mission-record.schema.json"     "$claude\docs\mission-record.schema.json"       -Force
Copy-Item "$repo\schema\mission-report.schema.json"     "$claude\docs\mission-report.schema.json"       -Force
Copy-Item "$repo\schema\cap-log.format.md"              "$claude\docs\cap-log.format.md"                -Force
Copy-Item "$repo\executors\mission-executor.codex.md"   "$claude\docs\mission-executor.codex.md"        -Force
Copy-Item "$repo\docs\evolve.md"                        "$claude\docs\evolve.md"                        -Force

# Skills -> commands/  (the Human's surface is two channels: email + /mission-log-audit;
# /mission runs the work. evolve.md is an internal procedure in docs/, NOT a command.)
Copy-Item "$repo\skills\mission.md"          "$claude\commands\mission.md"         -Force
Copy-Item "$repo\skills\mission-log-audit.md"   "$claude\commands\mission-log-audit.md"  -Force
Remove-Item "$claude\commands\evolve.md" -ErrorAction SilentlyContinue   # demoted 0.3.4

# Workflow executor -> workflows/
Copy-Item "$repo\executors\mission-executor.workflow.js" "$claude\workflows\mission-executor.workflow.js" -Force

# Deterministic helpers -> scripts/
Copy-Item "$repo\scripts\classify-mission.js"   "$claude\scripts\classify-mission.js"   -Force
Copy-Item "$repo\scripts\mission_heartbeat.ps1" "$claude\scripts\mission_heartbeat.ps1" -Force
Copy-Item "$repo\scripts\validate_record.py"    "$claude\scripts\validate_record.py"    -Force
Copy-Item "$repo\scripts\diff_overlap.py"       "$claude\scripts\diff_overlap.py"       -Force

# Email channel (constitution §12) -> scripts/  (config lives at ~/.claude\mailbridge.env, not synced)
Copy-Item "$repo\scripts\mailbridge.py"          "$claude\scripts\mailbridge.py"          -Force
Copy-Item "$repo\scripts\mission_mailbox.py"     "$claude\scripts\mission_mailbox.py"     -Force
Copy-Item "$repo\scripts\md2html.py"             "$claude\scripts\md2html.py"             -Force
Copy-Item "$repo\scripts\run_mailbox_poll.cmd"   "$claude\scripts\run_mailbox_poll.cmd"   -Force
Copy-Item "$repo\scripts\run_hidden.vbs"         "$claude\scripts\run_hidden.vbs"         -Force
Copy-Item "$repo\scripts\mailbridge.env.example" "$claude\scripts\mailbridge.env.example" -Force

Write-Host "Deployed long-mission-orchestrator -> $claude"
Write-Host "  docs/      agent-constitution, schemas, codex adapter"
Write-Host "  commands/  /mission /mission-log-audit  (evolve demoted to docs/ at 0.3.4)"
Write-Host "  workflows/ mission-executor.workflow.js"
Write-Host "  scripts/   classify-mission, mailbridge + mission_mailbox (email channel)"
