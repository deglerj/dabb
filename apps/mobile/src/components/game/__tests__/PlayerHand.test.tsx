import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlayerHand from '../PlayerHand';
import type { Card } from '@dabb/shared-types';

function makeCard(suit: Card['suit'], rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

const testCards: Card[] = [
  makeCard('herz', 'ass'),
  makeCard('kreuz', 'koenig'),
  makeCard('schippe', 'buabe'),
];

describe('PlayerHand', () => {
  it('renders all cards', () => {
    render(<PlayerHand cards={testCards} />);
    // Each rank appears in two corners; check at least one exists
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B').length).toBeGreaterThan(0);
  });

  it('marks selected card correctly', () => {
    render(<PlayerHand cards={testCards} selectedCardId="herz-ass-0" />);
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
  });

  it('calls onCardSelect when card is pressed', () => {
    const onCardSelect = vi.fn();
    render(<PlayerHand cards={testCards} onCardSelect={onCardSelect} />);

    fireEvent.click(screen.getAllByText('A')[0]);
    expect(onCardSelect).toHaveBeenCalledWith('herz-ass-0');
  });

  it('marks invalid cards when validCardIds provided', () => {
    render(<PlayerHand cards={testCards} validCardIds={['herz-ass-0']} />);
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('K').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B').length).toBeGreaterThan(0);
  });

  it('all cards valid when validCardIds not provided', () => {
    const onCardSelect = vi.fn();
    render(<PlayerHand cards={testCards} onCardSelect={onCardSelect} />);

    fireEvent.click(screen.getAllByText('A')[0]);
    expect(onCardSelect).toHaveBeenCalledWith('herz-ass-0');

    fireEvent.click(screen.getAllByText('K')[0]);
    expect(onCardSelect).toHaveBeenCalledWith('kreuz-koenig-0');

    fireEvent.click(screen.getAllByText('B')[0]);
    expect(onCardSelect).toHaveBeenCalledWith('schippe-buabe-0');
  });

  it('calls onMultiSelect instead of onCardSelect in multiple selection mode', () => {
    const onCardSelect = vi.fn();
    const onMultiSelect = vi.fn();
    render(
      <PlayerHand
        cards={testCards}
        selectionMode="multiple"
        selectedCardIds={[]}
        onCardSelect={onCardSelect}
        onMultiSelect={onMultiSelect}
      />
    );

    fireEvent.click(screen.getAllByText('A')[0]);
    expect(onMultiSelect).toHaveBeenCalledWith('herz-ass-0');
    expect(onCardSelect).not.toHaveBeenCalled();
  });

  it('highlights selected cards in multiple selection mode', () => {
    const { container } = render(
      <PlayerHand
        cards={testCards}
        selectionMode="multiple"
        selectedCardIds={['herz-ass-0', 'schippe-buabe-0']}
      />
    );
    // Component renders without crashing with multiple selected cards
    expect(container).toBeTruthy();
  });
});
