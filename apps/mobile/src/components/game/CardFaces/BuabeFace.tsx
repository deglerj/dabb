import React from 'react';
import Svg, { G, Path, Ellipse, Line, Circle } from 'react-native-svg';

interface BuabeFaceProps {
  color: string;
}

function BuabeHalf({ color }: { color: string }) {
  return (
    <>
      {/* Round cap */}
      <Ellipse cx="40" cy="16" rx="12" ry="9" fill={color} />
      <Ellipse cx="40" cy="23" rx="15" ry="4" fill={color} />
      {/* Cap button */}
      <Circle cx="40" cy="9" r="2.5" fill="#D4A520" />

      {/* Head — rounder, younger */}
      <Ellipse cx="40" cy="33" rx="11" ry="12" fill="#F5E6D3" stroke={color} strokeWidth="1" />
      {/* Eyes */}
      <Circle cx="36" cy="29" r="1.5" fill="#2A1A0A" />
      <Circle cx="44" cy="29" r="1.5" fill="#2A1A0A" />
      {/* Cheeky grin */}
      <Path d="M35,37 Q40,42 45,37" fill="none" stroke={color} strokeWidth="1.5" />

      {/* Jacket body — simpler, less regal */}
      <Path d="M27,46 L53,46 L57,60 L23,60Z" fill="#8B2020" stroke="#6B1010" strokeWidth="1" />
      {/* Gold buttons down center */}
      <Circle cx="40" cy="50" r="1.5" fill="#D4A520" />
      <Circle cx="40" cy="55" r="1.5" fill="#D4A520" />
      {/* Blue collar */}
      <Path d="M33,46 L47,46 L44,52 L36,52Z" fill="#2244AA" />

      {/* Right arm: short sword held upright */}
      <Line x1="60" y1="58" x2="60" y2="42" stroke="#AAAAAA" strokeWidth="2.5" />
      {/* Cross-guard */}
      <Line x1="56" y1="50" x2="64" y2="50" stroke="#8B6914" strokeWidth="2" />
      {/* Sword pommel */}
      <Circle cx="60" cy="41" r="2.5" fill="#D4A520" />

      {/* Left arm: shield (small heraldic diamond) */}
      <Path d="M20,42 L16,52 L20,62 L24,52Z" fill="#2244AA" stroke={color} strokeWidth="1" />
      <Path d="M20,46 L17,52 L20,58 L23,52Z" fill="#CC2222" />
    </>
  );
}

function BuabeFace({ color }: BuabeFaceProps) {
  return (
    <Svg viewBox="0 0 80 120" width={56} height={84}>
      <G>
        <BuabeHalf color={color} />
      </G>
      <G transform="rotate(180 40 60)">
        <BuabeHalf color={color} />
      </G>
    </Svg>
  );
}

export default BuabeFace;
