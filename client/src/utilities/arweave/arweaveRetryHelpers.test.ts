import {
  prunePendingMetadataEntries,
  shouldStopPendingMetadataRetry,
} from './arweaveRetryHelpers.js';

describe('arweaveRetryHelpers', () => {
  it('stops pending retries when the error is terminal', () => {
    const decision = shouldStopPendingMetadataRetry({
      pendingEntry: { attempts: 2 },
      maxAttempts: 12,
      error: {
        state: 'terminal_not_found',
        status: 404,
        retryable: false,
      },
    });
    expect(decision.stop).toBe(true);
    expect(decision.terminal).toBe(true);
    expect(decision.reachedMaxAttempts).toBe(false);
  });

  it('stops pending retries when attempts hit the local cap', () => {
    const decision = shouldStopPendingMetadataRetry({
      pendingEntry: { attempts: 12 },
      maxAttempts: 12,
      error: {
        state: 'transient',
        status: 503,
        retryable: true,
      },
    });
    expect(decision.stop).toBe(true);
    expect(decision.terminal).toBe(false);
    expect(decision.reachedMaxAttempts).toBe(true);
  });

  it('prunes stale pending entries that already have hydrated payloads', () => {
    const result = prunePendingMetadataEntries({
      pendingEntries: {
        Q1: { attempts: 1, nextRetryAtMs: 10 },
        q2: { attempts: 2, nextRetryAtMs: 20 },
      },
      hydratedEntries: {
        q1: { id: 'q1' },
      },
    });

    expect(result.removedCount).toBe(1);
    expect(result.removedKeys).toEqual(['q1']);
    expect(result.nextPending).toEqual({
      q2: { attempts: 2, nextRetryAtMs: 20 },
    });
  });

  it('keeps pending entries without hydrated payloads', () => {
    const result = prunePendingMetadataEntries({
      pendingEntries: {
        q3: { attempts: 5, nextRetryAtMs: 999 },
      },
      hydratedEntries: {
        q4: { id: 'q4' },
      },
    });

    expect(result.removedCount).toBe(0);
    expect(result.removedKeys).toEqual([]);
    expect(result.nextPending).toEqual({
      q3: { attempts: 5, nextRetryAtMs: 999 },
    });
  });
});
