import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';
import {
  buildRpcFetchMock,
  createMemoryKv,
  makeJsonRequest,
  decodeTokenPayload,
  buildSiweMessage,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

describe('sessionCorsWorker auth routes', () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;

  const registryAddress = '0x0000000000000000000000000000000000000001';
  const rpcUrl = 'https://rpc.example';
  const sessionSlug = 'test-auth';
  const protectedSbt = '0x0000000000000000000000000000000000000101';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const loginOrigin = 'https://contextengine.sh';
  const loginDomain = 'contextengine.sh';

  const makeAuthJsonRequest = (path, body, origin = loginOrigin) => makeJsonRequest(path, body, {
    headers: { Origin: origin },
  });

  const buildLoginSiweMessage = (params = {}, origin = loginOrigin) => buildSiweMessage({
    domain: new URL(origin).host || loginDomain,
    uri: origin,
    ...params,
  });

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

  it('returns permissive CORS headers for auth preflight requests', async () => {
    const response = await sessionCorsWorker.fetch(
      new Request('https://worker.example/auth/login', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization',
        },
      }),
      {},
      {}
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('issues auth nonces and stores them under slug + address', async () => {
    const kv = createMemoryKv();
    const env = installSessionCoordinatorBinding({ GROUP_KV: kv });

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(typeof payload?.nonce).toBe('string');
    expect(payload.nonce.length).toBeGreaterThan(10);
    expect(kv.put).toHaveBeenCalledWith(
      `nonce:${sessionSlug}:${wallet.address.toLowerCase()}`,
      payload.nonce,
      { expirationTtl: 60 * 5 }
    );
  });

  it('rejects auth nonce requests with non-canonical session slugs', async () => {
    const kv = createMemoryKv();
    const env = installSessionCoordinatorBinding({ GROUP_KV: kv });

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug: ' TeSt-Auth!!! ',
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid session slug. Use lowercase letters, numbers, "_" or "-".');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('rejects auth nonce requests when sessionSlug aliases disagree', async () => {
    const kv = createMemoryKv();
    const env = installSessionCoordinatorBinding({ GROUP_KV: kv });

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug: 'alpha',
        groupSlug: 'beta',
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload?.error).toBe('sessionSlug aliases do not match.');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('rejects auth nonce requests with invalid json bodies', async () => {
    const kv = createMemoryKv();
    const env = installSessionCoordinatorBinding({ GROUP_KV: kv });

    const response = await sessionCorsWorker.fetch(
      new Request('https://worker.example/auth/nonce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://app.example',
        },
        body: '{"address":',
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Invalid JSON.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('rejects auth nonce requests when the existing session allowlist blocks the request origin', async () => {
    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        allowOrigins: ['https://allowed.example'],
      }),
    });
    const env = installSessionCoordinatorBinding({ GROUP_KV: kv });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }, {
        headers: { Origin: 'https://blocked.example' },
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('accepts auth nonce requests when allowOrigins is stored as a newline-delimited string', async () => {
    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        allowOrigins: 'https://allowed.example\nhttps://other.example',
      }),
    });
    const env = installSessionCoordinatorBinding({ GROUP_KV: kv });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }, {
        headers: { Origin: 'https://allowed.example' },
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(typeof payload?.nonce).toBe('string');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
  });

  it('issues login tokens when session config exists and the default gate is open', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();

    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const loginResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(typeof payload?.token).toBe('string');
    expect(typeof payload?.exp).toBe('number');

    const tokenPayload = decodeTokenPayload(payload.token);
    expect(tokenPayload.sub).toBe(wallet.address);
    expect(tokenPayload.slug).toBe(sessionSlug);
    expect(tokenPayload.scopes).toEqual({
      ai: true,
      arweave: true,
      transcribe: true,
      faucet: true,
      fetch: true,
      lit: true,
      groups: true,
    });
    expect(kv.delete).toHaveBeenCalledWith(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`);
  });

  it('issues passkey-wallet login tokens for unregistered worker-canonical sessions', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('registry fetch must not run')));
    const workerSlug = 'worker-canonical-auth';
    const workerSessionId = '0x1234567890abcdef1234567890abcdef';
    const kv = createMemoryKv({
      [`session:${workerSlug}:config`]: JSON.stringify({
        slug: workerSlug,
        sessionId: workerSessionId,
        adminAddress: wallet.address,
        allowOrigins: [loginOrigin],
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          authorization: { mechanisms: ['worker_roles'] },
        },
        workerAuthority: {
          version: 1,
          participantScopes: ['ai', 'transcribe', 'storage', 'groups'],
          anonymousScopes: ['ai', 'transcribe'],
        },
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug: workerSlug,
        sessionId: workerSessionId,
      }),
      env,
      {},
    );
    const noncePayload = await nonceResponse.json();
    expect(nonceResponse.status).toBe(200);
    expect(noncePayload).toMatchObject({
      sessionSlug: workerSlug,
      sessionId: workerSessionId,
    });
    const { nonce } = noncePayload;
    const message = buildLoginSiweMessage({ address: wallet.address, nonce });
    const signature = await wallet.signMessage(message);
    const loginResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug: workerSlug,
        sessionId: workerSessionId,
        message,
        signature,
      }),
      env,
      {},
    );
    const payload = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      sessionSlug: workerSlug,
      sessionId: workerSessionId,
    });
    expect(decodeTokenPayload(payload.token)).toMatchObject({
      slug: workerSlug,
      sessionId: workerSessionId,
      scopes: {
        admin: true,
        ai: true,
        transcribe: true,
        storage: true,
        groups: true,
      },
    });
  });

  it('issues login tokens with exact mixed scopes from resource gates', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [protectedSbt], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [], chainId: 84532, mode: 0 },
        lit: { sbtAddresses: [protectedSbt], chainId: 84532, mode: 0 },
      },
      balancesByToken: {
        [protectedSbt.toLowerCase()]: 0,
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();

    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const loginResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    const tokenPayload = decodeTokenPayload(payload.token);
    expect(tokenPayload.scopes).toEqual({
      ai: false,
      arweave: true,
      transcribe: false,
      faucet: true,
      fetch: true,
      lit: false,
      groups: true,
    });
    expect(kv.delete).toHaveBeenCalledWith(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`);
  });

  it('issues passkey-wallet login tokens for unregistered worker-canonical sessions', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('registry fetch must not run')));
    const workerSlug = 'worker-canonical-auth';
    const kv = createMemoryKv({
      [`session:${workerSlug}:config`]: JSON.stringify({
        slug: workerSlug,
        adminAddress: wallet.address,
        allowOrigins: [loginOrigin],
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          authorization: { mechanisms: ['worker_roles'] },
        },
        workerAuthority: {
          version: 1,
          participantScopes: ['ai', 'transcribe', 'storage', 'groups'],
          anonymousScopes: ['ai', 'transcribe'],
        },
      }),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug: workerSlug,
      }),
      env,
      {},
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({ address: wallet.address, nonce });
    const signature = await wallet.signMessage(message);
    const loginResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug: workerSlug,
        message,
        signature,
      }),
      env,
      {},
    );
    const payload = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(decodeTokenPayload(payload.token)).toMatchObject({
      slug: workerSlug,
      scopes: {
        admin: true,
        ai: true,
        transcribe: true,
        storage: true,
        groups: true,
      },
    });
  });

  it('issues login tokens with exact mixed scopes from resource gates', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [protectedSbt], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [], chainId: 84532, mode: 0 },
        lit: { sbtAddresses: [protectedSbt], chainId: 84532, mode: 0 },
      },
      balancesByToken: {
        [protectedSbt.toLowerCase()]: 0,
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();

    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const loginResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    const tokenPayload = decodeTokenPayload(payload.token);
    expect(tokenPayload.scopes).toEqual({
      ai: false,
      arweave: true,
      transcribe: false,
      faucet: true,
      fetch: true,
      lit: false,
    });
    expect(kv.delete).toHaveBeenCalledWith(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`);
  });

  it('rejects login when the nonce is reused after a successful login', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const firstLogin = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    expect(firstLogin.status).toBe(200);

    const secondLogin = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const secondPayload = await secondLogin.json();

    expect(secondLogin.status).toBe(400);
    expect(secondPayload?.error).toBe('Nonce already used.');
  });

  it('does not treat eventually consistent KV nonce markers as the consume authority', async () => {
    const nonce = 'reused-auth-nonce';
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
      [`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`]: nonce,
      [`usedNonce:${sessionSlug}:${nonce}`]: '1',
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Nonce mismatch or expired.');
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it('rejects login when the siwe domain does not match the uri host and preserves the nonce', async () => {
    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    }).replace(`URI: ${loginOrigin}`, 'URI: https://evil.example');
    const signature = await wallet.signMessage(message);

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('SIWE domain does not match URI host.');
    expect(kv.delete).not.toHaveBeenCalled();
    expect(kv._dump().get(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`)).toBe(nonce);
  });

  it('rejects login when the SIWE message address does not match the request address and preserves the nonce', async () => {
    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });
    const otherAddress = '0x00000000000000000000000000000000000000bb';

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({
      address: otherAddress,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('SIWE address mismatch.');
    expect(kv.delete).not.toHaveBeenCalled();
    expect(kv._dump().get(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`)).toBe(nonce);
  });

  it('rejects login when the siwe message is expired and preserves the nonce', async () => {
    const kv = createMemoryKv();
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
      expirationTime: '2025-03-06T00:00:00.000Z',
    });
    const signature = await wallet.signMessage(message);

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('SIWE message expired.');
    expect(kv.delete).not.toHaveBeenCalled();
    expect(kv._dump().get(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`)).toBe(nonce);
  });

  it('rejects login when session config is missing without consuming the nonce', async () => {
    const kv = createMemoryKv();
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const loginResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await loginResponse.json();

    expect(loginResponse.status).toBe(404);
    expect(payload?.error).toBe('Session config not found.');
    expect(kv.delete).not.toHaveBeenCalledWith(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`);
    expect(kv._dump().get(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`)).toBe(nonce);
  });

  it('returns a stable 403 error when the default on-chain gate denies login access', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [protectedSbt], chainId: 84532, mode: 0 },
      },
      balancesByToken: {
        [protectedSbt.toLowerCase()]: 0,
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    });
    const signature = await wallet.signMessage(message);

    const response = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Access denied: default gate failed.');
    expect(payload?.token).toBeUndefined();
    expect(kv.delete).toHaveBeenCalledWith(`nonce:${sessionSlug}:${wallet.address.toLowerCase()}`);
  });

  it('rejects login before consuming the nonce when the existing session allowlist blocks the request origin', async () => {
    const kv = createMemoryKv({
      [`session:${sessionSlug}:config`]: JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
        allowOrigins: ['https://allowed.example'],
      }),
    });
    const env = installSessionCoordinatorBinding({
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    });

    const nonceResponse = await sessionCorsWorker.fetch(
      makeAuthJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
      }, 'https://allowed.example'),
      env,
      {}
    );
    const { nonce } = await nonceResponse.json();
    const nonceKey = `nonce:${sessionSlug}:${wallet.address.toLowerCase()}`;
    const message = buildLoginSiweMessage({
      address: wallet.address,
      nonce,
    }, 'https://allowed.example');
    const signature = await wallet.signMessage(message);

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/auth/login', {
        address: wallet.address,
        sessionSlug,
        message,
        signature,
      }, {
        headers: { Origin: 'https://blocked.example' },
      }),
      env,
      {}
    );

    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(kv.delete).not.toHaveBeenCalledWith(nonceKey);
    expect(kv._dump().get(nonceKey)).toBe(nonce);
  });
});
