import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import sessionCorsWorker, {
  SessionWriteCoordinator,
} from '../../workers/sessionCorsWorker/worker.js';
import { getSessionSecrets } from '../../workers/sessionCorsWorker/sessionConfigSecretsStore.js';
import {
  buildRpcFetchMock,
  createMemoryKv,
  makeJsonRequest,
  createSignedSiweBody,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const RPC_URL = 'https://rpc.example';
const SESSION_CONFIG_KEY = (slug) => `session:${slug}:config`;
const SESSION_SECRETS_KEY = (slug) => `session:${slug}:secrets`;
const HATS_ABI = ['function isWearerOfHat(address wearer, uint256 hatId) view returns (bool)'];
const hatsIface = new ethers.utils.Interface(HATS_ABI);
const SESSION_SECRETS_KEK = 'root-admin-session-secrets-test-kek';

const readStoredJson = (kv, key) => {
  const raw = kv._dump().get(key);
  return raw ? JSON.parse(raw) : null;
};

const createCoordinatorEnv = (kv, overrides = {}) => {
  const env = {
    GROUP_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: SESSION_SECRETS_KEK,
    ...overrides,
  };
  const instances = new Map();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  env.CE_SESSION_COORDINATOR = {
    idFromName: (name) => `coordinator:${name}`,
    get: (id) => {
      if (!instances.has(id)) {
        const values = new Map();
        let tail = Promise.resolve();
        const storage = {
          get: async (key) => values.get(key),
          put: async (key, value) => values.set(key, clone(value)),
          transaction: (callback) => {
            const run = tail.then(() => callback({
              get: async (key) => values.get(key),
              put: async (key, value) => values.set(key, clone(value)),
              delete: async (key) => values.delete(key),
            }));
            tail = run.catch(() => undefined);
            return run;
          },
        };
        const coordinator = new SessionWriteCoordinator({ storage }, env);
        instances.set(id, {
          fetch: (input, init) => coordinator.fetch(
            input instanceof Request ? input : new Request(input, init),
          ),
        });
      }
      return instances.get(id);
    },
  };
  return env;
};

describe('sessionCorsWorker admin routes', () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  const sessionSlug = 'test-admin';
  const adminWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');
  const otherWallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');

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

  it('bootstraps worker config when deployment binds the signer as requested admin', async () => {
    const kv = createMemoryKv();
    const env = createCoordinatorEnv(kv, {
      BOOTSTRAP_ADMIN_ADDRESS: adminWallet.address,
    });
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        adminAddress: adminWallet.address,
        config: {
          adminAddress: adminWallet.address,
          allowOrigins: ['https://app.example'],
          scopes: { ai: true },
        },
      },
    });
    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      authzEpoch: 1,
      adminAddress: adminWallet.address,
      allowOrigins: ['https://app.example'],
      scopes: { ai: true },
      limits: {},
    });
  });

  it('fails closed when the session coordinator binding is absent', async () => {
    const kv = createMemoryKv();
    const env = {
      GROUP_KV: kv,
      BOOTSTRAP_ADMIN_ADDRESS: adminWallet.address,
    };
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        adminAddress: adminWallet.address,
        config: {
          adminAddress: adminWallet.address,
          sessionName: 'Persist directly',
        },
      },
    });
    delete env.CE_SESSION_COORDINATOR;

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {},
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload?.error).toMatch(/coordination is unavailable/i);
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toBeNull();
  });

  it('rejects set-config when the config payload is missing', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      adminAction: 'set-config',
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing config.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      adminAddress: adminWallet.address,
    });
  });

  it('rejects bootstrap set-config when the signer does not match the requested admin', async () => {
    const kv = createMemoryKv();
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: otherWallet,
      sessionSlug,
      body: {
        adminAddress: adminWallet.address,
        config: {
          adminAddress: adminWallet.address,
          allowOrigins: ['https://app.example'],
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Admin authorization failed.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toBeNull();
  });

  it('rejects bootstrap when the registry slug is not registered on-chain yet', async () => {
    const kv = createMemoryKv();
    const env = createCoordinatorEnv(kv, {
      REGISTRY_ADDRESS,
      RPC_URL,
    });
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        adminAddress: adminWallet.address,
        config: {
          adminAddress: adminWallet.address,
          allowOrigins: ['https://app.example'],
          networkChainId: 84532,
          scopes: { ai: true },
        },
      },
    });
    global.fetch = buildRpcFetchMock({
      rpcUrl: RPC_URL,
      registryAddress: REGISTRY_ADDRESS,
      sessionExists: false,
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: 'Admin authorization failed.' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toBeNull();
  });

  it('rejects set-config when the signer is not authorized for the session', async () => {
    const existingConfig = {
      adminAddress: adminWallet.address,
      sessionName: 'Existing Session',
      limits: { perWalletPerDay: 3 },
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: otherWallet,
      sessionSlug,
      body: {
        config: {
          sessionName: 'Unauthorized Update',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Admin authorization failed.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual(existingConfig);
  });

  it('does not trust request rpcUrl for hat-based admin authorization', async () => {
    const safeRpcUrl = 'https://rpc.safe.example';
    const attackerRpcUrl = 'https://rpc.attacker.example';
    const existingConfig = {
      hatsAddress: '0x00000000000000000000000000000000000000aa',
      adminHatId: '7',
      registryChainId: 84532,
      rpcUrl: safeRpcUrl,
      sessionName: 'Existing Session',
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: otherWallet,
      sessionSlug,
      body: {
        rpcUrl: attackerRpcUrl,
        config: {
          sessionName: 'Unauthorized Update',
        },
      },
    });

    global.fetch = jest.fn(async (url, options = {}) => {
      const payload = JSON.parse(options.body || '{}');
      if (payload?.method === 'eth_chainId') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x14a34' }),
        };
      }
      expect(payload?.method).toBe('eth_call');
      const canWearHat = url === attackerRpcUrl;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: hatsIface.encodeFunctionResult('isWearerOfHat', [canWearHat]),
        }),
      };
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Admin authorization failed.');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, safeRpcUrl, expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(2, safeRpcUrl, expect.any(Object));
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual(existingConfig);
  });

  it('merges set-config updates without dropping existing limits or scopes branches', async () => {
    const existingConfig = {
      adminAddress: adminWallet.address,
      sessionName: 'Existing Session',
      registryAddress: '0x0000000000000000000000000000000000000001',
      limits: {
        perWalletPerDay: 3,
        perIpPerHour: 8,
      },
      scopes: {
        ai: true,
        faucet: false,
      },
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        config: {
          sessionName: 'Updated Session',
          allowOrigins: ['https://next.example'],
          limits: {
            perWalletPerDay: 5,
          },
          scopes: {
            arweave: true,
          },
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );

    expect(response.status).toBe(200);
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      authzEpoch: 1,
      adminAddress: adminWallet.address,
      sessionName: 'Updated Session',
      registryAddress: '0x0000000000000000000000000000000000000001',
      allowOrigins: ['https://next.example'],
      limits: {
        perWalletPerDay: 5,
        perIpPerHour: 8,
      },
      scopes: {
        ai: true,
        faucet: false,
        arweave: true,
      },
    });
  });

  it('canonicalizes stored config slug to the authenticated session slug and normalizes legacy allowOrigins strings', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        config: {
          slug: 'wrong-session',
          allowOrigins: ' https://allowed.example,\nhttps://second.example ',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );

    expect(response.status).toBe(200);
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      authzEpoch: 1,
      adminAddress: adminWallet.address,
      slug: sessionSlug,
      allowOrigins: ['https://allowed.example', 'https://second.example'],
      limits: {},
      scopes: {},
    });
  });

  it('ignores malformed set-config limits and scopes branches instead of corrupting stored config', async () => {
    const existingConfig = {
      adminAddress: adminWallet.address,
      sessionName: 'Existing Session',
      limits: {
        perWalletPerDay: 3,
      },
      scopes: {
        ai: true,
      },
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        config: {
          sessionName: 'Updated Session',
          limits: 'bad-limits',
          scopes: 'bad-scopes',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );

    expect(response.status).toBe(200);
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      adminAddress: adminWallet.address,
      authzEpoch: 1,
      sessionName: 'Updated Session',
      limits: {
        perWalletPerDay: 3,
      },
      scopes: {
        ai: true,
      },
    });
  });

  it('stores allowed worker secrets on set-secrets', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        secrets: {
          openaiKey: 'sk-openai',
          customRpcUrl: 'https://rpc.example',
          arweaveJwk: '{"kty":"RSA"}',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-secrets', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    const stored = readStoredJson(kv, SESSION_SECRETS_KEY(sessionSlug));
    expect(stored).toEqual(expect.objectContaining({
      v: 1,
      kind: 'session-secrets',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      cipher: 'AES-256-GCM',
      keyRef: 'worker_secret:CE_STORAGE_ENVELOPE_KEK',
      encryptedSecrets: expect.any(String),
    }));
    expect(stored.secrets).toBeUndefined();
    expect(JSON.stringify(stored)).not.toMatch(/sk-openai|rpc\.example|RSA/);
    expect(await getSessionSecrets(env, sessionSlug)).toEqual({
      openaiKey: 'sk-openai',
      customRpcUrl: 'https://rpc.example',
      arweaveJwk: '{"kty":"RSA"}',
    });
  });

  it('normalizes secret values to strings before persisting them', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        secrets: {
          openaiKey: '  sk-openai  ',
          arweaveJwk: { kty: 'RSA', n: 'abc' },
          faucetPrivateKey: 12345,
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-secrets', body),
      env,
      {}
    );

    expect(response.status).toBe(200);
    const stored = readStoredJson(kv, SESSION_SECRETS_KEY(sessionSlug));
    expect(stored).toEqual(expect.objectContaining({
      v: 1,
      kind: 'session-secrets',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      cipher: 'AES-256-GCM',
      encryptedSecrets: expect.any(String),
    }));
    expect(stored.secrets).toBeUndefined();
    expect(JSON.stringify(stored)).not.toMatch(/sk-openai|RSA|12345/);
    expect(await getSessionSecrets(env, sessionSlug)).toEqual({
      openaiKey: 'sk-openai',
      arweaveJwk: '{"kty":"RSA","n":"abc"}',
      faucetPrivateKey: '12345',
    });
  });

  it('ignores unknown worker secret keys instead of persisting them', async () => {
    const existingSecrets = {
      openaiKey: 'sk-existing',
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify(existingSecrets),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        secrets: {
          ignoredSecret: 'should-not-save',
          tokenHmacSecret: 'also-ignore',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-secrets', body),
      env,
      {}
    );

    expect(response.status).toBe(200);
    const stored = readStoredJson(kv, SESSION_SECRETS_KEY(sessionSlug));
    expect(stored).toEqual(expect.objectContaining({
      v: 1,
      kind: 'session-secrets',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      cipher: 'AES-256-GCM',
      encryptedSecrets: expect.any(String),
    }));
    expect(stored.secrets).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain('sk-existing');
    expect(await getSessionSecrets(env, sessionSlug)).toEqual(existingSecrets);
  });

  it('rejects set-secrets when the secrets payload is missing', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      adminAction: 'set-secrets',
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-secrets', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing secrets.');
    expect(readStoredJson(kv, SESSION_SECRETS_KEY(sessionSlug))).toBeNull();
  });

  it('rejects set-secrets when the signer is not authorized', async () => {
    const existingSecrets = {
      openaiKey: 'sk-existing',
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify(existingSecrets),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: otherWallet,
      sessionSlug,
      body: {
        secrets: {
          openaiKey: 'sk-attacker',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-secrets', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Admin authorization failed.');
    expect(readStoredJson(kv, SESSION_SECRETS_KEY(sessionSlug))).toEqual(existingSecrets);
  });

  it('rejects admin requests when the worker session slug and request slug disagree', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv, {
      DEFAULT_SESSION_SLUG: sessionSlug,
    });
    const baseBody = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        config: {
          sessionName: 'Should not apply',
        },
      },
    });
    const body = {
      ...baseBody,
      sessionSlug: 'other-session',
    };

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('sessionSlug does not match worker session.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      adminAddress: adminWallet.address,
    });
  });

  it('rejects admin requests with invalid json bodies', async () => {
    const kv = createMemoryKv();
    const env = createCoordinatorEnv(kv);

    const response = await sessionCorsWorker.fetch(
      new Request('https://worker.example/admin/set-config', {
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
  });

  it('rejects admin requests when the signature fields are missing', async () => {
    const kv = createMemoryKv();
    const env = createCoordinatorEnv(kv);

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', {
        address: adminWallet.address,
        sessionSlug,
        config: {
          adminAddress: adminWallet.address,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing admin action signature fields.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toBeNull();
  });

  it('rejects admin requests when the typed-data signature does not match the request address', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const signedBody = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: otherWallet,
      sessionSlug,
      adminAction: 'set-config',
      body: {
        config: {
          sessionName: 'Should not apply',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', {
        ...signedBody,
        address: adminWallet.address,
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Signature does not match address.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      adminAddress: adminWallet.address,
    });
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it('rejects existing-config admin mutations when the request origin is not allowed', async () => {
    const existingConfig = {
      adminAddress: adminWallet.address,
      allowOrigins: ['https://allowed.example'],
      sessionName: 'Existing Session',
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        config: {
          sessionName: 'Blocked Update',
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', body, {
        headers: { Origin: 'https://blocked.example' },
      }),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload?.error).toBe('Origin not allowed.');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual(existingConfig);
  });

  it('merges set-limits updates without dropping existing config or a minimal legacy key', async () => {
    const legacySessionKey = {
      iv: 'legacy-iv-value1',
      wrappedKey: 'L'.repeat(64),
    };
    const existingConfig = {
      adminAddress: adminWallet.address,
      sessionName: 'Existing Session',
      allowOrigins: ['https://app.example'],
      limits: {
        perWalletPerDay: 3,
      },
      scopes: {
        ai: true,
      },
      storageEnvelope: {
        sessionKey: legacySessionKey,
      },
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      body: {
        limits: {
          perWalletPerDay: 5,
          perIpPerHour: 8,
        },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-limits', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual({
      adminAddress: adminWallet.address,
      sessionName: 'Existing Session',
      allowOrigins: ['https://app.example'],
      scopes: {
        ai: true,
      },
      storageEnvelope: {
        sessionKey: legacySessionKey,
      },
      limits: {
        perWalletPerDay: 5,
        perIpPerHour: 8,
      },
    });
  });

  it('rejects set-limits when the limits payload is missing', async () => {
    const existingConfig = {
      adminAddress: adminWallet.address,
      limits: {
        perWalletPerDay: 3,
      },
    };
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(existingConfig),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      adminAction: 'set-limits',
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-limits', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing limits.');
    expect(readStoredJson(kv, SESSION_CONFIG_KEY(sessionSlug))).toEqual(existingConfig);
  });

  it('returns an explicit error for unknown admin actions', async () => {
    const kv = createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        adminAddress: adminWallet.address,
      }),
    });
    const env = createCoordinatorEnv(kv);
    const body = await createSignedSiweBody({
      worker: sessionCorsWorker,
      env,
      wallet: adminWallet,
      sessionSlug,
      adminAction: 'not-a-route',
    });

    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/not-a-route', body),
      env,
      {}
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Unknown admin action.');
  });

  it('returns CORS preflight headers for OPTIONS requests', async () => {
    const response = await sessionCorsWorker.fetch(
      makeJsonRequest('/admin/set-config', null, {
        method: 'OPTIONS',
        headers: { Origin: 'https://app.example' },
      }),
      { GROUP_KV: createMemoryKv() },
      {}
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
  });
});
