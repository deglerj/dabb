/**
 * Tests for the "going out" (Abgehen) feature
 */

import { describe, it, expect } from 'vitest';
import type { PlayerIndex, Suit } from '@dabb/shared-types';
import { GameTestHelper, createHand } from './testHelpers.js';
import { detectMelds } from '../melds/detector.js';

describe('Going Out (Abgehen)', () => {
  // Create test hands using correct rank values ('10' not 'zehn')
  const aliceHand = createHand([
    ['herz', 'ass', 0],
    ['herz', '10', 0],
    ['herz', 'koenig', 0],
    ['herz', 'ober', 0],
    ['herz', 'buabe', 0],
    ['kreuz', 'ass', 0],
    ['kreuz', '10', 0],
    ['kreuz', 'koenig', 0],
    ['kreuz', 'ober', 0],
    ['kreuz', 'buabe', 0],
    ['schippe', 'ass', 0],
    ['schippe', '10', 0],
    ['schippe', 'koenig', 0],
    ['schippe', 'ober', 0],
    ['schippe', 'buabe', 0],
    ['bollen', 'ass', 0],
    ['bollen', '10', 0],
    ['bollen', 'koenig', 0],
  ]);

  const bobHand = createHand([
    ['herz', 'ass', 1],
    ['herz', '10', 1],
    ['herz', 'koenig', 1],
    ['herz', 'ober', 1],
    ['herz', 'buabe', 1],
    ['kreuz', 'ass', 1],
    ['kreuz', '10', 1],
    ['kreuz', 'koenig', 1],
    ['kreuz', 'ober', 1],
    ['kreuz', 'buabe', 1],
    ['schippe', 'ass', 1],
    ['schippe', '10', 1],
    ['schippe', 'koenig', 1],
    ['schippe', 'ober', 1],
    ['schippe', 'buabe', 1],
    ['bollen', 'ass', 1],
    ['bollen', '10', 1],
    ['bollen', 'koenig', 1],
  ]);

  const dabbCards = createHand([
    ['bollen', 'ober', 0],
    ['bollen', 'buabe', 0],
    ['bollen', 'ober', 1],
    ['bollen', 'buabe', 1],
  ]);

  function setupGameToDabb(): GameTestHelper {
    const game = GameTestHelper.create('test-goingout');
    game.alice.joins();
    game.bob.joins();
    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });
    game.dealCards({ alice: aliceHand, bob: bobHand, dabb: dabbCards });

    // Alice bids and Bob passes
    game.bob.bids(150);
    game.alice.bids(160);
    game.bob.passes();
    // BiddingWonEvent is automatically generated

    // Alice takes the dabb
    game.alice.takesDabb();

    return game;
  }

  it('should transition to melding phase when going out', () => {
    const game = setupGameToDabb();

    // Alice goes out in Schippe
    game.alice.goesOut('schippe' as Suit);

    expect(game.state.phase).toBe('melding');
    expect(game.state.trump).toBe('schippe');
    expect(game.state.wentOut).toBe(true);
  });

  it('should set the chosen suit as trump when going out', () => {
    const game = setupGameToDabb();

    game.alice.goesOut('herz' as Suit);

    expect(game.state.trump).toBe('herz');
  });

  it('should mark wentOut as true in game state', () => {
    const game = setupGameToDabb();

    expect(game.state.wentOut).toBe(false);
    game.alice.goesOut('bollen' as Suit);
    expect(game.state.wentOut).toBe(true);
  });

  it('should initialize empty declaredMelds map when going out', () => {
    const game = setupGameToDabb();

    game.alice.goesOut('kreuz' as Suit);

    expect(game.state.declaredMelds.size).toBe(0);
  });

  it('should allow non-bid-winner to meld after going out', () => {
    const game = setupGameToDabb();
    game.alice.goesOut('herz' as Suit);

    // Bob should be able to detect and declare melds
    const bobMelds = detectMelds(game.state.hands.get(1 as PlayerIndex) || [], 'herz');
    game.bob.declaresMelds(bobMelds);

    expect(game.state.declaredMelds.has(1 as PlayerIndex)).toBe(true);
  });

  it('should create correct GOING_OUT event with payload', () => {
    const game = setupGameToDabb();
    game.alice.goesOut('schippe' as Suit);

    const goingOutEvent = game.allEvents.find((e) => e.type === 'GOING_OUT');
    expect(goingOutEvent).toBeDefined();
    expect(goingOutEvent!.type).toBe('GOING_OUT');

    if (goingOutEvent && goingOutEvent.type === 'GOING_OUT') {
      expect(goingOutEvent.payload.playerIndex).toBe(0);
      expect(goingOutEvent.payload.suit).toBe('schippe');
    }
  });

  describe('wentOut flag reset', () => {
    it('should reset wentOut to false on new round', () => {
      const game = setupGameToDabb();
      game.alice.goesOut('herz' as Suit);

      expect(game.state.wentOut).toBe(true);

      // Start a new round
      game.startNewRound({ round: 2, dealer: 1 as PlayerIndex });

      expect(game.state.wentOut).toBe(false);
    });
  });

  describe('Scoring when going out', () => {
    it('should set up correct state for going out scoring', () => {
      const game = setupGameToDabb();
      game.alice.goesOut('herz' as Suit);

      // Expected scoring when melding completes:
      // Alice (bid winner who went out): -160 (loses bid)
      // Bob: melds + 30 bonus

      // Verify the state is set up correctly for scoring
      expect(game.state.phase).toBe('melding');
      expect(game.state.wentOut).toBe(true);
      expect(game.state.bidWinner).toBe(0);
      expect(game.state.currentBid).toBe(160);

      // Bob's hand should still be intact for melding
      expect(game.state.hands.get(1 as PlayerIndex)?.length).toBe(18);
    });
  });
});
