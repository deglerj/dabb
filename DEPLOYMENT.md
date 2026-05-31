# Dabb Deployment Guide

## Architecture

Dabb is a serverless P2P application with no self-hosted backend.

| Component   | Provider           | Details                                  |
| ----------- | ------------------ | ---------------------------------------- |
| Web app     | Alfahosting (SFTP) | Static files, Apache, `dabb.degler.info` |
| Android app | Google Play Store  | Published via CI                         |
| Backend     | Firebase RTDB      | Google-managed, `europe-west1`           |

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

## Android Deployment (Automated)

Android AAB is published to Google Play via GitHub Actions.

**Workflow:** `.github/workflows/publish-android.yml`

Runs when triggered manually or on release tags.

---

## Firebase Setup

The Firebase project (`dabb`) must be configured once manually. See `docs/FIREBASE_SETUP.md` for the setup steps (create project, create RTDB, configure security rules, register app).

**Firebase security rules** (set in Firebase Console → Realtime Database → Rules):

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": "auth == null",
        "meta": {
          "status": { ".write": "auth == null" },
          "playerCount": { ".write": "!data.exists()" },
          "targetScore": { ".write": "!data.exists()" },
          "createdAt": { ".write": "!data.exists()" },
          "players": {
            "$playerIndex": { ".write": "!data.exists()" }
          }
        },
        "events": {
          "$eventId": {
            ".write": "root.child('sessions/' + $code + '/meta/players').forEach(function(p) {
              return p.child('secretHash').val() === newData.child('authorHash').val()
            })"
          }
        },
        "presence": {
          "$playerIndex": { ".write": "auth == null" }
        },
        "aiClaims": {
          "$claimId": { ".write": "auth == null" }
        }
      }
    }
  }
}
```

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
