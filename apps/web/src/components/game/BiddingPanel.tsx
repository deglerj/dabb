import { getMinBid } from '@dabb/game-logic';

interface BiddingPanelProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

function BiddingPanel({ currentBid, isMyTurn, onBid, onPass }: BiddingPanelProps) {
  const minBid = getMinBid(currentBid);

  const bidOptions = [minBid, minBid + 10, minBid + 20, minBid + 50];

  return (
    <div className="bidding-panel">
      <span style={{ marginRight: '1rem' }}>
        Aktuelles Gebot: <strong>{currentBid || '-'}</strong>
      </span>

      {isMyTurn && (
        <>
          {bidOptions.map((amount) => (
            <button key={amount} onClick={() => onBid(amount)} style={{ minWidth: '60px' }}>
              {amount}
            </button>
          ))}
          <button className="secondary" onClick={onPass}>
            Passen
          </button>
        </>
      )}

      {!isMyTurn && (
        <span style={{ color: 'var(--text-secondary)' }}>Warte auf andere Spieler...</span>
      )}
    </div>
  );
}

export default BiddingPanel;
