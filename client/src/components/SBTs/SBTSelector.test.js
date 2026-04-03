import SBTSelector from './SBTSelector.jsx';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as contractScriptsUtils from '../../utilities/web3/contractScripts.js';
import * as sessionRegistryUtils from '../../utilities/web3/sessionRegistry.js';
import * as sessionScanScopeUtils from '../../utilities/session/sessionScanScope.js';
import * as cacheScriptsUtils from '../../utilities/cache/cacheScripts.js';
import { GLOBAL_SESSION_SELECTION_UPDATED_EVENT } from '../../utilities/session/globalSessionState.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const makeInstance = (props = {}) => {
  const instance = new SBTSelector({
    selectedSBTs: [],
    sessionSlug: 'edge',
    network: { id: 84532 },
    ...props,
  });
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state, instance.props) : update;
    instance.state = { ...instance.state, ...(next || {}) };
    if (typeof cb === 'function') cb();
  };
  return instance;
};

const findElement = (node, predicate) => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) stack.push(current[i]);
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    stack.push(current?.props?.children);
  }
  return null;
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

const flushAsync = async (passes = 1) => {
  for (let i = 0; i < passes; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await Promise.resolve();
};

describe('SBTSelector targeted hydration', () => {
  beforeEach(() => {
    SBTSelector._universeMemo = {};
    SBTSelector._universeInflight = {};
    SBTSelector._sharedLightUniverseKickoffMemo = {};
    localStorage.clear();
    sessionStorage.clear();
    globalThis.CE_SESSION_SCAN_SCOPE = 'active';
    globalThis.CE_SESSION_SCAN_SLUGS = [];
    try { delete globalThis.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS; } catch (_) {}
  });

  it('does not use demo-session metadata for labels when the strict shared lookup misses in live mode', () => {
    const instance = makeInstance();
    const strictSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault')
      .mockReturnValueOnce(null);
    const demoSpy = jest
      .spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug')
      .mockReturnValueOnce({
        slug: 'rxc',
        sessionName: 'Weyl v. Yarvin Debate',
      });

    try {
      expect(instance.getSessionLabel('rxc')).toBe('rxc');
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      strictSpy.mockRestore();
      demoSpy.mockRestore();
    }
  });

  it('does not use demo-session metadata lookup context when the strict shared lookup misses in live mode', () => {
    const instance = makeInstance({
      sessionSlug: 'rxc',
      chainId: 10,
      network: { chainId: 137 },
      sessionConfig: null,
    });
    const strictSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    const chainSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionChainId')
      .mockReturnValueOnce(null);
    const demoSpy = jest
      .spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'rxc',
        networkChainId: 777777,
      });

    try {
      expect(instance.getSessionNetworkId('rxc')).toBe(10);
      expect(instance.getMetadataLookupConfig('rxc')).toEqual(expect.objectContaining({
        slug: 'rxc',
        networkChainId: 10,
        __registry: expect.objectContaining({
          chainId: 10,
        }),
      }));
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      strictSpy.mockRestore();
      chainSpy.mockRestore();
      demoSpy.mockRestore();
    }
  });

  it('keeps unresolved live-mode session config placeholders instead of falling through to demo metadata', () => {
    const instance = makeInstance({
      sessionSlug: 'legacyEdge',
      sessionConfig: null,
      chainId: null,
      network: null,
    });
    const strictSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault')
      .mockReturnValue({
        slug: 'legacyEdge',
        contracts: {},
        __unresolved: true,
      });
    const demoSpy = jest
      .spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'edge',
        sessionName: 'Edge 2025',
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000dd',
            chainId: 84532,
          },
        },
      });

    try {
      expect(instance.getDisplayLookupSessionConfig('legacyEdge')).toEqual(expect.objectContaining({
        slug: 'legacyEdge',
        __unresolved: true,
      }));
      expect(instance.getSessionNetworkId('legacyEdge')).toBe(84532);
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      demoSpy.mockRestore();
      strictSpy.mockRestore();
    }
  });

  it('re-resolves selected option session slugs from session names before emitting onAddSBT', async () => {
    const selectedAddress = '0x9999999999999999999999999999999999999998';
    const onAddSBT = jest.fn();
    const instance = makeInstance({
      selectedSBTs: [],
      onAddSBT,
    });
    instance.state.sbtOptions = [{
      address: selectedAddress.toLowerCase(),
      name: 'Debate Badge',
      sessionSlug: 'edge',
      sessionName: 'Weyl v. Yarvin Debate',
    }];

    const slugByNameSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionSlugByName')
      .mockImplementation((name) => (name === 'Weyl v. Yarvin Debate' ? 'debate' : null));

    try {
      await instance.handleSBTSelection({ value: selectedAddress });

      expect(onAddSBT).toHaveBeenCalledWith(expect.objectContaining({
        address: selectedAddress.toLowerCase(),
        sessionSlug: 'debate',
        sessionName: 'Weyl v. Yarvin Debate',
      }));
    } finally {
      slugByNameSpy.mockRestore();
    }
  });

  it('preserves concrete sessionBindingSlug when emitting a selected option', async () => {
    const selectedAddress = '0x9999999999999999999999999999999999999997';
    const onAddSBT = jest.fn();
    const instance = makeInstance({
      selectedSBTs: [],
      onAddSBT,
    });
    instance.state.sbtOptions = [{
      address: selectedAddress.toLowerCase(),
      name: 'Demo Badge',
      sessionSlug: 'demo',
      sessionBindingSlug: 'demo',
      sessionName: 'Demo Session',
      chainId: 84532,
      selectionKey: `84532:${selectedAddress.toLowerCase()}`,
    }];

    await instance.handleSBTSelection({
      value: selectedAddress,
      selectionKey: `84532:${selectedAddress.toLowerCase()}`,
    });

    expect(onAddSBT).toHaveBeenCalledWith(expect.objectContaining({
      address: selectedAddress.toLowerCase(),
      sessionSlug: 'demo',
      sessionBindingSlug: 'demo',
    }));
  });

  it('does not emit duplicate onAddSBT calls when repeated picks race during metadata hydration', async () => {
    const selectedAddress = '0x1212121212121212121212121212121212121212';
    const onAddSBT = jest.fn();
    const deferred = createDeferred();
    const instance = makeInstance({
      selectedSBTs: [],
      onAddSBT,
    });
    instance.state.sbtOptions = [];

    const hydrateSpy = jest
      .spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted')
      .mockImplementation(() => deferred.promise);

    try {
      const firstSelection = instance.handleSBTSelection({ value: selectedAddress });
      const secondSelection = instance.handleSBTSelection({ value: selectedAddress });

      await flushAsync();
      expect(hydrateSpy).toHaveBeenCalledTimes(1);
      expect(onAddSBT).not.toHaveBeenCalled();

      deferred.resolve({
        info: {
          name: 'Deferred Badge',
          chainId: 84532,
        },
      });

      await Promise.all([firstSelection, secondSelection]);

      expect(onAddSBT).toHaveBeenCalledTimes(1);
      expect(onAddSBT).toHaveBeenCalledWith(expect.objectContaining({
        address: selectedAddress.toLowerCase(),
        name: 'Deferred Badge',
      }));
    } finally {
      hydrateSpy.mockRestore();
    }
  });

  it('returns [encrypted] for locked-name SBT options instead of placeholder contract names', () => {
    const instance = makeInstance();
    const label = instance.resolveSbtLabel(
      {
        name: '',
        contractName: 'CE-SBT-12',
        nameLocked: true,
      },
      '0x9999999999999999999999999999999999999999',
      'edge'
    );

    expect(label).toBe('[encrypted]');
  });

  it('sorts masked encrypted SBT options to the bottom of the dropdown even when featured', async () => {
    const visibleAddress = '0x1010101010101010101010101010101010101010';
    const encryptedAddress = '0x2020202020202020202020202020202020202020';
    const visibleLower = visibleAddress.toLowerCase();
    const encryptedLower = encryptedAddress.toLowerCase();
    const instance = makeInstance({
      defaultFeaturedSBTs: [encryptedAddress],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [visibleLower]: {
            sbtAddress: visibleAddress,
            sbtInfo: { name: 'Visible Group', unlisted: false },
            slug: 'edge',
          },
          [encryptedLower]: {
            sbtAddress: encryptedAddress,
            sbtInfo: { name: '', nameLocked: true, contractName: 'CE-SBT-LOCKED', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions.map((entry) => entry.address)).toEqual([
        visibleLower,
        encryptedLower,
      ]);
      expect(instance.state.sbtOptions.map((entry) => entry.name)).toEqual([
        'Visible Group',
        '[encrypted]',
      ]);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('does not sink locked-name SBTs when the visible title has been decrypted', async () => {
    const visibleLockedAddress = '0x3030303030303030303030303030303030303030';
    const plainAddress = '0x4040404040404040404040404040404040404040';
    const visibleLockedLower = visibleLockedAddress.toLowerCase();
    const plainLower = plainAddress.toLowerCase();
    const instance = makeInstance({
      defaultFeaturedSBTs: [visibleLockedAddress],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [visibleLockedLower]: {
            sbtAddress: visibleLockedAddress,
            sbtInfo: {
              name: 'Visible Locked Group',
              nameLocked: true,
              nameDecrypted: true,
              unlisted: false,
            },
            slug: 'edge',
          },
          [plainLower]: {
            sbtAddress: plainAddress,
            sbtInfo: { name: 'Plain Group', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions.map((entry) => entry.address)).toEqual([
        visibleLockedLower,
        plainLower,
      ]);
      expect(instance.state.sbtOptions.map((entry) => entry.name)).toEqual([
        'Visible Locked Group',
        'Plain Group',
      ]);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('avoids redundant selectedOption rerender state writes when hydration succeeds', async () => {
    const selectedAddress = '0x7777777777777777777777777777777777777777';
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.loadSBTOptions = jest.fn();
    const originalSelectedOption = { value: selectedAddress, label: 'Old Label' };
    instance.state.selectedOption = originalSelectedOption;
    instance.setState = jest.fn((update, cb) => {
      const next = typeof update === 'function' ? update(instance.state, instance.props) : update;
      instance.state = { ...instance.state, ...(next || {}) };
      if (typeof cb === 'function') cb();
    });

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([{ address: selectedAddress, name: 'Resolved Name', info: { name: 'Resolved Name' } }]);

    await instance.hydrateSelectedSbtNames();

    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.loadSBTOptions).toHaveBeenCalledTimes(1);
    expect(instance.state.selectedOption).toBe(originalSelectedOption);

    warmSpy.mockRestore();
  });

  it('refreshes selected display labels from hydrated metadata options', async () => {
    const selectedAddress = '0x8888888888888888888888888888888888888888';
    const selectedLower = selectedAddress.toLowerCase();
    const staleLabel = 'Stale Name';
    const resolvedLabel = 'Resolved Name';
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress, name: staleLabel }],
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [selectedLower]: {
            sbtAddress: selectedAddress,
            sbtInfo: { name: resolvedLabel, unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    }));
    instance.resolveSbtLabel = jest.fn(() => resolvedLabel);

    await instance.loadSBTOptions();

    expect(instance.state.sbtOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        address: selectedLower,
        name: resolvedLabel,
      }),
    ]));

    const rendered = JSON.stringify(instance.render());
    expect(rendered).toContain(resolvedLabel);
    expect(rendered).not.toContain(staleLabel);
  });

  it('does not call setState from applySbtOptions after the selector has unmounted', () => {
    const instance = makeInstance();
    instance._isMounted = false;
    instance.setState = jest.fn();

    const result = instance.applySbtOptions({
      sbtList: {
        '0x9999999999999999999999999999999999999999': {
          sbtAddress: '0x9999999999999999999999999999999999999999',
          sbtInfo: { name: 'Ghost Badge', unlisted: false },
          slug: 'edge',
        },
      },
      featuredEntries: [],
      ignoredSet: new Set(),
      fallbackSlug: 'edge',
      loadingOptions: false,
    });

    expect(result).toEqual([
      expect.objectContaining({
        address: '0x9999999999999999999999999999999999999999',
        name: 'Ghost Badge',
      }),
    ]);
    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('retries selected SBT hydration for same signature after a transient miss', async () => {
    const selectedAddress = '0x5555555555555555555555555555555555555555';
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.scheduleSelectedSbtHydrationRetry = jest.fn();
    instance.loadSBTOptions = jest.fn();

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ address: selectedAddress, name: 'Recovered Name', info: { name: 'Recovered Name' } }]);

    await instance.hydrateSelectedSbtNames();
    expect(instance.scheduleSelectedSbtHydrationRetry).toHaveBeenCalledTimes(1);
    expect(instance._selectedSbtHydrationSig).toBe('');

    await instance.hydrateSelectedSbtNames();
    expect(warmSpy).toHaveBeenCalledTimes(2);
    expect(instance.loadSBTOptions).toHaveBeenCalledTimes(1);

    warmSpy.mockRestore();
  });

  it('does not retry selected SBT hydration when targeted lookup policy is disabled', async () => {
    const previousPolicy = globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP;
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = false;
    const selectedAddress = '0x6666666666666666666666666666666666666666';
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.scheduleSelectedSbtHydrationRetry = jest.fn();
    instance.loadSBTOptions = jest.fn();

    const warmSpy = jest
      .spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted')
      .mockResolvedValueOnce([]);

    try {
      await instance.hydrateSelectedSbtNames();
      expect(instance.scheduleSelectedSbtHydrationRetry).not.toHaveBeenCalled();
      expect(instance._selectedSbtHydrationSig).not.toBe('');

      await instance.hydrateSelectedSbtNames();
      expect(warmSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = previousPolicy;
      warmSpy.mockRestore();
    }
  });

  it('skips duplicate option loads when request inputs are unchanged', async () => {
    const selectedAddress = '0x1111111111111111111111111111111111111111';
    const selectedLower = selectedAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
      sbtCacheRevision: 'rev-1',
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn(() => 'Resolved Name');
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [selectedLower]: {
            sbtAddress: selectedAddress,
            sbtInfo: { name: 'Resolved Name', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    }));
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      await instance.loadSBTOptions();
      await instance.loadSBTOptions();
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledTimes(1);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('aggregates SBT cache entries from all known sessions when scope mode is all', async () => {
    const edgeAddress = '0xaaaa000000000000000000000000000000000001';
    const alphaAddress = '0xaaaa000000000000000000000000000000000002';
    const betaAddress = '0xaaaa000000000000000000000000000000000003';
    const edgeLower = edgeAddress.toLowerCase();
    const alphaLower = alphaAddress.toLowerCase();
    const betaLower = betaAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [],
      sessionSlug: 'edge',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-all',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === 'alpha') {
        return {
          '84532': {
            sbtList: {
              [alphaLower]: {
                sbtAddress: alphaAddress,
                sbtInfo: { name: 'Alpha Badge', unlisted: false },
                slug: 'alpha',
              },
            },
            nameLookupState: {},
          },
        };
      }
      if (cacheSlug === 'beta') {
        return {
          '84532': {
            sbtList: {
              [betaLower]: {
                sbtAddress: betaAddress,
                sbtInfo: { name: 'Beta Badge', unlisted: false },
                slug: 'beta',
              },
            },
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {
            [edgeLower]: {
              sbtAddress: edgeAddress,
              sbtInfo: { name: 'Edge Badge', unlisted: false },
              slug: 'edge',
            },
          },
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('all');
    const allSlugsSpy = jest
      .spyOn(contractScriptsUtils, 'getAllSessionSlugs')
      .mockReturnValue(['edge', 'alpha', 'beta']);

    try {
      await instance.loadSBTOptions();
      const optionAddresses = instance.state.sbtOptions.map((option) => option.address);
      expect(optionAddresses).toEqual(expect.arrayContaining([edgeLower, alphaLower, betaLower]));
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledWith('alpha');
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledWith('beta');
    } finally {
      allSlugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('limits SBT options to the general session cache when scope mode is general on non-general pages', async () => {
    const edgeAddress = '0xbbbb000000000000000000000000000000000001';
    const generalAddress = '0xbbbb000000000000000000000000000000000002';
    const edgeLower = edgeAddress.toLowerCase();
    const generalLower = generalAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [],
      sessionSlug: 'edge',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-general',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === '') {
        return {
          '84532': {
            sbtList: {
              [generalLower]: {
                sbtAddress: generalAddress,
                sbtInfo: { name: 'General Badge', unlisted: false },
                slug: '',
              },
            },
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {
            [edgeLower]: {
              sbtAddress: edgeAddress,
              sbtInfo: { name: 'Edge Badge', unlisted: false },
              slug: 'edge',
            },
          },
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('general');

    try {
      await instance.loadSBTOptions();
      const optionAddresses = instance.state.sbtOptions.map((option) => option.address);
      expect(optionAddresses).toEqual([generalLower]);
      expect(optionAddresses).not.toContain(edgeLower);
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledWith('');
    } finally {
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('discovers scoped session slugs by default in list mode', async () => {
    const instance = makeInstance({
      sessionSlug: 'edge',
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn().mockResolvedValue(null);

    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['alpha', 'beta']);
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValue([]);

    try {
      await instance.ensureSbtUniverse({ force: true });

      expect(discoverSpy).toHaveBeenCalledTimes(2);
      expect(discoverSpy.mock.calls.map(([, cfg]) => cfg?.slug)).toEqual(['alpha', 'beta']);
    } finally {
      discoverSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('kicks off shared light-universe discovery once for the current list-scope session set when available', async () => {
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const instance = makeInstance({
      sessionSlug: 'edge',
      ensureLightSbtUniverse,
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn().mockResolvedValue(null);

    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['alpha']);
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValue([]);

    try {
      await instance.ensureSbtUniverse({ force: true });
      await instance.ensureSbtUniverse({ force: true });

      expect(ensureLightSbtUniverse).toHaveBeenCalledTimes(1);
      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(['alpha'], { forceExactSlugs: true });
      expect(discoverSpy).toHaveBeenCalledTimes(2);
    } finally {
      discoverSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('does not re-kick shared light-universe discovery when unrelated session slugs change', async () => {
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const instance = makeInstance({
      sessionSlug: 'edge',
      ensureLightSbtUniverse,
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn().mockResolvedValue(null);

    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['alpha']);
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValue([]);

    try {
      await instance.ensureSbtUniverse({ force: true });
      await instance.ensureSbtUniverse({ force: true });

      expect(ensureLightSbtUniverse).toHaveBeenCalledTimes(1);
      expect(ensureLightSbtUniverse).toHaveBeenNthCalledWith(1, ['alpha'], { forceExactSlugs: true });
    } finally {
      discoverSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('keeps selector discovery state active while the shared list-scope universe kickoff is still pending', async () => {
    const kickoff = createDeferred();
    const instance = makeInstance({
      sessionSlug: 'demo',
      ensureLightSbtUniverse: jest.fn(() => kickoff.promise),
    });
    instance._isMounted = true;
    instance.loadSBTOptions = jest.fn().mockResolvedValue(null);

    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['demo']);
    const allSlugsSpy = jest
      .spyOn(contractScriptsUtils, 'getAllSessionSlugs')
      .mockReturnValue(['demo', 'alpha']);
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValue([]);

    try {
      await instance.ensureSbtUniverse({ force: true });
      expect(instance.state.discovering).toBe(true);
      expect(instance.isOptionsLoading()).toBe(true);

      kickoff.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(instance.state.discovering).toBe(false);
    } finally {
      discoverSpy.mockRestore();
      allSlugsSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('shows locally discovered selector options before local discovery settles and upgrades them after name hydration', async () => {
    const address = '0x8181818181818181818181818181818181818181';
    const lower = address.toLowerCase();
    const factoryAddress = '0x00000000000000000000000000000000000000aa';
    const discovery = createDeferred();
    const nameHydration = createDeferred();
    const cacheStore = {
      edge: {
        '84532': {
          sbtList: {},
          nameLookupState: {},
        },
      },
    };
    const instance = makeInstance({
      sessionSlug: 'edge',
      chainId: 84532,
      sessionConfig: {
        slug: 'edge',
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: factoryAddress,
            chainId: 84532,
          },
        },
      },
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = jest.fn(() => 84532);
    instance.getDiscoverySessionRef = jest.fn(() => ({
      slug: 'edge',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: factoryAddress,
          chainId: 84532,
        },
      },
    }));
    instance.getMetadataLookupConfig = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    instance.getEffectiveSessionSlug = jest.fn(() => 'edge');
    instance.getResolvedScopeMode = jest.fn(() => 'active');
    instance.getResolvedTargetSlugs = jest.fn(() => ['edge']);
    instance.resolveSbtLabel = jest.fn((sbtInfo, value) => sbtInfo?.name || value);
    instance.scheduleProgressiveOptionsReload = jest.fn();
    instance.readSbtCacheBySlug = jest.fn(async (slug) => cacheStore[slug] || {});

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const writeSpy = jest
      .spyOn(cacheScriptsUtils, 'writeCache')
      .mockImplementation(async (_namespace, slug, value) => {
        cacheStore[slug] = value;
        return value;
      });
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockImplementation(async (_provider, _cfg, options = {}) => {
        options.onDiscoveredAddresses?.({ addresses: [address] });
        await discovery.promise;
        return [address];
      });
    const hydrateSpy = jest
      .spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted')
      .mockImplementation(async ({ address: candidate }) => {
        if (String(candidate || '').toLowerCase() !== lower) {
          return { info: null };
        }
        return nameHydration.promise;
      });

    try {
      const pending = instance.ensureSbtUniverseForSlug({ slug: 'edge', force: true });
      await flushAsync(3);

      expect(writeSpy).toHaveBeenCalled();
      expect(instance.scheduleProgressiveOptionsReload).toHaveBeenCalledWith({ force: true });

      const optionLoad = instance.loadSBTOptions({ force: true });
      await flushAsync(2);
      expect(instance.state.sbtOptions).toEqual([
        expect.objectContaining({
          address: lower,
          name: address,
          sessionSlug: 'edge',
        }),
      ]);

      discovery.resolve();
      await flushAsync(2);

      expect(instance.state.sbtOptions).toEqual([
        expect.objectContaining({
          address: lower,
          name: address,
        }),
      ]);

      nameHydration.resolve({
        info: {
          name: 'Progressive Alpha Badge',
          unlisted: false,
        },
      });
      await optionLoad;
      await pending;
      await flushAsync(2);

      expect(instance.state.sbtOptions).toEqual([
        expect.objectContaining({
          address: lower,
          name: 'Progressive Alpha Badge',
        }),
      ]);
    } finally {
      hydrateSpy.mockRestore();
      discoverSpy.mockRestore();
      writeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('keeps one selector option when shared and local universe discovery surface the same SBT', async () => {
    const address = '0x8282828282828282828282828282828282828282';
    const lower = address.toLowerCase();
    const factoryAddress = '0x00000000000000000000000000000000000000bb';
    const cacheStore = {
      edge: {
        '84532': {
          sbtList: {},
          nameLookupState: {},
        },
      },
    };
    const ensureLightSbtUniverse = jest.fn(async () => {
      cacheStore.edge = {
        '84532': {
          sbtList: {
            [lower]: {
              sbtAddress: address,
              sbtInfo: { name: 'Shared Progressive Badge', unlisted: false },
              slug: 'edge',
            },
          },
          nameLookupState: {},
        },
      };
    });
    const instance = makeInstance({
      sessionSlug: 'edge',
      chainId: 84532,
      ensureLightSbtUniverse,
      sessionConfig: {
        slug: 'edge',
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: factoryAddress,
            chainId: 84532,
          },
        },
      },
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = jest.fn(() => 84532);
    instance.getDiscoverySessionRef = jest.fn(() => ({
      slug: 'edge',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: factoryAddress,
          chainId: 84532,
        },
      },
    }));
    instance.getMetadataLookupConfig = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    instance.resolveSbtLabel = jest.fn((sbtInfo, value) => sbtInfo?.name || value);
    instance.scheduleProgressiveOptionsReload = jest.fn(({ force = false } = {}) => (
      instance.loadSBTOptions({ force })
    ));
    instance.readSbtCacheBySlug = jest.fn(async (slug) => cacheStore[slug] || {});

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const writeSpy = jest
      .spyOn(cacheScriptsUtils, 'writeCache')
      .mockImplementation(async (_namespace, slug, value) => {
        cacheStore[slug] = value;
        return value;
      });
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockImplementation(async (_provider, _cfg, options = {}) => {
        options.onDiscoveredAddresses?.({ addresses: [address] });
        return [address];
      });
    const hydrateSpy = jest
      .spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted')
      .mockResolvedValue({
        info: {
          name: 'Shared Progressive Badge',
          unlisted: false,
        },
      });

    try {
      await instance.ensureSbtUniverse({ force: true });
      await flushAsync(2);

      expect(ensureLightSbtUniverse).toHaveBeenCalledWith(['edge'], { forceExactSlugs: true });
      expect(instance.state.sbtOptions).toHaveLength(1);
      expect(instance.state.sbtOptions[0]).toEqual(expect.objectContaining({
        address: lower,
        name: 'Shared Progressive Badge',
      }));
    } finally {
      hydrateSpy.mockRestore();
      discoverSpy.mockRestore();
      writeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('streams cached options immediately and promotes featured scoped results first while loading', async () => {
    const cachedAddress = '0x4242424242424242424242424242424242424242';
    const featuredAddress = '0x4343434343434343434343434343434343434343';
    const cachedLower = cachedAddress.toLowerCase();
    const featuredLower = featuredAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: 'alpha',
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [cachedLower]: {
            sbtAddress: cachedAddress,
            sbtInfo: { name: 'Cached Badge', sessionSlug: 'alpha', sessionSlugExplicit: true, unlisted: false },
            slug: 'alpha',
          },
        },
        nameLookupState: {},
      },
    }));

    const featuredLookup = createDeferred();
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['alpha']);
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockImplementation((slug) => (
        slug === 'alpha'
          ? { featured_SBTs_LIST: [featuredAddress], ignored_SBTs_LIST: [] }
          : { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] }
      ));
    const hydrateSpy = jest
      .spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted')
      .mockImplementation(async ({ address }) => {
        if (String(address).toLowerCase() === featuredLower) {
          return featuredLookup.promise;
        }
        return { info: null };
      });

    try {
      const pending = instance.loadSBTOptions({ force: true });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(instance.state.loadingOptions).toBe(true);
      expect(instance.isOptionsLoading()).toBe(true);
      expect(instance.state.sbtOptions.map((option) => option.address)).toEqual([cachedLower]);

      const treeWhileLoading = instance.render();
      const headerStatusNode = findElement(
        treeWhileLoading,
        (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS
      );
      expect(headerStatusNode).toBeTruthy();

      featuredLookup.resolve({
        info: { name: 'Featured Badge', sessionSlug: 'alpha', sessionSlugExplicit: true, unlisted: false },
      });
      await pending;

      expect(instance.state.loadingOptions).toBe(false);
      expect(instance.state.sbtOptions.map((option) => option.address)).toEqual([featuredLower, cachedLower]);
      expect(instance.state.sbtOptions[0]).toEqual(expect.objectContaining({
        address: featuredLower,
        name: 'Featured Badge',
      }));
    } finally {
      hydrateSpy.mockRestore();
      groupListsSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('preserves explicit general-session cache entries in list scope instead of remapping them to the active slug', async () => {
    const generalAddress = '0x5151515151515151515151515151515151515151';
    const generalLower = generalAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: 'edge',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-general-list',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === '') {
        return {
          '84532': {
            sbtList: {
              [generalLower]: {
                sbtAddress: generalAddress,
                sbtInfo: { name: 'General Badge', sessionSlug: '', sessionSlugExplicit: true, unlisted: false },
                slug: '',
              },
            },
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {},
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['general']);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual([
        expect.objectContaining({
          address: generalLower,
          name: 'General Badge',
          sessionSlug: '',
        }),
      ]);
    } finally {
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('keeps same-address SBT options separate when scoped sessions live on different chains', async () => {
    const sharedAddress = '0x5252525252525252525252525252525252525252';
    const sharedLower = sharedAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: '',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-multi-chain-shared-address',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = (slug) => (
      String(slug || '').trim() === 'beta' ? 10 : 84532
    );
    instance.getMetadataLookupConfig = (slug) => ({
      slug,
      networkChainId: instance.getSessionNetworkId(slug),
    });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === 'beta') {
        return {
          '10': {
            sbtList: {
              [sharedLower]: {
                sbtAddress: sharedAddress,
                chainId: 10,
                sbtInfo: {
                  name: 'Beta Badge',
                  sessionSlug: 'beta',
                  sessionSlugExplicit: true,
                  unlisted: false,
                },
                slug: 'beta',
              },
            },
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {
            [sharedLower]: {
              sbtAddress: sharedAddress,
              chainId: 84532,
              sbtInfo: {
                name: 'Alpha Badge',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
                unlisted: false,
              },
              slug: 'alpha',
            },
          },
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['alpha', 'beta']);
    const namespaceSpy = jest
      .spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync')
      .mockReturnValue([]);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toHaveLength(2);
      expect(instance.state.sbtOptions.map((entry) => entry.name).sort()).toEqual([
        'Alpha Badge',
        'Beta Badge',
      ]);
      expect(instance.state.sbtOptions.map((entry) => entry.selectionKey).sort()).toEqual([
        `10:${sharedLower}`,
        `84532:${sharedLower}`,
      ]);
      expect(instance.state.sbtOptions.map((entry) => entry.chainId).sort((left, right) => left - right)).toEqual([
        10,
        84532,
      ]);
    } finally {
      namespaceSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('applies ignored SBT lists from every scoped session instead of only the active session', async () => {
    const ignoredAddress = '0x5353535353535353535353535353535353535353';
    const ignoredLower = ignoredAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: 'alpha',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-scoped-ignored-sbts',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === 'beta') {
        return {
          '84532': {
            sbtList: {
              [ignoredLower]: {
                sbtAddress: ignoredAddress,
                sbtInfo: {
                  name: 'Ignored Beta Badge',
                  sessionSlug: 'beta',
                  sessionSlugExplicit: true,
                  unlisted: false,
                },
                slug: 'beta',
              },
            },
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {},
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockImplementation((slug) => (
        slug === 'beta'
          ? { featured_SBTs_LIST: [], ignored_SBTs_LIST: [ignoredAddress] }
          : { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] }
      ));
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['beta']);
    const namespaceSpy = jest
      .spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync')
      .mockReturnValue([]);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual([]);
    } finally {
      namespaceSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('includes linked live SBTs from other cache buckets when list scope metadata binds them to an in-scope session', async () => {
    const linkedAddress = '0x5656565656565656565656565656565656565656';
    const linkedLower = linkedAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: '',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-linked-list-scope',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {},
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['demo']);
    const namespaceSpy = jest
      .spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync')
      .mockReturnValue([
        {
          namespace: 'sbtCache',
          slug: 'archive',
          key: 'dg:sbtCache:archive',
          value: {
            '84532': {
              sbtList: {
                [linkedLower]: {
                  sbtAddress: linkedAddress,
                  sbtInfo: {
                    name: 'Linked Demo Badge',
                    sessionSlug: 'demo',
                    sessionSlugExplicit: true,
                    unlisted: false,
                  },
                  slug: 'archive',
                },
              },
              nameLookupState: {},
            },
          },
        },
      ]);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual([
        expect.objectContaining({
          address: linkedLower,
          name: 'Linked Demo Badge',
          sessionSlug: 'demo',
        }),
      ]);
    } finally {
      namespaceSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('does not include linked cache entries in list scope when the session match is only inferred from sessionName', async () => {
    const linkedAddress = '0x5757575757575757575757575757575757575757';
    const linkedLower = linkedAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: '',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-linked-list-scope-legacy-name',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {},
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['demo']);
    const slugByNameSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionSlugByName')
      .mockImplementation((name) => (name === 'Demo Session' ? 'demo' : null));
    const namespaceSpy = jest
      .spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync')
      .mockReturnValue([
        {
          namespace: 'sbtCache',
          slug: 'archive',
          key: 'dg:sbtCache:archive',
          value: {
            '84532': {
              sbtList: {
                [linkedLower]: {
                  sbtAddress: linkedAddress,
                  sbtInfo: {
                    name: 'Inferred Demo Badge',
                    sessionName: 'Demo Session',
                    unlisted: false,
                  },
                  slug: 'archive',
                },
              },
              nameLookupState: {},
            },
          },
        },
      ]);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual([]);
    } finally {
      namespaceSpy.mockRestore();
      slugByNameSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('does not include in-scope list-scope cache entries that have named metadata but no declared sessionSlug', async () => {
    const leakedAddress = '0x5858585858585858585858585858585858585858';
    const leakedLower = leakedAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: '',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-list-scope-missing-session-slug',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug !== 'demo') {
        return {
          '84532': {
            sbtList: {},
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {
            [leakedLower]: {
              sbtAddress: leakedAddress,
              sbtInfo: {
                name: 'Demo-Looking Badge',
                sessionName: 'Demo Session',
                unlisted: false,
              },
              slug: 'demo',
            },
          },
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['demo']);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual([]);
    } finally {
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('keeps in-scope list-scope placeholder entries visible while metadata is still unresolved', async () => {
    const placeholderAddress = '0x5959595959595959595959595959595959595959';
    const placeholderLower = placeholderAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: '',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-list-scope-placeholder-visible',
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug !== 'demo') {
        return {
          '84532': {
            sbtList: {},
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {
            [placeholderLower]: {
              sbtAddress: placeholderAddress,
              sbtInfo: {},
              slug: 'demo',
            },
          },
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['demo']);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual([
        expect.objectContaining({
          address: placeholderLower,
          name: placeholderAddress,
          sessionSlug: 'demo',
        }),
      ]);
    } finally {
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('uses in-scope featured addresses for limitToFeatured rendering instead of only static defaultFeaturedSBTs', async () => {
    const featuredAddress = '0x6161616161616161616161616161616161616161';
    const nonFeaturedAddress = '0x6262626262626262626262626262626262626262';
    const featuredLower = featuredAddress.toLowerCase();
    const nonFeaturedLower = nonFeaturedAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: 'edge',
      defaultFeaturedSBTs: [],
      limitToFeatured: true,
      sbtCacheRevision: 'rev-limit-to-featured-scope',
      additionalSBTOptions: [{
        address: featuredAddress,
        name: 'Featured Additional',
      }],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === 'alpha') {
        return {
          '84532': {
            sbtList: {
              [featuredLower]: {
                sbtAddress: featuredAddress,
                sbtInfo: { name: 'Scoped Featured', sessionSlug: 'alpha', sessionSlugExplicit: true, unlisted: false },
                slug: 'alpha',
              },
            },
            nameLookupState: {},
          },
        };
      }
      return {
        '84532': {
          sbtList: {
            [nonFeaturedLower]: {
              sbtAddress: nonFeaturedAddress,
              sbtInfo: { name: 'Edge Non Featured', sessionSlug: 'edge', sessionSlugExplicit: true, unlisted: false },
              slug: 'edge',
            },
          },
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockImplementation((slug) => (
        slug === 'alpha'
          ? { featured_SBTs_LIST: [featuredAddress], ignored_SBTs_LIST: [] }
          : { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] }
      ));
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['alpha']);

    try {
      await instance.loadSBTOptions({ force: true });

      const rendered = JSON.stringify(instance.render());
      expect(rendered).toContain(featuredLower);
      expect(rendered).not.toContain(nonFeaturedLower);
      expect(instance.state.scopeFeaturedAddresses).toEqual([featuredLower]);
    } finally {
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('hydrates featured entries from scoped defaultFeaturedSBTs even when featured_SBTs_LIST is empty', async () => {
    const featuredAddress = '0x7171717171717171717171717171717171717171';
    const featuredLower = featuredAddress.toLowerCase();
    const instance = makeInstance({
      sessionSlug: 'rxc',
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-scoped-default-featured',
      sessionConfig: null,
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {},
        nameLookupState: {},
      },
    }));

    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['edge']);
    const listsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const strictSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault')
      .mockImplementation((slug) => {
        const normalized = String(slug || '').trim().toLowerCase();
        if (normalized === 'edge') {
          return {
            slug: 'edge',
            networkChainId: 84532,
            defaultFeaturedSBTs: [featuredAddress],
            contracts: {
              sbtFactory: {
                address: '0x00000000000000000000000000000000000000ee',
                chainId: 84532,
              },
            },
          };
        }
        if (normalized === 'rxc') {
          return {
            slug: 'rxc',
            networkChainId: 84532,
            contracts: {
              sbtFactory: {
                address: '0x00000000000000000000000000000000000000rr',
                chainId: 84532,
              },
            },
          };
        }
        return null;
      });
    const demoSpy = jest
      .spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug')
      .mockReturnValue(null);
    const hydrateSpy = jest
      .spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted')
      .mockImplementation(async ({ address }) => ({
        info: {
          name: String(address).toLowerCase() === featuredLower ? 'Scoped Default Featured' : 'Other',
          sessionSlug: 'edge',
          sessionSlugExplicit: true,
          unlisted: false,
        },
      }));

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          address: featuredLower,
          name: 'Scoped Default Featured',
          sessionSlug: 'edge',
        }),
      ]));
      expect(hydrateSpy).toHaveBeenCalledWith(expect.objectContaining({
        address: featuredAddress,
        preferredSlug: 'edge',
      }));
    } finally {
      hydrateSpy.mockRestore();
      demoSpy.mockRestore();
      strictSpy.mockRestore();
      listsSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('collapses scoped discovery to the manually selected source group', async () => {
    const instance = makeInstance({
      sessionSlug: 'edge',
      enableGroupSelect: true,
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn().mockResolvedValue(null);
    instance.state.groupOverride = true;
    instance.state.sourceSessionSlug = 'beta';

    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['edge', 'alpha']);
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValue([]);

    try {
      await instance.ensureSbtUniverse({ force: true });

      expect(discoverSpy).toHaveBeenCalledTimes(1);
      expect(discoverSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ slug: 'beta' }));
    } finally {
      discoverSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('recomputes the all-scope request signature when known session slugs change', async () => {
    const selectedAddress = '0x1616161616161616161616161616161616161616';
    const selectedLower = selectedAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
      sbtCacheRevision: 'rev-1',
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn(() => 'Resolved Name');
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [selectedLower]: {
            sbtAddress: selectedAddress,
            sbtInfo: { name: 'Resolved Name', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('all');
    let allSlugs = ['edge', 'alpha'];
    const allSlugsSpy = jest
      .spyOn(contractScriptsUtils, 'getAllSessionSlugs')
      .mockImplementation(() => allSlugs);

    try {
      await instance.loadSBTOptions();
      allSlugs = ['edge', 'alpha', 'beta'];
      await instance.loadSBTOptions();
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledTimes(5);
    } finally {
      allSlugsSpy.mockRestore();
      scopeSpy.mockRestore();
      groupListsSpy.mockRestore();
    }
  });

  it('retries unchanged non-force loads after a forced load fails', async () => {
    const selectedAddress = '0x1414141414141414141414141414141414141414';
    const selectedLower = selectedAddress.toLowerCase();
    const cachedValue = {
      '84532': {
        sbtList: {
          [selectedLower]: {
            sbtAddress: selectedAddress,
            sbtInfo: { name: 'Resolved Name', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    };
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
      sbtCacheRevision: 'rev-1',
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn(() => 'Resolved Name');
    instance.readSbtCacheBySlug = jest.fn()
      .mockResolvedValueOnce(cachedValue)
      .mockRejectedValueOnce(new Error('cache read failed'))
      .mockResolvedValueOnce(cachedValue);
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      await instance.loadSBTOptions();
      expect(instance._lastSbtOptionsRequestSig).not.toBe('');

      await expect(instance.loadSBTOptions({ force: true })).resolves.toBeNull();
      expect(instance.state.loadingOptions).toBe(false);

      await instance.loadSBTOptions();
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledTimes(3);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('coalesces overlapping option load requests into a single cache read', async () => {
    const selectedAddress = '0x1212121212121212121212121212121212121212';
    const selectedLower = selectedAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn(() => 'Resolved Name');

    let resolveRead;
    const pendingRead = new Promise((resolve) => {
      resolveRead = resolve;
    });
    instance.readSbtCacheBySlug = jest.fn(() => pendingRead);
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      const loadOne = instance.loadSBTOptions();
      const loadTwo = instance.loadSBTOptions();
      resolveRead({
        '84532': {
          sbtList: {
            [selectedLower]: {
              sbtAddress: selectedAddress,
              sbtInfo: { name: 'Resolved Name', unlisted: false },
              slug: 'edge',
            },
          },
          nameLookupState: {},
        },
      });
      await Promise.all([loadOne, loadTwo]);
      expect(instance.readSbtCacheBySlug).toHaveBeenCalledTimes(1);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('queues a non-force rerun when request inputs change during an inflight load', async () => {
    const selectedAddress = '0x1313131313131313131313131313131313131313';
    const selectedLower = selectedAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-1',
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn(() => 'Resolved Name');

    let resolveFirstRead;
    const firstRead = new Promise((resolve) => {
      resolveFirstRead = resolve;
    });
    const cachedValue = {
      '84532': {
        sbtList: {
          [selectedLower]: {
            sbtAddress: selectedAddress,
            sbtInfo: { name: 'Resolved Name', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    };
    instance.readSbtCacheBySlug = jest.fn()
      .mockImplementationOnce(() => firstRead)
      .mockResolvedValueOnce(cachedValue);
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      const loadOne = instance.loadSBTOptions();
      instance.props = {
        ...instance.props,
        sbtCacheRevision: 'rev-2',
      };
      const loadTwo = instance.loadSBTOptions();

      resolveFirstRead(cachedValue);
      await Promise.all([loadOne, loadTwo]);
      if (instance._loadSbtOptionsInflight) {
        await instance._loadSbtOptionsInflight;
      }

      expect(instance.readSbtCacheBySlug).toHaveBeenCalledTimes(2);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('prefers session-config chain id over registry/prop/wallet chain sources', () => {
    const chainSpy = jest.spyOn(contractScriptsUtils, 'getSessionChainId').mockReturnValue(11155111);
    const instance = makeInstance({
      sessionSlug: 'new-slug-not-yet-published',
      chainId: 10,
      network: { chainId: 137 },
      sessionConfig: { networkChainId: 84532 },
    });
    try {
      expect(instance.getSessionNetworkId('new-slug-not-yet-published')).toBe(84532);
    } finally {
      chainSpy.mockRestore();
    }
  });

  it('prefers registry session chain id over explicit prop and wallet chain id', () => {
    const chainSpy = jest.spyOn(contractScriptsUtils, 'getSessionChainId').mockReturnValue(84532);
    const instance = makeInstance({
      sessionSlug: 'new-slug-not-yet-published',
      chainId: 10,
      network: { chainId: 11155111 },
    });
    try {
      expect(instance.getSessionNetworkId('new-slug-not-yet-published')).toBe(84532);
    } finally {
      chainSpy.mockRestore();
    }
  });

  it('falls back to default chain id when no session/prop/wallet chain is available', () => {
    const chainSpy = jest.spyOn(contractScriptsUtils, 'getSessionChainId').mockReturnValue(null);
    const instance = makeInstance({
      sessionSlug: 'new-slug-not-yet-published',
      chainId: null,
      network: null,
      sessionConfig: {},
    });
    try {
      expect(instance.getSessionNetworkId('new-slug-not-yet-published')).toBe(84532);
    } finally {
      chainSpy.mockRestore();
    }
  });

  it('uses provided session config when discovering SBT universe', async () => {
    const factoryAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      chainId: 84532,
      sessionSlug: 'draft-slug',
      sessionConfig: {
        slug: 'draft-slug',
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: factoryAddress,
            chainId: 84532,
          },
        },
      },
    });
    instance._isMounted = false;

    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValueOnce([]);

    try {
      await instance.ensureSbtUniverse({ force: true });

      expect(discoverSpy).toHaveBeenCalledWith(
        'none',
        expect.objectContaining({
          slug: 'draft-slug',
          networkChainId: 84532,
          contracts: expect.objectContaining({
            sbtFactory: expect.objectContaining({
              address: factoryAddress,
              chainId: 84532,
            }),
          }),
        }),
        expect.objectContaining({
          onDiscoveredAddresses: expect.any(Function),
        })
      );
    } finally {
      discoverSpy.mockRestore();
    }
  });

  it('does not use demo-session discovery context when shared config is missing in live mode', async () => {
    const instance = makeInstance({
      sessionSlug: 'rxc',
      chainId: null,
      network: null,
      sessionConfig: null,
    });
    instance._isMounted = false;

    const strictSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault')
      .mockReturnValue(null);
    const chainSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionChainId')
      .mockReturnValue(null);
    const demoSpy = jest
      .spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug')
      .mockReturnValue({
        slug: 'rxc',
        networkChainId: 777777,
        contracts: {
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000bb',
            chainId: 777777,
          },
        },
      });
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockResolvedValueOnce([]);

    try {
      await instance.ensureSbtUniverse({ force: true });

      expect(discoverSpy).toHaveBeenCalledWith(
        'none',
        expect.objectContaining({
          slug: 'rxc',
          networkChainId: 84532,
        }),
        expect.objectContaining({
          onDiscoveredAddresses: expect.any(Function),
        })
      );
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      strictSpy.mockRestore();
      chainSpy.mockRestore();
      demoSpy.mockRestore();
      discoverSpy.mockRestore();
    }
  });

  it('treats network.chainId-only changes as network changes in componentDidUpdate', async () => {
    const instance = makeInstance({
      network: { chainId: 84532 },
      chainId: null,
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn();
    instance.ensureSbtUniverse = jest.fn();
    instance.hydrateSelectedSbtNames = jest.fn();
    instance.getSessionNetworkId = jest.fn(() => 84532);
    const prevState = { ...instance.state };
    const prevProps = {
      ...instance.props,
      network: { chainId: 84531 },
    };
    const registrySpy = jest
      .spyOn(sessionRegistryUtils, 'loadSessionRegistryCache')
      .mockResolvedValue(null);

    try {
      instance.componentDidUpdate(prevProps, prevState);
      await Promise.resolve();

      expect(instance.loadSBTOptions).toHaveBeenCalledTimes(1);
      expect(instance.ensureSbtUniverse).toHaveBeenCalledWith({ force: false });
      expect(instance.hydrateSelectedSbtNames).toHaveBeenCalledTimes(1);
    } finally {
      registrySpy.mockRestore();
    }
  });

  it('kicks off shared light-universe discovery when the prop becomes available after mount', () => {
    const ensureLightSbtUniverse = jest.fn().mockResolvedValue(undefined);
    const instance = makeInstance({
      sessionSlug: 'edge',
    });
    instance._isMounted = true;
    const prevState = { ...instance.state };
    const prevProps = {
      ...instance.props,
      ensureLightSbtUniverse: undefined,
    };
    instance.props = {
      ...instance.props,
      ensureLightSbtUniverse,
    };
    instance.loadSBTOptions = jest.fn();
    instance.ensureSbtUniverse = jest.fn();
    instance.hydrateSelectedSbtNames = jest.fn();

    instance.componentDidUpdate(prevProps, prevState);

    expect(ensureLightSbtUniverse).toHaveBeenCalledWith(['edge'], { forceExactSlugs: true });
  });

  it('starts discovery before the initial cold-load option refresh on mount', async () => {
    const instance = makeInstance({
      network: { id: 84532 },
      chainId: null,
    });
    let sawInitialDiscovery = false;
    instance.ensureSbtUniverse = jest.fn(() => {
      sawInitialDiscovery = true;
      instance.setState({ discovering: true });
      return Promise.resolve();
    });
    instance.loadSBTOptions = jest.fn(() => {
      if (sawInitialDiscovery) {
        expect(instance.state.discovering).toBe(true);
      }
      return Promise.resolve(null);
    });
    instance.hydrateSelectedSbtNames = jest.fn();
    instance.getSessionNetworkId = jest.fn(() => 84532);
    const registrySpy = jest
      .spyOn(sessionRegistryUtils, 'loadSessionRegistryCache')
      .mockResolvedValue(null);

    try {
      instance.componentDidMount();
      await Promise.resolve();

      expect(instance.ensureSbtUniverse).toHaveBeenCalled();
      expect(instance.loadSBTOptions).toHaveBeenCalled();
    } finally {
      registrySpy.mockRestore();
    }
  });

  it('skips forced registry cache warm on mount when resolved sessionConfig already covers the target slug', async () => {
    const instance = makeInstance({
      sessionSlug: 'draft-slug',
      network: { id: 84532 },
      chainId: 84532,
      sessionConfig: {
        slug: 'draft-slug',
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000aa',
            chainId: 84532,
          },
        },
      },
    });
    instance.ensureSbtUniverse = jest.fn(() => Promise.resolve());
    instance.loadSBTOptions = jest.fn(() => Promise.resolve(null));
    instance.hydrateSelectedSbtNames = jest.fn();
    instance.getSessionNetworkId = jest.fn(() => 84532);
    const registrySpy = jest
      .spyOn(sessionRegistryUtils, 'loadSessionRegistryCache')
      .mockResolvedValue(null);

    try {
      instance.componentDidMount();
      await Promise.resolve();

      expect(instance.ensureSbtUniverse).toHaveBeenCalled();
      expect(instance.loadSBTOptions).toHaveBeenCalled();
      expect(registrySpy).not.toHaveBeenCalled();
    } finally {
      registrySpy.mockRestore();
    }
  });

  it('still warms the registry cache on mount when no resolved sessionConfig is available', async () => {
    const instance = makeInstance({
      sessionSlug: 'draft-slug',
      network: { id: 84532 },
      chainId: 84532,
      sessionConfig: null,
    });
    instance.ensureSbtUniverse = jest.fn(() => Promise.resolve());
    instance.loadSBTOptions = jest.fn(() => Promise.resolve(null));
    instance.hydrateSelectedSbtNames = jest.fn();
    instance.getSessionNetworkId = jest.fn(() => 84532);
    const registrySpy = jest
      .spyOn(sessionRegistryUtils, 'loadSessionRegistryCache')
      .mockResolvedValue(null);

    try {
      instance.componentDidMount();
      await Promise.resolve();

      expect(registrySpy).toHaveBeenCalledWith({ chainIds: [84532], force: true });
    } finally {
      registrySpy.mockRestore();
    }
  });

  it('reruns discovery and option loading when the global session selection updates after mount', async () => {
    const instance = makeInstance({
      network: { id: 84532 },
      chainId: null,
    });
    instance.ensureSbtUniverse = jest.fn(() => Promise.resolve());
    instance.loadSBTOptions = jest.fn(() => Promise.resolve(null));
    instance.hydrateSelectedSbtNames = jest.fn();
    instance.getSessionNetworkId = jest.fn(() => 84532);
    const registrySpy = jest
      .spyOn(sessionRegistryUtils, 'loadSessionRegistryCache')
      .mockResolvedValue(null);

    try {
      instance.componentDidMount();
      await Promise.resolve();
      instance.ensureSbtUniverse.mockClear();
      instance.loadSBTOptions.mockClear();

      window.dispatchEvent(new CustomEvent(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, {
        detail: {
          selectedSessionScope: 'list',
          selectedSessionSlugs: ['', 'edge'],
        },
      }));
      await Promise.resolve();

      expect(instance.ensureSbtUniverse).toHaveBeenCalledWith({ force: true });
      expect(instance.loadSBTOptions).toHaveBeenCalledWith({ force: true });

      instance.componentWillUnmount();
      instance.ensureSbtUniverse.mockClear();
      instance.loadSBTOptions.mockClear();

      window.dispatchEvent(new CustomEvent(GLOBAL_SESSION_SELECTION_UPDATED_EVENT));
      await Promise.resolve();

      expect(instance.ensureSbtUniverse).not.toHaveBeenCalled();
      expect(instance.loadSBTOptions).not.toHaveBeenCalled();
    } finally {
      registrySpy.mockRestore();
    }
  });

  it('starts a fresh cold-load render in loading state so it cannot show a false empty message', () => {
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['legacyEdge', 'rxc']);

    try {
      const instance = makeInstance({
        sessionSlug: 'edge',
        defaultFeaturedSBTs: [],
      });

      expect(instance.state.loadingOptions).toBe(true);
      expect(instance.isOptionsLoading()).toBe(true);
      expect(instance.getNoOptionsMessage()).toBeNull();

      const tree = instance.render();
      const headerStatusNode = findElement(
        tree,
        (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS
      );
      expect(headerStatusNode).toBeTruthy();
    } finally {
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('reloads options when sessionConfig slug and block limits signature fields change without other request changes', async () => {
    const selectedAddress = '0x2323232323232323232323232323232323232323';
    const selectedLower = selectedAddress.toLowerCase();
    const instance = makeInstance({
      selectedSBTs: [{ address: selectedAddress }],
      defaultFeaturedSBTs: [],
      sbtCacheRevision: 'rev-1',
      sessionConfig: {
        slug: 'draft-slug',
        networkChainId: 84532,
        blockLimits: {
          start: 100,
          end: 200,
        },
        contracts: {
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000aa',
          },
        },
      },
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn(() => 'Resolved Name');
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      '84532': {
        sbtList: {
          [selectedLower]: {
            sbtAddress: selectedAddress,
            sbtInfo: { name: 'Resolved Name', unlisted: false },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    }));
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    try {
      await instance.loadSBTOptions();
      instance.props = {
        ...instance.props,
        sessionConfig: {
          slug: 'draft-slug-v2',
          networkChainId: 84532,
          blockLimits: {
            start: 100,
            end: 200,
          },
          contracts: {
            sbtFactory: {
              address: '0x00000000000000000000000000000000000000aa',
            },
          },
        },
      };
      await instance.loadSBTOptions();

      instance.props = {
        ...instance.props,
        sessionConfig: {
          slug: 'draft-slug-v2',
          networkChainId: 84532,
          blockLimits: {
            start: 101,
            end: 200,
          },
          contracts: {
            sbtFactory: {
              address: '0x00000000000000000000000000000000000000aa',
            },
          },
        },
      };
      await instance.loadSBTOptions();

      instance.props = {
        ...instance.props,
        sessionConfig: {
          slug: 'draft-slug-v2',
          networkChainId: 84532,
          blockLimits: {
            start: 101,
            end: 201,
          },
          contracts: {
            sbtFactory: {
              address: '0x00000000000000000000000000000000000000aa',
            },
          },
        },
      };
      await instance.loadSBTOptions();

      expect(instance.readSbtCacheBySlug).toHaveBeenCalledTimes(4);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('forces universe and options refresh when sessionConfig signature changes in componentDidUpdate', async () => {
    const instance = makeInstance({
      network: { id: 84532 },
      chainId: null,
      sessionConfig: {
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000bb',
          },
        },
      },
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn();
    instance.ensureSbtUniverse = jest.fn();
    instance.hydrateSelectedSbtNames = jest.fn();
    instance.getSessionNetworkId = jest.fn(() => 84532);
    const prevState = { ...instance.state };
    const prevProps = {
      ...instance.props,
      sessionConfig: {
        networkChainId: 84532,
        contracts: {
          sbtFactory: {
            address: '0x00000000000000000000000000000000000000aa',
          },
        },
      },
    };
    const registrySpy = jest
      .spyOn(sessionRegistryUtils, 'loadSessionRegistryCache')
      .mockResolvedValue(null);

    try {
      instance.componentDidUpdate(prevProps, prevState);
      await Promise.resolve();

      expect(instance.loadSBTOptions).toHaveBeenCalledTimes(1);
      expect(instance.ensureSbtUniverse).toHaveBeenCalledWith({ force: true });
      expect(instance.hydrateSelectedSbtNames).toHaveBeenCalledTimes(1);
    } finally {
      registrySpy.mockRestore();
    }
  });

  it('shows an animated loading indicator while options fetch and only shows empty state after load', () => {
    const instance = makeInstance();

    instance.state.loadingOptions = true;
    instance.state.discovering = false;
    instance.state.sbtOptions = [
      { address: '0x1', name: 'One' },
      { address: '0x2', name: 'Two' },
      { address: '0x3', name: 'Three' },
    ];
    expect(instance.getNoOptionsMessage()).toBeNull();
    const loadingNode = instance.getLoadingMessage();
    const loadingTextNode = findElement(
      loadingNode,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING
    );
    const spinnerNode = findElement(
      loadingNode,
      (node) => node?.props?.icon?.iconName === 'spinner'
    );
    expect(loadingTextNode).toBeTruthy();
    expect(spinnerNode).toBeTruthy();
    expect(JSON.stringify(loadingTextNode.props.children)).toContain('Loading 3');

    const tree = instance.render();
    const headerStatusNode = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS
    );
    expect(headerStatusNode).toBeTruthy();
    expect(JSON.stringify(headerStatusNode.props.children)).toContain('3');

    instance.state.loadingOptions = false;
    instance.state.discovering = false;
    expect(instance.getNoOptionsMessage()).toBe('No Groups');
  });

  it('uses terminology-aware unnamed fallback labels when no display name is available', () => {
    const instance = makeInstance();

    expect(instance.resolveSbtLabel(null, '')).toBe('Unnamed Group');
  });
});
