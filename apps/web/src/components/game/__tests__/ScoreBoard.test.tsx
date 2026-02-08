import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { I18nProvider } from '@dabb/i18n';
import ScoreBoard from '../ScoreBoard';

// Mock useRoundHistory
vi.mock('@dabb/ui-shared', () => ({
  useRoundHistory: vi.fn(),
}));

// Mock LanguageSwitcher
vi.mock('../../LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher">Lang</div>,
}));

import { useRoundHistory } from '@dabb/ui-shared';
const mockUseRoundHistory = vi.mocked(useRoundHistory);

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider initialLanguage="de">{ui}</I18nProvider>);
};

const createState = (overrides?: Partial<GameState>): GameState => ({
  phase: 'bidding',
  playerCount: 3,
  players: [
    { id: 'p1', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
    { id: 'p2', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
    { id: 'p3', nickname: 'Charlie', playerIndex: 2 as PlayerIndex, connected: true },
  ],
  hands: new Map(),
  dabb: [],
  currentBid: 200,
  bidWinner: 0 as PlayerIndex,
  currentBidder: null,
  firstBidder: null,
  passedPlayers: new Set(),
  trump: null,
  currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
  tricksTaken: new Map(),
  currentPlayer: 0 as PlayerIndex,
  roundScores: new Map(),
  totalScores: new Map([
    [0 as PlayerIndex, 350],
    [1 as PlayerIndex, 200],
    [2 as PlayerIndex, 100],
  ]),
  targetScore: 1000,
  declaredMelds: new Map(),
  dealer: 0 as PlayerIndex,
  round: 1,
  wentOut: false,
  lastCompletedTrick: null,
  ...overrides,
});

beforeEach(() => {
  // Default: desktop width for expanded state
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
});

describe('ScoreBoard', () => {
  it('renders player names', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('displays player scores', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows bid info for the bid winner', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    // Should show bid info element for Alice (bid winner)
    const bidInfo = container.querySelector('.bid-info');
    expect(bidInfo).toBeInTheDocument();
    expect(bidInfo?.textContent).toContain('200');
  });

  it('highlights current player', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    const currentPlayerInfo = container.querySelector('.player-info.current');
    expect(currentPlayerInfo).toBeInTheDocument();
  });

  it('shows disconnected indicator for disconnected players', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    const state = createState({
      players: [
        { id: 'p1', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
        { id: 'p2', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: false },
        { id: 'p3', nickname: 'Charlie', playerIndex: 2 as PlayerIndex, connected: true },
      ],
    });

    renderWithI18n(<ScoreBoard state={state} events={[]} currentPlayerIndex={0 as PlayerIndex} />);

    // German: "(Getrennt)"
    expect(screen.getByText(/Getrennt/)).toBeInTheDocument();
  });

  it('renders exit button when onExitClick is provided', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    renderWithI18n(
      <ScoreBoard
        state={createState()}
        events={[]}
        currentPlayerIndex={0 as PlayerIndex}
        onExitClick={vi.fn()}
      />
    );

    const exitButton = screen.getByText(/Spiel verlassen/);
    expect(exitButton).toBeInTheDocument();
  });

  it('does not render exit button when onExitClick is not provided', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(screen.queryByText(/Spiel verlassen/)).not.toBeInTheDocument();
  });

  it('calls onExitClick when exit button is clicked', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    const onExitClick = vi.fn();
    renderWithI18n(
      <ScoreBoard
        state={createState()}
        events={[]}
        currentPlayerIndex={0 as PlayerIndex}
        onExitClick={onExitClick}
      />
    );

    fireEvent.click(screen.getByText(/Spiel verlassen/));
    expect(onExitClick).toHaveBeenCalledOnce();
  });

  it('shows game winner banner when there is a winner', () => {
    mockUseRoundHistory.mockReturnValue({
      rounds: [],
      currentRound: null,
      gameWinner: 0 as PlayerIndex,
    });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    const winnerBanner = container.querySelector('.game-winner-banner');
    expect(winnerBanner).toBeInTheDocument();
    expect(winnerBanner?.textContent).toContain('Alice');
  });

  it('does not show game winner banner when there is no winner', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.game-winner-banner')).not.toBeInTheDocument();
  });

  it('toggles history when header is clicked', () => {
    mockUseRoundHistory.mockReturnValue({
      rounds: [
        {
          round: 1,
          bidWinner: 0 as PlayerIndex,
          winningBid: 200,
          scores: {
            [0 as PlayerIndex]: { melds: 40, tricks: 180, total: 220, bidMet: true },
            [1 as PlayerIndex]: { melds: 20, tricks: 80, total: 100, bidMet: true },
            [2 as PlayerIndex]: { melds: 0, tricks: 30, total: 30, bidMet: true },
          },
        },
      ],
      currentRound: null,
      gameWinner: null,
    });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    // On desktop, starts expanded
    expect(container.querySelector('.scoreboard.expanded')).toBeInTheDocument();
    expect(container.querySelector('.scoreboard-history')).toBeInTheDocument();

    // Click header to collapse
    fireEvent.click(container.querySelector('.scoreboard-header')!);

    expect(container.querySelector('.scoreboard.expanded')).not.toBeInTheDocument();
    expect(container.querySelector('.scoreboard-history')).not.toBeInTheDocument();
  });

  it('renders round history table with scores', () => {
    mockUseRoundHistory.mockReturnValue({
      rounds: [
        {
          round: 1,
          bidWinner: 0 as PlayerIndex,
          winningBid: 200,
          scores: {
            [0 as PlayerIndex]: { melds: 40, tricks: 180, total: 220, bidMet: true },
            [1 as PlayerIndex]: { melds: 20, tricks: 80, total: 100, bidMet: true },
            [2 as PlayerIndex]: { melds: 0, tricks: 30, total: 30, bidMet: true },
          },
        },
      ],
      currentRound: null,
      gameWinner: null,
    });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    // Should show the round score totals in .score-total elements
    const scoreTotals = container.querySelectorAll('.score-total');
    const scores = Array.from(scoreTotals).map((el) => el.textContent);
    expect(scores).toContain('220');
    expect(scores).toContain('100');
    expect(scores).toContain('30');
  });

  it('shows bid-not-met indicator when bid was not met', () => {
    mockUseRoundHistory.mockReturnValue({
      rounds: [
        {
          round: 1,
          bidWinner: 0 as PlayerIndex,
          winningBid: 300,
          scores: {
            [0 as PlayerIndex]: { melds: 40, tricks: 100, total: -300, bidMet: false },
            [1 as PlayerIndex]: { melds: 20, tricks: 80, total: 100, bidMet: true },
            [2 as PlayerIndex]: { melds: 0, tricks: 30, total: 30, bidMet: true },
          },
        },
      ],
      currentRound: null,
      gameWinner: null,
    });

    const { container } = renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(container.querySelector('.bid-not-met')).toBeInTheDocument();
    expect(container.querySelector('.bid-failed')).toBeInTheDocument();
  });

  it('renders language switcher', () => {
    mockUseRoundHistory.mockReturnValue({ rounds: [], currentRound: null, gameWinner: null });

    renderWithI18n(
      <ScoreBoard state={createState()} events={[]} currentPlayerIndex={0 as PlayerIndex} />
    );

    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });
});
