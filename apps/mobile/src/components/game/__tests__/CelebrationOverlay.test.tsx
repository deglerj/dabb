import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { GameEvent, PlayerIndex } from '@dabb/shared-types';
import CelebrationOverlay from '../CelebrationOverlay';

// Mock Confetti and Fireworks to detect rendering
vi.mock('../Confetti', () => ({
  default: () => <div data-testid="confetti">Confetti</div>,
}));

vi.mock('../Fireworks', () => ({
  default: () => <div data-testid="fireworks">Fireworks</div>,
}));

function makeEvent(type: string, payload: Record<string, unknown>, seq: number): GameEvent {
  return {
    id: `evt-${seq}`,
    type,
    timestamp: Date.now(),
    sequence: seq,
    payload,
  } as unknown as GameEvent;
}

describe('CelebrationOverlay (integration with useCelebration)', () => {
  it('renders nothing when no celebration events exist', () => {
    const events = [makeEvent('GAME_STARTED', { playerCount: 2, targetScore: 1000 }, 1)];

    const { container } = render(
      <CelebrationOverlay events={events} playerIndex={0 as PlayerIndex} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders confetti when current player won the round and met their bid', () => {
    const events = [
      makeEvent('GAME_STARTED', { playerCount: 2, targetScore: 1000 }, 1),
      makeEvent('BIDDING_WON', { playerIndex: 0, winningBid: 200 }, 2),
      makeEvent(
        'ROUND_SCORED',
        {
          scores: {
            0: { melds: 60, tricks: 150, total: 210, bidMet: true },
            1: { melds: 0, tricks: 80, total: 80, bidMet: false },
          },
        },
        3
      ),
    ];

    render(<CelebrationOverlay events={events} playerIndex={0 as PlayerIndex} />);

    expect(screen.getByTestId('confetti')).toBeInTheDocument();
    expect(screen.queryByTestId('fireworks')).not.toBeInTheDocument();
  });

  it('does NOT render confetti when current player is not the bid winner', () => {
    const events = [
      makeEvent('GAME_STARTED', { playerCount: 2, targetScore: 1000 }, 1),
      makeEvent('BIDDING_WON', { playerIndex: 1, winningBid: 200 }, 2),
      makeEvent(
        'ROUND_SCORED',
        {
          scores: {
            0: { melds: 0, tricks: 80, total: 80, bidMet: false },
            1: { melds: 60, tricks: 150, total: 210, bidMet: true },
          },
        },
        3
      ),
    ];

    const { container } = render(
      <CelebrationOverlay events={events} playerIndex={0 as PlayerIndex} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders fireworks when current player wins the game', () => {
    const events = [
      makeEvent('GAME_STARTED', { playerCount: 2, targetScore: 1000 }, 1),
      makeEvent('BIDDING_WON', { playerIndex: 0, winningBid: 200 }, 2),
      makeEvent(
        'ROUND_SCORED',
        {
          scores: {
            0: { melds: 60, tricks: 150, total: 210, bidMet: true },
            1: { melds: 0, tricks: 80, total: 80, bidMet: false },
          },
        },
        3
      ),
      makeEvent('GAME_FINISHED', { winner: 0, finalScores: { 0: 1050, 1: 400 } }, 4),
    ];

    render(<CelebrationOverlay events={events} playerIndex={0 as PlayerIndex} />);

    expect(screen.getByTestId('fireworks')).toBeInTheDocument();
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();
  });

  it('does NOT render fireworks when a different player wins', () => {
    const events = [
      makeEvent('GAME_STARTED', { playerCount: 2, targetScore: 1000 }, 1),
      makeEvent('BIDDING_WON', { playerIndex: 1, winningBid: 200 }, 2),
      makeEvent(
        'ROUND_SCORED',
        {
          scores: {
            0: { melds: 0, tricks: 80, total: 80, bidMet: false },
            1: { melds: 60, tricks: 150, total: 210, bidMet: true },
          },
        },
        3
      ),
      makeEvent('GAME_FINISHED', { winner: 1, finalScores: { 0: 400, 1: 1050 } }, 4),
    ];

    const { container } = render(
      <CelebrationOverlay events={events} playerIndex={0 as PlayerIndex} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when playerIndex is null', () => {
    const events = [
      makeEvent('GAME_STARTED', { playerCount: 2, targetScore: 1000 }, 1),
      makeEvent('BIDDING_WON', { playerIndex: 0, winningBid: 200 }, 2),
      makeEvent(
        'ROUND_SCORED',
        {
          scores: { 0: { melds: 60, tricks: 150, total: 210, bidMet: true } },
        },
        3
      ),
    ];

    const { container } = render(<CelebrationOverlay events={events} playerIndex={null} />);

    expect(container.innerHTML).toBe('');
  });
});
