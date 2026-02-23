import type { Card as CardType, Rank } from '@dabb/shared-types';
import { isHiddenCard } from '@dabb/game-logic';
import SuitIcon from '../SuitIcon';
import KoenigFace from './CardFaces/KoenigFace';
import OberFace from './CardFaces/OberFace';
import BuabeFace from './CardFaces/BuabeFace';

interface CardProps {
  card: CardType;
  selected?: boolean;
  valid?: boolean;
  winner?: boolean;
  trump?: boolean;
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
  trump = false,
  dabb = false,
  onClick,
}: CardProps) {
  if (isHiddenCard(card)) {
    return (
      <div
        className="playing-card"
        style={{
          background: `
            repeating-linear-gradient(
              45deg,
              rgba(200, 120, 50, 0.25) 0px,
              rgba(200, 120, 50, 0.25) 1px,
              transparent 1px,
              transparent 8px
            ),
            repeating-linear-gradient(
              -45deg,
              rgba(200, 120, 50, 0.25) 0px,
              rgba(200, 120, 50, 0.25) 1px,
              transparent 1px,
              transparent 8px
            ),
            #5c2e0a
          `,
          cursor: 'default',
        }}
      />
    );
  }

  const isRed = card.suit === 'herz' || card.suit === 'bollen';
  const suitColor = isRed ? 'var(--card-red)' : 'var(--card-black)';

  return (
    <div
      className={`playing-card ${card.suit} ${selected ? 'selected' : ''} ${winner ? 'winner' : ''} ${trump ? 'trump' : ''} ${dabb ? 'dabb' : ''}`}
      onClick={valid ? onClick : undefined}
      style={{
        filter: valid ? 'none' : 'grayscale(100%) brightness(0.7)',
        cursor: valid && onClick ? 'pointer' : 'default',
        color: isRed ? 'var(--card-red)' : 'var(--card-black)',
        // Highlighted cards get a higher z-index so their glow isn't clipped by adjacent overlapping cards
        zIndex: winner || trump || dabb ? 2 : valid ? 1 : 0,
      }}
    >
      {/* Top-left corner */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: 4,
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        <div
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: '0.7rem',
            fontWeight: 'normal',
          }}
        >
          {RANK_DISPLAY[card.rank]}
        </div>
        <SuitIcon suit={card.suit} size={10} />
      </div>

      {/* Center */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {card.rank === 'koenig' && <KoenigFace color={suitColor} />}
        {card.rank === 'ober' && <OberFace color={suitColor} />}
        {card.rank === 'buabe' && <BuabeFace color={suitColor} />}
        {card.rank === 'ass' && <SuitIcon suit={card.suit} size={44} />}
        {card.rank === '10' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span
              style={{
                fontFamily: "'IM Fell English SC', serif",
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
            >
              10
            </span>
            <SuitIcon suit={card.suit} size={28} />
          </div>
        )}
      </div>

      {/* Bottom-right corner */}
      <div
        style={{
          position: 'absolute',
          bottom: 3,
          right: 4,
          textAlign: 'center',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <div
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: '0.7rem',
            fontWeight: 'normal',
          }}
        >
          {RANK_DISPLAY[card.rank]}
        </div>
        <SuitIcon suit={card.suit} size={10} />
      </div>
    </div>
  );
}

export default Card;
