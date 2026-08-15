/**
 * Tests for GameState.trickHistory.
 *
 * `tricksTaken` is keyed by winner and stores bare Card[], so it cannot answer "who played
 * which card, in what order" — the question every void deduction in the AI is built on.
 * `trickHistory` keeps the round's completed tricks in play order, and unlike
 * `lastCompletedTrick` it is cleared when a new round starts.
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { GameTestHelper, card, createHand } from './testHelpers.js';

/** Two-player round set up as far as the first trick. Alice wins the bid and picks Herz. */
function startTrickPhase(): GameTestHelper {
  const game = GameTestHelper.create('trick-history-session');

  game.alice.joins();
  game.bob.joins();
  game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

  game.dealCards({
    alice: createHand([
      ['herz', 'ass', 0],
      ['herz', 'ass', 1],
      ['herz', '10', 0],
      ['herz', 'koenig', 0],
      ['herz', 'ober', 0],
      ['herz', 'buabe', 0],
      ['kreuz', 'ass', 0],
      ['kreuz', '10', 0],
      ['kreuz', 'koenig', 0],
      ['kreuz', 'ober', 0],
      ['schippe', 'ass', 0],
      ['schippe', '10', 0],
      ['schippe', 'koenig', 0],
      ['schippe', 'ober', 0],
      ['bollen', 'ass', 0],
      ['bollen', '10', 0],
      ['bollen', 'koenig', 0],
      ['bollen', 'buabe', 0],
    ]),
    bob: createHand([
      ['herz', '10', 1],
      ['herz', 'koenig', 1],
      ['herz', 'ober', 1],
      ['herz', 'buabe', 1],
      ['kreuz', 'ass', 1],
      ['kreuz', '10', 1],
      ['kreuz', 'koenig', 1],
      ['kreuz', 'ober', 1],
      ['kreuz', 'buabe', 0],
      ['kreuz', 'buabe', 1],
      ['schippe', 'ass', 1],
      ['schippe', '10', 1],
      ['schippe', 'koenig', 1],
      ['schippe', 'buabe', 0],
      ['bollen', 'ass', 1],
      ['bollen', '10', 1],
      ['bollen', 'koenig', 1],
      ['bollen', 'ober', 0],
    ]),
    dabb: createHand([
      ['schippe', 'ober', 1],
      ['schippe', 'buabe', 1],
      ['bollen', 'ober', 1],
      ['bollen', 'buabe', 1],
    ]),
  });

  game.bob.bids(150);
  game.alice.bids(160);
  game.bob.passes();

  game.alice.takesDabb();
  game.alice.declaresTrump('herz');
  game.alice.discards([
    card('kreuz', 'koenig', 0),
    card('kreuz', 'ober', 0),
    card('bollen', 'koenig', 0),
    card('bollen', 'buabe', 0),
  ]);

  game.alice.declaresMelds(game.detectMeldsFor(0 as PlayerIndex));
  game.bob.declaresMelds(game.detectMeldsFor(1 as PlayerIndex));
  game.completeMelding();

  return game;
}

describe('trickHistory', () => {
  it('records completed tricks in play order with the player who played each card', () => {
    const game = startTrickPhase();

    // Bob is the first bidder, so he leads.
    expect(game.state.currentPlayer).toBe(1);
    expect(game.state.trickHistory).toHaveLength(0);

    // Trick 1: Bob leads Kreuz Ass. Alice must follow suit; her own Kreuz Ass is equal, not
    // higher, so no card of hers beats it and the must-beat rule leaves her free to pick.
    game.bob.plays(card('kreuz', 'ass', 1));
    game.alice.plays(card('kreuz', 'ass', 0));

    expect(game.state.trickHistory).toHaveLength(1);

    const first = game.state.trickHistory[0];
    expect(first.cards.map((c) => c.playerIndex)).toEqual([1, 0]);
    expect(first.cards.map((c) => c.card.id)).toEqual(['kreuz-ass-1', 'kreuz-ass-0']);
    expect(first.round).toBe(game.state.round);

    // Trick 2: whoever won leads again — the point is only that history keeps growing and
    // keeps each trick's own play order.
    const leader = game.state.currentPlayer!;
    const leaderHand = game.state.hands.get(leader)!;
    const leadCard = leaderHand[0];
    const follower = leader === 0 ? game.bob : game.alice;

    (leader === 0 ? game.alice : game.bob).plays(leadCard);
    follower.plays(game.state.hands.get(leader === 0 ? 1 : (0 as PlayerIndex))![0]);

    expect(game.state.trickHistory).toHaveLength(2);
    expect(game.state.trickHistory[0].cards.map((c) => c.card.id)).toEqual([
      'kreuz-ass-1',
      'kreuz-ass-0',
    ]);
    expect(game.state.trickHistory[1].cards[0].playerIndex).toBe(leader);
  });

  it('keeps trickHistory and tricksTaken consistent', () => {
    const game = startTrickPhase();

    game.bob.plays(card('kreuz', 'ass', 1));
    game.alice.plays(card('kreuz', 'ass', 0));

    const trick = game.state.trickHistory[0];
    const winnerTricks = game.state.tricksTaken.get(trick.winnerIndex)!;

    // Same cards, but tricksTaken has lost who played what — that is the gap trickHistory fills.
    expect(
      winnerTricks
        .at(-1)!
        .map((c) => c.id)
        .sort()
    ).toEqual(trick.cards.map((c) => c.card.id).sort());
  });

  it('clears trickHistory on a new round while lastCompletedTrick survives (regression)', () => {
    const game = startTrickPhase();

    game.bob.plays(card('kreuz', 'ass', 1));
    game.alice.plays(card('kreuz', 'ass', 0));

    expect(game.state.trickHistory).toHaveLength(1);
    const roundOne = game.state.round;

    game.scoreRound({
      scores: {
        0: { melds: 0, tricks: 0, total: 0, bidMet: false },
        1: { melds: 0, tricks: 0, total: 0, bidMet: true },
      } as never,
      totalScores: { 0: -320, 1: 0 } as never,
    });
    game.startNewRound({ round: roundOne + 1, dealer: 1 as PlayerIndex });

    // A void deduced from last round's trick says nothing about the hand just dealt.
    expect(game.state.trickHistory).toEqual([]);

    // lastCompletedTrick deliberately survives — the trick sweep animation still needs it, and
    // it carries its own `round` so consumers can tell it is stale.
    expect(game.state.lastCompletedTrick).not.toBeNull();
    expect(game.state.lastCompletedTrick!.round).toBe(roundOne);
    expect(game.state.round).toBe(roundOne + 1);
  });
});
