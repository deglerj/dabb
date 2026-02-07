import type { Player, PlayerIndex, Trick } from '@dabb/shared-types';

import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  playerCount: number;
  players: Player[];
  winnerPlayerIndex?: PlayerIndex | null;
}

function TrickArea({ trick, playerCount, players, winnerPlayerIndex }: TrickAreaProps) {
  const positions = getPositions(playerCount);

  return (
    <div className="trick-area">
      {trick.cards.map((playedCard) => (
        <div
          key={playedCard.cardId}
          style={{
            position: 'relative',
            textAlign: 'center',
            ...positions[playedCard.playerIndex],
          }}
        >
          <Card
            card={playedCard.card}
            winner={
              winnerPlayerIndex !== null &&
              winnerPlayerIndex !== undefined &&
              playedCard.playerIndex === winnerPlayerIndex
            }
          />
          <div className="trick-area-player-name">
            {players.find((p) => p.playerIndex === playedCard.playerIndex)?.nickname}
          </div>
        </div>
      ))}

      {trick.cards.length === 0 && (
        <span style={{ color: 'var(--text-secondary)' }}>Warte auf erste Karte...</span>
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
