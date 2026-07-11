import { ethers } from 'ethers';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';

jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: jest.fn(),
  },
}));

jest.mock('../crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn((providerLike) => providerLike || null),
  },
}));

import {
  __sessionRegistryTestUtils,
  parseSessionRegistryMetadataUri,
  registerSessionOnChain,
  refreshSessionRegistryFieldsCache,
  setResourceGatesOnChain,
  sessionRegistryStore,
  setSessionFieldsOnChain,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  updateSessionMetadataOnChain,
  upsertSessionRegistryCache,
  uploadSessionMetadata,
} from './sessionRegistry.js';
import { arweaveClient } from '../arweave/arweaveClient.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { getChainById, getDefaultGasPriceGwei, getSessionRegistryAddress } from '../../variables/chains.js';
import { upsertCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';

const TEST_SIGNER_ADDRESS = '0x00000000000000000000000000000000000000aa';
const CONFIGURED_REGISTRY_CHAIN_ID = DEFAULT_CHAIN_ID;
const CONFIGURED_REGISTRY_CHAIN_NAME =
  getChainById(CONFIGURED_REGISTRY_CHAIN_ID)?.name || `Chain ${CONFIGURED_REGISTRY_CHAIN_ID}`;

const installPublicRpcFeeMocks = ({
  feeData = {
    gasPrice: null,
    maxFeePerGas: ethers.BigNumber.from('3000000000'),
    maxPriorityFeePerGas: ethers.BigNumber.from('1000000000'),
  },
  gasPrice = null,
} = {}) => {
  const providerMock = {
    getFeeData: jest.fn(),
    getGasPrice: jest.fn(),
    getTransactionCount: jest.fn().mockResolvedValue(null),
  };
  if (feeData instanceof Error) {
    providerMock.getFeeData.mockRejectedValue(feeData);
  } else {
    providerMock.getFeeData.mockResolvedValue(feeData);
  }
  if (gasPrice instanceof Error) {
    providerMock.getGasPrice.mockRejectedValue(gasPrice);
  } else {
    providerMock.getGasPrice.mockResolvedValue(gasPrice);
  }
  jest.spyOn(ethers.providers, 'JsonRpcProvider').mockImplementation(function MockJsonRpcProvider() {
    return providerMock;
  });
  jest.spyOn(ethers.providers, 'FallbackProvider').mockImplementation(function MockFallbackProvider(configs) {
    return configs?.[0]?.provider || providerMock;
  });
  return providerMock;
};

const makeWalletProvider = ({ txHash = '0xtxhash', sendTxError = null } = {}) => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_sendTransaction') {
      if (sendTxError) throw sendTxError;
      return txHash;
    }
    return null;
  }),
});

const installWeb3ProviderMock = ({
  signer,
  receipt = { status: 1, transactionHash: '0xtxhash' },
  network = { chainId: CONFIGURED_REGISTRY_CHAIN_ID },
} = {}) => {
  const providerMock = {
    getSigner: () => signer,
    waitForTransaction: jest.fn().mockResolvedValue(receipt),
    getNetwork: jest.fn().mockResolvedValue(network),
  };
  jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
    return providerMock;
  });
  return providerMock;
};

const makeRegistryWriteContractMock = ({
  chainId = CONFIGURED_REGISTRY_CHAIN_ID,
  txData = '0xdeadbeef',
  methods = [],
} = {}) => {
  const contract = {
    address: getSessionRegistryAddress(chainId) || '0x1111111111111111111111111111111111111111',
    interface: {
      encodeFunctionData: jest.fn(() => txData),
    },
    estimateGas: {},
  };
  methods.forEach((method) => {
    contract[method] = jest.fn();
    contract.estimateGas[method] = jest.fn();
  });
  return contract;
};

const getLatestSendTxParams = (walletProvider) =>
  walletProvider.request.mock.calls.filter(([payload]) => payload?.method === 'eth_sendTransaction').at(-1)?.[0]
    ?.params?.[0] || null;

describe('sessionRegistry metadata upload', () => {
  beforeEach(() => {
    arweaveClient.uploadDataToArweave.mockReset();
    arweaveClient.uploadDataToArweave.mockResolvedValue('example_tx_id');
    arweaveClient.downloadDataFromArweave.mockReset();
  });

  it('strips authoritative gate fields before Arweave upload', async () => {
    const metadata = {
      slug: 'demo',
      sessionName: 'Demo',
      sponsoredSbtAddress: '0x0000000000000000000000000000000000000001',
      sponsored: {
        defaultGateId: 'gate-1',
        gates: { 'gate-1': { sbtAddresses: ['0x0000000000000000000000000000000000000001'] } },
      },
    };

    await uploadSessionMetadata(metadata);

    expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledTimes(1);
    const [payload, format] = arweaveClient.uploadDataToArweave.mock.calls[0];
    expect(format).toBe('json');
    expect(payload.sponsored).toBeUndefined();
    expect(payload.sponsoredSbtAddress).toBeUndefined();

    // Original object is preserved for caller-side state.
    expect(metadata.sponsored).toBeDefined();
    expect(metadata.sponsoredSbtAddress).toBeDefined();
  });
});

describe('sessionRegistry metadata reads', () => {
  beforeEach(() => {
    arweaveClient.downloadDataFromArweave.mockReset();
  });

  it('leaves session metadata preflight policy to the arweave resolver', async () => {
    const txId = 'YWNXjJUfKtOUN56pL_U4HxTv2dYfZORfBFAtZpc7q5g';
    arweaveClient.downloadDataFromArweave.mockResolvedValue(
      JSON.stringify({
        slug: 'edge',
        sessionName: 'Edge',
      }),
    );

    const metadata = await __sessionRegistryTestUtils.fetchMetadataFromArweave(`ar://${txId}`, {
      caller: 'unit-test',
      slug: 'edge',
      chainId: 84532,
    });

    expect(metadata).toEqual({
      slug: 'edge',
      sessionName: 'Edge',
    });
    const [, arweaveOpts] = arweaveClient.downloadDataFromArweave.mock.calls[0];
    expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledTimes(1);
    expect(arweaveClient.downloadDataFromArweave).toHaveBeenCalledWith(txId, expect.any(Object));
    expect(arweaveOpts).toEqual(
      expect.objectContaining({
        debugContext: expect.objectContaining({
          category: 'session_registry_metadata',
          caller: 'unit-test',
          slug: 'edge',
          chainId: 84532,
        }),
      }),
    );
    expect(arweaveOpts).not.toHaveProperty('disableExistencePrecheck');
    expect(arweaveOpts).not.toHaveProperty('preflightTxExistence');
  });
});

