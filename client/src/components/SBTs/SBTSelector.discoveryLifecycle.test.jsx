import SBTSelector from './SBTSelector';
import * as contractScriptsUtils from '../../utilities/web3/chainGateway.js';
import * as sessionRegistryUtils from '../../utilities/web3/sessionRegistry.js';
import * as sessionScanScopeUtils from '../../utilities/session/sessionScanScope.js';
import { GLOBAL_SESSION_SELECTION_UPDATED_EVENT } from '../../utilities/session/globalSessionState.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { makeInstance, findElement } from './SBTSelector.testUtils';

describe('SBTSelector discovery lifecycle', () => {
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

  it('collapses scoped discovery to the manually selected source group', async () => {
    const instance = makeInstance({
      sessionSlug: 'edge',
      enableGroupSelect: true,
    });
    instance._isMounted = false;
    instance.loadSBTOptions = jest.fn().mockResolvedValue(null);
    instance.state.groupOverride = true;
    instance.state.sourceSessionSlug = 'beta';

    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);
    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValue([]);

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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('all');
    let allSlugs = ['edge', 'alpha'];
    const allSlugsSpy = jest.spyOn(contractScriptsUtils, 'getAllSessionSlugs').mockImplementation(() => allSlugs);

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
    const cacheReadError = new Error('cache read failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    instance.readSbtCacheBySlug = jest
      .fn()
      .mockResolvedValueOnce(cachedValue)
      .mockRejectedValueOnce(cacheReadError)
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
      expect(consoleErrorSpy).toHaveBeenCalledWith('[sbt]', 'SBTSelector option load failed:', cacheReadError);
    } finally {
      consoleErrorSpy.mockRestore();
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
    };
    instance.readSbtCacheBySlug = jest
      .fn()
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
      expect(instance.getSessionNetworkId('new-slug-not-yet-published')).toBe(DEFAULT_CHAIN_ID);
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

    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValueOnce([]);

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
        }),
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

    const strictSpy = jest.spyOn(contractScriptsUtils, 'getSessionConfigBySlugOrDefault').mockReturnValue(null);
    const chainSpy = jest.spyOn(contractScriptsUtils, 'getSessionChainId').mockReturnValue(null);
    const demoSpy = jest.spyOn(contractScriptsUtils, 'getDemoSessionConfigBySlug').mockReturnValue({
      slug: 'rxc',
      networkChainId: 777777,
      contracts: {
        sbtFactory: {
          address: '0x00000000000000000000000000000000000000bb',
          chainId: 777777,
        },
      },
    });
    const discoverSpy = jest.spyOn(contractScriptsUtils.default, 'getAllSbtAddressesCached').mockResolvedValueOnce([]);

    try {
      await instance.ensureSbtUniverse({ force: true });

      expect(discoverSpy).toHaveBeenCalledWith(
        'none',
        expect.objectContaining({
          slug: 'rxc',
          networkChainId: DEFAULT_CHAIN_ID,
        }),
        expect.objectContaining({
          onDiscoveredAddresses: expect.any(Function),
        }),
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
    const registrySpy = jest.spyOn(sessionRegistryUtils, 'loadSessionRegistryCache').mockResolvedValue(null);

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
    const registrySpy = jest.spyOn(sessionRegistryUtils, 'loadSessionRegistryCache').mockResolvedValue(null);

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
    const registrySpy = jest.spyOn(sessionRegistryUtils, 'loadSessionRegistryCache').mockResolvedValue(null);

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
    const registrySpy = jest.spyOn(sessionRegistryUtils, 'loadSessionRegistryCache').mockResolvedValue(null);

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
    const registrySpy = jest.spyOn(sessionRegistryUtils, 'loadSessionRegistryCache').mockResolvedValue(null);

    try {
      instance.componentDidMount();
      await Promise.resolve();
      instance.ensureSbtUniverse.mockClear();
      instance.loadSBTOptions.mockClear();

      window.dispatchEvent(
        new CustomEvent(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, {
          detail: {
            selectedSessionScope: 'list',
            selectedSessionSlugs: ['', 'edge'],
          },
        }),
      );
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
    const scopeSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanScope').mockReturnValue('list');
    const slugsSpy = jest.spyOn(sessionScanScopeUtils, 'readSessionScanSlugs').mockReturnValue(['legacyEdge', 'rxc']);

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
        (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS,
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
    const registrySpy = jest.spyOn(sessionRegistryUtils, 'loadSessionRegistryCache').mockResolvedValue(null);

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
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING,
    );
    const spinnerNode = findElement(loadingNode, (node) => node?.props?.icon?.iconName === 'spinner');
    expect(loadingTextNode).toBeTruthy();
    expect(spinnerNode).toBeTruthy();
    expect(JSON.stringify(loadingTextNode.props.children)).toContain('Loading 3');

    const tree = instance.render();
    const headerStatusNode = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === E2E_TESTIDS.SBT_SELECTOR_LOADING_STATUS,
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
