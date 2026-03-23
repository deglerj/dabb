/**
 * DiscardOverlay — card-slot discard UI.
 *
 * Renders a dim scrim + floating dialog with `discardCount` card slots.
 * Tap a slotted card to return it to hand. Confirm with Ablegen once
 * all slots are filled. "Abgehen..." link reveals inline Go Out flow.
 *
 * The scrim is visual-only (pointerEvents="none") so hand taps pass through.
 * Rendered as a direct child of gameWrapper in GameScreen (not inside PhaseOverlay).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { CardId, Suit } from '@dabb/shared-types';
import { SUITS } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';
import { CardFace } from '../cards/CardFace.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;

export interface DiscardOverlayProps {
  visible: boolean;
  discardCount: number;
  slottedCardIds: CardId[];
  onRemoveFromSlot: (cardId: CardId) => void;
  onDiscard: () => void;
  onGoOut: (suit: Suit) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function DiscardOverlay({
  visible,
  discardCount,
  slottedCardIds,
  onRemoveFromSlot,
  onDiscard,
  onGoOut,
}: DiscardOverlayProps) {
  const { t } = useTranslation();
  const [showGoOut, setShowGoOut] = useState(false);
  const [pendingSuit, setPendingSuit] = useState<Suit | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-40);
  const scale = useSharedValue(0.92);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(-20, { duration: 180 });
      scale.value = withTiming(0.95, { duration: 180 });
      setPendingSuit(null);
      setShowGoOut(false);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const canDiscard = slottedCardIds.length === discardCount;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim scrim — visual only, taps pass through to PlayerHand */}
      <View style={styles.scrim} pointerEvents="none" />

      {/* Floating dialog */}
      <AnimatedView style={[styles.dialog, animatedStyle]} pointerEvents="auto">
        <Text style={styles.title}>{t('game.discardCards')}</Text>

        {/* Card slots */}
        <View style={styles.slotRow}>
          {Array.from({ length: discardCount }, (_, i) => {
            const cardId = slottedCardIds[i];
            return (
              <HapticTouchableOpacity
                key={i}
                style={styles.slot}
                onPress={() => cardId && onRemoveFromSlot(cardId)}
                disabled={!cardId}
              >
                {cardId ? (
                  <CardFace card={cardId} width={CARD_WIDTH} height={CARD_HEIGHT} />
                ) : (
                  <Text style={styles.slotNumber}>{i + 1}</Text>
                )}
              </HapticTouchableOpacity>
            );
          })}
        </View>

        {/* Counter */}
        <Text style={styles.counter}>
          {slottedCardIds.length} / {discardCount}
        </Text>

        {/* Ablegen button */}
        <HapticTouchableOpacity
          style={[styles.primaryButton, !canDiscard && styles.primaryButtonDisabled]}
          onPress={onDiscard}
          disabled={!canDiscard}
        >
          <Text style={styles.primaryButtonText}>{t('game.discard')}</Text>
        </HapticTouchableOpacity>

        <View style={styles.divider} />

        {/* Go Out section */}
        {!showGoOut ? (
          <HapticTouchableOpacity onPress={() => setShowGoOut(true)}>
            <Text style={styles.goOutLink}>{t('game.goOutLink')}</Text>
          </HapticTouchableOpacity>
        ) : pendingSuit === null ? (
          <>
            <Text style={styles.goOutLabel}>{t('game.orGoOut')}</Text>
            <View style={styles.suitRow}>
              {SUITS.map((suit) => (
                <HapticTouchableOpacity
                  key={suit}
                  style={[styles.suitButton, { backgroundColor: getSuitColor(suit) }]}
                  onPress={() => setPendingSuit(suit)}
                >
                  <Text style={styles.suitButtonText}>{SUIT_SYMBOLS[suit]}</Text>
                </HapticTouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.confirmTitle}>
              {t('game.goOutConfirmTitle')} {SUIT_SYMBOLS[pendingSuit]}
            </Text>
            <Text style={styles.confirmMessage}>{t('game.goOutConfirmMessage')}</Text>
            <View style={styles.confirmRow}>
              <HapticTouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPendingSuit(null)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </HapticTouchableOpacity>
              <HapticTouchableOpacity
                style={[styles.suitButton, { backgroundColor: getSuitColor(pendingSuit) }]}
                onPress={() => {
                  onGoOut(pendingSuit);
                  setPendingSuit(null);
                  setShowGoOut(false);
                }}
              >
                <Text style={styles.suitButtonText}>{t('game.goOut')}</Text>
              </HapticTouchableOpacity>
            </View>
          </>
        )}
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dialog: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    zIndex: 100,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 14,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  slot: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8b6914',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 105, 20, 0.08)',
  },
  slotNumber: {
    fontSize: 18,
    color: '#c8b090',
    fontWeight: '300',
  },
  counter: {
    fontSize: 13,
    color: '#7a6040',
    marginBottom: 10,
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
  goOutLink: {
    fontSize: 13,
    color: '#7a6040',
    textDecorationLine: 'underline',
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
  confirmTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 12,
    color: '#7a6040',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#c8b090',
  },
  cancelButtonText: {
    color: '#3a2800',
    fontWeight: '600',
    fontSize: 13,
  },
});
