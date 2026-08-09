/**
 * OpponentZone — renders a single opponent's area on the table.
 * Landscape/tablet: nameplate + fanned card backs.
 * Portrait phone: nameplate only.
 */
import { View, Text, StyleSheet } from '@dabb/rn-compat';
import { CardBackView, getTableScale } from '@dabb/game-canvas';
import { useGameDimensions } from '../../hooks/useGameDimensions.js';
import type { EmoteKey, PlayerIndex } from '@dabb/shared-types';
import { EMOTE_GLYPH } from '@dabb/shared-types';

export interface OpponentZoneProps {
  playerIndex: PlayerIndex;
  nickname: string;
  cardCount: number;
  isConnected: boolean;
  position: { x: number; y: number };
  isTeammate?: boolean;
  /** The emote this player is currently showing, if any. */
  emote?: EmoteKey;
}

const CARD_W = 40;
const CARD_H = 60;
const MAX_FAN_CARDS = 6;
const OVERLAP = 28;

export function OpponentZone({
  nickname,
  cardCount,
  isConnected,
  position,
  isTeammate,
  emote,
}: OpponentZoneProps) {
  const { width, height } = useGameDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) > 600;
  const showCards = isLandscape || isTablet;
  const scale = getTableScale(width);
  const scaledW = CARD_W * scale;
  const scaledH = CARD_H * scale;
  const maxFanWidth = scaledW + (MAX_FAN_CARDS - 1) * (scaledW - OVERLAP * scale);
  const fanStep =
    cardCount > MAX_FAN_CARDS
      ? (maxFanWidth - scaledW) / (cardCount - 1)
      : scaledW - OVERLAP * scale;

  return (
    <View style={[styles.container, { left: position.x - 40, top: position.y - 20 }]}>
      {/* Always mounted, hidden by opacity: a bubble appearing and vanishing every ten
          seconds would otherwise push the nameplate and card fan around. */}
      <View style={[styles.emoteBubble, !emote && styles.emoteBubbleHidden]} pointerEvents="none">
        <Text style={styles.emoteGlyph}>{emote ? EMOTE_GLYPH[emote] : '·'}</Text>
      </View>
      <View style={[styles.nameplate, isTeammate && styles.nameplateTeammate]}>
        {isTeammate && <Text style={styles.teammateIcon}>🤝</Text>}
        <Text style={styles.name} numberOfLines={1}>
          {nickname}
        </Text>
        {!isConnected && <Text style={styles.offlineBadge}>(offline)</Text>}
      </View>
      {showCards && cardCount > 0 && (
        <View style={styles.cardFan}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <View key={i} style={{ marginLeft: i === 0 ? 0 : fanStep - scaledW }}>
              <CardBackView width={scaledW} height={scaledH} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', alignItems: 'center', gap: 4 },
  emoteBubble: {
    backgroundColor: '#fffaf0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emoteBubbleHidden: { opacity: 0 },
  emoteGlyph: { fontSize: 16 },
  nameplate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f2e8d0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  nameplateTeammate: { borderColor: '#3b82f6' },
  teammateIcon: { fontSize: 12 },
  name: { fontSize: 14, color: '#3d2e18', maxWidth: 80 },
  offlineBadge: { fontSize: 11, color: '#999' },
  cardFan: { flexDirection: 'row' },
});
