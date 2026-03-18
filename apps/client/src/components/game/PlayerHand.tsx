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

export interface PlayerHandProps {
  gameState: GameState | null;
  playerIndex: PlayerIndex;
  cards: Card[];
  onPlayCard: (cardId: string) => void;
  effects?: SkiaEffects;
}

export function PlayerHand({
  gameState,
  playerIndex: _playerIndex,
  cards,
  onPlayCard,
  effects,
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
  const validPlays =
    isTricksPhase && gameState.trump
      ? getValidPlays(cards, gameState.currentTrick, gameState.trump)
      : [];
  const validIds = new Set(validPlays.map((c) => c.id));

  const handleDrop = (cardId: string) => (x: number, y: number) => {
    const onFelt =
      x >= feltBounds.x &&
      x <= feltBounds.x + feltBounds.width &&
      y >= feltBounds.y &&
      y <= feltBounds.y + feltBounds.height;
    if (onFelt && validIds.has(cardId)) {
      onPlayCard(cardId);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sortedCards.map((card) => {
        const pos = positions.playerHand[card.id];
        if (!pos) {
          return null;
        }
        const isValid = !isTricksPhase || validIds.has(card.id);
        return (
          <View key={card.id} style={isValid ? undefined : { opacity: 0.4 }}>
            <CardView
              card={card.id}
              targetX={pos.x}
              targetY={pos.y}
              targetRotation={pos.rotation}
              zIndex={pos.zIndex}
              draggable={isTricksPhase && isValid}
              effects={isTricksPhase && isValid ? effects : undefined}
              onTap={
                isTricksPhase && isValid
                  ? () => {
                      playSound('card-select');
                      onPlayCard(card.id);
                    }
                  : undefined
              }
              onDrop={isTricksPhase && isValid ? handleDrop(card.id) : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}
