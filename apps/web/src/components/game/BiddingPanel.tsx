import { getMinBid } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';

interface BiddingPanelProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

function BiddingPanel({ currentBid, isMyTurn, onBid, onPass }: BiddingPanelProps) {
  const { t } = useTranslation();
  const minBid = getMinBid(currentBid);

  const bidOptions = [minBid, minBid + 10, minBid + 20, minBid + 50];

  return (
    <div className="bidding-panel">
      <span style={{ marginRight: '1rem' }}>
        {t('game.currentBid')}: <strong>{currentBid || '-'}</strong>
      </span>

      {isMyTurn && (
        <>
          {bidOptions.map((amount) => (
            <button key={amount} onClick={() => onBid(amount)} style={{ minWidth: '60px' }}>
              {amount}
            </button>
          ))}
          <button className="secondary" onClick={onPass}>
            {t('game.pass')}
          </button>
        </>
      )}

      {!isMyTurn && (
        <span style={{ color: 'var(--text-secondary)' }}>{t('game.waitingForOtherPlayers')}</span>
      )}
    </div>
  );
}

export default BiddingPanel;
