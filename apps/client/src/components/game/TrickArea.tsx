/**
 * TrickArea — displays the cards currently in the center trick pile.
 * Renders each trick card as a CardView in a row arrangement with slight overlap.
 * Cards are positioned absolutely within a fixed-size container.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardView } from '@dabb/game-canvas';
import type { CardId, PlayerIndex } from '@dabb/shared-types';

export interface TrickAreaProps {
  trickCards: Array<{ cardId: CardId; playerIndex: PlayerIndex }>;
  playerCount: number;
  myPlayerIndex: PlayerIndex;
}

const CARD_W = 60;
const CARD_H = 84;
const OVERLAP = 10;

export function TrickArea({ trickCards }: TrickAreaProps) {
  if (trickCards.length === 0) {
    return <View />;
  }

  const totalWidth = CARD_W + (trickCards.length - 1) * (CARD_W - OVERLAP);

  return (
    <View style={[styles.container, { width: totalWidth, height: CARD_H }]}>
      {trickCards.map((entry, i) => (
        <CardView
          key={`${entry.cardId}-${i}`}
          card={entry.cardId}
          targetX={i * (CARD_W - OVERLAP)}
          targetY={0}
          targetRotation={0}
          zIndex={i}
          width={CARD_W}
          height={CARD_H}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
});
