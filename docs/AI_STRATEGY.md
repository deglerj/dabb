# AI Player Strategy

This document describes the decision logic used by `BinokelAIPlayer`, the AI implementation.

`BinokelAIPlayer` supports three difficulty levels via a `mistakeProbability` parameter:

- **hard** (0): optimal play — smearing safety, card-counting leads, endgame squeeze
- **medium** (0.15): occasional mistakes
- **easy** (0.35): frequent mistakes

## Per-Round State Tracking

The AI tracks state across decisions within a round:

- `precomputedTrump` — best trump from the dabb phase, reused in the trump phase.
- `voidPlayers` — accumulated knowledge of which opponents are void in which suits (detected from `lastCompletedTrick`).

State is reset automatically when the round number changes.

## Bidding

Uses a per-suit trick estimate instead of a flat guess:

**`estimateTrickPoints(hand, trump, playerCount)`**:

- Base estimate from trump count in hand: 0→20, 1→30, 2→40, 3→55, 4→65, 5→75, 6+→85.
- +10 for each non-trump lonely ace (only card of that suit in hand).
- +5 for each non-trump ten where only 1 card of that suit remains.
- Scaled down 15% for 3+ player games (more competition).
- Capped at 100.

**Bidding thresholds** (`diff = estimatedTotal - nextBid`):

- `diff >= 60`: always bid (comfortable margin).
- `diff <= -50`: always pass (clearly hopeless).
- Between: linear pass probability from 0% at +60 to 85% at -50.
- **First bid of a round** (passing not yet allowed): always bids the minimum (150).
- **Fallback**: passes if possible, otherwise bids minimum.

## Dabb (Taking & Discarding)

1. **Taking**: Always takes the dabb.
2. **Going-out decision**: Evaluates `estimatedTotal = meldPoints + estimateTrickPoints` for the best suit. If `estimatedTotal < currentBid × 0.70`, go out in the best suit.
3. **Trump pre-computation**: Stores the best trump suit to reuse in the trump phase.
4. **Discard scoring** (lower score = discard first):

| Condition                            | Score adjustment                 |
| ------------------------------------ | -------------------------------- |
| Meld card                            | +10000 (strongly avoid)          |
| Trump card                           | +5000 (avoid)                    |
| Card rank points                     | +points × 100 (prefer low-value) |
| Last non-meld card of suit           | -2000 (creates void → big bonus) |
| Second-to-last non-meld card of suit | -500 (partial void bonus)        |

## Trump Declaration

- Uses the trump suit pre-computed during the dabb phase.
- If not available (e.g., reconnection), recomputes: chooses the suit with the highest `meldPoints × 100 + trumpCount` score (tiebreaker favours suits with more trump cards in hand).
- **Fallback**: Herz.

## Melding

- Detects all valid melds using `detectMelds(hand, trump)` and declares all of them.
- **Fallback**: Declares no melds (empty array).

## Void Detection

After each trick, the AI inspects `state.lastCompletedTrick` to detect opponent voids:

- Lead suit = suit of the first card played in the trick.
- If a player played a card that is **neither the lead suit nor trump**, they must have been void in the lead suit.
- This information accumulates in `voidPlayers: Map<PlayerIndex, Set<Suit>>` across the round.

## Trick Play

### Leading (First Card of Trick)

1. **Lonely aces first**: An ace is "lonely" if the player has no other non-ace cards of that suit. Trump aces are preferred.
2. **Trump exhaustion**: If the bid winner has 3+ trump in hand and opponents still hold trump (`10 - myTrump - playedTrump > 0`), lead the **highest trump** to pull trump from opponents.
3. **General lead**:
   - If more than 3 trump cards in hand: prefer leading with trump.
   - Otherwise: prefer leading with non-trump.
   - Within the chosen category: higher-point cards preferred.
   - **Double ace filter**: Avoids leading with aces when both copies are in hand (saves them), unless they're the only cards of that suit.

### Following (Not Leading)

1. **Smearing** (4-player only): If the partner is currently winning the trick (`trick.winnerIndex === partner`) and we cannot win, play the **highest-point non-trump card** to maximise the trick value for the partner. Falls back to any valid card if no non-trump available.
2. **Win with minimum**: If we can win, play the lowest-strength winning card (conserve strong cards).
3. **Void creation**: If we cannot win, prefer playing the **last card of a non-trump suit** to create a void for future tricks.
4. **Dump lowest**: Dump the cheapest non-trump card from the suit with the most remaining cards.

### Card Comparison

- Trump beats non-trump.
- Higher strength wins within the same suit.
- Lead suit beats off-suit non-trump.

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
