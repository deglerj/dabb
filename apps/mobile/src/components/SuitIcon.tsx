import React from 'react';
import Svg, { Path, Ellipse, Rect, Circle, Line, Defs, ClipPath } from 'react-native-svg';
import type { Suit } from '@dabb/shared-types';

interface SuitIconProps {
  suit: Suit;
  size?: number;
}

// Herz = traditional German playing card heart
function HerzIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50,86 C22,65 5,50 5,33 C5,19 15,10 28,10 C37,10 45,15 50,24 C55,15 63,10 72,10 C85,10 95,19 95,33 C95,50 78,65 50,86Z"
        fill="#C41E3A"
      />
    </Svg>
  );
}

// Kreuz = Eichel (Acorn): golden nut, olive-green ribbed cap, dark stem
function KreuzIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Acorn nut body (oval: taller than wide) */}
      <Ellipse cx={50} cy={68} rx={22} ry={28} fill="#C4941A" />
      {/* Cupule: simple two-bezier arch covering the nut top */}
      <Path d="M28,56 Q28,32 50,30 Q72,32 72,56 Z" fill="#3C5E26" />
      {/* Stem (ends at cupule peak) */}
      <Rect x={46} y={12} width={8} height={20} rx={4} fill="#3C5E26" />
    </Svg>
  );
}

// Schippe = Blatt (Leaf): rounded Württemberg leaf, forest green
function SchippeIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50,8 C68,9 88,25 91,48 C94,70 80,86 60,89 L53,97 L47,97 L40,89 C20,86 6,70 9,48 C12,25 32,9 50,8Z"
        fill="#1E7B1E"
      />
      {/* Center vein */}
      <Path d="M50,10 Q50,50 50,88" fill="none" stroke="#145A14" strokeWidth={1.5} opacity={0.5} />
    </Svg>
  );
}

// Bollen = Schellen (Quartered ball): four-color heraldic quartering
function BollenIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="bollen-mobile-clip">
          <Circle cx={50} cy={50} r={40} />
        </ClipPath>
      </Defs>
      {/* Top-left: dark crimson */}
      <Rect
        x={10}
        y={10}
        width={40}
        height={40}
        fill="#9B1515"
        clipPath="url(#bollen-mobile-clip)"
      />
      {/* Top-right: golden yellow */}
      <Rect
        x={50}
        y={10}
        width={40}
        height={40}
        fill="#C89000"
        clipPath="url(#bollen-mobile-clip)"
      />
      {/* Bottom-left: forest green */}
      <Rect
        x={10}
        y={50}
        width={40}
        height={40}
        fill="#1A5A1A"
        clipPath="url(#bollen-mobile-clip)"
      />
      {/* Bottom-right: dark navy */}
      <Rect
        x={50}
        y={50}
        width={40}
        height={40}
        fill="#1A1A7A"
        clipPath="url(#bollen-mobile-clip)"
      />
      {/* Gold dividing cross */}
      <Line x1={50} y1={10} x2={50} y2={90} stroke="#D4A520" strokeWidth={2.5} />
      <Line x1={10} y1={50} x2={90} y2={50} stroke="#D4A520" strokeWidth={2.5} />
      {/* Gold border ring */}
      <Circle cx={50} cy={50} r={40} fill="none" stroke="#D4A520" strokeWidth={4} />
    </Svg>
  );
}

const SUIT_COMPONENTS: Record<Suit, React.FC<{ size: number }>> = {
  kreuz: KreuzIcon,
  schippe: SchippeIcon,
  herz: HerzIcon,
  bollen: BollenIcon,
};

function SuitIcon({ suit, size = 24 }: SuitIconProps) {
  const Component = SUIT_COMPONENTS[suit];
  return <Component size={size} />;
}

export default SuitIcon;
