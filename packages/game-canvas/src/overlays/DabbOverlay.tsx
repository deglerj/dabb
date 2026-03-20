/**
 * DabbOverlay — two-step dabb UI.
 *
 * step='take':    Show 2 CardBack components + Take button.
 * step='discard': Show dabb cards as CardFace + selection + Discard button + Go Out section.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Card, Suit } from '@dabb/shared-types';
import { SUITS } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';
import { CardFace } from '../cards/CardFace.js';
import { CardBack } from '../cards/CardBack.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface DabbOverlayProps {
  step: 'take' | 'discard';
  dabbCards: Card[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onTake: () => void;
  onDiscard: () => void;
  onGoOut: (suit: Suit) => void;
}

export function DabbOverlay({
  step,
  dabbCards,
  selectedCardIds,
  onToggleCard,
  onTake,
  onDiscard,
  onGoOut,
}: DabbOverlayProps) {
  const { t } = useTranslation();
  const discardCount = 2;
  const canDiscard = selectedCardIds.length === discardCount;

  return (
    <View style={styles.container}>
      {step === 'take' ? (
        <>
          <Text style={styles.title}>{t('game.takeDabb')}</Text>
          <View style={styles.cardRow}>
            {dabbCards.map((_, i) => (
              <View key={i} style={styles.cardWrapper}>
                <CardBack width={CARD_WIDTH} height={CARD_HEIGHT} />
              </View>
            ))}
          </View>
          <HapticTouchableOpacity style={styles.primaryButton} onPress={onTake}>
            <Text style={styles.primaryButtonText}>{t('game.takeDabb')}</Text>
          </HapticTouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('game.discardCards')}</Text>
          <View style={styles.cardRow}>
            {dabbCards.map((card) => {
              const isSelected = selectedCardIds.includes(card.id);
              return (
                <HapticTouchableOpacity
                  key={card.id}
                  style={[styles.cardWrapper, isSelected && styles.cardWrapperSelected]}
                  onPress={() => onToggleCard(card.id)}
                  activeOpacity={0.8}
                >
                  <CardFace card={card.id} width={CARD_WIDTH} height={CARD_HEIGHT} />
                </HapticTouchableOpacity>
              );
            })}
          </View>
          <HapticTouchableOpacity
            style={[styles.primaryButton, !canDiscard && styles.primaryButtonDisabled]}
            onPress={onDiscard}
            disabled={!canDiscard}
          >
            <Text style={styles.primaryButtonText}>{t('game.discard')}</Text>
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
    marginBottom: 12,
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
  cardWrapperSelected: {
    borderColor: '#f39c12',
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
