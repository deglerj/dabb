/**
 * Pure position derivation for all cards on the table.
 * Takes a snapshot of card IDs + screen dimensions, returns pixel positions.
 * No React, no side effects. Reanimated consumes the output via CardView props.
 */

export interface LayoutDimensions {
  width: number;
  height: number;
  playerCount: 3 | 4;
}

export interface CardPosition {
  x: number;
  y: number;
  rotation: number; // degrees
  zIndex: number;
}

export interface TrickCardEntry {
  cardId: string;
  seatIndex: number; // which player seat played this card
}

export interface CardPositionsInput {
  handCardIds: string[];
  trickCardIds: TrickCardEntry[];
  wonPilePlayerIds: string[]; // ordered list of player IDs (determines corner assignment)
  opponentCardCounts: Record<string, number>; // playerId → remaining card count
}

export interface CardPositionsOutput {
  playerHand: Record<string, CardPosition>;
  trickCards: Record<string, CardPosition>;
  wonPiles: Record<string, { x: number; y: number }>;
  opponentHands: Record<string, { x: number; y: number; cardCount: number }>;
  /** Scale factor applied to card dimensions (1.0 = full size, <1.0 = scaled down to fit). */
  cardScale: number;
}

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;
const CARD_OVERLAP = 22;
const HAND_SIDE_MARGIN = 16;
const HAND_BOTTOM_MARGIN = 10;
const TRICK_CENTER_X_FRACTION = 0.5;
const TRICK_CENTER_Y_FRACTION = 0.45;
const TRICK_CARD_SPREAD = 80;
const TRICK_ROTATIONS = [-4, 3, -2, 5];
const MOBILE_BREAKPOINT_WIDTH = 480;
const MAX_CARDS_PER_ROW = 10;
const ROW_OVERLAP = 0.4;

/** Corner positions as [xFraction, yFraction] — index matches wonPilePlayerIds order */
const WON_PILE_CORNERS: [number, number][] = [
  [0.06, 0.9], // bottom-left  (player 0 = local player)
  [0.94, 0.06], // top-right    (opponent 1)
  [0.06, 0.06], // top-left     (opponent 2)
  [0.94, 0.9], // bottom-right (opponent 3)
];

export function deriveCardPositions(
  input: CardPositionsInput,
  layout: LayoutDimensions
): CardPositionsOutput {
  const { width, height } = layout;

  // Player hand — two-row mode on narrow screens when hand exceeds MAX_CARDS_PER_ROW
  const n = input.handCardIds.length;
  const availableWidth = width - 2 * HAND_SIDE_MARGIN;
  const isTwoRowMode = width < MOBILE_BREAKPOINT_WIDTH && n > MAX_CARDS_PER_ROW;

  const playerHand: Record<string, CardPosition> = {};
  let cardScale: number;

  if (isTwoRowMode) {
    const bottomIds = input.handCardIds.slice(0, MAX_CARDS_PER_ROW);
    const topIds = input.handCardIds.slice(MAX_CARDS_PER_ROW);
    const bottomCount = bottomIds.length;
    const topCount = topIds.length;

    // Scale driven by the bottom row (more cards → more constrained)
    const bottomNaturalWidth =
      bottomCount * CARD_WIDTH - Math.max(0, bottomCount - 1) * CARD_OVERLAP;
    cardScale = n === 0 ? 1 : Math.min(1, availableWidth / bottomNaturalWidth);

    const scaledW = CARD_WIDTH * cardScale;
    const scaledH = CARD_HEIGHT * cardScale;
    const scaledOverlap = CARD_OVERLAP * cardScale;

    // Bottom row
    const bottomTotalWidth = bottomCount * scaledW - Math.max(0, bottomCount - 1) * scaledOverlap;
    const bottomStartX = (width - bottomTotalWidth) / 2;
    const bottomY = height - scaledH - HAND_BOTTOM_MARGIN;

    bottomIds.forEach((id, i) => {
      playerHand[id] = {
        x: bottomStartX + i * (scaledW - scaledOverlap),
        y: bottomY,
        rotation: (i - (bottomCount - 1) / 2) * 1.8,
        zIndex: topCount + i,
      };
    });

    // Top row — overlaps bottom row by ROW_OVERLAP fraction of card height
    const topTotalWidth = topCount * scaledW - Math.max(0, topCount - 1) * scaledOverlap;
    const topStartX = (width - topTotalWidth) / 2;
    const topY = bottomY - scaledH * (1 - ROW_OVERLAP);

    topIds.forEach((id, i) => {
      playerHand[id] = {
        x: topStartX + i * (scaledW - scaledOverlap),
        y: topY,
        rotation: (i - (topCount - 1) / 2) * 1.8,
        zIndex: i,
      };
    });
  } else {
    // Single-row — original logic
    const naturalWidth = n * CARD_WIDTH - Math.max(0, n - 1) * CARD_OVERLAP;
    cardScale = n === 0 ? 1 : Math.min(1, availableWidth / naturalWidth);

    const scaledW = CARD_WIDTH * cardScale;
    const scaledH = CARD_HEIGHT * cardScale;
    const scaledOverlap = CARD_OVERLAP * cardScale;

    const handTotalWidth = n * scaledW - Math.max(0, n - 1) * scaledOverlap;
    const handStartX = (width - handTotalWidth) / 2;
    const handY = height - scaledH - HAND_BOTTOM_MARGIN;

    input.handCardIds.forEach((id, i) => {
      playerHand[id] = {
        x: handStartX + i * (scaledW - scaledOverlap),
        y: handY,
        rotation: (i - (n - 1) / 2) * 1.8,
        zIndex: i,
      };
    });
  }

  // Trick cards
  const tc = input.trickCardIds.length;
  const trickStartX = width * TRICK_CENTER_X_FRACTION - ((tc - 1) * TRICK_CARD_SPREAD) / 2;
  const trickCards: Record<string, CardPosition> = {};
  input.trickCardIds.forEach(({ cardId }, i) => {
    trickCards[cardId] = {
      x: trickStartX + i * TRICK_CARD_SPREAD,
      y: height * TRICK_CENTER_Y_FRACTION,
      rotation: TRICK_ROTATIONS[i % TRICK_ROTATIONS.length] ?? 0,
      zIndex: i,
    };
  });

  // Won piles (one corner per player, ordered by wonPilePlayerIds)
  const wonPiles: Record<string, { x: number; y: number }> = {};
  input.wonPilePlayerIds.forEach((playerId, i) => {
    const [fx, fy] = WON_PILE_CORNERS[i % WON_PILE_CORNERS.length]!;
    wonPiles[playerId] = { x: width * fx, y: height * fy };
  });

  // Opponent hands (evenly spaced along top edge)
  const opponentIds = Object.keys(input.opponentCardCounts);
  const opponentHands: Record<string, { x: number; y: number; cardCount: number }> = {};
  opponentIds.forEach((id, i) => {
    const fraction = (i + 1) / (opponentIds.length + 1);
    opponentHands[id] = {
      x: width * fraction,
      y: height * 0.08,
      cardCount: input.opponentCardCounts[id] ?? 0,
    };
  });

  return { playerHand, trickCards, wonPiles, opponentHands, cardScale };
}
