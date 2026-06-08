#!/usr/bin/env bash
# Deploy long-mission-orchestrator operative files into ~/.claude so Claude Code can use them.
# The repo is the single source of truth; ~/.claude holds deployed copies.
# EDIT IN THE REPO, THEN REDEPLOY. Never edit the ~/.claude copies directly.
#
#   bash scripts/deploy.sh
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
claude="${HOME}/.claude"

mkdir -p "$claude/docs" "$claude/commands" "$claude/workflows"

# Constitution + schemas + codex adapter spec -> docs/
cp "$repo/docs/agent-constitution.md"          "$claude/docs/agent-constitution.md"
cp "$repo/schema/mission-plan.schema.json"     "$claude/docs/mission-plan.schema.json"
cp "$repo/schema/mission-record.schema.json"   "$claude/docs/mission-record.schema.json"
cp "$repo/schema/cap-log.format.md"            "$claude/docs/cap-log.format.md"
cp "$repo/executors/mission-executor.codex.md" "$claude/docs/mission-executor.codex.md"

# Skills -> commands/
cp "$repo/skills/mission.md"        "$claude/commands/mission.md"
cp "$repo/skills/evolve.md"         "$claude/commands/evolve.md"
cp "$repo/skills/mission-accept.md" "$claude/commands/mission-accept.md"

# Workflow executor -> workflows/
cp "$repo/executors/mission-executor.workflow.js" "$claude/workflows/mission-executor.workflow.js"

echo "Deployed long-mission-orchestrator -> $claude"
