/**
 * Trick area component for React Native
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Card as CardType, Trick, PlayerIndex, Suit } from '@dabb/shared-types';
import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  cards: Map<string, CardType>;
  playerCount: number;
  currentPlayerIndex: PlayerIndex;
  trump: Suit | null;
}

function TrickArea({
  trick,
  cards,
  playerCount,
  currentPlayerIndex,
  trump,
}: TrickAreaProps) {
  const getPositionStyle = (playerIndex: number) => {
    const relativePosition = (playerIndex - currentPlayerIndex + playerCount) % playerCount;

    if (playerCount === 2) {
      return relativePosition === 0 ? styles.bottom : styles.top;
    }

    if (playerCount === 3) {
      switch (relativePosition) {
        case 0:
          return styles.bottom;
        case 1:
          return styles.topLeft;
        case 2:
          return styles.topRight;
      }
    }

    switch (relativePosition) {
      case 0:
        return styles.bottom;
      case 1:
        return styles.left;
      case 2:
        return styles.top;
      case 3:
        return styles.right;
    }

    return {};
  };

  const playedCards = trick.cards.map(pc => ({
    card: cards.get(pc.cardId),
    playerIndex: pc.playerIndex,
  }));

  return (
    <View style={styles.container}>
      {trump && (
        <View style={styles.trumpIndicator}>
          <Text style={styles.trumpText}>Trumpf: {trump}</Text>
        </View>
      )}

      <View style={styles.trickArea}>
        {playedCards.map(({ card, playerIndex }) =>
          card ? (
            <View
              key={card.id}
              style={[styles.cardPosition, getPositionStyle(playerIndex)]}
            >
              <Card card={card} />
            </View>
          ) : null
        )}

        {trick.cards.length === 0 && (
          <Text style={styles.emptyText}>Spielbereich</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trumpIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  trumpText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400e',
  },
  trickArea: {
    width: 200,
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPosition: {
    position: 'absolute',
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  left: {
    left: 0,
  },
  right: {
    right: 0,
  },
  topLeft: {
    top: 0,
    left: 20,
  },
  topRight: {
    top: 0,
    right: 20,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default TrickArea;
