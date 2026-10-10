---
paths:
  - "docs/**"
  - "web/**"
---

# Documentation and website

- The user manual lives in `docs/manual/`; dev test cases live in `docs/testing/` (TC-XX-NNN format). Both are Markdown with Starlight frontmatter (`title`, `description`, `sidebar: { order }`) and are rendered by the Astro + Starlight site in `web/`, served at `stellarr.org/docs/*`.
- When adding or significantly changing a user-facing feature, update the relevant manual page.
- Match the existing tone: concise, second person, no jargon without explanation. New Zealand English.
- Do not create new manual pages unless asked; extend existing ones.
- Link other pages with absolute URL paths (for example `[MIDI](/docs/midi/)`); Starlight resolves them.
- Verify the site locally with `cd web && npm ci && npm run build` (runs `astro check` then `astro build`). PR CI does not install or build `web/`; only the post-merge Deploy Site workflow does.
- Do not bump `web/` to TypeScript 7: `astro check` cannot run on it yet.
