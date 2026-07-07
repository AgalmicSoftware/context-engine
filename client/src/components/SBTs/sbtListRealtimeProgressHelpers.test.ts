import {
  buildSbtListRealtimeProgressInputPlan,
  resolveSbtListRealtimeProgressRetentionPlan,
} from './sbtListRealtimeProgressHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListRealtimeProgressHelpers', () => {
  it('normalizes realtime progress inputs without deciding listener ownership', () => {
    expect(
      buildSbtListRealtimeProgressInputPlan({
        nowMs: 1234.9,
        progressBySlug: {
          '': {
            currentBlock: '50.2',
            latestBlock: '75.7',
          },
          Alpha: {
            currentBlock: '100.8',
            latestBlock: '120.4',
            phase: 'scan',
          },
          beta: {
            currentBlock: 0,
            latestBlock: 0,
          },
          Gamma: 'not-progress',
          [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: {
            currentBlock: 4,
            latestBlock: 5,
          },
        },
      }),
    ).toEqual({
      propSlugs: ['Alpha', 'beta', 'Gamma'],
      updatesBySlug: {
        '': {
          currentBlock: 50,
          latestBlock: 75,
          updatedAtMs: 1234,
        },
        Alpha: {
          currentBlock: 100,
          latestBlock: 120,
          phase: 'scan',
          updatedAtMs: 1234,
        },
      },
      validSlugs: ['', 'Alpha'],
    });
  });

  it('plans stale realtime bridge pruning while keeping active slugs parent-owned', () => {
    expect(
      resolveSbtListRealtimeProgressRetentionPlan({
        activeSlugs: ['active'],
        bridgeMs: 2500,
        nowMs: 3600,
        progressBySlug: {
          alpha: {
            currentBlock: 10,
            latestBlock: 20,
            updatedAtMs: 1000,
          },
          beta: {
            currentBlock: 12,
            latestBlock: 20,
            updatedAtMs: 2000,
          },
          active: {
            currentBlock: 99,
            latestBlock: 100,
            updatedAtMs: 100,
          },
        },
      }),
    ).toEqual({
      changed: true,
      nextProgressBySlug: {
        beta: {
          currentBlock: 12,
          latestBlock: 20,
          updatedAtMs: 2000,
        },
        active: {
          currentBlock: 99,
          latestBlock: 100,
          updatedAtMs: 100,
        },
      },
      nextPruneAtMs: 4500,
      prunedSlugs: ['alpha'],
    });
  });

  it('reports stable retention when no inactive bridge has expired', () => {
    expect(
      resolveSbtListRealtimeProgressRetentionPlan({
        activeSlugs: ['alpha'],
        bridgeMs: 2500,
        nowMs: 3000,
        progressBySlug: {
          alpha: {
            currentBlock: 10,
            latestBlock: 20,
            updatedAtMs: 100,
          },
          beta: {
            currentBlock: 18,
            latestBlock: 20,
            updatedAtMs: 1000,
          },
        },
      }),
    ).toEqual({
      changed: false,
      nextProgressBySlug: {
        alpha: {
          currentBlock: 10,
          latestBlock: 20,
          updatedAtMs: 100,
        },
        beta: {
          currentBlock: 18,
          latestBlock: 20,
          updatedAtMs: 1000,
        },
      },
      nextPruneAtMs: 3500,
      prunedSlugs: [],
    });
  });
});
