interface BuabeFaceProps {
  color: string;
}

// Top half of the double-headed Buabe — round cap, holds a short sword
function BuabeHalf({ color }: { color: string }) {
  return (
    <>
      {/* Round cap */}
      <ellipse cx="40" cy="16" rx="12" ry="9" fill={color} />
      <ellipse cx="40" cy="23" rx="15" ry="4" fill={color} />
      {/* Cap button */}
      <circle cx="40" cy="9" r="2.5" fill="#D4A520" />

      {/* Head — rounder, younger */}
      <ellipse cx="40" cy="33" rx="11" ry="12" fill="#F5E6D3" stroke={color} strokeWidth="1" />
      {/* Eyes */}
      <circle cx="36" cy="29" r="1.5" fill="#2A1A0A" />
      <circle cx="44" cy="29" r="1.5" fill="#2A1A0A" />
      {/* Cheeky grin */}
      <path d="M35,37 Q40,42 45,37" fill="none" stroke={color} strokeWidth="1.5" />

      {/* Jacket body — simpler, less regal */}
      <polygon points="27,46 53,46 57,60 23,60" fill="#8B2020" stroke="#6B1010" strokeWidth="1" />
      {/* Gold buttons down center */}
      <circle cx="40" cy="50" r="1.5" fill="#D4A520" />
      <circle cx="40" cy="55" r="1.5" fill="#D4A520" />
      {/* Blue collar */}
      <polygon points="33,46 47,46 44,52 36,52" fill="#2244AA" />

      {/* Right arm: short sword held upright */}
      <line x1="60" y1="58" x2="60" y2="42" stroke="#AAAAAA" strokeWidth="2.5" />
      {/* Cross-guard */}
      <line x1="56" y1="50" x2="64" y2="50" stroke="#8B6914" strokeWidth="2" />
      {/* Sword pommel */}
      <circle cx="60" cy="41" r="2.5" fill="#D4A520" />

      {/* Left arm: shield (small heraldic diamond) */}
      <polygon points="20,42 16,52 20,62 24,52" fill="#2244AA" stroke={color} strokeWidth="1" />
      <polygon points="20,46 17,52 20,58 23,52" fill="#CC2222" />
    </>
  );
}

function BuabeFace({ color }: BuabeFaceProps) {
  return (
    <svg viewBox="0 0 80 120" width="56" height="84" xmlns="http://www.w3.org/2000/svg">
      {/* Top figure */}
      <g>
        <BuabeHalf color={color} />
      </g>
      {/* Bottom figure — rotated 180° around card center */}
      <g transform="rotate(180 40 60)">
        <BuabeHalf color={color} />
      </g>
    </svg>
  );
}

export default BuabeFace;
