#!/usr/bin/env bash
# Self-test for the Claude Code hook scripts: pipe the JSON each hook receives
# and assert on what it prints. Runs in a throwaway git repo so branch state
# can be controlled. Called by `make check`.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hooks="$repo_root/.claude/hooks"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0

expect() { # name, expected substring ('' = expect no output), actual output
  if [ -z "$2" ]; then
    [ -z "$3" ] || { echo "FAIL $1: expected no output, got: $3" >&2; fail=1; }
  else
    case "$3" in *"$2"*) ;; *) echo "FAIL $1: expected '$2', got: $3" >&2; fail=1 ;; esac
  fi
}

mkdir -p "$tmp/scripts/checks"
cp "$repo_root"/scripts/checks/* "$tmp/scripts/checks/"
git -C "$tmp" init -q -b main
export CLAUDE_PROJECT_DIR="$tmp"
bash_input='{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix: x\""}}'

expect "guard denies on main" '"permissionDecision": "deny"' "$(echo "$bash_input" | bash "$hooks/guard-main-commit.sh")"
expect "session warns on main" "create a task branch" "$(echo '{}' | bash "$hooks/session-context.sh")"

git -C "$tmp" switch -q -c fix/example
expect "guard allows on a branch" "" "$(echo "$bash_input" | bash "$hooks/guard-main-commit.sh")"
expect "session quiet about main on a branch" "branch fix/example" "$(echo '{}' | bash "$hooks/session-context.sh")"

printf '.a { color: #ff0000; }\n' > "$tmp/Bad.module.css"
printf '.a { color: var(--accent); }\n' > "$tmp/Good.module.css"
expect "hex advisory fires" '"additionalContext"' \
  "$(jq -n --arg f "$tmp/Bad.module.css" '{tool_name:"Edit",tool_input:{file_path:$f}}' | bash "$hooks/css-hex-advisory.sh")"
expect "hex advisory quiet on clean file" "" \
  "$(jq -n --arg f "$tmp/Good.module.css" '{tool_name:"Edit",tool_input:{file_path:$f}}' | bash "$hooks/css-hex-advisory.sh")"
expect "hex advisory ignores other files" "" \
  "$(echo '{"tool_name":"Edit","tool_input":{"file_path":"ui/src/App.tsx"}}' | bash "$hooks/css-hex-advisory.sh")"

expect "stop hook never loops" "" "$(echo '{"stop_hook_active":true}' | bash "$hooks/stop-typecheck.sh")"
expect "stop hook skips without ui/" "" "$(echo '{"stop_hook_active":false}' | bash "$hooks/stop-typecheck.sh")"

[ "$fail" = 0 ] && echo "claude hooks: self-test passed"
exit "$fail"
