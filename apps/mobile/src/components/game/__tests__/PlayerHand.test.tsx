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
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('marks selected card correctly', () => {
    render(<PlayerHand cards={testCards} selectedCardId="herz-ass-0" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('calls onCardSelect when card is pressed', () => {
    const onCardSelect = vi.fn();
    render(<PlayerHand cards={testCards} onCardSelect={onCardSelect} />);

    fireEvent.click(screen.getByText('A'));
    expect(onCardSelect).toHaveBeenCalledWith('herz-ass-0');
  });

  it('marks invalid cards when validCardIds provided', () => {
    render(<PlayerHand cards={testCards} validCardIds={['herz-ass-0']} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('all cards valid when validCardIds not provided', () => {
    const onCardSelect = vi.fn();
    render(<PlayerHand cards={testCards} onCardSelect={onCardSelect} />);

    fireEvent.click(screen.getByText('A'));
    expect(onCardSelect).toHaveBeenCalledWith('herz-ass-0');

    fireEvent.click(screen.getByText('K'));
    expect(onCardSelect).toHaveBeenCalledWith('kreuz-koenig-0');

    fireEvent.click(screen.getByText('U'));
    expect(onCardSelect).toHaveBeenCalledWith('schippe-buabe-0');
  });
});
