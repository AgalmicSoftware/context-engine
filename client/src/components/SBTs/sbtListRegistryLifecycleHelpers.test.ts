import { resolveSbtListRegistryRetryPlan } from './sbtListRegistryLifecycleHelpers';

describe('sbtListRegistryLifecycleHelpers', () => {
  it('schedules bounded registry retries while an expected universe remains pending', () => {
    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 0,
        shouldExpectRegistryUniverse: true,
        snapshot: {
          registryEntryCount: 0,
          registryHydrated: false,
        },
      }),
    ).toEqual({
      delayMs: 1500,
      nextAttempt: 1,
      pending: true,
      shouldSchedule: true,
    });

    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 3,
        shouldExpectRegistryUniverse: true,
        snapshot: {
          registryEntryCount: 0,
          registryHydrated: false,
        },
      }),
    ).toEqual({
      delayMs: 6000,
      nextAttempt: 4,
      pending: true,
      shouldSchedule: true,
    });

    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 4,
        shouldExpectRegistryUniverse: true,
        snapshot: {
          registryEntryCount: 0,
          registryHydrated: false,
        },
      }),
    ).toEqual({
      delayMs: null,
      nextAttempt: 4,
      pending: true,
      shouldSchedule: false,
    });
  });

  it('stops retrying when entries or a hydrated empty cache are available', () => {
    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 1,
        shouldExpectRegistryUniverse: true,
        snapshot: {
          registryEntryCount: 2,
          registryHydrated: false,
        },
      }),
    ).toEqual({
      delayMs: null,
      nextAttempt: 1,
      pending: false,
      shouldSchedule: false,
    });

    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 1,
        shouldExpectRegistryUniverse: true,
        snapshot: {
          registryEntryCount: 0,
          registryHydrated: true,
        },
      }),
    ).toEqual({
      delayMs: null,
      nextAttempt: 1,
      pending: false,
      shouldSchedule: false,
    });

    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 1,
        shouldExpectRegistryUniverse: false,
        snapshot: {
          registryEntryCount: 0,
          registryHydrated: false,
        },
      }),
    ).toEqual({
      delayMs: null,
      nextAttempt: 1,
      pending: false,
      shouldSchedule: false,
    });
  });

  it('caps retry delay while preserving attempt advancement', () => {
    expect(
      resolveSbtListRegistryRetryPlan({
        attempt: 2,
        delayStepMs: 3000,
        maxDelayMs: 5000,
        shouldExpectRegistryUniverse: true,
        snapshot: {
          registryEntryCount: 0,
          registryHydrated: false,
        },
      }),
    ).toEqual({
      delayMs: 5000,
      nextAttempt: 3,
      pending: true,
      shouldSchedule: true,
    });
  });
});
