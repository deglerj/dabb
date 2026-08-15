# AI Strategy v2 — Deduction, Ducking and Sacrifice Leads

Status: **design draft**. No code written yet. The strategies are formulated below; the
implementation plan is at the end of this document.

Companion to `docs/AI_STRATEGY.md`, which describes what `BinokelAIPlayer` does today.

## Why

The current AI is single-trick greedy. It has no model of what opponents hold, so it cannot
make any play whose payoff arrives later — which is exactly what a sacrifice is. Three concrete
leaks follow from that, all visible in `packages/game-ai/src/BinokelAIPlayer.ts`:

1. **It leads its most valuable card into unsafe suits.** `decideLeadCard` step 5 sorts
   candidates by `RANK_POINTS` descending (`:696`). Step 4 already identified the suits where no
   opponent ace remains; step 5 then leads high in the suits where one does. An Ass led into a
   live ace is 11 points handed over, plus whatever the others smear on it.
2. **It "wins" tricks that later players will take off it.** `decideFollowCard` rule 2
   (`:749`) plays the cheapest card that beats _what is on the table_, without asking whether
   anyone still to act can beat that. Second-to-play in a 4-player game, this feeds an Ass to
   the opponent holding a trump.
3. **It never declines a trick.** There is no ducking path outside 4-player partner smearing
   (`:738`), so a cheap trick is always bought with a card that would have won a rich one.

All three need the same missing thing: knowledge of what is still out there. That knowledge is
also what makes a sacrifice computable — you cannot decide to burn a Buabe to pull an
opponent's last trump without a belief about how much trump they have left.

## Foundation: exact deduction, not probability

Binokel's play restrictions are strict enough that most of the useful knowledge is _deduced_,
not guessed. `getValidPlays` (`packages/game-logic/src/phases/tricks.ts:147`) forces:
follow suit → beat the highest card of the lead suit if you can → otherwise trump → otherwise
beat the highest trump. The partner exemption (4-player, partner currently winning) lifts the
beat and trump obligations but not following suit.

Every card an opponent plays therefore proves something. Four inferences, all free:

| What they played                                    | What it proves (when the partner exemption did not apply) |
| --------------------------------------------------- | --------------------------------------------------------- |
| Off-suit, non-trump                                 | Void in the lead suit **and** void in trump               |
| Lead suit, below the highest lead card on the table | Holds **no** higher card of that suit                     |
| A trump, below a higher trump already on the table  | Holds **no** higher trump                                 |
| Lead suit at all                                    | Not void in the lead suit (resets a stale belief)         |

Today only the first row is used, and only its first half — `updateVoidKnowledge` (`:588`)
records the lead-suit void and drops the trump void on the floor. The other three rows are
untouched.

On top of the deductions sits simple counting. The deck is 40 cards, two copies of every
(suit, rank). For each card, `unseen = 2 − in my hand − played − in the dabb I buried`.

One public source is currently ignored entirely: `state.declaredMelds` is a
`Map<PlayerIndex, Meld[]>` and each `Meld` carries `cards: CardId[]`. Melded cards go back into
the hand and are played later, so a declared meld does not remove a card from circulation — it
**locates** it. Every opponent tells us a slice of their hand out loud, and the AI does not
listen. `grep declaredMelds packages/game-ai/src` returns nothing.

That gives three tiers of card knowledge, which is the vocabulary the rest of this document
uses:

- **gone** — played, or buried by me in the dabb.
- **located** — known to be in a specific hand: my own cards, and cards an opponent declared in
  a meld and has not yet played.
- **floating** — unaccounted for. Distributable over the players not deduced void in that suit.

### Two prerequisites this rests on

Neither is a strategy, but no strategy below works without them.

**(a) The knowledge has to be derivable from state, because the online AI has no memory.**
`apps/client/src/hooks/useAI.ts:121` calls `createAIPlayer(...)` inside the per-turn effect, so
a fresh `BinokelAIPlayer` decides every action and `this.voidPlayers` is discarded immediately.
The per-round tracking documented in `AI_STRATEGY.md` only ever ran in
`OfflineGameEngine` and `SimulationEngine`, which keep their instances in a map. Online bots
have been playing with zero memory.

