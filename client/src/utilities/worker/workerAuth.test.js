import {
  buildSignedAdminActionAuth,
  buildSignedBootstrapAdminAuth,
  clearAllWorkerSessionTokens,
  __test__workerAuthTokenCache,
  fetchWorkerWithAuth,
  getWorkerAuthHeaders,
  getWorkerSessionToken,
  normalizeWorkerUrl,
} from './workerAuth.js';
import { getCorsProxyUrlOrThrow } from './corsProxy.js';
import {
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../session/sessionWorkerConfigCache.js';

const TEST_ADDRESS = '0x00000000000000000000000000000000000000aa';
const NEXT_TEST_ADDRESS = '0x00000000000000000000000000000000000000bb';
const CANONICAL_SESSION_ID = '0x1234567890abcdef1234567890abcdef';
const NEXT_CANONICAL_SESSION_ID = '0xfedcba0987654321fedcba0987654321';

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
      utils: {
        keccak256: jest.fn(() => `0x${'ab'.repeat(32)}`),
        toUtf8Bytes: jest.fn((value) => value),
        verifyTypedData: jest.fn(() => TEST_ADDRESS),
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
  USE_ONCHAIN_SESSION_REGISTRY: true,
}));

jest.mock('../session/sessionRegistryReader.js', () => ({
  getRegistrySessionConfig: jest.fn(() => null),
}));

const defaultProviderRequest = async ({ method }) => {
  if (method === 'eth_accounts') return [TEST_ADDRESS];
  if (method === 'eth_requestAccounts') return [TEST_ADDRESS];
  if (method === 'eth_signTypedData_v4') return '0xtyped-signed';
  return [];
};
const mockProviderRequest = jest.fn(defaultProviderRequest);

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
  createLogger: () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const jsonResp = (status, payload = {}) => {
  const bodyText = JSON.stringify(payload);
  const buildResponse = () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => bodyText,
    clone: () => buildResponse(),
  });
  return buildResponse();
};

const flushPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  clearAllWorkerSessionTokens();
});

describe('workerAuth normalizeWorkerUrl', () => {
  it('strips known endpoint suffixes to recover worker base URL', () => {
    expect(normalizeWorkerUrl('https://worker.example/arweave/upload')).toBe('https://worker.example');
    expect(normalizeWorkerUrl('https://worker.example/auth/nonce')).toBe('https://worker.example');
    expect(normalizeWorkerUrl('https://worker.example/admin/lit-chipotle-provision')).toBe('https://worker.example');
    expect(normalizeWorkerUrl('https://worker.example/lit/chipotle-action')).toBe('https://worker.example');
  });

  it('preserves non-endpoint path prefixes', () => {
    expect(normalizeWorkerUrl('https://worker.example/custom-prefix/auth/nonce')).toBe(
      'https://worker.example/custom-prefix',
    );
    expect(normalizeWorkerUrl('https://worker.example/custom-prefix')).toBe('https://worker.example/custom-prefix');
  });

  it('auto-prefixes protocol-less worker hosts before auth paths', () => {
    const { ensureHttpUrl } = require('../urlUtils.js');
    ensureHttpUrl.mockImplementationOnce((value) => `https://${value}`);

    expect(normalizeWorkerUrl('worker.example/auth/login')).toBe('https://worker.example');
  });

  it('rejects relative worker URLs instead of treating them as auth bases', () => {
    expect(normalizeWorkerUrl('/relative/auth/nonce')).toBe('');
  });
});

