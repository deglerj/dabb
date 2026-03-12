# Game UI Rewrite — Design Spec

**Date:** 2026-03-12
**Status:** Approved
**Scope:** Complete rewrite of `apps/web` and `apps/mobile` into a unified game-like UI

---

## Overview

The current web and mobile apps are structured like business applications — sidebars, panels, tables. This rewrite transforms them into something that feels like physically playing Binokel at a Swabian Gasthof: a green felt card table with a warm wooden surround, antique paper cards, and physical card animations.

The two separate apps (`apps/web`, `apps/mobile`) are replaced by a single unified Expo app targeting web, iOS, and Android from one codebase.

---

## Visual Design Decisions

| Aspect       | Decision                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------ |
| Table style  | Swabian Gasthof — warm wood surround, green felt surface, candlelight feel                 |
| Table layout | Classic — player at bottom, opponents around edges, trick area center                      |
| Card design  | Antique paper — aged cream (#f2e8d0), ink-drawn suits, existing face illustrations refined |
| Card motion  | Arced flight — ~400ms bezier curve, natural arc trajectory                                 |
| Dealing      | One-by-one staggered — cards fly from central deck to each player in sequence              |
| Trick won    | Sweep to winner's corner — all played cards arc to the winner's pile                       |
| Phase UI     | Floating paper-slip overlays — appear on the felt, slightly rotated, feel hand-placed      |

---

## Architecture

### App Structure

```
apps/
  client/                       ← new unified Expo app (replaces apps/web + apps/mobile)
    src/
      app/                      ← expo-router file-based routes
        index.tsx               ← home screen
        game/[id].tsx           ← game screen
        waiting-room/[id].tsx
      components/
        game/                   ← game screen layout, phase overlays
        ui/                     ← lobby, menus, scoreboard (standard RN views)
      hooks/                    ← socket, sounds, turn notifications
      theme.ts                  ← colors, fonts, spacing

packages/
  game-canvas/                  ← new shared package
    src/
      table/                    ← Skia table rendering (felt, wood, shadows)
      cards/                    ← card components + Reanimated animation logic
      animations/               ← arc path engine, deal sequencer, sweep-to-corner
      overlays/                 ← phase UI overlay components
    index.ts                    ← public API (see below)

  game-logic/                   ← untouched
  shared-types/                 ← untouched
  i18n/                         ← untouched
  ui-shared/                    ← untouched
  card-assets/                  ← untouched
```

The server (`apps/server`) is completely untouched.

### `game-canvas` Public API

`packages/game-canvas/index.ts` exports exactly:

```ts
// Table
export { GameTable } from './src/table/GameTable'; // Skia canvas background
export { useSkiaEffects } from './src/table/useSkiaEffects'; // shadow/ripple/particle triggers

// Cards
export { CardView } from './src/cards/CardView'; // single animated card RN view
export { useCardPositions } from './src/cards/useCardPositions'; // position manager hook

// Animations
export { useDealSequence } from './src/animations/useDealSequence'; // deal one-by-one
export { useTrickSweep } from './src/animations/useTrickSweep'; // sweep-to-corner

// Overlays
export { PhaseOverlay } from './src/overlays/PhaseOverlay'; // floating paper-slip panel
```

All other modules are internal. The app layer (`apps/client`) imports only from `@dabb/game-canvas`.

### Technology Stack

| Layer          | Library                      | Purpose                                              |
| -------------- | ---------------------------- | ---------------------------------------------------- |
| App framework  | Expo SDK 55 + expo-router    | Unified web/iOS/Android routing                      |
| Web target     | react-native-web             | Runs RN components in browser                        |
| Game table     | @shopify/react-native-skia   | Felt texture, wood grain, dynamic shadows, particles |
| Card animation | react-native-reanimated v3   | Bezier arc paths, spring snapping, dealing sequence  |
| Gestures       | react-native-gesture-handler | Drag-to-play (touch + mouse), tap-to-play            |
| UI components  | React Native (standard)      | Phase overlays, scoreboard, game log, menus          |

### `ui-shared` Hook Compatibility

`ui-shared` is not structurally changed, but some hooks require attention in the new unified app:

- `useGameLog`, `useRoundHistory`, `useTrickDisplay`, `useCelebration` — platform-agnostic, used as-is
- `useSocket`, `useGameState` — used as-is (Socket.IO client works in both Expo and browser via `react-native-web`)
- `useLocalStorage` (session credentials) — currently uses `localStorage` (web-only). In the unified app, replace calls to `useLocalStorage` with `expo-secure-store` on native and fall back to `localStorage` on web via a thin adapter in `apps/client/src/hooks/useStorage.ts`. `ui-shared` itself is not modified.
- `useVersionCheck` — used as-is; version is read from the app's config rather than a web-specific source

### Sounds

The two current implementations (`apps/web/src/utils/sounds.ts`, `apps/mobile/src/utils/sounds.ts`) are merged into a single `apps/client/src/utils/sounds.ts`. The mobile implementation is the base (uses `expo-av`), extended with the web-specific fallbacks from the web version where needed.

---

## Table Rendering (Skia Canvas)

A full-bleed `<Canvas>` from `react-native-skia` forms the game screen background. It is drawn once at mount and is otherwise static — it does not re-render during gameplay.

**What Skia renders (static):**

- **Wood surround:** Tiled grain texture (procedural Skia shader), warm brown, vignette shadow at edges
- **Felt surface:** Subtle fabric noise texture (layered Skia noise Paint + Shader), slightly darker at edges, no image assets needed
- **Center trick zone:** Faint stitched oval border line
- **Player corner marks:** Faint arc indicators showing each player's won-trick pile destination

**Dynamic Skia rendering (frame-by-frame, triggered by card events via `useSkiaEffects`):**

- **Drop shadow under dragged/flying card:** Grows as card lifts, shrinks on landing
- **Felt ripple on card land:** Brief `Path` + opacity tween radiating from card's landing point
- **Trick sweep particles:** 6–8 small `Circle` paths scatter from the pile and fade out
- **Card back pattern:** Diagonal hatching rendered as a cached Skia `Picture`, sharp at any scale

The canvas layer has `pointerEvents="none"` — all touch/mouse handling is done by RN views above it.

---

## Card System

### Card Components

Each card is a React Native `View` (`CardView`) with absolute positioning, animated by Reanimated 3 shared values. Card face/back rendering remains React Native (refined antique paper design). The card's Skia shadow is driven by `useSkiaEffects` and rendered on the Skia canvas beneath it.

### Position Management

`useCardPositions(gameState)` derives target positions for all cards from game state and returns:

```ts
{
  playerHand: Record<CardId, { x: number; y: number; rotation: number; zIndex: number }>;
  trickCards: Record<CardId, { x: number; y: number; rotation: number; zIndex: number }>;
  opponentHands: Record<PlayerId, { x: number; y: number; rotation: number; cardCount: number }>;
  wonPiles: Record<PlayerId, { x: number; y: number }>; // sweep destinations
  dragState: Record<
    CardId,
    { isDragging: boolean; x: number; y: number; originX: number; originY: number }
  >;
}
```

When positions change, Reanimated animates each `CardView` from its current position to the new target.

### Arc Path Animation

Cards do not travel in straight lines. The arc is achieved by animating `x` and `y` independently:

- `x`: linear easing (constant horizontal speed)
- `y`: ease-in-out with a lift at the midpoint (card rises then falls)

This produces a natural throwing arc without requiring a physics engine.

### Dealing Sequence (`useDealSequence`)

At round start, cards animate one-by-one from a central deck position to each player's hand. Each card departs ~80ms after the previous. Total deal duration: ~2s for a full 8-card hand per player. Sounds are tied to each card's landing event.

### Trick Sweep (`useTrickSweep`)

When a trick is won, all played cards animate simultaneously to the winner's corner pile position, arriving ~200ms apart in a trailing sequence. A small pile stack grows visibly (slight height offset per card). The Skia particle effect fires at the pile on the last card's arrival.

### Drag to Play

Cards in the player's hand support both tap and drag:

- **Tap:** Card arcs from hand position to trick slot
- **Drag:** Pan gesture (touch or mouse) lifts the card and follows the pointer. Drop anywhere over the felt — the game determines the correct trick slot and snaps the card there via arc animation. If the drop is invalid (wrong phase, invalid card, off-felt), the card springs back to its hand position via spring animation.

Invalid cards resist dragging (spring back instantly). There is no specific drop zone — the entire felt surface accepts drops.

---

## Opponent Zones

Each opponent occupies a fixed zone at the table edge. Zone positions by player count:

```
3 players:                    4 players:

     [Opponent A]             [Opp A]    [Opp B]
[You ──────────────]          [Opp C]
                              [You ──────────────]
```

For 3 players: single opponent top-center, player bottom-center.
For 4 players: two opponents top-left/top-right, third opponent left or right (depending on seating), player bottom-center.

**Per-zone contents:**

- **Name plate:** Aged-paper label (Caveat handwriting font) sitting on the felt. Glows amber on that player's turn.
- **Card backs:** Fanned stack of face-down cards, smaller scale than player hand. Cards lift out one-by-one when the opponent plays.
- **Won-trick pile:** Face-down stack in the player's corner, grows visibly as tricks are swept there.

**Team mode (4 players):** Partner's name plate shares a subtle border color with the player's.

### Responsive Behaviour

| Context          | Opponent representation                               |
| ---------------- | ----------------------------------------------------- |
| Landscape phone  | Full: name plate + card backs + won-pile              |
| Portrait phone   | Simplified: name plate badge + card count number only |
| Tablet / desktop | Full always, portrait or landscape                    |

A subtle "rotate for full experience" hint appears on portrait phones at first load.

---

## Phase UI Overlays (`PhaseOverlay`)

Each game phase renders a floating panel on the felt — styled as an aged paper slip or wooden panel, slightly rotated (1–3°) to feel hand-placed. Panels enter with a gentle spring drop onto the felt and exit with a 150ms lift + fade. They always appear center-felt, never covering the player's hand.

| Phase                   | Overlay content                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bidding**             | Bid amount buttons (150–300, Weiter) as stamped wooden chip style. Current bid in Caveat font above. Waiting players see current bid only, buttons hidden.      |
| **Dabb — take step**    | "Take Dabb" prompt with the 2 dabb cards shown face-down. A single "Take" button. Only shown to the bid winner before they take the dabb.                       |
| **Dabb — discard step** | Dabb cards face-up, "Go Out" option (with suit selector), "Discard & Continue" button. Card selection for discard via tap or drag. Shown after taking the dabb. |
| **Trump**               | 4 suit icons as large pressable wooden coin tokens.                                                                                                             |
| **Melding**             | Detected melds list with point values in Caveat font. Confirm button. Read-only for non-bid-winners.                                                            |

---

## Celebration Animations

Celebrations are preserved from the existing apps, using the `useCelebration` hook from `ui-shared`. Visuals are re-implemented to match the new Gasthof aesthetic:

- **Trick won by player:** Brief confetti burst (small paper scraps, warm colors) from the center of the felt, lasting ~1s
- **Round won / bidding won:** Larger confetti shower, ~2s
- **Game won:** Full fireworks overlay, ~3s, same as current but re-skinned with warmer colors

Celebration animations render as absolute-positioned RN views over the entire screen (above the felt). They do not block interaction.

---

## Error States & Disconnection

The following existing overlays are migrated to the new app:

- **`GameTerminatedModal`**: Preserved as a full-screen RN Modal. Shown when the server terminates the game (e.g. player disconnect timeout). Styled with the new wood/paper aesthetic.
- **`UpdateRequiredScreen`**: Preserved. Shown when server version is incompatible. Full-screen with a simple message and a link to update.
- **Reconnection:** The existing socket reconnection logic (auto-reconnect with exponential backoff) is preserved. During reconnection, the felt surface dims slightly and a small "Reconnecting…" ribbon appears in the wood surround strip.

---

## Scoreboard & Game Log

Both panels live in the wood surround area — not on the felt — keeping the table surface clear.

### Scoreboard

- **Collapsed (default):** Slim wooden strip along the top of the wood surround. Each player's current total score in Caveat font.
- **Expanded:** Slides down as a full-width paper sheet over the wood surround (not over the felt). Shows full round history table from `useRoundHistory`.
- **Portrait phones:** Expands as a bottom-sheet modal (consistent with existing mobile behaviour).

### Game Log

- **Collapsed (default):** Small folded-paper tab in the bottom-right corner of the wood surround.
- **Expanded:** Slides up as a paper scroll from the bottom, slightly overlapping the felt. Shows last 5–10 entries from `useGameLog` in Caveat handwriting. Collapses automatically when the player takes an action.
- **Your turn banner:** Pulsing amber ribbon across the top edge of the felt (part of the table surface, not a panel). Disappears when the player acts.

---

## Out of Scope

- Server changes
- Game logic changes (`packages/game-logic`)
- Shared types, i18n, card-assets packages
- `ui-shared` structural changes
- AI simulation
- Authentication / session management
- Any new game features or rule changes

---

## Key Files After Rewrite

| Purpose                                      | Path                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| Unified app entry                            | `apps/client/src/app/index.tsx`                          |
| Game screen                                  | `apps/client/src/app/game/[id].tsx`                      |
| Storage adapter (localStorage / SecureStore) | `apps/client/src/hooks/useStorage.ts`                    |
| Sounds (merged)                              | `apps/client/src/utils/sounds.ts`                        |
| App theme                                    | `apps/client/src/theme.ts`                               |
| Game canvas package public API               | `packages/game-canvas/index.ts`                          |
| Skia table renderer                          | `packages/game-canvas/src/table/GameTable.tsx`           |
| Skia effects hook                            | `packages/game-canvas/src/table/useSkiaEffects.ts`       |
| Card position manager                        | `packages/game-canvas/src/cards/useCardPositions.ts`     |
| Animated card view                           | `packages/game-canvas/src/cards/CardView.tsx`            |
| Arc animation engine                         | `packages/game-canvas/src/animations/arcPath.ts`         |
| Deal sequencer                               | `packages/game-canvas/src/animations/useDealSequence.ts` |
| Trick sweep                                  | `packages/game-canvas/src/animations/useTrickSweep.ts`   |
| Phase overlay                                | `packages/game-canvas/src/overlays/PhaseOverlay.tsx`     |
