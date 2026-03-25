# Discard UI Redesign

**Date:** 2026-03-23
**Status:** Approved

## Problem

The current discard step (inside `DabbOverlay`) is unintuitive. The player taps cards in an overlay to toggle selection — there is no clear visual metaphor for "I am putting these cards aside." Players found it hard to understand.

## Goal

Redesign discarding to feel like a deliberate staging action: the player moves cards from their hand into 4 visible slots, then confirms. This mirrors the physicality of setting cards face-down on the table.

## Design

### Visual Layout

Three visible layers during discard phase:

1. **Dim scrim** — `DiscardOverlay` renders a `StyleSheet.absoluteFill` `View` with `backgroundColor: rgba(0,0,0,0.55)` as its first child. This requires `DiscardOverlay` to be rendered as a **direct child of `gameWrapper`** in `GameScreen`, not inside any `PhaseOverlay` wrapper (see Technical Design).
2. **Floating dialog panel** — centered on screen; `DiscardOverlay` positions its dialog panel at the same visual center as existing `PhaseOverlay` modals (absolute, `alignSelf: center`, `top: ~28%`):
   - Title: _"Karten ablegen"_
   - Row of 4 card slots with dashed borders
     - Empty slots: show a faint slot number (1–4)
     - Filled slots: show the actual `CardFace` for the slotted card
   - Counter label: _"X / 4"_
   - **Ablegen** button — disabled until all 4 slots are filled; calls `onDiscard`
   - **Abgehen...** text link below the button — tapping it shows an inline suit-selection section within the same dialog
3. **Player hand** — full hand remains visible at the bottom of the screen. Cards currently in slots are filtered out inside `PlayerHand` during render (not at the callsite); layout shift is acceptable.

### Card Interactions

**Slotting a card (primary: tap):**

- Tap a hand card → it is instantly removed from the hand and appears in the next empty slot (snap; no cross-component animation)
- Tapping a hand card when all 4 slots are filled: no-op
- Drag-to-slot: deferred enhancement (out of scope for initial implementation)

**Returning a card to hand:**

- Tap a slotted card → it is instantly removed from the slot and reappears in the hand (snap)

**Dabb card highlighting:** Cards that came from the dabb retain their gold border highlight in the hand — they are the natural discard candidates.

### Go Out (Abgehen)

The _"Abgehen..."_ link is rendered below the Ablegen button. Tapping it reveals an inline suit-selection row within the dialog (extracted as a private sub-component). `pendingSuit` state is managed internally by `DiscardOverlay` and is reset to `null` in a `useEffect` keyed on `visible` (so stale state never shows when the overlay re-opens).

Flow:

1. Tap "Abgehen..." → suit buttons appear in the dialog
2. Tap a suit → confirmation row appears (same two-step pattern as current `DabbOverlay` Go Out UI)
3. Confirm → calls `onGoOut(suit)`
4. Cancel → returns to normal slot view

When going out, the slot state is irrelevant — `onGoOut` is called directly without reference to `slottedCardIds`.

The translation key for the link text is `game.goOutLink` (distinct from `game.goOut` used for the confirmation button). **Add `game.goOutLink` to both `de.ts` and `en.ts` before use.**

## Technical Design

### New Component: `DiscardOverlay`

**Location:** `packages/game-canvas/src/overlays/DiscardOverlay.tsx`

**Props:**

```typescript
interface DiscardOverlayProps {
  visible: boolean;
  discardCount: number; // always 4 in current rules
  slottedCardIds: CardId[]; // cards currently in slots (managed by GameScreen)
  allCards: Card[]; // full card list for CardFace lookup (myCards from state)
  onRemoveFromSlot: (cardId: CardId) => void;
  onDiscard: () => void; // GameScreen already owns slottedCardIds; no arg needed
  onGoOut: (suit: Suit) => void;
}
```

- Renders full-screen scrim + centered dialog panel (handles its own absolute positioning)
- Renders 4 `CardSlot` sub-components (empty or filled with `CardFace`, looked up from `allCards`)
- Ablegen button enabled when `slottedCardIds.length === discardCount`; calls `onDiscard()`
- Tapping a filled slot calls `onRemoveFromSlot`
- Manages `pendingSuit` state internally for the Go Out inline flow; resets to `null` when `visible` changes

### Changes to `DabbOverlay`

- Remove the `'discard'` step entirely — take step stays as-is
- Remove all discard-related props (`onDiscard`, `onGoOut`, discard step rendering, `pendingSuit`)
- `DabbOverlay` becomes single-purpose: animated card reveal + "Dabb nehmen" button

### Changes to `PlayerHand`

Replace discard-mode props:

```typescript
// Remove:
onToggleDiscard?: (cardId: CardId) => void;
discardSelectedIds?: CardId[];

// Add:
onSlotCard?: (cardId: CardId) => void;
slottedCardIds?: CardId[];
```

Behavior when `onSlotCard` is provided (discard phase):

- Cards whose id is in `slottedCardIds` are filtered out during the `PlayerHand` render loop (not at the callsite in `GameScreen`)
- Tapping a hand card calls `onSlotCard(cardId)`
- Dragging is disabled (drag-to-slot is deferred)

Remove existing discard-mode lift/border styling.

### Changes to `GameScreen`

- Replace `dabbSelectedCards: CardId[]` state with `slottedCardIds: CardId[]`
- Replace the single `showDabb` flag with two flags:
  - `showDabbTake`: `phase === 'dabb' && isBidWinner && dabb.length > 0`
  - `showDiscard`: `phase === 'dabb' && isBidWinner && dabb.length === 0`
- `<PhaseOverlay visible={showDabbTake}>` wraps the simplified `DabbOverlay` (unchanged wrapper pattern)
- `<DiscardOverlay visible={showDiscard} ...>` is rendered as a **direct child of `gameWrapper`**, alongside (not inside) `PhaseOverlay`, so its absoluteFill scrim covers the full screen
- Add `useEffect` to reset `slottedCardIds` to `[]` whenever `showDiscard` transitions from `true` to `false` (handles reconnects and unexpected phase advances)
- Add handlers:
  - `handleSlotCard(cardId)`: append to `slottedCardIds` only if `slottedCardIds.length < discardCount`
  - `handleRemoveFromSlot(cardId)`: remove from `slottedCardIds`
  - `handleDiscard`: calls `onDiscard(slottedCardIds)` then resets `slottedCardIds` to `[]`
- Pass `slottedCardIds`, `onSlotCard` to `PlayerHand`; pass `slottedCardIds`, `allCards`, `onRemoveFromSlot`, `onDiscard` to `DiscardOverlay`

## Out of Scope

- Drag-to-slot (deferred; tap-to-slot is the complete v1 interaction)
- Pre-filling slots with dabb cards
- Any changes to server logic, socket events, or game state
