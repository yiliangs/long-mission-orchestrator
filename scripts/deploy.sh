#!/usr/bin/env bash
# Deploy long-mission-orchestrator operative files into ~/.claude so Claude Code can use them.
# The repo is the single source of truth; ~/.claude holds deployed copies.
# EDIT IN THE REPO, THEN REDEPLOY. Never edit the ~/.claude copies directly.
#
#   bash scripts/deploy.sh
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
claude="${HOME}/.claude"

mkdir -p "$claude/docs" "$claude/commands" "$claude/workflows" "$claude/scripts"

# Constitution + operating card + schemas + codex adapter spec -> docs/
cp "$repo/docs/agent-constitution.md"          "$claude/docs/agent-constitution.md"
cp "$repo/docs/operating-card.md"              "$claude/docs/operating-card.md"
cp "$repo/schema/mission-plan.schema.json"     "$claude/docs/mission-plan.schema.json"
cp "$repo/schema/mission-record.schema.json"   "$claude/docs/mission-record.schema.json"
cp "$repo/schema/mission-report.schema.json"   "$claude/docs/mission-report.schema.json"
cp "$repo/schema/cap-log.format.md"            "$claude/docs/cap-log.format.md"
cp "$repo/executors/mission-executor.codex.md" "$claude/docs/mission-executor.codex.md"

cp "$repo/docs/evolve.md"              "$claude/docs/evolve.md"

# Skills -> commands/  (the Human's surface is two channels: email + /mission-log-audit;
# /mission runs the work. evolve.md is an internal procedure in docs/, NOT a command.)
cp "$repo/skills/mission.md"        "$claude/commands/mission.md"
cp "$repo/skills/mission-loop.md"   "$claude/commands/mission-loop.md"
cp "$repo/skills/mission-log-audit.md" "$claude/commands/mission-log-audit.md"
rm -f "$claude/commands/evolve.md"   # demoted 0.3.4

# Workflow executor -> workflows/
cp "$repo/executors/mission-executor.workflow.js" "$claude/workflows/mission-executor.workflow.js"

# Deterministic helpers -> scripts/
cp "$repo/scripts/classify-mission.js" "$claude/scripts/classify-mission.js"
cp "$repo/scripts/validate_record.py"  "$claude/scripts/validate_record.py"
cp "$repo/scripts/diff_overlap.py"     "$claude/scripts/diff_overlap.py"

# Channel (§12): the shared claude-channel dispatcher owns the inbox now. LMO ships only its
# router (invoked by the dispatcher's `route`) + its OWN app manifest (deployed here, per the
# router-and-manifest-version-together rule). The transport (channelbridge.py) is owned + deployed
# by the claude-channel repo; deploy that first.
mkdir -p "$claude/channel/apps.d"
cp "$repo/scripts/mission_mailbox.py"     "$claude/scripts/mission_mailbox.py"
cp "$repo/scripts/md2html.py"             "$claude/scripts/md2html.py"
cp "$repo/scripts/run_hidden.vbs"         "$claude/scripts/run_hidden.vbs"
cp "$repo/channel/lmo.json"               "$claude/channel/apps.d/lmo.json"

echo "Deployed long-mission-orchestrator -> $claude"
