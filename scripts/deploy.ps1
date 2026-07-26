# Deploy long-mission-orchestrator operative files into ~/.claude.
# The repository is the source of truth; ~/.claude contains deployed copies only.
#
#   powershell.exe -ExecutionPolicy Bypass -File scripts\deploy.ps1
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$claude = Join-Path $env:USERPROFILE ".claude"
$version = (Get-Content (Join-Path $repo 'VERSION') -Raw).Trim()

function Get-Sha256([string]$Path) {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '')
    }
    finally {
        $stream.Dispose()
        $algorithm.Dispose()
    }
}

function Copy-Verified([string]$Source, [string]$Destination) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    if ((Get-Sha256 $Source) -ne (Get-Sha256 $Destination)) {
        throw "Deployment verification failed: $Source -> $Destination"
    }
}

New-Item -ItemType Directory -Force -Path "$claude\docs", "$claude\commands", "$claude\workflows", "$claude\scripts", "$claude\channel\apps.d" | Out-Null

Copy-Verified "$repo\VERSION" "$claude\docs\lmo-version.txt"
Copy-Verified "$repo\docs\agent-constitution.md" "$claude\docs\agent-constitution.md"
Copy-Verified "$repo\docs\operating-card.md" "$claude\docs\operating-card.md"
Copy-Verified "$repo\docs\mission-contract-default.md" "$claude\docs\mission-contract-default.md"
Copy-Verified "$repo\schema\mission-plan.schema.json" "$claude\docs\mission-plan.schema.json"
Copy-Verified "$repo\schema\mission-audit.schema.json" "$claude\docs\mission-audit.schema.json"
Copy-Verified "$repo\schema\mission-repair.schema.json" "$claude\docs\mission-repair.schema.json"
Copy-Verified "$repo\schema\mission-result.schema.json" "$claude\docs\mission-result.schema.json"

Copy-Verified "$repo\skills\mission.md" "$claude\commands\mission.md"
Copy-Verified "$repo\skills\mission-loop.md" "$claude\commands\mission-loop.md"
Copy-Verified "$repo\skills\mission-log-audit.md" "$claude\commands\mission-log-audit.md"

Copy-Verified "$repo\executors\mission-executor.workflow.js" "$claude\workflows\mission-executor.workflow.js"

Copy-Verified "$repo\scripts\mission_heartbeat.ps1" "$claude\scripts\mission_heartbeat.ps1"
Copy-Verified "$repo\scripts\run_hidden.vbs" "$claude\scripts\run_hidden.vbs"
Copy-Verified "$repo\scripts\validate_record.py" "$claude\scripts\validate_record.py"
Copy-Verified "$repo\scripts\validate_terminal.py" "$claude\scripts\validate_terminal.py"
Copy-Verified "$repo\scripts\mission_notify.py" "$claude\scripts\mission_notify.py"
Copy-Verified "$repo\channel\lmo.json" "$claude\channel\apps.d\lmo.json"

$obsolete = @(
    "$claude\docs\mission-governance.md",
    "$claude\docs\mission-record.schema.json",
    "$claude\docs\mission-report.schema.json",
    "$claude\docs\cap-log.format.md",
    "$claude\docs\mission-executor.codex.md",
    "$claude\docs\evolve.md",
    "$claude\commands\evolve.md",
    "$claude\scripts\classify-mission.js",
    "$claude\scripts\diff_overlap.py",
    "$claude\scripts\mission_mailbox.py",
    "$claude\scripts\md2html.py"
)
foreach ($path in $obsolete) {
    Remove-Item -LiteralPath $path -ErrorAction SilentlyContinue
}

Write-Host "Deployed long-mission-orchestrator $version -> $claude"
Write-Host "  authority   agent constitution; default contract seed for target repos"
Write-Host "  commands    /mission /mission-loop /mission-log-audit"
Write-Host "  runtime     plan/audit/result schemas + executor + heartbeat"
Write-Host "  reporting   outbound terminal email through shared Claude Channel"
Write-Host "  verified    every deployed file matches its canonical source"
Write-Host "  removed     legacy V/R/M, evolution, record, and inbound mailbox surfaces"
