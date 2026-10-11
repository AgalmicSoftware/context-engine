import React, { Suspense } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('reloads instead of re-rendering a route whose lazy chunk failed to load', async () => {
    const recoverSpy = jest.spyOn(bootRecovery, 'recoverFromStaleChunkLoadError').mockReturnValue(false);
    const reloadSpy = jest.spyOn(bootRecovery, 'reloadForStaleChunk').mockImplementation(() => undefined);
    const StaleRoute = React.lazy(() =>
      Promise.reject(new Error('Unable to preload CSS for /assets/OnePageSession-00000000.css')),
    );

    render(
      <RouteErrorBoundary>
        <Suspense fallback={null}>
          <StaleRoute />
        </Suspense>
      </RouteErrorBoundary>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    recoverSpy.mockRestore();
    reloadSpy.mockRestore();
  });

  it('re-renders an ordinary route error when the reader tries again', () => {
    const reloadSpy = jest.spyOn(bootRecovery, 'reloadForStaleChunk').mockImplementation(() => undefined);
    let shouldThrow = true;
    const FlakyRoute = () => {
      if (shouldThrow) throw new Error('Kaboom');
      return <p>Recovered route</p>;
    };

    render(
      <RouteErrorBoundary>
        <FlakyRoute />
      </RouteErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered route')).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it('keeps the app-wide fallback on screen when reading session storage throws', () => {
    const storageGetter = jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError: site data is blocked');
    });
    // The marked URL means this load already reloaded once, so no navigation starts.
    window.history.replaceState({}, '', '/?ceChunkReload=123');

    try {
      render(
        <AppErrorBoundary>
          <StaleChunkThrower />
        </AppErrorBoundary>,
      );

      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    } finally {
      storageGetter.mockRestore();
      window.history.replaceState({}, '', '/');
    }
  });

  it('asks the app-wide fallback to recover a stale AppShell chunk without clearing its loop guard', () => {
    const recoverSpy = jest.spyOn(bootRecovery, 'recoverFromStaleChunkLoadError');
    window.sessionStorage.setItem(bootRecovery.STALE_CHUNK_RELOAD_STORAGE_KEY, 'true');

    render(
      <AppErrorBoundary>
        <StaleChunkThrower />
      </AppErrorBoundary>,
    );

    expect(recoverSpy).toHaveBeenCalledWith(expect.any(TypeError));
    expect(window.sessionStorage.getItem(bootRecovery.STALE_CHUNK_RELOAD_STORAGE_KEY)).toBe('true');

    recoverSpy.mockRestore();
    window.sessionStorage.removeItem(bootRecovery.STALE_CHUNK_RELOAD_STORAGE_KEY);
  });
});
