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

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

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
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    },
    layout
  );

  const { cardScale } = positions;
  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;
  const liftOffset = 20 * cardScale;

  const isTricksPhase = gameState.phase === 'tricks';
  const isTrumpHighlightPhase =
    (gameState.phase === 'tricks' || gameState.phase === 'melding') && gameState.trump !== null;
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
              targetY={isSelected ? pos.y - liftOffset : pos.y}
              targetRotation={pos.rotation}
              zIndex={isSelected ? pos.zIndex + 100 : pos.zIndex}
              width={scaledW}
              height={scaledH}
              selected={isSelected}
              highlighted={highlightedIds.has(card.id)}
              isTrump={isTrumpHighlightPhase && card.suit === gameState.trump}
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
            width={scaledW}
            height={scaledH}
            draggable={isTricksPhase && isValid}
            dimmed={isTricksPhase && !isValid}
            highlighted={highlightedIds.has(card.id)}
            isTrump={isTrumpHighlightPhase && card.suit === gameState.trump}
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
