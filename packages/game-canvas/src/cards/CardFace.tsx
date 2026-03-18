/**
 * CardFace — antique paper card face rendered as a Skia Canvas.
 *
 * Number cards (Ass, Zehn) show suit symbol in the center.
 * Face cards (König, Ober, Buabe) show a colored vertical band with the rank
 * initial (K / O / B) displayed prominently in contrasting color.
 *
 * CardId format: "suit-rank-copy" (e.g. "kreuz-ass-0")
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, View, Text as RNText, StyleSheet } from 'react-native';
import { Canvas, Rect, Group, Text, matchFont } from '@shopify/react-native-skia';
import { SUIT_SYMBOLS, getSuitColor, RANK_DISPLAY, FACE_CARD_BAND } from '@dabb/card-assets';
import type { CardId, Suit, Rank } from '@dabb/shared-types';

export interface CardFaceProps {
  card: CardId;
  width: number;
  height: number;
  x?: number;
  y?: number;
  dimmed?: boolean;
}

const FACE_RANKS = new Set<Rank>(['koenig', 'ober', 'buabe']);

function parseCardId(id: CardId): { suit: Suit; rank: Rank } {
  const [suit, rank] = id.split('-') as [Suit, Rank];
  return { suit, rank };
}

export function CardFace({ card, width, height, x = 0, y = 0, dimmed = false }: CardFaceProps) {
  const { suit, rank } = useMemo(() => parseCardId(card), [card]);
  const symbol = SUIT_SYMBOLS[suit];
  const color = getSuitColor(suit);
  const abbr = RANK_DISPLAY[rank];
  const isFace = FACE_RANKS.has(rank);

  // On web, the card View (border-radius + overflow:hidden) is a child of a rotated parent.
  // Firefox rasterises the child's rounded corners then composites the rotation — producing
  // aliased edges. translateZ(0) promotes the child to its own GPU layer so Firefox
  // composites a pre-rendered AA'd texture instead of re-rasterising on rotation.
  const cardRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const el = cardRef.current as unknown as HTMLElement | null;
    // translateZ(0) is collapsed to a 2D identity matrix by Firefox and doesn't promote
    // to a GPU layer. rotateX(0.001deg) is non-identity so Firefox must treat it as a true
    // 3D transform, creating a GPU compositing layer whose edges are anti-aliased on compositing.
    if (el?.style) {
      el.style.transform = 'rotateX(0.001deg)';
    }
  }, []);

  const cornerFontSize = Math.round(width * 0.17);
  const cornerSuitFontSize = Math.round(cornerFontSize * 0.75);
  // Face cards: larger initial centered in the band; number cards: large suit symbol
  const centerFontSize = isFace ? Math.round(width * 0.52) : Math.round(width * 0.42);

  // matchFont uses the system font manager which is not implemented on RN Web.
  // The null guard below falls back to a label-free card canvas on web.
  const cornerFont = useMemo(() => {
    try {
      return matchFont({
        fontFamily: 'System',
        fontSize: cornerFontSize,
        fontWeight: 'bold',
        fontStyle: 'normal',
      });
    } catch {
      return null;
    }
  }, [cornerFontSize]);

  const cornerSuitFont = useMemo(() => {
    try {
      return matchFont({
        fontFamily: 'System',
        fontSize: cornerSuitFontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
      });
    } catch {
      return null;
    }
  }, [cornerSuitFontSize]);

  const centerFont = useMemo(() => {
    try {
      return matchFont({
        fontFamily: 'System',
        fontSize: centerFontSize,
        fontWeight: 'bold',
        fontStyle: 'normal',
      });
    } catch {
      return null;
    }
  }, [centerFontSize]);

  if (!cornerFont || !cornerSuitFont || !centerFont) {
    // Fallback for platforms where matchFont is unavailable (e.g. RN Web).
    // Uses React Native View/Text which renders correctly on all platforms.
    const cornerSz = Math.round(width * 0.17);
    const centerSz = isFace ? Math.round(width * 0.52) : Math.round(width * 0.42);
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
            {isFace ? abbr : symbol}
          </RNText>
        </View>
        <View style={[rnStyles.cornerTL, rnStyles.cornerBR, { transform: [{ rotate: '180deg' }] }]}>
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
      </View>
    );
  }

  const radius = width * 0.06;
  const padding = 5;

  // Measure text widths for positioning
  const abbrWidth = cornerFont.measureText(abbr).width;
  const symbolSmallWidth = cornerSuitFont.measureText(symbol).width;

  // Corner rank: top-left, baseline at cornerFontSize
  const rankBaselineY = padding + cornerFontSize;
  // Corner suit: below rank
  const suitBaselineY = rankBaselineY + cornerSuitFontSize * 0.9;

  // Band geometry for face cards: vertical stripe in center 40% of width
  const bandWidth = width * 0.4;
  const bandX = (width - bandWidth) / 2;

  // Center rank initial positioned over the band
  const faceInitial = isFace ? abbr : symbol;
  const faceInitialWidth = centerFont.measureText(faceInitial).width;
  const centerX = (width - faceInitialWidth) / 2;
  const centerBaselineY = (height + centerFontSize) / 2 - centerFontSize * 0.15;

  // Retrieve band/text colors for face cards
  const bandColors = isFace ? FACE_CARD_BAND[rank as 'koenig' | 'ober' | 'buabe'] : null;

  // Wrap the canvas in a View with overflow:hidden so the dim overlay (a plain RN View)
  // is clipped to the card shape at the native level — avoids Skia anti-alias edge artifacts.
  return (
    <View
      ref={cardRef}
      style={[
        skiaStyles.card,
        {
          width,
          height,
          borderRadius: radius,
          borderWidth: dimmed ? 0 : 0.5,
          borderColor: dimmed ? 'transparent' : '#c8b89a',
          left: x,
          top: y,
        },
      ]}
    >
      <Canvas style={{ width, height }}>
        <Group>
          {/* Face card: colored vertical band in center */}
          {isFace && bandColors !== null && (
            <Rect
              x={bandX}
              y={0}
              width={bandWidth}
              height={height}
              color={bandColors.band}
              opacity={0.85}
            />
          )}

          {/* Top-left: rank */}
          <Text x={padding} y={rankBaselineY} text={abbr} font={cornerFont} color={color} />
          {/* Top-left: suit symbol below rank */}
          <Text
            x={padding + (abbrWidth - symbolSmallWidth) / 2}
            y={suitBaselineY}
            text={symbol}
            font={cornerSuitFont}
            color={color}
          />

          {/* Bottom-right corner: rotated 180° */}
          <Group transform={[{ translateX: width }, { translateY: height }, { rotate: Math.PI }]}>
            <Text x={padding} y={rankBaselineY} text={abbr} font={cornerFont} color={color} />
            <Text
              x={padding + (abbrWidth - symbolSmallWidth) / 2}
              y={suitBaselineY}
              text={symbol}
              font={cornerSuitFont}
              color={color}
            />
          </Group>

          {/* Center: large rank initial (face) or suit symbol (number) */}
          <Text
            x={centerX}
            y={centerBaselineY}
            text={faceInitial}
            font={centerFont}
            color={isFace && bandColors !== null ? bandColors.text : color}
          />
        </Group>
      </Canvas>

      {/* Dim overlay — plain RN View clipped by parent overflow:hidden, no Skia edge artifacts */}
      {dimmed && <View style={[StyleSheet.absoluteFill, rnStyles.dimOverlay]} />}
    </View>
  );
}

const skiaStyles = StyleSheet.create({
  card: {
    backgroundColor: '#f2e8d0',
    overflow: 'hidden',
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: '#c8b89a',
  },
});

const rnStyles = StyleSheet.create({
  card: {
    backgroundColor: '#f2e8d0',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#c8b89a',
  },
  cornerTL: { position: 'absolute', top: 4, left: 5, alignItems: 'center' },
  cornerBR: { top: undefined, left: undefined, bottom: 4, right: 5 },
  cornerRank: { fontWeight: '700', lineHeight: 15 },
  cornerSuit: { lineHeight: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dimOverlay: { backgroundColor: 'rgba(0,0,0,0.6)' },
});
