/**
 * AppErrorBoundary — root-level React error boundary.
 * Wraps the entire app; catches any unhandled render crash.
 * Cannot use hooks (class component) or context providers (placed above them).
 */
import React from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import ErrorBoundaryScreen from './ErrorBoundaryScreen.js';

interface State {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload = () => {
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      router.replace('/');
    }
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
    void Clipboard.setStringAsync(text);
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
