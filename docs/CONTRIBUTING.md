# Contributing to Stellarr

Thank you for your interest in contributing. This guide covers the development setup, project structure, and build system.

## Platform

Stellarr currently targets **macOS on Apple Silicon** only.

## Prerequisites

- macOS on Apple Silicon (M1 or later)
- CMake 3.24+
- Xcode Command Line Tools
- Node.js 22.12+ (CI uses Node 24)
- npm

## Project Structure

```
engine/          C++ audio engine, plugin host, and WebView bridge
engine/blocks/   Block implementations (Input, Output, Plugin)
engine/bridge/   Bridge event handlers (graph, params, scenes, MIDI, presets, input block, updates)
engine/test/     Audio processing and integration tests
ui/              React + TypeScript frontend (Vite, Zustand, Radix UI, CSS Modules)
ui/src/bridge/   JS-side bridge (sendEvent / addEventListener)
ui/src/store/    Zustand state store
docs/manual/     User manual (Markdown, with Starlight frontmatter)
docs/testing/    Dev manual-test cases (Markdown, with Starlight frontmatter)
web/             Astro site — landing at / and Starlight docs at /docs/*
assets/          Brand assets (logo, icon) and samples
```

## Architecture

- **Engine (C++):** JUCE AudioProcessorGraph for audio routing. Each block is a `juce::AudioProcessor` node in the graph.
- **UI (React/TS):** Zustand store as single source of truth. Radix UI primitives. CSS Modules for styling.
- **Bridge:** UI calls `sendEvent(name, json)` which reaches C++ `handleEvent`. Engine pushes state back via `emitToJs(name, json)` which fires `addEventListener` callbacks that update the Zustand store.
- **Tests:** C++ test executables gated behind `BUILD_TESTING` CMake flag. Each test file has its own `main()`.
- **Convention:** Declarations in headers, implementations in `.cpp` files.

## Make Targets

| Target | Description |
|---|---|
| `make dev` | Build UI + engine (no tests), clears WebView cache |
| `make debug` | Build UI + engine with tests |
| `make release` | Optimised build |
| `make run` | Build and launch (debug) |
| `make run-release` | Build and launch (release) |
| `make test` | Build with tests and run them |
| `make docs` | Run the Astro site dev server (landing + manual, hot reload) on port 4321 |
| `make clean` | Remove build/, ui/dist/, and ui/node_modules/ |

### First build

The first build fetches JUCE via git and compiles the `juceaide` tool. This takes several minutes. Subsequent builds are incremental.

## Development Workflow

### UI hot reload

Run the Vite dev server for rapid UI iteration:

```
cd ui
npm run dev
```

Then rebuild the UI (`npm run build`) before launching the app to see changes in the WebView.

### WebKit Inspector

In debug builds, right-click anywhere in the app window and select "Inspect Element" to open the WebKit Inspector. Bridge activity is logged to the console with `[Bridge]` prefix.

### Running tests

```
make test
```

This runs the UI tests (Vitest), then builds with `BUILD_TESTING=ON` and runs the engine test suites via CTest. Always run tests before submitting a pull request.

### TypeScript checks

The `make` targets build the UI with Vite, but that does not catch all TypeScript errors. Always run:

```
cd ui && npx tsc --noEmit
```

or `make dev-ui` to verify the UI compiles cleanly.

## Build Outputs

The build produces a **standalone macOS application** at `build/Stellarr_artefacts/Debug/Standalone/Stellarr.app` (or `Release` for release builds).

## Repository Checks

`make setup` enables the project git hooks (`git config core.hooksPath .githooks`): commit messages are checked against the policy below, and commits on `main` are refused. `make check` runs the same checks over your branch, plus the design-system rule against raw hex colours in CSS modules; CI runs it on every pull request. The checks live in `scripts/checks/` and each has a `--self-test`.

## Branches and Merging

Never commit directly to `main`; it is protected. Branch from an up-to-date `main`, one branch per change:

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<short-name>` | `feature/undo-redo` |
| Bug fix | `fix/<short-name>` | `fix/scan-freeze` |
| Hotfix | `hotfix/<short-name>` | `hotfix/crash-on-load` |
| Documentation | `doc/<short-name>` | `doc/update-midi-manual` |
| Chore | `chore/<short-name>` | `chore/bump-actions` |

Pull requests are squash-merged by default, so each PR lands as a single commit on `main`. Branches are deleted after merge.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

Examples:

```
feat: add MIDI learn to parameter knobs
fix: resolve crash on load (#12)
docs: update preset manual page
chore: bump JUCE to 8.x
```

Use `feat!:` or a `BREAKING CHANGE:` footer for breaking changes. Keep the first line under 72 characters.

## Pull Request Guidelines

- Keep PRs focused on a single change
- Run `make test` and `npx tsc --noEmit` before submitting
- Update the relevant [user manual](manual/) page if your change affects user-facing behaviour
- Match existing code style and conventions (no linter config yet -- follow the patterns you see)

## Working with AI Agents

AI coding agents are welcome. Their rules live in [`AGENTS.md`](../AGENTS.md) (read by Claude Code, Codex, Cursor and others), with path-specific detail in `.claude/rules/`. The same gates apply to agent-assisted changes as to hand-written ones: verify the change in the running app, keep the PR focused, and do not include AI attribution trailers in commits or PR descriptions.

## Licence

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0](../LICENSE).
