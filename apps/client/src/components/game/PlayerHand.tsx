import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  CardView,
  deriveCardPositions,
  getFeltBounds,
  type LayoutDimensions,
  type SkiaEffects,
} from '@dabb/game-canvas';
import { getValidPlays, sortHand } from '@dabb/game-logic';
import type { GameState, PlayerIndex, Card } from '@dabb/shared-types';
import { playSound } from '../../utils/sounds.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { computeHighlightedDabbIds } from './dabbHighlighting.js';

export { computeHighlightedDabbIds };

export interface PlayerHandProps {
  gameState: GameState | null;
  playerIndex: PlayerIndex;
  cards: Card[];
  onPlayCard: (cardId: string, dropPos?: { x: number; y: number }) => void;
  effects?: SkiaEffects;
  discardSelectedIds?: string[];
  onToggleDiscard?: (cardId: string) => void;
}

export function PlayerHand({
  gameState,
  playerIndex: _playerIndex,
  cards,
  onPlayCard,
  effects,
  discardSelectedIds,
  onToggleDiscard,
}: PlayerHandProps) {
  const { width, height } = useWindowDimensions();
  const feltBounds = getFeltBounds(width, height);

  if (!gameState) {
    return null;
  }

  const layout: LayoutDimensions = {
    width,
    height,
    playerCount: gameState.players.length as 3 | 4,
  };

  const sortedCards = sortHand(cards);

  const positions = deriveCardPositions(
    {
      handCardIds: sortedCards.map((c) => c.id),
      // trickCardIds expects TrickCardEntry[] with { cardId, seatIndex }
      trickCardIds: [],
      // wonPilePlayerIds expects string[]
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    },
    layout
  );

  const isTricksPhase = gameState.phase === 'tricks';
  const isDiscardMode = !!onToggleDiscard;
  const validPlays =
    isTricksPhase && gameState.trump
      ? getValidPlays(cards, gameState.currentTrick, gameState.trump)
      : [];
  const validIds = new Set(validPlays.map((c) => c.id));
  const highlightedIds = computeHighlightedDabbIds(gameState.phase, gameState.dabbCardIds);

  const handleDrop = (cardId: string) => (x: number, y: number) => {
    const onFelt =
      x >= feltBounds.x &&
      x <= feltBounds.x + feltBounds.width &&
      y >= feltBounds.y &&
      y <= feltBounds.y + feltBounds.height;
    if (onFelt && validIds.has(cardId)) {
      onPlayCard(cardId, { x, y });
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sortedCards.map((card) => {
        const pos = positions.playerHand[card.id];
        if (!pos) {
          return null;
        }
        if (isDiscardMode) {
          const isSelected = discardSelectedIds?.includes(card.id) ?? false;
          return (
            <CardView
              key={card.id}
              card={card.id}
              targetX={pos.x}
              targetY={isSelected ? pos.y - 20 : pos.y}
              targetRotation={pos.rotation}
              zIndex={isSelected ? pos.zIndex + 100 : pos.zIndex}
              selected={isSelected}
              highlighted={highlightedIds.has(card.id)}
              onTap={() => {
                playSound('card-select');
                triggerHaptic('card-select');
                onToggleDiscard!(card.id);
              }}
            />
          );
        }
        const isValid = !isTricksPhase || validIds.has(card.id);
        return (
          <CardView
            key={card.id}
            card={card.id}
            targetX={pos.x}
            targetY={pos.y}
            targetRotation={pos.rotation}
            zIndex={pos.zIndex}
            draggable={isTricksPhase && isValid}
            dimmed={isTricksPhase && !isValid}
            highlighted={highlightedIds.has(card.id)}
            effects={isTricksPhase && isValid ? effects : undefined}
            onTap={
              isTricksPhase && isValid
                ? () => {
                    playSound('card-select');
                    triggerHaptic('card-select');
                    onPlayCard(card.id);
                  }
                : undefined
            }
            onDrop={isTricksPhase && isValid ? handleDrop(card.id) : undefined}
          />
        );
      })}
    </View>
  );
}
