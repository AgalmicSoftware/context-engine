import { ethers } from 'ethers';
import sessionCorsWorker, { workerAuthGateUtils } from '../../workers/sessionCorsWorker/worker.js';
import {
  buildRpcFetchMock,
  createMemoryKv,
} from '../helpers/sessionCorsWorkerTestUtils.mjs';

const REGISTRY_ABI = [
  'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
  'function sessionExists(string) view returns (bool)',
];
const registryIface = new ethers.utils.Interface(REGISTRY_ABI);

const collectBalanceOfTargets = (fetchMock) => {
  const out = [];
  fetchMock.mock.calls.forEach(([, options]) => {
    const body = JSON.parse(options?.body || '{}');
    if (body.method !== 'eth_call') return;
    const call = body.params?.[0] || {};
    const data = String(call.data || '');
    const selector = data.slice(0, 10).toLowerCase();
    const balanceOfSelector = ethers.utils
      .id('balanceOf(address)')
      .slice(0, 10)
      .toLowerCase();
    if (selector !== balanceOfSelector) return;
    out.push(String(call.to || '').toLowerCase());
  });
  return out;
};

const collectRegistrySlugArgs = (fetchMock, methodName) => {
  const out = [];
  const targetSelector = registryIface.getSighash(methodName).toLowerCase();
  fetchMock.mock.calls.forEach(([, options]) => {
    const body = JSON.parse(options?.body || '{}');
    if (body.method !== 'eth_call') return;
    const call = body.params?.[0] || {};
    const data = String(call.data || '');
    const selector = data.slice(0, 10).toLowerCase();
    if (selector !== targetSelector) return;
    const decoded = registryIface.decodeFunctionData(methodName, data);
    out.push(String(decoded?.[0] || ''));
  });
  return out;
};