The fix is not to cache the AI instance — that would leave three drivers with three lifetimes
again. Deduction should be a **pure fold over the round's completed tricks**, recomputed per
decision. That runs into the second half of the problem: `GameState.tricksTaken` is
`Map<PlayerIndex, Card[][]>`, keyed by _winner_, so who played which card and in what order is
not recoverable. `lastCompletedTrick` keeps full `PlayedCard[]` but only for one trick. So the
reducer needs to retain the round's trick history in playable detail.

**(b) The AI must not cheat, and nothing currently stops it.** All three drivers hand over the
unfiltered state — `useAI.ts:123` passes `applyEvents(rawEvents)`, `SimulationEngine.ts:143` and
`OfflineGameEngine.ts:206` pass `this.state`. `gameState.hands` contains every opponent's real
cards. The present AI happens not to read them; a card-counting AI is one careless line away
from reading them, and the bug would be invisible — it would just look like a strong AI.
Deduction should therefore live behind a single entry point that is the only code allowed to
touch `state`, with a test that its output is unchanged when other players' hands are replaced
with garbage.

## Correction: must-beat makes most of the "duck" family unreachable

**Found during P2, and it invalidates part of what follows.** S2 and S3 below were written as if
a player normally chooses whether to win a trick. They almost never do.

`getValidPlays` returns _only_ the cards that beat the highest card of the lead suit, whenever
any of them do. So when following suit the legal set is either all winners or all losers, never
a mix; the same holds for a forced ruff. The one exception is the partner exemption, which
returns the whole lead suit and lets a 4-player hand choose.

Measured by replaying simulated games and checking every follow decision for a legal set
containing both a winning and a losing card:

| Players | Follow decisions | Offering a win/lose choice                          |
| ------- | ---------------- | --------------------------------------------------- |
| 2       | 1854             | 0 (0.00%)                                           |
| 3       | 4440             | 0 (0.00%)                                           |
| 4       | 4347             | 169 (3.89%) — every one under the partner exemption |

Consequences:

- **S2 as written cannot fire at all**, and was reimplemented in the only slot that exists: a
  4-player hand deciding whether to overtake its own partner. See the revised entry below.
- **S3 (ducking, phase P4) is dead for the same reason** and is dropped from the plan. It is the
  same decision as the revised S2, in the same slot, so it is already covered.
- The premise that S2 would be "the largest single win" was wrong. Rules that fire on a _lead_
  are unaffected by any of this, since leading is always a free choice — which moves S4 from a
  nice-to-have to the main event.

## The strategies

### S1 — Trump census

Derived, per round: `unseenTrump` (trump not in my hand and not played), and per opponent a
`0 | maybe | known-void` flag from the deduction table. Cheap, and it is the input to S2, S4
and S5.

Two immediate consequences with no further logic:

- When `unseenTrump === 0`, every ace and every top card of a suit nobody is void in is a
  guaranteed winner. Cash them in descending order.
- The endgame rule at `:660` — "in the last 3 tricks, lead highest trump" — should be gated on
  `unseenTrump > 0`. Leading trump against trump-void opponents spends a trump on a trick the
  Ass would have won for free.

### S2 — Overtaking the partner (revised; 4-player only)

_Originally "don't feed a high card to a later player", which the correction above showed cannot
fire. This is what survives of it._

When the partner already has the trick, a 4-player hand may follow suit with any card, so it
genuinely chooses between banking points on the partner's trick and taking it off them. The old
rule only smeared from the last seat; from any earlier seat it fell through and overtook its own
partner with the cheapest winner.

- **No opponent behind us can beat the partner's card** -> smear. Last to play is this case, so
  the old `isLastToPlay` rule becomes a special case rather than a separate branch.