describe('sessionRegistry metadata uri parsing', () => {
  it('parses base64 data JSON metadata URIs', () => {
    const payload = {
      slug: 'codex-ui-refresh-check-27-feb-2026-11-05-am',
      contracts: { sbtFactory: { address: '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA', chainId: 84532 } },
      blockLimits: { start: 38223630, end: null },
    };
    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`;
    expect(parseSessionRegistryMetadataUri(uri)).toEqual(payload);
  });

  it('parses URL-encoded data JSON metadata URIs', () => {
    const payload = { slug: 'demo-encoded', networkChainId: 84532 };
    const uri = `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;
    expect(parseSessionRegistryMetadataUri(uri)).toEqual(payload);
  });
});

describe('sessionRegistry cache notifications', () => {
  afterEach(() => {
    try {
      localStorage.removeItem('dg:sessionRegistryCache:v1');
    } catch (_) {}
  });

  it('dispatches cache update event after upserting session config', () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

    upsertSessionRegistryCache({
      config: {
        slug: 'event-test',
        __registry: {
          registryChainId: 84532,
          sessionIdHex: '0x00000000000000000000000000000001',
        },
      },
    });

    expect(dispatchSpy).toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[dispatchSpy.mock.calls.length - 1]?.[0];
    expect(eventArg?.type).toBe(SESSION_REGISTRY_CACHE_UPDATED_EVENT);

    dispatchSpy.mockRestore();
  });
});

describe('loadSessionRegistryCache persistence', () => {
  afterEach(() => {
    try {
      localStorage.removeItem('dg:sessionRegistryCache:v1');
    } catch (_) {}
    jest.restoreAllMocks();
  });

  it('persists __hadLoadErrors when registry RPC loading fails', async () => {
    const walletProvider = { request: jest.fn() };
    const contractMock = {
      getSessionCount: jest.fn().mockRejectedValue(new Error('registry rpc failed')),
    };
    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return {
        getNetwork: jest.fn().mockResolvedValue({ chainId: CONFIGURED_REGISTRY_CHAIN_ID }),
      };
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const { loadSessionRegistryCache } = jest.requireActual('./sessionRegistry.js');
    await loadSessionRegistryCache({
      chainIds: [CONFIGURED_REGISTRY_CHAIN_ID],
      providerLike: walletProvider,
      force: true,
    });

    const persisted = JSON.parse(localStorage.getItem('dg:sessionRegistryCache:v1') || 'null');
    expect(persisted).toEqual(
      expect.objectContaining({
        __hadLoadErrors: true,
        chains: {},
        sessions: {},
        groups: {},
        sessionsById: {},
      }),
    );
    expect(contractMock.getSessionCount).toHaveBeenCalledTimes(1);
  });

  it('keeps same-chain stale entries on refresh errors without reviving other chains', async () => {
    upsertSessionRegistryCache({
      config: {
        slug: 'op-session',
        sessionName: 'OP Session',
        networkChainId: CONFIGURED_REGISTRY_CHAIN_ID,
        __registry: {
          registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
          sessionIdHex: '0x00000000000000000000000000000011',
        },
      },
    });
    upsertSessionRegistryCache({
      config: {
        slug: 'base-session',
        sessionName: 'Base Session',
        networkChainId: 84532,
        __registry: {
          registryChainId: 84532,
          sessionIdHex: '0x00000000000000000000000000000022',
        },
      },
    });

    const walletProvider = { request: jest.fn() };
    const contractMock = {
      getSessionCount: jest.fn().mockRejectedValue(new Error('registry rpc failed')),
    };
    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return {
        getNetwork: jest.fn().mockResolvedValue({ chainId: CONFIGURED_REGISTRY_CHAIN_ID }),
      };
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const { loadSessionRegistryCache } = jest.requireActual('./sessionRegistry.js');
    await loadSessionRegistryCache({
      chainIds: [CONFIGURED_REGISTRY_CHAIN_ID],
      providerLike: walletProvider,
      force: true,
    });

    const persisted = JSON.parse(localStorage.getItem('dg:sessionRegistryCache:v1') || 'null');
    expect(Object.keys(persisted.sessions || {})).toEqual(['op-session']);
    expect(persisted.sessions['op-session']?.__registry?.registryChainId).toBe(CONFIGURED_REGISTRY_CHAIN_ID);
    expect(persisted.sessions['base-session']).toBeUndefined();
    expect(Object.keys(persisted.chains || {})).toEqual([String(CONFIGURED_REGISTRY_CHAIN_ID)]);
    expect(contractMock.getSessionCount).toHaveBeenCalledTimes(1);
  });

  it('loads requested session slugs without enumerating the full registry', async () => {
    upsertSessionRegistryCache({
      config: {
        slug: 'cached-session',
        networkChainId: CONFIGURED_REGISTRY_CHAIN_ID,
        __registry: {
          registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
          sessionIdHex: '0x00000000000000000000000000000044',
        },
      },
    });
    const contractMock = {
      getSessionCount: jest.fn(),
      getSessionSlugByIndex: jest.fn(),
      getSessionBySlug: jest.fn(async () => [
        'demo-1',
        CONFIGURED_REGISTRY_CHAIN_ID,
        '',
        '',
        TEST_SIGNER_ADDRESS,
        1,
        2,
        '0x00000000000000000000000000000055',
      ]),
      getResourceGate: jest.fn(async () => [[], 0, 0, 0]),
      getSessionFields: jest.fn(async (_slug, keys) =>
        keys.map((key) => (key === 'corsWorkerUrl' ? 'https://demo-1-worker.example' : '')),
      ),
    };
    jest.spyOn(ethers.providers, 'JsonRpcProvider').mockImplementation(function MockJsonRpcProvider() {
      return { send: jest.fn() };
    });
    jest.spyOn(ethers.providers, 'FallbackProvider').mockImplementation(function MockFallbackProvider(configs) {
      return configs?.[0]?.provider || { send: jest.fn() };
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const { loadSessionRegistryCache } = jest.requireActual('./sessionRegistry.js');
    const cache = await loadSessionRegistryCache({
      chainIds: [CONFIGURED_REGISTRY_CHAIN_ID],
      slugs: ['demo-1'],
      force: true,
    });

    expect(contractMock.getSessionCount).not.toHaveBeenCalled();
    expect(contractMock.getSessionSlugByIndex).not.toHaveBeenCalled();
    expect(contractMock.getSessionBySlug).toHaveBeenCalledTimes(1);
    expect(contractMock.getSessionBySlug).toHaveBeenCalledWith('demo-1');
    expect(cache.sessions['demo-1']).toEqual(
      expect.objectContaining({ corsWorkerUrl: 'https://demo-1-worker.example' }),
    );
    expect(cache.sessions['cached-session']).toBeDefined();
  });
});

describe('sessionRegistryStore worker config overlay', () => {
  afterEach(() => {
    try {
      localStorage.removeItem('dg:sessionRegistryCache:v1');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionWorkerConfigCache:v1');
    } catch (_) {}
  });

  it('prefers cached worker config over the registry mirror for slug and id lookups', () => {
    upsertSessionRegistryCache({
      config: {
        slug: 'edge',
        sessionName: 'Edge',
        corsWorkerUrl: 'https://registry-mirror.example',
        __registry: {
          registryChainId: 84532,
          sessionIdHex: '0x00000000000000000000000000000001',
        },
      },
    });
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });

    expect(sessionRegistryStore.getSessionConfig('edge')).toEqual(
      expect.objectContaining({
        slug: 'edge',
        corsWorkerUrl: 'https://worker-kv-cache.example',
      }),
    );
    expect(sessionRegistryStore.getSessionConfigById('0x00000000000000000000000000000001')).toEqual(
      expect.objectContaining({
        slug: 'edge',
        corsWorkerUrl: 'https://worker-kv-cache.example',
      }),
    );
    expect(sessionRegistryStore.getAllSessionEntries()).toEqual([
      [
        'edge',
        expect.objectContaining({
          slug: 'edge',
          corsWorkerUrl: 'https://worker-kv-cache.example',
        }),
      ],
    ]);
  });
});

