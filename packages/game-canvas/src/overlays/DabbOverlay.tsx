/**
 * DabbOverlay — take-dabb UI.
 *
 * Shows the dabb cards face-down, flips them one by one on mount,
 * then lets the bid winner take them. The discard step has been
 * moved to DiscardOverlay.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Card } from '@dabb/shared-types';
import { FlippableCard } from '../cards/FlippableCard.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface DabbOverlayProps {
  visible: boolean;
  dabbCards: Card[];
  onTake: () => void;
}

export function DabbOverlay({ visible, dabbCards, onTake }: DabbOverlayProps) {
  const { t } = useTranslation();
  const [flippedCount, setFlippedCount] = useState(0);
  const [instant, setInstant] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardCount = dabbCards.length;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setFlippedCount(0);
    setInstant(false);
    timers.current = Array.from({ length: cardCount }, (_, i) =>
      setTimeout(() => setFlippedCount(i + 1), 400 + i * 300)
    );
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [visible, cardCount]);

  function handleTake() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFlippedCount(cardCount);
    setInstant(true);
    onTake();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('game.takeDabb')}</Text>
      <View style={styles.cardRow}>
        {dabbCards.map((card, i) => (
          <View key={card.id} style={styles.cardWrapper}>
            <FlippableCard
              card={card}
              flipped={flippedCount > i}
              instant={instant}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
            />
          </View>
        ))}
      </View>
      <HapticTouchableOpacity style={styles.primaryButton} onPress={handleTake}>
        <Text style={styles.primaryButtonText}>{t('game.takeDabb')}</Text>
      </HapticTouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 280,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primaryButton: {
    backgroundColor: '#8b6914',
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
