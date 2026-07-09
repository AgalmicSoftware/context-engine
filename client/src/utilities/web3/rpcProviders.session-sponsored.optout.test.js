const ROOT_RPC_URL = 'https://session-sponsored.example/rpc';
const PATH_DEFAULT_BASE_SEPOLIA = 'https://base-sepolia-testnet.api.pocket.network';
const RESTRICTED_SBT = '0x0000000000000000000000000000000000000A11';

const buildGroupCfg = (overrides = {}) => {
  const base = {
    slug: 'session-sponsored-rpc-optout',
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

describe('rpcProviders session-sponsored PATH opt-out', () => {
  beforeEach(() => {
    jest.resetModules();
    try {
      globalThis.CE_RPC_PROVIDER_MODE = 'fallback';
    } catch (_) {}
    try {
      globalThis.CE_PREFER_PATH_RPC = false;
    } catch (_) {}
  });

  afterEach(() => {
    try {
      delete globalThis.CE_RPC_PROVIDER_MODE;
    } catch (_) {}
    try {
      delete globalThis.CE_PREFER_PATH_RPC;
    } catch (_) {}
    jest.resetModules();
  });

  it('keeps PATH disabled when a restricted session RPC cannot be used', () => {
    jest.isolateModules(() => {
      const {
        getReadProviderDiagnostics,
        getReadProviderForGroup,
        resolveGroupPathRpcPreference,
      } = require('./rpcProviders.js');

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
      const rpcPref = resolveGroupPathRpcPreference(cfg, 84532);
      const diagnostics = getReadProviderDiagnostics(84532, rpcPref || {});

      expect(provider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          providerLabel: 'default',
          preferPath: false,
          preferredUrls: [],
        }),
      );
      expect(diagnostics.urls).not.toContain(ROOT_RPC_URL);
      expect(diagnostics.urls).not.toContain(PATH_DEFAULT_BASE_SEPOLIA);
      expect(diagnostics.publicUrls).not.toContain(PATH_DEFAULT_BASE_SEPOLIA);
      expect(diagnostics.defaultUrls).not.toContain(PATH_DEFAULT_BASE_SEPOLIA);
      expect(diagnostics.fallbackUrl).not.toBe(PATH_DEFAULT_BASE_SEPOLIA);
    });
  });

  it('does not re-enable PATH for a wizard-style default PATH mirror when global PATH preference is off', () => {
    jest.isolateModules(() => {
      const {
        getReadProviderDiagnostics,
        getReadProviderForGroup,
        resolveGroupPathRpcPreference,
      } = require('./rpcProviders.js');

      const cfg = buildGroupCfg({
        rpc: {
          provider: 'default',
          providers: {
            path: {
              rpcUrl: PATH_DEFAULT_BASE_SEPOLIA,
            },
          },
        },
      });

      const pref = resolveGroupPathRpcPreference(cfg, 84532);
      const provider = getReadProviderForGroup(cfg);
      const diagnostics = getReadProviderDiagnostics(84532, pref || {});

      expect(pref).toBeNull();
      expect(provider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          providerLabel: 'default',
          preferPath: false,
          preferredUrls: [],
        }),
      );
      expect(diagnostics.urls).not.toContain(PATH_DEFAULT_BASE_SEPOLIA);
      expect(diagnostics.publicUrls).not.toContain(PATH_DEFAULT_BASE_SEPOLIA);
      expect(diagnostics.defaultUrls).not.toContain(PATH_DEFAULT_BASE_SEPOLIA);
      expect(diagnostics.fallbackUrl).not.toBe(PATH_DEFAULT_BASE_SEPOLIA);
    });
  });
});
