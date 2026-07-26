# LMO mission heartbeat: orchestrator-armed recovery from committed mission state.
#
# A crash, reboot, or usage-window boundary must not erase a mission. The orchestrator arms a
# per-run scheduled task after freeze and disarms it at a persisted terminal result. Each beat is idempotent:
#   active run             -> exit
#   interrupted run        -> resume from committed plan, audits, journal, witnesses, and branch state
#   terminal or absent run -> verify task deletion, then exit
#   heartbeat.dead present -> quiet re-disarm; escalate the same failure only once
#
#   arm:     powershell.exe -NoProfile -ExecutionPolicy Bypass -File mission_heartbeat.ps1 arm    -RunDir <repo>\.mission\<run-id>
#   beat:    (scheduled task only)                          mission_heartbeat.ps1 beat   -Lock <run-dir>\mission.lock
#   disarm:  powershell.exe -NoProfile -ExecutionPolicy Bypass -File mission_heartbeat.ps1 disarm -RunDir <repo>\.mission\<run-id>
#   status:  powershell.exe -NoProfile -ExecutionPolicy Bypass -File mission_heartbeat.ps1 status -RunDir <repo>\.mission\<run-id>
#
# Headless resume carries a per-invocation grant for the tools needed to reconstruct state,
# run the canonical executor, and write delivery artifacts. Arming authorizes that recovery
# path for this run only; no standing settings change is made.
param(
    [Parameter(Mandatory = $true, Position = 0)][ValidateSet('arm', 'beat', 'disarm', 'status')]
    [string]$Action,
    [string]$RunDir,
    [string]$Lock,
    [int]$IntervalMin = 30,   # beat cadence
    [int]$StaleMin = 45,      # no activity for this long => the run is presumed dead
    [int]$RunawayStop = 20,   # insurance against a fooled progress detector -- NOT a policy knob.
                              # Recovery resumes are uncounted by design (a mission spanning N usage
                              # windows legitimately resumes N times); futility detection below is
                              # the real recovery guard. This only brakes a runaway edge case.
    [switch]$DryRun,          # beat: log the resume decision but do not launch claude
    [switch]$ForceResume      # beat: human one-tap relaunch (heartbeat.relaunch.cmd) -- clears the
                              # tombstone + ledger and resumes regardless of staleness
)
$ErrorActionPreference = 'Stop'
$LogFile = Join-Path $env:USERPROFILE '.claude\heartbeat.log'
$ScriptsDir = Join-Path $env:USERPROFILE '.claude\scripts'

function Log([string]$msg) {
    $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $msg
    Write-Host $line
    # Best-effort append: concurrent beats (or an interactive session tailing the log) can hold
    # the file, and under $ErrorActionPreference='Stop' a single failed Add-Content would abort the
    # whole beat. Logging is telemetry, never load-bearing -- retry briefly, then give up silently.
    for ($i = 0; $i -lt 5; $i++) {
        try { Add-Content -Path $LogFile -Value $line -ErrorAction Stop; break }
        catch { Start-Sleep -Milliseconds 60 }
    }
}

# Claude Code encodes a path into a projects/ dir name by replacing every non-alphanumeric
# char with '-'. Worktree sessions write their transcript under the MAIN repo's project dir.
function Encode-ProjectDir([string]$path) { return ($path -replace '[^A-Za-z0-9]', '-') }

function Get-RunKey([string]$runDir) {
    $normalized = [System.IO.Path]::GetFullPath($runDir).TrimEnd('\').ToLowerInvariant()
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
        $hash = [System.BitConverter]::ToString($algorithm.ComputeHash($bytes)).Replace('-', '')
        return $hash.Substring(0, 12)
    }
    finally { $algorithm.Dispose() }
}

function Get-TaskName([string]$runDir, [string]$runId) {
    return "LMO\Heartbeat-$runId-$(Get-RunKey $runDir)"
}