describe('refreshSessionRegistryFieldsCache', () => {
  afterEach(() => {
    try {
      localStorage.removeItem('dg:sessionRegistryCache:v1');
    } catch (_) {}
    jest.restoreAllMocks();
  });

  it('updates worker fields without clearing cached metadata or gates', async () => {
    arweaveClient.downloadDataFromArweave.mockClear();
    const sessionIdHex = '0x00000000000000000000000000000033';
    const txGasGate = {
      lookupStatus: 'ok',
      sbtAddresses: ['0x2222222222222222222222222222222222222222'],
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      mode: 'any',
      perMemberLimit: null,
    };
    upsertSessionRegistryCache({
      config: {
        slug: 'demo-1',
        sessionName: 'Demo Session',
        networkChainId: CONFIGURED_REGISTRY_CHAIN_ID,
        __registry: {
          registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
          sessionIdHex,
          gatesByResource: {
            txGas: txGasGate,
          },
          fields: {
            sponsored_faucet: '0',
          },
        },
      },
    });

    jest.spyOn(ethers.providers, 'JsonRpcProvider').mockImplementation(function MockJsonRpcProvider() {
      return { send: jest.fn() };
    });
    jest.spyOn(ethers.providers, 'FallbackProvider').mockImplementation(function MockFallbackProvider(configs) {
      return configs?.[0]?.provider || { send: jest.fn() };
    });
    const contractMock = {
      getSessionById: jest.fn().mockResolvedValue(null),
      getSessionBySlug: jest
        .fn()
        .mockResolvedValue([
          'demo-1',
          CONFIGURED_REGISTRY_CHAIN_ID,
          'ar://metadata-tx',
          '',
          TEST_SIGNER_ADDRESS,
          1,
          2,
          sessionIdHex,
        ]),
      getSessionFields: jest.fn(async (_slug, keys) =>
        keys.map(
          (key) =>
            ({
              corsWorkerUrl: 'https://demo-worker.example',
              sponsored_faucet: 'true',
            })[key] || '',
        ),
      ),
    };
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const refreshed = await refreshSessionRegistryFieldsCache({
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'demo-1',
    });

    expect(arweaveClient.downloadDataFromArweave).not.toHaveBeenCalled();
    expect(contractMock.getSessionBySlug).toHaveBeenCalledWith('demo-1');
    expect(contractMock.getSessionFields).toHaveBeenCalledWith(
      'demo-1',
      expect.arrayContaining(['corsWorkerUrl', 'sponsored_faucet']),
    );
    expect(refreshed).toEqual(
      expect.objectContaining({
        slug: 'demo-1',
        sessionName: 'Demo Session',
        corsWorkerUrl: 'https://demo-worker.example',
        sponsoredKeys: expect.objectContaining({
          faucet: true,
        }),
      }),
    );
    expect(refreshed.__registry.gatesByResource.txGas).toEqual(txGasGate);
    expect(refreshed.__registry.fields).toEqual(
      expect.objectContaining({
        corsWorkerUrl: 'https://demo-worker.example',
        sponsored_faucet: 'true',
      }),
    );
    expect(sessionRegistryStore.getSessionConfig('demo-1')).toEqual(
      expect.objectContaining({
        corsWorkerUrl: 'https://demo-worker.example',
        sessionName: 'Demo Session',
      }),
    );
  });
});

