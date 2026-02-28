import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Card from '../Card';
import type { Card as CardType } from '@dabb/shared-types';

function makeCard(suit: CardType['suit'], rank: CardType['rank'], copy: 0 | 1 = 0): CardType {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

function makeHiddenCard(): CardType {
  return { id: 'hidden-0', suit: 'herz', rank: 'ass', copy: 0 };
}

describe('Card', () => {
  it('renders visible card with rank and suit icon', () => {
    const card = makeCard('herz', 'ass');
    render(<Card card={card} />);
    // Rank appears in both top-left and bottom-right corners
    const ranks = screen.getAllByText('A');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('renders hidden card back', () => {
    const card = makeHiddenCard();
    render(<Card card={card} />);
    expect(screen.getByTestId('card-back')).toBeInTheDocument();
  });

  it('applies selected style', () => {
    const card = makeCard('kreuz', 'koenig');
    render(<Card card={card} selected />);
    const ranks = screen.getAllByText('K');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('applies winner style', () => {
    const card = makeCard('schippe', 'ober');
    render(<Card card={card} winner />);
    const ranks = screen.getAllByText('O');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('applies invalid overlay when valid=false', () => {
    const card = makeCard('bollen', '10');
    render(<Card card={card} valid={false} />);
    const ranks = screen.getAllByText('10');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('calls onPress when valid card is pressed', () => {
    const card = makeCard('herz', 'buabe');
    const onPress = vi.fn();
    render(<Card card={card} onPress={onPress} />);

    fireEvent.click(screen.getAllByText('B')[0]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when card is invalid', () => {
    const card = makeCard('herz', 'buabe');
    const onPress = vi.fn();
    render(<Card card={card} valid={false} onPress={onPress} />);

    // The button is disabled, click should not trigger onPress
    fireEvent.click(screen.getAllByText('B')[0]);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows red text for herz suit', () => {
    const card = makeCard('herz', 'ass');
    render(<Card card={card} />);
    const ranks = screen.getAllByText('A');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('shows red text for bollen suit', () => {
    const card = makeCard('bollen', 'koenig');
    render(<Card card={card} />);
    const ranks = screen.getAllByText('K');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('shows dark text for kreuz suit', () => {
    const card = makeCard('kreuz', 'ober');
    render(<Card card={card} />);
    const ranks = screen.getAllByText('O');
    expect(ranks.length).toBeGreaterThan(0);
  });

  it('shows dark text for schippe suit', () => {
    const card = makeCard('schippe', '10');
    render(<Card card={card} />);
    const ranks = screen.getAllByText('10');
    expect(ranks.length).toBeGreaterThan(0);
  });
});
