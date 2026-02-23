interface KoenigFaceProps {
  color: string;
}

function KoenigFace({ color }: KoenigFaceProps) {
  return (
    <svg viewBox="0 0 80 120" width="56" height="84" xmlns="http://www.w3.org/2000/svg">
      {/* Crown */}
      <path
        d="M26,22 L26,10 L35,18 L40,8 L45,18 L54,10 L54,22 Z"
        fill="#d4890a"
        stroke={color}
        strokeWidth="1.5"
      />
      <rect x="24" y="20" width="32" height="4" fill="#d4890a" stroke={color} strokeWidth="1" />

      {/* Head */}
      <ellipse cx="40" cy="32" rx="12" ry="11" fill="#faf8f2" stroke={color} strokeWidth="2" />
      {/* Eyes */}
      <circle cx="35" cy="30" r="1.5" fill={color} />
      <circle cx="45" cy="30" r="1.5" fill={color} />
      {/* Mouth */}
      <path d="M36,36 Q40,39 44,36" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Beard */}
      <path d="M30,37 Q40,44 50,37" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Body — trapezoid */}
      <polygon points="28,44 52,44 56,90 24,90" fill="#faf8f2" stroke={color} strokeWidth="2" />
      {/* Robe lines */}
      <line x1="40" y1="44" x2="40" y2="90" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="33" y1="55" x2="47" y2="55" stroke={color} strokeWidth="1" opacity="0.4" />

      {/* Scepter */}
      <line x1="58" y1="88" x2="58" y2="48" stroke={color} strokeWidth="2" />
      <circle cx="58" cy="46" r="4" fill="#d4890a" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default KoenigFace;
