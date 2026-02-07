import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameScreen from '../GameScreen';
import type { GameState, PlayerIndex, Trick, Card } from '@dabb/shared-types';

// Mock sub-components that have complex native dependencies
vi.mock('../../components/game/ScoreBoard', () => ({
  default: () => null,
}));
vi.mock('../../components/game/ScoreBoardHeader', () => ({
  default: () => null,
}));
vi.mock('../../components/game/GameLog', () => ({
  default: () => null,
}));
vi.mock('../../components/game/CelebrationOverlay', () => ({
  default: () => null,
}));
vi.mock('../../components/LanguageSwitcher', () => ({
  default: () => null,
}));
vi.mock('../../hooks/useTurnNotification', () => ({
  useTurnNotification: vi.fn(),
}));

function makeCard(suit: Card['suit'], rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

function createBaseState(overrides: Partial<GameState> = {}): GameState {
  const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

  return {
    phase: 'bidding',
    playerCount: 2,
    players: [
      { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
      { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
    ],
    hands: new Map([
      [
        0 as PlayerIndex,
        [makeCard('herz', 'ass'), makeCard('kreuz', 'koenig'), makeCard('schippe', 'buabe')],
      ],
      [1 as PlayerIndex, []],
    ]),
    dabb: [],
    currentBid: 150,
    bidWinner: null,
    currentBidder: 0 as PlayerIndex,
    firstBidder: 0 as PlayerIndex,
    passedPlayers: new Set(),
    trump: null,
    currentTrick: emptyTrick,
    tricksTaken: new Map(),
    currentPlayer: null,
    roundScores: new Map(),
    totalScores: new Map([
      [0 as PlayerIndex, 0],
      [1 as PlayerIndex, 0],
    ]),
    targetScore: 1000,
    declaredMelds: new Map(),
    dealer: 0 as PlayerIndex,
    round: 1,
    wentOut: false,
    lastCompletedTrick: null,
    ...overrides,
  };
}

const nicknames = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
]);

describe('GameScreen', () => {
  const defaultProps = {
    state: createBaseState(),
    events: [],
    playerIndex: 0 as PlayerIndex,
    nicknames,
    onBid: vi.fn(),
    onPass: vi.fn(),
    onDeclareTrump: vi.fn(),
    onPlayCard: vi.fn(),
  };

  it('renders bidding phase content', () => {
    const state = createBaseState({
      phase: 'bidding',
      currentBidder: 0 as PlayerIndex,
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Dein Gebot')).toBeInTheDocument();
  });

  it('renders trump selector for bid winner', () => {
    const state = createBaseState({
      phase: 'trump',
      bidWinner: 0 as PlayerIndex,
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Trumpf wählen')).toBeInTheDocument();
  });

  it('renders waiting for trump for non-bid-winner', () => {
    const state = createBaseState({
      phase: 'trump',
      bidWinner: 1 as PlayerIndex,
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Bob wählt Trumpf...')).toBeInTheDocument();
  });

  it('clears selected card when phase changes', () => {
    const state1 = createBaseState({
      phase: 'tricks',
      trump: 'herz',
      currentPlayer: 0 as PlayerIndex,
    });

    const { rerender } = render(<GameScreen {...defaultProps} state={state1} />);

    // Select a card
    fireEvent.click(screen.getByText('A'));
    expect(screen.getByText('Tippe nochmal um zu spielen')).toBeInTheDocument();

    // Phase changes to scoring
    const state2 = createBaseState({
      phase: 'scoring',
      trump: 'herz',
    });
    rerender(<GameScreen {...defaultProps} state={state2} />);

    // Hint should be gone since selectedCardId was cleared
    expect(screen.queryByText('Tippe nochmal um zu spielen')).not.toBeInTheDocument();
  });

  it('card selection: tap selects, second tap plays', () => {
    const onPlayCard = vi.fn();
    const state = createBaseState({
      phase: 'tricks',
      trump: 'herz',
      currentPlayer: 0 as PlayerIndex,
    });

    render(<GameScreen {...defaultProps} state={state} onPlayCard={onPlayCard} />);

    // First tap selects
    fireEvent.click(screen.getByText('A'));
    expect(onPlayCard).not.toHaveBeenCalled();
    expect(screen.getByText('Tippe nochmal um zu spielen')).toBeInTheDocument();

    // Second tap plays
    fireEvent.click(screen.getByText('A'));
    expect(onPlayCard).toHaveBeenCalledWith('herz-ass-0');
  });

  it('shows tap again to play hint when card selected in tricks', () => {
    const state = createBaseState({
      phase: 'tricks',
      trump: 'herz',
      currentPlayer: 0 as PlayerIndex,
    });

    render(<GameScreen {...defaultProps} state={state} />);

    fireEvent.click(screen.getByText('A'));
    expect(screen.getByText('Tippe nochmal um zu spielen')).toBeInTheDocument();
  });
});