describe('registerSessionOnChain registry address override', () => {
  it('uses explicit registryAddress when chain defaults are missing', async () => {
    await expect(
      registerSessionOnChain({
        chainId: 8453,
        registryAddress: '0x1111111111111111111111111111111111111111',
        slug: 'override-test',
        sessionId: '0x11111111111111111111111111111111',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow(
      /SessionRegistry at 0x1111111111111111111111111111111111111111 does not support sessionId\.|Wallet provider not available\./,
    );
  });

  it('still fails when neither chain default nor override is set', async () => {
    await expect(
      registerSessionOnChain({
        chainId: 8453,
        slug: 'missing-registry',
        sessionId: '0x11111111111111111111111111111111',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow('Session registry address not configured for this chain.');
  });
});

describe('registerSessionOnChain duplicate guards', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects unsafe registry slugs before resolving a wallet provider', async () => {
    cryptoUtils._getProvider.mockClear();
    const contractSpy = jest.spyOn(ethers, 'Contract');

    await expect(
      registerSessionOnChain({
        providerLike: makeWalletProvider(),
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'Team A!',
        sessionId: '0x11111111111111111111111111111111',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow('Session slugs must use lowercase letters, numbers, "_" or "-".');

    expect(cryptoUtils._getProvider).not.toHaveBeenCalled();
    expect(contractSpy).not.toHaveBeenCalled();
  });

  it('normalizes registry slugs before duplicate checks', async () => {
    const walletProvider = makeWalletProvider();
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const contractMock = {
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(true),
      createSession: jest.fn(),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    installWeb3ProviderMock({ signer });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: ' Team_A-1 ',
        sessionId: '0x11111111111111111111111111111112',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow('Session slug "team_a-1" is already registered on-chain.');

    expect(contractMock.sessionExists).toHaveBeenCalledWith('team_a-1');
    expect(contractMock.createSession).not.toHaveBeenCalled();
  });

  it.each([
    [
      'setSessionFieldsOnChain',
      () =>
        setSessionFieldsOnChain({
          providerLike: makeWalletProvider(),
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          slug: '__proto__',
          fields: { corsWorkerUrl: 'https://worker.example' },
        }),
    ],
    [
      'updateSessionMetadataOnChain',
      () =>
        updateSessionMetadataOnChain({
          providerLike: makeWalletProvider(),
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          slug: '__proto__',
          metadataURI: 'ar://new-metadata',
          encryptedMetadataURI: '',
        }),
    ],
    [
      'setResourceGatesOnChain',
      () =>
        setResourceGatesOnChain({
          providerLike: makeWalletProvider(),
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          slug: '__proto__',
          gates: [
            {
              resourceKey: 'default',
              sbtAddresses: ['0x0000000000000000000000000000000000000002'],
              chainId: CONFIGURED_REGISTRY_CHAIN_ID,
              mode: 0,
              perMemberLimit: 0,
            },
          ],
        }),
    ],
  ])('rejects unsafe registry slugs in %s before resolving a wallet provider', async (_name, runWrite) => {
    cryptoUtils._getProvider.mockClear();
    const contractSpy = jest.spyOn(ethers, 'Contract');

    await expect(runWrite()).rejects.toThrow('This session slug is reserved.');

    expect(cryptoUtils._getProvider).not.toHaveBeenCalled();
    expect(contractSpy).not.toHaveBeenCalled();
  });

  it('throws a clear error when the connected wallet is on a different chain than the registry write target', async () => {
    const walletProvider = { request: jest.fn() };
    const signer = {
      provider: {
        getNetwork: jest.fn().mockResolvedValue({ chainId: 8453 }),
      },
    };
    const contractMock = {
      sessionIdExists: jest.fn(),
      createSession: jest.fn(),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return {
        getSigner: () => signer,
      };
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'wrong-wallet-network',
        sessionId: '0x11111111111111111111111111111111',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow(
      `Connected wallet is on Base (8453), but session registry writes require ${CONFIGURED_REGISTRY_CHAIN_NAME} (${CONFIGURED_REGISTRY_CHAIN_ID}). Switch the wallet network and retry.`,
    );

    expect(contractMock.sessionIdExists).not.toHaveBeenCalled();
    expect(contractMock.createSession).not.toHaveBeenCalled();
  });

  it('fails closed when the connected wallet chain cannot be verified before a registry write', async () => {
    const walletProvider = makeWalletProvider();
    const signer = {
      provider: {
        getNetwork: jest.fn().mockRejectedValue(new Error('wallet chain unavailable')),
      },
      getChainId: jest.fn().mockRejectedValue(new Error('signer chain unavailable')),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return {
        getSigner: () => signer,
        getNetwork: jest.fn().mockRejectedValue(new Error('provider chain unavailable')),
      };
    });
    const contractSpy = jest.spyOn(ethers, 'Contract');

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'unknown-wallet-network',
        sessionId: '0x11111111111111111111111111111113',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow(
      `Unable to verify the connected wallet chain. Session registry writes require ${CONFIGURED_REGISTRY_CHAIN_NAME} (${CONFIGURED_REGISTRY_CHAIN_ID}). Switch the wallet network and retry.`,
    );

    expect(contractSpy).not.toHaveBeenCalled();
    expect(walletProvider.request).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_sendTransaction',
      }),
    );
  });

  it.each([
    [
      'setSessionFieldsOnChain',
      () =>
        setSessionFieldsOnChain({
          providerLike: makeWalletProvider(),
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          slug: 'wrong-wallet-network',
          fields: { corsWorkerUrl: 'https://worker.example' },
        }),
    ],
    [
      'updateSessionMetadataOnChain',
      () =>
        updateSessionMetadataOnChain({
          providerLike: makeWalletProvider(),
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          slug: 'wrong-wallet-network',
          metadataURI: 'ar://new-metadata',
          encryptedMetadataURI: '',
        }),
    ],
    [
      'setResourceGatesOnChain',
      () =>
        setResourceGatesOnChain({
          providerLike: makeWalletProvider(),
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          slug: 'wrong-wallet-network',
          gates: [
            {
              resourceKey: 'default',
              sbtAddresses: ['0x0000000000000000000000000000000000000002'],
              chainId: CONFIGURED_REGISTRY_CHAIN_ID,
              mode: 0,
              perMemberLimit: 0,
            },
          ],
        }),
    ],
  ])('throws before sending when %s is called from the wrong wallet chain', async (_name, runWrite) => {
    const walletProvider = makeWalletProvider();
    const signer = {
      provider: {
        getNetwork: jest.fn().mockResolvedValue({ chainId: 8453 }),
      },
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    installWeb3ProviderMock({ signer });
    const contractSpy = jest.spyOn(ethers, 'Contract');

    await expect(runWrite()).rejects.toThrow(
      `Connected wallet is on Base (8453), but session registry writes require ${CONFIGURED_REGISTRY_CHAIN_NAME} (${CONFIGURED_REGISTRY_CHAIN_ID}). Switch the wallet network and retry.`,
    );

    expect(contractSpy).not.toHaveBeenCalled();
    expect(walletProvider.request).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_sendTransaction',
      }),
    );
  });

  it('throws a clear error before sending when the session id already exists', async () => {
    const walletProvider = makeWalletProvider();
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const contractMock = {
      sessionIdExists: jest.fn().mockResolvedValue(true),
      createSession: jest.fn(),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    installWeb3ProviderMock({ signer });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'duplicate-id',
        sessionId: '0x11111111111111111111111111111111',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow('Session ID 11111111-1111-1111-1111-111111111111 is already registered on-chain.');

    expect(contractMock.sessionIdExists).toHaveBeenCalledWith('0x11111111111111111111111111111111');
    expect(contractMock.createSession).not.toHaveBeenCalled();
  });

  it('throws a clear error before sending when the slug already exists', async () => {
    const walletProvider = makeWalletProvider();
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const contractMock = {
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(true),
      createSession: jest.fn(),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    installWeb3ProviderMock({ signer });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'duplicate-slug',
        sessionId: '0x22222222222222222222222222222222',
        metadataURI: 'ar://example',
      }),
    ).rejects.toThrow('Session slug "duplicate-slug" is already registered on-chain.');

    expect(contractMock.sessionExists).toHaveBeenCalledWith('duplicate-slug');
    expect(contractMock.createSession).not.toHaveBeenCalled();
  });

  it('uses the public read-contract path for duplicate guards instead of mislabeling signer-provider probe failures', async () => {
    const txHash = '0xcreate';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(null),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    const web3ProviderMock = installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: txHash },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'read-path-guard',
        sessionId: '0x66666666666666666666666666666666',
        metadataURI: 'ar://example',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        txs: [{ action: 'createSession', hash: '0xcreate' }],
      }),
    );

    expect(readContractMock.sessionIdExists).toHaveBeenCalledWith('0x66666666666666666666666666666666');
    expect(readContractMock.sessionExists).toHaveBeenCalledWith('read-path-guard');
    expect(signerContractMock.createSession).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        from: TEST_SIGNER_ADDRESS,
        to: signerContractMock.address,
        data: '0xdeadbeef',
        gas: ethers.BigNumber.from('550000').toHexString(),
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
      }),
    );
    expect(web3ProviderMock.waitForTransaction).toHaveBeenCalledWith(txHash);
  });
});

