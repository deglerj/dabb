import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerIndex, RoundHistoryEntry } from '@dabb/shared-types';
import { ScoreboardModal } from '../ScoreboardModal.js';

const NICKNAMES = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Anna'],
  [1 as PlayerIndex, 'Bob'],
]);

function round(overrides: Partial<RoundHistoryEntry> = {}): RoundHistoryEntry {
  return {
    round: 1,
    bidWinner: 0 as PlayerIndex,
    winningBid: 160,
    scores: {
      0: { melds: 60, tricks: 90, total: -320, bidMet: false },
      1: { melds: 20, tricks: 100, total: 120, bidMet: true },
    },
    ...overrides,
  } as RoundHistoryEntry;
}

function renderModal(entry: RoundHistoryEntry) {
  return render(
    <ScoreboardModal
      visible
      onClose={() => {}}
      rounds={[entry]}
      currentRound={null}
      nicknames={NICKNAMES}
      playerCount={2}
      // Deliberately not equal to any round total, so assertions can't match the wrong row.
      totalScores={[
        { playerIndex: 0 as PlayerIndex, score: -999 },
        { playerIndex: 1 as PlayerIndex, score: 999 },
      ]}
    />
  );
}

// i18n is not initialised under vitest, so t() returns the raw key. Asserting on the key
// keeps these about which branch renders, not about the wording of the translation.
describe('ScoreboardModal missed bid', () => {
  it('explains the total instead of printing forfeited melds and tricks (regression)', () => {
    // The bid winner's 60 melds + 90 tricks are forfeited, so showing them above a -320
    // total stated two numbers that did not produce the third and left the doubling of the
    // bid entirely unexplained.
    renderModal(round());

    expect(screen.getByText('game.bidPenalty')).toBeDefined();
    expect(screen.queryByText('🃏 60 + 🏆 90')).toBeNull();
    expect(screen.getByText('-320')).toBeDefined();
  });

  it('still shows melds and tricks for players who did not bid', () => {
    renderModal(round());
    expect(screen.getByText('🃏 20 + 🏆 100')).toBeDefined();
  });

  it('shows melds and tricks when the bid was met', () => {
    renderModal(
      round({
        scores: {
          0: { melds: 60, tricks: 110, total: 170, bidMet: true },
          1: { melds: 20, tricks: 80, total: 100, bidMet: true },
        },
      } as Partial<RoundHistoryEntry>)
    );

    expect(screen.getByText('🃏 60 + 🏆 110')).toBeDefined();
    expect(screen.queryByText('game.bidPenalty')).toBeNull();
  });

  it('does not use the doubled-bid line when the bid winner went out', () => {
    // Going out costs the bid once, not twice — a different rule and a different display.
    renderModal(
      round({
        wentOut: true,
        scores: {
          0: { melds: 0, tricks: 0, total: -160, bidMet: false },
          1: { melds: 40, tricks: 0, total: 80, bidMet: true },
        },
      } as Partial<RoundHistoryEntry>)
    );

    expect(screen.queryByText('game.bidPenalty')).toBeNull();
    expect(screen.getByText('-160')).toBeDefined();
  });
});
