# Tester Release Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate releasing Dabb to testers via a single GitHub Actions workflow that bumps versions, creates a GitHub Release, builds the Android AAB, and publishes to the Play Store internal track — while also adding a GitHub link to the options dialog and a `/privacy` web route.

**Architecture:** Three independent deliverables: (1) a UI change to `OptionsDialog` that adds a GitHub link using the existing `info.sourceCode` i18n key, (2) a new Expo Router screen at `/privacy` serving the static privacy policy text, and (3) a `release.yml` workflow triggered manually with a version input that validates CHANGELOG, bumps all version files, pushes with a PAT to trigger downstream CI/deploy, creates a GitHub Release, builds and uploads the AAB.

**Tech Stack:** React Native + Expo Router (UI), GitHub Actions (workflow), `jq` + `awk` (version/changelog manipulation), `docker` (Android AAB builder), `r0adkll/upload-google-play` (Play Store upload), `gh` CLI (GitHub Release).

---

## File Map

| File                                              | Action | Purpose                                          |
| ------------------------------------------------- | ------ | ------------------------------------------------ |
| `apps/client/src/components/ui/OptionsDialog.tsx` | Modify | Add GitHub link row after language section       |
| `apps/client/src/app/privacy.tsx`                 | Create | `/privacy` route with static privacy policy text |
| `.github/workflows/release.yml`                   | Create | Automated release workflow                       |

---

## Task 1: Add GitHub link to OptionsDialog

**Files:**

- Modify: `apps/client/src/components/ui/OptionsDialog.tsx`

The `info.sourceCode` i18n key already exists (`"Quellcode auf GitHub"` / `"Source code on GitHub"`). Add a small tappable link at the bottom of the dialog using `Linking.openURL`.

- [ ] **Step 1: Add `Linking` to the React Native import**

In `apps/client/src/components/ui/OptionsDialog.tsx`, change the first import line:

```tsx
import {
  Linking,
  Modal,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
```

- [ ] **Step 2: Add the GitHub link row after the language section**

Insert the following block immediately after the closing `</View>` of `styles.languageSection` and before `{onExitGame && (`:

```tsx
{
  /* GitHub link */
}
<View style={styles.githubRow}>
  <TouchableOpacity onPress={() => void Linking.openURL('https://github.com/deglerj/dabb')}>
    <Text style={styles.githubLink}>{t('info.sourceCode')}</Text>
  </TouchableOpacity>
</View>;
```

- [ ] **Step 3: Add styles for the GitHub link row**

Add to the `StyleSheet.create({...})` object (before the closing `}`):

```tsx
  githubRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.paperEdge,
    paddingTop: 12,
    marginTop: 6,
    alignItems: 'center',
  },
  githubLink: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
    textDecorationLine: 'underline',
  },
```

- [ ] **Step 4: Verify locally**

Run the web dev server:

```bash
pnpm --filter @dabb/client start
```

Open the options dialog. Confirm the "Quellcode auf GitHub" / "Source code on GitHub" link appears below the language flags, and tapping it opens `https://github.com/deglerj/dabb` in the browser.

- [ ] **Step 5: Run CI check**

```bash
pnpm run build && pnpm run lint && pnpm run typecheck
```

Expected: all pass with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/components/ui/OptionsDialog.tsx
git commit -m "feat: add GitHub link to options dialog"
```

---

## Task 2: Add /privacy route

**Files:**

- Create: `apps/client/src/app/privacy.tsx`

Expo Router picks up any file in `src/app/` as a route. `privacy.tsx` becomes `/privacy` on the web build — the URL the Play Store listing needs for the privacy policy.

The screen shows both the German and English privacy policy texts (no routing logic needed — the Play Store just needs a URL, and users of both languages benefit from seeing both).

- [ ] **Step 1: Create the privacy screen file**

Create `apps/client/src/app/privacy.tsx` with this content:

```tsx
/**
 * Privacy policy — accessible at /privacy on web.
 * Required as a public URL by the Google Play Store listing.
 */
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme.js';

const PRIVACY_DE = `Diese App speichert keine personenbezogenen Daten dauerhaft. Beim Erstellen oder Beitreten einer Spielrunde wird ein frei gewählter Spitzname an den Spielserver übertragen und dort für die Dauer der Spielsitzung gespeichert. Nach Beendigung der Sitzung werden diese Daten gelöscht. Es werden keine Konten erstellt, keine E-Mail-Adressen erhoben und keine Daten an Dritte weitergegeben.`;

