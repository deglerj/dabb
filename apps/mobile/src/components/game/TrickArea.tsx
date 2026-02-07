/**
 * Trick area component for React Native
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Trick, PlayerIndex, Suit } from '@dabb/shared-types';
import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  nicknames: Map<PlayerIndex, string>;
  trump: Suit | null;
  winnerPlayerIndex?: PlayerIndex | null;
}

function TrickArea({ trick, nicknames, trump, winnerPlayerIndex }: TrickAreaProps) {
  return (
    <View style={styles.container}>
      {trump && (
        <View style={styles.trumpIndicator}>
          <Text style={styles.trumpText}>Trumpf: {trump}</Text>
        </View>
      )}

      <View style={styles.trickArea}>
        {trick.cards.map((playedCard, index) => (
          <View key={index} style={styles.cardWrapper}>
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  cardWrapper: {
    alignItems: 'center',
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
