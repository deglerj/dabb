/**
 * Card component for React Native — Gaststätte Abend design
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import type { Card as CardType, Rank, Suit } from '@dabb/shared-types';
import { isHiddenCard } from '@dabb/game-logic';
import SuitIcon from '../SuitIcon';
import KoenigFace from './CardFaces/KoenigFace';
import OberFace from './CardFaces/OberFace';
import BuabeFace from './CardFaces/BuabeFace';
import { Colors, Fonts, Shadows } from '../../theme';

interface CardProps {
  card: CardType;
  selected?: boolean;
  valid?: boolean;
  winner?: boolean;
  dabb?: boolean;
  trump?: boolean;
  onPress?: () => void;
}

const RANK_DISPLAY: Record<Rank, string> = {
  buabe: 'B',
  ober: 'O',
  koenig: 'K',
  '10': '10',
  ass: 'A',
};

function getSuitColor(suit: Suit): string {
  return suit === 'herz' || suit === 'bollen' ? Colors.cardRed : Colors.cardBlack;
}

/** Card back with diamond hatch pattern */
function CardBack() {
  return (
    <View style={styles.card} testID="card-back">
      <Svg width={60} height={90} style={StyleSheet.absoluteFill}>
        {/* Dark brown background */}
        <Rect x="0" y="0" width="60" height="90" fill="#5c2e0a" rx="4" />
        {/* Diamond hatch lines at 45deg */}
        {Array.from({ length: 20 }).map((_, i) => (
          <Line
            key={`a${i}`}
            x1={i * 6 - 60}
            y1="0"
            x2={i * 6}
            y2="90"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 20 }).map((_, i) => (
          <Line
            key={`b${i}`}
            x1={i * 6}
            y1="0"
            x2={i * 6 - 60}
            y2="90"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1"
          />
        ))}
        {/* Thin inner border */}
        <Rect
          x="4"
          y="4"
          width="52"
          height="82"
          rx="2"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
      </Svg>
    </View>
  );
}

function Card({
  card,
  selected = false,
  valid = true,
  winner = false,
  dabb = false,
  trump = false,
  onPress,
}: CardProps) {
  if (isHiddenCard(card)) {
    return <CardBack />;
  }

  const suitColor = getSuitColor(card.suit);
  const isFaceCard = card.rank === 'koenig' || card.rank === 'ober' || card.rank === 'buabe';
  const isAss = card.rank === 'ass';
  const rankLabel = RANK_DISPLAY[card.rank];

  // Determine highlight style (only one applies, priority: selected > winner > trump > dabb)
  const highlightStyle = selected
    ? styles.selectedCard
    : winner
      ? styles.winnerCard
      : trump
        ? styles.trumpCard
        : dabb
          ? styles.dabbCard
          : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        highlightStyle,
        selected && styles.selectedLift,
        !valid && styles.invalidCard,
      ]}
      onPress={valid ? onPress : undefined}
      disabled={!valid || !onPress}
      activeOpacity={valid && onPress ? 0.7 : 1}
    >
      {/* Top-left corner */}
      <View style={styles.cornerTL}>
        <Text style={[styles.cornerRank, { color: suitColor }]}>{rankLabel}</Text>
        <View style={styles.cornerSuit}>
          <SuitIcon suit={card.suit} size={10} />
        </View>
      </View>

      {/* Center content */}
      <View style={styles.center}>
        {isFaceCard && (
          <>
            {card.rank === 'koenig' && <KoenigFace color={suitColor} />}
            {card.rank === 'ober' && <OberFace color={suitColor} />}
            {card.rank === 'buabe' && <BuabeFace color={suitColor} />}
          </>
        )}
        {isAss && (
          <>
            {/* Decorative border */}
            <View style={styles.assDecorBorder} />
            <SuitIcon suit={card.suit} size={36} />
          </>
        )}
        {!isFaceCard && !isAss && <SuitIcon suit={card.suit} size={24} />}
      </View>

      {/* Bottom-right corner (rotated) */}
      <View style={styles.cornerBR}>
        <View style={styles.cornerSuit}>
          <SuitIcon suit={card.suit} size={10} />
        </View>
        <Text style={[styles.cornerRank, { color: suitColor }]}>{rankLabel}</Text>
      </View>

      {/* Invalid overlay */}
      {!valid && <View style={styles.invalidOverlay} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 60,
    height: 90,
    backgroundColor: Colors.paperFace,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
    ...Shadows.card,
  },
  selectedCard: {
    borderColor: '#d4890a',
    borderWidth: 2,
    shadowColor: '#d4890a',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 2,
  },
  selectedLift: {
    transform: [{ translateY: -16 }],
  },
  winnerCard: {
    borderColor: '#f0c040',
    borderWidth: 2,
    shadowColor: '#f0c040',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 2,
  },
  trumpCard: {
    borderColor: '#22c55e',
    borderWidth: 2,
    shadowColor: '#22c55e',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 2,
  },
  dabbCard: {
    borderColor: '#60a5fa',
    borderWidth: 2,
    shadowColor: '#60a5fa',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 2,
  },
  invalidCard: {
    opacity: 0.5,
  },
  invalidOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 4,
  },
  cornerTL: {
    position: 'absolute',
    top: 3,
    left: 4,
    alignItems: 'center',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontSize: 11,
    fontFamily: Fonts.display,
    lineHeight: 12,
  },
  cornerSuit: {
    marginTop: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  assDecorBorder: {
    position: 'absolute',
    top: 14,
    left: 6,
    right: 6,
    bottom: 14,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    borderRadius: 2,
  },
});

export default Card;
