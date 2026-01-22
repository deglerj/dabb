/**
 * Card component for React Native
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Card as CardType, Suit, Rank } from '@dabb/shared-types';
import { isHiddenCard } from '@dabb/game-logic';

interface CardProps {
  card: CardType;
  selected?: boolean;
  valid?: boolean;
  onPress?: () => void;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  kreuz: '♣',
  schippe: '♠',
  herz: '❤️',
  bollen: '♦',
};

const RANK_DISPLAY: Record<Rank, string> = {
  '9': '9',
  buabe: 'U',
  ober: 'O',
  koenig: 'K',
  '10': '10',
  ass: 'A',
};

function Card({ card, selected = false, valid = true, onPress }: CardProps) {
  if (isHiddenCard(card)) {
    return (
      <View style={[styles.card, styles.hiddenCard]}>
        <Text style={styles.hiddenSymbol}>🃏</Text>
      </View>
    );
  }

  const isRed = card.suit === 'herz' || card.suit === 'bollen';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && styles.selectedCard,
        !valid && styles.invalidCard,
      ]}
      onPress={valid ? onPress : undefined}
      disabled={!valid || !onPress}
      activeOpacity={valid && onPress ? 0.7 : 1}
    >
      <Text style={[styles.suitSymbol, isRed && styles.redText]}>
        {SUIT_SYMBOLS[card.suit]}
      </Text>
      <Text style={[styles.rankText, isRed && styles.redText]}>
        {RANK_DISPLAY[card.rank]}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 60,
    height: 90,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hiddenCard: {
    backgroundColor: '#1e3a5f',
  },
  selectedCard: {
    borderColor: '#2563eb',
    borderWidth: 2,
    transform: [{ translateY: -8 }],
  },
  invalidCard: {
    opacity: 0.5,
  },
  hiddenSymbol: {
    fontSize: 32,
  },
  suitSymbol: {
    fontSize: 24,
    color: '#1e3a5f',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginTop: 4,
  },
  redText: {
    color: '#dc2626',
  },
});

export default Card;
