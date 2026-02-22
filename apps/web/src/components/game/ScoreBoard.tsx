import { useState } from 'react';
import type { GameState, GameEvent, PlayerIndex, Team } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useRoundHistory } from '@dabb/ui-shared';
import { ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';

interface ScoreBoardProps {
  state: GameState;
  events: GameEvent[];
  currentPlayerIndex: PlayerIndex | null;
  onExitClick?: () => void;
}

function ScoreBoard({ state, events, currentPlayerIndex, onExitClick }: ScoreBoardProps) {
  const { t } = useTranslation();
  const { rounds, currentRound, gameWinner } = useRoundHistory(events);

  // Default to collapsed on mobile (< 768px)
  const [isExpanded, setIsExpanded] = useState(() => window.innerWidth >= 768);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  // Get player/team name for display
  const getName = (playerOrTeam: PlayerIndex | Team): string => {
    if (state.playerCount === 4) {
      const teamPlayers = state.players.filter((p) => p.team === playerOrTeam);
      if (teamPlayers.length > 0) {
        return teamPlayers.map((p) => p.nickname).join(' & ');
      }
    }
    const player = state.players.find((p) => p.playerIndex === playerOrTeam);
    if (player) {
      return player.nickname;
    }
    return `Team ${(playerOrTeam as number) + 1}`;
  };

  // Get scoring entities (players or teams depending on game mode)
  const scoringEntities = Array.from(state.totalScores.keys());

  // Get meld score for a scoring entity (team or player)
  const getMeldForEntity = (entity: PlayerIndex | Team): number | undefined => {
    if (state.playerCount === 4) {
      const members = state.players.filter((p) => p.team === entity);
      const vals = members.map((p) => currentRound?.meldScores?.[p.playerIndex]);
      if (vals.every((v) => v === undefined)) {
        return undefined;
      }
      return vals.reduce((sum: number, v) => sum + (v ?? 0), 0);
    }
    return currentRound?.meldScores?.[entity as PlayerIndex];
  };

  return (
    <div className={`scoreboard ${isExpanded ? 'expanded' : ''}`}>
      {/* Header - always visible */}
      <div className="scoreboard-header" onClick={toggleExpanded}>
        <div className="scoreboard-players">
          {state.playerCount === 4
            ? ([0, 1] as Team[]).map((team) => {
                const teamPlayers = state.players.filter((p) => p.team === team);
                const teamScore = state.totalScores.get(team) ?? 0;
                const isBidWinnerTeam =
                  teamPlayers.some((p) => p.playerIndex === state.bidWinner) &&
                  state.phase !== 'waiting';
                const isCurrentTeam = teamPlayers.some((p) => p.playerIndex === currentPlayerIndex);
                const memberNames = teamPlayers.map((p) => p.nickname).join(' & ');
                return (
                  <div key={team} className={`player-info ${isCurrentTeam ? 'current' : ''}`}>
                    <div className="player-name">
                      Team {team + 1}
                      <br />
                      <small>{memberNames}</small>
                    </div>
                    <div className="score">{teamScore}</div>
                    {isBidWinnerTeam && (
                      <div className="bid-info">
                        {t('game.bid')}: {state.currentBid}
                      </div>
                    )}
                  </div>
                );
              })
            : state.players.map((player) => {
                const score = state.totalScores.get(player.playerIndex) ?? 0;
                const isCurrent = player.playerIndex === currentPlayerIndex;
                const isBidWinner =
                  player.playerIndex === state.bidWinner && state.phase !== 'waiting';

                return (
                  <div
                    key={player.playerIndex}
                    className={`player-info ${isCurrent ? 'current' : ''}`}
                  >
                    <div className="player-name">{player.nickname}</div>
                    <div className="score">{score}</div>
                    {isBidWinner && (
                      <div className="bid-info">
                        {t('game.bid')}: {state.currentBid}
                      </div>
                    )}
                    {!player.connected && (
                      <div className="disconnected-info">({t('common.disconnected')})</div>
                    )}
                  </div>
                );
              })}
        </div>

        <div className="scoreboard-actions">
          <button className="scoreboard-toggle" type="button">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{' '}
            {isExpanded ? t('game.hideHistory') : t('game.showHistory')}
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <LanguageSwitcher />
          </div>
          {onExitClick && (
            <button
              className="exit-button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExitClick();
              }}
            >
              <LogOut size={16} /> {t('game.exitGame')}
            </button>
          )}
        </div>
      </div>

      {/* Game winner banner */}
      {gameWinner !== null && (
        <div className="game-winner-banner">
          {t('game.gameWinner')}: <strong>{getName(gameWinner)}</strong>
        </div>
      )}

      {/* Expanded history table */}
      {isExpanded && (rounds.length > 0 || currentRound) && (
        <div className="scoreboard-history">
          <table>
            <thead>
              <tr>
                <th>{t('game.round')}</th>
                {scoringEntities.map((entity) => (
                  <th key={entity}>{getName(entity)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.round} className={round.scores ? '' : 'round-in-progress'}>
                  <td className="round-cell">
                    <div className="round-number">{round.round}</div>
                    {round.bidWinner !== null && (
                      <div className="round-bid">
                        {getName(round.bidWinner)}: {round.winningBid}
                      </div>
                    )}
                  </td>
                  {scoringEntities.map((entity) => {
                    const scoreData = round.scores?.[entity];
                    if (!scoreData) {
                      return (
                        <td key={entity} className="score-cell">
                          -
                        </td>
                      );
                    }
                    return (
                      <td
                        key={entity}
                        className={`score-cell ${!scoreData.bidMet ? 'bid-not-met' : ''}`}
                      >
                        <div className="score-total">{scoreData.total}</div>
                        {scoreData.bidMet && (
                          <div className="score-breakdown">
                            {t('game.melds')}: {scoreData.melds} | {t('game.tricks')}:{' '}
                            {scoreData.tricks}
                          </div>
                        )}
                        {!scoreData.bidMet && (
                          <div className="bid-failed">{t('game.bidNotMet')}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Active round row */}
              {currentRound && currentRound.bidWinner !== null && (
                <tr className="round-in-progress">
                  <td className="round-cell">
                    <div className="round-number">{currentRound.round}</div>
                    <div className="round-bid">
                      {getName(currentRound.bidWinner)}: {currentRound.winningBid}
                    </div>
                  </td>
                  {scoringEntities.map((entity) => {
                    const meldScore = getMeldForEntity(entity);
                    if (meldScore === undefined) {
                      return (
                        <td key={entity} className="score-cell">
                          -
                        </td>
                      );
                    }
                    return (
                      <td key={entity} className="score-cell">
                        <div className="score-breakdown">
                          {t('game.melds')}: {meldScore}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <strong>{t('game.total')}</strong>
                </td>
                {scoringEntities.map((entity) => (
                  <td key={entity}>
                    <strong>{state.totalScores.get(entity) ?? 0}</strong>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Current round info when collapsed or no history yet */}
      {!isExpanded && currentRound && currentRound.bidWinner !== null && (
        <div className="current-round-info">
          {t('game.round')} {currentRound.round}: {getName(currentRound.bidWinner)} -{' '}
          {currentRound.winningBid}
        </div>
      )}
    </div>
  );
}

export default ScoreBoard;
