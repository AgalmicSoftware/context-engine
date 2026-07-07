import SBTSelector from './SBTSelector';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as contractScriptsUtils from '../../utilities/web3/chainGateway.js';
import { makeInstance, createDeferred, flushAsync } from './SBTSelector.testUtils';

const makeLegacyRegistrySessionConfig = (slug = 'edge', networkChainId = 84532) => ({
  slug,
  networkChainId,
  __registry: {
    chainId: networkChainId,
    sessionIdHex: `0x${'1'.repeat(64)}`,
  },
});

const makeRegistrySbtInstance = (props = {}) => {
  const slug = props.sessionSlug || 'edge';
  return makeInstance({
    ...props,
    sessionConfig: makeLegacyRegistrySessionConfig(slug, props.chainId || props.network?.id || 84532),
  });
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
    try {
      delete globalThis.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS;
    } catch (_) {}
  });

  it('does not use demo-session metadata for labels when the strict shared lookup misses in live mode', () => {
    const instance = makeInstance();
    const strictSpy = jest.spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault').mockReturnValueOnce(null);
    const demoSpy = jest.spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug').mockReturnValueOnce({
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

  it('fails closed instead of using wallet or demo metadata when strict session lookup misses in live mode', () => {
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
    const chainSpy = jest.spyOn(contractScriptsUtils, 'getSessionChainId').mockReturnValueOnce(null);
    const demoSpy = jest.spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug').mockReturnValue({
      slug: 'rxc',
      networkChainId: 777777,
    });

    try {
      expect(instance.getSessionNetworkId('rxc')).toBe(10);
      expect(instance.getMetadataLookupConfig('rxc')).toEqual(
        expect.objectContaining({
          slug: 'rxc',
          networkChainId: 10,
          __registry: expect.objectContaining({
            chainId: 10,
          }),
        }),
      );
      expect(demoSpy).not.toHaveBeenCalled();
    } finally {
      strictSpy.mockRestore();
      chainSpy.mockRestore();
      demoSpy.mockRestore();
    }
  });

  it('keeps unresolved live-mode placeholders and fails closed instead of inheriting a default chain', () => {
    const instance = makeInstance({
      sessionSlug: 'legacyEdge',
      sessionConfig: null,
      chainId: null,
      network: null,
    });
    const strictSpy = jest.spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault').mockReturnValue({
      slug: 'legacyEdge',
      contracts: {},
      __unresolved: true,
    });
    const demoSpy = jest.spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug').mockReturnValue({
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
      expect(instance.getDisplayLookupSessionConfig('legacyEdge')).toEqual(
        expect.objectContaining({
          slug: 'legacyEdge',
          __unresolved: true,
        }),
      );
      expect(instance.getSessionNetworkId('legacyEdge')).toBe(DEFAULT_CHAIN_ID);
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
    instance.state.sbtOptions = [
      {
        address: selectedAddress.toLowerCase(),
        name: 'Debate Badge',
        sessionSlug: 'edge',
        sessionName: 'Weyl v. Yarvin Debate',
      },
    ];

    const slugByNameSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionSlugByName')
      .mockImplementation((name) => (name === 'Weyl v. Yarvin Debate' ? 'debate' : null));

    try {
      await instance.handleSBTSelection({ value: selectedAddress });

      expect(onAddSBT).toHaveBeenCalledWith(
        expect.objectContaining({
          address: selectedAddress.toLowerCase(),
          sessionSlug: 'debate',
          sessionName: 'Weyl v. Yarvin Debate',
        }),
      );
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
    instance.state.sbtOptions = [
      {
        address: selectedAddress.toLowerCase(),
        name: 'Demo Badge',
        sessionSlug: 'demo',
        sessionBindingSlug: 'demo',
        sessionName: 'Demo Session',
        chainId: 84532,
        selectionKey: `84532:${selectedAddress.toLowerCase()}`,
      },
    ];

    await instance.handleSBTSelection({
      value: selectedAddress,
      selectionKey: `84532:${selectedAddress.toLowerCase()}`,
    });

    expect(onAddSBT).toHaveBeenCalledWith(
      expect.objectContaining({
        address: selectedAddress.toLowerCase(),
        sessionSlug: 'demo',
        sessionBindingSlug: 'demo',
      }),
    );
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
      expect(onAddSBT).toHaveBeenCalledWith(
        expect.objectContaining({
          address: selectedAddress.toLowerCase(),
          name: 'Deferred Badge',
        }),
      );
    } finally {
      hydrateSpy.mockRestore();
    }
  });

  it('dedupes custom SBT additions by chain-scoped selection key', async () => {
    const selectedAddress = '0x3434343434343434343434343434343434343434';
    const selectedAddressLower = selectedAddress.toLowerCase();
    const onAddSBT = jest.fn();
    const instance = makeInstance({
      selectedSBTs: [
        {
          address: selectedAddressLower,
          chainId: 84532,
          selectionKey: `84532:${selectedAddressLower}`,
        },
      ],
      onAddSBT,
      sessionSlug: 'op-session',
      network: { id: 11155420 },
    });
    instance.state.customSBTAddress = selectedAddress;
    instance.getSessionNetworkId = jest.fn(() => 11155420);
    instance.readSbtCacheBySlug = jest.fn(async () => ({}));

    const hydrateSpy = jest.spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted').mockResolvedValue({
      info: {
        name: 'OP Badge',
        chainID: 11155420,
      },
    });

    try {
      await instance.handleAddCustomSBT();

      expect(onAddSBT).toHaveBeenCalledTimes(1);
      expect(onAddSBT).toHaveBeenCalledWith(
        expect.objectContaining({
          address: selectedAddressLower,
          chainId: 11155420,
          name: 'OP Badge',
          selectionKey: `11155420:${selectedAddressLower}`,
        }),
      );
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
      'edge',
    );

    expect(label).toBe('[encrypted]');
  });

  it('sorts masked encrypted SBT options to the bottom of the dropdown even when featured', async () => {
    const visibleAddress = '0x1010101010101010101010101010101010101010';
    const encryptedAddress = '0x2020202020202020202020202020202020202020';
    const visibleLower = visibleAddress.toLowerCase();
    const encryptedLower = encryptedAddress.toLowerCase();
    const instance = makeRegistrySbtInstance({
      defaultFeaturedSBTs: [encryptedAddress],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      84532: {
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

      expect(instance.state.sbtOptions.map((entry) => entry.address)).toEqual([visibleLower, encryptedLower]);
      expect(instance.state.sbtOptions.map((entry) => entry.name)).toEqual(['Visible Group', '[encrypted]']);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('does not sink locked-name SBTs when the visible title has been decrypted', async () => {
    const visibleLockedAddress = '0x3030303030303030303030303030303030303030';
    const plainAddress = '0x4040404040404040404040404040404040404040';
    const visibleLockedLower = visibleLockedAddress.toLowerCase();
    const plainLower = plainAddress.toLowerCase();
    const instance = makeRegistrySbtInstance({
      defaultFeaturedSBTs: [visibleLockedAddress],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      84532: {
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

      expect(instance.state.sbtOptions.map((entry) => entry.address)).toEqual([visibleLockedLower, plainLower]);
      expect(instance.state.sbtOptions.map((entry) => entry.name)).toEqual(['Visible Locked Group', 'Plain Group']);
    } finally {
      groupListsSpy.mockRestore();
    }
  });

  it('avoids redundant selectedOption rerender state writes when hydration succeeds', async () => {
    const selectedAddress = '0x7777777777777777777777777777777777777777';
    const instance = makeRegistrySbtInstance({
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
    const instance = makeRegistrySbtInstance({
      selectedSBTs: [{ address: selectedAddress, name: staleLabel }],
      defaultFeaturedSBTs: [],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.readSbtCacheBySlug = jest.fn(async () => ({
      84532: {
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

    expect(instance.state.sbtOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          address: selectedLower,
          name: resolvedLabel,
        }),
      ]),
    );

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
    const instance = makeRegistrySbtInstance({
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
    const instance = makeRegistrySbtInstance({
      selectedSBTs: [{ address: selectedAddress }],
    });
    instance._isMounted = true;
    instance.getEffectiveGroupSlug = () => 'edge';
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = () => ({ slug: 'edge', networkChainId: 84532 });
    instance.scheduleSelectedSbtHydrationRetry = jest.fn();
    instance.loadSBTOptions = jest.fn();

    const warmSpy = jest.spyOn(sbtDisplayNameUtils, 'warmSbtDisplayNamesTargeted').mockResolvedValueOnce([]);

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
    const instance = makeRegistrySbtInstance({
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
      84532: {
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
});
