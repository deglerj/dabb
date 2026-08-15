import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import { createInitialState } from '@dabb/game-logic';
import type { Card, GameState } from '@dabb/shared-types';
import { DEAL_ARC_MS, DEAL_STAGGER_MS, PlayerHand } from '../PlayerHand.js';

const CARDS: Card[] = [
  { id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 },
  { id: 'kreuz-koenig-0', suit: 'kreuz', rank: 'koenig', copy: 0 },
  { id: 'herz-ober-0', suit: 'herz', rank: 'ober', copy: 0 },
  { id: 'herz-buabe-0', suit: 'herz', rank: 'buabe', copy: 0 },
];

function biddingState(cards: Card[]): GameState {
  const state = createInitialState(3);
  return { ...state, phase: 'bidding', hands: new Map([[0, cards]]) };
}

/** Number of card views currently on the table — one child per rendered CardView. */
function cardCount(container: HTMLElement): number {
  return container.firstElementChild?.children.length ?? 0;
}

function renderHand(cards: Card[], animateDeal: boolean, onDealComplete?: () => void) {
  return render(
    <PlayerHand
      gameState={biddingState(cards)}
      playerIndex={0}
      cards={cards}
      onPlayCard={() => {}}
      animateDeal={animateDeal}
      onDealComplete={onDealComplete}
    />
  );
}

describe('PlayerHand deal animation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deals the hand out one card at a time and reports when it has landed', () => {
    const onDealComplete = vi.fn();
    const { container } = renderHand(CARDS, true, onDealComplete);

    expect(cardCount(container)).toBe(0);

    act(() => void vi.advanceTimersByTime(DEAL_STAGGER_MS));
    expect(cardCount(container)).toBe(1);

    act(() => void vi.advanceTimersByTime(3 * DEAL_STAGGER_MS));
    expect(cardCount(container)).toBe(CARDS.length);
    // Last card still in flight — the bidding dialog must not cover it yet.
    expect(onDealComplete).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(DEAL_STAGGER_MS + DEAL_ARC_MS));
    expect(onDealComplete).toHaveBeenCalled();
  });

  // A deal that was already in the log when this client joined is only being replayed — the
  // player is dropped into the current state and must not watch their hand arrive again.
  it('shows the whole hand at once for a replayed deal (regression)', () => {
    const onDealComplete = vi.fn();
    const { container } = renderHand(CARDS, false, onDealComplete);

    expect(cardCount(container)).toBe(CARDS.length);
    // Nothing to wait for, so anything gated on the deal has to be released right away.
    expect(onDealComplete).toHaveBeenCalled();
  });

  // The previous round's last trick sweeps off the table before the next hand appears, so the
  // hand is briefly empty. Finishing the deal against those zero cards left it invisible.
  it('waits for the cards when the hand starts out empty (regression)', () => {
    const { container, rerender } = renderHand([], true);

    act(() => void vi.advanceTimersByTime(5 * DEAL_STAGGER_MS));
    expect(cardCount(container)).toBe(0);

    rerender(
      <PlayerHand
        gameState={biddingState(CARDS)}
        playerIndex={0}
        cards={CARDS}
        onPlayCard={() => {}}
        animateDeal={true}
      />
    );

    act(() => void vi.advanceTimersByTime(4 * DEAL_STAGGER_MS));
    expect(cardCount(container)).toBe(CARDS.length);
  });
});
