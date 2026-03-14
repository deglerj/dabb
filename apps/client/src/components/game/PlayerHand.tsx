import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { CardView, deriveCardPositions, type LayoutDimensions } from '@dabb/game-canvas';
import { getValidPlays } from '@dabb/game-logic';
import type { GameState, PlayerIndex, Card } from '@dabb/shared-types';

export interface PlayerHandProps {
  state: GameState;
  playerIndex: PlayerIndex;
  playerCards: Card[];
  onPlayCard: (cardId: string) => void;
}

export function PlayerHand({
  state,
  playerIndex: _playerIndex,
  playerCards,
  onPlayCard,
}: PlayerHandProps) {
  const { width, height } = useWindowDimensions();
  const layout: LayoutDimensions = { width, height, playerCount: state.players.length as 3 | 4 };

  const positions = deriveCardPositions(
    {
      handCardIds: playerCards.map((c) => c.id),
      // trickCardIds expects TrickCardEntry[] with { cardId, seatIndex }
      trickCardIds: [],
      // wonPilePlayerIds expects string[]
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    },
    layout
  );

  const isTricksPhase = state.phase === 'tricks';
  const validPlays =
    isTricksPhase && state.trump ? getValidPlays(playerCards, state.currentTrick, state.trump) : [];
  const validIds = new Set(validPlays.map((c) => c.id));

  const handleDrop = (cardId: string) => (_x: number, _y: number) => {
    if (validIds.has(cardId)) {
      onPlayCard(cardId);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {playerCards.map((card) => {
        const pos = positions.playerHand[card.id];
        if (!pos) {
          return null;
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
            onTap={isTricksPhase && isValid ? () => onPlayCard(card.id) : undefined}
            onDrop={isTricksPhase && isValid ? handleDrop(card.id) : undefined}
          />
        );
      })}
    </View>
  );
}
