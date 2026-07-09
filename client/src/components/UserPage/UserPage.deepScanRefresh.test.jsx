/** @file UserPage.deepScanRefresh.test.jsx */
import UserPage from './UserPage';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiClient.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('UserPage deep scan refresh state', () => {
  beforeEach(() => {
    checkSponsoredAccess.mockResolvedValue({
      status: 'unknown',
      gate: null,
      resourceKey: 'default',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    try {
      delete globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING;
    } catch (_) {}
    try {
      delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS;
    } catch (_) {}
    try {
      delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
    try {
      localStorage.removeItem('ce:aiSettings:v1');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanScope');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanSlugs');
    } catch (_) {}
  });

  it('keeps loading state when data remains uncertain and no cache sources are available', () => {
    const instance = makeInstance();
    instance.state.hasUncertainUserData = true;

    instance._dgHasAny = jest.fn(() => false);
    instance._dgReadAll = jest.fn(() => []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.loadingSurveys).toBe(true);
    expect(instance.state.loadingQuestions).toBe(true);
    expect(instance.state.loadingSBTs).toBe(true);
  });

  it('treats deep-scan reports with coverage gaps as uncertain user data', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({ hadRpcErrors: true, coverageComplete: false });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('does not mark sbt data uncertain for activity-only deep-scan failures', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['test-10'],
      scannedSlugs: [],
      failedSlugs: [],
      failedActivitySlugs: ['test-10'],
      skippedSlugs: [],
      coverageComplete: false,
      coverageReason: 'activity-failure-all-slugs',
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('does not mark user data uncertain for partial rpc errors when scan still completed', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['edge'],
      scannedSlugs: ['edge'],
      failedSlugs: [],
      failedActivitySlugs: [],
      skippedSlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('marks user data uncertain for partial activity rpc failures even when scan reports coverage complete', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['edge', 'other'],
      scannedSlugs: ['edge'],
      failedSlugs: [],
      failedActivitySlugs: ['other'],
      skippedSlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('marks sbt data uncertain for partial sbt rpc failures even when scan reports coverage complete', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: true,
      attemptedSlugs: ['edge', 'other'],
      scannedSlugs: ['edge'],
      failedSlugs: ['other'],
      failedActivitySlugs: [],
      skippedSlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('treats deep-scan reports with all attempted slugs skipped as uncertain user data', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      hadRpcErrors: false,
      attemptedSlugs: ['edge', 'dacc'],
      scannedSlugs: [],
      skippedSlugs: ['edge', 'dacc'],
      failedActivitySlugs: [],
      coverageComplete: true,
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('clears user-data uncertainty after a successful follow-up deep-scan report resolves prior list-scope skips', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isDeepScanning: true,
      hasUncertainUserData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.applyDeepScanReport({
      attemptedSlugs: ['test-10'],
      scannedSlugs: [],
      skippedSlugs: ['test-10'],
      coverageComplete: false,
      coverageReason: 'list-scope-chain-id-unresolved',
    });
    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(true);

    instance.applyDeepScanReport({
      attemptedSlugs: ['test-10'],
      scannedSlugs: ['test-10'],
      skippedSlugs: [],
      failedSlugs: [],
      failedActivitySlugs: [],
      coverageComplete: true,
      coverageReason: 'scoped',
    });

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(2);
  });

  it('applies background retry scan reports for the active profile address', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      isDeepScanning: false,
      hasUncertainUserData: true,
    };
    instance.loadDataFromCache = jest.fn();

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: viewAddress.toLowerCase(),
          hadRpcErrors: false,
          scannedSlugs: ['edge'],
          failedSlugs: [],
        },
      },
    });

    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('applies background retry reports when only activity failure state changes', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      isDeepScanning: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    };
    instance.loadDataFromCache = jest.fn();

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: viewAddress.toLowerCase(),
          hadRpcErrors: true,
          attemptedSlugs: ['edge'],
          scannedSlugs: ['edge'],
          skippedSlugs: [],
          failedSlugs: [],
          failedActivitySlugs: [],
          coverageComplete: true,
          coverageReason: 'registry-ready',
        },
      },
    });

    expect(instance.state.hasUncertainUserData).toBe(false);
    expect(instance.state.hasUncertainSbtData).toBe(false);

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: viewAddress.toLowerCase(),
          hadRpcErrors: true,
          attemptedSlugs: ['edge'],
          scannedSlugs: ['edge'],
          skippedSlugs: [],
          failedSlugs: [],
          failedActivitySlugs: ['edge'],
          coverageComplete: true,
          coverageReason: 'registry-ready',
        },
      },
    });

    expect(instance.state.hasUncertainUserData).toBe(true);
    expect(instance.state.hasUncertainSbtData).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(2);
  });

  it('ignores late deep-scan completions for a stale profile target', async () => {
    const firstAddress = '0x00000000000000000000000000000000000000aa';
    const secondAddress = '0x00000000000000000000000000000000000000bb';
    const firstScan = createDeferred();
    const secondScan = createDeferred();
    const scanSpecificUserProfile = jest.fn((address) =>
      String(address || '').toLowerCase() === firstAddress.toLowerCase() ? firstScan.promise : secondScan.promise,
    );
    const instance = makeInstance({ viewAddress: firstAddress, scanSpecificUserProfile });
    instance.loadDataFromCache = jest.fn();

    instance.startProfileDeepScan('mount');
    instance.props = { ...instance.props, viewAddress: secondAddress };
    instance.startProfileDeepScan('update');

    firstScan.resolve({
      targetAddress: firstAddress,
      hadRpcErrors: false,
      scannedSlugs: ['edge'],
      failedSlugs: [],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(instance.state.isDeepScanning).toBe(true);
    expect(instance.loadDataFromCache).not.toHaveBeenCalled();

    secondScan.resolve({
      targetAddress: secondAddress,
      hadRpcErrors: false,
      scannedSlugs: ['edge'],
      failedSlugs: [],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(instance.state.isDeepScanning).toBe(false);
    expect(instance.loadDataFromCache).toHaveBeenCalledTimes(1);
  });

  it('ignores background retry reports for non-active profile addresses', () => {
    const instance = makeInstance({
      viewAddress: '0x00000000000000000000000000000000000000aa',
    });
    const applySpy = jest.spyOn(instance, 'applyDeepScanReport');

    instance.handleBackgroundProfileScanReport({
      detail: {
        source: 'registry-retry',
        scanReport: {
          targetAddress: '0x00000000000000000000000000000000000000bb',
          hadRpcErrors: false,
          scannedSlugs: ['edge'],
          failedSlugs: [],
        },
      },
    });

    expect(applySpy).not.toHaveBeenCalled();
  });
});
