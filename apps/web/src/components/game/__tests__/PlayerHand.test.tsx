import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { Card } from '@dabb/shared-types';
import PlayerHand from '../PlayerHand';

// Create test cards with unique IDs (using correct types from shared-types)
const createTestCards = (): Card[] => [
  { id: 'card-1', suit: 'herz', rank: 'ass', copy: 0 },
  { id: 'card-2', suit: 'herz', rank: '10', copy: 0 },
  { id: 'card-3', suit: 'herz', rank: 'koenig', copy: 0 },
  { id: 'card-4', suit: 'herz', rank: 'ober', copy: 0 },
];

// Helper to get card elements from the rendered container
const getCardElements = (container: HTMLElement) => container.querySelectorAll('.playing-card');

describe('PlayerHand', () => {
  it('renders all cards', () => {
    const cards = createTestCards();
    const { container } = render(<PlayerHand cards={cards} validMoves={[]} />);

    const cardElements = getCardElements(container);
    expect(cardElements).toHaveLength(4);
  });

  it('allows multiple card selection in multiple mode', () => {
    const cards = createTestCards();
    const onSelectionChange = vi.fn();

    const { container } = render(
      <PlayerHand
        cards={cards}
        validMoves={[]}
        selectionMode="multiple"
        selectedCount={3}
        onSelectionChange={onSelectionChange}
      />
    );

    const cardElements = getCardElements(container);

    // Select first card
    fireEvent.click(cardElements[0]);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-1']);

    // Select second card
    fireEvent.click(cardElements[1]);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-1', 'card-2']);
  });

  /**
   * Regression test: Cards selected for discard were not cleared between rounds.
   *
   * Bug scenario:
   * 1. Player enters dabb phase (selectionMode='multiple'), selects cards
   * 2. Round ends, new round starts
   * 3. Player enters dabb phase again
   * 4. Previously selected cards still appeared selected
   *
   * Fix: Added useEffect that clears selection when selectionMode changes
   */
  it('clears selection when selectionMode changes (regression)', () => {
    const cards = createTestCards();
    const onSelectionChange = vi.fn();

    const { container, rerender } = render(
      <PlayerHand
        cards={cards}
        validMoves={[]}
        selectionMode="multiple"
        selectedCount={3}
        onSelectionChange={onSelectionChange}
      />
    );

    // Select some cards in multiple mode
    const cardElements = getCardElements(container);
    fireEvent.click(cardElements[0]);
    fireEvent.click(cardElements[1]);

    // Verify cards were selected
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-1', 'card-2']);

    // Clear mock to track new calls
    onSelectionChange.mockClear();

    // Simulate phase change: switch to single mode (like after dabb phase ends)
    rerender(
      <PlayerHand
        cards={cards}
        validMoves={[]}
        selectionMode="single"
        onSelectionChange={onSelectionChange}
      />
    );

    // Selection should be cleared when mode changes
    expect(onSelectionChange).toHaveBeenCalledWith([]);

    // Clear mock again
    onSelectionChange.mockClear();

    // Simulate entering dabb phase in a new round (back to multiple mode)
    rerender(
      <PlayerHand
        cards={cards}
        validMoves={[]}
        selectionMode="multiple"
        selectedCount={3}
        onSelectionChange={onSelectionChange}
      />
    );

    // Selection should be cleared again when entering multiple mode
    expect(onSelectionChange).toHaveBeenCalledWith([]);

    // Now select new cards - should work fresh without old selections
    onSelectionChange.mockClear();
    const newCardElements = getCardElements(container);
    fireEvent.click(newCardElements[2]);

    // Only the newly selected card should be in the selection
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-3']);
  });

  it('respects selectedCount limit in multiple mode', () => {
    const cards = createTestCards();
    const onSelectionChange = vi.fn();

    const { container } = render(
      <PlayerHand
        cards={cards}
        validMoves={[]}
        selectionMode="multiple"
        selectedCount={2}
        onSelectionChange={onSelectionChange}
      />
    );

    const cardElements = getCardElements(container);

    // Select first two cards
    fireEvent.click(cardElements[0]);
    fireEvent.click(cardElements[1]);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-1', 'card-2']);

    // Try to select a third card - should not add it (limit is 2)
    fireEvent.click(cardElements[2]);
    // Last call should still be the same (no change)
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-1', 'card-2']);
  });

  it('allows deselecting cards in multiple mode', () => {
    const cards = createTestCards();
    const onSelectionChange = vi.fn();

    const { container } = render(
      <PlayerHand
        cards={cards}
        validMoves={[]}
        selectionMode="multiple"
        selectedCount={3}
        onSelectionChange={onSelectionChange}
      />
    );

    const cardElements = getCardElements(container);

    // Select two cards
    fireEvent.click(cardElements[0]);
    fireEvent.click(cardElements[1]);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-1', 'card-2']);

    // Deselect first card
    fireEvent.click(cardElements[0]);
    expect(onSelectionChange).toHaveBeenLastCalledWith(['card-2']);
  });
});
