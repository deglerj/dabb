import React from 'react';
import Svg, { G, Path, Ellipse, Rect, Line, Circle } from 'react-native-svg';

interface KoenigFaceProps {
  color: string;
}

function KoenigHalf({ color }: { color: string }) {
  return (
    <>
      {/* Crown */}
      <Path
        d="M20,22 L20,9 L29,17 L40,7 L51,17 L60,9 L60,22Z"
        fill="#D4A520"
        stroke="#8B6914"
        strokeWidth="1"
      />
      <Rect
        x="18"
        y="20"
        width="44"
        height="5"
        rx="1"
        fill="#D4A520"
        stroke="#8B6914"
        strokeWidth="0.5"
      />
      {/* Crown jewels */}
      <Circle cx="40" cy="16" r="2.5" fill="#CC2222" />
      <Circle cx="28" cy="19" r="1.5" fill="#3366CC" />
      <Circle cx="52" cy="19" r="1.5" fill="#3366CC" />

      {/* Head */}
      <Ellipse cx="40" cy="33" rx="12" ry="11" fill="#F5E6D3" stroke={color} strokeWidth="1" />
      {/* Hair / sideburns */}
      <Path
        d="M28,29 Q25,37 28,43"
        fill="none"
        stroke="#6B4422"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <Path
        d="M52,29 Q55,37 52,43"
        fill="none"
        stroke="#6B4422"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Eyes */}
      <Circle cx="36" cy="30" r="1.5" fill="#2A1A0A" />
      <Circle cx="44" cy="30" r="1.5" fill="#2A1A0A" />
      {/* Moustache + beard */}
      <Path d="M34,36 Q40,40 46,36" fill="none" stroke="#6B4422" strokeWidth="1.5" />
      <Path d="M32,40 Q40,46 48,40" fill="none" stroke="#6B4422" strokeWidth="1.5" />

      {/* Robe body */}
      <Path d="M22,45 L58,45 L62,60 L18,60Z" fill="#2244AA" stroke="#1A3388" strokeWidth="1" />
      {/* Red cape half */}
      <Path d="M22,45 L40,45 L40,56 L18,52Z" fill="#CC2222" />
      {/* Gold center stripe */}
      <Line x1="40" y1="45" x2="40" y2="60" stroke="#D4A520" strokeWidth="2" />

      {/* Left hand: orb scepter */}
      <Line x1="15" y1="58" x2="15" y2="42" stroke="#888888" strokeWidth="2.5" />
      <Circle cx="15" cy="40" r="5" fill="#D4A520" stroke="#8B6914" strokeWidth="1" />
      <Circle cx="15" cy="40" r="2" fill="#CC2222" />

      {/* Right hand: sword */}
      <Line x1="65" y1="57" x2="65" y2="42" stroke="#AAAAAA" strokeWidth="2.5" />
      <Line x1="61" y1="51" x2="69" y2="51" stroke="#8B6914" strokeWidth="2" />
    </>
  );
}

function KoenigFace({ color }: KoenigFaceProps) {
  return (
    <Svg viewBox="0 0 80 120" width={56} height={84}>
      <G>
        <KoenigHalf color={color} />
      </G>
      <G transform="rotate(180 40 60)">
        <KoenigHalf color={color} />
      </G>
    </Svg>
  );
}

export default KoenigFace;
