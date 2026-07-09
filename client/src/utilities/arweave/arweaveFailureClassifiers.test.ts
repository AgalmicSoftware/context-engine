import fs from 'fs';

import {
  ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_ATTEMPTS,
  ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_MIN_AGE_MS,
  classifyArweaveFailureState,
  normalizeArweaveFailureEntry,
} from './arweaveFailureClassifiers.js';

describe('arweaveFailureClassifiers', () => {
  it('normalizes persisted failure entries for shared cache and classifier use', () => {
    expect(
      normalizeArweaveFailureEntry({
        attempts: '2',
        firstFailedAtMs: '101',
        lastFailedAtMs: '202',
        nextRetryAtMs: '303',
        lastStatus: '404',
        state: ' Terminal_Not_Found ',
        message: 42,
      }),
    ).toEqual({
      attempts: 2,
      firstFailedAtMs: 101,
      lastFailedAtMs: 202,
      nextRetryAtMs: 303,
      lastStatus: 404,
      state: 'terminal_not_found',
      message: '42',
    });
  });

  it('promotes aged repeated 404 failures to terminal_not_found', () => {
    const now = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const nextEntry = classifyArweaveFailureState({
      txId: 'tx-404',
      prevEntry: {
        attempts: ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_ATTEMPTS - 1,
        firstFailedAtMs: now - ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_MIN_AGE_MS,
        lastFailedAtMs: now - 500,
        nextRetryAtMs: now - 100,
        lastStatus: 404,
        state: 'transient',
        message: 'not yet terminal',
      },
      error: {
        status: 404,
        kind: 'not_found',
        retryable: false,
        message: 'still missing',
      },
    });

    expect(nextEntry.state).toBe('terminal_not_found');
    expect(nextEntry.attempts).toBe(ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_ATTEMPTS);
    expect(nextEntry.nextRetryAtMs).toBeGreaterThan(now);

    nowSpy.mockRestore();
  });

  it('keeps the classifier module decoupled from the cache module import path', () => {
    const source = fs.readFileSync(require.resolve('./arweaveFailureClassifiers.js'), 'utf8');
    expect(source).not.toContain('../cache/contractScriptsCache.js');
  });
});
