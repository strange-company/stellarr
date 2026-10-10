#!/usr/bin/env bash
# SessionStart: orient the session (branch, dirty files, hard gates).
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
branch="$(git symbolic-ref --short -q HEAD || echo 'detached HEAD')"
dirty="$(git status --porcelain --ignore-submodules=all | wc -l | tr -d ' ')"
echo "Stellarr session context: branch ${branch}, ${dirty} uncommitted file(s)."
case "$branch" in
  main|master) echo "On ${branch}: create a task branch before changing code (AGENTS.md, Git workflow)." ;;
esac
[ "$(git config core.hooksPath)" = ".githooks" ] || echo "Git hooks are not enabled in this clone; run make setup."
echo "Hard gates: verify in the running app before committing; never open a PR without explicit go-ahead."
exit 0
