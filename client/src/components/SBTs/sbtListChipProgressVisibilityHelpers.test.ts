import {
  buildSbtListChipProgressDisplayPlan,
  buildSbtListChipProgressDesiredVisibilityBySlug,
  resolveSbtListChipProgressVisibilityPlan,
} from './sbtListChipProgressVisibilityHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListChipProgressVisibilityHelpers', () => {
  it('builds chip progress display plans without owning render callbacks', () => {
    expect(
      buildSbtListChipProgressDisplayPlan({
        isLoading: true,
        status: {
          chipRemainingText: '10 remaining',
          hasLatest: true,
          progressPct: 4,
        },
      }),
    ).toEqual({
      indeterminate: false,
      progressText: '10 remaining',
      progressWidth: '6%',
      showProgress: true,
      style: {
        '--ce-chip-progress-width': '6%',
        background:
          'linear-gradient(90deg, color-mix(in srgb, var(--ce-edge-dark) 62%, transparent) 0%, color-mix(in srgb, var(--ce-edge-dark) 62%, transparent) 6%, color-mix(in srgb, var(--ce-edge-dark) 22%, transparent) 6%, color-mix(in srgb, var(--ce-edge-dark) 22%, transparent) 100%)',
      },
    });

    expect(
      buildSbtListChipProgressDisplayPlan({
        isLoading: true,
        status: {
          chipRemainingText: 'Syncing',
          hasLatest: false,
        },
      }),
    ).toEqual({
      indeterminate: true,
      progressText: 'Syncing',
      progressWidth: '35%',
      showProgress: true,
      style: {
        '--ce-chip-progress-width': '35%',
        background:
          'linear-gradient(90deg, color-mix(in srgb, var(--ce-edge-dark) 62%, transparent) 0%, color-mix(in srgb, var(--ce-edge-dark) 62%, transparent) 35%, color-mix(in srgb, var(--ce-edge-dark) 22%, transparent) 35%, color-mix(in srgb, var(--ce-edge-dark) 22%, transparent) 100%)',
      },
    });

    expect(
      buildSbtListChipProgressDisplayPlan({
        isLoading: false,
        status: {
          chipRemainingText: 'Synced',
          hasLatest: true,
          progressPct: 100,
        },
      }),
    ).toEqual({
      indeterminate: false,
      progressText: 'Synced',
      progressWidth: '0%',
      showProgress: false,
      style: undefined,
    });
  });

  it('builds desired chip progress visibility from loading chip state', () => {
    expect(
      buildSbtListChipProgressDesiredVisibilityBySlug({
        allSessionsMode: true,
        chipLoadingStatusBySlug: {
          alpha: { chipRemainingText: '10 remaining' },
          beta: { chipRemainingText: 'Synced' },
          gamma: null,
          [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: { chipRemainingText: 'Syncing' },
        },
        sessionChipStateBySlug: {
          alpha: { isLoading: true },
          beta: { isLoading: false },
          [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: { isLoading: true },
        },
      }),
    ).toEqual({
      alpha: true,
      beta: false,
    });

    expect(
      buildSbtListChipProgressDesiredVisibilityBySlug({
        allSessionsMode: false,
        chipLoadingStatusBySlug: {
          alpha: { chipRemainingText: '10 remaining' },
        },
        sessionChipStateBySlug: {
          alpha: { isLoading: true },
        },
      }),
    ).toEqual({});
  });

  it('plans initialization, pending sync, delayed commits, timer retention, and removal', () => {
    const timerId = { timer: 'existing' };

    expect(
      resolveSbtListChipProgressVisibilityPlan({
        desiredVisibilityBySlug: {
          alpha: true,
          beta: false,
          gamma: false,
          delta: true,
        },
        metaBySlug: {
          beta: {
            lastModeChangeAtMs: 800,
            pendingVisible: true,
            visible: true,
          },
          gamma: {
            lastModeChangeAtMs: 200,
            pendingVisible: false,
            visible: true,
          },
          delta: {
            lastModeChangeAtMs: 900,
            pendingVisible: true,
            timerId,
            visible: false,
          },
          stale: {
            lastModeChangeAtMs: 100,
            visible: true,
          },
        },
        minVisibleMs: 500,
        nowMs: 1000,
      }),
    ).toEqual({
      actions: [
        { type: 'schedule', delayMs: 300, slug: 'beta', visible: false },
        { type: 'commit', slug: 'gamma', visible: false },
        { type: 'keep-timer', slug: 'delta', visible: true },
        { type: 'remove', slug: 'stale' },
        { type: 'initialize', slug: 'alpha', visible: true },
      ],
    });
  });

  it('clears obsolete timers when current visibility already matches desired visibility', () => {
    expect(
      resolveSbtListChipProgressVisibilityPlan({
        desiredVisibilityBySlug: {
          alpha: true,
        },
        metaBySlug: {
          alpha: {
            lastModeChangeAtMs: 100,
            pendingVisible: false,
            timerId: { timer: 'obsolete' },
            visible: true,
          },
        },
        minVisibleMs: 500,
        nowMs: 200,
      }),
    ).toEqual({
      actions: [{ type: 'sync-pending', slug: 'alpha', visible: true }],
    });
  });
});
