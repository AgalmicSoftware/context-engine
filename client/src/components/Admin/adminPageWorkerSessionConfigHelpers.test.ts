import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { getDefaultHttpRpc, getSessionRegistryAddress } from '../../variables/chains.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
} from '../../utilities/session/sessionModeProfile';
import {
  buildWorkerUrlResolutionDisplay,
  buildWorkerSessionConfigPayload,
  getSessionReadRpcConfig,
  normalizeRpcUrlList,
  pickFirstNonEmptyRpcUrlMap,
  sanitizeRpcUrlMap,
} from './adminPageWorkerSessionConfigHelpers';

const ACCOUNT = '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119';

describe('adminPageWorkerSessionConfigHelpers', () => {
  it('normalizes RPC URL lists and maps without changing precedence semantics', () => {
    expect(normalizeRpcUrlList([' https://a.example ', '', null, 'https://b.example'])).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
    expect(normalizeRpcUrlList(' https://single.example ')).toEqual(['https://single.example']);
    expect(normalizeRpcUrlList('   ')).toEqual([]);

    expect(
      sanitizeRpcUrlMap({
        8453: [' https://base.example ', ''],
        empty: ['   '],
        84532: ' https://base-sepolia.example ',
      }),
    ).toEqual({
      8453: ['https://base.example'],
      84532: ['https://base-sepolia.example'],
    });

    expect(
      pickFirstNonEmptyRpcUrlMap(
        null,
        { 8453: ['  '] },
        { 8453: ['https://first.example'] },
        { 8453: ['https://ignored.example'] },
      ),
    ).toEqual({
      8453: ['https://first.example'],
    });
  });

  it('builds worker URL resolution display state without changing missing-url semantics', () => {
    const normalizeWorkerUrl = (value: unknown) =>
      String(value || '')
        .trim()
        .replace(/\/+$/, '');

    expect(
      buildWorkerUrlResolutionDisplay({
        resolved: {
          url: ' https://worker.example.test/ ',
          source: 'session-config',
          status: 'ok',
        },
        normalizeWorkerUrl,
      }),
    ).toEqual({
      url: 'https://worker.example.test',
      debug: 'source=session-config status=ok url=https://worker.example.test',
      status: 'Resolved (ok)',
    });
    expect(
      buildWorkerUrlResolutionDisplay({
        resolved: {
          url: '',
          source: 'registry',
          status: 'not-found',
        },
        normalizeWorkerUrl,
      }),
    ).toEqual({
      url: '',
      debug: 'source=registry status=not-found url=(none)',
      status: 'Missing (not-found)',
    });
    expect(
      buildWorkerUrlResolutionDisplay({
        resolved: {},
        normalizeWorkerUrl,
      }),
    ).toEqual({
      url: '',
      debug: 'source=unknown status=ok url=(none)',
      status: 'Missing worker URL',
    });
    expect(
      buildWorkerUrlResolutionDisplay({
        resolved: {
          url: '',
          source: 'registry',
          status: 0,
        },
        normalizeWorkerUrl,
      }),
    ).toEqual({
      url: '',
      debug: 'source=registry status=ok url=(none)',
      status: 'Missing worker URL',
    });
  });

  it('resolves the session read RPC from the session chain instead of the registry chain', () => {
    const rpcConfig = getSessionReadRpcConfig({
      sessionConfig: {
        slug: 'test-resource-rpc',
        networkChainId: 8453,
        __registry: {
          chainId: 84532,
          registryChainId: 84532,
        },
        rpcUrlsByChainId: {
          8453: ['https://base-mainnet.example'],
          84532: ['https://base-sepolia.example'],
        },
      },
      fallbackChainId: 84532,
    });

    expect(rpcConfig).toEqual({
      chainId: 8453,
      rpcUrl: 'https://base-mainnet.example',
    });
  });

  it('uses the first non-empty RPC map and preserves faucet RPC priority for reads', () => {
    expect(
      getSessionReadRpcConfig({
        sessionConfig: {
          networkChainId: 8453,
          faucet: { rpcUrl: ' https://faucet.example ' },
          rpc: {
            providers: { path: { rpcUrlsByChainId: {} } },
            rpcUrlsByChainId: { 8453: ['https://root.example'] },
          },
          rpcUrlsByChainId: { 8453: ['https://config.example'] },
        },
        fallbackChainId: 84532,
      }),
    ).toEqual({
      chainId: 8453,
      rpcUrl: 'https://faucet.example',
    });
  });

  it('builds worker config payload with registry and RPC fallbacks from chain defaults', () => {
    const payload = buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'test-3',
        networkChainId: DEFAULT_CHAIN_ID,
        __registry: {
          chainId: DEFAULT_CHAIN_ID,
          adminAddress: ACCOUNT,
        },
      },
      account: ACCOUNT,
      fallbackChainId: DEFAULT_CHAIN_ID,
    });

    expect(payload.registryAddress).toBe(getSessionRegistryAddress(DEFAULT_CHAIN_ID));
    expect(payload.rpcUrl).toBe(getDefaultHttpRpc(DEFAULT_CHAIN_ID));
    expect(payload.rpcUrlsByChainId).toEqual(
      expect.objectContaining({
        [String(DEFAULT_CHAIN_ID)]: [getDefaultHttpRpc(DEFAULT_CHAIN_ID)],
      }),
    );
  });

  it('uses session-chain RPCs for split registry/session worker payloads', () => {
    const payload = buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'split-rpc-session',
        networkChainId: 8453,
        __registry: {
          registryChainId: 84532,
          address: '0x1111111111111111111111111111111111111111',
          adminAddress: ACCOUNT,
        },
        rpcUrlsByChainId: {
          8453: [' https://session-chain.example '],
          84532: [' https://registry-chain.example '],
        },
        faucet: {
          amountEth: '0.0001',
        },
      },
      account: ACCOUNT,
      fallbackChainId: 84532,
    });

    expect(payload.networkChainId).toBe(8453);
    expect(payload.registryChainId).toBe(84532);
    expect(payload.rpcUrl).toBe('https://session-chain.example');
    expect(payload.rpcUrlsByChainId).toEqual({
      8453: ['https://session-chain.example'],
      84532: ['https://registry-chain.example'],
    });
    expect(payload.faucet).toEqual({
      rpcUrl: 'https://session-chain.example',
      amountEth: '0.0001',
    });
  });

  it('does not promote registry-chain RPC maps to the root session RPC', () => {
    const payload = buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'split-rpc-default-session',
        networkChainId: 8453,
        __registry: {
          registryChainId: 84532,
          address: '0x1111111111111111111111111111111111111111',
          adminAddress: ACCOUNT,
        },
        rpcUrlsByChainId: {
          84532: ['https://registry-chain.example'],
        },
      },
      account: ACCOUNT,
      fallbackChainId: 84532,
    });

    expect(payload.rpcUrl).toBe(getDefaultHttpRpc(8453));
    expect(payload.rpcUrlsByChainId).toEqual({
      8453: [getDefaultHttpRpc(8453)],
      84532: ['https://registry-chain.example'],
    });
  });

  it('backfills registry-chain RPC maps for split worker payloads', () => {
    const payload = buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'split-rpc-missing-registry-map',
        networkChainId: 8453,
        __registry: {
          registryChainId: 84532,
          address: '0x1111111111111111111111111111111111111111',
          adminAddress: ACCOUNT,
        },
        rpcUrlsByChainId: {
          8453: ['https://session-chain.example'],
        },
      },
      account: ACCOUNT,
      fallbackChainId: 84532,
    });

    expect(payload.rpcUrl).toBe('https://session-chain.example');
    expect(payload.rpcUrlsByChainId).toEqual({
      8453: ['https://session-chain.example'],
      84532: [getDefaultHttpRpc(84532)],
    });
  });

  it('preserves worker session config payload field normalization', () => {
    const payload = buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: ' session-admin ',
        networkChainId: 8453,
        __registry: {
          registryChainId: 84532,
          address: '0x1111111111111111111111111111111111111111',
          adminAddress: ACCOUNT,
          hatsAddress: '0x3333333333333333333333333333333333333333',
          adminHatId: '42',
          sessionIdHex: '0xabc123',
        },
        rpc: {
          providers: {
            path: {
              rpcUrl: ' https://path-rpc.example ',
              rpcUrlsByChainId: {
                84532: [' https://path-registry.example '],
              },
            },
          },
          rpcUrl: 'https://root-rpc.example',
        },
        allowOrigins: ' https://app.example,\nhttps://admin.example ',
        limits: { requestsPerMinute: 10 },
        scopes: { ai: true },
        blockLimits: { start: '12345', end: '13000' },
        contracts: {
          surveys: { contractAddress: '0x2222222222222222222222222222222222222222' },
          empty: {},
        },
        faucet: {
          amountEth: '0.0001',
          balanceThresholdEth: '0.001',
        },
      },
      account: ACCOUNT,
      fallbackChainId: 84532,
    });

    expect(payload).toEqual(
      expect.objectContaining({
        adminAddress: ACCOUNT,
        slug: 'session-admin',
        registryAddress: '0x1111111111111111111111111111111111111111',
        registryChainId: 84532,
        networkChainId: 8453,
        hatsAddress: '0x3333333333333333333333333333333333333333',
        adminHatId: '42',
        sessionId: '0xabc123',
        rpcUrl: 'https://path-rpc.example',
        rpcUrlsByChainId: {
          8453: ['https://path-rpc.example'],
          84532: ['https://path-registry.example'],
        },
        allowOrigins: ['https://app.example', 'https://admin.example'],
        limits: { requestsPerMinute: 10 },
        scopes: { ai: true },
        blockLimits: { start: 12345, end: 13000 },
        contracts: {
          surveys: {
            address: '0x2222222222222222222222222222222222222222',
            chainId: 8453,
          },
        },
        faucet: {
          rpcUrl: 'https://path-rpc.example',
          amountEth: '0.0001',
          balanceThresholdEth: '0.001',
        },
      }),
    );
  });

  it('allowlists Worker-native config and omits legacy chain controls', () => {
    const sessionModeProfile = cloneSessionModePreset(
      SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
    );
    const payload = buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'worker-admin',
        sessionId: '0x11111111111111111111111111111111',
        sessionModeProfile,
        storageProfile: {
          backend: 'cloudflare',
          payloadAccessControl: sessionModeProfile.storage.payloadAccessControl,
        },
        sessionEndsAt: '2099-01-02T03:04:00.000Z',
        defaultGroupTags: 'facilitators,reviewers',
        networkChainId: DEFAULT_CHAIN_ID,
        registryAddress: '0x1111111111111111111111111111111111111111',
        blockLimits: { start: 100 },
        contracts: {
          surveys: { address: '0x2222222222222222222222222222222222222222' },
        },
        faucet: { amountEth: '0.001' },
      },
      account: ACCOUNT,
      fallbackChainId: DEFAULT_CHAIN_ID,
    });

    expect(payload).toEqual(
      expect.objectContaining({
        slug: 'worker-admin',
        sessionId: '0x11111111111111111111111111111111',
        sessionEndsAt: '2099-01-02T03:04:00.000Z',
        defaultGroupTags: 'facilitators,reviewers',
        sessionModeProfile,
      }),
    );
    expect(payload).not.toHaveProperty('networkChainId');
    expect(payload).not.toHaveProperty('registryAddress');
    expect(payload).not.toHaveProperty('blockLimits');
    expect(payload).not.toHaveProperty('contracts');
    expect(payload).not.toHaveProperty('faucet');
    expect(payload).not.toHaveProperty('rpcUrl');
    expect(payload).not.toHaveProperty('rpcUrlsByChainId');
  });
});
