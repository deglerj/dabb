/**
 * TrumpOverlay — four suit coins; tapping one selects trump.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';
import type { Suit } from '@dabb/shared-types';
import { SUITS, SUIT_NAMES } from '@dabb/shared-types';
import { getSuitColor, SUIT_SYMBOLS } from '@dabb/card-assets';

export interface TrumpOverlayProps {
  onSelectTrump: (suit: Suit) => void;
}

export function TrumpOverlay({ onSelectTrump }: TrumpOverlayProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('game.chooseTrump')}</Text>
      <View style={styles.coinsRow}>
        {SUITS.map((suit) => (
          <HapticTouchableOpacity
            key={suit}
            style={[styles.coin, { backgroundColor: getSuitColor(suit) }]}
            onPress={() => onSelectTrump(suit)}
            activeOpacity={0.75}
          >
            <Text style={styles.coinSymbol}>{SUIT_SYMBOLS[suit]}</Text>
            <Text style={styles.coinName}>{SUIT_NAMES[suit]}</Text>
          </HapticTouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 260,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 16,
  },
  coinsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  coinSymbol: {
    fontSize: 20,
    color: '#fff',
  },
  coinName: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 1,
  },
});
