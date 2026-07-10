import { buildSessionSbtCacheWriteEnvelope, SBT_CACHE_STORAGE_KEY } from './sbtCacheWriteContract.js';

describe('sbtCacheWriteContract', () => {
  it('preserves the storage key, session slug, and cache identity', () => {
    const cache = { 11155420: { lastBlock: 12, sbtList: {} } };

    const envelope = buildSessionSbtCacheWriteEnvelope({
      sessionSlug: 'alpha',
      value: cache,
    });

    expect(envelope).toEqual({
      cacheName: 'sbtCache',
      sessionSlug: 'alpha',
      value: cache,
    });
    expect(envelope.cacheName).toBe(SBT_CACHE_STORAGE_KEY);
    expect(envelope.value).toBe(cache);
  });
});
