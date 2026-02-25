interface OberFaceProps {
  color: string;
}

// Top half of the double-headed Ober — wide-brimmed hat, diagonal lance
function OberHalf({ color }: { color: string }) {
  return (
    <>
      {/* Wide-brimmed hat: brim ellipse + tall crown + feather */}
      <ellipse cx="40" cy="17" rx="21" ry="5" fill={color} />
      <path d="M30,17 Q30,7 40,5 Q50,7 50,17Z" fill={color} />
      {/* Feather in hat */}
      <path
        d="M50,13 Q60,6 57,18 Q53,14 50,13Z"
        fill="#D4A520"
        stroke="#8B6914"
        strokeWidth="0.8"
      />

      {/* Head */}
      <ellipse cx="40" cy="29" rx="10" ry="11" fill="#F5E6D3" stroke={color} strokeWidth="1" />
      {/* Eyes */}
      <circle cx="36" cy="26" r="1.5" fill="#2A1A0A" />
      <circle cx="44" cy="26" r="1.5" fill="#2A1A0A" />
      {/* Thin moustache */}
      <path d="M35,32 Q40,35 45,32" fill="none" stroke="#6B4422" strokeWidth="1.2" />

      {/* Robe body */}
      <polygon points="26,41 54,41 58,60 22,60" fill="#2A7A44" stroke="#1A5A30" strokeWidth="1" />
      {/* Gold sash */}
      <rect x="22" y="52" width="36" height="4" fill="#D4A520" stroke="#8B6914" strokeWidth="0.5" />
      {/* Red lapel */}
      <polygon points="26,41 40,41 40,52 22,48" fill="#CC2222" />

      {/* Diagonal lance (from upper-right to lower-left) */}
      <line
        x1="62"
        y1="22"
        x2="18"
        y2="58"
        stroke="#8B6914"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Lance tip */}
      <path d="M62,22 L66,18 L64,26Z" fill="#AAAAAA" />
    </>
  );
}

function OberFace({ color }: OberFaceProps) {
  return (
    <svg viewBox="0 0 80 120" width="56" height="84" xmlns="http://www.w3.org/2000/svg">
      {/* Top figure */}
      <g>
        <OberHalf color={color} />
      </g>
      {/* Bottom figure — rotated 180° around card center */}
      <g transform="rotate(180 40 60)">
        <OberHalf color={color} />
      </g>
    </svg>
  );
}

export default OberFace;
