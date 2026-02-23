import type { Player, PlayerIndex, Trick } from '@dabb/shared-types';

import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  players: Player[];
  winnerPlayerIndex?: PlayerIndex | null;
}

const CARD_ROTATIONS = [-4, 3, -2, 5];

function TrickArea({ trick, players, winnerPlayerIndex }: TrickAreaProps) {
  return (
    <div className="trick-area">
      {trick.cards.map((playedCard, index) => (
        <div
          key={`${playedCard.playerIndex}-${playedCard.card.id}`}
          className="trick-card-wrapper"
          style={
            {
              textAlign: 'center',
              '--card-rotation': `${CARD_ROTATIONS[index % 4]}deg`,
            } as React.CSSProperties
          }
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
    </div>
  );
}

export default TrickArea;
