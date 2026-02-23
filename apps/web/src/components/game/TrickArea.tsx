import { useRef, useEffect } from 'react';
import type { Player, PlayerIndex, Trick } from '@dabb/shared-types';

import Card from './Card';

interface TrickAreaProps {
  trick: Trick;
  players: Player[];
  winnerPlayerIndex?: PlayerIndex | null;
}

const CARD_ROTATIONS = [-4, 3, -2, 5];

function TrickArea({ trick, players, winnerPlayerIndex }: TrickAreaProps) {
  // Track which card keys were visible in the previous render so only newly
  // added cards get the play-in animation (not already-visible ones).
  const seenCardKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenCardKeysRef.current = new Set(trick.cards.map((c) => `${c.playerIndex}-${c.card.id}`));
  }, [trick.cards]);

  return (
    <div className="trick-area">
      {trick.cards.map((playedCard, index) => {
        const cardKey = `${playedCard.playerIndex}-${playedCard.card.id}`;
        const isNew = !seenCardKeysRef.current.has(cardKey);
        return (
          <div
            key={cardKey}
            className={`trick-card-wrapper${isNew ? ' trick-card-wrapper--new' : ''}`}
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
        );
      })}
    </div>
  );
}

export default TrickArea;
