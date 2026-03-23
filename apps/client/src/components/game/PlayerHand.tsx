import React from 'react';
import { View, StyleSheet } from 'react-native';
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
import { useGameDimensions } from '../../hooks/useGameDimensions.js';
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
  slottedCardIds?: string[];
  onSlotCard?: (cardId: string) => void;
}

export function PlayerHand({
  gameState,
  playerIndex: _playerIndex,
  cards,
  onPlayCard,
  effects,
  slottedCardIds,
  onSlotCard,
}: PlayerHandProps) {
  const { width, height } = useGameDimensions();
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

  const isSlotMode = !!onSlotCard;

  // In slot mode, slotted cards are rendered as a separate layer by GameScreen;
  // exclude them here so the remaining hand cards spread to fill the arc without gaps.
  const displayedCards =
    isSlotMode && slottedCardIds
      ? sortedCards.filter((c) => !slottedCardIds.includes(c.id))
      : sortedCards;

  const positions = deriveCardPositions(
    {
      handCardIds: displayedCards.map((c) => c.id),
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    },
    layout
  );

  const { cardScale } = positions;
  const scaledW = CARD_WIDTH * cardScale;
  const scaledH = CARD_HEIGHT * cardScale;

  const isTricksPhase = gameState.phase === 'tricks';
  const isTrumpHighlightPhase =
    (gameState.phase === 'tricks' || gameState.phase === 'melding') && gameState.trump !== null;
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
      {displayedCards.map((card) => {
        const pos = positions.playerHand[card.id];
        if (!pos) {
          return null;
        }
        if (isSlotMode) {
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
              draggable={true}
              highlighted={highlightedIds.has(card.id)}
              isTrump={false}
              onTap={() => {
                playSound('card-select');
                triggerHaptic('card-select');
                onSlotCard!(card.id);
              }}
              onDrop={() => {
                playSound('card-select');
                triggerHaptic('card-select');
                onSlotCard!(card.id);
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
