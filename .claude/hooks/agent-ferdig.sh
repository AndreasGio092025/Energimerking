#!/usr/bin/env bash
# Kjøres av SubagentStop-hooken: én linje i docs/logg/aktivitet.log per ferdig agent.
# Leser agentnavnet med sed i stedet for jq, siden jq ikke følger med Git Bash på Windows.
input=$(cat)
agent=$(printf '%s' "$input" | tr -d '\r\n' | sed -n 's/.*"agent_type"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -z "$agent" ] && agent="ukjent agent"
dir="${CLAUDE_PROJECT_DIR:-.}/docs/logg"
mkdir -p "$dir"
echo "$(date '+%Y-%m-%d %H:%M') ferdig: $agent" >> "$dir/aktivitet.log"
exit 0
