# Firebase Setup Guide

Manual steps to create and configure the Firebase project for Dabb.

---

## 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it `dabb` (or `dabb-prod`)
4. **Disable** Google Analytics (not needed)
5. Click **Create project**

---

## 2. Create Realtime Database

1. In left sidebar: **Build → Realtime Database**
2. Click **Create Database**
3. Choose location: **europe-west1** (Belgium — closest to Swabia)
4. Select **Start in test mode** (you'll lock it down in step 4)
5. Click **Enable**

Note the database URL — it looks like:

```
https://dabb-default-rtdb.europe-west1.firebasedatabase.app
```

---

## 3. Register Web App (get config credentials)

1. In project overview, click the **web icon** (`</>`)
2. App nickname: `dabb-web`
3. **Do not** enable Firebase Hosting
4. Click **Register app**
5. Copy the config object — you'll need these values:

```js
const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  databaseURL: 'https://dabb-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
};
```

Store these as environment variables in the client app (`.env` file, Expo config, or EAS secrets for CI):

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_DATABASE_URL=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

---

## 4. Configure Security Rules

1. In left sidebar: **Build → Realtime Database → Rules tab**
2. Replace the default rules with:

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
            "$playerIndex": {
              ".write": "!data.exists()"
            }
          }
        },
        "events": {
          "$eventId": {
            ".write": "
              root.child('sessions/' + $code + '/meta/players').forEach(function(p) {
                return p.child('secretHash').val() === newData.child('authorHash').val()
              })
            "
          }
        },
        "presence": {
          "$playerIndex": {
            ".write": "auth == null"
          }
        },
        "aiClaims": {
          "$claimId": {
            ".write": "auth == null"
          }
        }
      }
    }
  }
}
```

3. Click **Publish**

> **Note:** `auth == null` allows unauthenticated access intentionally — the game uses its own secretHash-based identity. Only event writes are gated to registered players.

---

## 5. Set Up Budget Alert

Firebase Spark plan is free, but set an alert in case usage unexpectedly exceeds free tier.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your Firebase project
3. **Billing → Budgets & alerts**
4. Click **Create budget**
5. Set amount: **€5/month**
6. Set alert thresholds: 50%, 90%, 100%
7. Add your email as notification recipient
8. Click **Save**

> Firebase will NOT automatically charge you on the Spark plan — this alert is just early warning if something unexpected happens.

---

## 6. Configure Automatic Session Cleanup (optional but recommended)

Old sessions accumulate in the database. Add a cleanup rule to auto-delete sessions older than 30 days.

Firebase doesn't support TTL natively on RTDB. Options:

- Add a Firebase Cloud Function (requires Blaze plan — skip for now)
- Manually delete old sessions from the console periodically
- Add a cleanup step to the client: on startup, delete own sessions with `status: "finished"` older than 7 days

---

## 7. Verify Setup

Test that the database is accessible:

```bash
curl "https://dabb-default-rtdb.europe-west1.firebasedatabase.app/sessions.json"
# Should return: null (empty, no sessions yet)
```

---

---

## Infrastructure Teardown

Do this **after** the new hosting is live and verified working.

### 1. Export game data (optional)

If you want to keep a record of past games:

```bash
ssh -i ~/.ssh/dabb-deploy dabb@<server-ip>
docker exec dabb-postgres pg_dump -U dabb dabb > /tmp/dabb-backup.sql
exit
scp -i ~/.ssh/dabb-deploy dabb@<server-ip>:/tmp/dabb-backup.sql ~/dabb-backup.sql
```

### 2. Stop containers and delete server

```bash
# Stop all containers on the server
ssh -i ~/.ssh/dabb-deploy dabb@<server-ip> \
  "cd /opt/dabb && docker compose -f docker-compose.prod.yml down -v"
```

Then delete the server via OpenTofu:

```bash
cd tofu/
tofu destroy \
  -var="hetzner_api_token=<YOUR_HETZNER_TOKEN>" \
  -var="ssh_public_key=$(cat ~/.ssh/dabb-deploy.pub)"
```

Or delete it manually in [Hetzner Cloud Console](https://console.hetzner.cloud) → server → **Delete**.

### 3. Update DNS at Alfahosting

1. Log in at [Alfahosting Kundencenter](https://kundencenter.alfahosting.de)
2. **Meine Verträge** → **Multi L** → **Experten-Einstellungen** → **DNS-System** → domain **degler.info**
3. Change `dabb` A record: point it to your Alfahosting server IP (or remove it if `dabb.degler.info` is a subdirectory of the main domain)
4. **Delete** the `analytics.dabb` A record (Umami is gone)
5. TTL is 3600 — changes propagate within an hour

### 4. Clean up GitHub

Remove secrets that no longer apply:

1. **Settings → Environments → production**
   - Delete secrets: `SERVER_HOST`, `SSH_PRIVATE_KEY`, `POSTGRES_PASSWORD`, `CLIENT_URL`
2. **Settings → Secrets and variables → Actions → Variables**
   - Delete variables: `VITE_SERVER_URL` (replaced by Firebase config)
   - Keep: `VITE_UMAMI_URL`, `VITE_UMAMI_WEBSITE_ID` (if you keep Umami elsewhere)
3. Delete workflow file `.github/workflows/deploy.yml` (replaced by new deploy-web workflow — see next section)

### 5. Cancel / archive

- **Hetzner:** billing stops automatically when server is deleted
- **UptimeRobot:** delete or update the `https://dabb.degler.info/health` monitor
- **GHCR:** optionally delete old Docker images at `github.com/<you>/packages` (server + client Docker images no longer built)

