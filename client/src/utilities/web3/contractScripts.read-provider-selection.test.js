import { getReadProviderForGroup } from './contractScripts.js';

const SESSION_RPC_URL = 'https://session-specific.example/rpc';
const PATH_DEFAULT_BASE_SEPOLIA = 'https://base-sepolia-testnet.api.pocket.network';

const buildGroupCfg = (rpc = {}, overrides = {}) => {
  const base = {
    slug: 'provider-selection-session',
    networkChainId: 84532,
    blockLimits: {
      start: 1,
      end: null,
    },
    rpc,
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
    rpc: Object.prototype.hasOwnProperty.call(overrides, 'rpc') ? overrides.rpc : rpc,
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

describe('contractScripts getReadProviderForGroup', () => {
  beforeEach(() => {
    try { globalThis.CE_RPC_PROVIDER_MODE = 'fallback'; } catch (_) {}
    try { globalThis.CE_PREFER_PATH_RPC = true; } catch (_) {}
  });

  afterEach(() => {
    try { delete globalThis.CE_RPC_PROVIDER_MODE; } catch (_) {}
    try { delete globalThis.CE_PREFER_PATH_RPC; } catch (_) {}
  });

  it('prefers a session-specific PATH RPC override when one is configured', () => {
    const provider = getReadProviderForGroup(buildGroupCfg({
      provider: 'path',
      providers: {
        path: {
          rpcUrl: SESSION_RPC_URL,
        },
      },
    }));

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      preferredUrls: expect.arrayContaining([SESSION_RPC_URL]),
    }));
  });

  it('falls back to the built-in Base Sepolia PATH default when the session RPC URL is empty', () => {
    const provider = getReadProviderForGroup(buildGroupCfg({
      provider: 'path',
      providers: {
        path: {
          rpcUrl: '   ',
        },
      },
    }));

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      providerLabel: 'path',
      preferredUrls: expect.arrayContaining([PATH_DEFAULT_BASE_SEPOLIA]),
    }));
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain('');
  });

  it('can prefer the SBT factory chain when a caller requests SBT-specific reads', () => {
    const provider = getReadProviderForGroup(
      buildGroupCfg({}, {
        networkChainId: null,
        contracts: {
          sbtFactory: {
            chainId: 8453,
          },
          surveys: {
            chainId: 84532,
          },
        },
      }),
      { contractKey: 'sbtFactory' }
    );

    expect(provider?.__CE_RPC_META).toEqual(expect.objectContaining({
      chainId: 8453,
    }));
  });
});
