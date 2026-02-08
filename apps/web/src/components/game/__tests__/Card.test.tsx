import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { Card as CardType } from '@dabb/shared-types';
import Card from '../Card';

// Mock SuitIcon to avoid SVG import issues in tests
vi.mock('../../SuitIcon', () => ({
  default: ({ suit, size }: { suit: string; size: number }) => (
    <span data-testid={`suit-icon-${suit}`} data-size={size}>
      {suit}
    </span>
  ),
}));

const visibleCard: CardType = { id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 };
const hiddenCard: CardType = { id: 'hidden-0', suit: 'herz', rank: 'ass', copy: 0 };

describe('Card', () => {
  it('renders a visible card with rank and suit', () => {
    const { container, getByTestId } = render(<Card card={visibleCard} />);

    expect(getByTestId('suit-icon-herz')).toBeInTheDocument();
    expect(container.querySelector('.playing-card')).toBeInTheDocument();
    expect(container.textContent).toContain('A'); // Ass -> 'A'
  });

  it('renders a hidden card with card-back style', () => {
    const { container } = render(<Card card={hiddenCard} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl).toBeInTheDocument();
    expect(cardEl?.textContent).toContain('🃏');
  });

  it('applies selected class when selected', () => {
    const { container } = render(<Card card={visibleCard} selected={true} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl?.classList.contains('selected')).toBe(true);
  });

  it('does not apply selected class by default', () => {
    const { container } = render(<Card card={visibleCard} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl?.classList.contains('selected')).toBe(false);
  });

  it('applies winner class when winner', () => {
    const { container } = render(<Card card={visibleCard} winner={true} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl?.classList.contains('winner')).toBe(true);
  });

  it('applies suit class to the card', () => {
    const { container } = render(<Card card={visibleCard} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl?.classList.contains('herz')).toBe(true);
  });

  it('calls onClick when valid and clicked', () => {
    const onClick = vi.fn();
    const { container } = render(<Card card={visibleCard} valid={true} onClick={onClick} />);

    fireEvent.click(container.querySelector('.playing-card')!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when invalid', () => {
    const onClick = vi.fn();
    const { container } = render(<Card card={visibleCard} valid={false} onClick={onClick} />);

    fireEvent.click(container.querySelector('.playing-card')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies grayscale filter when invalid', () => {
    const { container } = render(<Card card={visibleCard} valid={false} />);

    const cardEl = container.querySelector('.playing-card') as HTMLElement;
    expect(cardEl.style.filter).toContain('grayscale');
  });

  it('uses red color for herz and bollen suits', () => {
    const { container: herzContainer } = render(
      <Card card={{ id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 }} />
    );
    const herzCard = herzContainer.querySelector('.playing-card') as HTMLElement;
    expect(herzCard.style.color).toBe('rgb(220, 38, 38)');

    const { container: bollenContainer } = render(
      <Card card={{ id: 'bollen-ass-0', suit: 'bollen', rank: 'ass', copy: 0 }} />
    );
    const bollenCard = bollenContainer.querySelector('.playing-card') as HTMLElement;
    expect(bollenCard.style.color).toBe('rgb(220, 38, 38)');
  });

  it('uses blue color for kreuz and schippe suits', () => {
    const { container: kreuzContainer } = render(
      <Card card={{ id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 }} />
    );
    const kreuzCard = kreuzContainer.querySelector('.playing-card') as HTMLElement;
    expect(kreuzCard.style.color).toBe('rgb(30, 58, 95)');

    const { container: schippeContainer } = render(
      <Card card={{ id: 'schippe-ass-0', suit: 'schippe', rank: 'ass', copy: 0 }} />
    );
    const schippeCard = schippeContainer.querySelector('.playing-card') as HTMLElement;
    expect(schippeCard.style.color).toBe('rgb(30, 58, 95)');
  });

  it('displays correct rank abbreviations', () => {
    const ranks: Array<{ rank: CardType['rank']; display: string }> = [
      { rank: 'buabe', display: 'U' },
      { rank: 'ober', display: 'O' },
      { rank: 'koenig', display: 'K' },
      { rank: '10', display: '10' },
      { rank: 'ass', display: 'A' },
    ];

    for (const { rank, display } of ranks) {
      const { container } = render(
        <Card card={{ id: `herz-${rank}-0`, suit: 'herz', rank, copy: 0 }} />
      );
      expect(container.textContent).toContain(display);
    }
  });

  it('does not render suit icon for hidden cards', () => {
    const { queryByTestId } = render(<Card card={hiddenCard} />);

    expect(queryByTestId('suit-icon-herz')).not.toBeInTheDocument();
  });

  it('does not call onClick for hidden cards', () => {
    const onClick = vi.fn();
    const { container } = render(<Card card={hiddenCard} onClick={onClick} />);

    fireEvent.click(container.querySelector('.playing-card')!);
    expect(onClick).not.toHaveBeenCalled();
  });
});
