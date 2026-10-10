#!/usr/bin/env bash
# Refuse commits on the protected branch (see AGENTS.md "Hard gates").
#
#   no-commit-on-main.sh               check the current branch
#   no-commit-on-main.sh --self-test   prove the check accepts and rejects
set -euo pipefail

is_protected() {
  case "$1" in
    main|master) return 0 ;;
    *) return 1 ;;
  esac
}

if [ "${1:-}" = "--self-test" ]; then
  fail=0
  for b in main master; do
    is_protected "$b" || { echo "self-test: expected '$b' to be protected" >&2; fail=1; }
  done
  for b in chore/agent-context feature/main-menu fix/maintenance ""; do
    ! is_protected "$b" || { echo "self-test: expected '$b' to be allowed" >&2; fail=1; }
  done
  [ "$fail" = 0 ] && echo "no-commit-on-main: self-test passed"
  exit "$fail"
fi

branch="$(git symbolic-ref --short -q HEAD || true)"
if is_protected "$branch"; then
  echo "Refusing to commit on '$branch': it is protected. Create a branch first, e.g. git switch -c fix/<short-name>" >&2
  exit 1
fi
