import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import {
  createMemoryKv,
  issueWorkerLoginToken,
  installRpcAwareUpstreamFetchMock,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const RPC_URL = 'https://rpc.example';
const SESSION_CONFIG_KEY = (slug) => `session:${slug}:config`;
const SESSION_SECRETS_KEY = (slug) => `session:${slug}:secrets`;
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const registryIface = new ethers.utils.Interface([
  'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
  'function sessionExists(string) view returns (bool)',
]);
const faucetSbtIface = new ethers.utils.Interface([
  'function hasPasswordMint() view returns (bool)',
  'function isPasswordValid(bytes32 hashedPassword) view returns (bool)',
  'function groupPasswordHash() view returns (bytes32)',
]);

const buildSessionConfig = (overrides = {}) => ({
  registryAddress: REGISTRY_ADDRESS,
  registryChainId: 84532,
  networkChainId: 84532,
  rpcUrl: RPC_URL,
  ...overrides,
});

const makeActionRequest = ({ token, sessionSlug, body, origin = '' }) => new Request('https://worker.example/', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(sessionSlug ? { 'X-Session-Slug': sessionSlug } : {}),
    ...(origin ? { Origin: origin } : {}),
  },
  body: JSON.stringify(body),
});

const createWorkerEnv = ({ sessionSlug, config, secrets, tokenSecret = 'test-secret' }) => {
  const seed = {
    [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(config),
  };
  if (secrets !== undefined) {
    seed[SESSION_SECRETS_KEY(sessionSlug)] = JSON.stringify(secrets);
  }
  return installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv(seed),
    TOKEN_HMAC_SECRET: tokenSecret,
  });
};

const createAuthOnlyWorkerEnv = (sourceEnv, tokenSecret = 'test-secret') => {
  const authTokenRecords = Object.fromEntries(
    [...sourceEnv.GROUP_KV._dump()]
      .filter(([key]) => String(key || '').startsWith('authToken:'))
  );
  return installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv(authTokenRecords),
    TOKEN_HMAC_SECRET: tokenSecret,
  });
};

const buildHtmlFetchResponse = (html) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  text: async () => html,
});

const buildImageFetchResponse = (contentType = 'image/png') => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': contentType }),
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([137, 80, 78, 71]));
      controller.close();
    },
  }),
});

const buildJsonRpcTextResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
});

const buildFaucetRpcFetchMock = ({
  rpcUrl,
  registryAddress = REGISTRY_ADDRESS,
  chainId = 84532,
  txHash = '0xabc123',
  sessionExists = true,
  onChainGatesByResource = {},
  sbtValidationByToken = {},
} = {}) => jest.fn(async (url, options = {}) => {
  if (url !== rpcUrl) throw new Error(`Unexpected RPC URL: ${url}`);
  const body = JSON.parse(options.body || '{}');
  switch (body.method) {
    case 'eth_chainId':
      return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: `0x${chainId.toString(16)}` });
    case 'eth_call': {
      const call = body.params?.[0] || {};
      const to = String(call.to || '').toLowerCase();
      const data = String(call.data || '');
      if (to === registryAddress.toLowerCase()) {
        const selector = data.slice(0, 10).toLowerCase();
        if (selector === registryIface.getSighash('sessionExists').toLowerCase()) {
          const result = registryIface.encodeFunctionResult('sessionExists', [!!sessionExists]);
          return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
        }
        if (selector === registryIface.getSighash('getResourceGate').toLowerCase()) {
          const [, resourceKey] = registryIface.decodeFunctionData('getResourceGate', data);
          const gate = onChainGatesByResource[String(resourceKey)] || {};
          const result = registryIface.encodeFunctionResult('getResourceGate', [
            Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : [],
            Number(gate.chainId || chainId),
            Number(gate.mode || 0),
            Number(gate.perMemberLimit || 0),
          ]);
          return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
        }
      }

      const tokenConfig = sbtValidationByToken[to] || {};
      const selector = data.slice(0, 10).toLowerCase();
      if (selector === faucetSbtIface.getSighash('hasPasswordMint').toLowerCase()) {
        const result = faucetSbtIface.encodeFunctionResult('hasPasswordMint', [!!tokenConfig.hasPasswordMint]);
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
      }
      if (selector === faucetSbtIface.getSighash('groupPasswordHash').toLowerCase()) {
        const result = faucetSbtIface.encodeFunctionResult('groupPasswordHash', [
          tokenConfig.groupPasswordHash || ZERO_BYTES32,
        ]);
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
      }
      if (selector === faucetSbtIface.getSighash('isPasswordValid').toLowerCase()) {
        const [hashedPassword] = faucetSbtIface.decodeFunctionData('isPasswordValid', data);
        const passwordMap = tokenConfig.isPasswordValidByHash || {};
        const result = faucetSbtIface.encodeFunctionResult('isPasswordValid', [
          !!passwordMap[String(hashedPassword).toLowerCase()],
        ]);
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
      }
      throw new Error(`Unexpected eth_call selector: ${selector}`);
    }
    case 'eth_getBalance':
      return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x0' });
    case 'eth_getTransactionCount':
      return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x1' });
    case 'eth_gasPrice':
      return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x3b9aca00' });
    case 'eth_sendRawTransaction':
      return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: txHash });
    default:
      throw new Error(`Unexpected RPC method: ${body.method}`);
  }
});

