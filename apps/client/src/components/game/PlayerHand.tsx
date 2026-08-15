import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, triggerHaptic } from '@dabb/rn-compat';
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
import { computeHighlightedDabbIds } from './dabbHighlighting.js';
import { computeMeldCardIds } from './meldHighlighting.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;
/** Gap between two cards landing in the hand during the deal. */
export const DEAL_STAGGER_MS = 63;
/** How long a single card takes to fly from the felt into the hand. */
export const DEAL_ARC_MS = 360;

export interface PlayerHandProps {
  gameState: GameState | null;
  playerIndex: PlayerIndex;
  cards: Card[];
  onPlayCard: (cardId: string, dropPos?: { x: number; y: number }) => void;
  effects?: TableEffects;
  slottedCardIds?: string[];
  onSlotCard?: (cardId: string) => void;
  /**
   * Deal the hand out card by card instead of showing it at once. GameScreen keys this
   * component by the CARDS_DEALT event id, so the stagger runs once per round — and never for
   * a deal that is only being replayed on rejoin, reload or a resumed offline game.
   */
  animateDeal?: boolean;
  /**
   * Fired once the dealt hand has landed — and immediately when there is nothing to animate,
   * so a caller waiting on it is never left hanging. Must be stable (useCallback): it is an
   * effect dependency, and a fresh identity every render would restart the deal.
   */
  onDealComplete?: () => void;
}

export function PlayerHand({
  gameState,
  playerIndex,
  cards,
  onPlayCard,
  effects,
  slottedCardIds,
  onSlotCard,
  animateDeal = false,
  onDealComplete,
}: PlayerHandProps) {
  const { width, height } = useGameDimensions();
  const feltBounds = getFeltBounds(width, height);

  const staggerDeal =
    animateDeal && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true;
  const [revealedCount, setRevealedCount] = useState(staggerDeal ? 0 : Number.POSITIVE_INFINITY);
  // Once the deal has landed, later mounts (a card coming back out of the layaway slot) must
  // not fly in from the felt again.
  const dealDone = useRef(!staggerDeal);

  useEffect(() => {
    if (dealDone.current) {
      onDealComplete?.();
      return;
    }
    // The hand is empty while the previous round's last trick sweeps off the table
    // (GameScreen holds it back), so wait for the real cards before dealing anything out.
    if (cards.length === 0) {
      return;
    }
    const total = cards.length;
    let revealed = 0;
    let landedTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const intervalId = setInterval(() => {
      revealed += 1;
      if (revealed > total) {
        clearInterval(intervalId);
        // Deliberately one tick late: the last card has to mount while this is still false,
        // otherwise it appears in place instead of flying in.
        dealDone.current = true;
        landedTimeoutId = setTimeout(() => onDealComplete?.(), DEAL_ARC_MS);
        return;
      }
      setRevealedCount(revealed);
    }, DEAL_STAGGER_MS);
    return () => {
      clearInterval(intervalId);
      clearTimeout(landedTimeoutId);
    };
  }, [cards.length, onDealComplete]);

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

  // Deal: cards mount a few at a time and CardView arcs each one in from the middle of the
  // felt. Positions come from the whole hand, not the revealed slice, so the fan does not
  // creep sideways as it fills up.
  const isDealing = staggerDeal && !dealDone.current;
  const dealOrigin = {
    x: feltBounds.x + feltBounds.width / 2 - scaledW / 2,
    y: feltBounds.y + feltBounds.height / 2 - scaledH / 2,
  };
  const visibleCards = displayedCards.slice(0, revealedCount);

  const handleDrop = (cardId: string) => (x: number, y: number) => {
    if (isWithinDropZone(x, y, feltBounds, handTopY) && validIds.has(cardId)) {
      onPlayCard(cardId, { x, y });
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {visibleCards.map((card) => {
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
            initialX={isDealing ? dealOrigin.x : undefined}
            initialY={isDealing ? dealOrigin.y : undefined}
            animationDuration={isDealing ? DEAL_ARC_MS : undefined}
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
