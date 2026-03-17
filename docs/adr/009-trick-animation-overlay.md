# ADR 009: Full-Screen Overlay for Trick Card Animations

## Status

Accepted

## Date

2026-03-17

## Context

Cards needed to animate freely across the screen when played (arc from hand to table) and when swept to the winner's corner pile. The previous `TrickArea` was a relative-positioned container; cards rendered inside it could not move outside its bounds, making cross-screen arc and sweep animations impossible.

## Decision

Replace `TrickArea` with `TrickAnimationLayer`: a full-screen absolute overlay (`StyleSheet.absoluteFill`, `pointerEvents="none"`) that renders trick cards in screen coordinates. All card positions — trick center, won-pile corners, opponent hand origins — come from a single `deriveCardPositions()` call, which is already the source of truth for hand and opponent card layout. A state machine hook (`useTrickAnimationState`) drives phase transitions: idle → showing → paused → sweeping → idle.

## Consequences

### Positive

- Cards can animate freely across the entire screen with no clipping.
- `deriveCardPositions` remains the single source of truth for all card positions; no coordinate duplication.
- The overlay is `pointerEvents="none"` so it never intercepts touch events.
- The phase state machine is independently testable (pure hook, no RN dependencies).

### Negative

- Cards are rendered in screen coordinates, so any layout change that shifts the hand or opponent zones requires updating `deriveCardPositions` (already the case for hand rendering).
- Overlay is always mounted during the tricks phase; idle phase renders `null` so there is no visible cost, but the component is instantiated.

## Related

- `packages/game-canvas/src/cards/cardPositions.ts` — position calculations
- `packages/ui-shared/src/useTrickAnimationState.ts` — phase state machine
- `apps/client/src/components/game/TrickAnimationLayer.tsx` — the overlay
