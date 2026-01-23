/**
 * Player hand component for React Native
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { Card as CardType } from '@dabb/shared-types';
import Card from './Card';

interface PlayerHandProps {
  cards: CardType[];
  selectedCardId?: string | null;
  validCardIds?: string[];
  onCardSelect?: (cardId: string) => void;
}

function PlayerHand({
  cards,
  selectedCardId,
  validCardIds,
  onCardSelect,
}: PlayerHandProps) {
  const isCardValid = (cardId: string) => {
    if (!validCardIds) {return true;}
    return validCardIds.includes(cardId);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {cards.map((card, index) => (
        <View
          key={card.id}
          style={[styles.cardWrapper, index > 0 && styles.overlappingCard]}
        >
          <Card
            card={card}
            selected={selectedCardId === card.id}
            valid={isCardValid(card.id)}
            onPress={() => onCardSelect?.(card.id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cardWrapper: {
    marginRight: -20,
  },
  overlappingCard: {
    marginLeft: 0,
  },
});

export default PlayerHand;
