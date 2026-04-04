# Umami Web Tracking — Design Spec

**Date:** 2026-03-28

## Problem

Umami shows no events or sessions despite the server-side analytics service being in place. Root cause (fixed separately): Umami's bot detection silently discards requests without a `User-Agent` header — resolved by setting `DISABLE_BOT_CHECK: 1` on the Umami container.

Remaining gaps:

1. **No page view tracking on web** — the Umami script tag is never injected into the built HTML.
2. **No meta events** — "game joined" and "game started with N players (M AI)" are not tracked anywhere.

## Scope

- Web page views via Umami script tag (web only — unavoidable limitation of browser-based tracking)
- `game-joined` event: tracked server-side (covers web, Android, iOS)
- `game-started` event enriched with `{ players, aiPlayers }`: tracked server-side (covers all platforms)

Out of scope: per-action in-game events (bids, card plays, etc.).

## Design

### 1. Dockerfile script tag injection (`apps/client/Dockerfile.web`)

Declare the two Umami build args (the CI workflow already passes them):

```dockerfile
ARG EXPO_PUBLIC_UMAMI_URL
ARG EXPO_PUBLIC_UMAMI_WEBSITE_ID
```

After `bundle:web`, inject the Umami script tag into `dist/index.html` — only when both vars are set, so builds without analytics config still work:

```dockerfile
RUN if [ -n "$EXPO_PUBLIC_UMAMI_URL" ] && [ -n "$EXPO_PUBLIC_UMAMI_WEBSITE_ID" ]; then \
      sed -i "s|</head>|<script async src=\"$EXPO_PUBLIC_UMAMI_URL/script.js\" data-website-id=\"$EXPO_PUBLIC_UMAMI_WEBSITE_ID\"></script></head>|" apps/client/dist/index.html; \
    fi
```

The CI workflow GitHub Actions variables (`VITE_UMAMI_URL`, `VITE_UMAMI_WEBSITE_ID`) are already mapped to the correct build arg names.

### 2. `game-joined` event (`apps/server/src/routes/sessions.ts`)

Add `trackEvent('game-joined')` after the successful `joinSession()` call in `POST /:code/join`. No additional data needed.

### 3. Enrich `game-started` event (`apps/server/src/services/gameService.ts`)

The existing `trackEvent('game-started')` call gains `{ players, aiPlayers }` data derived from the session's player list at game start time. No new event name — the existing event gets richer.

## No client-side analytics wrapper

Since both meta events are tracked server-side, no `window.umami` wrapper or TypeScript type declarations are needed in the client.

## Testing

No automated tests needed for the Dockerfile sed injection (it's a build-time operation). The server-side event calls follow the same fire-and-forget pattern as existing tracked events; no new test infrastructure required.
