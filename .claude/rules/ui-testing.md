---
paths:
  - "ui/**"
---

# UI testing and profiling

## Testing UI

- Runner: Vitest + JSDOM + `@testing-library/react`
- `cd ui && npm run test` — run all UI tests
- `cd ui && npm run test:watch` — watch mode
- Token tests use a `getVar()` helper (in `ui/src/design/__tests__/tokens.test.ts`) to resolve one level of `var()` indirection since JSDOM does not

## How to profile React renders

Runtime instrumentation is provided by [`react-scan`](https://github.com/aidenybai/react-scan), loaded dynamically inside an `import.meta.env.DEV` gate in `ui/src/main.tsx`. It is absent from production bundles — verify after any change to that gate with:

```bash
cd ui && npm run build
grep -rl "react-scan" dist/ && echo "FAIL: leaked into prod" || echo "OK: tree-shaken"
```

**Workflow.** Launch the dev app with `make run-ui`, trigger the scenario you are measuring, and read render counts off the react-scan overlay (and the browser console). When doing a perf audit, capture per-scenario counts into a markdown table in your session's `.superpowers/brainstorm/<session>/` working directory so any subsequent fix work can measure improvement against the baseline.

**Canonical render-sensitive scenarios.** Future audits should hit the same hotpaths so results stay comparable across releases:

1. Grid scroll + drag a block.
2. Grid cell-zoom change (S → M → L).
3. Options panel open / close on a block.
4. Slider drag (Mix / Balance / Level in Options panel).
5. State switch + scene recall.
6. MIDI monitor live event stream (20 Hz updates).
7. Tuner active (20 Hz strobe + Hz readout).
8. Preset switch (load preset → graph rebuild).
