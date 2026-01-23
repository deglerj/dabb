/**
 * Trump selector component for React Native
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Suit } from '@dabb/shared-types';
import { SUITS, SUIT_NAMES } from '@dabb/shared-types';

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
}

const SUIT_COLORS: Record<Suit, string> = {
  kreuz: '#8B4513',
  schippe: '#228B22',
  herz: '#dc2626',
  bollen: '#FFD700',
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  kreuz: '♣',
  schippe: '♠',
  herz: '❤️',
  bollen: '♦',
};

function TrumpSelector({ onSelect }: TrumpSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trumpf wählen</Text>
      <View style={styles.suitGrid}>
        {SUITS.map((suit) => (
          <TouchableOpacity
            key={suit}
            style={[styles.suitButton, { backgroundColor: SUIT_COLORS[suit] }]}
            onPress={() => onSelect(suit)}
          >
            <Text style={styles.suitSymbol}>{SUIT_SYMBOLS[suit]}</Text>
            <Text style={styles.suitName}>{SUIT_NAMES[suit]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  suitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  suitButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  suitSymbol: {
    fontSize: 32,
    color: '#fff',
  },
  suitName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 4,
  },
});

export default TrumpSelector;