describe('registerSessionOnChain creation fee overrides', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes value override when SESSION_CREATION_FEE getter succeeds', async () => {
    const txHash = '0xcreatefee';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const creationFee = ethers.BigNumber.from('100000000000000');
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(creationFee),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    const web3ProviderMock = installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: txHash },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'fee-success',
      sessionId: '0x33333333333333333333333333333333',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
    });

    expect(readContractMock.SESSION_CREATION_FEE).toHaveBeenCalled();
    expect(signerContractMock.createSession).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        gas: ethers.BigNumber.from('550000').toHexString(),
        value: creationFee.toHexString(),
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
      }),
    );
    expect(web3ProviderMock.waitForTransaction).toHaveBeenCalledWith(txHash);
    expect(result).toEqual({ txs: [{ action: 'createSession', hash: '0xcreatefee' }] });
  });

  it('uses public RPC nonce plus static fallback gas for createSession writes by default', async () => {
    const txHash = '0xcreatenonce';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = {
      provider: {
        getTransactionCount: jest.fn(),
      },
      getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS),
    };
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(null),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    const publicRpcProviderMock = installPublicRpcFeeMocks();
    publicRpcProviderMock.getTransactionCount.mockResolvedValue(12);

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: txHash },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'fee-nonce-fallback',
      sessionId: '0x99999999999999999999999999999999',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
    });

    expect(signerContractMock.estimateGas.createSession).not.toHaveBeenCalled();
    expect(publicRpcProviderMock.getTransactionCount).toHaveBeenCalledWith(TEST_SIGNER_ADDRESS, 'pending');
    expect(signer.provider.getTransactionCount).not.toHaveBeenCalled();
    expect(signerContractMock.estimateGas.createSession).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        gas: ethers.BigNumber.from('550000').toHexString(),
        nonce: ethers.BigNumber.from('12').toHexString(),
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
      }),
    );
    expect(result).toEqual({ txs: [{ action: 'createSession', hash: '0xcreatenonce' }] });
  });

  it('advances tracked nonces across multi-step session registration when public RPC lags', async () => {
    const txHashes = ['0xcreate', '0xfields', '0xgates'];
    const walletProvider = {
      request: jest.fn(async ({ method }) => {
        if (method === 'eth_sendTransaction') {
          return txHashes.shift();
        }
        return null;
      }),
    };
    const signer = {
      provider: {
        getTransactionCount: jest.fn(),
      },
      getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS),
    };
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession', 'setSessionFields', 'setResourceGates'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(null),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    const publicRpcProviderMock = installPublicRpcFeeMocks();
    publicRpcProviderMock.getTransactionCount.mockResolvedValue(6);

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xreceipt' },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'nonce-tracker',
      sessionId: '0x99999999999999999999999999999999',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
      sessionFields: { sponsored_lit: true },
      gateSelections: {
        default: {
          sbts: [{ address: '0x0000000000000000000000000000000000000002' }],
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          mode: 'any',
        },
      },
    });

    const sendCalls = walletProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction',
    );
    expect(sendCalls).toHaveLength(3);
    expect(sendCalls.map(([payload]) => payload.params[0].nonce)).toEqual([
      ethers.BigNumber.from('6').toHexString(),
      ethers.BigNumber.from('7').toHexString(),
      ethers.BigNumber.from('8').toHexString(),
    ]);
    expect(publicRpcProviderMock.getTransactionCount).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      txs: [
        { action: 'createSession', hash: '0xcreate' },
        { action: 'setSessionFields', hash: '0xfields' },
        { action: 'setResourceGates', hash: '0xgates' },
      ],
    });
  });

  it('reports the createSession tx hash before the receipt wait resolves', async () => {
    const txHash = '0xcreatepending';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(null),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    let resolveReceipt;
    const receiptPromise = new Promise((resolve) => {
      resolveReceipt = resolve;
    });
    const web3ProviderMock = installWeb3ProviderMock({ signer });
    web3ProviderMock.waitForTransaction.mockImplementation(() => receiptPromise);

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const onTxHash = jest.fn();
    const pendingResult = registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'pending-hash',
      sessionId: '0xabababababababababababababababab',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
      onTxHash,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onTxHash).toHaveBeenCalledTimes(1);
    expect(onTxHash).toHaveBeenCalledWith({ action: 'createSession', hash: txHash }, [
      { action: 'createSession', hash: txHash },
    ]);

    resolveReceipt({ status: 1, transactionHash: txHash });

    await expect(pendingResult).resolves.toEqual({
      txs: [{ action: 'createSession', hash: txHash }],
    });
  });

  it('omits value override when SESSION_CREATION_FEE getter throws CALL_EXCEPTION (legacy registry)', async () => {
    const txHash = '0xcreatefallback';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const callExceptionError = new Error('call revert exception');
    callExceptionError.code = 'CALL_EXCEPTION';
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockRejectedValue(callExceptionError),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    const web3ProviderMock = installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: txHash },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'fee-fallback',
      sessionId: '0x44444444444444444444444444444444',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
    });

    expect(readContractMock.SESSION_CREATION_FEE).toHaveBeenCalled();
    expect(signerContractMock.createSession).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        gas: ethers.BigNumber.from('550000').toHexString(),
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
      }),
    );
    expect(getLatestSendTxParams(walletProvider)?.value).toBeUndefined();
    expect(web3ProviderMock.waitForTransaction).toHaveBeenCalledWith(txHash);
    expect(result).toEqual({ txs: [{ action: 'createSession', hash: '0xcreatefallback' }] });
  });

  it('rethrows transient RPC errors from SESSION_CREATION_FEE getter', async () => {
    const walletProvider = { request: jest.fn() };
    const signer = { provider: null, getChainId: jest.fn().mockResolvedValue(CONFIGURED_REGISTRY_CHAIN_ID) };
    const rpcError = new Error('network timeout');
    rpcError.code = 'SERVER_ERROR';
    const signerContractMock = {
      createSession: jest.fn(),
    };
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockRejectedValue(rpcError),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider() {
      return {
        getSigner: () => signer,
      };
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    await expect(
      registerSessionOnChain({
        providerLike: walletProvider,
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        slug: 'fee-rpc-fail',
        sessionId: '0x55555555555555555555555555555555',
        metadataURI: 'ar://example',
        encryptedMetadataURI: '',
      }),
    ).rejects.toThrow('network timeout');

    expect(readContractMock.SESSION_CREATION_FEE).toHaveBeenCalled();
    expect(signerContractMock.createSession).not.toHaveBeenCalled();
  });

  it('falls back to a concrete public RPC read when SESSION_CREATION_FEE returns malformed null data through the shared read provider', async () => {
    const txHash = '0xcreatefee-fallback';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const creationFee = ethers.BigNumber.from('100000000000000');
    const malformedFeeError = new Error('invalid BigNumber value');
    malformedFeeError.code = 'INVALID_ARGUMENT';
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockRejectedValue(malformedFeeError),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    const retryReadContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(creationFee),
    };
    let nonSignerContractCalls = 0;
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: txHash },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      nonSignerContractCalls += 1;
      if (nonSignerContractCalls === 1) return readContractMock;
      return retryReadContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'fee-rpc-fallback',
      sessionId: '0x77777777777777777777777777777777',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
    });

    expect(readContractMock.SESSION_CREATION_FEE).toHaveBeenCalledTimes(1);
    expect(retryReadContractMock.SESSION_CREATION_FEE).toHaveBeenCalledTimes(1);
    expect(signerContractMock.createSession).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        value: creationFee.toHexString(),
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
      }),
    );
    expect(result).toEqual({ txs: [{ action: 'createSession', hash: '0xcreatefee-fallback' }] });
  });

  it('retries createSession with public RPC fee overrides when public RPC fee lookup was unavailable before the first send', async () => {
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const malformedSendError = new Error(
      'invalid BigNumber value (argument="value", value=null, code=INVALID_ARGUMENT, version=bignumber/5.7.0)',
    );
    malformedSendError.code = 'INVALID_ARGUMENT';
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(null),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    let feePhase = 'initial';
    let sendAttempts = 0;
    const walletProvider = {
      request: jest.fn(async ({ method }) => {
        if (method === 'eth_sendTransaction') {
          sendAttempts += 1;
          if (sendAttempts === 1) {
            feePhase = 'retry';
            throw malformedSendError;
          }
          return '0xcreatefee-send-retry';
        }
        return null;
      }),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xcreatefee-send-retry' },
    });
    jest.spyOn(ethers.providers, 'JsonRpcProvider').mockImplementation(function MockJsonRpcProvider() {
      return {
        getFeeData: jest.fn().mockImplementation(async () =>
          feePhase === 'retry'
            ? {
                gasPrice: null,
                maxFeePerGas: ethers.BigNumber.from('3000000000'),
                maxPriorityFeePerGas: ethers.BigNumber.from('1000000000'),
              }
            : { gasPrice: null, maxFeePerGas: null, maxPriorityFeePerGas: null },
        ),
        getGasPrice: jest.fn().mockResolvedValue(null),
      };
    });
    jest.spyOn(ethers.providers, 'FallbackProvider').mockImplementation(function MockFallbackProvider(configs) {
      return configs?.[0]?.provider || {};
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'fee-send-retry',
      sessionId: '0x88888888888888888888888888888888',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
    });

    const sendCalls = walletProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction',
    );
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[0][0].params[0]).toEqual(
      expect.objectContaining({
        gasPrice: ethers.utils.parseUnits(getDefaultGasPriceGwei(CONFIGURED_REGISTRY_CHAIN_ID), 'gwei').toHexString(),
      }),
    );
    expect(sendCalls[0][0].params[0].maxFeePerGas).toBeUndefined();
    expect(sendCalls[0][0].params[0].maxPriorityFeePerGas).toBeUndefined();
    expect(sendCalls[1][0].params[0]).toEqual(
      expect.objectContaining({
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
      }),
    );
    expect(sendCalls[1][0].params[0].gasPrice).toBeUndefined();
    expect(result).toEqual({ txs: [{ action: 'createSession', hash: '0xcreatefee-send-retry' }] });
  });

  it('falls back to the chain default gas price when all fee providers return null values', async () => {
    const walletProvider = makeWalletProvider({ txHash: '0xcreatefee-default-gas' });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const signerContractMock = makeRegistryWriteContractMock({
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      methods: ['createSession'],
    });
    const readContractMock = {
      SESSION_CREATION_FEE: jest.fn().mockResolvedValue(null),
      sessionIdExists: jest.fn().mockResolvedValue(false),
      sessionExists: jest.fn().mockResolvedValue(false),
    };
    cryptoUtils._getProvider.mockReturnValue(walletProvider);

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xcreatefee-default-gas' },
    });
    jest.spyOn(ethers.providers, 'JsonRpcProvider').mockImplementation(function MockJsonRpcProvider() {
      return {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }),
        getGasPrice: jest.fn().mockResolvedValue(null),
      };
    });
    jest.spyOn(ethers.providers, 'FallbackProvider').mockImplementation(function MockFallbackProvider(configs) {
      return configs?.[0]?.provider || {};
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      return readContractMock;
    });

    const result = await registerSessionOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'fee-default-gas',
      sessionId: '0x99999999999999999999999999999999',
      metadataURI: 'ar://example',
      encryptedMetadataURI: '',
    });

    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        gasPrice: ethers.utils.parseUnits(getDefaultGasPriceGwei(CONFIGURED_REGISTRY_CHAIN_ID), 'gwei').toHexString(),
      }),
    );
    expect(result).toEqual({ txs: [{ action: 'createSession', hash: '0xcreatefee-default-gas' }] });
  });

  it('retries setResourceGatesOnChain with public RPC fee overrides when the first send returns invalid BigNumber value=null', async () => {
    const signerProvider = { getTransactionCount: jest.fn().mockResolvedValue(7) };
    const signer = {
      provider: signerProvider,
      getAddress: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000001'),
    };
    const malformedSendError = new Error(
      'invalid BigNumber value (argument="value", value=null, code=INVALID_ARGUMENT, version=bignumber/5.7.0)',
    );
    malformedSendError.code = 'INVALID_ARGUMENT';
    let sendAttempts = 0;
    const walletProvider = {
      request: jest.fn(async ({ method }) => {
        if (method === 'eth_sendTransaction') {
          sendAttempts += 1;
          if (sendAttempts === 1) throw malformedSendError;
          return '0xsetgates-send-retry';
        }
        return null;
      }),
    };
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['setResourceGates'],
    });
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xsetgates-send-retry' },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      throw new Error('Unexpected non-signer contract construction in setResourceGatesOnChain test');
    });

    const result = await setResourceGatesOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'gate-retry',
      gates: [
        {
          resourceKey: 'default',
          sbtAddresses: ['0x0000000000000000000000000000000000000002'],
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          mode: 0,
          perMemberLimit: 0,
        },
      ],
    });

    const sendCalls = walletProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction',
    );
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[1][0].params[0]).toEqual(
      expect.objectContaining({
        maxFeePerGas: ethers.BigNumber.from('3000000000').toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from('1000000000').toHexString(),
        nonce: ethers.BigNumber.from('7').toHexString(),
      }),
    );
    expect(result).toEqual({ ok: true, txs: [{ action: 'setResourceGates', hash: '0xsetgates-send-retry' }] });
  });

  it('retries setResourceGatesOnChain with the next nonce from a wallet nonce-too-low error', async () => {
    const signerProvider = { getTransactionCount: jest.fn().mockResolvedValue(7) };
    const signer = {
      provider: signerProvider,
      getAddress: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000001'),
    };
    const nonceError = new Error(
      'Nonce provided for the transaction (7) is lower than the current nonce of the account. Details: nonce too low: next nonce 8, tx nonce 7',
    );
    nonceError.shortMessage = 'Nonce provided for the transaction (7) is lower than the current nonce of the account.';
    nonceError.details = 'nonce too low: next nonce 8, tx nonce 7';
    let sendAttempts = 0;
    const walletProvider = {
      request: jest.fn(async ({ method }) => {
        if (method === 'eth_sendTransaction') {
          sendAttempts += 1;
          if (sendAttempts === 1) throw nonceError;
          return '0xsetgates-nonce-retry';
        }
        return null;
      }),
    };
    const signerContractMock = makeRegistryWriteContractMock({
      methods: ['setResourceGates'],
    });
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    const publicRpcProviderMock = installPublicRpcFeeMocks();
    publicRpcProviderMock.getTransactionCount.mockResolvedValue(7);

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xsetgates-nonce-retry' },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract(address, abi, providerOrSigner) {
      if (providerOrSigner === signer) return signerContractMock;
      throw new Error('Unexpected non-signer contract construction in setResourceGatesOnChain nonce test');
    });

    const result = await setResourceGatesOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'gate-nonce-retry',
      gates: [
        {
          resourceKey: 'default',
          sbtAddresses: ['0x0000000000000000000000000000000000000002'],
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          mode: 0,
          perMemberLimit: 0,
        },
      ],
    });

    const sendCalls = walletProvider.request.mock.calls.filter(
      ([payload]) => payload?.method === 'eth_sendTransaction',
    );
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[0][0].params[0].nonce).toBe(ethers.BigNumber.from('7').toHexString());
    expect(sendCalls[1][0].params[0].nonce).toBe(ethers.BigNumber.from('8').toHexString());
    expect(result).toEqual({ ok: true, txs: [{ action: 'setResourceGates', hash: '0xsetgates-nonce-retry' }] });
  });
});

