import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Card, CardId, Suit, PlayerIndex } from '@dabb/shared-types';
import { DABB_SIZE, SUIT_NAMES } from '@dabb/shared-types';
import { detectMelds, calculateMeldPoints } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';

import { useGame } from '../hooks/useGame';
import PlayerHand from '../components/game/PlayerHand';
import BiddingPanel from '../components/game/BiddingPanel';
import TrumpSelector from '../components/game/TrumpSelector';
import TrickArea from '../components/game/TrickArea';
import ScoreBoard from '../components/game/ScoreBoard';

function GamePage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const game = useGame(code || '');
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);

  const { state, playerIndex, isMyTurn, validMoves, error, connected } = game;

  const myHand = state.hands.get(playerIndex as PlayerIndex) || [];
  const dabbSize = DABB_SIZE[state.playerCount];

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

  const resolveCard = (cardId: string, playerIdx: PlayerIndex) => {
    const hand = state.hands.get(playerIdx) || [];
    return hand.find((c) => c.id === cardId);
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
      {/* Top: Scoreboard */}
      <ScoreBoard state={state} currentPlayerIndex={state.currentPlayer} />

      {/* Middle: Game area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
        }}
      >
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
                  {t('game.takeDabbCards', { count: state.dabb.length })}
                </button>
              </>
            ) : (
              <>
                <h3>{t('game.discardCards')}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {t('game.selectCardsToDiscard', { count: dabbSize })}
                </p>
                <button onClick={handleDiscard} disabled={selectedCards.length !== dabbSize}>
                  {t('game.selectedCount', { selected: selectedCards.length, total: dabbSize })}
                </button>
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
                  {t('game.confirmMelds')}
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>{t('game.waitingForOtherPlayers')}</p>
            )}
          </div>
        )}

        {/* Tricks phase */}
        {state.phase === 'tricks' && (
          <TrickArea
            trick={state.currentTrick}
            playerCount={state.playerCount}
            resolveCard={resolveCard}
          />
        )}

        {/* Scoring phase */}
        {state.phase === 'scoring' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>{t('game.roundOver')}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{t('game.nextRoundStarting')}</p>
          </div>
        )}

        {/* Finished */}
        {state.phase === 'finished' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>{t('game.gameOver')}</h3>
          </div>
        )}
      </div>

      {/* Bottom: Player's hand */}
      <PlayerHand
        cards={myHand}
        validMoves={validMoves}
        onPlayCard={state.phase === 'tricks' && isMyTurn ? game.playCard : undefined}
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
        <span style={{ marginLeft: '1rem' }}>
          | {t('game.trump')}: <strong>{SUIT_NAMES[trump as keyof typeof SUIT_NAMES]}</strong>
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
          {meld.type} ({meld.points} {t('game.points')})
        </div>
      ))}
      <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
        {t('game.total')}: {totalPoints} {t('game.points')}
      </div>
    </div>
  );
}

export default GamePage;
