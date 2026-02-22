import { useTranslation } from '@dabb/i18n';

interface UpdateRequiredOverlayProps {
  visible: boolean;
}

function UpdateRequiredOverlay({ visible }: UpdateRequiredOverlayProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>{t('updateRequired.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {t('updateRequired.message')}
        </p>
        <button onClick={() => window.location.reload()}>{t('updateRequired.reload')}</button>
      </div>
    </div>
  );
}

export default UpdateRequiredOverlay;
