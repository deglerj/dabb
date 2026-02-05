import { Component, ReactNode } from 'react';
import { useTranslation } from '@dabb/i18n';
import { RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorView({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ color: 'var(--error)', marginBottom: '1rem' }}>
        {t('errors.somethingWentWrong')}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px' }}>
        {t('errors.unexpectedError')}
      </p>
      {error && (
        <pre
          style={{
            background: 'var(--bg-input)',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            maxWidth: '100%',
            overflow: 'auto',
            marginBottom: '1.5rem',
          }}
        >
          {error.message}
        </pre>
      )}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={onRetry}>
          <RefreshCw size={16} /> {t('common.retry')}
        </button>
        <button className="secondary" onClick={() => window.location.reload()}>
          <RotateCcw size={16} /> {t('common.reload')}
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorView error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
