import { buildSbtListPassiveLatestLookupPlan } from './sbtListPassiveLatestLookupHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListPassiveLatestLookupHelpers', () => {
  it('plans initial passive latest lookups only for loading sessions without realtime coverage', () => {
    const plan = buildSbtListPassiveLatestLookupPlan({
      chipLoadingStatusBySlug: {
        alpha: { statusLabel: 'Loading' },
        beta: { statusLabel: 'Loading' },
        [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: { statusLabel: 'Loading' },
      },
      getSessionProgressSnapshot: (slug) => {
        if (slug === 'alpha') {
          return {
            displayCurrentBlock: 1050,
            lastBlock: 1040,
            liveCurrentBlock: 1045,
          };
        }
        if (slug === 'beta') {
          return {
            displayCurrentBlock: 2000,
            lastBlock: 1990,
          };
        }
        return null;
      },
      lookupStateBySlug: {
        stale: { lastRequestedAtBlock: 12 },
      },
      sessionChipStateBySlug: {
        alpha: { isLoading: true },
        beta: { isLoading: false },
        [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: { isLoading: true },
      },
    });

    expect(plan).toEqual({
      requests: [{ slug: 'alpha', currentWatermark: 1050 }],
      staleSlugs: ['stale'],
    });
  });

  it('replans only after the research block step and skips covered or in-flight sessions', () => {
    const plan = buildSbtListPassiveLatestLookupPlan({
      chipLoadingStatusBySlug: {
        alpha: { statusLabel: 'Loading' },
        beta: { statusLabel: 'Loading' },
        gamma: { statusLabel: 'Loading' },
        delta: { statusLabel: 'Loading' },
        epsilon: { statusLabel: 'Loading' },
      },
      getSessionProgressSnapshot: (slug) => {
        if (slug === 'delta') {
          return {
            displayCurrentBlock: 1200,
            liveLatestBlock: 1250,
          };
        }
        return {
          displayCurrentBlock: slug === 'alpha' ? 1049 : 1050,
          lastBlock: 1000,
        };
      },
      lookupInFlightBySlug: {
        gamma: true,
      },
      lookupStateBySlug: {
        alpha: { lastRequestedAtBlock: 1000 },
        beta: { lastRequestedAtBlock: 1000 },
        gamma: { lastRequestedAtBlock: 1000 },
        delta: { lastRequestedAtBlock: 1000 },
        epsilon: { lastRequestedAtBlock: 1000 },
      },
      researchStep: 50,
      sbtRealtimeCoverageBySlug: {
        epsilon: true,
      },
      sessionChipStateBySlug: {
        alpha: { isLoading: true },
        beta: { isLoading: true },
        gamma: { isLoading: true },
        delta: { isLoading: true },
        epsilon: { isLoading: true },
      },
    });

    expect(plan).toEqual({
      requests: [{ slug: 'beta', currentWatermark: 1050 }],
      staleSlugs: ['delta', 'epsilon'],
    });
  });
});
