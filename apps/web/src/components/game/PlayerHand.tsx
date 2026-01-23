import { useState } from 'react';
import type { Card as CardType, CardId } from '@dabb/shared-types';
import { sortHand } from '@dabb/game-logic';

import Card from './Card';

interface PlayerHandProps {
  cards: CardType[];
  validMoves: CardId[];
  onPlayCard?: (cardId: CardId) => void;
  selectionMode?: 'single' | 'multiple';
  selectedCount?: number;
  onSelectionChange?: (cardIds: CardId[]) => void;
}

function PlayerHand({
  cards,
  validMoves,
  onPlayCard,
  selectionMode = 'single',
  selectedCount = 0,
  onSelectionChange,
}: PlayerHandProps) {
  const [selected, setSelected] = useState<Set<CardId>>(new Set());
  const sortedCards = sortHand(cards);

  const handleClick = (card: CardType) => {
    if (selectionMode === 'single' && onPlayCard) {
      onPlayCard(card.id);
      return;
    }

    if (selectionMode === 'multiple' && onSelectionChange) {
      const newSelected = new Set(selected);
      if (newSelected.has(card.id)) {
        newSelected.delete(card.id);
      } else if (selectedCount === 0 || newSelected.size < selectedCount) {
        newSelected.add(card.id);
      }
      setSelected(newSelected);
      onSelectionChange(Array.from(newSelected));
    }
  };

  return (
    <div className="player-hand">
      {sortedCards.map((card) => (
        <Card
          key={card.id}
          card={card}
          selected={selected.has(card.id)}
          valid={validMoves.length === 0 || validMoves.includes(card.id)}
          onClick={() => handleClick(card)}
        />
      ))}
    </div>
  );
}

export default PlayerHand;
