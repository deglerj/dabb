# AI Player Strategy

This document describes the decision logic used by `BinokelAIPlayer`, the default AI implementation.

## Bidding

- **First bid of a round** (when passing is not allowed): Always bids the minimum (150).
- **Subsequent bids**: Evaluates hand strength by computing the maximum meld points across all possible trump suits, then adds an estimated 50 trick points.
  - If `estimatedTotal - nextBid < 70`: always bids (hand is strong enough).
  - If `estimatedTotal - nextBid >= 70`: uses an exponential pass probability curve, rising from 0% at a difference of 70 to ~90% at a difference of 200+.
- **Fallback**: Passes if possible, otherwise bids minimum.

## Dabb (Taking & Discarding)

1. **Taking**: Always takes the dabb.
2. **Trump pre-computation**: Before discarding, computes the best trump suit (highest meld points) to inform discard decisions.
3. **Discard priority** (cards to discard first):
   - Non-meld cards before meld cards
   - Non-trump cards before trump cards
   - Lower point cards before higher point cards
4. Discards exactly the required number of cards (4).

## Trump Declaration

- Uses the trump suit pre-computed during the dabb phase.
- If not available (e.g., reconnection), recomputes: chooses the suit yielding the highest meld points, with ties broken randomly.
- **Fallback**: Herz.

## Melding

- Detects all valid melds using `detectMelds(hand, trump)` and declares all of them.
- **Fallback**: Declares no melds (empty array).

## Trick Play

### Leading (First Card of Trick)

1. **Lonely aces first**: An ace is "lonely" if the player has no other cards of that suit (excluding the second copy of the ace). Trump aces are preferred.
2. **General lead**:
   - If more than 3 trump cards in hand: prefer leading with trump.
   - Otherwise: prefer leading with non-trump.
   - Within the chosen category: higher-point cards preferred.
   - **Double ace filter**: Avoids leading with aces when both copies are in hand (saves them), unless they're the only cards of that suit.

### Following (Not Leading)

1. **Can win**: Play the lowest card that would win the trick (conserve strong cards).
2. **Cannot win**: Dump the cheapest card, preferring:
   - Non-trump cards over trump cards.
   - Cards from suits where the player has the most remaining cards (can afford to lose one).
   - Lower point value cards.

## Card Comparison

The AI duplicates the `cardBeats` logic from `tricks.ts` (which is not exported) in its `cardWouldWin` helper:

- Trump beats non-trump
- Higher strength wins within same suit
- Lead suit beats non-lead, non-trump suits
- Otherwise the existing winner holds

Strength order: Buabe (0) < Ober (1) < König (2) < Zehn (3) < Ass (4).

## Error Handling

Every phase method wraps its logic in try-catch. Fallbacks:

| Phase   | Fallback                       |
| ------- | ------------------------------ |
| Bidding | Pass (or bid minimum if first) |
| Dabb    | Discard last N cards           |
| Trump   | Declare Herz                   |
| Melding | Declare no melds               |
| Tricks  | Play first valid card          |
