/**
 * Trump selector component for React Native
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Suit } from '@dabb/shared-types';
import { SUITS, SUIT_NAMES } from '@dabb/shared-types';
import SuitIcon from '../SuitIcon';
import { Colors, Fonts, Shadows } from '../../theme';

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
}

function TrumpSelector({ onSelect }: TrumpSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trumpf wählen</Text>
      <View style={styles.suitGrid}>
        {SUITS.map((suit) => {
          const isRed = suit === 'herz' || suit === 'bollen';
          return (
            <Pressable
              key={suit}
              style={({ pressed }) => [styles.suitButton, pressed && styles.suitButtonPressed]}
              onPress={() => onSelect(suit)}
            >
              <SuitIcon suit={suit} size={36} />
              <Text style={[styles.suitName, isRed && styles.suitNameRed]}>{SUIT_NAMES[suit]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.paperFace,
    borderRadius: 3,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    ...Shadows.panel,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
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
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paperAged,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    shadowColor: Colors.paperEdge,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  suitButtonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  suitName: {
    fontSize: 12,
    fontFamily: Fonts.handwritingBold,
    color: Colors.cardBlack,
    marginTop: 4,
  },
  suitNameRed: {
    color: Colors.cardRed,
  },
});

export default TrumpSelector;
