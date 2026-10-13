import React from 'react';
import { PUBLIC_REPO_NEW_ISSUE_URL } from '../../variables/publicRepoMetadata.js';
import {
  isBrowserOffline,
  isStaleChunkLoadError,
  recoverFromStaleChunkLoadError,
  reloadForStaleChunk,
} from '../../bootRecovery.js';

type AppErrorBoundaryProps = {
  children?: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
  staleChunk: boolean;
  offline: boolean;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      staleChunk: false,
      offline: false,
    };
  }

  static getDerivedStateFromError(error: Error | null): AppErrorBoundaryState {
    const staleChunk = isStaleChunkLoadError(error);
    return {
      hasError: true,
      errorMessage: error && error.message ? error.message : 'An unexpected error occurred.',
      staleChunk,
      offline: staleChunk && isBrowserOffline(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo && errorInfo.componentStack);
    recoverFromStaleChunkLoadError(error);
  }

  handleReload = () => {
    if (this.state.staleChunk) {
      reloadForStaleChunk();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { staleChunk, offline } = this.state;
      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100%',
            background: 'var(--ce-canvas)',
            color: 'var(--ce-panel-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'var(--ce-card-bg)',
              border: '1px solid var(--ce-card-border)',
              borderRadius: '14px',
              padding: '28px',
            }}
          >
            {/* A stale chunk is a new deploy or a lost connection, not a bug: skip the raw module URL. */}
            <h2 style={{ margin: '0 0 12px 0', color: 'var(--ce-panel-text)' }}>
              {offline
                ? 'You appear to be offline'
                : staleChunk
                  ? 'A new version of Context Engine is available'
                  : 'Something went wrong'}
            </h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--ce-panel-text-muted)' }}>
              {offline
                ? 'Reconnect, then reload Context Engine.'
                : staleChunk
                  ? 'Reload the page to finish loading Context Engine.'
                  : this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: 'var(--ce-action-accent)',
                border: 'none',
                color: 'var(--ce-action-accent-text)',
                fontWeight: 700,
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
            {staleChunk ? null : (
              <div style={{ marginTop: '16px' }}>
                <a
                  href={PUBLIC_REPO_NEW_ISSUE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="ce-error-report-github"
                  style={{
                    color: 'var(--ce-action-accent)',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Report this issue on GitHub
                </a>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
