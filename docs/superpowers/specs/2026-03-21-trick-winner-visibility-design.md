# Trick Winner Visibility — Design Spec

**Date:** 2026-03-21

## Problem

After a trick completes it is hard to tell who won. The winner's name only appears in the game log (hidden by default) and there is no visual distinction on the winning card itself.

## Solution

Show a player name label above every card in the trick zone at all times. When the trick is completed, highlight the winning card with a gold border and make the winner's label bold gold text.

## Scope

Single file change: `apps/client/src/components/game/TrickAnimationLayer.tsx`.

No changes to `CardView`, `useTrickAnimationState`, `CardFace`, or any other component.

## Label Rendering

Inside the existing `displayCards.map` block (co-located with each `CardView`), render an absolutely positioned `Text` label centered horizontally above the card, using the already-computed `targetX`/`targetY` values for that card.

Define a local constant `const CARD_W = 70` at the top of the file (matching `CardView`'s `DEFAULT_W`).

Position:

- `left`: `targetX` — same x as the card
- `top`: `targetY - 20` — 20 px above the card top edge
- `width`: `CARD_W` — matches the card width so `textAlign: 'center'` centers the text

Content: the `nickname` from the matching `Player` in the `players` prop (match on `playerIndex`). If no matching player is found, skip the label (render nothing). `Player.nickname` is already available; no new props needed.

Note: labels appear from the first card played — this is intentional, so players can always see whose card is whose during an in-progress trick.

## Label Styles

**Normal (all phases where labels are shown):**

- Background: `rgba(0, 0, 0, 0.55)`, `borderRadius: 4`, `paddingHorizontal: 5`, `paddingVertical: 2`
- Text: white, `fontSize: 10`, `fontWeight: 'normal'`
- `textAlign: 'center'`, `numberOfLines: 1`

**Winner (animPhase === 'paused' and card.playerIndex === winnerIndex):**

- Same pill background
- Text: `color: '#ffd700'`, `fontWeight: 'bold'`

## Winning Card Highlight

Pass `highlighted={animPhase === 'paused' && pc.playerIndex === winnerIndex}` to `CardView`. This triggers the existing gold border (already implemented: `borderWidth: 2`, `borderColor: '#ffd700'`).

## Lifecycle

| Phase      | Labels shown     | Winner highlight   |
| ---------- | ---------------- | ------------------ |
| `idle`     | —                | —                  |
| `showing`  | yes, normal      | no                 |
| `paused`   | yes, winner gold | yes (card + label) |
| `sweeping` | hidden           | no                 |

Labels are hidden during `sweeping` because cards are animating to the winner's corner and the label positions would lag behind or look detached.

## No New Props

`TrickAnimationLayer` already receives `players: Player[]` (which includes `nickname`) and `animState` (which includes `winnerIndex` and `animPhase`). Nothing new needs to be threaded in from `GameScreen`.

## Implementation Note

`winnerIndex` is available on `TrickAnimationResult` but is not currently destructured in `TrickAnimationLayer`. Add it to the existing destructuring:

```ts
const { animPhase, displayCards, winnerIndex, winnerPlayerId, sweepingCardCount } = animState;
```
