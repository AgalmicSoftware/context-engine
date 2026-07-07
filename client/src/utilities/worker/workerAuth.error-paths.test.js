import { clearAllWorkerSessionTokens, getWorkerSessionToken, normalizeWorkerUrl } from './workerAuth.js';

const TEST_ADDRESS = '0x00000000000000000000000000000000000000aa';

jest.mock('ethers', () => {
  class MockWeb3Provider {
    constructor(provider) {
      this.provider = provider;
    }

    getSigner(address) {
      return {
        getAddress: jest.fn(async () => address || TEST_ADDRESS),
        signMessage: jest.fn(async () => '0xsigned'),
      };
    }
  }

  return {
    ethers: {
      providers: {
        Web3Provider: MockWeb3Provider,
      },
    },
  };
});

jest.mock('../../store.js', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({
      profile: {
        account: TEST_ADDRESS,
        provider: 'wagmi',
        network: { id: 84532 },
      },
      sessionState: {},
    })),
  },
}));

jest.mock('./corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));

jest.mock('../../variables/appConfig.js', () => ({
  USE_ONCHAIN_SESSION_REGISTRY: false,
}));

const mockProviderRequest = jest.fn(async ({ method }) => {
  if (method === 'eth_accounts') return [TEST_ADDRESS];
  if (method === 'eth_requestAccounts') return [TEST_ADDRESS];
  return [];
});

jest.mock('../crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({
      request: mockProviderRequest,
    })),
  },
}));

jest.mock('../urlUtils.js', () => ({
  ensureHttpUrl: jest.fn((url) => url),
}));

jest.mock('../session/sessionNaming.js', () => {
  const actual = jest.requireActual('../session/sessionNaming.js');
  return {
    ...actual,
    resolveActiveSessionSlug: jest.fn(() => ''),
  };
});

jest.mock('../logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const jsonResp = (status, payload = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});

describe('error paths', () => {
  const originalFetch = global.fetch;
  const authContext = {
    account: TEST_ADDRESS,
    providerLike: 'wagmi',
    chainId: 84532,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mockStore = require('../../store.js').default;
    mockStore.getState.mockReturnValue({
      profile: {
        account: TEST_ADDRESS,
        provider: 'wagmi',
        network: { id: 84532 },
      },
      sessionState: {},
    });
    mockProviderRequest.mockClear();
    mockProviderRequest.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') return [TEST_ADDRESS];
      if (method === 'eth_requestAccounts') return [TEST_ADDRESS];
      return [];
    });
    localStorage.clear();
    clearAllWorkerSessionTokens();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('propagates transport failures when the worker URL is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(getWorkerSessionToken({ workerUrl: 'https://worker.example', context: authContext })).rejects.toThrow(
      'Failed to fetch',
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a still-live bearer from legacy persistent storage', async () => {
    const cacheKey = `ce:workerToken:v1:${normalizeWorkerUrl('https://worker.example')}::${TEST_ADDRESS}`;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        token: 'expired-token',
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
    );
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, {}));

    await expect(getWorkerSessionToken({ workerUrl: 'https://worker.example', context: authContext })).rejects.toThrow(
      'Worker login did not return a token.',
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('treats malformed nonce responses as controlled failures instead of crashing', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json');
      },
      text: async () => 'not-json',
    });

    await expect(getWorkerSessionToken({ workerUrl: 'https://worker.example', context: authContext })).rejects.toThrow(
      'Worker nonce response missing nonce.',
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('maps arbitrary nonce errors without disclosing remote credential text', async () => {
    const canaryCredential = 'nonce-credential-canary-never-render';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(401, { error: `Authorization: Bearer ${canaryCredential}` }));

    const error = await getWorkerSessionToken({
      workerUrl: 'https://worker.example',
      context: authContext,
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      message: 'Worker nonce request failed (401).',
      reason: 'worker_auth_worker_nonce_failed',
      status: 401,
    });
    expect(String(error?.message || error)).not.toContain(canaryCredential);
  });

  it('maps arbitrary login errors without disclosing the submitted SIWE signature or message', async () => {
    const canarySignature = '0xsigned';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockImplementationOnce(async (_url, init) => {
        const submittedLogin = JSON.parse(String(init?.body || '{}'));
        expect(submittedLogin.signature).toBe(canarySignature);
        expect(submittedLogin.message).toContain('wants you to sign in');
        return jsonResp(403, {
          error: `Rejected ${submittedLogin.signature}; ${submittedLogin.message}`,
        });
      });

    const error = await getWorkerSessionToken({
      workerUrl: 'https://worker.example',
      context: authContext,
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      message: 'Worker login failed (403).',
      reason: 'worker_auth_worker_login_failed',
      status: 403,
    });
    expect(String(error?.message || error)).not.toContain(canarySignature);
    expect(String(error?.message || error)).not.toContain('wants you to sign in');
  });
});