describe('sessionRegistry contract defaults', () => {
  it('keeps sessionRegistry default and does not inject the removed release-one XP contract into resolved config contracts', () => {
    const config = __sessionRegistryTestUtils.buildSessionConfigFromRegistry({
      session: {
        slug: 'test-7',
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        metadataURI: 'ar://tx',
        encryptedMetadataURI: '',
        adminAddress: '0x0000000000000000000000000000000000000001',
        updatedAt: 1,
        sessionId: '0xb20bcc6d40274759b4a5cd94d949b577',
        sessionIdHex: '0xb20bcc6d40274759b4a5cd94d949b577',
      },
      metadata: {
        contracts: {
          surveys: { address: '0x0000000000000000000000000000000000000002', chainId: CONFIGURED_REGISTRY_CHAIN_ID },
        },
      },
      gatesByResource: {},
      fieldsByKey: {},
      registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
      metadataLoadState: 'loaded',
    });

    expect(config.contracts.sessionRegistry).toEqual({
      address: getSessionRegistryAddress(CONFIGURED_REGISTRY_CHAIN_ID),
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
    });
    expect(config.contracts.xp).toBeUndefined();
    expect(config.__registry.metadataLoadState).toBe('loaded');
    expect(config.__registry.metadataDefaultedContractKeys).toEqual(
      expect.arrayContaining(['sessionRegistry', 'sbtFactory']),
    );
    expect(config.__registry.metadataDefaultedContractKeys).not.toContain('surveys');
  });

  it('derives sponsored gates without reintroducing the legacy sponsoredSbtAddress root field', () => {
    const config = __sessionRegistryTestUtils.buildSessionConfigFromRegistry({
      session: {
        slug: 'sponsored-edge',
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        metadataURI: 'ar://tx',
        encryptedMetadataURI: '',
        adminAddress: '0x0000000000000000000000000000000000000001',
        updatedAt: 1,
        sessionId: '0xb20bcc6d40274759b4a5cd94d949b578',
        sessionIdHex: '0xb20bcc6d40274759b4a5cd94d949b578',
      },
      metadata: {
        ai: {
          models: {
            fast: { provider: 'openai' },
          },
        },
      },
      gatesByResource: {
        default: {
          lookupStatus: 'ok',
          sbtAddresses: ['0x00000000000000000000000000000000000000f1'],
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          mode: 'any',
        },
        ai: {
          lookupStatus: 'ok',
          sbtAddresses: ['0x00000000000000000000000000000000000000f1'],
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          mode: 'any',
        },
      },
      fieldsByKey: {},
      registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
      metadataLoadState: 'loaded',
    });

    expect(config.sponsored).toEqual(
      expect.objectContaining({
        defaultGateId: 'registry-default',
        resources: expect.objectContaining({
          ai: expect.objectContaining({
            gateId: 'registry-ai',
            provider: 'openai',
          }),
        }),
      }),
    );
    expect(config.sponsored.gates['registry-default']).toEqual(
      expect.objectContaining({
        sbtAddress: '0x00000000000000000000000000000000000000f1',
        sbtAddresses: ['0x00000000000000000000000000000000000000f1'],
      }),
    );
    expect(config).not.toHaveProperty('sponsoredSbtAddress');
  });

  it('hydrates registry rpcUrl fields into the client read-provider path config', () => {
    const config = __sessionRegistryTestUtils.buildSessionConfigFromRegistry({
      session: {
        slug: 'rpc-sponsored-edge',
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        metadataURI: 'ar://tx',
        encryptedMetadataURI: '',
        adminAddress: '0x0000000000000000000000000000000000000001',
        updatedAt: 1,
        sessionId: '0xb20bcc6d40274759b4a5cd94d949b579',
        sessionIdHex: '0xb20bcc6d40274759b4a5cd94d949b579',
      },
      metadata: {},
      gatesByResource: {
        rpc: {
          lookupStatus: 'ok',
          sbtAddresses: [],
          chainId: CONFIGURED_REGISTRY_CHAIN_ID,
          mode: 'any',
        },
      },
      fieldsByKey: {
        rpcUrl: ' https://browser-safe-rpc.example ',
        sponsored_rpc: '1',
      },
      registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
      metadataLoadState: 'loaded',
    });

    expect(config.rpc.providers.path.rpcUrl).toBe('https://browser-safe-rpc.example');
    expect(config.sponsoredKeys.rpc).toBe(true);
    expect(config.__registry.gatesByResource.rpc.lookupStatus).toBe('ok');
  });

  it('marks synthesized contract defaults when registry metadata could not be loaded', () => {
    const config = __sessionRegistryTestUtils.buildSessionConfigFromRegistry({
      session: {
        slug: 'demo',
        chainId: CONFIGURED_REGISTRY_CHAIN_ID,
        metadataURI: 'ar://missing',
        encryptedMetadataURI: '',
        adminAddress: '0x0000000000000000000000000000000000000001',
        updatedAt: 1,
        sessionId: '0xb20bcc6d40274759b4a5cd94d949b577',
        sessionIdHex: '0xb20bcc6d40274759b4a5cd94d949b577',
      },
      metadata: null,
      gatesByResource: {},
      fieldsByKey: {},
      registryChainId: CONFIGURED_REGISTRY_CHAIN_ID,
      metadataLoadState: 'unavailable',
    });

    expect(config.__registry.metadataLoadState).toBe('unavailable');
    expect(config.__registry.metadataDefaultedContractKeys).toEqual(
      expect.arrayContaining(['surveys', 'sbtFactory', 'sessionRegistry']),
    );
  });
});