describe('workerAuth token cache envelopes', () => {
  it('purges legacy persisted bearer entries when the cache module initializes', () => {
    const cacheKey = `ce:workerToken:v1:https://worker.example:edge:${TEST_ADDRESS}`;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        token: 'persisted-worker-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );

    jest.isolateModules(() => {
      require('./workerAuthTokenCache.js');
    });

    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('normalizes scoped v1 token envelopes', () => {
    const envelope = __test__workerAuthTokenCache.buildTokenCacheEnvelope({
      token: 'token-1',
      exp: 4600,
      workerUrl: 'https://worker.example/auth/login',
      sessionSlug: 'edge',
      address: TEST_ADDRESS,
      issuedAt: 1000,
    });

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(envelope, {
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        address: TEST_ADDRESS,
        nowSeconds: 1200,
        skewSeconds: 30,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        token: 'token-1',
        expiresAt: 4600,
        issuedAt: 1000,
        legacy: false,
      }),
    );
  });

  it('rejects scoped token envelopes that target a different worker/session/address', () => {
    const envelope = __test__workerAuthTokenCache.buildTokenCacheEnvelope({
      token: 'token-1',
      exp: 4600,
      workerUrl: 'https://worker.example',
      sessionId: CANONICAL_SESSION_ID,
      sessionSlug: 'edge',
      address: TEST_ADDRESS,
      issuedAt: 1000,
    });

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(envelope, {
        workerUrl: 'https://other-worker.example',
        sessionSlug: 'edge',
        address: TEST_ADDRESS,
        nowSeconds: 1200,
      }),
    ).toEqual({ ok: false, status: 'scope-mismatch' });

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(envelope, {
        workerUrl: 'https://worker.example',
        sessionSlug: 'other-session',
        address: TEST_ADDRESS,
        nowSeconds: 1200,
      }),
    ).toEqual({ ok: false, status: 'scope-mismatch' });

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(envelope, {
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        address: NEXT_TEST_ADDRESS,
        nowSeconds: 1200,
      }),
    ).toEqual({ ok: false, status: 'scope-mismatch' });
  });

  it('keeps legacy token entries readable only when they still have a valid expiry', () => {
    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(
        {
          token: 'legacy-token',
          exp: 4600,
        },
        {
          nowSeconds: 1200,
          skewSeconds: 30,
        },
      ),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        token: 'legacy-token',
        legacy: true,
      }),
    );

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(
        {
          token: 'legacy-token',
        },
        {
          nowSeconds: 1200,
        },
      ),
    ).toEqual({ ok: false, status: 'missing-expiry' });
  });

  it('rejects scoped v1 token envelopes with excessive cache lifetimes', () => {
    const envelope = __test__workerAuthTokenCache.buildTokenCacheEnvelope({
      token: 'token-1',
      exp: 1000 + 25 * 60 * 60,
      workerUrl: 'https://worker.example',
      sessionSlug: 'edge',
      address: TEST_ADDRESS,
      issuedAt: 1000,
    });

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(envelope, {
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        address: TEST_ADDRESS,
        nowSeconds: 1200,
      }),
    ).toEqual({ ok: false, status: 'ttl-too-long' });

    expect(
      __test__workerAuthTokenCache.normalizeTokenCacheEntry(envelope, {
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        address: TEST_ADDRESS,
        nowSeconds: 1200,
        maxTtlSeconds: 26 * 60 * 60,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        token: 'token-1',
        legacy: false,
      }),
    );
  });
});

