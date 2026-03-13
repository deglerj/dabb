/**
 * CardFace — antique paper card face.
 * König/Ober/Buabe use emoji placeholders; wired to real SVGs in Plan 2.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SUIT_SYMBOLS, getSuitColor, RANK_DISPLAY } from '@dabb/card-assets';
import type { Card } from '@dabb/shared-types';

export interface CardFaceProps {
  card: Card;
  width: number;
  height: number;
}

const FACE_EMOJI: Record<string, string> = { koenig: '♛', ober: '♜', buabe: '♞' };

export function CardFace({ card, width, height }: CardFaceProps) {
  const symbol = SUIT_SYMBOLS[card.suit];
  const color = getSuitColor(card.suit);
  const abbr = RANK_DISPLAY[card.rank];
  const isFace = card.rank in FACE_EMOJI;
  const cornerSz = Math.round(width * 0.17);
  const centerSz = Math.round(width * 0.42);

  return (
    <View style={[styles.card, { width, height, borderRadius: width * 0.06 }]}>
      <View style={styles.cornerTL}>
        <Text style={[styles.cornerRank, { fontSize: cornerSz, color }]}>{abbr}</Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSz * 0.75, color }]}>{symbol}</Text>
      </View>
      <View style={styles.center}>
        {isFace ? (
          <Text style={{ fontSize: centerSz * 0.7 }}>{FACE_EMOJI[card.rank]}</Text>
        ) : (
          <Text style={[styles.centerSuit, { fontSize: centerSz, color }]}>{symbol}</Text>
        )}
      </View>
      <View style={[styles.cornerTL, styles.cornerBR, { transform: [{ rotate: '180deg' }] }]}>
        <Text style={[styles.cornerRank, { fontSize: cornerSz, color }]}>{abbr}</Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSz * 0.75, color }]}>{symbol}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f2e8d0',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#c8b89a',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  cornerTL: { position: 'absolute', top: 4, left: 5, alignItems: 'center' },
  cornerBR: { top: undefined, left: undefined, bottom: 4, right: 5 },
  cornerRank: { fontWeight: '700', lineHeight: 15 },
  cornerSuit: { lineHeight: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerSuit: {},
});
