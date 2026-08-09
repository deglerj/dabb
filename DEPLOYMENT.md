# Dabb Deployment Guide

## Architecture

Dabb is a serverless P2P application with no self-hosted backend.

| Component | Provider           | Details                                                         |
| --------- | ------------------ | --------------------------------------------------------------- |
| Web app   | Alfahosting (SFTP) | Static files, Apache, `dabb.degler.info` — installable as a PWA |
| Backend   | Firebase RTDB      | Google-managed, `europe-west1`                                  |

---

## Web Deployment (Automated)

Web client is deployed automatically by GitHub Actions on every push to `main` that passes CI.

**Workflow:** `.github/workflows/deploy-web.yml`

1. Builds packages with `pnpm run build`
2. Bundles web client with `pnpm --filter @dabb/client bundle:web` (Firebase env vars baked in)
3. Copies `apps/client/web/` public files (`.htaccess`, etc.) to `dist/`
4. Deploys `apps/client/dist/` via FTPS to Alfahosting

**Required GitHub secrets** (`Settings → Environments → production`):

| Secret            | Description                  |
| ----------------- | ---------------------------- |
| `SFTP_HOST`       | Alfahosting SFTP server host |
| `SFTP_USER`       | SFTP username                |
| `SFTP_PASSWORD`   | SFTP password                |
| `SFTP_TARGET_DIR` | Target directory on server   |

**Required GitHub repository variables** (`Settings → Secrets and variables → Variables`):

| Variable                                   | Description       |
| ------------------------------------------ | ----------------- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`             | Firebase config   |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase config   |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL`        | Firebase RTDB URL |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase config   |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase config   |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase config   |
| `EXPO_PUBLIC_FIREBASE_APP_ID`              | Firebase config   |

---

## Firebase Setup

The Firebase project (`dabb`) must be configured once manually. Steps: create a Firebase project, enable Realtime Database (`europe-west1`), register the web app, copy the config values as environment variables, and apply the security rules below.

**Firebase security rules** live in [`database.rules.json`](database.rules.json) and are deployed
with the project — do not maintain a second copy here or paste rules into the Firebase Console by
hand, or the two drift apart:

```bash
pnpm exec firebase deploy --only database
```

The emulator uses a separate, wide-open ruleset (`database.rules.dev.json`, selected by
`firebase.dev.json`) so local dev and the Playwright smoke test never trip over auth. `dev.sh` and
`apps/client/playwright.config.ts` pass `--config firebase.dev.json` for exactly that reason. Never
point `firebase.json` at the dev rules — `firebase deploy` reads `firebase.json`, so that would
publish `".write": true` to production.

---

## Local Development

No local server needed. Start the client directly:

```bash
# Create apps/client/.env.local with your Firebase project credentials:
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_DATABASE_URL=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# Start client
pnpm --filter @dabb/client start
```

---

## Related Documentation

- [Architecture: Deployment View](docs/arc42/07-deployment-view.md)
- [ADR 005: Original deployment strategy](docs/adr/005-deployment-strategy.md) (superseded)
- [ADR 007: Hetzner hosting](docs/adr/007-hetzner-hosting.md) (superseded)
