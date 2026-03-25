/**
 * TrickAnimationLayer — full-screen absolute overlay for trick card animations.
 *
 * Replaces TrickArea. Renders trick cards in screen coordinates with:
 * - Arc flight animation on first render (via CardView initialX/Y)
 * - 3-second pause after trick won (handled by useTrickAnimationState)
 * - Staggered sweep to winner's corner (sweepingCardCount from hook)
 */
import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CardView, deriveCardPositions, type SkiaEffects } from '@dabb/game-canvas';
import type { Player, PlayerIndex } from '@dabb/shared-types';
import type { TrickAnimationResult } from '@dabb/ui-shared';
import { useGameDimensions } from '../../hooks/useGameDimensions.js';

const HAND_Y_FRACTION = 0.82;
const CARD_W = 70;

export interface TrickAnimationLayerProps {
  animState: TrickAnimationResult;
  myPlayerIndex: PlayerIndex;
  players: Player[];
  playerCount: 3 | 4;
  effects?: SkiaEffects;
  /** Drop position from the local player's last drag-to-play; used as card flight origin. */
  localPlayerDropOrigin?: { x: number; y: number };
}

export const TrickAnimationLayer = React.memo(function TrickAnimationLayer({
  animState,
  myPlayerIndex,
  players,
  playerCount,
  effects,
  localPlayerDropOrigin,
}: TrickAnimationLayerProps) {
  const { width, height } = useGameDimensions();
  const { animPhase, displayCards, winnerIndex, winnerPlayerId, sweepingCardCount } = animState;

  // Local player at index 0 (bottom-left), then opponents descending so that
  // the rightmost opponent gets WON_PILE_CORNERS[1]=topRight and the leftmost gets [2]=topLeft.
  const { positions, sweepDest, getOrigin } = useMemo(() => {
    // Opponents are sorted descending so the rightmost opponent (highest playerIndex,
    // positioned at edgeFraction 85%) maps to WON_PILE_CORNERS[1]=topRight and the
    // leftmost (lowest playerIndex, edgeFraction 15%) maps to WON_PILE_CORNERS[2]=topLeft.
    const sortedPlayers = [...players].sort((a, b) => {
      if (a.playerIndex === myPlayerIndex) {
        return -1;
      }
      if (b.playerIndex === myPlayerIndex) {
        return 1;
      }
      return b.playerIndex - a.playerIndex; // descending: rightmost opponent first
    });
    const wonPilePlayerIds = sortedPlayers.map((p) => p.id);

    // Opponents need an entry in opponentCardCounts so deriveCardPositions computes
    // their hand positions. The count value doesn't affect x/y.
    // Sort by playerIndex so Object.keys() iteration order is deterministic and
    // matches the visual left-to-right order (lowest playerIndex → leftmost position).
    const opponentCardCounts: Record<string, number> = {};
    [...players]
      .filter((p) => p.playerIndex !== myPlayerIndex)
      .sort((a, b) => a.playerIndex - b.playerIndex)
      .forEach((p) => {
        opponentCardCounts[p.id] = 1;
      });

    const pos = deriveCardPositions(
      {
        handCardIds: [],
        trickCardIds: displayCards.map((pc) => ({ cardId: pc.cardId, seatIndex: pc.playerIndex })),
        wonPilePlayerIds,
        opponentCardCounts,
      },
      { width, height, playerCount }
    );

    const dest = winnerPlayerId ? pos.wonPiles[winnerPlayerId] : null;

    // Where does this player's card fly *from*?
    // Self → drag-drop position if available, else center of hand; opponent → their hand zone along the top
    const origin = (playerIndex: PlayerIndex): { x: number; y: number } => {
      if (playerIndex === myPlayerIndex) {
        return localPlayerDropOrigin ?? { x: width / 2, y: height * HAND_Y_FRACTION };
      }
      const player = players.find((p) => p.playerIndex === playerIndex);
      if (player) {
        const oh = pos.opponentHands[player.id];
        if (oh) {
          return { x: oh.x, y: oh.y };
        }
      }
      return { x: width / 2, y: height * 0.08 };
    };

    return { positions: pos, sweepDest: dest, getOrigin: origin };
  }, [
    players,
    myPlayerIndex,
    displayCards,
    width,
    height,
    playerCount,
    winnerPlayerId,
    localPlayerDropOrigin,
  ]);

  // Fire particles at pile when the last card starts sweeping
  useEffect(() => {
    if (
      animPhase === 'sweeping' &&
      sweepingCardCount === displayCards.length &&
      displayCards.length > 0 &&
      sweepDest &&
      effects
    ) {
      effects.triggerSweepParticles(sweepDest.x, sweepDest.y);
    }
  }, [sweepingCardCount, animPhase, displayCards.length, sweepDest, effects]);

  if (animPhase === 'idle' || displayCards.length === 0) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {displayCards.map((pc, i) => {
        const settled = positions.trickCards[pc.cardId];
        if (!settled) {
          return null;
        }

        // Card moves to sweep destination once its index is unlocked by sweepingCardCount
        const isSweeping = animPhase === 'sweeping' && sweepDest !== null && i < sweepingCardCount;
        const targetX = isSweeping ? sweepDest.x : settled.x;
        const targetY = isSweeping ? sweepDest.y : settled.y;
        const targetRotation = isSweeping ? 0 : settled.rotation;
        const origin = getOrigin(pc.playerIndex);

        const player = players.find((p) => p.playerIndex === pc.playerIndex);
        const isWinner = animPhase === 'paused' && pc.playerIndex === winnerIndex;
        const showLabel = animPhase === 'showing' || animPhase === 'paused';

        return (
          <React.Fragment key={pc.cardId}>
            <CardView
              card={pc.cardId}
              targetX={targetX}
              targetY={targetY}
              targetRotation={targetRotation}
              zIndex={isSweeping ? 10 + i : settled.zIndex}
              // initialX/Y used only on first mount — CardView arcs from here to target
              initialX={origin.x}
              initialY={origin.y}
              highlighted={isWinner}
            />
            {showLabel && player && (
              <View
                style={[styles.labelContainer, { left: targetX, top: targetY - 20, width: CARD_W }]}
                pointerEvents="none"
              >
                <Text
                  style={[styles.labelText, isWinner && styles.labelTextWinner]}
                  numberOfLines={1}
                >
                  {player.nickname}
                </Text>
              </View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  labelText: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'normal',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    textAlign: 'center',
    overflow: 'hidden',
  },
  labelTextWinner: {
    color: '#ffd700',
    fontWeight: 'bold',
  },
});
