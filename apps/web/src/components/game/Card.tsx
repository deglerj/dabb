import type { Card as CardType, Rank } from '@dabb/shared-types';
import { isHiddenCard } from '@dabb/game-logic';
import SuitIcon from '../SuitIcon';

interface CardProps {
  card: CardType;
  selected?: boolean;
  valid?: boolean;
  winner?: boolean;
  dabb?: boolean;
  onClick?: () => void;
}

const RANK_DISPLAY: Record<Rank, string> = {
  buabe: 'U',
  ober: 'O',
  koenig: 'K',
  '10': '10',
  ass: 'A',
};

function Card({
  card,
  selected = false,
  valid = true,
  winner = false,
  dabb = false,
  onClick,
}: CardProps) {
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
      className={`playing-card ${card.suit} ${selected ? 'selected' : ''} ${winner ? 'winner' : ''} ${dabb ? 'dabb' : ''}`}
      onClick={valid ? onClick : undefined}
      style={{
        filter: valid ? 'none' : 'grayscale(100%) brightness(0.7)',
        cursor: valid && onClick ? 'pointer' : 'default',
        color: isRed ? '#dc2626' : '#1e3a5f',
        zIndex: valid ? 1 : 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <SuitIcon suit={card.suit} size={32} />
        <span className="card-rank">{RANK_DISPLAY[card.rank]}</span>
      </div>
    </div>
  );
}

export default Card;
