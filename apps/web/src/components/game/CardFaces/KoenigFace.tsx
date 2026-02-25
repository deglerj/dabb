interface KoenigFaceProps {
  color: string;
}

// Top half of the double-headed König — rotated 180° at the bottom for bilateral symmetry
function KoenigHalf({ color }: { color: string }) {
  return (
    <>
      {/* Crown */}
      <path
        d="M20,22 L20,9 L29,17 L40,7 L51,17 L60,9 L60,22Z"
        fill="#D4A520"
        stroke="#8B6914"
        strokeWidth="1"
      />
      <rect
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
      <circle cx="40" cy="16" r="2.5" fill="#CC2222" />
      <circle cx="28" cy="19" r="1.5" fill="#3366CC" />
      <circle cx="52" cy="19" r="1.5" fill="#3366CC" />

      {/* Head */}
      <ellipse cx="40" cy="33" rx="12" ry="11" fill="#F5E6D3" stroke={color} strokeWidth="1" />
      {/* Hair / sideburns */}
      <path
        d="M28,29 Q25,37 28,43"
        fill="none"
        stroke="#6B4422"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M52,29 Q55,37 52,43"
        fill="none"
        stroke="#6B4422"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Eyes */}
      <circle cx="36" cy="30" r="1.5" fill="#2A1A0A" />
      <circle cx="44" cy="30" r="1.5" fill="#2A1A0A" />
      {/* Moustache + beard */}
      <path d="M34,36 Q40,40 46,36" fill="none" stroke="#6B4422" strokeWidth="1.5" />
      <path d="M32,40 Q40,46 48,40" fill="none" stroke="#6B4422" strokeWidth="1.5" />

      {/* Robe body */}
      <polygon points="22,45 58,45 62,60 18,60" fill="#2244AA" stroke="#1A3388" strokeWidth="1" />
      {/* Red cape half */}
      <polygon points="22,45 40,45 40,56 18,52" fill="#CC2222" />
      {/* Gold center stripe */}
      <line x1="40" y1="45" x2="40" y2="60" stroke="#D4A520" strokeWidth="2" />

      {/* Left hand: orb scepter */}
      <line x1="15" y1="58" x2="15" y2="42" stroke="#888" strokeWidth="2.5" />
      <circle cx="15" cy="40" r="5" fill="#D4A520" stroke="#8B6914" strokeWidth="1" />
      <circle cx="15" cy="40" r="2" fill="#CC2222" />

      {/* Right hand: sword */}
      <line x1="65" y1="57" x2="65" y2="42" stroke="#AAAAAA" strokeWidth="2.5" />
      <line x1="61" y1="51" x2="69" y2="51" stroke="#8B6914" strokeWidth="2" />
    </>
  );
}

function KoenigFace({ color }: KoenigFaceProps) {
  return (
    <svg viewBox="0 0 80 120" width="56" height="84" xmlns="http://www.w3.org/2000/svg">
      {/* Top figure */}
      <g>
        <KoenigHalf color={color} />
      </g>
      {/* Bottom figure — rotated 180° around card center */}
      <g transform="rotate(180 40 60)">
        <KoenigHalf color={color} />
      </g>
    </svg>
  );
}

export default KoenigFace;
