import type { Suit } from '@dabb/shared-types';
import { SUITS, SUIT_NAMES } from '@dabb/shared-types';

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
}

const SUIT_COLORS: Record<Suit, string> = {
  kreuz: '#8B4513',
  schippe: '#228B22',
  herz: '#dc2626',
  bollen: '#FFD700',
};

function TrumpSelector({ onSelect }: TrumpSelectorProps) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3>Trumpf wählen</h3>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
        {SUITS.map(suit => (
          <button
            key={suit}
            onClick={() => onSelect(suit)}
            style={{
              background: SUIT_COLORS[suit],
              minWidth: '80px',
            }}
          >
            {SUIT_NAMES[suit]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TrumpSelector;
