/**
 * Trick area component for React Native
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Trick, PlayerIndex, Suit } from '@dabb/shared-types';
import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  playerCount: number;
  currentPlayerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  trump: Suit | null;
  winnerPlayerIndex?: PlayerIndex | null;
}

function TrickArea({
  trick,
  playerCount,
  currentPlayerIndex,
  nicknames,
  trump,
  winnerPlayerIndex,
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

  return (
    <View style={styles.container}>
      {trump && (
        <View style={styles.trumpIndicator}>
          <Text style={styles.trumpText}>Trumpf: {trump}</Text>
        </View>
      )}

      <View style={styles.trickArea}>
        {trick.cards.map((playedCard) => (
          <View
            key={playedCard.cardId}
            style={[styles.cardPosition, getPositionStyle(playedCard.playerIndex)]}
          >
            <Card
              card={playedCard.card}
              winner={
                winnerPlayerIndex !== null &&
                winnerPlayerIndex !== undefined &&
                playedCard.playerIndex === winnerPlayerIndex
              }
            />
            <Text style={styles.playerName}>{nicknames.get(playedCard.playerIndex)}</Text>
          </View>
        ))}

        {trick.cards.length === 0 && <Text style={styles.emptyText}>Spielbereich</Text>}
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
  playerName: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 2,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default TrickArea;
