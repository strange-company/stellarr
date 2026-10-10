#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): advise when a CSS module gains a raw hex
# colour. Advisory only; `make check` and CI are the blocking gate.
file="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')"
case "$file" in *.module.css) ;; *) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! out="$(node scripts/checks/no-raw-hex.mjs "$file" 2>&1)"; then
  jq -n --arg c "Design-system rule: $out" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}}'
fi
exit 0
