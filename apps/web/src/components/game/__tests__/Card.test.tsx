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

// Mock CardFaces to avoid SVG complexity in tests
vi.mock('../CardFaces/KoenigFace', () => ({
  default: ({ color }: { color: string }) => <div data-testid="koenig-face" data-color={color} />,
}));
vi.mock('../CardFaces/OberFace', () => ({
  default: ({ color }: { color: string }) => <div data-testid="ober-face" data-color={color} />,
}));
vi.mock('../CardFaces/BuabeFace', () => ({
  default: ({ color }: { color: string }) => <div data-testid="buabe-face" data-color={color} />,
}));

const visibleCard: CardType = { id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 };
const hiddenCard: CardType = { id: 'hidden-0', suit: 'herz', rank: 'ass', copy: 0 };

describe('Card', () => {
  it('renders a visible card with rank and suit', () => {
    const { container, getAllByTestId } = render(<Card card={visibleCard} />);

    // Ass card renders suit icon in top-left corner, center, and bottom-right corner
    expect(getAllByTestId('suit-icon-herz').length).toBeGreaterThan(0);
    expect(container.querySelector('.playing-card')).toBeInTheDocument();
    expect(container.textContent).toContain('A'); // Ass -> 'A'
  });

  it('renders a hidden card without suit icons', () => {
    const { container, queryByTestId } = render(<Card card={hiddenCard} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl).toBeInTheDocument();
    // Hidden card has no text content — just a background pattern
    expect(queryByTestId('suit-icon-herz')).not.toBeInTheDocument();
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

  it('applies trump class when trump', () => {
    const { container } = render(<Card card={visibleCard} trump={true} />);

    const cardEl = container.querySelector('.playing-card');
    expect(cardEl?.classList.contains('trump')).toBe(true);
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

  it('uses card-red CSS variable for herz and bollen suits', () => {
    const { container: herzContainer } = render(
      <Card card={{ id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 }} />
    );
    const herzCard = herzContainer.querySelector('.playing-card') as HTMLElement;
    expect(herzCard.style.color).toBe('var(--card-red)');

    const { container: bollenContainer } = render(
      <Card card={{ id: 'bollen-ass-0', suit: 'bollen', rank: 'ass', copy: 0 }} />
    );
    const bollenCard = bollenContainer.querySelector('.playing-card') as HTMLElement;
    expect(bollenCard.style.color).toBe('var(--card-red)');
  });

  it('uses card-black CSS variable for kreuz and schippe suits', () => {
    const { container: kreuzContainer } = render(
      <Card card={{ id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 }} />
    );
    const kreuzCard = kreuzContainer.querySelector('.playing-card') as HTMLElement;
    expect(kreuzCard.style.color).toBe('var(--card-black)');

    const { container: schippeContainer } = render(
      <Card card={{ id: 'schippe-ass-0', suit: 'schippe', rank: 'ass', copy: 0 }} />
    );
    const schippeCard = schippeContainer.querySelector('.playing-card') as HTMLElement;
    expect(schippeCard.style.color).toBe('var(--card-black)');
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

  it('renders König face for koenig rank', () => {
    const { getByTestId } = render(
      <Card card={{ id: 'herz-koenig-0', suit: 'herz', rank: 'koenig', copy: 0 }} />
    );
    expect(getByTestId('koenig-face')).toBeInTheDocument();
  });

  it('renders Ober face for ober rank', () => {
    const { getByTestId } = render(
      <Card card={{ id: 'herz-ober-0', suit: 'herz', rank: 'ober', copy: 0 }} />
    );
    expect(getByTestId('ober-face')).toBeInTheDocument();
  });

  it('renders Buabe face for buabe rank', () => {
    const { getByTestId } = render(
      <Card card={{ id: 'herz-buabe-0', suit: 'herz', rank: 'buabe', copy: 0 }} />
    );
    expect(getByTestId('buabe-face')).toBeInTheDocument();
  });
});
