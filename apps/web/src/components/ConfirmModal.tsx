import { useTranslation } from '@dabb/i18n';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1rem' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={onCancel}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button onClick={onConfirm}>{confirmLabel || t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