- **An opponent behind us is a threat, and our cheapest overtake is a Zehn or an Ass that the
  same opponent beats anyway** -> smear. Protecting is futile and would lose the card too.
- **Otherwise** -> overtake and protect the trick.

"Threat" counts only _deduced_ knowledge: a player known void in the lead suit who is not known
void in trump. Treating an unknown opponent as a possible ruffer sounds cautious but would make
the AI hold its aces back all round and never score.

**Measured: no significant effect.** It fires on roughly 1-2% of decisions, below what the
harness can resolve. Retained because overtaking your own partner with an Ass from a non-final
seat is bad play whether or not it moves a win rate.

### S3 — Ducking (hold-up) — DROPPED

Declining a trick you could win is not a decision Binokel offers: must-beat takes it away
everywhere except the partner exemption, which the revised S2 already covers. Phase P4 is
removed from the plan. See the correction section above for the measurement.

### S4 — Sacrifice leads

The other half of the ask, and the reason the census exists. Two forms:

**S4a — Trump pull with a worthless card.** When an opponent is believed to hold few trump
(census: 1–2 unaccounted trump, with a void deduction pinning them), lead the lowest-point card
(Buabe = 2 points) of a suit they are deduced void in. The must-trump rule forces the trump out
of their hand for a 2-point trick. Once `unseenTrump` hits 0, my aces run unopposed.

This is the exact play the current AI cannot express: it costs a trick and gains position. The
existing trump-exhaustion rule (`:643`) does something adjacent but opposite in kind — it leads
the _highest trump_, spending strength to draw strength, and it only fires for the bid winner
with 3+ trump.

**S4b — Probe lead / lead low from strength.** In a suit where I hold the Ass and an opponent
ace is still floating, lead a low card of that suit rather than the Ass. Either the opponent
plays their Ass and mine becomes the master card, or they duck and I have learnt a void.

This is the direct inversion of `decideLeadCard` step 5's points-descending sort, and the
smallest change in this document: **lead high only in suits the census calls safe; lead low in
every other suit.** Step 4 (`:669`) already computes "safe"; today the fall-through simply
ignores its own conclusion.

### S5 — Contract awareness (bid winner vs. defenders)

The AI has no notion that a round is a contract. Running trick points per side are derivable
from `tricksTaken` plus `declaredMelds`, and the bid is `state.currentBid`.

- **As bid winner**: once melds + trick points already exceed the bid, the contract is safe —
  duck freely (S3), keep trump for the last trick's 10 points. While short of the bid, take
  every point available and stop ducking.
- **As defender**: while the bid winner is short, play denial — never smear (that is a
  4-player rule that currently only checks _partner is winning_, not _whether the points
  help_), dump zero-value cards onto their tricks, and spend trump on their rich tricks
  specifically. A round the bid winner misses is worth −2 × bid to them
  (`game-logic/src/engine/scoring.ts`), which dwarfs any trick.

S5 is the largest behavioural change and the one most likely to need tuning. It is listed last
deliberately: S1–S4 are self-contained and each is individually testable, S5 changes the AI's
objective function.

## What this does not add

- No search or lookahead. Every strategy above is a rule evaluated against the census at the
  moment of play. Monte-Carlo determinization would be stronger and is not proposed —
  it needs a time budget the client turn loop does not have.
- No probability model beyond counting. "Floating" is treated as "possible", not weighted by
  hand sizes. If a later measurement shows this is the limit, weighting is an isolated upgrade
  inside the census.
- No change to bidding, dabb, discard, trump declaration or melding. The census would improve
  bidding too, but bidding happens before any card is played, so it gains only the dabb
  contents — a separate, smaller piece of work.

## How this gets measured

Heuristics of this kind cannot be tuned by reading them, and the thresholds above (7 points for
S3, 1–2 trump for S4a) are first guesses that need fitting.

`apps/simulate` is the right harness but cannot currently do it: `SimulationEngine` (`:100`)
builds every seat with the same `difficulty` and there is no strategy selector, so v1 cannot be
played against v2. The harness needs per-seat AI configuration before any of the numbers above
mean anything.

