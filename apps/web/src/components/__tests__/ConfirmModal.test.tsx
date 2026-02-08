import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@dabb/i18n';
import ConfirmModal from '../ConfirmModal';

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider initialLanguage="de">{ui}</I18nProvider>);
};

describe('ConfirmModal', () => {
  it('renders title and message', () => {
    renderWithI18n(
      <ConfirmModal
        title="Confirm Action"
        message="Are you sure you want to proceed?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('uses default button labels from i18n', () => {
    renderWithI18n(
      <ConfirmModal title="Test" message="Test message" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    // German defaults: "Abbrechen" and "Bestätigen"
    expect(screen.getByText(/Abbrechen/)).toBeInTheDocument();
    expect(screen.getByText(/Bestätigen/)).toBeInTheDocument();
  });

  it('uses custom button labels when provided', () => {
    renderWithI18n(
      <ConfirmModal
        title="Test"
        message="Test message"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    expect(screen.getByText(/Keep/)).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithI18n(
      <ConfirmModal title="Test" message="Test message" onConfirm={onConfirm} onCancel={vi.fn()} />
    );

    fireEvent.click(screen.getByText(/Bestätigen/));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderWithI18n(
      <ConfirmModal title="Test" message="Test message" onConfirm={vi.fn()} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText(/Abbrechen/));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when overlay is clicked', () => {
    const onCancel = vi.fn();
    const { container } = renderWithI18n(
      <ConfirmModal title="Test" message="Test message" onConfirm={vi.fn()} onCancel={onCancel} />
    );

    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when modal content is clicked', () => {
    const onCancel = vi.fn();
    const { container } = renderWithI18n(
      <ConfirmModal title="Test" message="Test message" onConfirm={vi.fn()} onCancel={onCancel} />
    );

    const content = container.querySelector('.modal-content')!;
    fireEvent.click(content);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
