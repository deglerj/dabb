/**
 * AppErrorBoundary — root-level React error boundary.
 * Wraps the entire app; catches any unhandled render crash.
 * Cannot use hooks (class component) or context providers (placed above them).
 */
import React from 'react';
import ErrorBoundaryScreen from './ErrorBoundaryScreen.js';

interface State {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = () => {
    const { error } = this.state;
    if (!error) {
      return;
    }
    const text = [
      '=== ERROR ===',
      error.message,
      '',
      '=== STACK TRACE ===',
      error.stack ?? '(no stack)',
    ].join('\n');
    void navigator.clipboard.writeText(text);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorBoundaryScreen
          error={this.state.error}
          onReload={this.handleReload}
          onCopy={this.handleCopy}
        />
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
