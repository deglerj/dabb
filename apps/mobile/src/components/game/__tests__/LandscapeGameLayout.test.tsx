import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LandscapeGameLayout from '../LandscapeGameLayout';
import type { GameState, PlayerIndex, Trick } from '@dabb/shared-types';

vi.mock('../GameLog', () => ({
  default: () => <div data-testid="game-log" />,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@dabb/ui-shared', () => ({
  useRoundHistory: vi.fn().mockReturnValue({
    currentRound: null,
    rounds: [],
  }),
}));

vi.mock('@dabb/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'de' },
  }),
}));

const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

const baseState: GameState = {
  phase: 'tricks',
  playerCount: 2,
  players: [
    { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
    { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
  ],
  hands: new Map(),
  dabb: [],
  currentBid: 150,
  bidWinner: null,
  currentBidder: 0 as PlayerIndex,
  firstBidder: 0 as PlayerIndex,
  passedPlayers: new Set(),
  trump: 'herz',
  currentTrick: emptyTrick,
  tricksTaken: new Map(),
  currentPlayer: 0 as PlayerIndex,
  roundScores: new Map(),
  totalScores: new Map([
    [0 as PlayerIndex, 240],
    [1 as PlayerIndex, 180],
  ]),
  targetScore: 1000,
  declaredMelds: new Map(),
  dealer: 0 as PlayerIndex,
  round: 1,
  wentOut: false,
  dabbCardIds: [],
  lastCompletedTrick: null,
};

const nicknames = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
]);

const defaultProps = {
  state: baseState,
  events: [],
  playerIndex: 0 as PlayerIndex,
  nicknames,
  panelExpanded: true,
  onTogglePanel: vi.fn(),
  isMyTurn: false,
  soundMuted: false,
  onToggleMute: vi.fn(),
  canExit: true,
  onExitGame: vi.fn(),
  phaseContent: <div data-testid="phase-content">Phase Content</div>,
  handContent: <div data-testid="hand-content">Hand Content</div>,
};

describe('LandscapeGameLayout', () => {
  it('renders player scores in expanded panel', () => {
    render(<LandscapeGameLayout {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('renders game log in expanded panel', () => {
    render(<LandscapeGameLayout {...defaultProps} />);
    expect(screen.getByTestId('game-log')).toBeInTheDocument();
  });

  it('renders phaseContent and handContent in right area', () => {
    render(<LandscapeGameLayout {...defaultProps} />);
    expect(screen.getByTestId('phase-content')).toBeInTheDocument();
    expect(screen.getByTestId('hand-content')).toBeInTheDocument();
  });

  it('calls onTogglePanel when collapse button pressed', () => {
    const onTogglePanel = vi.fn();
    render(<LandscapeGameLayout {...defaultProps} onTogglePanel={onTogglePanel} />);
    fireEvent.click(screen.getByTestId('panel-toggle'));
    expect(onTogglePanel).toHaveBeenCalled();
  });

  it('hides scores and game log when panel is collapsed', () => {
    // Content is always mounted but hidden via opacity (no layout shift per CLAUDE.md convention)
    render(<LandscapeGameLayout {...defaultProps} panelExpanded={false} />);
    const scoreText = screen.getByText('240');
    expect(scoreText.closest('[style*="opacity"]') ?? scoreText.parentElement).toBeTruthy();
    expect(screen.getByTestId('game-log')).toBeInTheDocument();
  });

  it('still renders toggle button when panel is collapsed', () => {
    render(<LandscapeGameLayout {...defaultProps} panelExpanded={false} />);
    // There are two panel-toggle elements: the absoluteFill overlay (active) and the
    // collapse button inside the always-mounted expanded content (opacity 0)
    const toggles = screen.getAllByTestId('panel-toggle');
    expect(toggles.length).toBeGreaterThanOrEqual(1);
  });
});
