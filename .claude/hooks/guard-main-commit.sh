#!/usr/bin/env bash
# PreToolUse (Bash, if: git commit*): deny commits on the protected branch
# before git runs, with the reason surfaced to Claude.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! reason="$(bash scripts/checks/no-commit-on-main.sh 2>&1)"; then
  jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
fi
exit 0
