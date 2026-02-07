import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WaitingRoomScreen from '../WaitingRoomScreen';
import type { PlayerIndex } from '@dabb/shared-types';

function createPlayers(entries: Array<{ nickname: string; connected: boolean; isAI: boolean }>) {
  const map = new Map<PlayerIndex, { nickname: string; connected: boolean; isAI: boolean }>();
  entries.forEach((entry, index) => {
    map.set(index as PlayerIndex, entry);
  });
  return map;
}

describe('WaitingRoomScreen', () => {
  const defaultProps = {
    sessionCode: 'test-code-42',
    players: createPlayers([
      { nickname: 'Alice', connected: true, isAI: false },
      { nickname: 'Bob', connected: true, isAI: false },
    ]),
    playerCount: 4,
    isHost: true,
    onStartGame: vi.fn(),
    onLeave: vi.fn(),
    onAddAI: vi.fn(),
    onRemoveAI: vi.fn(),
  };

  it('displays session code', () => {
    render(<WaitingRoomScreen {...defaultProps} />);
    expect(screen.getByText('test-code-42')).toBeInTheDocument();
  });

  it('shows player list with status indicators', () => {
    render(<WaitingRoomScreen {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows host badge for player 0', () => {
    render(<WaitingRoomScreen {...defaultProps} />);
    expect(screen.getByText('Gastgeber')).toBeInTheDocument();
  });

  it('shows AI icon for AI players', () => {
    const players = createPlayers([
      { nickname: 'Alice', connected: true, isAI: false },
      { nickname: 'AI Bot', connected: true, isAI: true },
    ]);
    render(<WaitingRoomScreen {...defaultProps} players={players} />);
    expect(screen.getByText('AI Bot')).toBeInTheDocument();
    // AI player should have a cpu icon (also appears in "Add AI" button)
    expect(screen.getAllByTestId('feather-cpu').length).toBeGreaterThanOrEqual(1);
  });

  it('start button disabled when not all connected', () => {
    const players = createPlayers([{ nickname: 'Alice', connected: true, isAI: false }]);
    const onStartGame = vi.fn();
    render(
      <WaitingRoomScreen
        {...defaultProps}
        players={players}
        playerCount={4}
        onStartGame={onStartGame}
      />
    );

    fireEvent.click(screen.getByText('Spiel starten'));
    // onStartGame should not be called because button is disabled
    expect(onStartGame).not.toHaveBeenCalled();
  });

  it('start button enabled when all connected', () => {
    const players = createPlayers([
      { nickname: 'Alice', connected: true, isAI: false },
      { nickname: 'Bob', connected: true, isAI: false },
    ]);
    const onStartGame = vi.fn();
    render(
      <WaitingRoomScreen
        {...defaultProps}
        players={players}
        playerCount={2}
        onStartGame={onStartGame}
      />
    );

    fireEvent.click(screen.getByText('Spiel starten'));
    expect(onStartGame).toHaveBeenCalledTimes(1);
  });

  it('start button only visible for host', () => {
    render(<WaitingRoomScreen {...defaultProps} isHost={false} />);
    expect(screen.queryByText('Spiel starten')).not.toBeInTheDocument();
  });

  it('add AI button visible for host when slots available', () => {
    render(<WaitingRoomScreen {...defaultProps} />);
    expect(screen.getByText('KI hinzufügen')).toBeInTheDocument();
  });

  it('add AI button not visible when not host', () => {
    render(<WaitingRoomScreen {...defaultProps} isHost={false} />);
    expect(screen.queryByText('KI hinzufügen')).not.toBeInTheDocument();
  });

  it('remove AI button visible for host on AI players', () => {
    const players = createPlayers([
      { nickname: 'Alice', connected: true, isAI: false },
      { nickname: 'AI Bot', connected: true, isAI: true },
    ]);
    render(<WaitingRoomScreen {...defaultProps} players={players} />);
    expect(screen.getByText('AI Bot')).toBeInTheDocument();
    // There should be an X icon (feather-x) next to AI player for removal
    expect(screen.getByTestId('feather-x')).toBeInTheDocument();
  });

  it('leave button always visible', () => {
    render(<WaitingRoomScreen {...defaultProps} />);
    expect(screen.getByText('Verlassen')).toBeInTheDocument();
  });

  it('leave button calls onLeave', () => {
    const onLeave = vi.fn();
    render(<WaitingRoomScreen {...defaultProps} onLeave={onLeave} />);
    fireEvent.click(screen.getByText('Verlassen'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