Target measurement: v2 seats versus v1 seats, same deck seeds, ≥1000 games at 2, 3 and 4
players, reporting win rate and average round score. Each strategy should be measurable on its
own so a rule that does not pay for itself gets deleted rather than tuned.

Two side effects to watch:

- A stronger `hard` shifts what `medium` and `easy` mean. The blunder injection at
  `BinokelAIPlayer.ts:562` sits _after_ the card choice and stays orthogonal, so the mechanism
  survives — but `MISTAKE_PROBABILITIES` and `RUBBER_BAND_STRENGTH` in `AIPlayer.ts` are
  calibrated against today's strength and will likely need re-fitting.
- Ducking and sacrifice leads look like mistakes to a human. A bot that declines a trick it
  visibly could have taken will read as broken to a player who is not counting. Worth checking
  against real play before assuming a win rate improvement is a UX improvement.

---

# Implementation plan

Seven phases, each its own PR, each individually shippable and revertible. P0 and P1 change no
AI behaviour at all; every phase from P2 on flips exactly one group of rules on and is measured
against v1 before the next starts.

## Versioning the AI

One constructor parameter on `BinokelAIPlayer`: `strategy: 1 | 2` (default `1` until P6). Every
new rule below is gated on `strategy === 2`. Not one flag per rule — the phases land in
sequence, so measuring at each phase's merge point gives the per-strategy delta anyway, and a
dozen booleans is a combinatorial mess nobody will ever sweep.

The cost of this: an interaction between two rules shows up only in the total, never isolated.
Accepted. If a phase's measurement goes the wrong way, the previous phase's number is the
bisect point.

## P0 — Measurement harness

**No AI changes.** Without this, every threshold in this document is a guess that stays a guess.

- `SimulationEngine`: replace the single `difficulty` option (`SimulationEngine.ts:100`) with a
  per-seat config, `seats?: { difficulty, strategy }[]`, falling back to today's
  "same for everyone" when absent so nothing existing breaks.
- `runner.ts`: `--seat-strategy 2,1,2,1` style flag, and report the win rate split by strategy
  rather than by seat index.
- **Mirrored runs instead of seeded decks.** `shuffleDeck` (`packages/game-logic/src/cards/deck.ts:53`)
  uses bare `Math.random()`; threading a seeded RNG through `engine/deal.ts` is real work for
  variance reduction we can get for free by running every matchup twice with the strategies
  swapped between seats and summing. Deal luck and seat-order advantage both cancel.
  <!-- ponytail: mirrored runs, not seeded decks — add seeding if variance still masks a real effect at 1000 games -->

Done when: `pnpm simulate` can run v1 against v1 across 1000 games and report a win rate within
noise of even — the harness's own null test.

**Measured** (`--strategies 2,1` while strategy 2 is still identical to strategy 1):

| Players | Games | Result        |
| ------- | ----- | ------------- |
| 2       | 1000  | 47.7% / 52.3% |
| 4       | 1000  | 48.4% / 51.6% |

Both within noise, but they also fix the harness's resolution: one standard error at n=1000 is
1.6 pp, so **anything under about a 3 pp win-rate change is invisible at 1000 games**. A phase
that measures +2 pp has not been shown to do anything — raise the game count or accept that the
rule is unproven.

## P1 — Knowledge foundation

**No AI behaviour change.** Two independent pieces; the reducer change can land first on its
own.

**P1a — Round trick history in state.** `GameState.tricksTaken` is keyed by winner and loses
who played what. Add `trickHistory: CompletedTrick[]`:

- `reducer.ts:376` already constructs the full `CompletedTrick` for `lastCompletedTrick` —
  append the same object to `trickHistory` in the same return.
- `initial.ts:37` (fresh state) and the round reset at `initial.ts:94` both set it to `[]`.
  Note this is the opposite of `lastCompletedTrick`, which deliberately survives the reset
  (`initial.ts:113`) for the trick animation; `trickHistory` must reset or deductions leak
  across rounds.
