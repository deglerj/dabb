import { X } from 'lucide-react';
import { useTranslation } from '@dabb/i18n';

interface InfoModalProps {
  version: string;
  onClose: () => void;
}

function InfoModal({ version, onClose }: InfoModalProps) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1rem' }}>{t('info.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {t('info.version')}: {version}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={onClose}>
            <X size={16} /> {t('info.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InfoModal;
