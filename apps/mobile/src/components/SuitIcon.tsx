import React from 'react';
import Svg, { Path, Ellipse, Rect, Circle, Polygon } from 'react-native-svg';
import type { Suit } from '@dabb/shared-types';

interface SuitIconProps {
  suit: Suit;
  size?: number;
}

function KreuzIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M28 45 Q28 30 50 28 Q72 30 72 45 Z" fill="#A08060" />
      <Ellipse cx={50} cy={62} rx={20} ry={26} fill="#D2B48C" />
      <Rect x={47} y={12} width={6} height={18} fill="#8B7355" />
    </Svg>
  );
}

function SchippeIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 10 C20 35 10 55 30 70 C38 75 45 72 50 65 C55 72 62 75 70 70 C90 55 80 35 50 10"
        fill="#228B22"
      />
      <Rect x={44} y={60} width={12} height={25} fill="#228B22" />
      <Polygon points="35,85 50,70 65,85" fill="#228B22" />
    </Svg>
  );
}

function HerzIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 88 C20 60 10 30 30 20 C40 15 50 25 50 35 C50 25 60 15 70 20 C90 30 80 60 50 88"
        fill="#C41E3A"
      />
    </Svg>
  );
}

function BollenIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={40} fill="#FFD700" />
      <Circle cx={50} cy={50} r={30} fill="#228B22" />
      <Circle cx={50} cy={50} r={18} fill="#B22222" />
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
