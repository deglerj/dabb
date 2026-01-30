import type { Suit } from '@dabb/shared-types';

import kreuzUrl from '@dabb/card-assets/suits/kreuz.svg?url';
import schippeUrl from '@dabb/card-assets/suits/schippe.svg?url';
import herzUrl from '@dabb/card-assets/suits/herz.svg?url';
import bollenUrl from '@dabb/card-assets/suits/bollen.svg?url';

const SUIT_ICONS: Record<Suit, string> = {
  kreuz: kreuzUrl,
  schippe: schippeUrl,
  herz: herzUrl,
  bollen: bollenUrl,
};

interface SuitIconProps {
  suit: Suit;
  size?: number;
  className?: string;
}

function SuitIcon({ suit, size = 24, className }: SuitIconProps) {
  return (
    <img
      src={SUIT_ICONS[suit]}
      alt={suit}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

export default SuitIcon;
