import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseOverlay } from '@dabb/game-canvas';

// Regression coverage for the overlay show/hide contract PhaseOverlay's children (BiddingOverlay,
// TrumpOverlay, MeldingOverlay, DiscardOverlay) rely on: unlike a component that unmounts when
// hidden, PhaseOverlay always renders its children and gates interactivity via pointerEvents —
// losing that (e.g. conditionally unmounting instead) would silently break tap-through-prevention
// on the hidden state, since a mid-fade-out overlay must still not intercept clicks from the
// screen underneath.
describe('PhaseOverlay show/hide', () => {
  it('renders children and is interactive when visible', () => {
    render(
      <PhaseOverlay visible={true}>
        <div data-testid="content">content</div>
      </PhaseOverlay>
    );
    const content = screen.getByTestId('content');
    expect(content).toBeInTheDocument();
    // pointerEvents lives on PhaseOverlay's own outermost View, several levels above the
    // child (paper View > ScrollView's two wrapping divs) — walk up to it instead of
    // hardcoding a DOM depth that's an internal implementation detail.
    const wrapper = content.closest('[style*="pointer-events"]');
    expect(wrapper).toHaveStyle({ pointerEvents: 'auto' });
  });

  it('keeps children mounted but non-interactive when hidden', () => {
    render(
      <PhaseOverlay visible={false}>
        <div data-testid="content">content</div>
      </PhaseOverlay>
    );
    const content = screen.getByTestId('content');
    expect(content).toBeInTheDocument();
    const wrapper = content.closest('[style*="pointer-events"]');
    expect(wrapper).toHaveStyle({ pointerEvents: 'none' });
  });
});
