import {
  canRetryNameLookup,
  clearNameLookupFailure,
  ensureNameLookupState,
  getNameLookupDelayMs,
  markNameLookupFailure,
} from './sbtSelectorNameLookupHelpers';

describe('sbtSelectorNameLookupHelpers', () => {
  it('backs off name lookups with a capped delay', () => {
    expect(getNameLookupDelayMs(0)).toBe(30 * 1000);
    expect(getNameLookupDelayMs(1)).toBe(30 * 1000);
    expect(getNameLookupDelayMs(2)).toBe(60 * 1000);
    expect(getNameLookupDelayMs(99)).toBe(60 * 60 * 1000);
  });

  it('tracks name lookup retry state', () => {
    const cache: Record<string, unknown> = {};
    const state = ensureNameLookupState(cache, 84532);
    expect(cache).toEqual({ '84532': { sbtList: {}, nameLookupState: {} } });
    expect(ensureNameLookupState(cache, 84532)).toBe(state);

    markNameLookupFailure(state, '0xabc', 1000);
    expect(state['0xabc']).toEqual({
      attempts: 1,
      nextRetryAt: 31_000,
      lastFailureAt: 1000,
    });
    expect(canRetryNameLookup(state, '0xabc', 30_999)).toBe(false);
    expect(canRetryNameLookup(state, '0xabc', 31_000)).toBe(true);

    markNameLookupFailure(state, '0xabc', 31_000);
    expect(state['0xabc'].attempts).toBe(2);
    expect(state['0xabc'].nextRetryAt).toBe(91_000);

    clearNameLookupFailure(state, '0xabc');
    expect(state['0xabc']).toBeUndefined();
  });
});
