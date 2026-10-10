---
paths:
  - "ui/package.json"
  - ".github/workflows/release.yml"
  - "web/public/appcast.xml"
  - "scripts/update-appcast.ts"
  - "scripts/lib/appcast.ts"
---

# Versioning and releases

- SemVer: MINOR for new user-facing behaviour or design-system additions; PATCH for polish, fixes, and refactors with no functional change.
- `ui/package.json` `"version"` is the single source of truth. CMake reads it at configure time (UI, engine, Info.plist, window title); Vite injects `__APP_VERSION__` at build time.
- Before tagging, bump it in a `chore: bump to vX.Y.Z` commit and run `npm install` in `ui/` to sync `ui/package-lock.json`.
- Merge the bump PR, then tag from `main` (`git tag vX.Y.Z`) and run `gh release create vX.Y.Z` with the changelog in the release body. The GitHub release body is the authoritative changelog; there is no `CHANGELOG.md`.
- The release workflow signs the DMG with the Sparkle EdDSA key (GitHub Actions secret `SPARKLE_PRIVATE_KEY_PROD`) and opens a bot PR appending the release to `web/public/appcast.xml`. Merging that PR publishes the update via `stellarr.org/appcast.xml`. Never edit the appcast by hand.
- Rotate Sparkle keys with `make regen-sparkle-keys-prod` / `make regen-sparkle-keys-dev`. Rotating the prod key invalidates update trust for every installed build; only do it in response to a key compromise.
