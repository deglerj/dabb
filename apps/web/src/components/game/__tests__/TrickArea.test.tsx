import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { Player, PlayerIndex, Trick } from '@dabb/shared-types';
import TrickArea from '../TrickArea';
import { vi } from 'vitest';

// Mock Card component to simplify testing
vi.mock('../Card', () => ({
  default: ({ card, winner }: { card: { suit: string; rank: string }; winner: boolean }) => (
    <div
      data-testid={`card-${card.suit}-${card.rank}`}
      className={`playing-card ${winner ? 'winner' : ''}`}
    >
      {card.suit}-{card.rank}
    </div>
  ),
}));

const players: Player[] = [
  { id: 'p1', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
  { id: 'p2', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
  { id: 'p3', nickname: 'Charlie', playerIndex: 2 as PlayerIndex, connected: true },
];

describe('TrickArea', () => {
  it('renders played cards with player names', () => {
    const trick: Trick = {
      cards: [
        {
          cardId: 'herz-ass-0',
          card: { id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 },
          playerIndex: 0 as PlayerIndex,
        },
        {
          cardId: 'herz-10-0',
          card: { id: 'herz-10-0', suit: 'herz', rank: '10', copy: 0 },
          playerIndex: 1 as PlayerIndex,
        },
      ],
      leadSuit: 'herz',
      winnerIndex: null,
    };

    const { getByText, getByTestId } = render(<TrickArea trick={trick} players={players} />);

    expect(getByTestId('card-herz-ass')).toBeInTheDocument();
    expect(getByTestId('card-herz-10')).toBeInTheDocument();
    expect(getByText('Alice')).toBeInTheDocument();
    expect(getByText('Bob')).toBeInTheDocument();
  });

  it('renders empty trick area when no cards played', () => {
    const trick: Trick = {
      cards: [],
      leadSuit: null,
      winnerIndex: null,
    };

    const { container } = render(<TrickArea trick={trick} players={players} />);

    expect(container.querySelector('.trick-area')).toBeInTheDocument();
    expect(container.querySelectorAll('.playing-card')).toHaveLength(0);
  });

  it('marks the winning card when winnerPlayerIndex is provided', () => {
    const trick: Trick = {
      cards: [
        {
          cardId: 'herz-ass-0',
          card: { id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 },
          playerIndex: 0 as PlayerIndex,
        },
        {
          cardId: 'herz-10-0',
          card: { id: 'herz-10-0', suit: 'herz', rank: '10', copy: 0 },
          playerIndex: 1 as PlayerIndex,
        },
      ],
      leadSuit: 'herz',
      winnerIndex: 0 as PlayerIndex,
    };

    const { getByTestId } = render(
      <TrickArea trick={trick} players={players} winnerPlayerIndex={0 as PlayerIndex} />
    );

    // Alice's card (playerIndex 0) should be the winner
    const aliceCard = getByTestId('card-herz-ass');
    expect(aliceCard.classList.contains('winner')).toBe(true);

    // Bob's card should not be the winner
    const bobCard = getByTestId('card-herz-10');
    expect(bobCard.classList.contains('winner')).toBe(false);
  });

  it('does not mark any card as winner when winnerPlayerIndex is null', () => {
    const trick: Trick = {
      cards: [
        {
          cardId: 'herz-ass-0',
          card: { id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 },
          playerIndex: 0 as PlayerIndex,
        },
      ],
      leadSuit: 'herz',
      winnerIndex: null,
    };

    const { getByTestId } = render(
      <TrickArea trick={trick} players={players} winnerPlayerIndex={null} />
    );

    const card = getByTestId('card-herz-ass');
    expect(card.classList.contains('winner')).toBe(false);
  });
});
