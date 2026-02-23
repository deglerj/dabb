interface BuabeFaceProps {
  color: string;
}

function BuabeFace({ color }: BuabeFaceProps) {
  return (
    <svg viewBox="0 0 80 120" width="56" height="84" xmlns="http://www.w3.org/2000/svg">
      {/* Round cap */}
      <ellipse cx="40" cy="20" rx="13" ry="9" fill={color} />
      <ellipse cx="40" cy="27" rx="15" ry="3" fill={color} />

      {/* Head — rounder */}
      <ellipse cx="40" cy="36" rx="11" ry="12" fill="#faf8f2" stroke={color} strokeWidth="2" />
      {/* Eyes */}
      <circle cx="36" cy="33" r="1.5" fill={color} />
      <circle cx="44" cy="33" r="1.5" fill={color} />
      {/* Cheeky grin */}
      <path d="M35,40 Q40,44 45,40" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Body — shorter, casual */}
      <polygon points="31,49 49,49 51,90 29,90" fill="#faf8f2" stroke={color} strokeWidth="2" />
      {/* Diagonal clothing lines for casual lean */}
      <line x1="33" y1="55" x2="40" y2="65" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="37" y1="52" x2="44" y2="62" stroke={color} strokeWidth="1" opacity="0.4" />

      {/* Diamond-shield at side */}
      <polygon points="58,60 64,68 58,76 52,68" fill="none" stroke={color} strokeWidth="1.5" />
      <line x1="56" y1="60" x2="51" y2="62" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default BuabeFace;
