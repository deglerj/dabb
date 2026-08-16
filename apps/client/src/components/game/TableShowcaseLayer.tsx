/**
 * TableShowcaseLayer — lays a row of cards out on the felt: one other player's declared melds,
 * or the Dabb the bid winner just picked up.
 *
 * The flight in and out is CardView's own played-card animation: mounting with initialX/initialY
 * arcs every card from the owner's seat at once, and flipping the targets back to that seat when
 * `retracting` sweeps them all back on the normal target-change transition. No animation code of
 * its own, and nothing staggered — the whole row moves as one.
 */
import { View, Text, StyleSheet } from '@dabb/rn-compat';
import { CardView, getFeltBounds, getTableScale } from '@dabb/game-canvas';
import type { TableShowcase } from '@dabb/ui-shared';
import { useGameDimensions } from '../../hooks/useGameDimensions.js';

const CARD_W = 70;
const CARD_H = 105;
const GAP = 10;
/** Fraction of the felt the row may span before the cards start overlapping instead. */
const MAX_ROW_FRACTION = 0.9;

export interface TableShowcaseLayerProps {
  showcase: TableShowcase | null;
  /** Caption above the row, already translated — the caller knows what it is showing. */
  label: string;
  /** Where the owner sits — the cards fly in from here and retract back to it. */
  seatPosition: { x: number; y: number } | undefined;
}

export function TableShowcaseLayer({ showcase, label, seatPosition }: TableShowcaseLayerProps) {
  const { width, height } = useGameDimensions();

  if (!showcase || !seatPosition) {
    return null;
  }

  const scale = getTableScale(width);
  const cardW = CARD_W * scale;
  const cardH = CARD_H * scale;
  const felt = getFeltBounds(width, height);
  const n = showcase.cards.length;
  const maxRowWidth = felt.width * MAX_ROW_FRACTION;
  const step = n > 1 ? Math.min(cardW + GAP, (maxRowWidth - cardW) / (n - 1)) : 0;
  const rowWidth = cardW + step * (n - 1);
  const rowX = felt.x + (felt.width - rowWidth) / 2;
  const rowY = felt.y + (felt.height - cardH) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.labelContainer,
          {
            left: rowX,
            top: rowY - 28,
            width: rowWidth,
            opacity: showcase.retracting ? 0 : 1,
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.labelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {showcase.cards.map((cardId, i) => (
        // Keyed by player too, so the next player's melds remount and arc in again.
        <CardView
          key={`${showcase.playerIndex}-${cardId}`}
          card={cardId}
          targetX={showcase.retracting ? seatPosition.x : rowX + i * step}
          targetY={showcase.retracting ? seatPosition.y : rowY}
          targetRotation={0}
          zIndex={150 + i}
          width={cardW}
          height={cardH}
          initialX={seatPosition.x}
          initialY={seatPosition.y}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 170,
  },
  labelText: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#ffffff',
    fontSize: 12,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
    overflow: 'hidden',
  },
});