---

## New Web Hosting Setup (Alfahosting static files)

The web client becomes a plain static site (HTML + JS + CSS) deployed to your Alfahosting account via SFTP.

### 1. Find your Alfahosting SFTP credentials

1. Log in at [Alfahosting Kundencenter](https://kundencenter.alfahosting.de)
2. **Meine Verträge** → **Multi L** → **FTP-Zugänge** (or Hosting-Verwaltung → FTP)
3. Note: **host**, **username**, **password**
4. The web root for `dabb.degler.info` is typically `~/dabb.degler.info/` or `~/public_html/dabb/` — verify in the control panel

### 2. Add GitHub secrets for SFTP deploy

1. **Settings → Environments → production** (create it if deleted in teardown)
2. Add secrets:

| Name              | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| `SFTP_HOST`       | Alfahosting SFTP hostname (e.g. `sftp.alfahosting.de`) |
| `SFTP_USER`       | SFTP username                                          |
| `SFTP_PASSWORD`   | SFTP password                                          |
| `SFTP_TARGET_DIR` | Remote path to web root (e.g. `/dabb.degler.info`)     |

3. Add repository variables (**Settings → Secrets and variables → Actions → Variables**):

| Name                                       | Value                |
| ------------------------------------------ | -------------------- |
| `EXPO_PUBLIC_FIREBASE_API_KEY`             | From Firebase step 3 |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`         | From Firebase step 3 |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL`        | From Firebase step 3 |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID`          | From Firebase step 3 |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`      | From Firebase step 3 |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase step 3 |
| `EXPO_PUBLIC_FIREBASE_APP_ID`              | From Firebase step 3 |

> Store Firebase config as repository variables (not secrets) — they are public values, not credentials.

### 3. Add .htaccess for SPA routing

The web app is a single-page app — all routes must serve `index.html`. Create `apps/client/web/.htaccess` (committed to the repo, copied into the build output):

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

### 4. CI changes

Replace `.github/workflows/deploy.yml` with a new `deploy-web.yml`:

```yaml
name: Deploy Web

on:
  workflow_run:
    workflows: ['CI']
    branches: [main]
    types: [completed]

jobs:
  deploy-web:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          version: '10.33.0'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build web client
        run: pnpm --filter @dabb/client build:web
        env:
          EXPO_PUBLIC_FIREBASE_API_KEY: ${{ vars.EXPO_PUBLIC_FIREBASE_API_KEY }}
          EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ vars.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN }}
          EXPO_PUBLIC_FIREBASE_DATABASE_URL: ${{ vars.EXPO_PUBLIC_FIREBASE_DATABASE_URL }}
          EXPO_PUBLIC_FIREBASE_PROJECT_ID: ${{ vars.EXPO_PUBLIC_FIREBASE_PROJECT_ID }}
          EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ vars.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET }}
          EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
          EXPO_PUBLIC_FIREBASE_APP_ID: ${{ vars.EXPO_PUBLIC_FIREBASE_APP_ID }}

      - name: Deploy via SFTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.SFTP_HOST }}
          username: ${{ secrets.SFTP_USER }}
          password: ${{ secrets.SFTP_PASSWORD }}
          local-dir: apps/client/dist/
          server-dir: ${{ secrets.SFTP_TARGET_DIR }}/
          protocol: ftps
```

> **Note:** Pin the `SamKirkland/FTP-Deploy-Action` SHA before merging — see memory note on GitHub Actions pinning.

Also update `ci.yml`:

- Remove the `build-docker` matrix entry for `app: server` — Docker image no longer built
- Remove the `build-docker` matrix entry for `app: client` — static files deployed directly, no Docker image needed
- Keep all other jobs unchanged (lint, test, typecheck, Android APK build)

### 5. Verify first deploy

After merging:

1. Watch the `Deploy Web` workflow in GitHub Actions
2. Visit `https://dabb.degler.info` — should load the app
3. Open browser DevTools → Network — confirm Firebase WebSocket connects (`wss://...firebaseio.com`)
4. Create a test session and verify it appears in [Firebase Console → Realtime Database](https://console.firebase.google.com)

---

## Summary Checklist

- [ ] Firebase project created
- [ ] Realtime Database created in europe-west1
- [ ] Web app registered, config values noted
- [ ] Security rules published
- [ ] Budget alert configured
- [ ] Game data exported (if wanted)
- [ ] Hetzner server deleted
- [ ] DNS updated at Alfahosting (dabb A record, analytics.dabb deleted)
- [ ] Old GitHub secrets/variables removed
- [ ] deploy.yml deleted
- [ ] Alfahosting SFTP credentials added as GitHub secrets
- [ ] Firebase config added as GitHub repository variables
- [ ] .htaccess committed
- [ ] deploy-web.yml added with pinned action SHAs
- [ ] build-docker jobs removed from ci.yml
- [ ] First deploy verified
