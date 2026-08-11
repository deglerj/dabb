import { View, StyleSheet } from '@dabb/rn-compat';
import {
  CardView,
  deriveCardPositions,
  getFeltBounds,
  isWithinDropZone,
  type LayoutDimensions,
  type TableEffects,
} from '@dabb/game-canvas';
import { getValidPlays, isPartnerWinning, sortHand } from '@dabb/game-logic';
import type { GameState, PlayerIndex, Card } from '@dabb/shared-types';
import { playSound } from '../../utils/sounds.js';
import { useGameDimensions } from '../../hooks/useGameDimensions.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { computeHighlightedDabbIds } from './dabbHighlighting.js';
import { computeMeldCardIds } from './meldHighlighting.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface PlayerHandProps {
  gameState: GameState | null;
  playerIndex: PlayerIndex;
  cards: Card[];
  onPlayCard: (cardId: string, dropPos?: { x: number; y: number }) => void;
  effects?: TableEffects;
  slottedCardIds?: string[];
  onSlotCard?: (cardId: string) => void;
}

export function PlayerHand({
  gameState,
  playerIndex,
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

  const layout: LayoutDimensions = { width, height };

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
      handCards: displayedCards.map((c) => ({ id: c.id, suit: c.suit })),
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
  // No phase list: `trump` is null until it is declared and `resetForNewRound` clears it again,
  // so its mere presence already means "declared, round still running".
  const isTrumpHighlightPhase = gameState.trump !== null;
  const validPlays =
    isTricksPhase && gameState.trump
      ? getValidPlays(
          cards,
          gameState.currentTrick,
          gameState.trump,
          isPartnerWinning(gameState.currentTrick, gameState.trump, playerIndex, gameState.players)
        )
      : [];
  const validIds = new Set(validPlays.map((c) => c.id));
  const highlightedIds = computeHighlightedDabbIds(gameState.phase, gameState.dabbCardIds);
  // Whole hand, not just displayedCards — a card already slotted for the layaway should still
  // show it is paying in a meld.
  const meldIds = computeMeldCardIds(gameState.phase, cards, gameState.trump);

  // Topmost hand card — dropping at or below it means the card was dragged back to the hand.
  const handTopY = Math.min(...Object.values(positions.playerHand).map((p) => p.y));

  const handleDrop = (cardId: string) => (x: number, y: number) => {
    if (isWithinDropZone(x, y, feltBounds, handTopY) && validIds.has(cardId)) {
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
              isTrump={isTrumpHighlightPhase && card.suit === gameState.trump}
              isMeld={meldIds.has(card.id)}
              onTap={() => {
                playSound('card-select');
                triggerHaptic('card-select');
                onSlotCard!(card.id);
              }}
              onDrop={(x, y) => {
                if (isWithinDropZone(x, y, feltBounds, handTopY)) {
                  playSound('card-select');
                  triggerHaptic('card-select');
                  onSlotCard!(card.id);
                }
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
            isMeld={meldIds.has(card.id)}
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
