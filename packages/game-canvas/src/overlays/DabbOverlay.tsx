/**
 * DabbOverlay — two-step dabb UI.
 *
 * step='take':    Show 2 CardBack components + Take button.
 * step='discard': Show dabb cards as CardFace + selection + Discard button + Go Out section.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Card, Suit } from '@dabb/shared-types';
import { SUITS } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';
import { FlippableCard } from '../cards/FlippableCard.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface DabbOverlayProps {
  step: 'take' | 'discard';
  dabbCards: Card[];
  discardCount: number;
  selectedCardIds: string[];
  onTake: () => void;
  onDiscard: () => void;
  onGoOut: (suit: Suit) => void;
}

export function DabbOverlay({
  step,
  dabbCards,
  discardCount,
  selectedCardIds,
  onTake,
  onDiscard,
  onGoOut,
}: DabbOverlayProps) {
  const { t } = useTranslation();
  const canDiscard = selectedCardIds.length === discardCount;

  // Track how many dabb cards have auto-flipped (0, 1, or 2)
  const [flippedCount, setFlippedCount] = useState<0 | 1 | 2>(0);
  // When true, any pending or in-progress flip is cancelled and cards snap to face
  const [instant, setInstant] = useState(false);
  const timer1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 'take') {
      return;
    }
    // Reset state when overlay re-opens
    setFlippedCount(0);
    setInstant(false);
    timer1.current = setTimeout(() => setFlippedCount(1), 400);
    timer2.current = setTimeout(() => setFlippedCount(2), 700);
    return () => {
      if (timer1.current) {
        clearTimeout(timer1.current);
      }
      if (timer2.current) {
        clearTimeout(timer2.current);
      }
    };
  }, [step]);

  function handleTake() {
    if (timer1.current) {
      clearTimeout(timer1.current);
    }
    if (timer2.current) {
      clearTimeout(timer2.current);
    }
    setFlippedCount(2);
    setInstant(true);
    onTake();
  }

  return (
    <View style={styles.container}>
      {step === 'take' ? (
        <>
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
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('game.discardCards')}</Text>
          <Text style={styles.hint}>{t('game.selectCardsToDiscard', { count: discardCount })}</Text>
          <HapticTouchableOpacity
            style={[styles.primaryButton, !canDiscard && styles.primaryButtonDisabled]}
            onPress={onDiscard}
            disabled={!canDiscard}
          >
            <Text style={styles.primaryButtonText}>
              {t('game.selectedCount', { selected: selectedCardIds.length, total: discardCount })}
            </Text>
          </HapticTouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.goOutLabel}>{t('game.orGoOut')}</Text>
          <View style={styles.suitRow}>
            {SUITS.map((suit) => (
              <HapticTouchableOpacity
                key={suit}
                style={[styles.suitButton, { backgroundColor: getSuitColor(suit) }]}
                onPress={() => onGoOut(suit)}
              >
                <Text style={styles.suitButtonText}>{SUIT_SYMBOLS[suit]}</Text>
              </HapticTouchableOpacity>
            ))}
          </View>
        </>
      )}
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
  hint: {
    fontSize: 13,
    color: '#7a6040',
    marginBottom: 14,
    textAlign: 'center',
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
  primaryButtonDisabled: {
    backgroundColor: '#bfae90',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#c8b090',
    width: '100%',
    marginVertical: 12,
  },
  goOutLabel: {
    fontSize: 13,
    color: '#7a6040',
    marginBottom: 8,
  },
  suitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suitButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