const PRIVACY_EN = `This app does not store any personal data permanently. When creating or joining a game session, a freely chosen nickname is transmitted to the game server and stored for the duration of that session. Once the session ends, this data is deleted. No accounts are created, no email addresses are collected, and no data is shared with third parties.`;

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.appTitle}>Dabb</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>Datenschutzerklärung</Text>
        <Text style={styles.body}>{PRIVACY_DE}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.heading}>Privacy Policy</Text>
        <Text style={styles.body}>{PRIVACY_EN}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.woodDark,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  appTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.paperFace,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  section: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 20,
  },
  heading: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.inkDark,
    marginBottom: 12,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkMid,
    lineHeight: 22,
  },
  divider: {
    height: 16,
  },
});
```

- [ ] **Step 2: Verify the route on web**

```bash
pnpm --filter @dabb/client start
```

Navigate to `http://localhost:8081/privacy` in a browser. Confirm both privacy policy sections are visible with correct styling.

- [ ] **Step 3: Run CI check**

```bash
pnpm run build && pnpm run lint && pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/app/privacy.tsx
git commit -m "feat: add /privacy route for Play Store listing"
```

---

## Task 3: Create release.yml workflow

**Files:**

- Create: `.github/workflows/release.yml`

This workflow:

1. Validates the CHANGELOG has an entry for the requested version
2. Bumps `version` in the 4 app-level files using `jq`
3. Commits and pushes using `GITHUB_PAT` (required — pushes from `GITHUB_TOKEN` do not trigger downstream `workflow_run` events, so CI and web deploy would not fire)
4. Creates and pushes the git tag
5. Extracts the changelog section using `awk`
6. Creates a GitHub Release with the changelog text + links
7. Builds the Android AAB using the same Docker builder as `publish-android.yml`
8. Uploads the AAB to Play Store internal track

**Required secret (add before first run):** `GITHUB_PAT` — a personal access token with `repo` scope, added to the `production` environment in GitHub → Settings → Environments → production → Secrets.

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version number without v prefix (e.g. 2.1.0)'
        required: true
        type: string

jobs:
  release:
    name: Release v${{ inputs.version }}
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_PAT }}
          fetch-depth: 0

      - name: Validate CHANGELOG entry
        run: |
          if ! grep -q "^## \[${{ inputs.version }}\]" CHANGELOG.md; then
            echo "ERROR: No entry for version ${{ inputs.version }} found in CHANGELOG.md"
            echo "Add a '## [${{ inputs.version }}] - YYYY-MM-DD' section to CHANGELOG.md and commit it before triggering this workflow."
            exit 1
          fi

      - name: Bump versions
        run: |
          VERSION="${{ inputs.version }}"
          jq ".version = \"$VERSION\"" package.json > tmp.json && mv tmp.json package.json
          jq ".version = \"$VERSION\"" apps/server/package.json > tmp.json && mv tmp.json apps/server/package.json
          jq ".version = \"$VERSION\"" apps/client/package.json > tmp.json && mv tmp.json apps/client/package.json
          jq '.expo.version = "'$VERSION'"' apps/client/app.json > tmp.json && mv tmp.json apps/client/app.json

      - name: Commit and push version bump
        run: |
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add package.json apps/server/package.json apps/client/package.json apps/client/app.json
          git commit -m "chore: release v${{ inputs.version }}"
          git push

      - name: Create and push tag
        run: |
          git tag "v${{ inputs.version }}"
          git push origin "v${{ inputs.version }}"

      - name: Extract changelog section
        run: |
          VERSION="${{ inputs.version }}"
          awk "/^## \[$VERSION\]/{found=1; next} found && /^## \[/{exit} found{print}" CHANGELOG.md \
            > /tmp/release-notes.md
          echo "" >> /tmp/release-notes.md
          echo "---" >> /tmp/release-notes.md
          echo "" >> /tmp/release-notes.md
          echo "**Play now (web):** https://dabb.degler.info" >> /tmp/release-notes.md
          echo "**Android:** [Google Play internal track](https://play.google.com/store/apps/details?id=com.dabb.binokel)" >> /tmp/release-notes.md

      - name: Create GitHub Release
        run: |
          gh release create "v${{ inputs.version }}" \
            --title "v${{ inputs.version }}" \
            --notes-file /tmp/release-notes.md
        env:
          GH_TOKEN: ${{ secrets.GITHUB_PAT }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Build Android builder image
        uses: docker/build-push-action@v7
        with:
          context: .
          file: apps/client/Dockerfile.android
          push: false
          load: true
          tags: dabb-android-builder:release
          cache-from: type=gha,scope=android-builder
          cache-to: type=gha,mode=max,scope=android-builder

      - name: Cache Gradle dependencies
        uses: actions/cache@v5
        with:
          path: /tmp/gradle-cache
          key: ${{ runner.os }}-gradle-aab-${{ hashFiles('apps/client/package.json') }}
          restore-keys: |
            ${{ runner.os }}-gradle-aab-
            ${{ runner.os }}-gradle-

      - name: Decode keystore
        run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > /tmp/dabb-keystore.jks

      - name: Build AAB in Docker
        run: |
          mkdir -p /tmp/gradle-cache
          docker run --rm \
            -v "${{ github.workspace }}:/app" \
            -v /tmp/gradle-cache:/gradle-cache \
            -v /tmp/dabb-keystore.jks:/tmp/dabb-keystore.jks:ro \
            -e GRADLE_USER_HOME=/gradle-cache \
            -e SIGNING_KEYSTORE_PATH=/tmp/dabb-keystore.jks \
            -e SIGNING_STORE_PASSWORD="${{ secrets.ANDROID_KEYSTORE_PASSWORD }}" \
            -e SIGNING_KEY_ALIAS="${{ secrets.ANDROID_KEY_ALIAS }}" \
            -e SIGNING_KEY_PASSWORD="${{ secrets.ANDROID_KEY_PASSWORD }}" \
            -e VERSION_CODE="${{ github.run_number }}" \
            dabb-android-builder:release \
            apps/client/scripts/build-aab.sh

      - name: Upload to Play Store (internal)
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY }}
          packageName: com.dabb.binokel
          releaseFiles: apps/client/build/dabb.aab
          track: internal
          status: completed

      - name: Clean up keystore
        if: always()
        run: rm -f /tmp/dabb-keystore.jks
