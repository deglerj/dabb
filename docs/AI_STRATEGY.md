# AI Player Strategy

This document describes the decision logic used by `BinokelAIPlayer`, the AI implementation.

`BinokelAIPlayer` supports three difficulty levels via a `mistakeProbability` parameter:

- **hard** (0): optimal play — smearing safety, card-counting leads, endgame squeeze
- **medium** (0.15): occasional mistakes
- **easy** (0.35): frequent mistakes

## Rubber Band (easy & medium)

A leading AI is handicapped so the game stays close. Cheating in the other direction is not
available to a card AI — it cannot be given cards it did not draw — so the handicap is simply a
higher mistake rate:

```
lead = clamp((myScore - bestOtherScore) / RUBBER_BAND_SPAN, 0, 1)   // RUBBER_BAND_SPAN = 200
p    = base + strength * lead
```

`strength` equals the base rate of the level (easy 0.35, medium 0.15), so a full-span lead
doubles it: **easy 0.35 … 0.70**, **medium 0.15 … 0.30**, **hard 0** (no band at any lead).

Three properties are deliberate:

- **The base rate is a floor.** Falling behind restores the difficulty the player picked and
  goes no further — an easy bot never plays like a hard one because the human is winning.
- **It is measured against the best other side**, not the average, so leading one opponent
  while trailing another does not trigger it.
- **It moves once per round.** `totalScores` only changes when a round is scored, so the rate
  is constant for a whole round instead of drifting between two cards of one trick.

4-player games compare **team** totals (`totalScores` is keyed by `Team` there, not by seat).
A bot sitting opposite a human is exempt entirely (`partnersHuman` in `AIPlayer.ts`): it shares
the human's score, so banding it would sabotage the human's own teammate for being ahead. The
simulation (`apps/simulate`) also runs with the band off — it measures strategy, and a band
would pull every bot-vs-bot game towards a tie.

See `effectiveMistakeProbability` in `BinokelAIPlayer.ts`.

## Round Knowledge (`knowledge.ts`)

The AI keeps **no** state between decisions. Everything it knows about the round is rebuilt from
`GameState` on every call, by `buildRoundMemory(state, playerIndex)`.

This is not a style choice. `useAI` constructs a fresh `BinokelAIPlayer` for every single
decision, so an instance field is discarded immediately — the online bots used to track voids in
one and threw the knowledge away each time. A pure fold over `state.trickHistory` gives the same
answer in all three drivers.

`buildRoundMemory` is also the **only** code in the AI allowed to read `GameState`. All three
drivers pass an unfiltered state, so `state.hands` holds every opponent's real cards and
`tricksTaken` holds the bid winner's face-down layaway. `knowledge.test.ts` scrambles all of
that and asserts the deductions do not move; read state anywhere else and that test cannot
protect you.

What it returns: cards `gone`, cards `located` in a known hand (from `declaredMelds`, which are
public), suits each player is deduced void in, per-suit strength ceilings, unseen counts, and
`unseenTrump`.

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
2. **Going-out decision**: Evaluates `estimatedTotal = meldPoints + estimateTrickPoints` for the best suit. If `estimatedTotal < currentBid × 0.20`, go out in the best suit.

   That threshold was 0.70 and it was the most expensive number in the AI. Going out costs the
   bid once, guaranteed; playing on costs twice the bid but only when the hand actually misses.
   At 0.70 the AI went out in **30% of four-player rounds** and the hands it abandoned mostly
   made their bid. Lowering it to 0.20 was worth **+16 percentage points** of win rate in
   four-player games — more than every card-counting rule in the package put together. The
   underlying fault is that `estimateTrickPoints` is far too pessimistic; recalibrating it is
   the real fix and has not been done.

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

## Deduction

`getValidPlays` is strict — follow suit, beat the highest card of the lead suit if you can,
otherwise trump, otherwise beat the highest trump — so every card an opponent plays _proves_
something. No probability is involved. `buildRoundMemory` folds the round's tricks card by card
and records:

| What they played                                 | What it proves                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Off-suit, non-trump                              | Void in the lead suit; **and** void in trump, unless the partner exemption lifted must-trump |
| Lead suit, without beating the highest lead card | Holds nothing higher in that suit                                                            |
| A trump, under a higher trump already down       | Holds no higher trump                                                                        |

The fold replays each trick in order because which obligations were in force depends on how the
trick stood at that moment (the partner exemption applies to the beat and trump rules, never to
following suit).

## Trick Play

### Leading (First Card of Trick)

Leading is the only decision Binokel never constrains, so it is where the card counting is worth
anything at all.

0. **Trump pull (sacrifice)**: when one or two trump are unaccounted for, pinned to a single
   opponent who is deduced void in a suit we hold, and we hold a side ace worth protecting, lead
   our cheapest card of that suit. Must-trump takes their last trump for the price of a Buabe.
   It runs first because a side ace only looks safe while no opponent is deduced void in its
   suit, and this removes the trump that would ruff it.
1. **Lonely aces first**: An ace is "lonely" if the player has no other non-ace cards of that suit. Trump aces are preferred.
2. **Trump exhaustion**: If the bid winner has 3+ trump in hand and opponents still hold trump (`10 - myTrump - playedTrump > 0`), lead the **highest trump** to pull trump from opponents.
3. **General lead**:
   - If more than 3 trump cards in hand: prefer leading with trump.
   - Otherwise: prefer leading with non-trump.
   - Within the chosen category: **lower**-point cards preferred. Reaching this rule means no
     safe lead was found, so the trick is probably lost — lose it cheaply. This sorted the other
     way round and led the Ass into suits an opponent could still beat or ruff.
   - **Double ace filter**: Avoids leading with aces when both copies are in hand (saves them), unless they're the only cards of that suit.

### Following (Not Leading)

Note what is **not** here: any rule about ducking a trick or declining to spend a high card.
Must-beat removes the choice — if a legal card beats the highest card of the lead suit,
`getValidPlays` returns only such cards. Measured over simulated games, **0%** of 2- and
3-player follow decisions ever offer a choice between winning and losing, and every one of the
3.9% in 4-player games is under the partner exemption. Any such rule written outside rule 1
below cannot fire.

1. **Smearing** (4-player only): the partner already has the trick, which is the one situation
   that does offer a choice. Overtake only if an opponent still to act could take it from them,
   and not even then if the cheapest overtake is a Zehn or an Ass that the same opponent beats
   anyway — that would lose the card as well as the trick. Otherwise play the highest-point
   non-trump card onto the partner's trick. Being last to play falls out of this as the case
   where nobody can answer.
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
