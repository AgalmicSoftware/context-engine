jest.mock('../session/sessionNaming.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((s) => String(s || '')),
}));

const { buildSbtCountsInitialProgress, createSbtLiveProgressController } = require('./sbtLiveProgressController.js');
const { normalizeSessionSlug } = require('../session/sessionNaming.js');

const createStateHost = () => {
  let state = {
    sbtScanProgressBySlug: {},
  };
  return {
    getState: () => state,
    setState: jest.fn((updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      if (patch && typeof patch === 'object') {
        state = {
          ...state,
          ...patch,
        };
      }
      if (typeof cb === 'function') cb();
    }),
  };
};

const createProgressDeps = () => ({
  mergeProgressEntry: jest.fn(({ prevEntry = null, nextPatch = null, nowMs = Date.now() } = {}) => ({
    ...(prevEntry && typeof prevEntry === 'object' ? prevEntry : {}),
    ...(nextPatch && typeof nextPatch === 'object' ? nextPatch : {}),
    updatedAtMs: Math.max(0, Math.floor(Number(nextPatch?.updatedAtMs || nowMs) || 0)),
  })),
  shouldCommitProgress: jest.fn(() => true),
});

const getOnlyProgressEntry = (host) => Object.values(host.getState().sbtScanProgressBySlug || {})[0];

describe('createSbtLiveProgressController', () => {
  beforeEach(() => {
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
  });

  it('begins, updates, and clears live progress entries through host state', () => {
    const host = createStateHost();
    const progressDeps = createProgressDeps();
    const controller = createSbtLiveProgressController({
      setState: host.setState,
      ...progressDeps,
    });

    const token = controller.beginSbtLiveProgress('alpha', {
      currentBlock: 10,
      latestBlock: 20,
    });

    expect(token).toBe(1);
    expect(getOnlyProgressEntry(host)).toMatchObject({
      slug: 'alpha',
      currentBlock: 10,
      latestBlock: 20,
    });

    expect(
      controller.updateSbtLiveProgress('alpha', token, {
        currentBlock: 15,
        latestBlock: 20,
      }),
    ).toBe(true);
    expect(getOnlyProgressEntry(host)).toMatchObject({
      currentBlock: 15,
      latestBlock: 20,
    });

    controller.clearSbtLiveProgress('alpha', token);
    expect(host.getState().sbtScanProgressBySlug.alpha).toBeUndefined();
  });

  it('does not commit throttled updates when the progress helper declines the write', () => {
    const host = createStateHost();
    const progressDeps = createProgressDeps();
    const controller = createSbtLiveProgressController({
      setState: host.setState,
      ...progressDeps,
    });
    const token = controller.beginSbtLiveProgress('alpha', {
      currentBlock: 1,
      latestBlock: 10,
    });

    progressDeps.shouldCommitProgress.mockReturnValueOnce(false);

    expect(
      controller.updateSbtLiveProgress('alpha', token, {
        currentBlock: 5,
        latestBlock: 10,
      }),
    ).toBe(false);
    expect(getOnlyProgressEntry(host)).toMatchObject({
      currentBlock: 1,
      latestBlock: 10,
    });
  });

  it('clears token state on destroy so later updates are ignored', () => {
    const host = createStateHost();
    const progressDeps = createProgressDeps();
    const controller = createSbtLiveProgressController({
      setState: host.setState,
      ...progressDeps,
    });
    const token = controller.beginSbtLiveProgress('alpha', {
      currentBlock: 1,
      latestBlock: 2,
    });

    controller.destroy();

    expect(
      controller.updateSbtLiveProgress('alpha', token, {
        currentBlock: 2,
        latestBlock: 2,
      }),
    ).toBe(false);
    expect(getOnlyProgressEntry(host)).toMatchObject({
      currentBlock: 1,
      latestBlock: 2,
    });
  });
});

describe('buildSbtCountsInitialProgress', () => {
  it('returns null when the resumed scan already covers the target block', () => {
    expect(
      buildSbtCountsInitialProgress({
        startBlock: 10,
        toBlock: 12,
        seedBlock: 12,
      }),
    ).toBeNull();
  });

  it('builds a pre-scan progress payload when no blocks have been scanned', () => {
    expect(
      buildSbtCountsInitialProgress({
        startBlock: 10,
        toBlock: 12,
        seedBlock: 9,
      }),
    ).toEqual({
      phase: 'activity',
      fromBlock: 10,
      toBlock: 12,
      totalBlocks: 3,
      scannedBlocks: 0,
      remainingBlocks: 3,
      completionRatio: 0,
      scanFrom: 10,
      scanTo: 9,
      lastScannedBlock: 9,
    });
  });

  it('builds a partial progress payload from a checkpoint seed block', () => {
    expect(
      buildSbtCountsInitialProgress({
        startBlock: 10,
        toBlock: 14,
        seedBlock: 12,
      }),
    ).toEqual({
      phase: 'activity',
      fromBlock: 10,
      toBlock: 14,
      totalBlocks: 5,
      scannedBlocks: 3,
      remainingBlocks: 2,
      completionRatio: 0.6,
      scanFrom: 10,
      scanTo: 12,
      lastScannedBlock: 12,
    });
  });

  it('rejects non-finite block inputs', () => {
    expect(
      buildSbtCountsInitialProgress({
        startBlock: 'bad',
        toBlock: 14,
        seedBlock: 12,
      }),
    ).toBeNull();
  });
});
