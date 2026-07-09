import React from 'react';
import { render, screen } from '@testing-library/react';
import * as bootRecovery from '../../bootRecovery.js';
import AppErrorBoundary from './AppErrorBoundary';
import RouteErrorBoundary from './RouteErrorBoundary';

const Thrower = () => {
  throw new Error('Kaboom');
};

const StaleChunkThrower = () => {
  throw new TypeError("'text/html' is not a valid JavaScript MIME type.");
};

describe('Error boundaries', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the GitHub issue link in the app-wide fallback', () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-error-report-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/issues/new',
    );
  });

  it('renders the GitHub issue link in the route-level fallback', () => {
    render(
      <RouteErrorBoundary>
        <Thrower />
      </RouteErrorBoundary>,
    );

    expect(screen.getByText(/this section encountered an error/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-error-report-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/issues/new',
    );
  });

  it('asks route-level fallback to recover stale deployed chunks', () => {
    const recoverSpy = jest.spyOn(bootRecovery, 'recoverFromStaleChunkLoadError').mockReturnValue(true);

    render(
      <RouteErrorBoundary>
        <StaleChunkThrower />
      </RouteErrorBoundary>,
    );

    expect(recoverSpy).toHaveBeenCalledWith(expect.any(TypeError));

    recoverSpy.mockRestore();
  });
});
