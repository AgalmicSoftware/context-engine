const TEST_ADDRESS = '0x00000000000000000000000000000000000000aa';
const ACCESS_CONTROL_CONDITIONS = [
  {
    contractAddress: '0x0000000000000000000000000000000000000101',
    standardContractType: 'ERC721',
    chain: 'baseSepolia',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: { comparator: '>', value: '0' },
  },
];
const BASE_GET_KEY_OPTS = {
  requesterAddress: TEST_ADDRESS,
  ciphertext: 'ciphertext-1',
  dataToEncryptHash: 'hash-1',
  resourceId: { baseUrl: 'context-engine', path: '/resource-a' },
};

const createMockNetwork = (rpcUrl = 'https://rpc.lit.example') => {
  const network = {
    getRpcUrl: jest.fn(() => rpcUrl),
    getEndpoints: jest.fn(() => null),
    api: {},
  };
  network.withOverrides = jest.fn(({ rpcUrl: nextRpcUrl } = {}) => (
    createMockNetwork(nextRpcUrl || rpcUrl)
  ));
  return network;
};

const loadLitHarness = ({
  litClientModule = { createLitClient: jest.fn(async () => ({ disconnect: jest.fn() })) },
  authModule,
  cryptoUtils,
  arweaveScripts,
  workerAuth,
  corsProxy,
} = {}) => {
  jest.resetModules();

  const createEoaAuthContext = jest.fn(async () => ({ session: 'lit-auth-context' }));
  const createAuthManager = jest.fn(() => ({
    createEoaAuthContext,
  }));
  const localStoragePlugin = jest.fn(() => null);
  const providerRequest = jest.fn(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [TEST_ADDRESS];
    if (method === 'eth_chainId') return '0x14a34';
    return null;
  });
  const networkModule = createMockNetwork();

  jest.doMock('viem', () => ({
    __esModule: true,
    createPublicClient: jest.fn(() => ({ getLogs: jest.fn(async () => []) })),
    createWalletClient: jest.fn(({ account }) => ({ account })),
    custom: jest.fn((provider) => provider),
    http: jest.fn((url) => ({ url })),
  }));
  jest.doMock('@lit-protocol/lit-client', () => ({
    __esModule: true,
    ...litClientModule,
  }));
  jest.doMock('@lit-protocol/auth', () => ({
    __esModule: true,
    createAuthManager,
    storagePlugins: {
      localStorage: localStoragePlugin,
    },
    ...(authModule || {}),
  }));
  jest.doMock('@lit-protocol/networks', () => ({
    __esModule: true,
    nagaDev: networkModule,
    nagaTest: networkModule,
    naga: networkModule,
  }));
  jest.doMock('./cryptography.js', () => ({
    __esModule: true,
    cryptoUtils: {
      _getProvider: jest.fn(() => ({ request: providerRequest })),
      encryptEnvelopeValue: jest.fn(),
      decryptEnvelopeValue: jest.fn(),
      ...(cryptoUtils || {}),
    },
  }));
  jest.doMock('../arweave/arweaveScripts.js', () => ({
    __esModule: true,
    arweaveScripts: {
      uploadDataToArweave: jest.fn(),
      downloadDataFromArweave: jest.fn(),
      buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.example.test/${txId}`),
      ...(arweaveScripts || {}),
    },
  }));
  jest.doMock('../logging', () => ({
    __esModule: true,
    createLogger: () => ({
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  }));
  jest.doMock('../worker/workerAuth.js', () => ({
    __esModule: true,
    fetchWorkerWithAuth: jest.fn(async () => ({
      ok: true,
      json: async () => ({ capabilityAuthSig: { sig: '0xcapability' } }),
    })),
    buildSignedBootstrapAdminAuth: jest.fn(async () => ({
      address: TEST_ADDRESS,
      message: 'bootstrap-message',
      signature: '0xbootstrap',
      sessionSlug: 'edge',
    })),
    normalizeWorkerUrl: jest.fn((value = '') => String(value || '').trim()),
    ...(workerAuth || {}),
  }));
  jest.doMock('../worker/corsProxy.js', () => ({
    __esModule: true,
    getCorsProxyUrlOrThrow: jest.fn(async () => 'https://resolved.worker.example'),
    ...(corsProxy || {}),
  }));

  return {
    litProtocol: require('./litProtocol.js'),
    createEoaAuthContext,
    createAuthManager,
    localStoragePlugin,
    providerRequest,
  };
};

describe('error paths', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gracefully surfaces Lit SDK initialization failures when the client factory is unavailable', async () => {
    const { litProtocol } = loadLitHarness({
      litClientModule: {},
    });
    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
    });

    await expect(
      hooks.getKey(BASE_GET_KEY_OPTS)
    ).rejects.toThrow('Lit client module missing createLitClient export.');
  });

  it('propagates controlled decrypt failures for corrupt ciphertext', async () => {
    const decryptError = new Error('corrupt ciphertext');
    const decrypt = jest.fn(async () => {
      throw decryptError;
    });
    const { litProtocol, createEoaAuthContext } = loadLitHarness({
      litClientModule: {
        createLitClient: jest.fn(async () => ({
          decrypt,
          disconnect: jest.fn(),
        })),
      },
    });
    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
    });

    await expect(
      hooks.getKey(BASE_GET_KEY_OPTS)
    ).rejects.toBe(decryptError);

    expect(createEoaAuthContext).toHaveBeenCalledTimes(1);
    expect(decrypt).toHaveBeenCalledTimes(1);
  });

  it('does not return a stale key when a cache miss also hits a network failure', async () => {
    const { litProtocol } = loadLitHarness();
    const cachedKey = new Uint8Array(32).fill(7);
    const getKeyUncached = jest.fn(async ({ resourceId }) => {
      if (resourceId?.path === '/resource-a') return cachedKey;
      throw new Error('network timeout');
    });
    const { getKey } = litProtocol.__test__wrapLitGetKeyWithCache(getKeyUncached, {
      account: TEST_ADDRESS,
      litNetwork: 'naga-dev',
      chain: 'baseSepolia',
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
    });

    const first = await getKey(BASE_GET_KEY_OPTS);

    expect(first).toBe(cachedKey);
    await expect(
      getKey({
        ...BASE_GET_KEY_OPTS,
        ciphertext: 'ciphertext-2',
        dataToEncryptHash: 'hash-2',
        resourceId: { baseUrl: 'context-engine', path: '/resource-b' },
      })
    ).rejects.toThrow('network timeout');
    expect(getKeyUncached).toHaveBeenCalledTimes(2);
  });

  it('uses in-memory auth storage even when the SDK localStorage plugin is available', async () => {
    const decryptError = new Error('corrupt ciphertext');
    const decrypt = jest.fn(async () => {
      throw decryptError;
    });
    const { litProtocol, createAuthManager, localStoragePlugin } = loadLitHarness({
      litClientModule: {
        createLitClient: jest.fn(async () => ({
          decrypt,
          disconnect: jest.fn(),
        })),
      },
    });
    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
    });

    await expect(
      hooks.getKey(BASE_GET_KEY_OPTS)
    ).rejects.toBe(decryptError);

    expect(localStoragePlugin).not.toHaveBeenCalled();
    expect(createAuthManager).toHaveBeenCalledTimes(1);
    expect(createAuthManager.mock.calls[0]?.[0]?.storage?.config?.type).toBe('memory');
  });

  it('scans naga root key logs backward in chunks instead of querying from block zero to latest', async () => {
    const { litProtocol } = loadLitHarness();
    const getBlockNumber = jest.fn(async () => 90000n);
    const getLogs = jest.fn(async ({ fromBlock, toBlock }) => {
      if (fromBlock === 40001n && toBlock === 90000n) {
        return [{
          blockNumber: 88000n,
          args: {
            stakingContract: '0x00000000000000000000000000000000000000BB',
            rootKey: {
              keyType: 1n,
              pubkey: '0xaaaabbbb',
            },
          },
        }];
      }
      if (fromBlock === 0n && toBlock === 40000n) {
        return [
          {
            blockNumber: 35000n,
            args: {
              stakingContract: '0x00000000000000000000000000000000000000bb',
              rootKey: {
                keyType: 2n,
                pubkey: '0xccccdddd',
              },
            },
          },
          {
            blockNumber: 12000n,
            args: {
              stakingContract: '0x00000000000000000000000000000000000000bb',
              rootKey: {
                keyType: 1n,
                pubkey: '0xeeeeffff',
              },
            },
          },
        ];
      }
      return [];
    });

    const latestByType = await litProtocol.__test__scanNagaRootKeySetLogsReverse({
      publicClient: { getBlockNumber, getLogs },
      pubkeyRouterAddress: '0x9067d809df0CF7DaF6a9f20E39d572fee1564c8E',
      rootKeySetEvent: { name: 'RootKeySet' },
      stakingAddress: '0x00000000000000000000000000000000000000bb',
    });

    expect(getBlockNumber).toHaveBeenCalledTimes(1);
    expect(getLogs).toHaveBeenCalledTimes(2);
    expect(getLogs).toHaveBeenNthCalledWith(1, expect.objectContaining({
      fromBlock: 40001n,
      toBlock: 90000n,
    }));
    expect(getLogs).toHaveBeenNthCalledWith(2, expect.objectContaining({
      fromBlock: 0n,
      toBlock: 40000n,
    }));
    expect(getLogs).not.toHaveBeenCalledWith(expect.objectContaining({
      fromBlock: 0n,
      toBlock: 'latest',
    }));
    expect(latestByType.get(1)).toEqual({
      blockNumber: 88000n,
      values: ['aaaabbbb'],
    });
    expect(latestByType.get(2)).toEqual({
      blockNumber: 35000n,
      values: ['ccccdddd'],
    });
  });

  it('falls back to corsProxy resolution when payment delegation receives an encrypted worker config value', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      json: async () => ({ capabilityAuthSig: { sig: '0xcapability' } }),
    }));
    const getCorsProxyUrlOrThrow = jest.fn(async () => 'https://resolved.worker.example');
    const encrypt = jest.fn(async () => ({
      ciphertext: 'ciphertext',
      dataToEncryptHash: 'hash',
    }));

    const { litProtocol } = loadLitHarness({
      litClientModule: {
        createLitClient: jest.fn(async () => ({
          encrypt,
          disconnect: jest.fn(),
        })),
      },
      workerAuth: {
        fetchWorkerWithAuth,
        normalizeWorkerUrl: jest.fn((value = '') => String(value || '').trim()),
      },
      corsProxy: {
        getCorsProxyUrlOrThrow,
      },
    });

    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
      paymentDelegation: {
        enabled: true,
        sessionSlug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: { ciphertext: 'locked-worker-url' },
        },
        workerUrl: { ciphertext: 'locked-worker-url' },
      },
    });

    await expect(
      hooks.saveKey(new Uint8Array(32).fill(7))
    ).resolves.toEqual({
      ciphertext: 'ciphertext',
      dataToEncryptHash: 'hash',
    });

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      sessionSlug: 'edge',
      sessionConfig: expect.objectContaining({ slug: 'edge' }),
    }));
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://resolved.worker.example/lit/payment-delegation',
      expect.any(Object),
      expect.objectContaining({
        workerUrl: 'https://resolved.worker.example',
      }),
    );
  });

  it('strips bootstrap payer keys from returned and globally published Lit hooks', () => {
    const { litProtocol } = loadLitHarness();

    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
      paymentDelegation: {
        enabled: true,
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example',
        bootstrapLitPayerPrivateKey: '0xsuper-secret',
      },
    });

    expect(hooks.paymentDelegation).toEqual({
      enabled: true,
      sessionSlug: 'edge',
      workerUrl: 'https://worker.example',
    });
    litProtocol.setGlobalLitHooks(hooks);
    expect(litProtocol.getGlobalLitHooks()?.paymentDelegation).toEqual({
      enabled: true,
      sessionSlug: 'edge',
      workerUrl: 'https://worker.example',
    });
    expect(litProtocol.getGlobalLitHooks()?.paymentDelegation?.bootstrapLitPayerPrivateKey).toBeUndefined();
  });
});
