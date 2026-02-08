import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GameState, PlayerIndex, GameLogEntry } from '@dabb/shared-types';
import { I18nProvider } from '@dabb/i18n';
import GameLog from '../GameLog';

// Mock useGameLog to control test data
vi.mock('@dabb/ui-shared', () => ({
  useGameLog: vi.fn(),
}));

import { useGameLog } from '@dabb/ui-shared';
const mockUseGameLog = vi.mocked(useGameLog);

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider initialLanguage="de">{ui}</I18nProvider>);
};

const baseState: GameState = {
  phase: 'bidding',
  playerCount: 3,
  players: [
    { id: 'p1', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
    { id: 'p2', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
    { id: 'p3', nickname: 'Charlie', playerIndex: 2 as PlayerIndex, connected: true },
  ],
  hands: new Map(),
  dabb: [],
  currentBid: 0,
  bidWinner: null,
  currentBidder: null,
  firstBidder: null,
  passedPlayers: new Set(),
  trump: null,
  currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
  tricksTaken: new Map(),
  currentPlayer: null,
  roundScores: new Map(),
  totalScores: new Map(),
  targetScore: 1000,
  declaredMelds: new Map(),
  dealer: 0 as PlayerIndex,
  round: 1,
  wentOut: false,
  lastCompletedTrick: null,
};

const bidEntry: GameLogEntry = {
  id: 'entry-1',
  timestamp: 1000,
  type: 'bid_placed',
  playerIndex: 0 as PlayerIndex,
  data: { kind: 'bid_placed', amount: 150 },
};

const passEntry: GameLogEntry = {
  id: 'entry-2',
  timestamp: 2000,
  type: 'player_passed',
  playerIndex: 1 as PlayerIndex,
  data: { kind: 'player_passed' },
};

const gameStartEntry: GameLogEntry = {
  id: 'entry-0',
  timestamp: 0,
  type: 'game_started',
  playerIndex: null,
  data: { kind: 'game_started', playerCount: 3, targetScore: 1000 },
};

describe('GameLog', () => {
  it('returns null when no entries and not your turn', () => {
    mockUseGameLog.mockReturnValue({
      entries: [],
      latestEntries: [],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log')).not.toBeInTheDocument();
  });

  it('renders the game log container when entries exist', () => {
    mockUseGameLog.mockReturnValue({
      entries: [bidEntry],
      latestEntries: [bidEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log')).toBeInTheDocument();
  });

  it('renders bid placed entries with player name and amount', () => {
    mockUseGameLog.mockReturnValue({
      entries: [bidEntry],
      latestEntries: [bidEntry],
      isYourTurn: false,
    });

    renderWithI18n(<GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('renders player passed entries', () => {
    mockUseGameLog.mockReturnValue({
      entries: [passEntry],
      latestEntries: [passEntry],
      isYourTurn: false,
    });

    renderWithI18n(<GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />);

    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('shows your-turn banner when isYourTurn is true', () => {
    mockUseGameLog.mockReturnValue({
      entries: [bidEntry],
      latestEntries: [bidEntry],
      isYourTurn: true,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log-turn-banner')).toBeInTheDocument();
  });

  it('does not show your-turn banner when isYourTurn is false', () => {
    mockUseGameLog.mockReturnValue({
      entries: [bidEntry],
      latestEntries: [bidEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log-turn-banner')).not.toBeInTheDocument();
  });

  it('shows expand button when there are more entries than shown', () => {
    const manyEntries = [bidEntry, passEntry, gameStartEntry];
    mockUseGameLog.mockReturnValue({
      entries: manyEntries,
      latestEntries: [bidEntry], // only showing 1 of 3
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log-toggle')).toBeInTheDocument();
  });

  it('does not show expand button when all entries are visible', () => {
    mockUseGameLog.mockReturnValue({
      entries: [bidEntry],
      latestEntries: [bidEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log-toggle')).not.toBeInTheDocument();
  });

  it('toggles between expanded and collapsed views', () => {
    const allEntries = [bidEntry, passEntry, gameStartEntry];
    mockUseGameLog.mockReturnValue({
      entries: allEntries,
      latestEntries: [bidEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    // Initially collapsed - should show 1 entry
    const entriesContainer = container.querySelector('.game-log-entries');
    expect(entriesContainer?.classList.contains('expanded')).toBe(false);

    // Click toggle
    fireEvent.click(container.querySelector('.game-log-toggle')!);

    // Should now be expanded
    expect(container.querySelector('.game-log-entries.expanded')).toBeInTheDocument();
  });

  it('applies highlight class to bidding_won entries', () => {
    const biddingWonEntry: GameLogEntry = {
      id: 'entry-bw',
      timestamp: 3000,
      type: 'bidding_won',
      playerIndex: 0 as PlayerIndex,
      data: { kind: 'bidding_won', winningBid: 200 },
    };

    mockUseGameLog.mockReturnValue({
      entries: [biddingWonEntry],
      latestEntries: [biddingWonEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    const entry = container.querySelector('.game-log-entry.highlight');
    expect(entry).toBeInTheDocument();
  });

  it('applies error class to game_terminated entries', () => {
    const terminatedEntry: GameLogEntry = {
      id: 'entry-gt',
      timestamp: 4000,
      type: 'game_terminated',
      playerIndex: 1 as PlayerIndex,
      data: { kind: 'game_terminated', reason: 'player_exit' },
    };

    mockUseGameLog.mockReturnValue({
      entries: [terminatedEntry],
      latestEntries: [terminatedEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    const entry = container.querySelector('.game-log-entry.error');
    expect(entry).toBeInTheDocument();
  });

  it('renders melds_declared with expand toggle for non-zero melds', () => {
    const meldEntry: GameLogEntry = {
      id: 'entry-m',
      timestamp: 5000,
      type: 'melds_declared',
      playerIndex: 0 as PlayerIndex,
      data: {
        kind: 'melds_declared',
        melds: [{ type: 'paar', cards: ['c1', 'c2'], points: 20, suit: 'herz' }],
        totalPoints: 20,
      },
    };

    mockUseGameLog.mockReturnValue({
      entries: [meldEntry],
      latestEntries: [meldEntry],
      isYourTurn: false,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    // Should have a toggle button for melds
    const toggleBtn = container.querySelector('.game-log-meld-toggle');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn?.textContent).toBe('+');

    // Click to expand
    fireEvent.click(toggleBtn!);

    // Should show meld details
    const details = container.querySelector('.game-log-meld-details');
    expect(details).toBeInTheDocument();

    // Toggle button should now show '-'
    expect(container.querySelector('.game-log-meld-toggle')?.textContent).toBe('-');
  });

  it('renders game log when isYourTurn is true even with no entries', () => {
    mockUseGameLog.mockReturnValue({
      entries: [],
      latestEntries: [],
      isYourTurn: true,
    });

    const { container } = renderWithI18n(
      <GameLog state={baseState} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-log')).toBeInTheDocument();
    expect(container.querySelector('.game-log-turn-banner')).toBeInTheDocument();
  });
});
