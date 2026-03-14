/**
 * OpponentZone — renders a single opponent's area on the table.
 * Landscape/tablet: nameplate + fanned card backs + won-pile count.
 * Portrait phone: nameplate badge + card count number only.
 */
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { PlayerIndex } from '@dabb/shared-types';

export interface OpponentZoneProps {
  playerIndex: PlayerIndex;
  nickname: string;
  cardCount: number;
  isConnected: boolean;
  position: { x: number; y: number };
}

const CARD_W = 40;
const CARD_H = 60;

export function OpponentZone({ nickname, cardCount, isConnected, position }: OpponentZoneProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) > 600;
  const showCards = isLandscape || isTablet;

  return (
    <View style={[styles.container, { left: position.x - 40, top: position.y - 20 }]}>
      <View style={styles.nameplate}>
        <Text style={styles.name} numberOfLines={1}>
          {nickname}
        </Text>
        {!isConnected && <Text style={styles.offlineBadge}>(offline)</Text>}
        {!showCards && <Text style={styles.cardCountBadge}>{cardCount}</Text>}
      </View>
      {showCards && cardCount > 0 && (
        <View style={styles.cardFan}>
          {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
            <View key={i} style={[styles.cardBack, { marginLeft: i === 0 ? 0 : -28 }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', alignItems: 'center', gap: 4 },
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
  name: { fontSize: 14, color: '#3d2e18', maxWidth: 80 },
  offlineBadge: { fontSize: 11, color: '#999' },
  cardCountBadge: { fontSize: 13, color: '#8a5e2e' },
  cardFan: { flexDirection: 'row' },
  cardBack: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#2a6e3c',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1a4a28',
  },
});
