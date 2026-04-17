jest.mock('./contractScripts.js', () => ({
  __esModule: true,
  default: {
    userHasSBT: jest.fn(),
  },
}));

import store from '../../store.js';
import contractScripts from './contractScripts.js';
import {
  getReadProviderDiagnostics,
  getReadProviderForGroup,
  resolveGroupPathRpcPreference,
} from './rpcProviders.js';
import { checkSponsoredAccess } from './sponsoredAccess.js';

const ROOT_RPC_URL = 'https://session-sponsored.example/rpc';
const PATH_DEFAULT_BASE_SEPOLIA = 'https://base-sepolia-testnet.api.pocket.network';
const RESTRICTED_SBT = '0x0000000000000000000000000000000000000A11';
const CUSTOM_PATH_RPC_URL = 'https://custom-path.example/rpc';

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
} = {}) => buildGroupCfg({
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

describe('rpcProviders session-sponsored reads', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    contractScripts.userHasSBT.mockReset();
    try { delete globalThis.ethereum; } catch (_) {}
    try { globalThis.CE_RPC_PROVIDER_MODE = 'fallback'; } catch (_) {}
    try { globalThis.CE_PREFER_PATH_RPC = true; } catch (_) {}
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try { delete globalThis.ethereum; } catch (_) {}
    try { delete globalThis.CE_RPC_PROVIDER_MODE; } catch (_) {}
    try { delete globalThis.CE_PREFER_PATH_RPC; } catch (_) {}
  });

  it('does not use Session Wizard root rpcUrl for ordinary participant reads', () => {
    const cfg = buildGroupCfg({
      rpcUrl: ROOT_RPC_URL,
    });

    const provider = getReadProviderForGroup(cfg);

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      sessionAccessStatus: 'unavailable',
      sessionAccessMode: 'none',
      sessionRpcSource: 'default-path',
    }));
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
    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'session',
      preferredUrls: expect.arrayContaining([ROOT_RPC_URL, PATH_DEFAULT_BASE_SEPOLIA]),
      sessionAccessStatus: 'open',
      sessionRpcSource: 'root',
    }));
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
    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      preferredUrls: expect.arrayContaining([CUSTOM_PATH_RPC_URL]),
      sessionAccessStatus: 'open',
      sessionRpcSource: 'path',
    }));
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
    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      preferredUrls: expect.arrayContaining([PATH_DEFAULT_BASE_SEPOLIA]),
      sessionAccessStatus: 'unavailable',
      sessionRpcSource: 'default-path',
    }));
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

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      sessionAccessStatus: 'unavailable',
      sessionAccessMode: 'none',
      sessionRpcSource: 'default-path',
    }));
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

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'session',
      preferredUrls: expect.arrayContaining([ROOT_RPC_URL]),
      sessionAccessStatus: 'open',
      sessionRpcSource: 'root',
    }));
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

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      sessionAccessStatus: 'checking',
      sessionAccessMode: 'sponsored-restricted',
      sessionRpcSource: 'default-path',
    }));
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
    expect(provider?.__CE_RPC_META?.preferredUrls).toContain(PATH_DEFAULT_BASE_SEPOLIA);
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
    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'session',
      preferredUrls: expect.arrayContaining([ROOT_RPC_URL]),
      sessionAccessStatus: 'granted',
      sessionAccessMode: 'sponsored-restricted',
      sessionRpcSource: 'root',
    }));
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
    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      sessionAccessStatus: 'checking',
      sessionAccessMode: 'sponsored-restricted',
      sessionRpcSource: 'default-path',
    }));
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

      expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
        providerLabel: 'path',
        sessionAccessStatus: 'checking',
        sessionAccessMode: 'sponsored-restricted',
        sessionRpcSource: 'default-path',
      }));
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
    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      sessionAccessStatus: 'denied',
      sessionAccessMode: 'sponsored-restricted',
      sessionRpcSource: 'default-path',
    }));
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(ROOT_RPC_URL);
  });
});
