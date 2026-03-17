# Trick Card Animations — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Problem

Three related issues with the trick phase:

1. **Bug:** Cards disappear from the table immediately when a trick is won. `useTrickDisplay` (the 3-second pause hook) exists but is never called in `GameScreen`.
2. **Missing:** No animation when a card is played — it just appears on the table instantly.
3. **Partially built:** `trickSweep.ts` computes sweep schedules but is never connected to actual card movement.

---

## Scope

| Item                                      | Type        |
| ----------------------------------------- | ----------- |
| Wire up `useTrickDisplay` in `GameScreen` | Bug fix     |
| Arc animation when card is played         | New feature |
| Sweep animation when trick is taken       | New feature |

Out of scope: drag feedback improvements, card highlight effects, score popups.

---

## Architecture

### Replace `TrickArea` with `TrickAnimationLayer`

The current `TrickArea` is a small relative-positioned container. This limits animation freedom — cards can't fly in from outside the container bounds.

**Replace it with `TrickAnimationLayer`:** a full-screen absolute overlay (`position: absolute`, `pointerEvents: 'none'`, covers entire GameScreen). Cards are positioned in screen coordinates, enabling free movement across the whole display.

`TrickArea` is deleted. `TrickAnimationLayer` is its replacement.

### New Hook: `useTrickAnimationState`

Supersedes the standalone `useTrickDisplay`. Manages a state machine with the following phases:

```
idle → playing → settled → paused → sweeping → idle
```

- **`idle`**: No cards. Nothing shown.
- **`playing`**: A new card has been added to `currentTrick`. The card is rendered at its origin zone and animates (arc) to its trick-center position.
- **`settled`**: All cards are at their trick-center positions. Normal display.
- **`paused`**: `TRICK_WON` received. `currentTrick` cleared by reducer, but the hook holds the completed trick cards visible for 3 seconds. Carries over the `lastCompletedTrick` from the existing `useTrickDisplay` logic.
- **`sweeping`**: After the 3-second pause, `computeSweepSchedule` fires. Cards animate in sequence (200ms stagger) to the winner's corner. Once the last card's animation completes, transition to `idle`.

The hook also tracks which card IDs are currently in flight (to avoid re-triggering animations on re-renders).

---

## Card Positions (Screen Coordinates)

All positions come from **`deriveCardPositions`** (`packages/game-canvas/src/cards/cardPositions.ts`) — the same pure function already used by `PlayerHand`. `TrickAnimationLayer` receives the output of one `deriveCardPositions` call (or a subset of it) as props.

### Origin zones (where cards fly _from_)

- **Self (player 0):** center of the player's hand = `(width / 2, height * HAND_Y_FRACTION)` where `HAND_Y_FRACTION = 0.82`. This is the center of the hand fan, not a hardcoded constant.
- **Opponents:** `opponentHands[playerId].x` and `.y` from `deriveCardPositions` output. These are evenly spaced along the top edge at `y = height * 0.08` with `x = width * (i+1)/(n+1)` — computed dynamically, not hardcoded per-role.

`TrickAnimationLayer` receives a `playerOrigin: Point` (for self) and `opponentOrigins: Record<string, Point>` (keyed by player ID) derived from the `deriveCardPositions` output. No separate origin table is needed.

### Settled positions (trick center)

Use `trickCards[cardId]` from `deriveCardPositions` output directly. The function already computes the horizontal spread (`TRICK_CARD_SPREAD = 80px`) and center fractions (`TRICK_CENTER_X_FRACTION = 0.5`, `TRICK_CENTER_Y_FRACTION = 0.45`). No duplication.

### Sweep destinations (winner's corner)

Use `wonPiles[winnerId]` from `deriveCardPositions` output directly. This reads from `WON_PILE_CORNERS`:

```
[0.06, 0.9]   // player 0 — bottom-left
[0.94, 0.06]  // player 1 — top-right
[0.06, 0.06]  // player 2 — top-left
[0.94, 0.9]   // player 3 — bottom-right
```

