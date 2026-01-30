/**
 * Tests for game termination functionality
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { GameTestHelper, createHand } from './testHelpers.js';

describe('Game Termination', () => {
  it('handles GAME_TERMINATED event and sets phase to terminated', () => {
    // Setup a game in progress
    const game = GameTestHelper.create('test-session');

    game.alice.joins();
    game.bob.joins();

    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

    // Deal some cards to get to bidding phase
    const aliceHand = createHand([
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
      ['bollen', 'ober', 0],
    ]);

    const bobHand = createHand([
      ['herz', '10', 1],
      ['herz', 'koenig', 1],
      ['herz', 'ober', 1],
      ['herz', 'buabe', 1],
      ['kreuz', 'ass', 1],
      ['kreuz', '10', 1],
      ['kreuz', 'koenig', 1],
      ['kreuz', 'ober', 1],
      ['schippe', 'ass', 1],
      ['schippe', '10', 1],
      ['schippe', 'koenig', 1],
      ['schippe', 'ober', 1],
      ['bollen', 'ass', 1],
      ['bollen', '10', 1],
      ['bollen', 'koenig', 1],
      ['bollen', 'ober', 1],
      ['kreuz', 'buabe', 0],
      ['kreuz', 'buabe', 1],
    ]);

    const dabb = createHand([
      ['schippe', 'buabe', 0],
      ['schippe', 'buabe', 1],
      ['bollen', 'buabe', 0],
      ['bollen', 'buabe', 1],
    ]);

    game.dealCards({ alice: aliceHand, bob: bobHand, dabb });

    // Verify we're in bidding phase
    expect(game.state.phase).toBe('bidding');

    // Now terminate the game
    game.terminateGame(0 as PlayerIndex);

    // Verify the game is terminated
    expect(game.state.phase).toBe('terminated');
  });

  it('can terminate game from different phases', () => {
    const game = GameTestHelper.create('test-session');

    game.alice.joins();
    game.bob.joins();

    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

    const aliceHand = createHand([
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
      ['bollen', 'ober', 0],
    ]);

    const bobHand = createHand([
      ['herz', '10', 1],
      ['herz', 'koenig', 1],
      ['herz', 'ober', 1],
      ['herz', 'buabe', 1],
      ['kreuz', 'ass', 1],
      ['kreuz', '10', 1],
      ['kreuz', 'koenig', 1],
      ['kreuz', 'ober', 1],
      ['schippe', 'ass', 1],
      ['schippe', '10', 1],
      ['schippe', 'koenig', 1],
      ['schippe', 'ober', 1],
      ['bollen', 'ass', 1],
      ['bollen', '10', 1],
      ['bollen', 'koenig', 1],
      ['bollen', 'ober', 1],
      ['kreuz', 'buabe', 0],
      ['kreuz', 'buabe', 1],
    ]);

    const dabb = createHand([
      ['schippe', 'buabe', 0],
      ['schippe', 'buabe', 1],
      ['bollen', 'buabe', 0],
      ['bollen', 'buabe', 1],
    ]);

    game.dealCards({ alice: aliceHand, bob: bobHand, dabb });

    // Progress to dabb phase
    game.bob.bids(150);
    game.alice.passes();

    expect(game.state.phase).toBe('dabb');

    // Terminate from dabb phase
    game.terminateGame(1 as PlayerIndex); // Bob terminates

    expect(game.state.phase).toBe('terminated');
  });
});
