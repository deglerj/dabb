# Tester Release Process — Design

**Date:** 2026-03-29
**Status:** Approved

## Summary

Automated release process for shipping Dabb to a first group of testers via Android (Play Store internal track) and web (`dabb.degler.info`). Triggered by a single `workflow_dispatch` after the developer writes a changelog entry.

---

## Scope

- **Platforms:** Android (Play Store internal) + web (existing auto-deploy)
- **Not in scope:** iOS / TestFlight

---

## Release Workflow (`release.yml`)

### Trigger

Manual `workflow_dispatch` with one input:

| Input     | Type   | Example | Description                     |
| --------- | ------ | ------- | ------------------------------- |
| `version` | string | `2.1.0` | Full semver, without `v` prefix |

### Prerequisites (developer does before triggering)

1. Add `## [<version>] - YYYY-MM-DD` entry to `CHANGELOG.md` and commit to `main`

### Steps

1. **Validate** — fail fast if `CHANGELOG.md` does not contain `## [<version>]`
2. **Bump versions** — update `version` field in these 4 files (shared packages have independent versioning and are not bumped):
   - `package.json` (root)
   - `apps/server/package.json`
   - `apps/client/package.json`
   - `apps/client/app.json` (`expo.version`)
3. **Commit & push** — `chore: release v<version>` pushed to `main` using a PAT (`GITHUB_PAT` secret) — required because pushes from `GITHUB_TOKEN` do not trigger downstream `workflow_run` events, so CI and the web deploy would not fire otherwise
4. **Tag** — create and push git tag `v<version>`
5. **Extract changelog section** — parse the matching `## [<version>]` block from `CHANGELOG.md`
6. **Create GitHub Release** — title `v<version>`, body = changelog section + links to web app and Play Store
7. **Build Android AAB** — reuse existing Docker builder + signing logic from `publish-android.yml`
8. **Upload to Play Store** — internal track via `r0adkll/upload-google-play`

### Web deployment

The commit pushed in step 3 triggers the existing CI workflow, which on success triggers `deploy.yml` — web deploys automatically, no extra step needed.

---

## What Testers See

### GitHub Releases page

`github.com/deglerj/dabb/releases` serves as the public release history. Each release shows:

- Changelog section for that version
- Link to web app (`https://dabb.degler.info`)
- Link to Play Store listing

### GitHub link in the app

A visible "open source on GitHub" link on the home/lobby screen links to `https://github.com/deglerj/dabb`. This lets testers find the issues page to report bugs without needing to know the URL.

### Privacy policy

A static `/privacy` route on `dabb.degler.info` renders the existing privacy policy text (already written in `docs/play-store-listing.txt`). Required by Play Store before listing goes live.

---

## Versioning Convention

- **MAJOR** — breaking protocol change (users must update)
- **MINOR** — new user-facing feature
- **PATCH** — bug fix or internal change

First tester release: **2.1.0** (one `feat:` + several `fix:` commits since 2.0.0)

---

## Pre-Release Checklist (one-time manual steps)

These are required before the first Play Store submission and cannot be automated:

- [ ] Capture 5 Play Store screenshots (home, waiting room, game in progress, bidding, score table)
- [ ] Paste listing text from `docs/play-store-listing.txt` into Play Console
- [ ] Verify GitHub repo is public (required before surfacing the GitHub link to testers)
- [ ] Confirm privacy policy page is live at `https://dabb.degler.info/privacy`
- [ ] Add Play Store listing URL to GitHub Release template once known

---

## Files to Create / Modify

| File                                                            | Change                                      |
| --------------------------------------------------------------- | ------------------------------------------- |
| `.github/workflows/release.yml`                                 | New — the release workflow                  |
| `apps/client/app/(tabs)/index.tsx` (or equivalent lobby screen) | Add GitHub link                             |
| Web app router                                                  | Add `/privacy` static route                 |
| `CHANGELOG.md`                                                  | Add `## [2.1.0]` entry before first release |
