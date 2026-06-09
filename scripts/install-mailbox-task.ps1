# Register the LMO inbound feedback poller (every 10 min, runs as the user while logged on).
# Run AFTER scripts\deploy.ps1 (this points at the deployed wrapper in ~/.claude\scripts).
# Run once:  powershell -ExecutionPolicy Bypass -File scripts\install-mailbox-task.ps1
$ErrorActionPreference = "Stop"
$scripts = Join-Path $env:USERPROFILE ".claude\scripts"
$vbs  = Join-Path $scripts "run_hidden.vbs"
$poll = Join-Path $scripts "run_mailbox_poll.cmd"
if (-not (Test-Path $poll) -or -not (Test-Path $vbs)) {
    Write-Host "Deploy first — run scripts\deploy.ps1 (need run_hidden.vbs + run_mailbox_poll.cmd in $scripts)"; exit 1
}

# Guarded delete of any stale task (a missing task exits non-zero, which would abort under Stop).
try { schtasks /Delete /F /TN "LMO\MailboxPoll" 2>$null | Out-Null } catch { }
# Through run_hidden.vbs (wscript + hidden window) -> no console popup (the plaid-finance lesson).
schtasks /Create /F /TN "LMO\MailboxPoll" /TR "wscript.exe `"$vbs`" run_mailbox_poll.cmd" /SC MINUTE /MO 10

Write-Host ""
Write-Host "Installed (runs as $env:USERNAME, while logged on):"
Write-Host "  LMO\MailboxPoll   every 10 min  -> mission_mailbox.py poll (route email feedback)"
Write-Host ""
Write-Host "Test now:  schtasks /Run /TN LMO\MailboxPoll"
Write-Host "Inspect:   schtasks /Query /TN LMO\MailboxPoll /V /FO LIST"
Write-Host "Remove:    schtasks /Delete /TN LMO\MailboxPoll /F"
