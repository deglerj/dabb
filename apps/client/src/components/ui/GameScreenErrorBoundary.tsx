/**
 * GameScreenErrorBoundary — error boundary for the game screen.
 * Captures game state, events, and socket status as a debug snapshot on crash.
 *
 * Two-render behaviour: getDerivedStateFromError fires during the render phase
 * (sets hasError/error, shows error screen immediately without context), then
 * componentDidCatch fires in the commit phase and sets contextSnapshot via setState,
 * causing a second render that fills in the game context. This is intentional.
 */
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import type { GameState, GameEvent } from '@dabb/shared-types';
import ErrorBoundaryScreen from './ErrorBoundaryScreen.js';

export function serializeGameState(state: GameState): Record<string, unknown> {
  return {
    phase: state.phase,
    round: state.round,
    playerCount: state.playerCount,
    players: state.players,
    targetScore: state.targetScore,
    dealer: state.dealer,
    currentBidder: state.currentBidder,
    firstBidder: state.firstBidder,
    currentBid: state.currentBid,
    bidWinner: state.bidWinner,
    passedPlayers: Array.from(state.passedPlayers),
    trump: state.trump,
    wentOut: state.wentOut,
    dabb: state.dabb,
    dabbCardIds: state.dabbCardIds,
    hands: Object.fromEntries(state.hands.entries()),
    currentTrick: state.currentTrick,
    currentPlayer: state.currentPlayer,
    lastCompletedTrick: state.lastCompletedTrick,
    tricksTaken: Object.fromEntries(state.tricksTaken.entries()),
    declaredMelds: Object.fromEntries(state.declaredMelds.entries()),
    roundScores: Object.fromEntries(state.roundScores.entries()),
    totalScores: Object.fromEntries(state.totalScores.entries()),
  };
}

interface Props {
  state: GameState;
  events: GameEvent[];
  connected: boolean;
  onReload: () => void;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  contextSnapshot: Record<string, unknown> | null;
}

class GameScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, contextSnapshot: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    const { state, events, connected } = this.props;
    this.setState({
      contextSnapshot: {
        connected,
        eventCount: events.length,
        recentEvents: events.slice(-10).map((e) => e.type),
        state: serializeGameState(state),
      },
    });
  }

  handleCopy = () => {
    const { error, contextSnapshot } = this.state;
    if (!error) {
      return;
    }
    const text = [
      '=== ERROR ===',
      error.message,
      '',
      '=== STACK TRACE ===',
      error.stack ?? '(no stack)',
      ...(contextSnapshot
        ? ['', '=== GAME CONTEXT ===', JSON.stringify(contextSnapshot, null, 2)]
        : []),
    ].join('\n');
    void Clipboard.setStringAsync(text);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorBoundaryScreen
          error={this.state.error}
          extraContext={this.state.contextSnapshot ?? undefined}
          onReload={this.props.onReload}
          onCopy={this.handleCopy}
        />
      );
    }
    return this.props.children;
  }
}

export default GameScreenErrorBoundary;