`computeSweepSchedule(cardIds, wonPiles[winnerId], 200)` passes the exact same corner used by the won-pile indicator rendering, so cards land visually on the pile.

---

## Arc Animation

`CardView` gains two optional props: `initialX?: number` and `initialY?: number`.

When provided:

- On mount, shared values `x` and `y` are set to `initialX`/`initialY` (no animation — immediate snap to origin)
- Then `withTiming(targetX)` and `withTiming(targetY)` fire normally

The arc effect on Y is achieved by a two-step sequence:

1. Animate `y` to a peak (origin Y minus 60px lift, proportionally adjusted for upward shots) over the first half of duration
2. Animate `y` to `targetY` over the second half

X remains a single `withTiming` (linear horizontal speed). Combined, this produces a parabolic arc matching the math in `arcPath.ts`.

Duration: 400ms (unchanged from current card animations).

For the player's own card: the card was being dragged; the `initialX/initialY` passed is the player 0 origin zone center (not the drag release point, for simplicity). The card will appear to fly from the hand center even if the drag ended at a different position. **Known limitation:** if `onDrop` provides the release (x, y) in the future, those could be passed as `initialX/initialY` for a more accurate arc start — out of scope for this feature.

---

## Components and Files

### Changed

| File                                           | Change                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/game-canvas/src/cards/CardView.tsx`  | Add `initialX?: number`, `initialY?: number` props; snap-then-animate on mount |
| `apps/client/src/components/ui/GameScreen.tsx` | Remove `TrickArea` usage; add `TrickAnimationLayer`; pass `screenLayout`       |

### New

| File                                                      | Purpose                                           |
| --------------------------------------------------------- | ------------------------------------------------- |
| `packages/ui-shared/src/useTrickAnimationState.ts`        | State machine hook (supersedes `useTrickDisplay`) |
| `apps/client/src/components/game/TrickAnimationLayer.tsx` | Full-screen trick card overlay                    |

### Deleted

| File                                            | Reason                            |
| ----------------------------------------------- | --------------------------------- |
| `apps/client/src/components/game/TrickArea.tsx` | Replaced by `TrickAnimationLayer` |

### Unchanged

| File                                                | Role                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/game-canvas/src/animations/trickSweep.ts` | Sweep schedule math — used as-is                                                                                        |
| `packages/game-canvas/src/animations/arcPath.ts`    | Arc math — referenced for lift values                                                                                   |
| `packages/ui-shared/src/useTrickDisplay.ts`         | Deleted — superseded by `useTrickAnimationState`. Remove from `packages/ui-shared/src/index.ts` exports in the same PR. |

---

## Data Flow

```
CARD_PLAYED event received
  → reducer adds card to currentTrick.cards
  → useTrickAnimationState detects new card ID
  → sets phase = 'playing'
  → TrickAnimationLayer renders CardView at origin zone (initialX/Y)
  → CardView animates to settled position (arc, 400ms)
  → after animation: phase = 'settled'

TRICK_WON event received
  → reducer clears currentTrick.cards, populates lastCompletedTrick
  → useTrickAnimationState detects trick won
  → sets phase = 'paused', starts 3s timer
  → TrickAnimationLayer keeps displaying completed trick cards

3s timer fires
  → phase = 'sweeping'
  → resolve winner's player ID: `state.players[winnerIndex].id`
  → computeSweepSchedule called with `wonPiles[winnerId]` as destination
  → TrickAnimationLayer moves cards to sweep targets (200ms stagger)
  → after last card arrives (total: numCards × 200ms): phase = 'idle'
  → TrickAnimationLayer renders nothing
```

---

## Testing

- **Unit test `useTrickAnimationState`**: test all phase transitions — new card arrival, trick won, pause expiry, early-cancel when next card played during pause, sweep completion.
- **Manual test**: play through a full round and verify: arc on card play, 3-second pause after trick won, sweep to winner's corner.
- **Regression**: no existing tests cover `useTrickDisplay`; the new hook replaces it and its logic should be covered by the new unit tests.
