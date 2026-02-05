import { useTranslation } from '@dabb/i18n';
import { X, Check } from 'lucide-react';

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
            <X size={16} /> {cancelLabel || t('common.cancel')}
          </button>
          <button onClick={onConfirm}>
            <Check size={16} /> {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
