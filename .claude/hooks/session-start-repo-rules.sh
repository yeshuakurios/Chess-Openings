#!/bin/bash
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
marker=".claude/.repo-rules-last-check"
mkdir -p .claude
now=$(date +%s)
last=0
if [ -f "$marker" ]; then
  last=$(cat "$marker" 2>/dev/null || echo 0)
fi
if [ $((now - last)) -gt 86400 ]; then
  echo "$now" > "$marker"
  cat <<'MSG'
REMINDER: More than 24 hours since the shared "Repo Rules" doc was last checked in this repo. Read it now:
https://docs.google.com/document/d/1jrT4eRP6ZEYjZxcc9kvkOfrgfiCJFl6wkbZ7LivLMIU/edit
MSG
fi
