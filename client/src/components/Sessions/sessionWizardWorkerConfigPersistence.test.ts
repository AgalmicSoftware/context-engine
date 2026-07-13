import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
import { buildSessionWizardWorkerConfigPayload } from './sessionWizardWriteNormalization';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const ADMIN_ADDRESS = '0x1111111111111111111111111111111111111111';
const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const WORKER_ORIGIN = 'https://session-worker.example.test';

const baseConfig = () => ({
  sessionName: 'Worker Canonical Session',
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'fast_cheap_cloudflare',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: { backend: 'cloudflare' },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
  },
  storageProfile: { backend: 'cloudflare' },
  ai: { models: { fast: { provider: 'openai', model: 'gpt-test' } } },
});

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => body),
  }) as unknown as Response;

const verifiedConfig = (revision: string, overrides: Record<string, unknown> = {}) => ({
  ...baseConfig(),
  slug: 'worker-session',
  sessionId: SESSION_ID,
  adminAddress: ADMIN_ADDRESS,
  corsWorkerUrl: WORKER_ORIGIN,
  configRevision: revision,
  ...overrides,
});

describe('persistAndVerifySessionWizardWorkerConfig', () => {
  it('signs and writes non-secret config, then returns only an exactly verified public config', async () => {
    const signAdminAction = jest.fn(async () => ({
      address: ADMIN_ADDRESS,
      message: 'signed set-config message',
      signature: '0xsigned',
    }));
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('revision-1') }));

    const result = await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: `${WORKER_ORIGIN}/`,
      slug: ' Worker-Session ',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config: baseConfig(),
      signAdminAction,
      fetchImpl,
      randomRevision: () => 'revision-1',
      retryDelaysMs: [],
    });

    expect(signAdminAction).toHaveBeenCalledWith({
      action: 'set-config',
      body: {
        sessionSlug: 'worker-session',
        adminAddress: ADMIN_ADDRESS,
        config: verifiedConfig('revision-1'),
      },
      targetSlug: 'worker-session',
      workerUrl: WORKER_ORIGIN,
    });

    const [postUrl, postInit] = fetchImpl.mock.calls[0];
    expect(postUrl).toBe(`${WORKER_ORIGIN}/admin/set-config`);
    expect(postInit).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(postInit.body)).toEqual({
      address: ADMIN_ADDRESS,
      message: 'signed set-config message',
      signature: '0xsigned',
      sessionSlug: 'worker-session',
      adminAddress: ADMIN_ADDRESS,
      config: verifiedConfig('revision-1'),
    });

    expect(fetchImpl.mock.calls[1]).toEqual([
      `${WORKER_ORIGIN}/session-config`,
      {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'X-Session-Slug': 'worker-session',
        },
      },
    ]);
    expect(result).toEqual({
      workerOrigin: WORKER_ORIGIN,
      configRevision: 'revision-1',
      publicConfig: verifiedConfig('revision-1'),
    });
  });

  it('retries a stale successful read until the requested config revision is visible', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('stale-revision') }))
      .mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('revision-2') }));

    const result = await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config: baseConfig(),
      signAdminAction: async () => ({ signature: '0xsigned' }),
      fetchImpl,
      configRevision: 'revision-2',
      sleep,
      retryDelaysMs: [25],
    });

    expect(sleep).toHaveBeenCalledWith(25);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.configRevision).toBe('revision-2');
  });

  it('signs the exact non-secret Lit descriptor fields for a worker-canonical Lit session', async () => {
    const litCredentials = {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    };
    const signAdminAction = jest.fn(async () => ({ signature: '0xsigned' }));
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('revision-lit') }));

    await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config: {
        ...baseConfig(),
        litCredentials,
      },
      signAdminAction,
      fetchImpl,
      configRevision: 'revision-lit',
      retryDelaysMs: [],
    });

    expect(signAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          config: expect.objectContaining({ litCredentials }),
        }),
      }),
    );
  });

  it('composes an explicit-Lit worker payload through signed persistence while config and public verification stay RPC-free', async () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.encryption = { mode: 'lit' };
    sessionModeProfile.evm.registryChainId = 11155420;
    const config = buildSessionWizardWorkerConfigPayload({
      slug: 'worker-session',
      draft: {
        sessionName: 'Worker Lit Session',
        networkChainId: 11155420,
        sessionModeProfile,
      },
      deployPayload: {
        rpcUrl: 'https://rpc.example.test',
        rpcUrlsByChainId: { 11155420: ['https://rpc.example.test'] },
      },
      workerSecrets: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
      },
      account: ADMIN_ADDRESS,
      sessionId: SESSION_ID,
      workerUrl: WORKER_ORIGIN,
    });
    const signAdminAction = jest.fn(async () => ({ signature: '0xsigned' }));
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: verifiedConfig('revision-lit-rpc', {
            sessionName: 'Worker Lit Session',
            sessionModeProfile,
            networkChainId: 11155420,
          }),
        }),
      );

    const result = await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config,
      signAdminAction,
      fetchImpl,
      configRevision: 'revision-lit-rpc',
      retryDelaysMs: [],
    });

    const signedConfig = signAdminAction.mock.calls[0][0].body.config;
    expect(signedConfig).not.toHaveProperty('rpcUrl');
    expect(signedConfig).not.toHaveProperty('rpcUrlsByChainId');
    expect(signedConfig).toEqual(expect.objectContaining({ networkChainId: 11155420 }));
    expect(result.publicConfig).not.toHaveProperty('rpcUrl');
    expect(result.publicConfig).not.toHaveProperty('rpcUrlsByChainId');
  });

  it.each([
    ['slug', { slug: 'different-session' }],
    ['session id', { sessionId: '0xffeeddccbbaa99887766554433221100' }],
    [
      'authority profile',
      {
        sessionModeProfile: {
          ...baseConfig().sessionModeProfile,
          authority: { mode: 'evm_registry_canonical' },
        },
      },
    ],
    ['worker origin', { corsWorkerUrl: 'https://different-worker.example.test' }],
  ])('fails closed on a verified-read %s mismatch', async (_label, overrides) => {
    const sleep = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('revision-3', overrides) }));

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: 'revision-3',
        sleep,
        retryDelaysMs: [1, 2],
      }),
    ).rejects.toThrow(/verification failed/i);

    expect(sleep).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('times out after bounded stale-revision retries', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValue(jsonResponse(200, { config: verifiedConfig('stale-revision') }));

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: 'revision-timeout',
        sleep,
        retryDelaysMs: [10, 20],
      }),
    ).rejects.toThrow(/timed out/i);

    expect(sleep.mock.calls).toEqual([[10], [20]]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['write', 500, { error: 'write failed' }],
    ['read', 403, { error: 'read forbidden' }],
  ])('fails closed on a non-2xx %s response', async (phase, status, body) => {
    const fetchImpl =
      phase === 'write'
        ? jest.fn().mockResolvedValueOnce(jsonResponse(status, body))
        : jest
            .fn()
            .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
            .mockResolvedValueOnce(jsonResponse(status, body));

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: 'revision-4',
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(new RegExp(`${phase} failed`, 'i'));
  });

  it.each([
    ['Cloudflare token', { cloudflareApiToken: 'cloudflare-secret' }],
    ['AI provider key', { ai: { anthropicKey: 'ai-secret' } }],
    ['Arweave JWK', { storage: { arweaveJwk: 'arweave-secret' } }],
    ['Lit credential', { litCredentials: { litUsageApiKey: 'lit-secret' } }],
    ['Lit account credential', { litCredentials: { litAccountApiKey: 'lit-secret' } }],
    ['generic Lit API key', { litCredentials: { apiKey: 'lit-secret' } }],
    ['generic Lit token', { litCredentials: { token: 'lit-secret' } }],
    ['unknown Lit descriptor field', { litCredentials: { litNetwork: 'datil' } }],
    ['nested Lit secret alias', { litCredentials: { metadata: { clientSecret: 'lit-secret' } } }],
    ['credential-bearing Lit API base', { litCredentials: { litApiBase: 'https://user:secret@lit.example' } }],
    ['RPC config', { rpcUrlsByChainId: { '1': ['https://rpc-key.example'] } }],
    ['faucet config', { faucet: { privateKey: 'faucet-secret' } }],
  ])('rejects a secret-bearing %s before signing or persistence', async (_label, secretConfig) => {
    const signAdminAction = jest.fn();
    const fetchImpl = jest.fn();

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: {
          ...baseConfig(),
          ...secretConfig,
        },
        signAdminAction,
        fetchImpl,
        configRevision: 'revision-secret',
      }),
    ).rejects.toThrow(/secret-bearing worker config field/i);

    expect(signAdminAction).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a verified response that exposes a redacted secret field', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: {
            ...verifiedConfig('revision-public'),
            openaiKey: 'unexpected-secret',
          },
        }),
      );

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: 'revision-public',
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/secret-bearing worker config field/i);
  });

  it('rejects a verified public response that exposes even a non-secret Lit descriptor', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: {
            ...verifiedConfig('revision-public-lit'),
            litCredentials: {
              litApiBase: 'https://api.chipotle.litprotocol.com',
              litActionCid: 'bafy123',
            },
          },
        }),
      );

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: 'revision-public-lit',
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/public worker config response exposed litCredentials/i);
  });
});
