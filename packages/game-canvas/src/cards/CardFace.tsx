/**
 * CardFace — antique paper card face rendered as a Skia Canvas.
 *
 * Number cards (Ass, Zehn) show suit symbol in the center.
 * Face cards (König, Ober, Buabe) show a colored vertical band with the rank
 * initial (K / O / B) displayed prominently in contrasting color.
 *
 * CardId format: "suit-rank-copy" (e.g. "kreuz-ass-0")
 */
import React, { useMemo } from 'react';
import { Canvas, RoundedRect, Rect, Group, Text, matchFont } from '@shopify/react-native-skia';
import { SUIT_SYMBOLS, getSuitColor, RANK_DISPLAY, FACE_CARD_BAND } from '@dabb/card-assets';
import type { CardId, Suit, Rank } from '@dabb/shared-types';

export interface CardFaceProps {
  card: CardId;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const FACE_RANKS = new Set<Rank>(['koenig', 'ober', 'buabe']);

function parseCardId(id: CardId): { suit: Suit; rank: Rank } {
  const [suit, rank] = id.split('-') as [Suit, Rank];
  return { suit, rank };
}

export function CardFace({ card, width, height, x = 0, y = 0 }: CardFaceProps) {
  const { suit, rank } = useMemo(() => parseCardId(card), [card]);
  const symbol = SUIT_SYMBOLS[suit];
  const color = getSuitColor(suit);
  const abbr = RANK_DISPLAY[rank];
  const isFace = FACE_RANKS.has(rank);

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
    return <Canvas style={{ width, height }} />;
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

  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ translateX: x }, { translateY: y }]}>
        {/* Card background */}
        <RoundedRect x={0} y={0} width={width} height={height} r={radius} color="#f2e8d0" />
        {/* Border */}
        <RoundedRect
          x={0.25}
          y={0.25}
          width={width - 0.5}
          height={height - 0.5}
          r={radius}
          color="#c8b89a"
          style="stroke"
          strokeWidth={0.5}
        />

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
  );
}
