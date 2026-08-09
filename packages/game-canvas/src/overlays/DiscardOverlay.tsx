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
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from '@dabb/rn-compat';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Suit } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';

export interface DiscardOverlayProps {
  visible: boolean;
  discardCount: number;
  slottedCount: number;
  /** Already declared by this point — going out uses it, it is no longer chosen here. */
  trump: Suit;
  onDiscard: () => void;
  onGoOut: () => void;
}

const EASE_OUT_CUBIC = 'cubic-bezier(0.215,0.61,0.355,1)';
const EASE_IN_CUBIC = 'cubic-bezier(0.55,0.055,0.675,0.19)';
const SPRING_EASE = 'cubic-bezier(0.34,1.56,0.64,1)';

export function DiscardOverlay({
  visible,
  discardCount,
  slottedCount,
  trump,
  onDiscard,
  onGoOut,
}: DiscardOverlayProps) {
  const { t } = useTranslation();
  const [showGoOut, setShowGoOut] = useState(false);

  const [opacity, setOpacity] = useState(0);
  const [translateY, setTranslateY] = useState(-20);
  const [scale, setScale] = useState(0.95);

  useEffect(() => {
    if (visible) {
      setOpacity(1);
      setTranslateY(0);
      setScale(1);
    } else {
      setOpacity(0);
      setTranslateY(-10);
      setScale(0.97);
      setShowGoOut(false);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const canDiscard = slottedCount === discardCount;
  const transition = visible
    ? `opacity 220ms ${EASE_OUT_CUBIC}, transform 220ms ${SPRING_EASE}`
    : `opacity 180ms ${EASE_IN_CUBIC}, transform 180ms ${EASE_IN_CUBIC}`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={[styles.panel, { opacity, transform: [{ translateY }, { scale }], transition }]}
        pointerEvents="auto"
      >
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

        {/* Go Out section — the suit is whatever was declared as trump a step earlier */}
        {!showGoOut ? (
          <HapticTouchableOpacity onPress={() => setShowGoOut(true)}>
            <Text style={styles.goOutLink}>{t('game.goOutLink')}</Text>
          </HapticTouchableOpacity>
        ) : (
          <>
            <Text style={styles.confirmTitle}>
              {t('game.goOutConfirmTitle')} {SUIT_SYMBOLS[trump]}
            </Text>
            <Text style={styles.confirmMessage}>{t('game.goOutConfirmMessage')}</Text>
            <View style={styles.confirmRow}>
              <HapticTouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowGoOut(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </HapticTouchableOpacity>
              <HapticTouchableOpacity
                style={[styles.suitButton, { backgroundColor: getSuitColor(trump) }]}
                onPress={() => {
                  onGoOut();
                  setShowGoOut(false);
                }}
              >
                <Text style={styles.suitButtonText}>{t('game.goOut')}</Text>
              </HapticTouchableOpacity>
            </View>
          </>
        )}
      </View>
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
    fontVariantNumeric: 'tabular-nums',
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
