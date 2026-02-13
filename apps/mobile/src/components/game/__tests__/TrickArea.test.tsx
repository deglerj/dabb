import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TrickArea from '../TrickArea';
import { SUIT_NAMES } from '@dabb/shared-types';
import type { Trick, PlayerIndex, Card } from '@dabb/shared-types';
import { DropZoneProvider } from '../../../contexts/DropZoneContext';

function makeCard(suit: Card['suit'], rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

function makeEmptyTrick(): Trick {
  return { cards: [], leadSuit: null, winnerIndex: null };
}

function makeTrickWithCards(): Trick {
  return {
    cards: [
      {
        cardId: 'herz-ass-0',
        card: makeCard('herz', 'ass'),
        playerIndex: 0 as PlayerIndex,
      },
      {
        cardId: 'kreuz-koenig-0',
        card: makeCard('kreuz', 'koenig'),
        playerIndex: 1 as PlayerIndex,
      },
    ],
    leadSuit: 'herz',
    winnerIndex: 0 as PlayerIndex,
  };
}

const nicknames = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
]);

function renderWithProvider(ui: React.ReactElement) {
  return render(<DropZoneProvider>{ui}</DropZoneProvider>);
}

describe('TrickArea', () => {
  it('renders played cards with player names', () => {
    const trick = makeTrickWithCards();
    renderWithProvider(<TrickArea trick={trick} nicknames={nicknames} trump={null} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty text when no cards played', () => {
    const trick = makeEmptyTrick();
    renderWithProvider(<TrickArea trick={trick} nicknames={nicknames} trump={null} />);
    expect(screen.getByText('Spielbereich')).toBeInTheDocument();
  });

  it('shows trump indicator when trump is set', () => {
    const trick = makeEmptyTrick();
    renderWithProvider(<TrickArea trick={trick} nicknames={nicknames} trump="herz" />);
    // BUG: Displays raw enum value "herz" instead of SUIT_NAMES["herz"] = "Herz"
    expect(screen.getByText('Trumpf: herz')).toBeInTheDocument();
  });

  it('highlights winner card', () => {
    const trick = makeTrickWithCards();
    renderWithProvider(
      <TrickArea
        trick={trick}
        nicknames={nicknames}
        trump={null}
        winnerPlayerIndex={0 as PlayerIndex}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('trump display shows raw enum value instead of SUIT_NAMES (bug)', () => {
    // BUG: The trump indicator displays the raw suit enum value (e.g., "herz")
    // instead of the display name from SUIT_NAMES (e.g., "Herz").
    // The component uses: `Trumpf: ${trump}` instead of `Trumpf: ${SUIT_NAMES[trump]}`
    const trick = makeEmptyTrick();
    renderWithProvider(<TrickArea trick={trick} nicknames={nicknames} trump="herz" />);

    // BUG: Shows lowercase "herz" (raw enum) instead of "Herz" (display name)
    expect(screen.getByText('Trumpf: herz')).toBeInTheDocument();
    expect(screen.queryByText(`Trumpf: ${SUIT_NAMES.herz}`)).not.toBeInTheDocument();
  });

  it('"Spielbereich" text is hardcoded German instead of using i18n (bug)', () => {
    // BUG: "Spielbereich" is hardcoded instead of using t() translation function
    const trick = makeEmptyTrick();
    renderWithProvider(<TrickArea trick={trick} nicknames={nicknames} trump={null} />);
    expect(screen.getByText('Spielbereich')).toBeInTheDocument();
  });

  it('"Trumpf:" text is hardcoded German instead of using i18n (bug)', () => {
    // BUG: "Trumpf:" prefix is hardcoded instead of using t('game.trump')
    const trick = makeEmptyTrick();
    renderWithProvider(<TrickArea trick={trick} nicknames={nicknames} trump="schippe" />);
    expect(screen.getByText('Trumpf: schippe')).toBeInTheDocument();
  });
});
