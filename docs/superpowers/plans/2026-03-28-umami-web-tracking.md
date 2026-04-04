# Umami Web Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Umami page view tracking on web and add a server-side `game-joined` analytics event.

**Architecture:** The Umami script tag is injected into the built HTML at Docker image build time via `sed`, so no client-side code changes are needed. The `game-joined` event is tracked server-side in the HTTP route handler using the existing fire-and-forget `trackEvent` helper, covering all platforms (web, Android, iOS).

**Tech Stack:** Docker multi-stage build (sed), Node.js/Express route handlers, existing `analyticsService.trackEvent`.

---

### Task 1: Inject Umami script tag in Dockerfile.web

**Files:**

- Modify: `apps/client/Dockerfile.web`

**Context:** The CI workflow (`ci.yml` lines 200-203) already passes `EXPO_PUBLIC_UMAMI_URL` and `EXPO_PUBLIC_UMAMI_WEBSITE_ID` as Docker build args. The Dockerfile just needs to declare them and use them to inject a `<script>` tag into the built `dist/index.html` after the Expo bundle step. The injection is conditional — if either var is empty (e.g. local dev), nothing is injected.

- [ ] **Step 1: Add ARG declarations and script injection to Dockerfile.web**

In `apps/client/Dockerfile.web`, after the existing `ARG SERVER_URL` line (~line 51) and after the `bundle:web` step (~line 55), add:

```dockerfile
ARG EXPO_PUBLIC_UMAMI_URL
ARG EXPO_PUBLIC_UMAMI_WEBSITE_ID

# Bundle the web app
RUN pnpm --filter @dabb/client bundle:web

# Inject Umami tracking script if analytics vars are provided
RUN if [ -n "$EXPO_PUBLIC_UMAMI_URL" ] && [ -n "$EXPO_PUBLIC_UMAMI_WEBSITE_ID" ]; then \
      sed -i "s|</head>|<script async src=\"$EXPO_PUBLIC_UMAMI_URL/script.js\" data-website-id=\"$EXPO_PUBLIC_UMAMI_WEBSITE_ID\"></script></head>|" apps/client/dist/index.html; \
    fi
```

The full relevant section of `Dockerfile.web` should look like this after the edit:

```dockerfile
# Inject SERVER_URL into app.json extra so Expo bakes it into the bundle
ARG SERVER_URL
RUN node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('apps/client/app.json','utf8')); a.expo.extra.serverUrl=process.env.SERVER_URL; fs.writeFileSync('apps/client/app.json', JSON.stringify(a, null, 2));"

ARG EXPO_PUBLIC_UMAMI_URL
ARG EXPO_PUBLIC_UMAMI_WEBSITE_ID

# Bundle the web app
RUN pnpm --filter @dabb/client bundle:web

# Inject Umami tracking script if analytics vars are provided
RUN if [ -n "$EXPO_PUBLIC_UMAMI_URL" ] && [ -n "$EXPO_PUBLIC_UMAMI_WEBSITE_ID" ]; then \
      sed -i "s|</head>|<script async src=\"$EXPO_PUBLIC_UMAMI_URL/script.js\" data-website-id=\"$EXPO_PUBLIC_UMAMI_WEBSITE_ID\"></script></head>|" apps/client/dist/index.html; \
    fi
```

- [ ] **Step 2: Verify the injection works locally**

Build the image locally with test values and check the HTML:

```bash
docker build -f apps/client/Dockerfile.web \
  --build-arg SERVER_URL=https://dabb.degler.info \
  --build-arg EXPO_PUBLIC_UMAMI_URL=https://analytics.dabb.degler.info \
  --build-arg EXPO_PUBLIC_UMAMI_WEBSITE_ID=a417d704-01a7-44bf-8f3a-4594cd530fc8 \
  -t dabb-client-test .
docker run --rm dabb-client-test grep -o 'script.*umami' /usr/share/nginx/html/index.html
```

Expected output contains: `script async src="https://analytics.dabb.degler.info/script.js" data-website-id="a417d704-01a7-44bf-8f3a-4594cd530fc8"`

Also verify the no-op case (no args):

```bash
docker build -f apps/client/Dockerfile.web --build-arg SERVER_URL=https://dabb.degler.info -t dabb-client-test-noop .
docker run --rm dabb-client-test-noop grep -c 'umami' /usr/share/nginx/html/index.html || echo "0 — correct, no script injected"
```

Expected: `0 — correct, no script injected`

- [ ] **Step 3: Commit**

```bash
git add apps/client/Dockerfile.web
git commit -m "feat: inject Umami tracking script into web app HTML at build time"
```

---

### Task 2: Track `game-joined` server-side

**Files:**

- Modify: `apps/server/src/routes/sessions.ts`

**Context:** `POST /:code/join` in `routes/sessions.ts` handles human players joining a session. `trackEvent` is already imported and used elsewhere in the server (e.g. `analyticsService.ts`). Add it here after a successful join. No data payload needed — the count of players per game is already captured by the existing `game-started` event. Import `trackEvent` from `'../services/analyticsService.js'`.

- [ ] **Step 1: Add trackEvent import and call in sessions.ts**

At the top of `apps/server/src/routes/sessions.ts`, add the import alongside the existing imports:

```typescript
import { trackEvent } from '../services/analyticsService.js';
```

In `POST /:code/join`, after `const player = await joinSession(session.id, nickname.trim());` (around line 148) and before building the response, add:

```typescript
trackEvent('game-joined');
```

The relevant section should look like:

```typescript
const player = await joinSession(session.id, nickname.trim());

trackEvent('game-joined');

const response: JoinSessionResponse = {
  sessionId: session.id,
  playerId: player.id,
  secretId: player.secretId!,
  playerIndex: player.playerIndex,
  team: player.team,
};
```

- [ ] **Step 2: Run CI check**

```bash
pnpm run build && pnpm test && pnpm lint
```

Expected: all pass with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/sessions.ts
git commit -m "feat: track game-joined analytics event on player join"
```