describe('workerAuth canonical session resolution', () => {
  const originalFetch = global.fetch;
  const authContext = {
    account: TEST_ADDRESS,
    providerLike: 'wagmi',
    chainId: 84532,
  };

  beforeEach(() => {
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
    mockProviderRequest.mockImplementation(defaultProviderRequest);
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('passes canonical general-session context into cors proxy lookup when sessionConfig supplies the alias', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 }));

    const token = await getWorkerSessionToken({
      sessionConfig: { slug: 'general', corsWorkerUrl: 'https://worker.example' },
      context: authContext,
    });

    expect(token).toBe('token-1');
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith({
      sessionSlug: '',
      sessionConfig: { slug: 'general', corsWorkerUrl: 'https://worker.example' },
      context: authContext,
      allowDemoFallback: false,
    });

    const nonceBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(nonceBody.sessionSlug).toBe('');
  });

  it('logs into an unregistered worker-canonical session using the freshly verified route config', async () => {
    const workerOrigin = 'https://unregistered-worker.example.com';
    const sessionId = '0x1234567890abcdef1234567890abcdef';
    const workerConfig = {
      slug: 'unregistered-worker',
      sessionId,
      corsWorkerUrl: workerOrigin,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    upsertWorkerCanonicalSessionBootstrap({
      slug: workerConfig.slug,
      sessionIdHex: sessionId,
      workerOrigin,
      config: workerConfig,
    });
    expect(
      markWorkerCanonicalSessionBootstrapVerified({
        slug: workerConfig.slug,
        sessionIdHex: sessionId,
        workerOrigin,
      }),
    ).toBe(true);
    window.history.replaceState({}, '', `/session/unregistered-worker?worker=${encodeURIComponent(workerOrigin)}`);
    getCorsProxyUrlOrThrow.mockResolvedValueOnce(workerOrigin);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'worker-nonce' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'worker-token', exp: Math.floor(Date.now() / 1000) + 3600 }));

    await expect(getWorkerSessionToken({ sessionSlug: 'unregistered-worker', context: authContext })).resolves.toBe(
      'worker-token',
    );

    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith({
      sessionSlug: 'unregistered-worker',
      sessionConfig: workerConfig,
      context: authContext,
      allowDemoFallback: false,
    });
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      `${workerOrigin}/auth/nonce`,
      `${workerOrigin}/auth/login`,
    ]);
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual(
      expect.objectContaining({ sessionSlug: 'unregistered-worker' }),
    );
  });

  it('does not inject demo general config into worker lookup for implicit default session in on-chain mode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 }));

    const token = await getWorkerSessionToken({
      context: authContext,
    });

    expect(token).toBe('token-1');
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith({
      sessionSlug: '',
      sessionConfig: null,
      context: authContext,
      allowDemoFallback: false,
    });

    const nonceBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(nonceBody.sessionSlug).toBe('');
  });

  it('preserves explicit session slugs from sessionConfig and strips auth suffixes from explicit worker urls', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 }));

    const headers = await getWorkerAuthHeaders({
      sessionConfig: { slug: 'debate' },
      context: authContext,
      workerUrl: 'https://worker.example/custom-prefix/auth/login',
    });

    expect(headers).toEqual({
      Authorization: 'Bearer token-1',
      'X-Group-Slug': 'debate',
    });
    expect(String(global.fetch.mock.calls[0][0])).toBe('https://worker.example/custom-prefix/auth/nonce');
    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/custom-prefix/auth/login');

    const nonceBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(nonceBody.sessionSlug).toBe('debate');
  });

  it('does not silently inject demo session config for non-general auth slugs in on-chain mode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 }));

    const token = await getWorkerSessionToken({
      sessionSlug: 'edge',
      context: authContext,
    });

    expect(token).toBe('token-1');
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith({
      sessionSlug: 'edge',
      sessionConfig: null,
      context: authContext,
      allowDemoFallback: false,
    });
  });

  it('reuses scoped token envelopes in page memory without persisting the bearer', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp }));

    await expect(
      getWorkerSessionToken({
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example/auth/login',
        context: authContext,
      }),
    ).resolves.toBe('token-1');

    expect(new Headers(global.fetch.mock.calls[0][1].headers).get('X-Anonymous-Client-Id')).toMatch(
      /^[a-z0-9_-]{8,128}$/,
    );
    expect(new Headers(global.fetch.mock.calls[1][1].headers).get('X-Anonymous-Client-Id')).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const cacheKey = __test__workerAuthTokenCache.buildTokenCacheKey({
      workerUrl: 'https://worker.example',
      slug: 'edge',
      address: TEST_ADDRESS,
    });
    expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(
      expect.objectContaining({
        v: 1,
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        address: TEST_ADDRESS,
        expiresAt: exp,
        token: 'token-1',
      }),
    );
  });

  it('keeps explicit demo fallback opt-in fail-closed when no shipped demo session exists', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 }));

    const token = await getWorkerSessionToken({
      sessionSlug: 'edge',
      context: authContext,
      allowDemoFallback: true,
    });

    expect(token).toBe('token-1');
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'edge',
        context: authContext,
        allowDemoFallback: true,
      }),
    );
    expect(getCorsProxyUrlOrThrow.mock.calls[0][0].sessionConfig).toBeNull();
  });

  it('aborts in-flight auth and rejects late login completion after logout clears tokens', async () => {
    let loginSignal = null;
    let resolveLogin = null;
    global.fetch = jest.fn((url, options = {}) => {
      if (String(url).endsWith('/auth/nonce')) {
        return Promise.resolve(jsonResp(200, { nonce: 'nonce-1' }));
      }
      if (String(url).endsWith('/auth/login')) {
        loginSignal = options.signal;
        return new Promise((resolve) => {
          resolveLogin = resolve;
        });
      }
      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const tokenPromise = getWorkerSessionToken({
      workerUrl: 'https://worker.example',
      context: authContext,
    });

    await flushPromises();
    await flushPromises();

    expect(loginSignal).toBeTruthy();
    clearAllWorkerSessionTokens();
    expect(loginSignal.aborted).toBe(true);

    resolveLogin(
      jsonResp(200, {
        token: 'late-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );

    await expect(tokenPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(Object.keys(localStorage).filter((key) => key.startsWith('ce:workerToken:v1:'))).toHaveLength(0);
    expect(localStorage.getItem('ce:anonClientId:v1')).toMatch(/^[a-z0-9_-]{8,128}$/);
  });

  it('new request after logout/account-switch with stale context cannot reach /auth/login', async () => {
    const mockStore = require('../../store.js').default;
    const staleAuthContext = {
      ...authContext,
    };
    global.fetch = jest.fn();

    mockStore.getState.mockReturnValue({
      profile: {
        account: NEXT_TEST_ADDRESS,
        provider: 'wagmi',
        network: { id: 84532 },
      },
      sessionState: {},
    });
    clearAllWorkerSessionTokens();

    await expect(
      getWorkerSessionToken({
        workerUrl: 'https://worker.example',
        context: staleAuthContext,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('workerAuth bootstrap admin signing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
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
    mockProviderRequest.mockImplementation(defaultProviderRequest);
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('marks admin action nonce requests for trusted-origin recovery', async () => {
    const { ethers } = require('ethers');
    const { cryptoUtils } = require('../crypto/cryptography.js');
    cryptoUtils._getProvider.mockReturnValue({ request: mockProviderRequest });
    ethers.utils.verifyTypedData.mockReturnValueOnce(NEXT_TEST_ADDRESS);
    global.fetch = jest.fn(async () => jsonResp(200, { nonce: 'nonce-admin-1' }));

    await expect(
      buildSignedAdminActionAuth({
        action: 'set-config',
        slug: 'edge',
        body: {
          sessionSlug: 'edge',
          config: { adminAddress: TEST_ADDRESS },
        },
        workerUrl: 'https://worker.example/auth/login',
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      }),
    ).rejects.toThrow('Typed data signature does not match signer address');

    expect(String(global.fetch.mock.calls[0][0])).toBe('https://worker.example/auth/nonce');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      address: TEST_ADDRESS,
      sessionSlug: 'edge',
      adminAction: true,
    });
    expect(new Headers(global.fetch.mock.calls[0][1].headers).get('X-Anonymous-Client-Id')).toMatch(
      /^[a-z0-9_-]{8,128}$/,
    );
    expect(mockProviderRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_signTypedData_v4',
        params: [TEST_ADDRESS, expect.any(String)],
      }),
    );
  });

  it('signs legacy bootstrap auth against the worker nonce route', async () => {
    global.fetch = jest.fn(async () => jsonResp(200, { nonce: 'nonce-bootstrap-1' }));

    const auth = await buildSignedBootstrapAdminAuth({
      slug: 'edge',
      workerUrl: 'https://worker.example/auth/login',
      context: {
        account: TEST_ADDRESS,
        providerLike: 'wagmi',
        chainId: 84532,
      },
      statement: 'Admin request: bootstrap arweave upload',
    });

    expect(String(global.fetch.mock.calls[0][0])).toBe('https://worker.example/auth/nonce');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      address: TEST_ADDRESS,
      sessionSlug: 'edge',
      adminAction: true,
    });
    expect(new Headers(global.fetch.mock.calls[0][1].headers).get('X-Anonymous-Client-Id')).toMatch(
      /^[a-z0-9_-]{8,128}$/,
    );
    expect(auth).toEqual({
      address: TEST_ADDRESS,
      message: expect.stringContaining('Admin request: bootstrap arweave upload'),
      signature: '0xsigned',
      sessionSlug: 'edge',
    });
  });

  it('normalizes bootstrap auth fetch reachability errors with an allowOrigins hint', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      buildSignedBootstrapAdminAuth({
        slug: 'edge',
        workerUrl: 'https://worker.example/auth/login',
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
        statement: 'Admin request: bootstrap arweave upload',
      }),
    ).rejects.toThrow(
      'Failed to reach worker auth endpoint (https://worker.example/auth/nonce). Check worker URL and allowOrigins includes http://localhost:3000.',
    );
  });

  it('fails cleanly without prompting wallet connect when no authorized account is available', async () => {
    const mockStore = require('../../store.js').default;
    mockStore.getState.mockReturnValue({
      profile: {
        account: '',
        provider: 'wagmi',
        network: { id: 84532 },
      },
      sessionState: {},
    });
    mockProviderRequest.mockImplementation(async ({ method }) => {
      if (method === 'eth_accounts') return [];
      if (method === 'eth_requestAccounts') return [TEST_ADDRESS];
      return [];
    });

    await expect(
      buildSignedBootstrapAdminAuth({
        slug: 'edge',
        workerUrl: 'https://worker.example/auth/login',
        context: {
          account: '',
          providerLike: 'wagmi',
          chainId: 84532,
        },
        statement: 'Admin request: bootstrap arweave upload',
      }),
    ).rejects.toThrow('Connect a wallet to sign admin requests.');

    expect(mockProviderRequest.mock.calls.map(([payload]) => payload?.method)).not.toContain('eth_requestAccounts');
    expect(global.fetch).toBe(originalFetch);
  });
});

describe('workerAuth fetchWorkerWithAuth', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockStore = require('../../store.js').default;
    const { cryptoUtils } = require('../crypto/cryptography.js');
    mockStore.getState.mockReturnValue({
      profile: {
        account: TEST_ADDRESS,
        provider: 'wagmi',
        network: { id: 84532 },
      },
      sessionState: {},
    });
    mockProviderRequest.mockClear();
    mockProviderRequest.mockImplementation(defaultProviderRequest);
    cryptoUtils._getProvider.mockImplementation(() => ({
      request: mockProviderRequest,
    }));
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends anonymous-first request with X-Group-Slug general for default session', async () => {
    global.fetch = jest.fn(async () => jsonResp(200, { ok: true }));

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, fetchOpts] = global.fetch.mock.calls[0];
    const headers = new Headers(fetchOpts.headers);
    expect(headers.get('X-Group-Slug')).toBe('general');
    expect(headers.get('X-Anonymous-Client-Id')).toMatch(/^[a-z0-9_-]{8,128}$/);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('retries anonymous request without X-Anonymous-Client-Id only after compatibility probe', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // anonymous request with rate id header
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // /health probe with rate id header
      .mockResolvedValueOnce(jsonResp(200, { ok: true })) // /health probe without rate id header
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // anonymous retry without rate id header

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);

    const firstHeaders = new Headers(global.fetch.mock.calls[0][1].headers);
    expect(firstHeaders.get('X-Anonymous-Client-Id')).toMatch(/^[a-z0-9_-]{8,128}$/);

    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/health');
    const probeHeadersWithRateId = new Headers(global.fetch.mock.calls[1][1].headers);
    expect(probeHeadersWithRateId.get('X-Anonymous-Client-Id')).toMatch(/^[a-z0-9_-]{8,128}$/);

    expect(String(global.fetch.mock.calls[2][0])).toBe('https://worker.example/health');
    const probeHeadersWithoutRateId = new Headers(global.fetch.mock.calls[2][1].headers);
    expect(probeHeadersWithoutRateId.get('X-Anonymous-Client-Id')).toBeNull();

    const retryHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(retryHeaders.get('X-Anonymous-Client-Id')).toBeNull();
    expect(retryHeaders.get('X-Group-Slug')).toBe('general');
  });

  it('does not replay anonymous request when with-rate probe returns non-2xx', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // anonymous request with rate id header
      .mockResolvedValueOnce(jsonResp(401, { error: 'unauthorized' })); // /health probe with rate id header (transport ok)

    await expect(
      fetchWorkerWithAuth(
        'https://worker.example/ai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ai' }),
        },
        {
          sessionSlug: '',
          preferAnonymous: true,
          context: {
            account: TEST_ADDRESS,
            providerLike: 'wagmi',
            chainId: 84532,
          },
        },
      ),
    ).rejects.toThrow('Failed to fetch');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/health');
  });

  it('retries anonymous request when compatibility probe without rate id returns 401', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // anonymous request with rate id header
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // /health probe with rate id header
      .mockResolvedValueOnce(jsonResp(401, { error: 'unauthorized' })) // /health probe without rate id header (transport ok)
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // anonymous retry without rate id header

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/health');
    expect(String(global.fetch.mock.calls[2][0])).toBe('https://worker.example/health');

    const retryHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(retryHeaders.get('X-Anonymous-Client-Id')).toBeNull();
    expect(retryHeaders.get('X-Group-Slug')).toBe('general');
  });

  it('derives auth endpoints from path-prefixed worker routes when workerUrl is omitted', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResp(403, { error: 'Anonymous access denied: route scope disabled in session config.' }),
      ) // anonymous
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/custom-prefix/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/custom-prefix/auth/nonce');
    expect(String(global.fetch.mock.calls[2][0])).toBe('https://worker.example/custom-prefix/auth/login');
    expect(String(global.fetch.mock.calls[3][0])).toBe('https://worker.example/custom-prefix/ai');
  });

  it('preserves an object-valued passkey provider through worker authentication', async () => {
    const { cryptoUtils } = require('../crypto/cryptography.js');
    const passkeyProvider = {
      isPasskeyEoa: true,
      request: mockProviderRequest,
    };
    const ethersProvider = { provider: passkeyProvider };
    cryptoUtils._getProvider.mockImplementation((providerLike) => {
      if (providerLike === ethersProvider) return passkeyProvider;
      if (providerLike === passkeyProvider) return passkeyProvider;
      return {
        request: async () => {
          throw new Error('No EIP-1193 provider available.');
        },
      };
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' }))
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 }))
      .mockResolvedValueOnce(jsonResp(200, { ok: true }));

    const response = await fetchWorkerWithAuth(
      'https://worker.example/arweave/upload',
      { method: 'POST', body: JSON.stringify({ data: '{}' }) },
      {
        sessionSlug: 'demo-1',
        context: {
          account: TEST_ADDRESS,
          providerLike: ethersProvider,
          chainId: 11155420,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(cryptoUtils._getProvider).toHaveBeenCalledWith(ethersProvider);
    expect(mockProviderRequest.mock.calls.map(([payload]) => payload?.method)).toEqual(
      expect.arrayContaining(['eth_accounts']),
    );
  });

  it('does not replay anonymous POST when compatibility probe is not confirmed', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // anonymous request with rate id header
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // /health probe with rate id header succeeds

    await expect(
      fetchWorkerWithAuth(
        'https://worker.example/ai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ai' }),
        },
        {
          sessionSlug: '',
          preferAnonymous: true,
          context: {
            account: TEST_ADDRESS,
            providerLike: 'wagmi',
            chainId: 84532,
          },
        },
      ),
    ).rejects.toThrow('Failed to fetch');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/health');
  });

  it('falls back to authenticated flow after anonymous preflight compatibility retry', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // anonymous with rate id header
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // /health probe with rate id header
      .mockResolvedValueOnce(jsonResp(200, { ok: true })) // /health probe without rate id header
      .mockResolvedValueOnce(
        jsonResp(403, { error: 'Anonymous access denied: route scope disabled in session config.' }),
      ) // anonymous retry without rate id header
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(7);
    expect(String(global.fetch.mock.calls[4][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[5][0])).toMatch(/\/auth\/login$/);

    const firstHeaders = new Headers(global.fetch.mock.calls[0][1].headers);
    expect(firstHeaders.get('X-Anonymous-Client-Id')).toMatch(/^[a-z0-9_-]{8,128}$/);

    expect(String(global.fetch.mock.calls[1][0])).toBe('https://worker.example/health');
    const retryHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(retryHeaders.get('X-Anonymous-Client-Id')).toBeNull();

    const authedHeaders = new Headers(global.fetch.mock.calls[6][1].headers);
    expect(authedHeaders.get('Authorization')).toBe('Bearer token-1');
  });

  it('falls back to authenticated flow after anonymous 403 and preserves auth retry', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResp(403, {
          error: 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.',
        }),
      ) // anonymous
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(401, { error: 'stale token' })) // first authed fetch
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-2' })) // retry auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-2', exp: Math.floor(Date.now() / 1000) + 3600 })) // retry auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // final authed fetch retry

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(7);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/login$/);
    expect(String(global.fetch.mock.calls[4][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[5][0])).toMatch(/\/auth\/login$/);

    const anonHeaders = new Headers(global.fetch.mock.calls[0][1].headers);
    expect(anonHeaders.get('X-Group-Slug')).toBe('general');
    expect(anonHeaders.get('Authorization')).toBeNull();

    const firstAuthedHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(firstAuthedHeaders.get('Authorization')).toBe('Bearer token-1');

    const retryAuthedHeaders = new Headers(global.fetch.mock.calls[6][1].headers);
    expect(retryAuthedHeaders.get('Authorization')).toBe('Bearer token-2');
    expect(mockProviderRequest.mock.calls.filter(([payload]) => payload?.method === 'eth_accounts')).toHaveLength(1);
  });

  it('does not retry worker login when authenticated storage read is denied by SBT gate', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: Cloudflare worker SBT gate failed.' })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/storage/read?id=cf_ref',
      { method: 'GET' },
      {
        sessionSlug: 'alpha',
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const authedHeaders = new Headers(global.fetch.mock.calls[2][1].headers);
    expect(authedHeaders.get('Authorization')).toBe('Bearer token-1');
  });

  it('clears the active token cache entry and aborts auth retry when the store account switches', async () => {
    const mockStore = require('../../store.js').default;
    const cacheKey = `ce:workerToken:v1:${normalizeWorkerUrl('https://worker.example')}::${TEST_ADDRESS}`;
    mockStore.getState.mockReturnValue({
      profile: {
        account: TEST_ADDRESS,
        provider: 'wagmi',
        network: { id: 84532 },
      },
      sessionState: {},
    });

    let fetchCallCount = 0;
    global.fetch = jest.fn(() => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) {
        return Promise.resolve(jsonResp(200, { nonce: 'nonce-1' })); // auth/nonce
      }
      if (fetchCallCount === 2) {
        return Promise.resolve(
          jsonResp(200, {
            token: 'token-1',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ); // auth/login
      }
      if (fetchCallCount === 3) {
        mockStore.getState.mockReturnValue({
          profile: {
            account: NEXT_TEST_ADDRESS,
            provider: 'wagmi',
            network: { id: 84532 },
          },
          sessionState: {},
        });
        return Promise.resolve(jsonResp(401, { error: 'stale token' })); // first authed fetch
      }
      throw new Error('Unexpected retry auth fetch after store account switch.');
    });

    await expect(
      fetchWorkerWithAuth(
        'https://worker.example/ai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ai' }),
        },
        {
          sessionSlug: '',
          context: {
            account: TEST_ADDRESS,
            providerLike: 'wagmi',
            chainId: 84532,
          },
        },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/login$/);

    const firstAuthedHeaders = new Headers(global.fetch.mock.calls[2][1].headers);
    expect(firstAuthedHeaders.get('Authorization')).toBe('Bearer token-1');
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('falls back to authenticated flow when anonymous deny wording changes', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResp(403, { error: 'Anonymous access denied: gated route requires authenticated worker token.' }),
      ) // anonymous
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/login$/);
  });

  it('falls back to authenticated flow when anonymous Cloudflare storage read is SBT-gated', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(401, { error: 'Missing requester address for worker SBT gate.' })) // anonymous storage read
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/storage/read?id=cf_ref',
      { method: 'GET' },
      {
        sessionSlug: 'alpha',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(new Headers(global.fetch.mock.calls[0][1].headers).get('Authorization')).toBeNull();
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/login$/);
    expect(new Headers(global.fetch.mock.calls[3][1].headers).get('Authorization')).toBe('Bearer token-1');
  });

  it('falls back to authenticated flow after anonymous 429 worker rate-limit denial', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(429, { error: 'Rate limit exceeded.' })) // anonymous
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/login$/);

    const firstAuthedHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(firstAuthedHeaders.get('Authorization')).toBe('Bearer token-1');
  });

  it('does not fall back to wallet auth when anonymous 429 happens with request apiKey', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResp(429, { error: 'Rate limit exceeded.' }));

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai', apiKey: 'sk-bad' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(429);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to wallet auth when anonymous path returns provider 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResp(401, { error: 'Incorrect API key provided: sk-bad' }));

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai', apiKey: 'sk-bad' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to wallet auth when provider 401 contains "invalid token"', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResp(401, { error: 'Invalid token provided: sk-bad' }));

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai', apiKey: 'sk-bad' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to wallet auth when anonymous path is scope-disabled', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResp(403, { error: 'Anonymous access denied: route scope disabled in session config.' }),
      ) // anonymous
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/login$/);

    const anonHeaders = new Headers(global.fetch.mock.calls[0][1].headers);
    expect(anonHeaders.get('Authorization')).toBeNull();

    const authedHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(authedHeaders.get('Authorization')).toBe('Bearer token-1');
  });

  it('does not fall back to wallet auth when anonymous path reports gate authority unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' }));

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to wallet auth when gate authority fallback is explicitly enabled', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' })) // anonymous
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-1', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed fetch

    const response = await fetchWorkerWithAuth(
      'https://worker.example/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai' }),
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        fallbackOnGateUnavailable: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/login$/);

    const firstAuthedHeaders = new Headers(global.fetch.mock.calls[3][1].headers);
    expect(firstAuthedHeaders.get('Authorization')).toBe('Bearer token-1');
  });

  it('attempts anonymous-first for multipart transcribe requests', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResp(200, { text: 'ok' })); // anonymous transcribe

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }), 'sample.wav');

    const response = await fetchWorkerWithAuth(
      'https://worker.example/transcribe',
      {
        method: 'POST',
        body: form,
      },
      {
        sessionSlug: '',
        preferAnonymous: true,
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toBe('https://worker.example/transcribe');

    const anonHeaders = new Headers(global.fetch.mock.calls[0][1].headers);
    expect(anonHeaders.get('X-Group-Slug')).toBe('general');
    expect(anonHeaders.get('Authorization')).toBeNull();
  });

  it('retries auth login when on-chain gate reads are temporarily unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-1' })) // auth/nonce attempt 1
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' })) // auth/login attempt 1
      .mockResolvedValueOnce(jsonResp(200, { nonce: 'nonce-2' })) // auth/nonce attempt 2
      .mockResolvedValueOnce(jsonResp(200, { token: 'token-2', exp: Math.floor(Date.now() / 1000) + 3600 })) // auth/login attempt 2
      .mockResolvedValueOnce(jsonResp(200, { ok: true })); // authed request

    const response = await fetchWorkerWithAuth(
      'https://worker.example/arweave/upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: '{"ok":true}', contentType: 'application/json' }),
      },
      {
        sessionSlug: 'test-8',
        context: {
          account: TEST_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[1][0])).toMatch(/\/auth\/login$/);
    expect(String(global.fetch.mock.calls[2][0])).toMatch(/\/auth\/nonce$/);
    expect(String(global.fetch.mock.calls[3][0])).toMatch(/\/auth\/login$/);

    const authedHeaders = new Headers(global.fetch.mock.calls[4][1].headers);
    expect(authedHeaders.get('Authorization')).toBe('Bearer token-2');
  });
});