- Regression test: two rounds of play, assert `trickHistory` holds only the current round's
  tricks and that each entry's `cards` keeps the original play order.

**P1b — `buildRoundMemory(state, playerIndex)`** in a new `packages/game-ai/src/knowledge.ts`.
The single entry point for everything the AI is allowed to know. Returns:

- `gone: Set<CardId>` — played, plus my own dabb burials.
- `located: Map<PlayerIndex, Set<CardId>>` — from `state.declaredMelds`, minus what has since
  been played. Currently unused public information.
- `unseenCount(suit, rank): 0 | 1 | 2`.
- `voidIn: Map<PlayerIndex, Set<Suit>>` and `trumpVoid: Set<PlayerIndex>` — folded over
  `trickHistory` using the four inferences in the deduction table above, each skipped when the
  partner exemption applied to that play (`isPartnerWinning` against the trick as it stood at
  that moment, so the fold has to replay each trick card by card, not inspect it whole).
- `maxHeld(playerIndex, suit): Rank | null` — the "did not beat" inference.

Lives in `game-ai`, not `game-logic`: it is AI inference, not a rule, and putting it in
`game-logic` invites the client to render it.

**The anti-cheat test is part of this phase, not a follow-up.** All three drivers pass the
unfiltered state (`useAI.ts:123`, `SimulationEngine.ts:143`, `OfflineGameEngine.ts:206`), so
`state.hands` holds every opponent's real cards. Test: build a state mid-round, snapshot
`buildRoundMemory`, replace every hand except `playerIndex`'s with a random deck slice, assert
the memory is byte-identical. That test is the only thing standing between this work and an AI
that cheats invisibly.

Done when: `buildRoundMemory` is covered, the cheat test passes, and no AI decision reads it
yet.

## P2 — S1 census + S2 (DONE)

- `decideTricks` builds the memory once per decision and passes it to both lead and follow.
- **Deleted `updateVoidKnowledge` and the `voidPlayers` instance state.** They turned out to be
  write-only: `voidPlayers` was populated every trick and never read by any decision, so the
  per-round tracking documented in `AI_STRATEGY.md` fed nothing at all. (`precomputedTrump`,
  also named in that doc, no longer exists.) Deleting it changed no behaviour in any driver.
- `decideFollowCard` gained the revised S2 partner-overtake rule.
- The endgame trump lead is gated on `unseenTrump > 0`.

**Measured at n=8000 per configuration** (one standard error is 0.56 pp):

| Setup                        | Strategy 2 win rate  | Delta   | Significance |
| ---------------------------- | -------------------- | ------- | ------------ |
| 2 players — only S1 can fire | 51.2%                | +1.2 pp | 2.1 SE       |
| 3 players — only S1 can fire | 33.5% (even = 33.3%) | +0.2 pp | 0.4 SE       |
| 4 players — S1 and S2        | 50.5%                | +0.5 pp | 0.9 SE       |

**Honest reading: P2 did not deliver.** The endgame trump gate is marginally positive in
two-player games and invisible everywhere else; the partner-overtake rule is unmeasurable. The
phase is kept because it is a small amount of code, it deletes more than it adds, and both rules
are individually sound — but it should not be described as an improvement to the AI's strength.

The plan expected this phase to be the big win. It was wrong for a structural reason (see the
correction section), and the expectation now moves to P3, whose rules fire on every lead.

## P3 — S4 sacrifice leads

- **S4b first, it is four lines.** `decideLeadCard` step 4 (`:669`) already computes the suits
  where no opponent ace remains, and step 5 (`:696`) then sorts points-descending in the suits
  it just called unsafe. Invert: lead high only in census-safe suits, lowest-point card
  everywhere else. Widen "safe" from the current aces-only check to the full census (no higher
  card of the suit unaccounted for, and every opponent trump-void or trump exhausted).
- **S4a trump pull.** When 1–2 trump are unaccounted for and a void deduction pins them to a
  specific opponent, lead the lowest-point card of a suit that opponent is void in. Buabe is
  2 points — the cheapest possible price for their last trump.
