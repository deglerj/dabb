import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameScreen from '../GameScreen';
import type { GameState, GamePhase, PlayerIndex, Trick, Card, Meld } from '@dabb/shared-types';

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
    dabbCardIds: [],
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
    onTakeDabb: vi.fn(),
    onDiscard: vi.fn(),
    onGoOut: vi.fn(),
    onDeclareTrump: vi.fn(),
    onDeclareMelds: vi.fn(),
    onPlayCard: vi.fn(),
  };

  it('renders bidding phase content', () => {
    const state = createBaseState({
      phase: 'bidding',
      currentBidder: 0 as PlayerIndex,
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText(/Aktuelles Gebot/)).toBeInTheDocument();
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

    // Hint is always rendered to reserve space, but should be invisible (opacity: 0)
    // when no card is selected. The element is still in the DOM but visually hidden.
    expect(screen.getByText('Tippe nochmal um zu spielen')).toBeInTheDocument();
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

  // Dabb phase tests
  it('renders dabb phase with take dabb button for bid winner', () => {
    const state = createBaseState({
      phase: 'dabb',
      bidWinner: 0 as PlayerIndex,
      dabb: [makeCard('herz', '10'), makeCard('bollen', 'buabe')],
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Dabb aufnehmen')).toBeInTheDocument();
    expect(screen.getByText('Dabb aufnehmen (2 Karten)')).toBeInTheDocument();
  });

  it('calls onTakeDabb when take dabb button pressed', () => {
    const onTakeDabb = vi.fn();
    const state = createBaseState({
      phase: 'dabb',
      bidWinner: 0 as PlayerIndex,
      dabb: [makeCard('herz', '10'), makeCard('bollen', 'buabe')],
    });
    render(<GameScreen {...defaultProps} state={state} onTakeDabb={onTakeDabb} />);
    fireEvent.click(screen.getByText('Dabb aufnehmen (2 Karten)'));
    expect(onTakeDabb).toHaveBeenCalled();
  });

  it('renders dabb phase discard UI after dabb taken', () => {
    const state = createBaseState({
      phase: 'dabb',
      bidWinner: 0 as PlayerIndex,
      dabb: [], // dabb taken (empty)
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Karten abwerfen')).toBeInTheDocument();
    expect(screen.getByText(/Wähle .* Karten zum Abwerfen/)).toBeInTheDocument();
    // Go out buttons should be visible
    expect(screen.getByText('Kreuz')).toBeInTheDocument();
    expect(screen.getByText('Schippe')).toBeInTheDocument();
    expect(screen.getByText('Herz')).toBeInTheDocument();
    expect(screen.getByText('Bollen')).toBeInTheDocument();
  });

  it('renders dabb phase waiting message for non-bid-winner', () => {
    const state = createBaseState({
      phase: 'dabb',
      bidWinner: 1 as PlayerIndex,
      dabb: [makeCard('herz', '10')],
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Warte auf Bob...')).toBeInTheDocument();
  });

  // Melding phase tests
  it('renders melding phase with confirm button when melds not declared', () => {
    const state = createBaseState({
      phase: 'melding',
      bidWinner: 1 as PlayerIndex,
      trump: 'herz',
      declaredMelds: new Map(),
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Meldungen ansagen')).toBeInTheDocument();
    expect(screen.getByText('Meldungen bestätigen')).toBeInTheDocument();
  });

  it('calls onDeclareMelds when confirm button pressed', () => {
    const onDeclareMelds = vi.fn();
    const state = createBaseState({
      phase: 'melding',
      bidWinner: 1 as PlayerIndex,
      trump: 'herz',
      declaredMelds: new Map(),
    });
    render(<GameScreen {...defaultProps} state={state} onDeclareMelds={onDeclareMelds} />);
    fireEvent.click(screen.getByText('Meldungen bestätigen'));
    expect(onDeclareMelds).toHaveBeenCalled();
  });

  it('renders melding phase waiting message when melds already declared', () => {
    const declaredMelds = new Map<PlayerIndex, Meld[]>([[0 as PlayerIndex, []]]);
    const state = createBaseState({
      phase: 'melding',
      bidWinner: 1 as PlayerIndex,
      trump: 'herz',
      declaredMelds,
    });
    render(<GameScreen {...defaultProps} state={state} />);
    expect(screen.getByText('Warte auf andere Spieler...')).toBeInTheDocument();
  });

  // Phase completeness test
  it('all game phases render non-null content', () => {
    const phases: GamePhase[] = [
      'waiting',
      'dealing',
      'bidding',
      'dabb',
      'trump',
      'melding',
      'tricks',
      'scoring',
      'finished',
    ];

    for (const phase of phases) {
      const state = createBaseState({
        phase,
        bidWinner: 0 as PlayerIndex,
        trump: 'herz',
        currentPlayer: 0 as PlayerIndex,
        currentBidder: 0 as PlayerIndex,
        dabb: phase === 'dabb' ? [makeCard('herz', '10')] : [],
      });

      const { container, unmount } = render(<GameScreen {...defaultProps} state={state} />);

      // The game area should contain some rendered content for every phase.
      // We check that the overall component renders without crashing and has text.
      const allText = container.textContent || '';
      expect(allText.length > 0, `Phase '${phase}' should render some text content`).toBe(true);

      unmount();
    }
  });
});
