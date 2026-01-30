import type { Suit } from '@dabb/shared-types';
import { SUITS, SUIT_NAMES } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';

import SuitIcon from '../SuitIcon';

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
}

function TrumpSelector({ onSelect }: TrumpSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3>{t('game.chooseTrump')}</h3>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
        {SUITS.map((suit) => (
          <button
            key={suit}
            onClick={() => onSelect(suit)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: '80px',
              padding: '0.75rem',
            }}
          >
            <SuitIcon suit={suit} size={40} />
            <span>{SUIT_NAMES[suit]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TrumpSelector;
