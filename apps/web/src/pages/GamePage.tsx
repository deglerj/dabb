import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Card, CardId, Suit, PlayerIndex } from '@dabb/shared-types';
import { DABB_SIZE, SUIT_NAMES } from '@dabb/shared-types';
import { detectMelds, calculateMeldPoints } from '@dabb/game-logic';

import { useGame } from '../hooks/useGame';
import PlayerHand from '../components/game/PlayerHand';
import BiddingPanel from '../components/game/BiddingPanel';
import TrumpSelector from '../components/game/TrumpSelector';
import TrickArea from '../components/game/TrickArea';
import ScoreBoard from '../components/game/ScoreBoard';

function GamePage() {
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
        <p>Verbindung wird hergestellt...</p>
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
                <h3>Dabb aufnehmen</h3>
                <button onClick={game.takeDabb} style={{ marginTop: '1rem' }}>
                  Dabb aufnehmen ({state.dabb.length} Karten)
                </button>
              </>
            ) : (
              <>
                <h3>Karten abwerfen</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Wähle {dabbSize} Karten zum Abwerfen
                </p>
                <button onClick={handleDiscard} disabled={selectedCards.length !== dabbSize}>
                  {selectedCards.length}/{dabbSize} ausgewählt - Abwerfen
                </button>
              </>
            )}
          </div>
        )}

        {state.phase === 'dabb' && state.bidWinner !== playerIndex && (
          <p style={{ color: 'var(--text-secondary)' }}>
            Warte auf Spieler{' '}
            {state.players.find((p) => p.playerIndex === state.bidWinner)?.nickname}...
          </p>
        )}

        {/* Trump phase */}
        {state.phase === 'trump' && state.bidWinner === playerIndex && (
          <TrumpSelector onSelect={game.declareTrump} />
        )}

        {state.phase === 'trump' && state.bidWinner !== playerIndex && (
          <p style={{ color: 'var(--text-secondary)' }}>Warte auf Trumpf-Ansage...</p>
        )}

        {/* Melding phase */}
        {state.phase === 'melding' && (
          <div className="card" style={{ textAlign: 'center' }}>
            {!state.declaredMelds.has(playerIndex as PlayerIndex) ? (
              <>
                <h3>Meldungen ansagen</h3>
                {state.trump && <MeldPreview hand={myHand} trump={state.trump} />}
                <button onClick={handleDeclareMelds} style={{ marginTop: '1rem' }}>
                  Meldungen bestätigen
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Warte auf andere Spieler...</p>
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
            <h3>Runde beendet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Nächste Runde beginnt...</p>
          </div>
        )}

        {/* Finished */}
        {state.phase === 'finished' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>Spiel beendet!</h3>
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
  const phaseNames: Record<string, string> = {
    waiting: 'Warten',
    dealing: 'Austeilen',
    bidding: 'Reizen',
    dabb: 'Dabb',
    trump: 'Trumpf',
    melding: 'Melden',
    tricks: 'Stechen',
    scoring: 'Zählen',
    finished: 'Beendet',
  };

  return (
    <div>
      <span style={{ color: 'var(--text-secondary)' }}>Phase: </span>
      <strong>{phaseNames[phase] || phase}</strong>
      {trump && (
        <span style={{ marginLeft: '1rem' }}>
          | Trumpf: <strong>{SUIT_NAMES[trump as keyof typeof SUIT_NAMES]}</strong>
        </span>
      )}
    </div>
  );
}

function MeldPreview({ hand, trump }: { hand: Card[]; trump: Suit }) {
  const melds = detectMelds(hand, trump);
  const totalPoints = calculateMeldPoints(melds);

  if (melds.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>Keine Meldungen</p>;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {melds.map((meld, i) => (
        <div key={i}>
          {meld.type} ({meld.points} Punkte)
        </div>
      ))}
      <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>Gesamt: {totalPoints} Punkte</div>
    </div>
  );
}

export default GamePage;