describe('sessionCorsWorker authenticated fetch/faucet actions', () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const faucetWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');

  beforeAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('rejects fetch_url when the token lacks fetch scope', async () => {
    const sessionSlug = 'fetch-url-no-scope';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ scopes: { fetch: false } }),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url', url: 'https://example.com' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing fetch scope.');
  });

  it('rejects fetch_image when the token lacks fetch scope', async () => {
    const sessionSlug = 'fetch-image-no-scope';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ scopes: { fetch: false } }),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_image', url: 'https://example.com/image.png' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing fetch scope.');
  });

  it('rejects third-party request_test_eth transfers when the token lacks faucet scope', async () => {
    const sessionSlug = 'faucet-no-scope';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ scopes: { faucet: false } }),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'request_test_eth', address: faucetWallet.address },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Token missing faucet scope.');
  });

  it('rate limits fetch_url before a second upstream fetch', async () => {
    const sessionSlug = 'fetch-url-rate-limit';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ limits: { perWalletPerDay: 1 } }),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const upstreamFetch = installRpcAwareUpstreamFetchMock({
      rpcUrl: RPC_URL,
      implementation: async () => (
        buildHtmlFetchResponse('<html><body><main>' + 'a'.repeat(80) + '</main></body></html>')
      ),
    });

    const firstResponse = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url', url: 'https://example.com' },
      }),
      env,
      {}
    );
    const secondResponse = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url', url: 'https://example.com' },
      }),
      env,
      {}
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondPayload?.error).toBe('Rate limit exceeded.');
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects fetch_url when the url payload is missing', async () => {
    const sessionSlug = 'fetch-url-missing-url';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing url');
  });

  it('rejects fetch_url when the url is invalid', async () => {
    const sessionSlug = 'fetch-url-invalid-url';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url', url: 'not-a-url' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid URL');
  });

  it('rejects fetch_url when the target is an IPv4-mapped IPv6 loopback address', async () => {
    const sessionSlug = 'fetch-url-ipv4-mapped-loopback';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const upstreamFetch = installRpcAwareUpstreamFetchMock({ rpcUrl: RPC_URL });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url', url: 'http://[::ffff:127.0.0.1]/private' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('URL target is not allowed');
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects authenticated action requests when the origin is not allowed', async () => {
    const sessionSlug = 'fetch-origin-blocked';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        origin: 'https://blocked.example',
        body: { action: 'fetch_url', url: 'https://example.com' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects authenticated action requests when session config is missing after auth succeeds', async () => {
    const sessionSlug = 'fetch-missing-config';
    const issuingEnv = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env: issuingEnv,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });
    const requestEnv = createAuthOnlyWorkerEnv(issuingEnv);

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_url', url: 'https://example.com' },
      }),
      requestEnv,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload?.error).toBe('Session config not found.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects authenticated action requests with invalid json after CORS passes', async () => {
    const sessionSlug = 'fetch-invalid-json';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({ allowOrigins: ['https://allowed.example'] }),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      new Request('https://worker.example/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Session-Slug': sessionSlug,
          Origin: 'https://allowed.example',
        },
        body: '{bad-json',
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid JSON.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('rejects fetch_image when the upstream response is not an image', async () => {
    const sessionSlug = 'fetch-image-non-image';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const upstreamFetch = installRpcAwareUpstreamFetchMock({
      rpcUrl: RPC_URL,
      implementation: async () => new Response(null, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'fetch_image', url: 'https://example.com/file.txt' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('URL must return an image');
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });

  it('rate limits request_test_eth before a second faucet transfer attempt', async () => {
    const sessionSlug = 'faucet-rate-limit';
    const sbtAddress = '0x0000000000000000000000000000000000000100';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig({
        limits: { perWalletPerDay: 1 },
        faucet: { rpcUrl: RPC_URL },
      }),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const fetchMock = buildFaucetRpcFetchMock({
      rpcUrl: RPC_URL,
      onChainGatesByResource: {
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: false,
          groupPasswordHash: ZERO_BYTES32,
        },
      },
    });
    global.fetch = fetchMock;

    const payload = {
      action: 'request_test_eth',
      address: wallet.address,
      amountEth: '0.0000001',
      sbtAddress,
    };
    const firstResponse = await sessionCorsWorker.fetch(
      makeActionRequest({ token, sessionSlug, body: payload }),
      env,
      {}
    );
    const secondResponse = await sessionCorsWorker.fetch(
      makeActionRequest({ token, sessionSlug, body: payload }),
      env,
      {}
    );
    const secondPayload = await secondResponse.json();
    const rpcMethods = fetchMock.mock.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondPayload?.error).toBe('Rate limit exceeded.');
    // Both route preflights revalidate current default + faucet scope. Registry
    // membership, SBT proof, and faucet transfer retain their own attestations.
    expect(rpcMethods.filter((method) => method === 'eth_chainId')).toHaveLength(5);
    expect(rpcMethods.filter((method) => method === 'eth_sendRawTransaction')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === RPC_URL)).toHaveLength(21);
  });

  it('rejects request_test_eth when session secrets are missing', async () => {
    const sessionSlug = 'faucet-missing-secrets';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'request_test_eth', address: wallet.address },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload?.error).toBe('Session secrets not configured.');
  });

  it('rejects request_test_eth when the address payload is missing', async () => {
    const sessionSlug = 'faucet-missing-address';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'request_test_eth' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing address');
  });

  it('rejects request_test_eth when the address payload is invalid', async () => {
    const sessionSlug = 'faucet-invalid-address';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'request_test_eth', address: 'not-an-address' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid address');
  });

  it('allows request_test_eth without sbtAddress when the authenticated token already has faucet scope', async () => {
    const sessionSlug = 'faucet-authenticated-token-fallback';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const fetchMock = buildFaucetRpcFetchMock({
      rpcUrl: RPC_URL,
      txHash: '0xgeneric123',
    });
    global.fetch = fetchMock;

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: { action: 'request_test_eth', address: wallet.address, amountEth: '0.0000001' },
      }),
      env,
      {}
    );
    const payload = await response.json();
    const rpcMethods = fetchMock.mock.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    expect(response.status).toBe(200);
    expect(payload?.txHash).toBe('0xgeneric123');
    expect(rpcMethods).toContain('eth_sendRawTransaction');
  });

  it('rejects request_test_eth when a consumed-password claim code is invalid', async () => {
    const sessionSlug = 'faucet-invalid-password-proof';
    const sbtAddress = '0x0000000000000000000000000000000000000101';
    const invalidHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('bad-claim-code'));
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const fetchMock = buildFaucetRpcFetchMock({
      rpcUrl: RPC_URL,
      onChainGatesByResource: {
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: true,
          groupPasswordHash: ZERO_BYTES32,
          isPasswordValidByHash: {},
        },
      },
    });
    global.fetch = fetchMock;

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
          sbtAddress,
          hashedPassword: invalidHash,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();
    const rpcMethods = fetchMock.mock.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Invalid password.');
    expect(rpcMethods).not.toContain('eth_sendRawTransaction');
  });

  it('rejects request_test_eth when the provided groupPasswordHash omits the required group signature', async () => {
    const sessionSlug = 'faucet-group-password-hash-missing-signature';
    const sbtAddress = '0x0000000000000000000000000000000000000102';
    const groupPasswordHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('group-password-hash'));
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const fetchMock = buildFaucetRpcFetchMock({
      rpcUrl: RPC_URL,
      onChainGatesByResource: {
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: false,
          groupPasswordHash,
        },
      },
      txHash: '0xfeed123',
    });
    global.fetch = fetchMock;

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
          sbtAddress,
          groupPasswordHash,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();
    const rpcMethods = fetchMock.mock.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing group signature.');
    expect(rpcMethods).not.toContain('eth_sendRawTransaction');
  });

  it('rejects request_test_eth for open-mint SBTs that are not part of a session gate', async () => {
    const sessionSlug = 'faucet-open-mint-not-gated';
    const sbtAddress = '0x0000000000000000000000000000000000000103';
    const env = createWorkerEnv({
      sessionSlug,
      config: buildSessionConfig(),
      secrets: { faucetPrivateKey: faucetWallet.privateKey },
    });
    const token = await issueWorkerLoginToken({
      worker: sessionCorsWorker,
      env,
      wallet,
      sessionSlug,
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
    });

    const fetchMock = buildFaucetRpcFetchMock({
      rpcUrl: RPC_URL,
      onChainGatesByResource: {
        txGas: { sbtAddresses: [], chainId: 84532, mode: 0 },
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: false,
          groupPasswordHash: ZERO_BYTES32,
        },
      },
    });
    global.fetch = fetchMock;

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
          sbtAddress,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();
    const rpcMethods = fetchMock.mock.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Requested SBT is not part of a session gate.');
    expect(rpcMethods).not.toContain('eth_sendRawTransaction');
  });
});
