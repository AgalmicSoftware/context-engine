import React from 'react';
import { retryLazyImport } from './lazyImportRetry';

const Dummy = () => React.createElement('div', null, 'ok');

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
  ])('hands a stale chunk error to the error boundary without retrying: %s', async (message) => {
    // The browser caches a failed import for the page, and Vite skips a failed
    // stylesheet on retry, so a retry would fail again or render unstyled.
    const staleError = new TypeError(message);
    const loader = jest.fn().mockRejectedValueOnce(staleError).mockResolvedValueOnce({ default: Dummy });

    await expect(retryLazyImport(loader, { attempts: 3, delayMs: 0 })).rejects.toBe(staleError);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('throws the final error after exhausting attempts', async () => {
    const finalError = new Error('still missing');
    const loader = jest.fn().mockRejectedValueOnce(new Error('first miss')).mockRejectedValueOnce(finalError);

    await expect(retryLazyImport(loader, { attempts: 2, delayMs: 0 })).rejects.toBe(finalError);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
