import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '../Dialog.js';

// jsdom's <dialog> has no showModal/close, which rn-compat's Modal calls in an effect —
// src/vitest.setup.ts polyfills both for every test file.

function renderDialog(onClose = vi.fn()) {
  render(
    <Dialog visible title="Einstellungen" onClose={onClose}>
      <div data-testid="content">content</div>
    </Dialog>
  );
  return onClose;
}

describe('Dialog', () => {
  it('shows its title and children', () => {
    renderDialog();
    expect(screen.getByText('Einstellungen')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  // The card sits inside the backdrop, so without the touchable swallowing the click, every
  // tap inside the dialog would bubble out and close it.
  it('does not close when the card is clicked (regression)', () => {
    const onClose = renderDialog();
    fireEvent.click(screen.getByTestId('content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = renderDialog();
    // The backdrop is the outermost pressable — the card's nearest pressable ancestor's own
    // pressable ancestor.
    const card = screen.getByTestId('content').closest('.rn-pressable');
    const backdrop = card?.parentElement?.closest('.rn-pressable');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
