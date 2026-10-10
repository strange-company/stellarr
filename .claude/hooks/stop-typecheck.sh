#!/usr/bin/env bash
# Stop: if UI sources have uncommitted changes, type-check before handing back.
# Blocks once with the errors so Claude fixes them; never loops.
input="$(cat)"
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}/ui" 2>/dev/null || exit 0
[ -d node_modules ] || exit 0
[ -n "$(git status --porcelain -- src '*.ts' '*.tsx' tsconfig*.json 2>/dev/null)" ] || exit 0
if ! out="$(npx --no-install tsc --noEmit 2>&1)"; then
  jq -n --arg r "TypeScript errors in ui/ (npx tsc --noEmit). Fix them before finishing:
$(head -40 <<<"$out")" '{decision: "block", reason: $r}'
fi
exit 0
