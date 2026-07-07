import { ethers } from 'ethers';
import contractScripts, { getReadProviderForGroup } from './contractScripts.js';

const SESSION_RPC_URL = 'https://session-specific.example/rpc';
const CROSS_CHAIN_SESSION_RPC_URL = 'https://session-cross-chain.example/rpc';
const NESTED_OTHER_CHAIN_RPC_URL = 'https://session-nested-other-chain.example/rpc';
const PATH_DEFAULT_BASE_SEPOLIA = 'https://base-sepolia-testnet.api.pocket.network';
const PATH_DEFAULT_OP_SEPOLIA = 'https://op-sepolia-testnet.api.pocket.network';
const ARCHIVE_OP_SEPOLIA_RPC = 'https://optimism-sepolia.gateway.tenderly.co';

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
      delete globalThis.CE_RPC_PROVIDER_MODE;
    } catch (_) {}
    try {
      delete globalThis.CE_PREFER_PATH_RPC;
    } catch (_) {}
  });

  it('prefers a session-specific PATH RPC override when one is configured', () => {
    const provider = getReadProviderForGroup(
      buildGroupCfg({
        provider: 'path',
        providers: {
          path: {
            rpcUrl: SESSION_RPC_URL,
          },
        },
      }),
    );

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        preferredUrls: expect.arrayContaining([SESSION_RPC_URL]),
      }),
    );
  });

  it('falls back to the built-in Base Sepolia PATH default when the session RPC URL is empty', () => {
    const provider = getReadProviderForGroup(
      buildGroupCfg({
        provider: 'path',
        providers: {
          path: {
            rpcUrl: '   ',
          },
        },
      }),
    );

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        preferredUrls: expect.arrayContaining([PATH_DEFAULT_BASE_SEPOLIA]),
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain('');
  });

  it('can prefer the SBT factory chain when a caller requests SBT-specific reads', () => {
    const provider = getReadProviderForGroup(
      buildGroupCfg(
        {},
        {
          networkChainId: null,
          contracts: {
            sbtFactory: {
              chainId: 8453,
            },
            surveys: {
              chainId: 84532,
            },
          },
        },
      ),
      { contractKey: 'sbtFactory' },
    );

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        chainId: 8453,
      }),
    );
  });

  it('ignores top-level session rpcUrl when a caller switches onto the SBT factory chain', () => {
    try {
      globalThis.CE_PREFER_PATH_RPC = false;
    } catch (_) {}

    const provider = getReadProviderForGroup(
      buildGroupCfg(
        {},
        {
          rpcUrl: SESSION_RPC_URL,
          networkChainId: 84532,
          contracts: {
            sbtFactory: {
              chainId: 8453,
            },
            surveys: {
              chainId: 84532,
            },
          },
        },
      ),
      { contractKey: 'sbtFactory' },
    );

    const urls = Array.isArray(provider?.providerConfigs)
      ? provider.providerConfigs.map((cfg) => cfg?.provider?.connection?.url).filter(Boolean)
      : [];

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        chainId: 8453,
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(SESSION_RPC_URL);
    expect(urls).not.toContain(SESSION_RPC_URL);
  });

  it('falls through to top-level rpcUrlsByChainId when the nested session map lacks the requested chain', () => {
    const provider = getReadProviderForGroup(
      buildGroupCfg(
        {
          rpcUrlsByChainId: {
            84532: [NESTED_OTHER_CHAIN_RPC_URL],
          },
        },
        {
          rpcUrlsByChainId: {
            8453: [CROSS_CHAIN_SESSION_RPC_URL],
          },
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              rpc: {
                lookupStatus: 'ok',
                sbtAddresses: [],
                mode: 'any',
                chainId: 8453,
              },
            },
          },
          contracts: {
            sbtFactory: {
              chainId: 8453,
            },
            surveys: {
              chainId: 84532,
            },
          },
        },
      ),
      { contractKey: 'sbtFactory' },
    );

    const urls = Array.isArray(provider?.providerConfigs)
      ? provider.providerConfigs.map((cfg) => cfg?.provider?.connection?.url).filter(Boolean)
      : [];

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        chainId: 8453,
        providerLabel: 'session',
        preferredUrls: expect.arrayContaining([CROSS_CHAIN_SESSION_RPC_URL]),
        sessionAccessStatus: 'open',
        sessionRpcSource: 'root',
      }),
    );
    expect(provider?.__CE_RPC_META?.preferredUrls).not.toContain(NESTED_OTHER_CHAIN_RPC_URL);
    expect(urls[0]).toBe(CROSS_CHAIN_SESSION_RPC_URL);
    expect(urls).not.toContain(NESTED_OTHER_CHAIN_RPC_URL);
  });

  it('uses open sponsored session RPC for survey hash and response reads', async () => {
    try {
      globalThis.CE_PREFER_PATH_RPC = false;
    } catch (_) {}
    const capturedProviders = [];
    const getQuestionHash = jest.fn().mockResolvedValue(ethers.constants.HashZero);
    const getResponse = jest.fn().mockResolvedValue(ethers.constants.HashZero);
    jest.spyOn(ethers, 'Contract').mockImplementation((_addr, _abi, provider) => {
      capturedProviders.push(provider);
      return {
        getQuestionHash,
        getResponse,
      };
    });

    const cfg = buildGroupCfg(
      {},
      {
        slug: 'provider-selection-open-sponsored-survey-reads',
        rpcUrl: SESSION_RPC_URL,
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
      },
    );

    await expect(contractScripts.getQuestionHash('none', `0x${'11'.repeat(32)}`, cfg)).resolves.toBeNull();
    await expect(
      contractScripts.getResponse('none', '0x00000000000000000000000000000000000000aa', `0x${'22'.repeat(32)}`, cfg),
    ).resolves.toBeNull();

    expect(capturedProviders).toHaveLength(2);
    capturedProviders.forEach((provider) => {
      const urls = Array.isArray(provider?.providerConfigs)
        ? provider.providerConfigs.map((entry) => entry?.provider?.connection?.url).filter(Boolean)
        : [];
      expect(provider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          providerLabel: 'session',
          sessionAccessStatus: 'open',
          sessionRpcSource: 'root',
          preferredUrls: expect.arrayContaining([SESSION_RPC_URL]),
        }),
      );
      expect(urls[0]).toBe(SESSION_RPC_URL);
    });
  });

  it('uses browser-visible session RPC path mirrors for survey and SBT read providers', () => {
    try {
      globalThis.CE_PREFER_PATH_RPC = false;
    } catch (_) {}
    const cfg = buildGroupCfg({
      provider: 'path',
      providers: {
        path: {
          rpcUrl: SESSION_RPC_URL,
        },
      },
    });

    const surveyProvider = getReadProviderForGroup(cfg, { contractKey: 'surveys' });
    const sbtProvider = getReadProviderForGroup(cfg, { contractKey: 'sbtFactory' });

    [surveyProvider, sbtProvider].forEach((provider) => {
      const urls = Array.isArray(provider?.providerConfigs)
        ? provider.providerConfigs.map((entry) => entry?.provider?.connection?.url).filter(Boolean)
        : [];
      expect(provider?.__CE_RPC_META).toEqual(
        expect.objectContaining({
          providerLabel: 'path',
          preferredUrls: expect.arrayContaining([SESSION_RPC_URL]),
        }),
      );
      expect(urls[0]).toBe(SESSION_RPC_URL);
    });
  });

  it('skips global PATH defaults for archive-safe survey reads', () => {
    const cfg = buildGroupCfg(
      {},
      {
        networkChainId: 11155420,
        contracts: {
          surveys: {
            address: '0x00000000000000000000000000000000000000ab',
            chainId: 11155420,
          },
        },
      },
    );

    const provider = getReadProviderForGroup(cfg, {
      contractKey: 'surveys',
      skipGlobalPathDefaults: true,
      providerLabel: 'surveys-archive',
    });
    const urls = Array.isArray(provider?.providerConfigs)
      ? provider.providerConfigs.map((entry) => entry?.provider?.connection?.url).filter(Boolean)
      : [];

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'surveys-archive',
        skipGlobalPreferred: true,
      }),
    );
    expect(urls[0]).toBe(ARCHIVE_OP_SEPOLIA_RPC);
    expect(urls).not.toContain(PATH_DEFAULT_OP_SEPOLIA);
  });

  it('preserves explicit session PATH overrides for archive-safe survey reads', () => {
    const cfg = buildGroupCfg({
      provider: 'path',
      providers: {
        path: {
          rpcUrl: SESSION_RPC_URL,
        },
      },
    });

    const provider = getReadProviderForGroup(cfg, {
      contractKey: 'surveys',
      skipGlobalPathDefaults: true,
    });
    const urls = Array.isArray(provider?.providerConfigs)
      ? provider.providerConfigs.map((entry) => entry?.provider?.connection?.url).filter(Boolean)
      : [];

    expect(provider?.__CE_RPC_META).toEqual(
      expect.objectContaining({
        providerLabel: 'path',
        preferredUrls: expect.arrayContaining([SESSION_RPC_URL]),
      }),
    );
    expect(urls[0]).toBe(SESSION_RPC_URL);
  });
});