function Get-WrapperPath([string]$runDir, [string]$runId) {
    return Join-Path $ScriptsDir "heartbeat-$runId-$(Get-RunKey $runDir).cmd"
}

# Verified disarm. The old shape -- `try { schtasks /Delete ... } catch { }` --
# swallowed every failure, so a beat could log "self-disarm" while the task kept firing
# (observed: ~34 re-escalations over 21.5h on 2026-07-02-salary-atlas). Delete via cmd /c
# (no PowerShell stderr-stream wrapping under ErrorActionPreference=Stop), then PROVE the
# task is gone with a query. Returns $true only when the task provably no longer exists.
function Disarm-Task([string]$taskName, [string]$wrapperPath) {
    cmd /c "schtasks /Delete /F /TN `"$taskName`" >nul 2>&1" | Out-Null
    Remove-Item $wrapperPath -ErrorAction SilentlyContinue
    cmd /c "schtasks /Query /TN `"$taskName`" >nul 2>&1" | Out-Null
    return ($LASTEXITCODE -ne 0)   # query failing to find it is the proof of deletion
}

function Resolve-Roots([string]$runDir) {
    # <repo-root>\.mission\<run-id> -> repo root (may be a worktree) + main repo root
    $repoRoot = Split-Path -Parent (Split-Path -Parent $runDir)
    $mainRoot = $repoRoot
    $ix = $repoRoot.IndexOf('\.claude\worktrees\')
    if ($ix -gt 0) { $mainRoot = $repoRoot.Substring(0, $ix) }
    return @($repoRoot, $mainRoot)
}

function Find-Transcripts($cfg) {
    # Newest-first session transcripts that belong to this repo (or its worktrees) and
    # mention the run id. The prefix filter keeps sibling repos (natalie_share) and
    # unrelated sessions that merely discuss the run out of the candidate set.
    $projects = Join-Path $env:USERPROFILE '.claude\projects'
    Get-ChildItem $projects -Directory |
        Where-Object { $_.Name -eq $cfg.project_prefix -or $_.Name -like ($cfg.project_prefix + '--*') } |
        ForEach-Object { Get-ChildItem $_.FullName -Filter '*.jsonl' -File -ErrorAction SilentlyContinue } |
        Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-14) } |
        Where-Object { Select-String -Path $_.FullName -Pattern $cfg.run_id -Quiet -ErrorAction SilentlyContinue } |
        Sort-Object LastWriteTime -Descending
}

