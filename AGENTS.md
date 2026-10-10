# AGENTS.md

Rules for every AI agent working in this repository (Claude Code, Codex, Cursor, automated reviewers). Human contributor guidance lives in [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md). Path-specific detail lives in `.claude/rules/`: read the matching file before changing those paths.

| Paths | Rules file |
|---|---|
| `engine/**`, `CMakeLists.txt` | `.claude/rules/engine.md` |
| `ui/src/**` | `.claude/rules/design-system.md` |
| `ui/**` | `.claude/rules/ui-testing.md` |
| `docs/**`, `web/**` | `.claude/rules/docs.md` |
| `ui/package.json`, release workflow, appcast | `.claude/rules/release.md` |

## Project

Stellarr is an open-source guitar signal-processing standalone app for macOS (Apple Silicon). JUCE (C++20) audio engine, React + TypeScript UI connected through the JUCE WebView bridge, Astro + Starlight website and manual. Licence: AGPLv3.

| Area | Path |
|---|---|
| Engine entry / bridge | `engine/StellarrStandaloneApp.cpp`, `engine/StellarrBridge.cpp`, `engine/bridge/` |
| UI entry / bridge / store | `ui/src/main.tsx`, `ui/src/bridge/index.ts`, `ui/src/store/index.ts` |
| Tests | `engine/test/` (C++), `ui/src/**/__tests__/` (Vitest) |
| Manual / manual test cases | `docs/manual/`, `docs/testing/` |
| Website | `web/` |

Build and verify:

- `make dev` builds UI + engine (no tests); `make debug` adds tests; `make test` runs UI tests then ctest.
- `make run` / `make run-debug` / `make run-release` build and launch; `make run-ui` rebuilds only the UI and relaunches the existing engine binary.
- `make dev-ui` or `cd ui && npx tsc --noEmit` catches TypeScript errors; plain `make` does not.
- `cd web && npm ci && npm run build` verifies the website; PR CI does not build `web/`.

## Principles

- **End user first.** Before locking any UI/UX decision, ask whether it is best for the person using the app. Accessibility before convenience: WCAG-aligned defaults (body text at least 11px, sufficient contrast), and wherever proportional scaling could shrink an element below a floor, clamp it with `max(<floor>, ...)` so no setting can defeat it. Discoverability before density (controls live with the workspace they affect). Settings, zoom levels, panel positions and theme persist across launches; anything deliberately ephemeral documents why. The first-launch experience is what a non-technical user expects: dev, debug and experimental surfaces are hidden by default. Disabled controls say why; empty states say what to do; errors point at recovery.
- **Architecturally correct over minimal diff.** Default to the long-term correct approach; do not offer "quick fix vs proper fix" unless asked. Follow existing patterns unless the task is to improve them. Ask when requirements are ambiguous. For significant changes, explain the approach and wait for approval before implementing. Flag breaking changes and cross-cutting dependencies up front.
- **Respect test coverage.** Extend tests where a change warrants it.

## Hard gates

1. **Verify in the running app before committing.** Type-check, tests and build passing are necessary, not sufficient. For UI or runtime changes, state what to test and which command to run (`make run-ui`, `make open`, `make dev`), then wait for the sign-off of the person you are working for before `git add` / `git commit`.
2. **Never open a PR without explicit go-ahead.** Committing on a branch is fine; pushing to open a PR is a separate decision.
3. **Never commit to `main`.** Check the branch first; one branch per task, branched from an up-to-date `main`.
4. **Preview before implementing visual UI.** HTML mockup in light and dark side by side, wait for a pick, then touch `.tsx` / `.module.css` in a separate turn.

## Git workflow

- Before writing code, check the branch. If on `main` or an unrelated branch: stash uncommitted work, switch to `main`, pull, and create a new branch. If already on the right branch for the task, continue on it.
- Branch names: `feature/`, `fix/`, `hotfix/`, `doc/`, `chore/` + short name.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (types and examples in `docs/CONTRIBUTING.md`), imperative mood, first line under 72 characters, issue numbers where applicable, `feat!:` or a `BREAKING CHANGE:` footer for breaking changes.
- **No attribution trailers** (`Co-Authored-By`, "Generated with ...") in commits or PR descriptions.
- Before committing, run all tests (`make test`) and the TypeScript check. Stage only files relevant to the task.
- CI must pass before merge. Squash-merge by default; a regular merge only for large features whose commits tell a story.
- After merge, the remote branch is deleted and work returns to `main`. Ask before deleting local branches.

