interface OberFaceProps {
  color: string;
}

function OberFace({ color }: OberFaceProps) {
  return (
    <svg viewBox="0 0 80 120" width="56" height="84" xmlns="http://www.w3.org/2000/svg">
      {/* Wide-brimmed hat */}
      <ellipse cx="40" cy="14" rx="20" ry="4" fill={color} />
      <ellipse cx="40" cy="12" rx="11" ry="6" fill={color} />
      {/* Amber feather */}
      <path d="M52,10 Q62,4 58,16 Q54,12 52,10" fill="#d4890a" stroke="#b87000" strokeWidth="1" />

      {/* Head */}
      <ellipse cx="40" cy="30" rx="10" ry="11" fill="#faf8f2" stroke={color} strokeWidth="2" />
      {/* Eyes */}
      <circle cx="36" cy="28" r="1.5" fill={color} />
      <circle cx="44" cy="28" r="1.5" fill={color} />
      {/* Mouth */}
      <path d="M37,34 Q40,37 43,34" stroke={color} strokeWidth="1.5" fill="none" />

      {/* Body */}
      <polygon points="30,42 50,42 52,90 28,90" fill="#faf8f2" stroke={color} strokeWidth="2" />

      {/* Amber belt-sash */}
      <rect x="28" y="60" width="24" height="5" fill="#d4890a" stroke="#b87000" strokeWidth="1" />

      {/* Flower (4 petals) in left hand */}
      <ellipse
        cx="22"
        cy="68"
        rx="4"
        ry="2"
        fill={color}
        opacity="0.7"
        transform="rotate(-45 22 68)"
      />
      <ellipse
        cx="22"
        cy="68"
        rx="4"
        ry="2"
        fill={color}
        opacity="0.7"
        transform="rotate(45 22 68)"
      />
      <ellipse cx="22" cy="68" rx="4" ry="2" fill={color} opacity="0.7" />
      <ellipse cx="22" cy="68" rx="2" ry="4" fill={color} opacity="0.7" />
      <circle cx="22" cy="68" r="2.5" fill="#d4890a" />
      <line x1="22" y1="70" x2="30" y2="65" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default OberFace;