switch ($Action) {

    'arm' {
        if (-not $RunDir) { throw 'arm requires -RunDir' }
        $RunDir = (Resolve-Path $RunDir).Path
        $runId = Split-Path -Leaf $RunDir
        $roots = Resolve-Roots $RunDir
        $taskName = Get-TaskName $RunDir $runId
        $wrapperPath = Get-WrapperPath $RunDir $runId
        $wrapperName = Split-Path -Leaf $wrapperPath
        $lockPath = Join-Path $RunDir 'mission.lock'
        $driverPid = 0
        $driverStarted = $null
        if ([int]::TryParse($env:CLAUDE_PID, [ref]$driverPid) -and $driverPid -gt 0) {
            $driverProcess = Get-Process -Id $driverPid -ErrorAction SilentlyContinue
            if ($driverProcess) { $driverStarted = $driverProcess.StartTime.ToUniversalTime().ToString('o') }
        }

        $cfg = [ordered]@{
            run_id         = $runId
            run_dir        = $RunDir
            cwd            = $roots[1]                     # main repo root: where transcripts + resume live
            project_prefix = Encode-ProjectDir $roots[1]
            task           = $taskName
            driver_pid     = $driverPid
            driver_started = $driverStarted
            driver_session = $env:CLAUDE_CODE_SESSION_ID
            interval_min   = $IntervalMin
            stale_min      = $StaleMin
            armed_at       = (Get-Date -Format 'o')
        }
        $cfg | ConvertTo-Json | Set-Content -Path $lockPath -Encoding UTF8

        # Fresh start: clear any resume ledger / dead / disarmed / relaunch markers left by a
        # prior arming of this run, so a deliberate re-arm (e.g. after the human resolves the
        # usage window) is not instantly disarmed by a spent budget from last time.
        Remove-Item (Join-Path $RunDir 'heartbeat.resumes.json'), (Join-Path $RunDir 'heartbeat.dead'),
                    (Join-Path $RunDir 'heartbeat.disarmed'), (Join-Path $RunDir 'heartbeat.relaunch.cmd') -ErrorAction SilentlyContinue

        # Per-run beat wrapper (hard-coded lock path) so run_hidden.vbs needs no arg plumbing.
        $cmdPath = $wrapperPath
        @"
@echo off
REM Auto-generated by mission_heartbeat.ps1 arm -- beat wrapper for run $runId.
cd /d "%USERPROFILE%\.claude\scripts"
REM Wrapper output goes to its OWN log: a `>> heartbeat.log` here holds the file handle for the
REM entire beat (hours during a resume) and starves the ps1's Add-Content to the same file --
REM the observed 139 "process cannot access the file" collisions. The wrapper log is a crash
REM net only; real telemetry is heartbeat.log, written solely by the ps1.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File mission_heartbeat.ps1 beat -Lock "$lockPath" >> "%USERPROFILE%\.claude\heartbeat.wrapper.log" 2>&1
"@ | Set-Content -Path $cmdPath -Encoding ASCII

        $vbs = Join-Path $ScriptsDir 'run_hidden.vbs'
        if (-not (Test-Path $vbs)) { throw "run_hidden.vbs not deployed -- run scripts\deploy.ps1 first" }
        try { schtasks /Delete /F /TN $taskName 2>$null | Out-Null } catch { }
        schtasks /Create /F /TN $taskName /TR "wscript.exe `"$vbs`" $wrapperName" /SC MINUTE /MO $IntervalMin | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Remove-Item $lockPath, $cmdPath -ErrorAction SilentlyContinue
            throw "Failed to create scheduled task $taskName (exit $LASTEXITCODE)"
        }
        schtasks /Query /TN $taskName 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Remove-Item $lockPath, $cmdPath -ErrorAction SilentlyContinue
            throw "Scheduled task $taskName was not registered"
        }
        Log "ARM   $runId  task=$taskName every ${IntervalMin}min  stale>${StaleMin}min  lock=$lockPath"
    }

    'beat' {
        if (-not $Lock) { throw 'beat requires -Lock' }
        $runDirFromLock = Split-Path -Parent $Lock
        $runId = Split-Path -Leaf $runDirFromLock
        $taskName = Get-TaskName $runDirFromLock $runId
        $wrapperPath = Get-WrapperPath $runDirFromLock $runId

        # Absent marker -> disarm + exit (mission ended and cleaned up, or run dir gone).
        # Quiet retry loop by construction: if the verified delete fails, the next beat lands
        # here again and re-attempts -- one line of log per beat, never an escalation.
        if (-not (Test-Path $Lock)) {
            $ok = Disarm-Task $taskName $wrapperPath
            Log "BEAT  $runId  lock absent -> self-disarm $(if ($ok) {'verified'} else {'FAILED - task still registered (human-attention alarm)'})"
            exit 0
        }
        $cfg = Get-Content $Lock -Raw | ConvertFrom-Json

        # Human one-tap relaunch (heartbeat.relaunch.cmd): explicit override. Clear the tombstone
        # and the futility ledger so the resume below gets a fresh window, and skip the staleness
        # gate -- the human has already judged the run worth reviving.
        if ($ForceResume) {
            Remove-Item (Join-Path $cfg.run_dir 'heartbeat.dead'), (Join-Path $cfg.run_dir 'heartbeat.resumes.json') -ErrorAction SilentlyContinue
            Log "BEAT  $runId  -ForceResume (human relaunch) -> tombstone + futility ledger cleared"
        }

        # Tombstone (recovery invariant -- the same death is NEVER escalated twice): heartbeat.dead means
        # a prior beat already escalated this death. If we are still firing, that beat's disarm
        # evidently failed -- quietly re-attempt + verify, never re-escalate, never resume.
        # (The observed failure: ~34 consecutive dead-escalations, one per beat, 2026-07-02.)
        if (Test-Path (Join-Path $cfg.run_dir 'heartbeat.dead')) {
            $ok = Disarm-Task $taskName $wrapperPath
            Log "BEAT  $runId  tombstone present -> quiet re-disarm $(if ($ok) {'verified'} else {'FAILED - task still registered'}) -> exit"
            exit 0
        }
        # Zombie beat (recovery invariant -- disarm is verified): heartbeat.disarmed is written only after
        # a PROVEN task deletion, so a beat firing past it means the task returned from the dead.
        if (Test-Path (Join-Path $cfg.run_dir 'heartbeat.disarmed')) {
            $ok = Disarm-Task $taskName $wrapperPath
            Log "BEAT  $runId  ZOMBIE beat after verified disarm (human-attention alarm) -> re-disarm $(if ($ok) {'verified'} else {'FAILED'}) -> exit"
            exit 0
        }

        # Terminal marker -> validate the complete committed terminal state before disarming.
        # REPORT.md may describe failure; result.json is terminal only when its schema, canonical
        # audit, success marker, and committed files agree. A failed delete keeps the lock so the
        # next beat retries.
        $resultPath = Join-Path $cfg.run_dir 'result.json'
        if (Test-Path $resultPath) {
            $validator = Join-Path $ScriptsDir 'validate_terminal.py'
            & python $validator $cfg.run_dir *> $null
            if ($LASTEXITCODE -eq 0) {
                $terminal = Get-Content $resultPath -Raw | ConvertFrom-Json
                $terminalStatus = [string]$terminal.status
                $ok = Disarm-Task $taskName $wrapperPath
                Log "BEAT  $runId  valid terminal result=$terminalStatus -> self-disarm $(if ($ok) {'verified'} else {'FAILED - task still registered; retrying next beat'})"
                if ($ok) {
                    Get-Date -Format 'o' | Set-Content -Path (Join-Path $cfg.run_dir 'heartbeat.disarmed') -Encoding ASCII
                    Remove-Item $Lock -ErrorAction SilentlyContinue
                }
                exit 0
            }
            Log "BEAT  $runId  result.json present but terminal validation failed -> recovery remains armed"
        }

        # The driver that armed recovery owns the run while its exact process instance lives.
        # PID plus start time avoids mistaking a later process that reused the PID for the driver.
        if (-not $ForceResume -and $cfg.driver_pid -and $cfg.driver_started) {
            $driver = Get-Process -Id ([int]$cfg.driver_pid) -ErrorAction SilentlyContinue
            if ($driver -and $driver.StartTime.ToUniversalTime().ToString('o') -eq [string]$cfg.driver_started) {
                Log "BEAT  $runId  active driver pid=$($cfg.driver_pid) session=$($cfg.driver_session) -> exit"
                exit 0
            }
        }

        # Two DISTINCT signals, deliberately not the same timestamp:
        #
        #   $artifactMark -- newest MISSION-PROGRESS write: run-dir artifacts (journal, plan.json,
        #     partial outputs) MINUS the heartbeat's own bookkeeping. This is the FUTILITY signal.
        #     It EXCLUDES the session transcript on purpose: a resumed `claude` dirties its transcript
        #     jsonl just by loading and echoing the prompt -- even when it bounces off the usage limit
        #     and produces zero mission progress. Folding the transcript in here would let an
        #     unproductive resume masquerade as progress and slip past the one-futile-resume cap (the
        #     RunawayStop=20 cousin of the original 23-firing loop). Real work touches the run dir
        #     (the canonical recovery recovery state), so a productive resume still advances this.
        #
        #   $newest -- newest activity of ANY kind, transcript included. This is the STALENESS signal:
        #     a live session actively driving the run keeps its transcript warm, so idle detection
        #     SHOULD see it (otherwise we'd resume on top of a working session).
        $bookkeeping = @('mission.lock', 'heartbeat.spawning', 'heartbeat.resumes.json', 'heartbeat.dead',
                         'heartbeat.disarmed', 'heartbeat.relaunch.cmd')
        $transcripts = @(Find-Transcripts $cfg)
        $artifactMark = (Get-Item $Lock).LastWriteTime
        Get-ChildItem $cfg.run_dir -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $bookkeeping -notcontains $_.Name } |
            ForEach-Object { if ($_.LastWriteTime -gt $artifactMark) { $artifactMark = $_.LastWriteTime } }
        $newest = $artifactMark
        if ($transcripts.Count -gt 0 -and $transcripts[0].LastWriteTime -gt $newest) { $newest = $transcripts[0].LastWriteTime }
        $idleMin = [int]((Get-Date) - $newest).TotalMinutes
        if (-not $ForceResume -and $idleMin -lt $cfg.stale_min) {
            Log "BEAT  $runId  active (last touch ${idleMin}min ago < $($cfg.stale_min)) -> exit"
            exit 0
        }

        # Recovery invariant -- "a stale heartbeat survives at most one FUTILE firing." Resume is
        # recovery plumbing: a mission that spans N usage windows legitimately resumes N times, so
        # recovery resumes are UNCOUNTED. The only thing this ledger detects is FUTILITY -- a resume
        # that produced no new mission ARTIFACT (not just transcript noise) is a dead resume, and
        # re-firing it every interval just burns the usage window (observed: 23 firings on
        # natalie-fable-revision-20260609, staleness 59->599 min, zero progress, ~400K cold tokens
        # per beat). Futility is measured against $artifactMark, NOT $newest -- a resume that loaded,
        # echoed, and died touches only the transcript, which $artifactMark excludes by design. One
        # futile resume => DISARM + heartbeat.dead marker for the morning report -- a
        # dead-and-unrecoverable run is a human-attention alarm, not something to retry into the ground.
        # Work thoroughness is the executor's job; the heartbeat only detects and resumes interrupted runs.
        $ledgerPath = Join-Path $cfg.run_dir 'heartbeat.resumes.json'
        $ledger = if (Test-Path $ledgerPath) { Get-Content $ledgerPath -Raw | ConvertFrom-Json }
                  else { [pscustomobject]@{ resumes = 0; resumed_from = '' } }
        $resumes = [int]$ledger.resumes
        $deadReason = $null
        if ($resumes -ge 1 -and $ledger.resumed_from -and ([datetime]$ledger.resumed_from -ge $artifactMark)) {
            $deadReason = "prior resume produced no mission artifact (stale ${idleMin}min, artifact mark did not advance after resume $resumes)"
        }
        elseif ($resumes -ge $RunawayStop) {
            $deadReason = "runaway stop ($resumes resumes) -- progress detector is being fooled; human inspection required"
        }
        if ($deadReason) {
            # Recovery dead-escalation: happens ONCE (the tombstone above silences every later
            # beat), leaves the human a one-tap relaunch, and the disarm is verified.
            $relaunchPath = Join-Path $cfg.run_dir 'heartbeat.relaunch.cmd'
            $deadMsg = "Mission $runId presumed dead and unrecoverable by heartbeat: $deadReason. " +
                "A human must inspect the run dir ($($cfg.run_dir)) and resume or close it. " +
                "One-tap relaunch: $relaunchPath"
            if (-not $DryRun) {
                Set-Content -Path (Join-Path $cfg.run_dir 'heartbeat.dead') -Value $deadMsg -Encoding UTF8
                @"
@echo off
REM One-tap relaunch for mission $runId -- written by the heartbeat at dead-escalation
REM (constitution recovery invariant: heartbeat.dead + a prepared relaunch command, then stop).
REM Re-fires the same headless resume the heartbeat would have run, clearing the tombstone
REM and futility ledger for a fresh window. Safe to run more than once (spawn guard applies).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ScriptsDir\mission_heartbeat.ps1" beat -Lock "$Lock" -ForceResume
pause
"@ | Set-Content -Path $relaunchPath -Encoding ASCII
            }
            $ok = $true
            if (-not $DryRun) { $ok = Disarm-Task $taskName $wrapperPath }
            Log "BEAT  $runId  $deadReason -> escalate ONCE (heartbeat.dead + relaunch cmd) + self-disarm $(if ($ok) {'verified'} else {'FAILED - tombstone will silence + retry next beat'})$(if ($DryRun) {' [DRY-RUN]'})"
            exit 0
        }

        # Spawn guard: one resume in flight at a time (a resumed mission can run for hours).
        $spawnLock = Join-Path $cfg.run_dir 'heartbeat.spawning'
        if ((Test-Path $spawnLock) -and ((Get-Date) - (Get-Item $spawnLock).LastWriteTime).TotalHours -lt 6) {
            Log "BEAT  $runId  resume already in flight -> exit"
            exit 0
        }
        Get-Date -Format 'o' | Set-Content -Path $spawnLock

        # Record this resume in the ledger BEFORE launching: the next beat compares $artifactMark
        # against resumed_from to decide whether this resume actually moved a mission artifact (above).
        # We stamp the PRE-resume artifact mark so "no advance" means "no new run-dir artifact since
        # we fired" -- transcript churn from the resume itself cannot satisfy it.
        if (-not $DryRun) {
            [pscustomobject]@{
                resumes      = ($resumes + 1)
                resumed_from = $artifactMark.ToString('o')
                last_resume  = (Get-Date -Format 'o')
            } | ConvertTo-Json | Set-Content -Path $ledgerPath -Encoding UTF8
        }

        # Orientation hint -- last-step.md is an optional, advisory file the orchestrator MAY write
        # after each meaningful action ("FREEZE done, EXECUTE node 3a in flight, awaiting critic").
        # It is NOT state: plan.json + journal remain the source of truth. The hint only saves the
        # resumed agent one round of orientation. Forward-compatible: absent file means no hint.
        # Capped at ~600 chars so a runaway append cannot pad the resume prompt.
        $hintPath = Join-Path $cfg.run_dir 'last-step.md'
        $hint = ''
        if (Test-Path $hintPath) {
            try {
                $raw = (Get-Content $hintPath -Raw -ErrorAction Stop)
                if ($raw.Length -gt 600) { $raw = $raw.Substring(0, 600) + '...' }
                $hint = " Orientation hint from prior session (advisory only -- re-derive truth from plan.json + journal): " + (($raw -replace '\s+', ' ').Trim().TrimEnd('.')) + "."
            } catch { $hint = '' }
        }

        $prompt = "[heartbeat] Recovery beat for mission run $($cfg.run_id). " +
            "Run dir: $($cfg.run_dir). A prior driver appears dead after ${idleMin} minutes without activity. " +
            "Assess state from charter.md when present, plan.json, journal.md or journal, partial artifacts, " +
            "witness results, and recent branch commits.$hint Before acting, load ~/.claude/docs/agent-constitution.md " +
            "and the target repository's .mission/contract.md; if the contract is absent, stop and report an " +
            "eligibility defect. Recovery rules: (1) if the run is complete or the run dir is gone, disarm via: " +
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptsDir\mission_heartbeat.ps1 disarm " +
            "-RunDir '$($cfg.run_dir)' and stop. (2) if the run is waiting on a human gate, or a live driver is " +
            "active, stop without acting. (3) otherwise claim the run in mission.lock with the current CLAUDE_PID, " +
            "process start time, and CLAUDE_CODE_SESSION_ID, then resume from frozen and committed state; do not " +
            "repeat the grill, narrow acceptance criteria, or reinterpret silence as permission. For a mission, reconstruct " +
            "the completed map only from committed closure evidence, run the canonical executor with args " +
            "{ plan, completed }, consume its integrated audit, then deliver. For a loop, continue at the next " +
            "cycle boundary."

        try {
            if ($transcripts.Count -gt 0) {
                $sid = $transcripts[0].BaseName
                Log "BEAT  $runId  stale ${idleMin}min -> resume session $sid (cwd $($cfg.cwd))$(if ($DryRun) {' [DRY-RUN]'})"
                if (-not $DryRun) {
                    Push-Location $cfg.cwd
                    try { claude --resume $sid -p $prompt --permission-mode dontAsk --allowedTools "Workflow,Read,Glob,Grep,Bash,Write,Edit" 2>&1 | ForEach-Object { Add-Content $LogFile "          $_" } }
                    finally { Pop-Location }
                }
            } else {
                # No transcript survives -- committed state in the run dir is the canonical
                # recovery point (recovery invariant); start fresh and let it re-orient.
                Log "BEAT  $runId  stale ${idleMin}min, no transcript -> fresh resume (cwd $($cfg.cwd))$(if ($DryRun) {' [DRY-RUN]'})"
                if (-not $DryRun) {
                    Push-Location $cfg.cwd
                    try { claude -p $prompt --permission-mode dontAsk --allowedTools "Workflow,Read,Glob,Grep,Bash,Write,Edit" 2>&1 | ForEach-Object { Add-Content $LogFile "          $_" } }
                    finally { Pop-Location }
                }
            }
            Log "BEAT  $runId  resume attempt finished"
        } finally {
            Remove-Item $spawnLock -ErrorAction SilentlyContinue
        }
    }

    'disarm' {
        if (-not $RunDir) { throw 'disarm requires -RunDir' }
        $RunDir = [System.IO.Path]::GetFullPath($RunDir)
        $runId = Split-Path -Leaf $RunDir
        $taskName = Get-TaskName $RunDir $runId
        $wrapperPath = Get-WrapperPath $RunDir $runId
        $ok = Disarm-Task $taskName $wrapperPath
        Remove-Item (Join-Path $RunDir 'mission.lock') -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $RunDir 'heartbeat.spawning') -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $RunDir 'heartbeat.resumes.json') -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $RunDir 'heartbeat.dead') -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $RunDir 'heartbeat.disarmed') -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $RunDir 'heartbeat.relaunch.cmd') -ErrorAction SilentlyContinue
        Log "DISARM $runId  task removal $(if ($ok) {'verified'} else {'FAILED - TASK STILL REGISTERED (human-attention alarm): schtasks /Delete /F /TN ""$taskName"" by hand'}); lock + markers removed"
    }

    'status' {
        if (-not $RunDir) { throw 'status requires -RunDir' }
        $RunDir = [System.IO.Path]::GetFullPath($RunDir)
        $runId = Split-Path -Leaf $RunDir
        $taskName = Get-TaskName $RunDir $runId
        schtasks /Query /TN $taskName /FO LIST 2>$null
        $lockPath = Join-Path $RunDir 'mission.lock'
        if (Test-Path $lockPath) { Write-Host "--- mission.lock ---"; Get-Content $lockPath }
        else { Write-Host "no mission.lock at $lockPath" }
        if (Test-Path $LogFile) { Write-Host "--- last beats ---"; Get-Content $LogFile -Tail 8 }
    }
}
