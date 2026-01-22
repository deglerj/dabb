import type { GameState, PlayerIndex } from '@dabb/shared-types';

interface ScoreBoardProps {
  state: GameState;
  currentPlayerIndex: PlayerIndex | null;
}

function ScoreBoard({ state, currentPlayerIndex }: ScoreBoardProps) {
  return (
    <div className="scoreboard">
      {state.players.map(player => {
        const score = state.totalScores.get(player.playerIndex) || 0;
        const isCurrent = player.playerIndex === currentPlayerIndex;

        return (
          <div
            key={player.playerIndex}
            className={`player-info ${isCurrent ? 'current' : ''}`}
          >
            <div>{player.nickname}</div>
            <div className="score">{score}</div>
            {player.playerIndex === state.bidWinner && state.phase !== 'waiting' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                Gebot: {state.currentBid}
              </div>
            )}
            {!player.connected && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                (Getrennt)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ScoreBoard;
