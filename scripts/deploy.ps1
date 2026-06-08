# Deploy long-mission-orchestrator operative files into ~/.claude so Claude Code can use them.
# The repo is the single source of truth; ~/.claude holds deployed copies.
# EDIT IN THE REPO, THEN REDEPLOY. Never edit the ~/.claude copies directly.
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
$ErrorActionPreference = "Stop"
$repo   = Split-Path -Parent $PSScriptRoot
$claude = Join-Path $env:USERPROFILE ".claude"

New-Item -ItemType Directory -Force -Path "$claude\docs", "$claude\commands", "$claude\workflows" | Out-Null

# Constitution + schemas + codex adapter spec -> docs/
Copy-Item "$repo\docs\agent-constitution.md"            "$claude\docs\agent-constitution.md"            -Force
Copy-Item "$repo\schema\mission-plan.schema.json"       "$claude\docs\mission-plan.schema.json"         -Force
Copy-Item "$repo\schema\mission-record.schema.json"     "$claude\docs\mission-record.schema.json"       -Force
Copy-Item "$repo\schema\cap-log.format.md"              "$claude\docs\cap-log.format.md"                -Force
Copy-Item "$repo\executors\mission-executor.codex.md"   "$claude\docs\mission-executor.codex.md"        -Force

# Skills -> commands/
Copy-Item "$repo\skills\mission.md"          "$claude\commands\mission.md"         -Force
Copy-Item "$repo\skills\evolve.md"           "$claude\commands\evolve.md"          -Force
Copy-Item "$repo\skills\mission-accept.md"   "$claude\commands\mission-accept.md"  -Force

# Workflow executor -> workflows/
Copy-Item "$repo\executors\mission-executor.workflow.js" "$claude\workflows\mission-executor.workflow.js" -Force

Write-Host "Deployed long-mission-orchestrator -> $claude"
Write-Host "  docs/      agent-constitution, schemas, codex adapter"
Write-Host "  commands/  /mission /evolve /mission-accept"
Write-Host "  workflows/ mission-executor.workflow.js"
