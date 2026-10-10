@AGENTS.md

# Claude Code

Everything in `AGENTS.md` applies. This file adds what is specific to Claude Code.

- `.claude/rules/*.md` load automatically when you work on matching paths; you do not need to open them by hand.
- **Workflow for significant changes:** agree the approach first (plan mode or a short written proposal), write the working spec to `.superpowers/brainstorm/<session-id>/spec.md` (never `docs/superpowers/specs/`) and any mockups to `.../content/`; list `.superpowers/brainstorm/` to pick up prior work; then execute an approved plan with one fresh subagent per task and a review between tasks. Skip the subagents only when asked to.
- **Local review before committing:** run `codex review --uncommitted` for non-trivial changes and address findings inline. Run it for engine logic, UI behaviour or styling, multi-file refactors, and docs that describe code behaviour, commands, paths or configuration. Skip it for wording-only edits, dependency bumps, version chores and trivial style tweaks. Codex picks its default model; pin one with `-c model=<name>` only with a reason.
- **Hooks** (`.claude/hooks/`, registered in `.claude/settings.json`): session start prints branch state and the hard gates; `git commit` on `main` is denied; editing a CSS module with a raw hex colour adds a warning; finishing a turn with uncommitted `ui/` changes runs `tsc --noEmit` and blocks once on errors. `bash .claude/hooks/test-hooks.sh` (part of `make check`) tests them.
- **Responses:** focused and actionable; no summary after each successful edit.
- **Profiling React renders:** react-scan loads only in dev builds. See `.claude/rules/ui-testing.md` for the workflow and the eight canonical scenarios.
- Personal preferences belong in your own memory or a gitignored `CLAUDE.local.md`, not here.
