import { useTranslation } from '@dabb/i18n';
import { Home } from 'lucide-react';

interface GameTerminatedModalProps {
  terminatedBy: string | null;
  onGoHome: () => void;
}

function GameTerminatedModal({ terminatedBy, onGoHome }: GameTerminatedModalProps) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay">
      <div className="modal-content card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>{t('game.gameTerminated')}</h2>
        {terminatedBy && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {t('game.gameTerminatedMessage', { name: terminatedBy })}
          </p>
        )}
        <button onClick={onGoHome}>
          <Home size={16} /> {t('game.backToHome')}
        </button>
      </div>
    </div>
  );
}

export default GameTerminatedModal;