describe('sessionRegistry gas buffering', () => {
  it('applies a 20 percent buffer when estimate exceeds the fallback floor', () => {
    const gasLimit = __sessionRegistryTestUtils.resolveBufferedGasLimit(ethers.BigNumber.from('600000'), 550000);

    expect(gasLimit.toString()).toBe('720000');
  });

  it('keeps the fallback floor when buffered estimate is smaller', () => {
    const gasLimit = __sessionRegistryTestUtils.resolveBufferedGasLimit(ethers.BigNumber.from('200000'), 550000);

    expect(gasLimit.toString()).toBe('550000');
  });
});

describe('updateSessionMetadataOnChain gas fallback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends metadata updates with a buffered gas limit', async () => {
    const txHash = '0xmetadatahash';
    const walletProvider = makeWalletProvider({ txHash });
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const contractMock = makeRegistryWriteContractMock({
      methods: ['updateSessionMetadata'],
    });
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    const web3ProviderMock = installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: txHash },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const result = await updateSessionMetadataOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'edge',
      metadataURI: 'ar://new-metadata',
      encryptedMetadataURI: '',
    });

    expect(contractMock.estimateGas.updateSessionMetadata).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        gas: ethers.BigNumber.from('350000').toHexString(),
      }),
    );
    expect(web3ProviderMock.waitForTransaction).toHaveBeenCalledWith(txHash);
    expect(result).toEqual({ ok: true, txHash: '0xmetadatahash' });
  });
});