## Writing and output

- No emoji in any output, log, commit, or generated content.
- New Zealand English spelling and conventions in everything you write (`colour`, `centre`), above all in user-facing copy and docs. Code identifiers from JUCE/React stay as written.
- No generated documentation files unless asked.
- Do not commit design specs, brainstorming notes, or implementation plans. Working specs live in `.superpowers/brainstorm/<session-id>/` (gitignored). Durable truth lives in `docs/manual/`, this file, `.claude/rules/`, PR descriptions, and GitHub release notes.
- Scripts and tooling are Node or Bash. Do not add Python.

## Invariants

One line each; the rules file has the detail.

- **Audio thread:** no allocation, blocking lock, logging, or I/O; never mutate the graph from it; batch graph changes with `UpdateKind::none` and rebuild once; prepare plugin instances before `suspendProcessing`; cross-thread state is `std::atomic`. (`engine.md`)
- **Bridge:** an event changes on both sides (`sendEvent` -> `handleEvent` -> `emitToJs` -> store) or not at all. (`engine.md`)
- **Design system:** tokens only, no raw hex in CSS modules; primitives only, no bespoke `<input>`/`<button>` styling; orchid (primary) = active/selected, amber (secondary) = hover/intent, azure = MIDI only; two chrome text sizes (13/15). (`design-system.md`)
- **Assets:** never copy files that live in `assets/`; symlink or import them.

## Reviewing

Applies to automated PR reviewers and to self-review before committing.

Severity, tagged on every comment:

| Level | Meaning | Examples |
|---|---|---|
| P1 | Must fix before merge: correctness, real-time safety, security, data loss, regressions | Allocation in `processBlock`, graph mutation from the audio thread, non-atomic state shared with the audio thread, one-sided bridge event, off-by-one in a tuner threshold, silent data corruption |
| P2 | Should fix: performance, UX precision, accessibility, observable non-crash regressions | Lost sub-Hz tuner precision, missing aria-label, coarse lock granularity |
| P3 | Nice to fix, one line each: style, naming, dead code, DRY | Repeated ternary, empty `useEffect`, unused import |

Standing lenses: language best practices (C++20, TypeScript); DRY across call sites; dead code and dead React surface; readability (unclear names, missing comments on non-obvious logic); consistency with existing patterns; error handling at system boundaries (user input, external APIs, bridge events, plugin loading); numeric precision in user-facing readouts (`toFixed` vs `Math.round`); design-system bypass (name the token or primitive that should have been used); asset duplication.

Hot spots, where the bar is higher: the real-time audio path; the message/audio thread boundary (`StellarrBridge.cpp`, `engine/bridge/`, plugin loading in `PluginManager.cpp`); the UI-C++ bridge contract; the design-system surface (`tokens.css`, `variables.css`, `components/common/`), where changes ripple to every screen: check for token drift, orchid/amber role inversion, and removal of tokens still referenced elsewhere.

Do not flag: TypeScript errors (`tsc --noEmit` catches them; do flag a diff that suppresses one with `@ts-ignore` or similar); editor-handled whitespace; rewrites of working imperative code; speculative future-proofing. If nothing reaches P1/P2, an automated reviewer leaves a thumbs-up reaction and stops; do not manufacture P3s.

## Where a rule goes

| Kind of rule | Home |
|---|---|
| Binds humans and agents | `docs/CONTRIBUTING.md` |
| Binds every agent | `AGENTS.md` |
| Applies to certain paths only | `.claude/rules/*.md` with `paths:` frontmatter |
| A procedure of more than about three steps | a skill in `.claude/skills/` |
| Must hold every time, without exception | a hook, git hook, or CI check |
| One person's preference | their own memory or `CLAUDE.local.md` |

When a rule is added or changed, record the date and the reason next to it, so later readers can tell a deliberate decision from an accident. (Adopted 2026-10-06 with the harness restructure; rules that predate it are unannotated.)
