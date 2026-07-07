import store from '../../store.js';
import contractScripts from './contractScripts.js';
import { getReadProviderDiagnostics, getReadProviderForGroup, resolveGroupPathRpcPreference } from './rpcProviders.js';
import { checkSponsoredAccess } from './sponsoredAccess.js';

jest.mock('./chainGateway.js', () => ({
  __esModule: true,
  default: {
    userHasSBT: jest.fn(),
  },
}));

const ROOT_RPC_URL = 'https://session-sponsored.example/rpc';
const FAILING_ROOT_RPC_URL = 'https://session-sponsored-failing.example/rpc';
const PATH_DEFAULT_BASE_SEPOLIA = 'https://base-sepolia-testnet.api.pocket.network';
const RESTRICTED_SBT = '0x0000000000000000000000000000000000000A11';
const OTHER_RESTRICTED_SBT = '0x0000000000000000000000000000000000000A12';
const CUSTOM_PATH_RPC_URL = 'https://custom-path.example/rpc';
const BASE_SEPOLIA_NETWORK = { chainId: 84532, name: 'base-sepolia' };

const buildGroupCfg = (overrides = {}) => {
  const base = {
    slug: 'session-sponsored-rpc',
    networkChainId: 84532,
    blockLimits: {
      start: 1,
      end: null,
    },
    contracts: {
      sbtFactory: {
        address: '0x00000000000000000000000000000000000000aa',
        chainId: 84532,
      },
      surveys: {
        address: '0x00000000000000000000000000000000000000ab',
        chainId: 84532,
      },
    },
  };
  return {
    ...base,
    ...overrides,
    contracts: {
      ...(base.contracts || {}),
      ...(overrides.contracts || {}),
      sbtFactory: {
        ...(base.contracts?.sbtFactory || {}),
        ...(overrides.contracts?.sbtFactory || {}),
      },
      surveys: {
        ...(base.contracts?.surveys || {}),
        ...(overrides.contracts?.surveys || {}),
      },
    },
  };
};

const buildWizardShapedRpcCfg = ({
  slug = 'session-sponsored-rpc-wizard-shape',
  rootRpcUrl = ROOT_RPC_URL,
  pathRpcUrl = PATH_DEFAULT_BASE_SEPOLIA,
  registry = null,
} = {}) =>
  buildGroupCfg({
    slug,
    rpcUrl: rootRpcUrl,
    rpcEndpoint: rootRpcUrl,
    rpc: {
      provider: 'path',
      providers: {
        path: {
          rpcUrl: pathRpcUrl,
        },
      },
    },
    ...(registry ? { __registry: registry } : {}),
  });

const pinMockProviderNetwork = (provider) => {
  provider.detectNetwork = jest.fn(async () => BASE_SEPOLIA_NETWORK);
  provider.getNetwork = jest.fn(async () => BASE_SEPOLIA_NETWORK);
};

