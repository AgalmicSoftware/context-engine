import {
  buildSbtHydrationQueueEntry,
  buildSbtLightDiscoveryInFlightKey,
  type SbtRealtimeListenerCleanupHandle,
} from './sbtProgressListenerContract.js';

describe('sbtProgressListenerContract', () => {
  it('normalizes a hydration address without mutating queue state', () => {
    const queuedAddressKeys = new Set<string>();

    expect(
      buildSbtHydrationQueueEntry(' 0xAbC ', {
        queuedAddressKeys,
      }),
    ).toEqual({
      address: '0xAbC',
      addressKey: '0xabc',
    });
    expect(queuedAddressKeys.size).toBe(0);
  });

  it('rejects empty, ignored, and already queued hydration addresses', () => {
    expect(buildSbtHydrationQueueEntry('')).toBeNull();
    expect(
      buildSbtHydrationQueueEntry('0xIgnored', {
        ignoredAddressKeys: new Set(['0xignored']),
      }),
    ).toBeNull();
    expect(
      buildSbtHydrationQueueEntry('0xQueued', {
        queuedAddressKeys: new Set(['0xqueued']),
      }),
    ).toBeNull();
  });

  it('builds stable light-discovery keys from normalized host inputs', () => {
    expect(
      buildSbtLightDiscoveryInFlightKey({
        sessionSlug: 'alpha',
        forcedScopeSlug: 'beta',
        force: true,
      }),
    ).toBe('alpha|beta|1');
    expect(buildSbtLightDiscoveryInFlightKey({ sessionSlug: 'alpha' })).toBe('alpha||0');
  });

  it('keeps listener cleanup handles explicit for the eventual typed host', () => {
    const dispose = jest.fn();
    const handle = { dispose } satisfies SbtRealtimeListenerCleanupHandle;

    handle.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
