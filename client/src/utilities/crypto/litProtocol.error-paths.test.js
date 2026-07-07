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

const CHIPOTLE_RUNTIME = {
  workerUrl: 'https://worker.example.test',
  sessionSlug: 'chipotle-error-paths',
  litCredentials: {
    litApiBase: 'https://api.chipotle.litprotocol.com',
    litActionCid: 'QmAction123',
    litPkpId: '0xpkp123',
  },
};

const loadLitHarness = ({ workerAuth } = {}) => {
  jest.resetModules();

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
      status: 200,
      json: async () => ({ response: { response: { ok: true } } }),
    })),
    normalizeWorkerUrl: jest.fn((value = '') => String(value || '').trim()),
    ...(workerAuth || {}),
  }));

  return {
    litProtocol: require('./litProtocol.js'),
    workerAuthModule: require('../worker/workerAuth.js'),
  };
};

describe('litProtocol chipotle error paths', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no Chipotle worker runtime is configured', () => {
    const { litProtocol } = loadLitHarness();

    expect(
      litProtocol.createLitHooks({
        providerLike: 'wagmi',
        account: TEST_ADDRESS,
        chainId: 84532,
        accessControlConditions: ACCESS_CONTROL_CONDITIONS,
      }),
    ).toBeNull();
  });

  it('surfaces worker-side gate denial errors during decrypt', async () => {
    const { litProtocol } = loadLitHarness({
      workerAuth: {
        fetchWorkerWithAuth: jest.fn(async () => ({
          ok: false,
          status: 403,
          json: async () => ({ error: 'Requester does not satisfy the SBT gate.' }),
        })),
      },
    });

    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
      chipotle: CHIPOTLE_RUNTIME,
    });

    await expect(
      hooks.getKey({
        requesterAddress: TEST_ADDRESS,
        ciphertext: 'ciphertext-1',
        dataToEncryptHash: 'hash-1',
        rpcUrl: 'https://rpc.example.test',
      }),
    ).rejects.toThrow('Requester does not satisfy the SBT gate.');
  });

  it('rejects legacy Chipotle v1 metadata before worker decrypt', async () => {
    const fetchWorkerWithAuth = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: { response: { ok: true, plaintext: `0x${'07'.repeat(32)}` } } }),
    }));
    const { litProtocol } = loadLitHarness({
      workerAuth: { fetchWorkerWithAuth },
    });

    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
      chipotle: CHIPOTLE_RUNTIME,
    });

    await expect(
      hooks.getKey({
        requesterAddress: TEST_ADDRESS,
        ciphertext: 'ciphertext-1',
        dataToEncryptHash: 'hash-1',
        chipotle: {
          version: 1,
          chainId: 84532,
          gateMode: 'any',
          sbtAddresses: ['0x0000000000000000000000000000000000000101'],
        },
      }),
    ).rejects.toThrow('Lit Chipotle legacy wrapped keys are not supported.');
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  });

  it('rejects encrypt responses that do not contain a ciphertext payload', async () => {
    const { litProtocol } = loadLitHarness({
      workerAuth: {
        fetchWorkerWithAuth: jest.fn(async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            response: {
              response: {
                ok: true,
              },
            },
          }),
        })),
      },
    });

    const hooks = litProtocol.createLitHooks({
      providerLike: 'wagmi',
      account: TEST_ADDRESS,
      chainId: 84532,
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
      chipotle: CHIPOTLE_RUNTIME,
    });

    await expect(
      hooks.saveKey(new Uint8Array(32).fill(7), {
        rpcUrl: 'https://rpc.example.test',
      }),
    ).rejects.toThrow('Lit Chipotle encrypt did not return ciphertext.');
  });

  it('does not return a stale key when a cache miss also hits a worker failure', async () => {
    const { litProtocol } = loadLitHarness();
    const cachedKey = new Uint8Array(32).fill(7);
    const getKeyUncached = jest.fn(async ({ resourceId }) => {
      if (resourceId?.path === '/resource-a') return cachedKey;
      throw new Error('worker timeout');
    });
    const { getKey } = litProtocol.__test__wrapLitGetKeyWithCache(getKeyUncached, {
      account: TEST_ADDRESS,
      litNetwork: 'chipotle',
      chain: 'baseSepolia',
      accessControlConditions: ACCESS_CONTROL_CONDITIONS,
    });

    const first = await getKey({
      requesterAddress: TEST_ADDRESS,
      ciphertext: 'ciphertext-1',
      dataToEncryptHash: 'hash-1',
      resourceId: { baseUrl: 'context-engine', path: '/resource-a' },
    });

    expect(first).toBe(cachedKey);
    await expect(
      getKey({
        requesterAddress: TEST_ADDRESS,
        ciphertext: 'ciphertext-2',
        dataToEncryptHash: 'hash-2',
        resourceId: { baseUrl: 'context-engine', path: '/resource-b' },
      }),
    ).rejects.toThrow('worker timeout');
    expect(getKeyUncached).toHaveBeenCalledTimes(2);
  });
});
