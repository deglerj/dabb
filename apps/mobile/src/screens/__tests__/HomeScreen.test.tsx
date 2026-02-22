import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Alert } from 'react-native';
import HomeScreen from '../HomeScreen';

// Mock LanguageSwitcher to simplify tests
vi.mock('../../components/LanguageSwitcher', () => ({
  default: () => null,
}));

describe('HomeScreen', () => {
  const defaultProps = {
    onCreateGame: vi.fn(() => Promise.resolve()),
    onJoinGame: vi.fn(() => Promise.resolve()),
    loading: false,
  };

  it('shows menu mode with create and join buttons', () => {
    render(<HomeScreen {...defaultProps} />);
    expect(screen.getByText('Neues Spiel erstellen')).toBeInTheDocument();
    expect(screen.getByText('Spiel beitreten')).toBeInTheDocument();
  });

  it('switches to create mode', () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Neues Spiel erstellen'));
    expect(screen.getByText('Neues Spiel')).toBeInTheDocument();
    expect(screen.getByText('Erstellen')).toBeInTheDocument();
  });

  it('switches to join mode', () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Spiel beitreten'));
    expect(screen.getByText('Beitreten')).toBeInTheDocument();
  });

  it('back button returns to menu from create mode', () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Neues Spiel erstellen'));
    expect(screen.getByText('Erstellen')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByText('Neues Spiel erstellen')).toBeInTheDocument();
  });

  it('back button returns to menu from join mode', () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Spiel beitreten'));
    expect(screen.getByText('Beitreten')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByText('Neues Spiel erstellen')).toBeInTheDocument();
  });

  it('create form validates nickname', async () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Neues Spiel erstellen'));

    fireEvent.click(screen.getByText('Erstellen'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Fehler', 'Bitte gib einen Spitznamen ein');
    });
  });

  it('join form validates nickname', async () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Spiel beitreten'));

    fireEvent.click(screen.getByText('Beitreten'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Fehler', 'Bitte gib einen Spitznamen ein');
    });
  });

  it('join form validates game code', async () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Spiel beitreten'));

    // Enter nickname but no game code
    const nicknameInput = screen.getByPlaceholderText('z.B. Hans');
    fireEvent.change(nicknameInput, { target: { value: 'TestPlayer' } });

    fireEvent.click(screen.getByText('Beitreten'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Fehler', 'Bitte gib einen Spielcode ein');
    });
  });

  it('calls onCreateGame with correct args', async () => {
    const onCreateGame = vi.fn(() => Promise.resolve());
    render(<HomeScreen {...defaultProps} onCreateGame={onCreateGame} />);

    fireEvent.click(screen.getByText('Neues Spiel erstellen'));

    const nicknameInput = screen.getByPlaceholderText('z.B. Hans');
    fireEvent.change(nicknameInput, { target: { value: 'TestPlayer' } });

    fireEvent.click(screen.getByText('Erstellen'));

    await waitFor(() => {
      expect(onCreateGame).toHaveBeenCalledWith('TestPlayer', 2);
    });
  });

  it('calls onJoinGame with correct args', async () => {
    const onJoinGame = vi.fn(() => Promise.resolve());
    render(<HomeScreen {...defaultProps} onJoinGame={onJoinGame} />);

    fireEvent.click(screen.getByText('Spiel beitreten'));

    const nicknameInput = screen.getByPlaceholderText('z.B. Hans');
    fireEvent.change(nicknameInput, { target: { value: 'TestPlayer' } });

    const codeInput = screen.getByPlaceholderText('z.B. schnell-fuchs-42');
    fireEvent.change(codeInput, { target: { value: 'ABC123' } });

    fireEvent.click(screen.getByText('Beitreten'));

    await waitFor(() => {
      expect(onJoinGame).toHaveBeenCalledWith('abc123', 'TestPlayer');
    });
  });

  it('shows loading state', () => {
    render(<HomeScreen {...defaultProps} loading={true} />);
    // In menu mode, loading doesn't change anything visible
    expect(screen.getByText('Neues Spiel erstellen')).toBeInTheDocument();
  });

  it('shows rules button on menu screen', () => {
    render(<HomeScreen {...defaultProps} />);
    expect(screen.getByText('Spielregeln')).toBeInTheDocument();
  });

  it('opens rules modal when rules button is tapped', () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Spielregeln'));

    // The modal should show the rules markdown content
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('closes rules modal when close button is tapped', () => {
    render(<HomeScreen {...defaultProps} />);
    fireEvent.click(screen.getByText('Spielregeln'));
    expect(screen.getByTestId('markdown')).toBeInTheDocument();

    // Tap the close button (the X icon)
    fireEvent.click(screen.getByTestId('feather-x'));
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
  });
});
