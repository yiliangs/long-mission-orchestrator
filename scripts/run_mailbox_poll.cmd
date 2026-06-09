@echo off
REM LMO inbound feedback poller (scheduled task, every 10 min). Runs as the current user so the
REM router agent has Claude Code auth; Gmail creds + GRANT_SECRET live in ~/.claude/mailbridge.env.
REM cd into the deployed scripts dir so `import mailbridge` resolves. Logs to ~/.claude/mailbox.log.
cd /d "%USERPROFILE%\.claude\scripts"
python mission_mailbox.py poll >> "%USERPROFILE%\.claude\mailbox.log" 2>&1
