import { shouldStopPendingMetadataRetry } from './arweaveRetryHelpers.js';

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
});
