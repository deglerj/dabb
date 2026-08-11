/**
 * Tests for reducer paths not covered by integration tests:
 * - Error paths for null firstBidder
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { applyEvents } from '../state/reducer.js';
import { filterEventsForPlayer } from '../state/views.js';
import { createDeck, dealCards, shuffleDeck } from '../cards/deck.js';
import {
  createPlayerJoinedEvent,
  createGameStartedEvent,
  createBidPlacedEvent,
  createPlayerPassedEvent,
  createCardsDealtEvent,
  createBiddingWonEvent,
  createDabbTakenEvent,
  createTrumpDeclaredEvent,
  createCardsDiscardedEvent,
  createTrickWonEvent,
  createNewRoundStartedEvent,
  createCardPlayedEvent,
} from '../events/generators.js';
import type { Card, GameEvent } from '@dabb/shared-types';

const SESSION_ID = 'test-session';
let seq = 0;
function ctx() {
  return { sessionId: SESSION_ID, sequence: ++seq };
}

function setupTwoPlayerGame() {
  const events = [
    createPlayerJoinedEvent(ctx(), 'player-alice', 0 as PlayerIndex, 'Alice'),
    createPlayerJoinedEvent(ctx(), 'player-bob', 1 as PlayerIndex, 'Bob'),
    createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex),
  ];
  return applyEvents(events);
}

describe('reducer: error paths', () => {
  it('throws when BID_PLACED arrives with null firstBidder', () => {
    // Manually build a state with firstBidder=null — this shouldn't happen
    // in normal gameplay but the reducer guards against it
    const state = setupTwoPlayerGame();
    // Corrupt the state by nulling firstBidder
    const corruptState = { ...state, firstBidder: null };

    expect(() =>
      applyEvents(
        [createBidPlacedEvent(ctx(), 0 as PlayerIndex, 150)],
        corruptState as typeof state
      )
    ).toThrow('firstBidder is null during bidding');
  });

  it('throws when PLAYER_PASSED arrives with null firstBidder', () => {
    const state = setupTwoPlayerGame();
    const corruptState = { ...state, firstBidder: null };

    expect(() =>
      applyEvents([createPlayerPassedEvent(ctx(), 1 as PlayerIndex)], corruptState as typeof state)
    ).toThrow('firstBidder is null during bidding');
  });
});

describe('reducer: NEW_ROUND_STARTED and the last trick', () => {
  it('keeps the last completed trick across the round reset (regression)', () => {
    // The final card of a round arrives as one cascade (CARD_PLAYED, TRICK_WON, ROUND_SCORED,
    // NEW_ROUND_STARTED, CARDS_DEALT), so a client only ever sees the state after the reset.
    // Clearing lastCompletedTrick there wiped the round's last trick off the table instantly
    // instead of holding and sweeping it like every other trick.
    const events: GameEvent[] = [
      createPlayerJoinedEvent(ctx(), 'player-alice', 0 as PlayerIndex, 'Alice'),
      createPlayerJoinedEvent(ctx(), 'player-bob', 1 as PlayerIndex, 'Bob'),
      createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex),
    ];
    const { hands, dabb } = dealCards(shuffleDeck(createDeck()), 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, idx) => {
      handsRecord[idx as PlayerIndex] = cards;
    });
    events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));

    const aliceCard = handsRecord[0 as PlayerIndex][0];
    const bobCard = handsRecord[1 as PlayerIndex][0];
    events.push(createCardPlayedEvent(ctx(), 0 as PlayerIndex, aliceCard));
    events.push(createCardPlayedEvent(ctx(), 1 as PlayerIndex, bobCard));
    events.push(createTrickWonEvent(ctx(), 0 as PlayerIndex, [aliceCard, bobCard], 20));

    const afterTrick = applyEvents(events);
    expect(afterTrick.lastCompletedTrick?.round).toBe(afterTrick.round);

    events.push(createNewRoundStartedEvent(ctx(), afterTrick.round + 1, 1 as PlayerIndex));
    const afterReset = applyEvents(events);

    expect(afterReset.lastCompletedTrick?.cards.map((c) => c.cardId)).toEqual([
      aliceCard.id,
      bobCard.id,
    ]);
    // ...but it is stamped with the round it was played in, so consumers can tell it is stale.
    expect(afterReset.lastCompletedTrick?.round).toBe(afterReset.round - 1);
  });
});

describe("reducer: CARDS_DISCARDED hand size in other players' views", () => {
  it("shrinks the bid winner's hand back to the dealt size for everyone (regression)", () => {
    // Other players see placeholder card IDs, which match nothing in their (equally
    // placeholder) copy of the hand — so the filter alone removed no cards and the bid
    // winner appeared to hold all 22 cards for the rest of the round.
    const events: GameEvent[] = [
      createPlayerJoinedEvent(ctx(), 'player-alice', 0 as PlayerIndex, 'Alice'),
      createPlayerJoinedEvent(ctx(), 'player-bob', 1 as PlayerIndex, 'Bob'),
      createGameStartedEvent(ctx(), 2, 1000, 1 as PlayerIndex),
    ];
    const { hands, dabb } = dealCards(shuffleDeck(createDeck()), 2);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, idx) => {
      handsRecord[idx as PlayerIndex] = cards;
    });
    events.push(createCardsDealtEvent(ctx(), handsRecord, dabb));
    events.push(createBidPlacedEvent(ctx(), 0 as PlayerIndex, 150));
    events.push(createPlayerPassedEvent(ctx(), 1 as PlayerIndex));
    events.push(createBiddingWonEvent(ctx(), 0 as PlayerIndex, 150, dabb));
    events.push(createDabbTakenEvent(ctx(), 0 as PlayerIndex, dabb));
    events.push(createTrumpDeclaredEvent(ctx(), 0 as PlayerIndex, 'herz'));

    const withDabb = applyEvents(events);
    expect(withDabb.hands.get(0 as PlayerIndex)).toHaveLength(22);

    const discarded = withDabb.hands
      .get(0 as PlayerIndex)!
      .slice(0, 4)
      .map((c) => c.id);
    events.push(createCardsDiscardedEvent(ctx(), 0 as PlayerIndex, discarded));

    const ownView = applyEvents(filterEventsForPlayer(events, 0 as PlayerIndex));
    const otherView = applyEvents(filterEventsForPlayer(events, 1 as PlayerIndex));

    expect(ownView.hands.get(0 as PlayerIndex)).toHaveLength(18);
    expect(otherView.hands.get(0 as PlayerIndex)).toHaveLength(18);
  });
});