- Reconcile with the existing trump-exhaustion rule (`:643`), which leads _highest trump_ for a
  bid winner with 3+ trump. Both aim to strip opponent trump; S4a is the version that does not
  spend a trump to do it. Keep `:643` only where I hold enough trump that the exchange is
  clearly favourable, otherwise prefer S4a.

Tests: hand-built lead positions — Ass held with an opponent ace floating, assert it leads low;
same with both aces accounted for, assert it leads the Ass.

Measure. **Watch for a regression here specifically**: leading low gives away tempo, and if the
census is wrong the AI simply hands over cheap tricks for nothing.

## P4 — S3 ducking — DROPPED

Removed: must-beat means a player almost never gets to decline a winnable trick, and the one
slot where they do is the partner exemption, which the revised S2 already occupies. See the
correction section for the measurement that established this.

## P5 — S5 contract awareness

Largest change; changes the objective function rather than the card choice, so it lands last
and alone.

- Derive running trick points per side from `trickHistory` (P1a gives per-trick points) plus
  `declaredMelds`, compare against `state.currentBid`.
- Bid winner: contract already safe → duck freely, hold trump for the last trick's 10 points.
  Short of it → take everything, S3 off.
- Defender: bid winner short → denial mode. Never smear points onto their winning trick (the
  current smear rule at `:738` checks only that the partner is winning, never whether the
  points help), dump zero-value cards, spend trump on their rich tricks.
- 4-player only for the smear part; 2- and 3-player get the denial dumping.

This is where a missed bid at −2 × bid (`game-logic/src/engine/scoring.ts`) gets weighed
against a trick, so it is also where the AI can most easily talk itself into something stupid.
Measure per player count — the denial calculus differs between 2-player and team play.

## P6 — Recalibrate and clean up

- Flip the `strategy` default to `2`, delete the v1 branches and the flag itself. Keeping both
  paths forever is how the rules engine drifted before.
- **Re-fit `MISTAKE_PROBABILITIES` and `RUBBER_BAND_STRENGTH` (`AIPlayer.ts:21`, `:33`).** They
  are calibrated against today's strength. The blunder injection sits after the card choice
  (`BinokelAIPlayer.ts:562`) so the mechanism itself survives untouched, but a stronger `hard`
  means `easy` at 0.35 is no longer as easy as it was. Fit by win rate against a v1 `hard` bot,
  which is a stable reference point for exactly this.
- Rewrite `docs/AI_STRATEGY.md` to describe v2, and fold this document into it or mark it
  superseded.
- `CHANGELOG.md` + version bump: MINOR. User-facing text should say the bots got better at
  reading the table, not name the heuristics.

## Sequencing summary

| Phase | Content                              | Behaviour change | Status                  |
| ----- | ------------------------------------ | ---------------- | ----------------------- |
| P0    | Per-seat sim config, rotated seats   | none             | done                    |
| P1a   | `trickHistory` in reducer            | none             | done                    |
| P1b   | `buildRoundMemory` + anti-cheat test | none             | done                    |
| P2    | S1 census, revised S2                | yes              | done — no measured gain |
| P3    | S4b lead inversion, S4a trump pull   | yes              | next                    |
| P4    | S3 ducking                           | —                | dropped, unreachable    |
| P5    | S5 contract awareness                | yes              | pending                 |
| P6    | Recalibrate, delete v1, docs         | yes              | pending                 |

## Deliberately not in this plan

- Seeded deals. Mirrored runs cover it; add seeding only if variance still masks an effect at
  1000 games.
- Caching the AI instance per seat to restore per-round memory. Stateless deduction makes the
  lifetime question moot in all three drivers instead of fixing it in one.
- Any search, determinization or weighting of "floating" cards by hand size. If P2–P5 measure
  out and the AI is still weak, that is the next document, not this one.
- Bidding, dabb, discard and melding changes. The census only exists after the first card is
  played, so it has nothing to offer the earlier phases.
