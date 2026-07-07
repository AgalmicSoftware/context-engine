import React from 'react';
import { PUBLIC_REPO_NEW_ISSUE_URL } from '../../variables/publicRepoMetadata.js';
import { recoverFromStaleChunkLoadError } from '../../bootRecovery.js';

type RouteErrorBoundaryProps = {
  children?: React.ReactNode;
  resetKey?: string | number | null;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error | null): RouteErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error && error.message ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo && errorInfo.componentStack);
    recoverFromStaleChunkLoadError(error);
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKey && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  handleTryAgain = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', color: '#ffffff' }}>This section encountered an error</h3>
            <p style={{ margin: '0 0 16px 0', color: 'rgba(244, 247, 255, 0.85)' }}>{this.state.errorMessage}</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleTryAgain}
                style={{
                  background: '#4dffa4',
                  border: 'none',
                  color: '#061016',
                  fontWeight: 700,
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Go back
              </button>
              <a
                href={PUBLIC_REPO_NEW_ISSUE_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="ce-error-report-github"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  color: '#4dffa4',
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid rgba(77, 255, 164, 0.35)',
                  background: 'rgba(77, 255, 164, 0.08)',
                }}
              >
                Report this issue on GitHub
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
