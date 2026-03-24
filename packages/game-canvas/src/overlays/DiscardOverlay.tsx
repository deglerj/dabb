/**
 * DiscardOverlay — compact discard panel.
 *
 * Shows a small floating panel with a counter, Ablegen confirm button,
 * and the Go Out flow. Card selection happens on the felt: players drag
 * cards from hand to the table; slotted cards are rendered as CardView
 * elements by GameScreen so they can be dragged back.
 *
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
import type { Suit } from '@dabb/shared-types';
import { SUITS } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';

export interface DiscardOverlayProps {
  visible: boolean;
  discardCount: number;
  slottedCount: number;
  onDiscard: () => void;
  onGoOut: (suit: Suit) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function DiscardOverlay({
  visible,
  discardCount,
  slottedCount,
  onDiscard,
  onGoOut,
}: DiscardOverlayProps) {
  const { t } = useTranslation();
  const [showGoOut, setShowGoOut] = useState(false);
  const [pendingSuit, setPendingSuit] = useState<Suit | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const scale = useSharedValue(0.95);

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
      translateY.value = withTiming(-10, { duration: 180 });
      scale.value = withTiming(0.97, { duration: 180 });
      setPendingSuit(null);
      setShowGoOut(false);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const canDiscard = slottedCount === discardCount;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AnimatedView style={[styles.panel, animatedStyle]} pointerEvents="auto">
        <Text style={styles.title}>{t('game.discardCards')}</Text>

        {/* Counter + confirm row */}
        <View style={styles.actionRow}>
          <Text style={styles.counter}>
            {slottedCount} / {discardCount}
          </Text>
          <HapticTouchableOpacity
            style={[styles.primaryButton, !canDiscard && styles.primaryButtonDisabled]}
            onPress={onDiscard}
            disabled={!canDiscard}
          >
            <Text style={styles.primaryButtonText}>{t('game.discard')}</Text>
          </HapticTouchableOpacity>
        </View>

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
  panel: {
    position: 'absolute',
    alignSelf: 'center',
    top: '14%',
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 100,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  counter: {
    fontSize: 14,
    color: '#7a6040',
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    backgroundColor: '#8b6914',
    borderRadius: 6,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#bfae90',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#c8b090',
    width: '100%',
    marginVertical: 10,
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
