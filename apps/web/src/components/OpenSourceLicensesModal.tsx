import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@dabb/i18n';
import { licenseGroups } from '../generated/licenses.js';

interface OpenSourceLicensesModalProps {
  onClose: () => void;
}

function OpenSourceLicensesModal({ onClose }: OpenSourceLicensesModalProps) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1rem' }}>{t('licenses.title')}</h2>
        <div
          style={{
            overflowY: 'auto',
            maxHeight: '60vh',
            marginBottom: '1.5rem',
          }}
        >
          {licenseGroups.map((group) => (
            <div key={group.license} style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{group.license}</p>
              <p
                style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6' }}
              >
                {group.packages.join(', ')}
              </p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button className="secondary" onClick={onClose}>
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OpenSourceLicensesModal;
