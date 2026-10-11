import React from 'react';
import { PUBLIC_REPO_NEW_ISSUE_URL } from '../../variables/publicRepoMetadata.js';
import { isStaleChunkLoadError, recoverFromStaleChunkLoadError, reloadForStaleChunk } from '../../bootRecovery.js';

type RouteErrorBoundaryProps = {
  children?: React.ReactNode;
  resetKey?: string | number | null;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
  staleChunk: boolean;
};

class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      staleChunk: false,
    };
  }

  static getDerivedStateFromError(error: Error | null): RouteErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error && error.message ? error.message : 'An unexpected error occurred.',
      staleChunk: isStaleChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo && errorInfo.componentStack);
    recoverFromStaleChunkLoadError(error);
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKey && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, errorMessage: '', staleChunk: false });
    }
  }

  handleTryAgain = () => {
    // Regression guard: React.lazy caches a rejected chunk import, so a re-render
    // cannot recover from a deploy; reload the page to fetch the new chunks.
    if (this.state.staleChunk) {
      reloadForStaleChunk();
      return;
    }
    this.setState({
      hasError: false,
      errorMessage: '',
      staleChunk: false,
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
              background: 'var(--ce-card-bg)',
              color: 'var(--ce-panel-text)',
              border: '1px solid var(--ce-card-border)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--ce-panel-text)' }}>This section encountered an error</h3>
            <p style={{ margin: '0 0 16px 0', color: 'var(--ce-panel-text-muted)' }}>{this.state.errorMessage}</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleTryAgain}
                style={{
                  background: 'var(--ce-action-accent)',
                  border: 'none',
                  color: 'var(--ce-action-accent-text)',
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
                  border: '1px solid var(--ce-border-strong)',
                  color: 'var(--ce-panel-text)',
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
                  color: 'var(--ce-action-accent)',
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid color-mix(in srgb, var(--ce-action-accent) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--ce-action-accent) 8%, transparent)',
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
