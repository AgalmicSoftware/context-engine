import contractScripts from './chainGateway.js';
import { sessionRegistryUtils } from './sessionRegistry.js';

const makeGroupCfg = (slug, startBlock) => ({
  slug,
  networkChainId: 84532,
  blockLimits: {
    start: startBlock,
    end: null,
  },
  contracts: {},
});

describe('contractScripts.getRelevantBlockWindowForFilter scope windows', () => {
  let latestBlockSpy;
  let getRegistryContractSpy;
  let upsertSessionRegistryCacheSpy;

  beforeEach(() => {
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanScope');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanSlugs');
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
    latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(50000000);
    getRegistryContractSpy = jest.spyOn(sessionRegistryUtils, 'getRegistryContract').mockReturnValue(null);
    upsertSessionRegistryCacheSpy = jest
      .spyOn(sessionRegistryUtils, 'upsertSessionRegistryCache')
      .mockImplementation(() => null);
  });

  afterEach(() => {
    if (latestBlockSpy) latestBlockSpy.mockRestore();
    if (getRegistryContractSpy) getRegistryContractSpy.mockRestore();
    if (upsertSessionRegistryCacheSpy) upsertSessionRegistryCacheSpy.mockRestore();
    try {
      window.history.replaceState({}, '', '/');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanScope');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionScanSlugs');
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
  });

  it('allows active non-general route slug in general scope', async () => {
    localStorage.setItem('ce:sessionScanScope', 'general');
    window.history.replaceState({}, '', '/session/test-112');

    const cfg = makeGroupCfg('test-112', 32000000);
    const windowForSlug = await contractScripts.getRelevantBlockWindowForFilter(cfg);

    expect(windowForSlug).toEqual({ fromBlock: 32000000, toBlock: 50000000 });
    expect(latestBlockSpy).toHaveBeenCalledTimes(1);
  });

  it('uses configured blockLimits.start for demo session windows', async () => {
    const cfg = makeGroupCfg('demo-1', 44967477);
    const windowForSlug = await contractScripts.getRelevantBlockWindowForFilter(cfg);

    expect(windowForSlug).toEqual({ fromBlock: 44967477, toBlock: 50000000 });
    expect(latestBlockSpy).toHaveBeenCalledTimes(1);
  });

  it('blocks non-active non-general slug in general scope', async () => {
    localStorage.setItem('ce:sessionScanScope', 'general');
    window.history.replaceState({}, '', '/session/test-112');

    const cfg = makeGroupCfg('other-slug', 32000000);
    const windowForSlug = await contractScripts.getRelevantBlockWindowForFilter(cfg);

    expect(windowForSlug).toEqual({ fromBlock: 1, toBlock: 0 });
    expect(latestBlockSpy).not.toHaveBeenCalled();
  });

  it('allows the general slug in general scope', async () => {
    localStorage.setItem('ce:sessionScanScope', 'general');
    window.history.replaceState({}, '', '/session/test-112');

    const cfg = makeGroupCfg('', 30297069);
    const windowForSlug = await contractScripts.getRelevantBlockWindowForFilter(cfg);

    expect(windowForSlug).toEqual({ fromBlock: 30297069, toBlock: 50000000 });
    expect(latestBlockSpy).toHaveBeenCalledTimes(1);
  });

  it('bypasses session-scope clamp when __ignoreSessionScanScope is true', async () => {
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['test-112']));
    window.history.replaceState({}, '', '/session/test-112');

    const cfg = {
      ...makeGroupCfg('other-slug', 32000000),
      __ignoreSessionScanScope: true,
    };
    const windowForSlug = await contractScripts.getRelevantBlockWindowForFilter(cfg);

    expect(windowForSlug).toEqual({ fromBlock: 32000000, toBlock: 50000000 });
    expect(latestBlockSpy).toHaveBeenCalledTimes(1);
  });

  it('recovers missing blockLimits.start from SessionCreated block', async () => {
    const queryFilter = jest.fn().mockResolvedValue([{ blockNumber: 41000000 }]);
    const filters = { SessionCreated: jest.fn(() => ({ topics: [] })) };
    getRegistryContractSpy.mockReturnValue({
      filters,
      queryFilter,
    });

    const cfg = {
      slug: 'fallback-slug',
      networkChainId: 84532,
      blockLimits: { end: null },
      contracts: {},
      __ignoreSessionScanScope: true,
    };
    const windowForSlug = await contractScripts.getRelevantBlockWindowForFilter(cfg);

    expect(windowForSlug).toEqual({ fromBlock: 41000000, toBlock: 50000000 });
    expect(queryFilter).toHaveBeenCalledTimes(1);
    expect(filters.SessionCreated).toHaveBeenCalledTimes(1);
  });

  it('throws when blockLimits.start is missing and SessionRegistry fallback cannot recover', async () => {
    const cfg = {
      slug: 'missing-start',
      networkChainId: 84532,
      blockLimits: { end: null },
      contracts: {},
      __ignoreSessionScanScope: true,
    };

    await expect(contractScripts.getRelevantBlockWindowForFilter(cfg)).rejects.toThrow(
      'Missing or invalid required blockLimits.start',
    );
    expect(latestBlockSpy).not.toHaveBeenCalled();
  });
});