```

- [ ] **Step 2: Add `GITHUB_PAT` secret to GitHub**

1. Go to `github.com/deglerj/dabb` → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Generate a new token with:
   - Repository access: `deglerj/dabb`
   - Permissions: `Contents: Read and write`, `Actions: Read and write`
3. Copy the token value
4. Go to Settings → Environments → `production` → Add secret:
   - Name: `GITHUB_PAT`
   - Value: the token you just copied

- [ ] **Step 3: Commit the workflow**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add automated release workflow"
```

---

## Task 4: Write and commit the 2.1.0 CHANGELOG entry

**Files:**

- Modify: `CHANGELOG.md`

This is the prerequisite the release workflow validates. Write the changelog entry for the first tester release before triggering the workflow for the first time.

- [ ] **Step 1: Add the 2.1.0 entry to CHANGELOG.md**

Insert the following block at the top of the file, below the `# Changelog` and `All notable changes...` header lines, before the existing `## [2.0.0]` entry:

```markdown
## [2.1.0] - 2026-03-29

### New Features

- Two-row hand layout grouped by suit for easier card selection
- GitHub link in the options dialog

### Bug Fixes

- Celebration animation now shows on every round win, not just the first
- Discarded Dabb cards are now counted correctly in scoring
- Last trick bonus is now applied correctly
- Adjacent card no longer shows a hover effect after tapping on mobile web
```

_(Edit the text to match what you actually want to communicate to testers — the commit history is the source of truth.)_

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: add 2.1.0 changelog entry"
```

- [ ] **Step 3: Push all commits**

```bash
git push
```

---

## Task 5: Trigger the first release

Once all tasks above are committed and pushed:

- [ ] **Step 1: Go to GitHub Actions → Release → Run workflow**

Input: `version` = `2.1.0`

- [ ] **Step 2: Monitor the workflow run**

Watch for failures at each step. The most likely failure points:

- **Validate CHANGELOG** — if the `## [2.1.0]` entry is missing or malformatted
- **Bump versions / push** — if `GITHUB_PAT` is missing or has insufficient permissions
- **Build AAB** — if Android signing secrets are missing (check `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` in the `production` environment)
- **Upload to Play Store** — if `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` is missing or the app isn't set up in Play Console yet

- [ ] **Step 3: Verify the GitHub Release**

Go to `github.com/deglerj/dabb/releases` — confirm `v2.1.0` is listed with the correct changelog text and links.

- [ ] **Step 4: Verify web deploy**

The version bump push triggers CI → deploy. After ~5 minutes, check `https://dabb.degler.info` — the version number in the home screen footer should show `v2.1.0`.

---

## Remaining Manual Steps (one-time, before Play Store goes live)

These cannot be automated and must be done manually in the Play Console:

1. **Upload Play Store listing text** — copy from `docs/play-store-listing.txt` into Play Console
2. **Upload screenshots** — capture 5 portrait screenshots (home, waiting room, game, bidding, score table) and upload in Play Console
3. **Set privacy policy URL** — enter `https://dabb.degler.info/privacy` in Play Console → App content → Privacy policy
4. **Verify repo is public** — required before the GitHub link in the options dialog is useful to testers
