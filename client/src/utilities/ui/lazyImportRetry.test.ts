import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { lazyWithRetry, retryLazyImport } from './lazyImportRetry';

const Dummy = () => React.createElement('div', null, 'ok');

class CatchBoundary extends React.Component<{ children?: React.ReactNode }, { caught: boolean }> {
  state = { caught: false };

  static getDerivedStateFromError() {
    return { caught: true };
  }

  render() {
    return this.state.caught ? React.createElement('p', null, 'boundary caught') : this.props.children;
  }
}

describe('retryLazyImport', () => {
  it('retries transient lazy import failures', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('Module initialization was interrupted'))
      .mockResolvedValueOnce({ default: Dummy });

    await expect(retryLazyImport(loader, { attempts: 2, delayMs: 0 })).resolves.toEqual({ default: Dummy });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it.each([
    'Failed to fetch dynamically imported module: https://app.example.test/assets/SBTsPage-00000000.js',
    'Unable to preload CSS for /assets/SBTsPage-00000000.css',
  ])('lets a lazy view hand a stale chunk to its error boundary without retrying: %s', async (message) => {
    // The browser caches a failed import for the page, and Vite skips a failed
    // stylesheet on retry, so a retry would fail again or render unstyled.
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const loader = jest.fn().mockRejectedValueOnce(new TypeError(message)).mockResolvedValueOnce({ default: Dummy });
    const LazyView = lazyWithRetry(loader, { delayMs: 0 });

    try {
      render(
        React.createElement(
          CatchBoundary,
          null,
          React.createElement(Suspense, { fallback: null }, React.createElement(LazyView)),
        ),
      );

      expect(await screen.findByText('boundary caught')).toBeInTheDocument();
      expect(loader).toHaveBeenCalledTimes(1);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('keeps retrying stale chunk errors for callers outside React', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: Dummy });

    await expect(retryLazyImport(loader, { attempts: 2, delayMs: 0 })).resolves.toEqual({ default: Dummy });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('throws the final error after exhausting attempts', async () => {
    const finalError = new Error('still missing');
    const loader = jest.fn().mockRejectedValueOnce(new Error('first miss')).mockRejectedValueOnce(finalError);

    await expect(retryLazyImport(loader, { attempts: 2, delayMs: 0 })).rejects.toBe(finalError);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
