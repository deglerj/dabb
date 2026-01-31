import { useState } from 'react';
import type { GameState, GameEvent, PlayerIndex, GameLogEntry, Meld } from '@dabb/shared-types';
import { formatMeldName, SUIT_NAMES, RANK_NAMES } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useGameLog } from '@dabb/ui-shared';

interface GameLogProps {
  state: GameState;
  events: GameEvent[];
  currentPlayerIndex: PlayerIndex | null;
}

function GameLog({ state, events, currentPlayerIndex }: GameLogProps) {
  const { t } = useTranslation();
  const { entries, latestEntries, isYourTurn } = useGameLog(events, state, currentPlayerIndex);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMelds, setExpandedMelds] = useState<Set<string>>(new Set());

  const displayEntries = isExpanded ? entries : latestEntries;
  const hasMoreEntries = entries.length > latestEntries.length;

  const toggleMelds = (entryId: string) => {
    setExpandedMelds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const getPlayerName = (playerIndex: PlayerIndex | null): string => {
    if (playerIndex === null) {
      return '';
    }
    const player = state.players.find((p) => p.playerIndex === playerIndex);
    return player?.nickname || `Player ${playerIndex + 1}`;
  };

  const formatCard = (card: { suit: string; rank: string }): string => {
    const suitName = SUIT_NAMES[card.suit as keyof typeof SUIT_NAMES] || card.suit;
    const rankName = RANK_NAMES[card.rank as keyof typeof RANK_NAMES] || card.rank;
    return `${rankName} ${suitName}`;
  };

  const formatMelds = (melds: Meld[]): string => {
    return melds.map((m) => `${formatMeldName(m, SUIT_NAMES)} (${m.points})`).join(', ');
  };

  const renderEntryMessage = (entry: GameLogEntry): React.ReactNode => {
    const name = getPlayerName(entry.playerIndex);

    switch (entry.data.kind) {
      case 'game_started':
        return t('gameLog.gameStarted', {
          playerCount: entry.data.playerCount,
          targetScore: entry.data.targetScore,
        });

      case 'round_started':
        return t('gameLog.roundStarted', { round: entry.data.round });

      case 'bid_placed':
        return t('gameLog.bidPlaced', { name, amount: entry.data.amount });

      case 'player_passed':
        return t('gameLog.playerPassed', { name });

      case 'bidding_won':
        return t('gameLog.biddingWon', { name, bid: entry.data.winningBid });

      case 'trump_declared': {
        const suitName = SUIT_NAMES[entry.data.suit as keyof typeof SUIT_NAMES] || entry.data.suit;
        return t('gameLog.trumpDeclared', { name, suit: suitName });
      }

      case 'melds_declared': {
        if (entry.data.totalPoints === 0) {
          return t('gameLog.meldsNone', { name });
        }
        const hasMelds = entry.data.melds.length > 0;
        const isOpen = expandedMelds.has(entry.id);
        return (
          <span>
            {t('gameLog.meldsDeclared', { name, points: entry.data.totalPoints })}
            {hasMelds && (
              <>
                <button
                  className="game-log-meld-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMelds(entry.id);
                  }}
                >
                  {isOpen ? '-' : '+'}
                </button>
                {isOpen && (
                  <div className="game-log-meld-details">{formatMelds(entry.data.melds)}</div>
                )}
              </>
            )}
          </span>
        );
      }

      case 'card_played':
        return t('gameLog.cardPlayed', { name, card: formatCard(entry.data.card) });

      case 'trick_won':
        return t('gameLog.trickWon', { name, points: entry.data.points });

      case 'round_scored':
        return t('gameLog.roundScored');

      case 'game_finished': {
        const winnerName =
          typeof entry.data.winner === 'number'
            ? getPlayerName(entry.data.winner as PlayerIndex)
            : `Team ${(entry.data.winner as number) + 1}`;
        return t('gameLog.gameFinished', { name: winnerName });
      }

      case 'game_terminated':
        return t('gameLog.gameTerminated', { name });

      default:
        return '';
    }
  };

  const getEntryClass = (entry: GameLogEntry): string => {
    switch (entry.data.kind) {
      case 'bidding_won':
      case 'trick_won':
      case 'game_finished':
        return 'game-log-entry highlight';
      case 'round_scored':
        return 'game-log-entry success';
      case 'game_terminated':
        return 'game-log-entry error';
      default:
        return 'game-log-entry';
    }
  };

  if (entries.length === 0 && !isYourTurn) {
    return null;
  }

  return (
    <div className="game-log">
      <div className="game-log-header">
        <span className="game-log-title">{t('gameLog.title')}</span>
        {hasMoreEntries && (
          <button
            className="game-log-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            {isExpanded ? t('gameLog.showLess') : t('gameLog.showMore')}
          </button>
        )}
      </div>

      {isYourTurn && <div className="game-log-turn-banner">{t('gameLog.yourTurn')}</div>}

      <div className={`game-log-entries ${isExpanded ? 'expanded' : ''}`}>
        {displayEntries.length === 0 ? (
          <div className="game-log-empty">{t('gameLog.noEntries')}</div>
        ) : (
          displayEntries.map((entry) => (
            <div key={entry.id} className={getEntryClass(entry)}>
              {renderEntryMessage(entry)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GameLog;
