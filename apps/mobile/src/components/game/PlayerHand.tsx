/**
 * Player hand component for React Native.
 * Uses gesture-handler's ScrollView for compatibility with card drag gestures.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { Card as CardType } from '@dabb/shared-types';
import DraggableCard from './DraggableCard';
import Card from './Card';

interface PlayerHandProps {
  cards: CardType[];
  selectedCardId?: string | null;
  validCardIds?: string[];
  onCardSelect?: (cardId: string) => void;
  selectionMode?: 'single' | 'multiple';
  selectedCardIds?: string[];
  onMultiSelect?: (cardId: string) => void;
  draggable?: boolean;
  onPlayCard?: (cardId: string) => void;
}

function PlayerHand({
  cards,
  selectedCardId,
  validCardIds,
  onCardSelect,
  selectionMode = 'single',
  selectedCardIds = [],
  onMultiSelect,
  draggable = false,
  onPlayCard,
}: PlayerHandProps) {
  const isCardValid = (cardId: string) => {
    if (!validCardIds) {
      return true;
    }
    return validCardIds.includes(cardId);
  };

  const isSelected = (cardId: string) => {
    if (selectionMode === 'multiple') {
      return selectedCardIds.includes(cardId);
    }
    return selectedCardId === cardId;
  };

  const handlePress = (cardId: string) => {
    if (selectionMode === 'multiple') {
      onMultiSelect?.(cardId);
    } else {
      onCardSelect?.(cardId);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {cards.map((card, index) => (
        <View key={card.id} style={[styles.cardWrapper, index > 0 && styles.overlappingCard]}>
          {draggable ? (
            <DraggableCard
              card={card}
              selected={isSelected(card.id)}
              valid={isCardValid(card.id)}
              draggable={draggable}
              onPress={() => handlePress(card.id)}
              onPlayCard={onPlayCard}
            />
          ) : (
            <Card
              card={card}
              selected={isSelected(card.id)}
              valid={isCardValid(card.id)}
              onPress={() => handlePress(card.id)}
            />
          )}
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
