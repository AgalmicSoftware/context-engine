import SBTSelector from './SBTSelector';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as contractScriptsUtils from '../../utilities/web3/contractScripts.js';
import * as sessionScanScopeUtils from '../../utilities/session/sessionScanScope.js';
import * as cacheScriptsUtils from '../../utilities/cache/cacheScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { makeInstance, findElement, createDeferred, flushAsync } from './SBTSelector.testUtils';

describe('SBTSelector scoped options', () => {
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
          84532: {
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
          84532: {
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
        84532: {
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('all');
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
          84532: {
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
        84532: {
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('general');

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

    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['alpha', 'beta']);
    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValue([]);

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

    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['alpha']);
    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValue([]);

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

    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['alpha']);
    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValue([]);

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

    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['demo']);
    const allSlugsSpy = jest.spyOn(contractScriptsUtils, 'getAllSessionSlugs').mockReturnValue(['demo', 'alpha']);
    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValue([]);

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
        84532: {
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
    const writeSpy = jest.spyOn(cacheScriptsUtils, 'writeCache').mockImplementation(async (_namespace, slug, value) => {
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
        84532: {
          sbtList: {},
          nameLookupState: {},
        },
      },
    };
    const ensureLightSbtUniverse = jest.fn(async () => {
      cacheStore.edge = {
        84532: {
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
    instance.scheduleProgressiveOptionsReload = jest.fn(({ force = false } = {}) => instance.loadSBTOptions({ force }));
    instance.readSbtCacheBySlug = jest.fn(async (slug) => cacheStore[slug] || {});

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const writeSpy = jest.spyOn(cacheScriptsUtils, 'writeCache').mockImplementation(async (_namespace, slug, value) => {
      cacheStore[slug] = value;
      return value;
    });
    const discoverSpy = jest
      .spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached')
      .mockImplementation(async (_provider, _cfg, options = {}) => {
        options.onDiscoveredAddresses?.({ addresses: [address] });
        return [address];
      });
    const hydrateSpy = jest.spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted').mockResolvedValue({
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
      expect(instance.state.sbtOptions[0]).toEqual(
        expect.objectContaining({
          address: lower,
          name: 'Shared Progressive Badge',
        }),
      );
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
      84532: {
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['alpha']);
    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockImplementation((slug) =>
        slug === 'alpha'
          ? { featured_SBTs_LIST: [featuredAddress], ignored_SBTs_LIST: [] }
          : { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] },
      );
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
        (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS,
      );
      expect(headerStatusNode).toBeTruthy();

      featuredLookup.resolve({
        info: { name: 'Featured Badge', sessionSlug: 'alpha', sessionSlugExplicit: true, unlisted: false },
      });
      await pending;

      expect(instance.state.loadingOptions).toBe(false);
      expect(instance.state.sbtOptions.map((option) => option.address)).toEqual([featuredLower, cachedLower]);
      expect(instance.state.sbtOptions[0]).toEqual(
        expect.objectContaining({
          address: featuredLower,
          name: 'Featured Badge',
        }),
      );
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
          84532: {
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
        84532: {
          sbtList: {},
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['general']);

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
    instance.getSessionNetworkId = (slug) => (String(slug || '').trim() === 'beta' ? 10 : 84532);
    instance.getMetadataLookupConfig = (slug) => ({
      slug,
      networkChainId: instance.getSessionNetworkId(slug),
    });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === 'beta') {
        return {
          10: {
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
        84532: {
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['alpha', 'beta']);
    const namespaceSpy = jest.spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync').mockReturnValue([]);

    try {
      await instance.loadSBTOptions({ force: true });

      expect(instance.state.sbtOptions).toHaveLength(2);
      expect(instance.state.sbtOptions.map((entry) => entry.name).sort()).toEqual(['Alpha Badge', 'Beta Badge']);
      expect(instance.state.sbtOptions.map((entry) => entry.selectionKey).sort()).toEqual([
        `10:${sharedLower}`,
        `84532:${sharedLower}`,
      ]);
      expect(instance.state.sbtOptions.map((entry) => entry.chainId).sort((left, right) => left - right)).toEqual([
        10, 84532,
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
          84532: {
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
        84532: {
          sbtList: {},
          nameLookupState: {},
        },
      };
    });

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockImplementation((slug) =>
        slug === 'beta'
          ? { featured_SBTs_LIST: [], ignored_SBTs_LIST: [ignoredAddress] }
          : { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] },
      );
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['beta']);
    const namespaceSpy = jest.spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync').mockReturnValue([]);

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
      84532: {
        sbtList: {},
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['demo']);
    const namespaceSpy = jest.spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync').mockReturnValue([
      {
        namespace: 'sbtCache',
        slug: 'archive',
        key: 'dg:sbtCache:archive',
        value: {
          84532: {
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
      84532: {
        sbtList: {},
        nameLookupState: {},
      },
    }));

    const groupListsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['demo']);
    const slugByNameSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionSlugByName')
      .mockImplementation((name) => (name === 'Demo Session' ? 'demo' : null));
    const namespaceSpy = jest.spyOn(cacheScriptsUtils, 'listNamespaceEntriesSync').mockReturnValue([
      {
        namespace: 'sbtCache',
        slug: 'archive',
        key: 'dg:sbtCache:archive',
        value: {
          84532: {
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
          84532: {
            sbtList: {},
            nameLookupState: {},
          },
        };
      }
      return {
        84532: {
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['demo']);

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
          84532: {
            sbtList: {},
            nameLookupState: {},
          },
        };
      }
      return {
        84532: {
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['demo']);
    const hydrateSpy = jest.spyOn(sbtDisplayNameUtils, 'hydrateSbtDisplayNameTargeted').mockResolvedValue(null);

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
      hydrateSpy.mockRestore();
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
      additionalSBTOptions: [
        {
          address: featuredAddress,
          name: 'Featured Additional',
        },
      ],
    });
    instance._isMounted = true;
    instance.getSessionNetworkId = () => 84532;
    instance.getMetadataLookupConfig = (slug) => ({ slug, networkChainId: 84532 });
    instance.resolveSbtLabel = jest.fn((sbtInfo, address) => sbtInfo?.name || address);
    instance.readSbtCacheBySlug = jest.fn(async (cacheSlug) => {
      if (cacheSlug === 'alpha') {
        return {
          84532: {
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
        84532: {
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
      .mockImplementation((slug) =>
        slug === 'alpha'
          ? { featured_SBTs_LIST: [featuredAddress], ignored_SBTs_LIST: [] }
          : { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] },
      );
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['alpha']);

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
      84532: {
        sbtList: {},
        nameLookupState: {},
      },
    }));

    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['edge']);
    const listsSpy = jest
      .spyOn(contractScriptsUtils, 'getSessionLists')
      .mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    const strictSpy = jest.spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
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
    const demoSpy = jest.spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug').mockReturnValue(null);
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

      expect(instance.state.sbtOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            address: featuredLower,
            name: 'Scoped Default Featured',
            sessionSlug: 'edge',
          }),
        ]),
      );
      expect(hydrateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          address: featuredAddress,
          preferredSlug: 'edge',
        }),
      );
    } finally {
      hydrateSpy.mockRestore();
      demoSpy.mockRestore();
      strictSpy.mockRestore();
      listsSpy.mockRestore();
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });
});
