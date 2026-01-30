import type { Card as CardType, Suit, Rank } from '@dabb/shared-types';
import { isHiddenCard } from '@dabb/game-logic';

interface CardProps {
  card: CardType;
  selected?: boolean;
  valid?: boolean;
  onClick?: () => void;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  kreuz: '♣',
  schippe: '♠',
  herz: '❤️',
  bollen: '♦',
};

const RANK_DISPLAY: Record<Rank, string> = {
  buabe: 'U',
  ober: 'O',
  koenig: 'K',
  '10': '10',
  ass: 'A',
};

function Card({ card, selected = false, valid = true, onClick }: CardProps) {
  if (isHiddenCard(card)) {
    return (
      <div
        className="playing-card"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2942 100%)',
          color: '#4a7eb8',
        }}
      >
        <span style={{ fontSize: '2rem' }}>🃏</span>
      </div>
    );
  }

  const isRed = card.suit === 'herz' || card.suit === 'bollen';

  return (
    <div
      className={`playing-card ${card.suit} ${selected ? 'selected' : ''}`}
      onClick={valid ? onClick : undefined}
      style={{
        filter: valid ? 'none' : 'grayscale(100%) brightness(0.7)',
        cursor: valid && onClick ? 'pointer' : 'default',
        color: isRed ? '#dc2626' : '#1e3a5f',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '1.5rem' }}>{SUIT_SYMBOLS[card.suit]}</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{RANK_DISPLAY[card.rank]}</span>
      </div>
    </div>
  );
}

export default Card;
