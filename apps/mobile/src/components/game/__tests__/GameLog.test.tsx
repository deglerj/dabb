import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameLog from '../GameLog';
import type { GameState, PlayerIndex, Trick, GameLogEntry } from '@dabb/shared-types';

// `useGameLog` is the only hook used — mock at module level so Vitest hoisting works
const mockUseGameLog = vi.fn();
vi.mock('@dabb/ui-shared', () => ({
  useGameLog: (...args: unknown[]) => mockUseGameLog(...args),
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
    [0 as PlayerIndex, 100],
    [1 as PlayerIndex, 50],
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

// Helper to build a minimal valid GameLogEntry
function makeEntry(id: string, round: number): GameLogEntry {
  return {
    id,
    timestamp: 0,
    type: 'round_started',
    playerIndex: null,
    data: { kind: 'round_started', round },
  };
}

// Six entries; the hook normally returns the last 5 as latestEntries
const sixEntries = [1, 2, 3, 4, 5, 6].map((n) => makeEntry(String(n), n));
const lastFive = sixEntries.slice(1);

describe('GameLog', () => {
  it('shows show-more toggle when there are more entries than latest entries', () => {
    mockUseGameLog.mockReturnValue({
      entries: sixEntries,
      latestEntries: lastFive,
      isYourTurn: false,
    });

    render(
      <GameLog
        state={baseState}
        events={[]}
        currentPlayerIndex={0 as PlayerIndex}
        nicknames={nicknames}
      />
    );

    expect(screen.getByText('gameLog.showMore')).toBeInTheDocument();
  });

  it('hides show-more toggle when disableExpand is true', () => {
    mockUseGameLog.mockReturnValue({
      entries: sixEntries,
      latestEntries: lastFive,
      isYourTurn: false,
    });

    render(
      <GameLog
        state={baseState}
        events={[]}
        currentPlayerIndex={0 as PlayerIndex}
        nicknames={nicknames}
        disableExpand
      />
    );

    expect(screen.queryByText('gameLog.showMore')).not.toBeInTheDocument();
  });
});
