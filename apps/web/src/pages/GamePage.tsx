import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Card, CardId, PlayerIndex, Suit } from '@dabb/shared-types';
import { DABB_SIZE, formatMeldName, SUITS, SUIT_NAMES } from '@dabb/shared-types';
import { detectMelds, calculateMeldPoints } from '@dabb/game-logic';
import { useTrickDisplay } from '@dabb/ui-shared';
import { useTranslation } from '@dabb/i18n';
import { Hand, Trash2, Check, LogOut, Home } from 'lucide-react';

import { useGame } from '../hooks/useGame';
import { useTurnNotification } from '../hooks/useTurnNotification';
import PlayerHand from '../components/game/PlayerHand';
import BiddingPanel from '../components/game/BiddingPanel';
import TrumpSelector from '../components/game/TrumpSelector';
import TrickArea from '../components/game/TrickArea';
import ScoreBoard from '../components/game/ScoreBoard';
import GameLog from '../components/game/GameLog';
import SuitIcon from '../components/SuitIcon';
import ConfirmModal from '../components/ConfirmModal';
import GameTerminatedModal from '../components/game/GameTerminatedModal';
import CelebrationOverlay from '../components/game/CelebrationOverlay';

function GamePage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const game = useGame(code || '');
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [goOutConfirmSuit, setGoOutConfirmSuit] = useState<Suit | null>(null);

  const {
    state,
    events,
    playerIndex,
    isMyTurn,
    validMoves,
    error,
    connected,
    isTerminated,
    terminationInfo,
  } = game;

  const myHand = state.hands.get(playerIndex as PlayerIndex) || [];
  const dabbSize = DABB_SIZE[state.playerCount];

  // Play notification sound when it's the player's turn
  useTurnNotification(state, playerIndex as PlayerIndex);

  // Manage trick display with 4-second pause after completion
  const { displayTrick, winnerPlayerIndex, isTrickPaused } = useTrickDisplay(
    state.currentTrick,
    state.lastCompletedTrick,
    state.phase
  );

  // Check if we can show the exit button (only during active game phases)
  const activePhases = ['dealing', 'bidding', 'dabb', 'trump', 'melding', 'tricks', 'scoring'];
  const canExit = activePhases.includes(state.phase);

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  const handleExitConfirm = () => {
    game.exitGame();
    setShowExitConfirm(false);
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoOutClick = useCallback((suit: Suit) => {
    setGoOutConfirmSuit(suit);
  }, []);

  const handleGoOutConfirm = useCallback(() => {
    if (goOutConfirmSuit) {
      game.goOut(goOutConfirmSuit);
      setGoOutConfirmSuit(null);
    }
  }, [game, goOutConfirmSuit]);

  const handleGoOutCancel = useCallback(() => {
    setGoOutConfirmSuit(null);
  }, []);

  const handleDiscard = () => {
    if (selectedCards.length === dabbSize) {
      game.discard(selectedCards);
      setSelectedCards([]);
    }
  };

  const handleDeclareMelds = () => {
    if (state.trump) {
      const melds = detectMelds(myHand, state.trump);
      game.declareMelds(melds);
    }
  };

  if (!connected) {
    return (
      <div className="card" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <p>{t('game.connectingToServer')}</p>
      </div>
    );
  }

  return (
    <div className="game-board">
      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <ConfirmModal
          title={t('game.exitGameConfirmTitle')}
          message={t('game.exitGameConfirmMessage')}
          confirmLabel={t('game.exitGame')}
          onConfirm={handleExitConfirm}
          onCancel={handleExitCancel}
        />
      )}

      {/* Go out confirmation modal */}
      {goOutConfirmSuit && (
        <ConfirmModal
          title={t('game.goOutConfirmTitle')}
          message={t('game.goOutConfirmMessage')}
          confirmLabel={t('game.goOutIn', { suit: SUIT_NAMES[goOutConfirmSuit] })}
          onConfirm={handleGoOutConfirm}
          onCancel={handleGoOutCancel}
        />
      )}

      {/* Game terminated modal (shown when another player exits) */}
      {isTerminated && (
        <GameTerminatedModal
          terminatedBy={terminationInfo?.terminatedBy || null}
          onGoHome={handleGoHome}
        />
      )}

      {/* Celebration animations */}
      <CelebrationOverlay events={events} playerIndex={playerIndex as PlayerIndex} />

      {/* Top: Scoreboard */}
      <ScoreBoard
        state={state}
        events={events}
        currentPlayerIndex={state.currentPlayer}
        onExitClick={canExit ? handleExitClick : undefined}
      />

      {/* Game Log - sidebar on desktop, bottom overlay on mobile */}
      <GameLog state={state} events={events} currentPlayerIndex={playerIndex as PlayerIndex} />

      {/* Middle: Game area */}
      <div className="game-main">
        {/* Phase indicator */}
        <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <PhaseIndicator phase={state.phase} trump={state.trump} />
        </div>

        {/* Error message */}
        {error && (
          <p className="error" style={{ marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {/* Bidding phase */}
        {state.phase === 'bidding' && (
          <BiddingPanel
            currentBid={state.currentBid}
            isMyTurn={isMyTurn}
            onBid={game.bid}
            onPass={game.pass}
          />
        )}

        {/* Dabb phase */}
        {state.phase === 'dabb' && state.bidWinner === playerIndex && (
          <div className="card" style={{ textAlign: 'center' }}>
            {state.dabb.length > 0 ? (
              <>
                <h3>{t('game.takeDabb')}</h3>
                <button onClick={game.takeDabb} style={{ marginTop: '1rem' }}>
                  <Hand size={16} /> {t('game.takeDabbCards', { count: state.dabb.length })}
                </button>
              </>
            ) : (
              <>
                <h3>{t('game.discardCards')}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {t('game.selectCardsToDiscard', { count: dabbSize })}
                </p>
                <button onClick={handleDiscard} disabled={selectedCards.length !== dabbSize}>
                  <Trash2 size={16} />{' '}
                  {t('game.selectedCount', { selected: selectedCards.length, total: dabbSize })}
                </button>

                {/* Go Out option */}
                <div
                  style={{
                    marginTop: '1.5rem',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '1rem',
                  }}
                >
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {t('game.orGoOut')}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {SUITS.map((suit) => (
                      <button
                        key={suit}
                        onClick={() => handleGoOutClick(suit)}
                        className="secondary"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.25rem',
                          minWidth: '70px',
                          padding: '0.5rem',
                        }}
                      >
                        <LogOut size={16} />
                        <SuitIcon suit={suit} size={24} />
                        <span style={{ fontSize: '0.75rem' }}>{SUIT_NAMES[suit]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {state.phase === 'dabb' && state.bidWinner !== playerIndex && (
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('game.waitingForPlayer', {
              name: state.players.find((p) => p.playerIndex === state.bidWinner)?.nickname,
            })}
          </p>
        )}

        {/* Trump phase */}
        {state.phase === 'trump' && state.bidWinner === playerIndex && (
          <TrumpSelector onSelect={game.declareTrump} />
        )}

        {state.phase === 'trump' && state.bidWinner !== playerIndex && (
          <p style={{ color: 'var(--text-secondary)' }}>{t('game.waitingForTrump')}</p>
        )}

        {/* Melding phase */}
        {state.phase === 'melding' && (
          <div className="card" style={{ textAlign: 'center' }}>
            {!state.declaredMelds.has(playerIndex as PlayerIndex) ? (
              <>
                <h3>{t('game.declareMelds')}</h3>
                {state.trump && <MeldPreview hand={myHand} trump={state.trump} />}
                <button onClick={handleDeclareMelds} style={{ marginTop: '1rem' }}>
                  <Check size={16} /> {t('game.confirmMelds')}
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>{t('game.waitingForOtherPlayers')}</p>
            )}
          </div>
        )}

        {/* Tricks phase (also show during trick pause even if phase changed to scoring) */}
        {(state.phase === 'tricks' || isTrickPaused) && (
          <TrickArea
            trick={displayTrick}
            players={state.players}
            winnerPlayerIndex={winnerPlayerIndex}
          />
        )}

        {/* Scoring phase (hidden during trick pause) */}
        {state.phase === 'scoring' && !isTrickPaused && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>{t('game.roundOver')}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{t('game.nextRoundStarting')}</p>
          </div>
        )}

        {/* Finished */}
        {state.phase === 'finished' && (
          <div className="card" style={{ textAlign: 'center' }}>
            {(() => {
              const winner = Array.from(state.totalScores.entries()).find(
                ([, score]) => score >= state.targetScore
              );
              const winnerName = winner
                ? state.players.find((p) => p.playerIndex === winner[0])?.nickname
                : null;
              return (
                <h3>{winnerName ? t('game.wins', { name: winnerName }) : t('game.gameOver')}</h3>
              );
            })()}
            <button onClick={handleGoHome} style={{ marginTop: '1rem' }}>
              <Home size={16} /> {t('game.backToHome')}
            </button>
          </div>
        )}
      </div>

      {/* Bottom: Player's hand */}
      <PlayerHand
        cards={myHand}
        validMoves={validMoves}
        onPlayCard={
          state.phase === 'tricks' && isMyTurn && !isTrickPaused ? game.playCard : undefined
        }
        selectionMode={state.phase === 'dabb' && state.dabb.length === 0 ? 'multiple' : 'single'}
        selectedCount={dabbSize}
        onSelectionChange={setSelectedCards}
      />
    </div>
  );
}

function PhaseIndicator({ phase, trump }: { phase: string; trump: string | null }) {
  const { t } = useTranslation();

  const phaseKey = `phases.${phase}` as const;

  return (
    <div>
      <span style={{ color: 'var(--text-secondary)' }}>{t('game.phase')}: </span>
      <strong>{t(phaseKey)}</strong>
      {trump && (
        <span
          style={{
            marginLeft: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          | {t('game.trump')}: <SuitIcon suit={trump as Suit} size={20} />
          <strong>{SUIT_NAMES[trump as keyof typeof SUIT_NAMES]}</strong>
        </span>
      )}
    </div>
  );
}

function MeldPreview({ hand, trump }: { hand: Card[]; trump: Suit }) {
  const { t } = useTranslation();
  const melds = detectMelds(hand, trump);
  const totalPoints = calculateMeldPoints(melds);

  if (melds.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>{t('game.noMelds')}</p>;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {melds.map((meld, i) => (
        <div key={i}>
          {formatMeldName(meld, SUIT_NAMES)} ({meld.points} {t('game.points')})
        </div>
      ))}
      <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
        {t('game.total')}: {totalPoints} {t('game.points')}
      </div>
    </div>
  );
}

export default GamePage;