describe('rpcProviders session-sponsored reads', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    contractScripts.userHasSBT.mockReset();
    try {
      delete globalThis.ethereum;
    } catch (_) {}
    try {
      globalThis.CE_RPC_PROVIDER_MODE = 'fallback';
    } catch (_) {}
    try {
      globalThis.CE_PREFER_PATH_RPC = true;
    } catch (_) {}
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      delete globalThis.ethereum;
    } catch (_) {}
    try {
      delete globalThis.CE_RPC_PROVIDER_MODE;
    } catch (_) {}
    try {
      delete globalThis.CE_PREFER_PATH_RPC;
    } catch (_) {}
  });

  it('does not use Session Wizard root rpcUrl for ordinary participant reads', () => {
    const cfg = buildGroupCfg({
      rpcUrl: ROOT_RPC_URL,
    });

    const provider = getReadProviderForGroup(cfg);

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'unavailable',
        sessionAccessMode: 'none',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
    expect(provider?.__CE_RPC_META?.preferredUrls).toContain(PATH_DEFAULT_BASE_SEPOLIA);
  });

  it('prefers sponsored session root RPC over the wizard default PATH mirror when the rpc gate is open', () => {
    const cfg = buildWizardShapedRpcCfg({
      slug: 'session-sponsored-rpc-open-wizard-default-path',
      registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const pref = resolveGroupPathRpcPreference(cfg, 84532);
    const diagnostics = getReadProviderDiagnostics(84532, pref || {});
    const provider = getReadProviderForGroup(cfg);

    expect(diagnostics.providerLabel).toBe('session');
    expect(diagnostics.urls[0]).toBe(ROOT_RPC_URL);
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'session',
        preferredUrls: expect.arrayContaining([ROOT_RPC_URL, PATH_DEFAULT_BASE_SEPOLIA]),
        sessionAccessStatus: 'open',
        sessionRpcSource: 'root',
      }),
    );
    expect(provider?.__CE_RPC_CACHE_KEY).not.toContain(cfg.slug);
  });

  it('falls back to public PATH reads when the sponsored root RPC returns a malformed call exception', async () => {
    const cfg = buildWizardShapedRpcCfg({
      slug: 'session-sponsored-rpc-open-failing-root',
      rootRpcUrl: FAILING_ROOT_RPC_URL,
      registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const provider = getReadProviderForGroup(cfg);
    const rootConfig = provider.providerConfigs.find(
      (entry) => entry?.provider?.connection?.url === FAILING_ROOT_RPC_URL,
    );
    const pathConfig = provider.providerConfigs.find(
      (entry) => entry?.provider?.connection?.url === PATH_DEFAULT_BASE_SEPOLIA,
    );
    pinMockProviderNetwork(provider);
    pinMockProviderNetwork(rootConfig.provider);
    pinMockProviderNetwork(pathConfig.provider);

    const sponsoredError = new Error(
      'missing revert data in call exception; Transaction reverted without a reason string',
    );
    sponsoredError.code = 'CALL_EXCEPTION';
    rootConfig.provider.send = jest.fn(async (method) => {
      if (method === 'eth_chainId') return '0x14a34';
      if (method === 'net_version') return '84532';
      throw sponsoredError;
    });
    pathConfig.provider.send = jest.fn(async (method) => {
      if (method === 'eth_chainId') return '0x14a34';
      if (method === 'net_version') return '84532';
      if (method === 'eth_blockNumber') return '0x64';
      return '0x';
    });

    await expect(provider.getBlockNumber()).resolves.toBe(100);
    expect(rootConfig.provider.send).toHaveBeenCalledWith('eth_blockNumber', []);
    expect(pathConfig.provider.send).toHaveBeenCalledWith('eth_blockNumber', []);
  });

  it('keeps a truly custom PATH override ahead of sponsored session root RPC', () => {
    const cfg = buildWizardShapedRpcCfg({
      slug: 'session-sponsored-rpc-open-custom-path',
      pathRpcUrl: CUSTOM_PATH_RPC_URL,
      registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const pref = resolveGroupPathRpcPreference(cfg, 84532);
    const diagnostics = getReadProviderDiagnostics(84532, pref || {});
    const provider = getReadProviderForGroup(cfg);

    expect(diagnostics.providerLabel).toBe('path');
    expect(diagnostics.urls[0]).toBe(CUSTOM_PATH_RPC_URL);
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        preferredUrls: expect.arrayContaining([CUSTOM_PATH_RPC_URL]),
        sessionAccessStatus: 'open',
        sessionRpcSource: 'path',
      }),
    );
  });

  it('keeps the default PATH RPC when sponsored session root access is unavailable', () => {
    const cfg = buildWizardShapedRpcCfg({
      slug: 'session-sponsored-rpc-unavailable-wizard-default-path',
    });

    const pref = resolveGroupPathRpcPreference(cfg, 84532);
    const diagnostics = getReadProviderDiagnostics(84532, pref || {});
    const provider = getReadProviderForGroup(cfg);

    expect(diagnostics.providerLabel).toBe('path');
    expect(diagnostics.urls[0]).toBe(PATH_DEFAULT_BASE_SEPOLIA);
    expect(diagnostics.urls).not.toContain(ROOT_RPC_URL);
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        preferredUrls: expect.arrayContaining([PATH_DEFAULT_BASE_SEPOLIA]),
        sessionAccessStatus: 'unavailable',
        sessionRpcSource: 'default-path',
      }),
    );
  });

  it('shares the cached provider across non-sponsored sessions with identical PATH inputs', () => {
    const cfgA = buildWizardShapedRpcCfg({
      slug: 'session-sponsored-rpc-unavailable-shared-path-a',
    });
    const cfgB = buildWizardShapedRpcCfg({
      slug: 'session-sponsored-rpc-unavailable-shared-path-b',
    });

    const providerA = getReadProviderForGroup(cfgA);
    const providerB = getReadProviderForGroup(cfgB);

    expect(providerA).toBe(providerB);
    expect(providerA?.__CE_RPC_CACHE_KEY).toBe(providerB?.__CE_RPC_CACHE_KEY);
    expect(providerA?.__CE_RPC_CACHE_KEY).not.toContain(cfgA.slug);
    expect(providerA?.__CE_RPC_CACHE_KEY).not.toContain(cfgB.slug);
    expect(providerA?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'unavailable',
        sessionAccessMode: 'none',
        sessionRpcSource: 'default-path',
      }),
    );
  });

  it('does not promote top-level rpcUrlsByChainId for worker-only sponsored RPC without an on-chain gate', () => {
    const cfg = buildGroupCfg({
      sponsoredKeys: { rpc: true },
      rpcUrlsByChainId: {
        84532: ['  https://session-map.example/rpc  '],
      },
    });

    const pref = resolveGroupPathRpcPreference(cfg, 84532);
    const provider = getReadProviderForGroup(cfg);
    const diagnostics = getReadProviderDiagnostics(84532, pref);

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'unavailable',
        sessionAccessMode: 'none',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain('https://session-map.example/rpc');
    expect(provider?.__CE_RPC_META?.preferredUrls).toContain(PATH_DEFAULT_BASE_SEPOLIA);
    expect(diagnostics.urls).not.toContain('https://session-map.example/rpc');
    expect(diagnostics.urls).toContain(PATH_DEFAULT_BASE_SEPOLIA);
  });

  it('uses worker-overlay rpcEndpoint for explicit on-chain open sponsored session reads', () => {
    const cfg = buildGroupCfg({
      rpcEndpoint: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const provider = getReadProviderForGroup(cfg);

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'session',
        preferredUrls: expect.arrayContaining([ROOT_RPC_URL]),
        sessionAccessStatus: 'open',
        sessionRpcSource: 'root',
      }),
    );
  });

  it('fails closed for restricted sponsored session RPC until access is verified', () => {
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account: '0x00000000000000000000000000000000000000a1',
      },
    });

    const cfg = buildGroupCfg({
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const provider = getReadProviderForGroup(cfg);

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'checking',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
    expect(provider?.__CE_RPC_META?.preferredUrls).toContain(PATH_DEFAULT_BASE_SEPOLIA);
  });

  it('uses the default session gate for sponsored RPC when the rpc resource gate is unset', async () => {
    const account = '0x00000000000000000000000000000000000000c1';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockResolvedValue(true);

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-default-gate',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const initialProvider = getReadProviderForGroup(cfg);

    expect(initialProvider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'checking',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(initialProvider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);

    const access = await checkSponsoredAccess({
      sessionConfig: cfg,
      sessionSlug: cfg.slug,
      account,
      resourceKey: 'rpc',
    });
    const provider = getReadProviderForGroup(cfg);

    expect(access.status).toBe('granted');
    expect(contractScripts.userHasSBT).toHaveBeenCalledWith('none', RESTRICTED_SBT, account, 0, 'latest', cfg);
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'session',
        sessionAccessStatus: 'granted',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'root',
        preferredUrls: expect.arrayContaining([ROOT_RPC_URL]),
      }),
    );
  });

  it('keeps sponsored-restricted session cache keys isolated by slug', () => {
    const account = '0x00000000000000000000000000000000000000aa';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockImplementation(() => new Promise(() => {}));

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-checking-cache-key',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const provider = getReadProviderForGroup(cfg);

    expect(provider?.__CE_RPC_CACHE_KEY).toContain(`:${cfg.slug}:`);
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        sessionAccessStatus: 'checking',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }),
    );
  });

  it('prunes stuck transition-state providers after the TTL window', () => {
    jest.useFakeTimers();
    try {
      const reduxAccount = '0x00000000000000000000000000000000000000ba';
      const selectedAccount = '0x00000000000000000000000000000000000000bb';
      jest.spyOn(store, 'getState').mockReturnValue({
        profile: {
          account: reduxAccount,
        },
      });
      globalThis.ethereum = {
        selectedAddress: selectedAccount,
      };

      const cfg = buildGroupCfg({
        slug: 'session-sponsored-rpc-checking-ttl-prune',
        rpcUrl: ROOT_RPC_URL,
        sponsoredKeys: { rpc: true },
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            rpc: {
              lookupStatus: 'ok',
              sbtAddresses: [RESTRICTED_SBT],
              mode: 'any',
              chainId: 84532,
            },
          },
        },
      });

      const firstProvider = getReadProviderForGroup(cfg);

      expect(firstProvider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          sessionAccessStatus: 'checking',
        }),
      );
      expect(firstProvider?.__CE_RPC_CACHE_KEY).toContain(`:${cfg.slug}:`);

      jest.advanceTimersByTime(60_000);

      const nextProvider = getReadProviderForGroup(cfg);

      expect(nextProvider?.__CE_RPC_CACHE_KEY).toBe(firstProvider?.__CE_RPC_CACHE_KEY);
      expect(nextProvider).not.toBe(firstProvider);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps transition-state providers isolated per session slug when one session resolves', async () => {
    const account = '0x00000000000000000000000000000000000000a9';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockImplementation((_providerName, sbtAddress) => {
      if (sbtAddress === RESTRICTED_SBT) {
        return Promise.resolve(true);
      }
      if (sbtAddress === OTHER_RESTRICTED_SBT) {
        return new Promise(() => {});
      }
      return Promise.resolve(false);
    });

    const cfgA = buildGroupCfg({
      slug: 'session-sponsored-rpc-checking-isolated-a',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });
    const cfgB = buildGroupCfg({
      slug: 'session-sponsored-rpc-checking-isolated-b',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [OTHER_RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const providerA = getReadProviderForGroup(cfgA);
    const providerB = getReadProviderForGroup(cfgB);

    expect(providerA).not.toBe(providerB);
    expect(providerA?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        sessionAccessStatus: 'checking',
      }),
    );
    expect(providerB?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        sessionAccessStatus: 'checking',
      }),
    );

    const access = await checkSponsoredAccess({
      sessionConfig: cfgA,
      sessionSlug: cfgA.slug,
      account,
      resourceKey: 'rpc',
    });
    const nextProviderB = getReadProviderForGroup(cfgB);

    expect(access.status).toBe('granted');
    expect(nextProviderB).toBe(providerB);
    expect(nextProviderB?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        sessionAccessStatus: 'checking',
        sessionRpcSource: 'default-path',
      }),
    );
  });

  it('switches diagnostics to the session root RPC after restricted access transitions from checking to granted', async () => {
    const account = '0x00000000000000000000000000000000000000a8';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockResolvedValue(true);

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-checking-to-granted',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const initialProvider = getReadProviderForGroup(cfg);
    const initialPref = resolveGroupPathRpcPreference(cfg, 84532);
    const initialDiagnostics = getReadProviderDiagnostics(84532, initialPref || {});

    expect(initialProvider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'checking',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(initialDiagnostics.sessionRpcSource).toBe('default-path');
    expect(initialDiagnostics.urls[0]).toBe(PATH_DEFAULT_BASE_SEPOLIA);

    const access = await checkSponsoredAccess({
      sessionConfig: cfg,
      sessionSlug: cfg.slug,
      account,
      resourceKey: 'rpc',
    });
    const nextPref = resolveGroupPathRpcPreference(cfg, 84532);
    const nextDiagnostics = getReadProviderDiagnostics(84532, nextPref || {});
    const nextProvider = getReadProviderForGroup(cfg);

    expect(access.status).toBe('granted');
    expect(nextDiagnostics.providerLabel).toBe('session');
    expect(nextDiagnostics.sessionRpcSource).toBe('root');
    expect(nextDiagnostics.urls[0]).toBe(ROOT_RPC_URL);
    expect(nextProvider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'session',
        sessionAccessStatus: 'granted',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'root',
        preferredUrls: expect.arrayContaining([ROOT_RPC_URL]),
      }),
    );
    expect(nextProvider?.__CE_RPC_CACHE_KEY).not.toContain(cfg.slug);
  });

  it('uses restricted sponsored session RPC after a cached wallet grant', async () => {
    const account = '0x00000000000000000000000000000000000000a2';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockResolvedValue(true);

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-granted',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const access = await checkSponsoredAccess({
      sessionConfig: cfg,
      sessionSlug: cfg.slug,
      account,
      resourceKey: 'rpc',
    });
    const provider = getReadProviderForGroup(cfg);

    expect(access.status).toBe('granted');
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'session',
        preferredUrls: expect.arrayContaining([ROOT_RPC_URL]),
        sessionAccessStatus: 'granted',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'root',
      }),
    );
    expect(provider?.__CE_RPC_CACHE_KEY).not.toContain(cfg.slug);
  });

  it('fails closed when the selected wallet disagrees with a stale redux account that has a cached grant', async () => {
    const cachedGrantAccount = '0x00000000000000000000000000000000000000b1';
    const selectedAccount = '0x00000000000000000000000000000000000000b2';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account: cachedGrantAccount,
      },
    });
    globalThis.ethereum = {
      selectedAddress: selectedAccount,
    };
    contractScripts.userHasSBT.mockResolvedValue(true);

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-wallet-mismatch',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const access = await checkSponsoredAccess({
      sessionConfig: cfg,
      sessionSlug: cfg.slug,
      account: cachedGrantAccount,
      resourceKey: 'rpc',
    });
    const provider = getReadProviderForGroup(cfg);

    expect(access.status).toBe('granted');
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'checking',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
  });

  it('revalidates a cached grant after the short sponsored-access hit TTL', async () => {
    const account = '0x00000000000000000000000000000000000000a4';
    const nowSpy = jest.spyOn(Date, 'now');
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockResolvedValue(true);

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-stale-grant',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    try {
      nowSpy.mockReturnValue(100_000);
      const access = await checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: cfg.slug,
        account,
        resourceKey: 'rpc',
      });
      expect(access.status).toBe('granted');

      nowSpy.mockReturnValue(131_500);
      const provider = getReadProviderForGroup(cfg);

      expect(provider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          providerLabel: 'path',
          sessionAccessStatus: 'checking',
          sessionAccessMode: 'sponsored-restricted',
          sessionRpcSource: 'default-path',
        }),
      );
      expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps restricted sponsored session RPC on the fallback stack after a cached denial', async () => {
    const account = '0x00000000000000000000000000000000000000a3';
    jest.spyOn(store, 'getState').mockReturnValue({
      profile: {
        account,
      },
    });
    contractScripts.userHasSBT.mockResolvedValue(false);

    const cfg = buildGroupCfg({
      slug: 'session-sponsored-rpc-denied',
      rpcUrl: ROOT_RPC_URL,
      sponsoredKeys: { rpc: true },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          rpc: {
            lookupStatus: 'ok',
            sbtAddresses: [RESTRICTED_SBT],
            mode: 'any',
            chainId: 84532,
          },
        },
      },
    });

    const access = await checkSponsoredAccess({
      sessionConfig: cfg,
      sessionSlug: cfg.slug,
      account,
      resourceKey: 'rpc',
    });
    const provider = getReadProviderForGroup(cfg);

    expect(access.status).toBe('denied');
    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'denied',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
    expect(provider?.__CE_RPC_CACHE_KEY).not.toContain(cfg.slug);
  });
});
