import { useState } from 'react';
import { Bug, Code2, Library, ScrollText, X } from 'lucide-react';
import { useTranslation } from '@dabb/i18n';
import OpenSourceLicensesModal from './OpenSourceLicensesModal.js';

const GITHUB_URL = 'https://github.com/deglerj/dabb';
const LICENSE_URL = 'https://github.com/deglerj/dabb/blob/main/LICENSE';
const ISSUES_URL = 'https://github.com/deglerj/dabb/issues';

interface InfoModalProps {
  version: string;
  onClose: () => void;
}

function InfoModal({ version, onClose }: InfoModalProps) {
  const { t } = useTranslation();
  const [showLicenses, setShowLicenses] = useState(false);

  if (showLicenses) {
    return <OpenSourceLicensesModal onClose={() => setShowLicenses(false)} />;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '0.5rem' }}>{t('info.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {t('info.description')}
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {t('info.version')}: {version}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--primary)',
              textDecoration: 'none',
            }}
          >
            <Code2 size={16} />
            {t('info.sourceCode')}
          </a>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--primary)',
              textDecoration: 'none',
            }}
          >
            <ScrollText size={16} />
            {t('info.license')}
          </a>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--primary)',
              textDecoration: 'none',
            }}
          >
            <Bug size={16} />
            {t('info.reportBug')}
          </a>
          <button
            onClick={() => setShowLicenses(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--primary)',
              textDecoration: 'none',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 'inherit',
            }}
          >
            <Library size={16} />
            {t('info.openSourceLicenses')}
          </button>
        </div>
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
