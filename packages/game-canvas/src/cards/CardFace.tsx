/**
 * CardFace — antique paper card face rendered as a Skia Canvas.
 * König/Ober/Buabe use emoji placeholders; wired to real SVGs in Plan 2.
 *
 * CardId format: "suit-rank-copy" (e.g. "kreuz-ass-0")
 */
import React, { useMemo } from 'react';
import { Canvas, RoundedRect, Group, Text, matchFont } from '@shopify/react-native-skia';
import { SUIT_SYMBOLS, getSuitColor, RANK_DISPLAY } from '@dabb/card-assets';
import type { CardId, Suit, Rank } from '@dabb/shared-types';

export interface CardFaceProps {
  card: CardId;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const FACE_EMOJI: Partial<Record<Rank, string>> = {
  koenig: '♛',
  ober: '♜',
  buabe: '♞',
};

function parseCardId(id: CardId): { suit: Suit; rank: Rank } {
  const [suit, rank] = id.split('-') as [Suit, Rank];
  return { suit, rank };
}

export function CardFace({ card, width, height, x = 0, y = 0 }: CardFaceProps) {
  const { suit, rank } = useMemo(() => parseCardId(card), [card]);
  const symbol = SUIT_SYMBOLS[suit];
  const color = getSuitColor(suit);
  const abbr = RANK_DISPLAY[rank];
  const faceEmoji = FACE_EMOJI[rank];
  const isFace = faceEmoji !== undefined;

  const cornerFontSize = Math.round(width * 0.17);
  const cornerSuitFontSize = Math.round(cornerFontSize * 0.75);
  const centerFontSize = Math.round(width * 0.42);

  const cornerFont = useMemo(
    () =>
      matchFont({
        fontFamily: 'System',
        fontSize: cornerFontSize,
        fontWeight: 'bold',
        fontStyle: 'normal',
      }),
    [cornerFontSize]
  );

  const cornerSuitFont = useMemo(
    () =>
      matchFont({
        fontFamily: 'System',
        fontSize: cornerSuitFontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
    [cornerSuitFontSize]
  );

  const centerFont = useMemo(
    () =>
      matchFont({
        fontFamily: 'System',
        fontSize: centerFontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
    [centerFontSize]
  );

  const radius = width * 0.06;
  const padding = 5;

  // Measure text widths for positioning
  const abbrWidth = cornerFont.measureText(abbr).width;
  const symbolSmallWidth = cornerSuitFont.measureText(symbol).width;
  const centerText = isFace ? (faceEmoji ?? '') : symbol;
  const centerTextWidth = centerFont.measureText(centerText).width;

  // Corner rank: top-left, baseline at cornerFontSize
  const rankBaselineY = padding + cornerFontSize;
  // Corner suit: below rank
  const suitBaselineY = rankBaselineY + cornerSuitFontSize * 0.9;

  // Center: vertically and horizontally centered
  const centerBaselineY = (height + centerFontSize) / 2 - centerFontSize * 0.15;
  const centerX = (width - centerTextWidth) / 2;

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

        {/* Center: large suit symbol or face emoji */}
        <Text
          x={centerX}
          y={centerBaselineY}
          text={centerText}
          font={centerFont}
          color={isFace ? '#333333' : color}
        />
      </Group>
    </Canvas>
  );
}
