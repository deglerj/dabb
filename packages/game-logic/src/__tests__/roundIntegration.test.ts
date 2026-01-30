/**
 * Integration test for a complete two-player Binokel round
 *
 * This test simulates all phases of a round:
 * 1. Game setup (players join, game starts)
 * 2. Dealing cards (predetermined hands for deterministic testing)
 * 3. Bidding (Bob bids 150, Alice raises to 160, Bob passes)
 * 4. Dabb phase (Alice takes and discards)
 * 5. Trump declaration (Alice declares Herz)
 * 6. Meld declaration (both players declare melds)
 * 7. Trick-taking (all 18 tricks played)
 * 8. Scoring (round is scored)
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { GameTestHelper, card, createHand } from './testHelpers.js';
import { calculateMeldPoints } from '../melds/detector.js';
import { calculateTrickPoints } from '../phases/tricks.js';

describe('Two-Player Round Integration', () => {
  it('simulates a complete round with bidding, dabb, trump, melds, tricks, and scoring', () => {
    // ===== SETUP =====
    const game = GameTestHelper.create('test-session');

    // Players join
    game.alice.joins();
    game.bob.joins();

    expect(game.state.players).toHaveLength(2);
    expect(game.state.phase).toBe('waiting');

    // Start game with Alice as dealer
    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

    expect(game.state.phase).toBe('dealing');
    expect(game.state.dealer).toBe(0);

    // ===== DEAL CARDS =====
    // Create predetermined hands for deterministic testing
    // Alice's hand: Good Herz cards for a strong Herz trump declaration
    const aliceHand = createHand([
      // Herz cards (trump will be Herz)
      ['herz', 'ass', 0],
      ['herz', 'ass', 1],
      ['herz', '10', 0],
      ['herz', 'koenig', 0],
      ['herz', 'ober', 0],
      ['herz', 'buabe', 0],
      // Kreuz cards
      ['kreuz', 'ass', 0],
      ['kreuz', '10', 0],
      ['kreuz', 'koenig', 0],
      ['kreuz', 'ober', 0],
      // Schippe cards
      ['schippe', 'ass', 0],
      ['schippe', '10', 0],
      ['schippe', 'koenig', 0],
      ['schippe', 'ober', 0],
      // Bollen cards
      ['bollen', 'ass', 0],
      ['bollen', '10', 0],
      ['bollen', 'koenig', 0],
      ['bollen', 'buabe', 0],
    ]);

    // Bob's hand: Weaker cards
    const bobHand = createHand([
      // Herz cards
      ['herz', '10', 1],
      ['herz', 'koenig', 1],
      ['herz', 'ober', 1],
      ['herz', 'buabe', 1],
      // Kreuz cards
      ['kreuz', 'ass', 1],
      ['kreuz', '10', 1],
      ['kreuz', 'koenig', 1],
      ['kreuz', 'ober', 1],
      ['kreuz', 'buabe', 0],
      ['kreuz', 'buabe', 1],
      // Schippe cards
      ['schippe', 'ass', 1],
      ['schippe', '10', 1],
      ['schippe', 'koenig', 1],
      ['schippe', 'buabe', 0],
      // Bollen cards
      ['bollen', 'ass', 1],
      ['bollen', '10', 1],
      ['bollen', 'koenig', 1],
      ['bollen', 'ober', 0],
    ]);

    // Dabb: 4 cards that Alice will take
    const dabbCards = createHand([
      ['schippe', 'ober', 1],
      ['schippe', 'buabe', 1],
      ['bollen', 'ober', 1],
      ['bollen', 'buabe', 1],
    ]);

    game.dealCards({ alice: aliceHand, bob: bobHand, dabb: dabbCards });

    expect(game.state.phase).toBe('bidding');
    expect(game.state.hands.get(0 as PlayerIndex)).toHaveLength(18);
    expect(game.state.hands.get(1 as PlayerIndex)).toHaveLength(18);
    expect(game.state.dabb).toHaveLength(4);

    // First bidder is (dealer + 1) % playerCount = 1 (Bob)
    expect(game.state.currentBidder).toBe(1);

    // ===== BIDDING =====
    // Bob opens with 150
    game.bob.bids(150);
    expect(game.state.currentBid).toBe(150);
    expect(game.state.currentBidder).toBe(0); // Alice's turn

    // Alice raises to 160
    game.alice.bids(160);
    expect(game.state.currentBid).toBe(160);
    expect(game.state.currentBidder).toBe(1); // Bob's turn

    // Bob passes - Alice wins the bid
    game.bob.passes();
    expect(game.state.phase).toBe('dabb');
    expect(game.state.bidWinner).toBe(0); // Alice
    expect(game.state.currentBid).toBe(160);

    // ===== DABB PHASE =====
    // Alice takes the dabb
    game.alice.takesDabb();
    expect(game.state.hands.get(0 as PlayerIndex)).toHaveLength(22); // 18 + 4
    expect(game.state.dabb).toHaveLength(0);

    // Alice discards 4 cards (the weakest ones)
    const discardCards = [
      card('kreuz', 'koenig', 0),
      card('kreuz', 'ober', 0),
      card('bollen', 'koenig', 0),
      card('bollen', 'buabe', 0),
    ];
    game.alice.discards(discardCards);

    expect(game.state.phase).toBe('trump');
    expect(game.state.hands.get(0 as PlayerIndex)).toHaveLength(18);

    // ===== TRUMP DECLARATION =====
    game.alice.declaresTrump('herz');

    expect(game.state.phase).toBe('melding');
    expect(game.state.trump).toBe('herz');

    // ===== MELD DECLARATION =====
    // Detect and declare melds for Alice
    // Alice should have: Herz Familie (150 pts - trump), Binokel (40 pts from schippe-ober + bollen-buabe from dabb)
    const aliceMelds = game.detectMeldsFor(0 as PlayerIndex);
    game.alice.declaresMelds(aliceMelds);

    // Detect and declare melds for Bob
    // Bob should have: Herz Paar (40 pts - trump), Kreuz Paar (20 pts)
    const bobMelds = game.detectMeldsFor(1 as PlayerIndex);
    game.bob.declaresMelds(bobMelds);

    expect(game.state.declaredMelds.get(0 as PlayerIndex)).toBeDefined();
    expect(game.state.declaredMelds.get(1 as PlayerIndex)).toBeDefined();

    // Complete melding phase
    game.completeMelding();

    expect(game.state.phase).toBe('tricks');
    expect(game.state.currentPlayer).toBe(0); // Bid winner leads

    // ===== TRICK-TAKING =====
    // Get the hands after all setup
    const aliceHandAfterSetup = [...game.state.hands.get(0 as PlayerIndex)!];
    const bobHandAfterSetup = [...game.state.hands.get(1 as PlayerIndex)!];

    // Track remaining cards for each player
    let aliceRemaining = [...aliceHandAfterSetup];
    let bobRemaining = [...bobHandAfterSetup];

    // Play all 18 tricks
    for (let trickNum = 0; trickNum < 18; trickNum++) {
      const state = game.state;
      const leader = state.currentPlayer!;

      // Get the leader's card (first valid card in their hand)
      const leaderHand = leader === 0 ? aliceRemaining : bobRemaining;
      const leaderCard = leaderHand[0];

      // Play leader's card
      if (leader === 0) {
        game.alice.plays(leaderCard);
        aliceRemaining = aliceRemaining.filter((c) => c.id !== leaderCard.id);
      } else {
        game.bob.plays(leaderCard);
        bobRemaining = bobRemaining.filter((c) => c.id !== leaderCard.id);
      }

      // Get the follower's card (first card in their hand)
      const followerHand = leader === 0 ? bobRemaining : aliceRemaining;
      const followerCard = followerHand[0];

      // Play follower's card
      if (leader === 0) {
        game.bob.plays(followerCard);
        bobRemaining = bobRemaining.filter((c) => c.id !== followerCard.id);
      } else {
        game.alice.plays(followerCard);
        aliceRemaining = aliceRemaining.filter((c) => c.id !== followerCard.id);
      }
    }

    // All cards should be played
    expect(aliceRemaining).toHaveLength(0);
    expect(bobRemaining).toHaveLength(0);

    // Verify tricks were tracked
    expect(game.state.tricksTaken.get(0 as PlayerIndex)).toBeDefined();
    expect(game.state.tricksTaken.get(1 as PlayerIndex)).toBeDefined();

    // Total tricks should equal 18
    const aliceTricks = game.state.tricksTaken.get(0 as PlayerIndex)!;
    const bobTricks = game.state.tricksTaken.get(1 as PlayerIndex)!;
    expect(aliceTricks.length + bobTricks.length).toBe(18);

    // ===== SCORING =====
    const aliceMeldPoints = calculateMeldPoints(aliceMelds);
    const bobMeldPoints = calculateMeldPoints(bobMelds);

    // Calculate actual trick points from tricks taken
    const aliceActualTrickPoints = aliceTricks.reduce(
      (sum, trick) => sum + calculateTrickPoints(trick),
      0
    );
    const bobActualTrickPoints = bobTricks.reduce(
      (sum, trick) => sum + calculateTrickPoints(trick),
      0
    );

    // Alice's total for the round
    const aliceRoundTotal = aliceMeldPoints + aliceActualTrickPoints;
    // Did Alice meet her bid?
    const aliceBidMet = aliceRoundTotal >= 160;

    // If Alice didn't meet her bid, she gets negative points
    const aliceScore = aliceBidMet ? aliceRoundTotal : -160;
    const bobScore = bobMeldPoints + bobActualTrickPoints;

    game.scoreRound({
      scores: {
        0: {
          melds: aliceMeldPoints,
          tricks: aliceActualTrickPoints,
          total: aliceScore,
          bidMet: aliceBidMet,
        },
        1: {
          melds: bobMeldPoints,
          tricks: bobActualTrickPoints,
          total: bobScore,
          bidMet: true, // Non-bidder always "meets" bid
        },
        2: { melds: 0, tricks: 0, total: 0, bidMet: true },
        3: { melds: 0, tricks: 0, total: 0, bidMet: true },
      },
      totalScores: {
        0: aliceScore,
        1: bobScore,
        2: 0,
        3: 0,
      },
    });

    expect(game.state.phase).toBe('scoring');
    expect(game.state.totalScores.get(0 as PlayerIndex)).toBe(aliceScore);
    expect(game.state.totalScores.get(1 as PlayerIndex)).toBe(bobScore);

    // ===== NEW ROUND =====
    // If no one has reached 1000, start a new round
    if (aliceScore < 1000 && bobScore < 1000) {
      // Dealer rotates: next dealer is Bob (player 1)
      game.startNewRound({ round: 2, dealer: 1 as PlayerIndex });

      expect(game.state.phase).toBe('dealing');
      expect(game.state.round).toBe(2);
      expect(game.state.dealer).toBe(1);
    }

    // Verify the complete flow worked
    const finalState = game.state;
    expect(finalState.players).toHaveLength(2);
    expect(finalState.totalScores.size).toBeGreaterThan(0);
  });

  it('handles bidding where first bidder wins without competition', () => {
    const game = GameTestHelper.create('test-session-2');

    game.alice.joins();
    game.bob.joins();
    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

    // Simple hands for quick test
    const simpleHand = createHand([
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

    const dabb = createHand([
      ['bollen', 'ober', 0],
      ['bollen', 'buabe', 0],
      ['herz', 'ass', 1],
      ['herz', '10', 1],
    ]);

    game.dealCards({ alice: simpleHand, bob: simpleHand, dabb });

    // Bob (first bidder) bids 150
    game.bob.bids(150);
    expect(game.state.currentBid).toBe(150);

    // Alice passes immediately - Bob wins
    game.alice.passes();
    expect(game.state.phase).toBe('dabb');
    expect(game.state.bidWinner).toBe(1); // Bob wins
    expect(game.state.currentBid).toBe(150);
  });

  it('tracks meld points correctly with trump bonus', () => {
    const game = GameTestHelper.create('test-session-3');

    game.alice.joins();
    game.bob.joins();
    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

    // Alice gets a Herz Familie
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

    const dabb = createHand([
      ['bollen', 'ober', 0],
      ['bollen', 'buabe', 0],
      ['bollen', 'ober', 1],
      ['bollen', 'buabe', 1],
    ]);

    game.dealCards({ alice: aliceHand, bob: bobHand, dabb });

    // Quick bidding
    game.bob.bids(150);
    game.alice.bids(160);
    game.bob.passes();

    // Dabb
    game.alice.takesDabb();
    game.alice.discards([
      card('bollen', 'ober', 0),
      card('bollen', 'buabe', 0),
      card('bollen', 'ober', 1),
      card('bollen', 'buabe', 1),
    ]);

    // Trump = Herz
    game.alice.declaresTrump('herz');

    // Detect melds - Alice should have Herz Familie worth 150 (100 + 50 trump bonus)
    const aliceMelds = game.detectMeldsFor(0 as PlayerIndex);
    const familie = aliceMelds.find((m) => m.type === 'familie' && m.suit === 'herz');

    expect(familie).toBeDefined();
    expect(familie!.points).toBe(150); // 100 base + 50 trump bonus
  });
});
