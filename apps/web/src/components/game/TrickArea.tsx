import type { Trick, PlayerIndex, Card as CardType } from '@dabb/shared-types';

import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  playerCount: number;
  resolveCard: (cardId: string, playerIndex: PlayerIndex) => CardType | undefined;
}

function TrickArea({ trick, playerCount, resolveCard }: TrickAreaProps) {
  const positions = getPositions(playerCount);

  return (
    <div className="trick-area">
      {trick.cards.map((playedCard) => {
        const card = resolveCard(playedCard.cardId, playedCard.playerIndex);
        if (!card) {return null;}

        return (
          <div
            key={playedCard.cardId}
            style={{
              position: 'relative',
              ...positions[playedCard.playerIndex],
            }}
          >
            <Card card={card} />
          </div>
        );
      })}

      {trick.cards.length === 0 && (
        <span style={{ color: 'var(--text-secondary)' }}>
          Warte auf erste Karte...
        </span>
      )}
    </div>
  );
}

function getPositions(playerCount: number): Record<number, React.CSSProperties> {
  if (playerCount === 4) {
    return {
      0: { bottom: 0 },
      1: { left: -60 },
      2: { top: 0 },
      3: { right: -60 },
    };
  }

  // 2 or 3 players - simpler layout
  return {
    0: { bottom: 0 },
    1: { left: -40 },
    2: { top: 0 },
  };
}

export default TrickArea;
