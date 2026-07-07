import React from 'react';
import { retryLazyImport } from './lazyImportRetry';

const Dummy = () => React.createElement('div', null, 'ok');

describe('retryLazyImport', () => {
  it('retries transient lazy import failures', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
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
