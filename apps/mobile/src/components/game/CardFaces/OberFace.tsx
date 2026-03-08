import React from 'react';
import Svg, { G, Path, Ellipse, Rect, Line, Circle } from 'react-native-svg';

interface OberFaceProps {
  color: string;
}

function OberHalf({ color }: { color: string }) {
  return (
    <>
      {/* Wide-brimmed hat: brim ellipse + tall crown + feather */}
      <Ellipse cx="40" cy="17" rx="21" ry="5" fill={color} />
      <Path d="M30,17 Q30,7 40,5 Q50,7 50,17Z" fill={color} />
      {/* Feather in hat */}
      <Path
        d="M50,13 Q60,6 57,18 Q53,14 50,13Z"
        fill="#D4A520"
        stroke="#8B6914"
        strokeWidth="0.8"
      />

      {/* Head */}
      <Ellipse cx="40" cy="29" rx="10" ry="11" fill="#F5E6D3" stroke={color} strokeWidth="1" />
      {/* Eyes */}
      <Circle cx="36" cy="26" r="1.5" fill="#2A1A0A" />
      <Circle cx="44" cy="26" r="1.5" fill="#2A1A0A" />
      {/* Thin moustache */}
      <Path d="M35,32 Q40,35 45,32" fill="none" stroke="#6B4422" strokeWidth="1.2" />

      {/* Robe body */}
      <Path d="M26,41 L54,41 L58,60 L22,60Z" fill="#2A7A44" stroke="#1A5A30" strokeWidth="1" />
      {/* Gold sash */}
      <Rect x="22" y="52" width="36" height="4" fill="#D4A520" stroke="#8B6914" strokeWidth="0.5" />
      {/* Red lapel */}
      <Path d="M26,41 L40,41 L40,52 L22,48Z" fill="#CC2222" />

      {/* Diagonal lance (from upper-right to lower-left) */}
      <Line
        x1="62"
        y1="22"
        x2="18"
        y2="58"
        stroke="#8B6914"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Lance tip */}
      <Path d="M62,22 L66,18 L64,26Z" fill="#AAAAAA" />
    </>
  );
}

function OberFace({ color }: OberFaceProps) {
  return (
    <Svg viewBox="0 0 80 120" width={56} height={84}>
      <G>
        <OberHalf color={color} />
      </G>
      <G transform="rotate(180 40 60)">
        <OberHalf color={color} />
      </G>
    </Svg>
  );
}

export default OberFace;
