import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameTerminatedModal } from '../GameTerminatedModal.js';
import type { RematchState } from '../rematch.js';

function rematchState(overrides: Partial<RematchState> = {}): RematchState {
  return {
    myVote: null,
    waitingFor: [],
    declinedBy: [],
    onRematch: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
}

function renderModal(props: Partial<Parameters<typeof GameTerminatedModal>[0]> = {}) {
  return render(
    <GameTerminatedModal
      visible
      winnerId="p0"
      winnerNicknames={['Anna']}
      isLocalWinner={false}
      onDone={vi.fn()}
      {...props}
    />
  );
}

// i18n is not initialised under vitest, so t() returns the raw key.
describe('GameTerminatedModal rematch', () => {
  it('offers a rematch alongside the way out', () => {
    const onRematch = vi.fn();
    renderModal({ rematch: rematchState({ onRematch }) });

    expect(screen.getByText('game.rematchQuestion')).toBeDefined();
    fireEvent.click(screen.getByText('game.rematchYes'));
    expect(onRematch).toHaveBeenCalled();
    expect(screen.getByText('common.done')).toBeDefined();
  });

  it('names who is still to answer once this player agreed', () => {
    renderModal({ rematch: rematchState({ myVote: true, waitingFor: ['Bob'] }) });

    expect(screen.getByText('game.rematchWaiting')).toBeDefined();
    // No second chance to vote yes — this seat already did.
    expect(screen.queryByText('game.rematchYes')).toBeNull();
  });

  it('reports the new game is coming once everyone agreed', () => {
    renderModal({ rematch: rematchState({ myVote: true }) });

    expect(screen.getByText('game.rematchStarting')).toBeDefined();
  });

  it('withdraws the offer as soon as someone declines', () => {
    renderModal({ rematch: rematchState({ myVote: true, declinedBy: ['Bob'] }) });

    expect(screen.getByText('game.rematchDeclined')).toBeDefined();
    expect(screen.queryByText('game.rematchYes')).toBeNull();
  });

  it('shows no rematch at all for an aborted game', () => {
    renderModal({ terminatedBy: { nickname: 'Bob' }, rematch: null });

    expect(screen.getByText('game.playerEndedGame')).toBeDefined();
    expect(screen.queryByText('game.rematchQuestion')).toBeNull();
  });
});