describe('sessionCorsWorker gate authority', () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;

  const registryAddress = '0x0000000000000000000000000000000000000001';
  const rpcUrl = 'https://rpc.example';
  const address = '0x00000000000000000000000000000000000000aa';
  const onChainDefaultSbt = '0x0000000000000000000000000000000000000101';
  const legacyDefaultSbt = '0x0000000000000000000000000000000000000202';

  afterEach(() => {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    jest.clearAllMocks();
  });

  it('uses on-chain gates for auth decisions even when metadata gates differ', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [onChainDefaultSbt], chainId: 84532, mode: 0 },
      },
      balancesByToken: {
        [onChainDefaultSbt.toLowerCase()]: 1,
        [legacyDefaultSbt.toLowerCase()]: 0,
      },
    });
    global.fetch = fetchMock;

    const scopes = await workerAuthGateUtils.computeScopesForLogin({
      env: {},
      slug: '',
      address,
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
        sponsored: {
          defaultGateId: 'legacy-default',
          gates: {
            'legacy-default': { sbtAddresses: [legacyDefaultSbt], chainId: 84532, mode: 'any' },
          },
          resources: {},
        },
      },
    });

    expect(scopes.ai).toBe(true);
    const balanceTargets = collectBalanceOfTargets(fetchMock);
    expect(balanceTargets).toContain(onChainDefaultSbt.toLowerCase());
    expect(balanceTargets).not.toContain(legacyDefaultSbt.toLowerCase());
  });

  it('canonicalizes reserved debate aliases before auth gate registry reads', async () => {
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

    const scopes = await workerAuthGateUtils.computeScopesForLogin({
      env: {},
      slug: 'debate',
      address,
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
    });

    expect(scopes.ai).toBe(true);
    expect(collectRegistrySlugArgs(fetchMock, 'getResourceGate')).not.toContain('debate');
    expect(collectRegistrySlugArgs(fetchMock, 'getResourceGate')).toContain('rxc');
  });

  it('allows anonymous AI/transcribe when default and ai gates are explicitly open', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
      route: 'ai',
      apiKey: '',
    });

    expect(result.ok).toBe(true);
  });

  it('canonicalizes reserved debate aliases before anonymous gate registry reads', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: 'debate',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
      route: 'ai',
      apiKey: '',
    });

    expect(result.ok).toBe(true);
    expect(collectRegistrySlugArgs(fetchMock, 'sessionExists')).not.toContain('debate');
    expect(collectRegistrySlugArgs(fetchMock, 'sessionExists')).toContain('rxc');
    expect(collectRegistrySlugArgs(fetchMock, 'getResourceGate')).not.toContain('debate');
    expect(collectRegistrySlugArgs(fetchMock, 'getResourceGate')).toContain('rxc');
  });

  it('denies anonymous AI/transcribe on restricted gates without apiKey', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [onChainDefaultSbt], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
      route: 'transcribe',
      apiKey: '',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('allows anonymous AI/transcribe on restricted gates when request apiKey is provided', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [onChainDefaultSbt], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [onChainDefaultSbt], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
      route: 'ai',
      apiKey: 'sk-local-123',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies anonymous ai when ai scope override is disabled even with request apiKey', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
        scopes: { ai: false },
      },
      route: 'ai',
      apiKey: 'sk-local-123',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies anonymous transcribe when transcribe scope override is disabled', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
        scopes: { transcribe: false },
      },
      route: 'transcribe',
      apiKey: '',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed for anonymous AI/transcribe when gate authority is unavailable', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: false,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const result = await workerAuthGateUtils.evaluateAnonymousRouteAccess({
      slug: '',
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
      route: 'transcribe',
      apiKey: '',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain('on-chain gate data unavailable');
  });

  it('fails closed when on-chain session gate authority is unavailable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: false,
      onChainGatesByResource: {
        default: { sbtAddresses: [onChainDefaultSbt], chainId: 84532, mode: 0 },
      },
      balancesByToken: {
        [onChainDefaultSbt.toLowerCase()]: 0,
        [legacyDefaultSbt.toLowerCase()]: 1,
      },
    });
    global.fetch = fetchMock;

    await expect(
      workerAuthGateUtils.computeScopesForLogin({
        env: {},
        slug: '',
        address,
        config: {
          registryAddress,
          registryChainId: 84532,
          rpcUrl,
          sponsored: {
            defaultGateId: 'legacy-default',
            gates: {
              'legacy-default': { sbtAddresses: [legacyDefaultSbt], chainId: 84532, mode: 'any' },
            },
            resources: {},
          },
        },
      })
    ).rejects.toThrow('Access denied: on-chain gate data unavailable.');

    const balanceTargets = collectBalanceOfTargets(fetchMock);
    expect(balanceTargets).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('probes registry bytecode once when the default gate lookup is unavailable during login', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = jest.fn(async (url, options = {}) => {
      expect(url).toBe(rpcUrl);
      const body = JSON.parse(options.body || '{}');

      if (body.method === 'eth_chainId') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x14a34' }),
        };
      }

      if (body.method === 'eth_getCode') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1234' }),
        };
      }

      if (body.method === 'eth_call') {
        const call = body.params?.[0] || {};
        const data = String(call.data || '');
        const selector = data.slice(0, 10).toLowerCase();

        if (selector === registryIface.getSighash('sessionExists').toLowerCase()) {
          const result = registryIface.encodeFunctionResult('sessionExists', [true]);
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result }),
          };
        }

        if (selector === registryIface.getSighash('getResourceGate').toLowerCase()) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              error: { code: -32000, message: 'gate lookup failed' },
            }),
          };
        }
      }

      throw new Error(`Unexpected RPC method: ${body.method}`);
    });
    global.fetch = fetchMock;

    await expect(
      workerAuthGateUtils.computeScopesForLogin({
        env: {},
        slug: '',
        address,
        config: {
          registryAddress,
          registryChainId: 84532,
          rpcUrl,
        },
      })
    ).rejects.toThrow('Access denied: default gate failed.');

    const rpcMethods = fetchMock.mock.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);
    expect(rpcMethods.filter((method) => method === 'eth_getCode')).toHaveLength(1);
    // One request attests the registry reads; the existing diagnostic probe
    // intentionally performs its own endpoint-health request.
    expect(rpcMethods.filter((method) => method === 'eth_chainId')).toHaveLength(2);
    expect(logSpy).toHaveBeenCalledWith(
      '[gating] registry code probe',
      expect.objectContaining({
        slug: 'general',
        bytecodeSize: 2,
        rpcUrl: 'https://rpc.example',
        errors: [],
        error: '',
      })
    );
  });

  it('applies updated on-chain default gate on new logins', async () => {
    const runLogin = async (onChainGate, balancesByToken) => {
      const fetchMock = buildRpcFetchMock({
        rpcUrl,
        registryAddress,
        sessionExists: true,
        onChainGatesByResource: { default: onChainGate || {} },
        balancesByToken,
      });
      global.fetch = fetchMock;
      return workerAuthGateUtils.computeScopesForLogin({
        env: {},
        slug: '',
        address,
        config: {
          registryAddress,
          registryChainId: 84532,
          rpcUrl,
        },
      });
    };

    await expect(
      runLogin(
        { sbtAddresses: [onChainDefaultSbt], chainId: 84532, mode: 0 },
        { [onChainDefaultSbt.toLowerCase()]: 0 }
      )
    ).rejects.toThrow('Access denied: default gate failed.');

    const scopesAfterUpdate = await runLogin(
      { sbtAddresses: [], chainId: 84532, mode: 0 },
      {}
    );
    expect(scopesAfterUpdate.ai).toBe(true);
    expect(scopesAfterUpdate.arweave).toBe(true);
  });

  it('sets faucet scope true for logged-in users when txGas gate is open', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const scopes = await workerAuthGateUtils.computeScopesForLogin({
      env: {},
      slug: '',
      address,
      config: {
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
      },
    });

    expect(scopes.faucet).toBe(true);
  });

  it('does not trust forwarded headers for anonymous rate identity outside Cloudflare runtime', () => {
    const identity = workerAuthGateUtils.resolveAnonymousRateIdentity({
      headers: new Headers({
        'x-forwarded-for': '203.0.113.9',
        'CF-Connecting-IP': '198.51.100.7',
      }),
    });
    expect(identity).toBe('anon:unknown');
  });

  it('uses X-Anonymous-Client-Id for anonymous rate identity outside Cloudflare runtime', () => {
    const identity = workerAuthGateUtils.resolveAnonymousRateIdentity({
      headers: new Headers({ 'X-Anonymous-Client-Id': 'client_abc12345' }),
    });
    expect(identity).toBe('anon:cid:client_abc12345');
  });

  it('uses CF-Connecting-IP for anonymous rate identity in Cloudflare runtime', () => {
    const identity = workerAuthGateUtils.resolveAnonymousRateIdentity({
      headers: new Headers({ 'CF-Connecting-IP': '198.51.100.7' }),
      cf: { colo: 'SJC' },
    });
    expect(identity).toBe('anon:198.51.100.7');
  });

  it('short-circuits anonymous ai over-limit requests before on-chain gate checks', async () => {
    const fetchMock = buildRpcFetchMock({
      rpcUrl,
      registryAddress,
      sessionExists: true,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
      },
    });
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      'session:general2:config': JSON.stringify({
        registryAddress,
        registryChainId: 84532,
        rpcUrl,
        limits: { perWalletPerDay: 1 },
      }),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };

    const makeRequest = () => new Request('https://worker.example/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Slug': 'general2',
      },
      body: JSON.stringify({
        action: 'ai',
        provider: 'unsupported-provider',
      }),
    });

    const first = await sessionCorsWorker.fetch(makeRequest(), env, {});
    expect(first.status).toBe(400);
    expect(fetchMock).toHaveBeenCalled();

    fetchMock.mockClear();

    const second = await sessionCorsWorker.fetch(makeRequest(), env, {});
    expect(second.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects anonymous apiKey custom ai requests that omit rpcUrl', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      'session:general2:config': JSON.stringify({
        limits: { perWalletPerDay: 3 },
      }),
      'session:general2:secrets': JSON.stringify({
        customRpcUrl: 'https://internal.example/v1/chat/completions',
        customRpcKey: 'secret-key',
      }),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };

    const request = new Request('https://worker.example/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Slug': 'general2',
      },
      body: JSON.stringify({
        action: 'ai',
        provider: 'custom',
        model: 'gpt-4o-mini',
        apiKey: 'sk-local-123',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    const response = await sessionCorsWorker.fetch(request, env, {});
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload?.error).toContain('requires request rpcUrl');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kv.get).not.toHaveBeenCalledWith('session:general2:secrets');
    expect(kv.get).not.toHaveBeenCalledWith('group:general2:secrets');
  });

  it('rejects anonymous apiKey custom transcribe requests that omit rpcUrl', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const kv = createMemoryKv({
      'session:general2:config': JSON.stringify({
        limits: { perWalletPerDay: 3 },
      }),
      'session:general2:secrets': JSON.stringify({
        openaiKey: 'sk-worker-openai',
      }),
    });
    const env = {
      GROUP_KV: kv,
      TOKEN_HMAC_SECRET: 'test-secret',
    };

    const formData = new FormData();
    formData.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));
    formData.append('provider', 'custom');
    formData.append('apiKey', 'sk-local-123');

    const request = {
      url: 'https://worker.example/transcribe',
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'multipart/form-data; boundary=mock',
        'X-Session-Slug': 'general2',
      }),
      formData: async () => formData,
    };

    const response = await sessionCorsWorker.fetch(request, env, {});
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload?.error).toBe('Missing rpcUrl for custom transcription.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kv.get).not.toHaveBeenCalledWith('session:general2:secrets');
    expect(kv.get).not.toHaveBeenCalledWith('group:general2:secrets');
  });

  it('rejects blank anonymous slug headers as missing slug', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const env = {
      GROUP_KV: createMemoryKv(),
      TOKEN_HMAC_SECRET: 'test-secret',
    };

    const request = new Request('https://worker.example/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Slug': '   ',
      },
      body: JSON.stringify({
        action: 'ai',
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    const response = await sessionCorsWorker.fetch(request, env, {});
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload?.error).toContain('Missing sessionSlug');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
