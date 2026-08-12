import React from 'react';
import { PUBLIC_REPO_NEW_ISSUE_URL } from '../../variables/publicRepoMetadata.js';
import { recoverFromStaleChunkLoadError } from '../../bootRecovery.js';

type AppErrorBoundaryProps = {
  children?: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error | null): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error && error.message ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo && errorInfo.componentStack);
    recoverFromStaleChunkLoadError(error);
  }

  render() {
    if (this.state.hasError) {
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
            <h2 style={{ margin: '0 0 12px 0', color: 'var(--ce-panel-text)' }}>Something went wrong</h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--ce-panel-text-muted)' }}>{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
