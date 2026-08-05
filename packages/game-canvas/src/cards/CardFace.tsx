/**
 * CardFace — antique paper card face.
 *
 * Ass shows a large suit symbol in the center.
 * Zehn shows a large "10" in suit color in the center.
 * Face cards (König, Ober, Buabe) show a colored vertical band with the rank
 * initial (K / O / B) displayed prominently in contrasting color.
 *
 * CardId format: "suit-rank-copy" (e.g. "kreuz-ass-0")
 */
import React, { useEffect, useRef } from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import { SUIT_SYMBOLS, getSuitColor, RANK_DISPLAY } from '@dabb/card-assets';
import type { CardId, Suit, Rank } from '@dabb/shared-types';

export interface CardFaceProps {
  card: CardId;
  width: number;
  height: number;
  x?: number;
  y?: number;
  dimmed?: boolean;
  isTrump?: boolean;
}

const FACE_RANKS = new Set<Rank>(['koenig', 'ober', 'buabe']);

function parseCardId(id: CardId): { suit: Suit; rank: Rank } {
  const [suit, rank] = id.split('-') as [Suit, Rank];
  return { suit, rank };
}

export function CardFace({
  card,
  width,
  height,
  x = 0,
  y = 0,
  dimmed = false,
  isTrump = false,
}: CardFaceProps) {
  const { suit, rank } = parseCardId(card);
  const symbol = SUIT_SYMBOLS[suit];
  const color = getSuitColor(suit);
  const abbr = RANK_DISPLAY[rank];
  const isFace = FACE_RANKS.has(rank);

  // The card View (border-radius + overflow:hidden) is a child of a rotated parent.
  // Firefox rasterises the child's rounded corners then composites the rotation — producing
  // aliased edges. rotateX(0.001deg) promotes the child to its own GPU layer so Firefox
  // composites a pre-rendered AA'd texture instead of re-rasterising on rotation.
  const cardRef = useRef<View>(null);
  useEffect(() => {
    const el = cardRef.current as unknown as HTMLElement | null;
    if (el?.style) {
      el.style.transform = 'rotateX(0.001deg)';
    }
  }, []);

  const cornerSz = Math.round(width * 0.17);
  const centerSz = isFace || rank === '10' ? Math.round(width * 0.52) : Math.round(width * 0.42);

  return (
    <View
      ref={cardRef}
      style={[
        rnStyles.card,
        {
          width,
          height,
          borderRadius: width * 0.06,
          borderWidth: dimmed ? 0 : 0.5,
          borderColor: dimmed ? 'transparent' : '#c8b89a',
          left: x,
          top: y,
        },
      ]}
    >
      <View style={rnStyles.cornerTL}>
        <RNText style={[rnStyles.cornerRank, { fontSize: cornerSz, color }]}>{abbr}</RNText>
        <RNText style={[rnStyles.cornerSuit, { fontSize: cornerSz * 0.75, color }]}>
          {symbol}
        </RNText>
      </View>
      <View style={rnStyles.center}>
        <RNText style={{ fontSize: centerSz, color, fontWeight: 'bold' }}>
          {isFace || rank === '10' ? abbr : symbol}
        </RNText>
      </View>
      <View style={[rnStyles.cornerBR, { transform: [{ rotate: '180deg' }] }]}>
        <RNText style={[rnStyles.cornerRank, { fontSize: cornerSz, color }]}>{abbr}</RNText>
        <RNText style={[rnStyles.cornerSuit, { fontSize: cornerSz * 0.75, color }]}>
          {symbol}
        </RNText>
      </View>
      {dimmed && (
        <View
          style={[StyleSheet.absoluteFill, rnStyles.dimOverlay, { borderRadius: width * 0.06 }]}
        />
      )}
      {isTrump && (
        <View
          style={[StyleSheet.absoluteFill, rnStyles.trumpOverlay, { borderRadius: width * 0.06 }]}
        />
      )}
    </View>
  );
}

const rnStyles = StyleSheet.create({
  card: {
    backgroundColor: '#f2e8d0',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#c8b89a',
  },
  cornerTL: { position: 'absolute', top: 4, left: 5, alignItems: 'center' },
  cornerBR: { position: 'absolute', bottom: 4, right: 5, alignItems: 'center' },
  cornerRank: { fontWeight: '700', lineHeight: 15 },
  cornerSuit: { lineHeight: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dimOverlay: { backgroundColor: 'rgba(0,0,0,0.6)' },
  trumpOverlay: { backgroundColor: 'rgba(255,200,50,0.15)' },
});
