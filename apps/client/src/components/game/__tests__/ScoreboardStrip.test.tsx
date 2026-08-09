import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerIndex, TeamScoreEntry } from '@dabb/shared-types';
import { ScoreboardStrip } from '../ScoreboardStrip.js';

const NICKNAMES = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Anna'],
  [1 as PlayerIndex, 'Bob'],
  [2 as PlayerIndex, 'Cleo'],
]);

function renderStrip(props: Partial<Parameters<typeof ScoreboardStrip>[0]> = {}) {
  return render(
    <ScoreboardStrip
      totalScores={[
        { playerIndex: 0 as PlayerIndex, score: 340 },
        { playerIndex: 1 as PlayerIndex, score: 290 },
        { playerIndex: 2 as PlayerIndex, score: 150 },
      ]}
      myPlayerIndex={1 as PlayerIndex}
      bidWinner={null}
      currentBid={0}
      trump={null}
      nicknames={NICKNAMES}
      firstBidder={2 as PlayerIndex}
      activePlayers={new Set<PlayerIndex>([0 as PlayerIndex])}
      {...props}
    />
  );
}

// i18n is not initialised under vitest, so t() returns the raw key.
describe('ScoreboardStrip', () => {
  it('names every score, so whose number is whose is readable without the modal', () => {
    renderStrip();

    expect(screen.getByText('Anna')).toBeDefined();
    expect(screen.getByText('Cleo')).toBeDefined();
    // The local player is labelled, not left as a bare highlighted number.
    expect(screen.getByText('common.you')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('marks the player who leads the first trick', () => {
    const { container } = renderStrip();

    // The marker is always mounted for every seat (opacity toggles it) — otherwise the
    // strip would reflow when the lead rotates. Only the lead one is visible.
    const markers = Array.from(container.querySelectorAll('*')).filter(
      (el) => el.children.length === 0 && el.textContent === '▶'
    );
    expect(markers).toHaveLength(3);

    const visible = markers.filter((el) => (el as HTMLElement).style.opacity !== '0');
    expect(visible).toHaveLength(1);
    // Cleo is firstBidder: her marker sits in the same entry as her name.
    expect(visible[0]?.parentElement?.textContent).toContain('Cleo');
  });

  it('lights the border of the seat the game is waiting on', () => {
    const { container } = renderStrip();

    const lit = Array.from(container.querySelectorAll<HTMLElement>('*')).filter((el) =>
      el.style.borderColor.includes('217, 122')
    );
    expect(lit).toHaveLength(1);
    expect(lit[0]?.textContent).toContain('Anna');
  });

  it('marks the lead player inside their team box in 4-player mode', () => {
    const teamScores: TeamScoreEntry[] = [
      {
        team: 0,
        names: 'Anna & Cleo',
        members: [0 as PlayerIndex, 2 as PlayerIndex],
        score: 400,
        isMyTeam: false,
      },
      {
        team: 1,
        names: 'Bob & Dan',
        members: [1 as PlayerIndex, 3 as PlayerIndex],
        score: 380,
        isMyTeam: true,
      },
    ];
    renderStrip({ teamScores });

    // Marker sits on Cleo alone, not on the whole team.
    expect(screen.getByText('Anna & ▶Cleo')).toBeDefined();
    expect(screen.getByText('Bob & P3')).toBeDefined();
  });
});