describe('setSessionFieldsOnChain gas fallback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes session field update slugs before encoding registry writes', async () => {
    const walletProvider = makeWalletProvider();
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const contractMock = makeRegistryWriteContractMock({
      methods: ['setSessionFields'],
    });
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xtxhash' },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const result = await setSessionFieldsOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: ' Team_A-1 ',
      fields: {
        corsWorkerUrl: 'https://worker.example',
      },
    });

    expect(contractMock.interface.encodeFunctionData).toHaveBeenCalledWith('setSessionFields', [
      'team_a-1',
      ['corsWorkerUrl'],
      ['https://worker.example'],
    ]);
    expect(result).toEqual({ ok: true });
  });

  it('falls back to the session-field gas floor when estimation fails', async () => {
    const walletProvider = makeWalletProvider();
    const signer = { provider: null, getAddress: jest.fn().mockResolvedValue(TEST_SIGNER_ADDRESS) };
    const contractMock = makeRegistryWriteContractMock({
      methods: ['setSessionFields'],
    });
    cryptoUtils._getProvider.mockReturnValue(walletProvider);
    installPublicRpcFeeMocks();

    installWeb3ProviderMock({
      signer,
      receipt: { status: 1, transactionHash: '0xtxhash' },
    });
    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return contractMock;
    });

    const result = await setSessionFieldsOnChain({
      providerLike: walletProvider,
      chainId: CONFIGURED_REGISTRY_CHAIN_ID,
      slug: 'edge',
      fields: {
        corsWorkerUrl: 'https://worker.example',
      },
    });

    expect(contractMock.estimateGas.setSessionFields).not.toHaveBeenCalled();
    expect(getLatestSendTxParams(walletProvider)).toEqual(
      expect.objectContaining({
        gas: ethers.BigNumber.from('300000').toHexString(),
      }),
    );
    expect(result).toEqual({ ok: true });
  });
});
