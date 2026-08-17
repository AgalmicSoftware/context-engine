import {
  persistAndVerifySessionWizardWorkerConfig,
  type SessionWizardWorkerConfigSignInput,
} from './sessionWizardWorkerConfigPersistence';
import { buildSessionWizardWorkerConfigPayload } from './sessionWizardWriteNormalization';
import { buildSessionWizardDefaultTemplate } from './sessionWizardDraftState';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const ADMIN_ADDRESS = '0x1111111111111111111111111111111111111111';
const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const WORKER_ORIGIN = 'https://session-worker.example.test';
const CREDENTIALED_LIT_API_BASE = (() => {
  const url = new URL('https://lit.example');
  url.username = 'user';
  url.password = 'secret';
  return url.toString();
})();

const baseConfig = () => ({
  sessionName: 'Worker Canonical Session',
  appearance: { colorSchemeId: 'amber' },
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
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
    let signedConfig: Record<string, unknown> | null = null;
    const signAdminAction = jest.fn(async (_input: SessionWizardWorkerConfigSignInput) => ({
      address: ADMIN_ADDRESS,
      message: 'signed set-config message',
      signature: '0xsigned',
    }));
    signAdminAction.mockImplementationOnce(async (input: SessionWizardWorkerConfigSignInput) => {
      signedConfig = input.body.config;
      return { address: ADMIN_ADDRESS, message: 'signed set-config message', signature: '0xsigned' };
    });
    const fetchImpl = jest.fn(async (_url, init) =>
      init?.method === 'POST' ? jsonResponse(200, { ok: true }) : jsonResponse(200, { config: signedConfig }),
    );

    const result = await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: `${WORKER_ORIGIN}/`,
      slug: ' Worker-Session ',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config: baseConfig(),
      signAdminAction,
      fetchImpl,
      retryDelaysMs: [],
    });

    const revision = result.configRevision;
    expect(revision).toMatch(/^config:[a-f0-9]{64}$/);

    expect(signAdminAction).toHaveBeenCalledWith({
      action: 'set-config',
      body: {
        sessionSlug: 'worker-session',
        adminAddress: ADMIN_ADDRESS,
        config: verifiedConfig(revision),
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
      config: verifiedConfig(revision),
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
      configRevision: revision,
      publicConfig: verifiedConfig(revision),
    });
    expect(result.publicConfig.appearance).toEqual({ colorSchemeId: 'amber' });
  });

  it('rejects an unsupported profile before signing or transport', async () => {
    const signAdminAction = jest.fn();
    const fetchImpl = jest.fn();
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.authority.mode = 'worker_with_public_anchor';
    sessionModeProfile.evm.registryChainId = 11155420;

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: { ...baseConfig(), sessionModeProfile },
        signAdminAction,
        fetchImpl,
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/unsupported session mode profile/i);

    expect(signAdminAction).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an all-zero session ID before signing or transport', async () => {
    const signAdminAction = jest.fn();
    const fetchImpl = jest.fn();

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: '0x00000000000000000000000000000000',
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction,
        fetchImpl,
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/valid 16-byte session id/i);

    expect(signAdminAction).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('emits the same deterministic revision from two independent persistence invocations', async () => {
    const revisions: string[] = [];
    const runPersistence = async () => {
      let persistedConfig: Record<string, unknown> | null = null;
      const result = await persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: baseConfig(),
        signAdminAction: async (input) => {
          persistedConfig = input.body.config;
          return { signature: '0xsigned' };
        },
        fetchImpl: async (_url, init) =>
          init?.method === 'POST' ? jsonResponse(200, { ok: true }) : jsonResponse(200, { config: persistedConfig }),
        retryDelaysMs: [],
      });
      revisions.push(result.configRevision);
    };

    await runPersistence();
    await runPersistence();

    expect(revisions).toHaveLength(2);
    expect(revisions[1]).toBe(revisions[0]);
  });

  it('persists the real default worker-canonical draft without exposing its transcription RPC field', async () => {
    const draft = buildSessionWizardDefaultTemplate();
    draft.slug = 'worker-session';
    draft.sessionName = 'Default Worker Session';
    draft.sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    draft.storageProfile = { backend: 'cloudflare' };
    const config = buildSessionWizardWorkerConfigPayload({
      slug: draft.slug,
      draft,
      account: ADMIN_ADDRESS,
      sessionId: SESSION_ID,
      workerUrl: WORKER_ORIGIN,
    });
    const revision = 'revision-default-draft';
    const persistedConfig = {
      ...config,
      ai: { models: config.ai.models },
      slug: 'worker-session',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      corsWorkerUrl: WORKER_ORIGIN,
      configRevision: revision,
    };
    const signAdminAction = jest.fn(async () => ({ signature: '0xsigned' }));
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, { config: persistedConfig }));

    expect(config.ai).toEqual(
      expect.objectContaining({
        models: expect.objectContaining({
          transcription: { provider: 'openai', model: 'whisper-1' },
        }),
      }),
    );
    expect(config.ai.models.transcription).not.toHaveProperty('rpcUrl');
    expect(config.appearance).toEqual({ colorSchemeId: 'context-engine' });

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: draft.slug,
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config,
        signAdminAction,
        fetchImpl,
        configRevision: revision,
        retryDelaysMs: [],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        workerOrigin: WORKER_ORIGIN,
        configRevision: revision,
      }),
    );
    expect(signAdminAction).toHaveBeenCalledTimes(1);
  });

  it('retries a stale successful read until the requested config revision is visible', async () => {
    const sleep = jest.fn(async (_delayMs: number) => undefined);
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

  it('retries every transient post-write read status until the committed config becomes visible', async () => {
    const sleep = jest.fn(async () => undefined);
    const transientStatuses = [404, 408, 425, 429, 500, 502, 503, 504, 520, 599];
    const fetchImpl = jest.fn().mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    transientStatuses.forEach((status) => {
      fetchImpl.mockResolvedValueOnce(jsonResponse(status, { error: `transient-${status}` }));
    });
    fetchImpl.mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('revision-transient') }));

    const result = await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config: baseConfig(),
      signAdminAction: async () => ({ signature: '0xsigned' }),
      fetchImpl,
      configRevision: 'revision-transient',
      sleep,
      retryDelaysMs: transientStatuses.map(() => 0),
    });

    expect(result.publicConfig).toEqual(verifiedConfig('revision-transient'));
    expect(sleep).toHaveBeenCalledTimes(transientStatuses.length);
    expect(fetchImpl).toHaveBeenCalledTimes(transientStatuses.length + 2);
  });

  it('retries a post-write GET transport exception without replaying the POST', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { config: verifiedConfig('revision-network-retry') }));

    const result = await persistAndVerifySessionWizardWorkerConfig({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
      adminAddress: ADMIN_ADDRESS,
      config: baseConfig(),
      signAdminAction: async () => ({ signature: '0xsigned' }),
      fetchImpl,
      configRevision: 'revision-network-retry',
      sleep,
      retryDelaysMs: [0],
    });

    expect(result.configRevision).toBe('revision-network-retry');
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the matching revision exposes a different nested public config', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: verifiedConfig('revision-wrong-model', {
            ai: { models: { fast: { provider: 'openai', model: 'wrong-model' } } },
          }),
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
        configRevision: 'revision-wrong-model',
        sleep,
        retryDelaysMs: [0],
      }),
    ).rejects.toThrow(/public config mismatch at "config\.ai\.models\.fast\.model"/i);
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the matching revision contains an unexpected nested public field', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: verifiedConfig('revision-extra-limit', { limits: { perWalletPerDay: 1 } }),
        }),
      );

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: { ...baseConfig(), limits: {} },
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: 'revision-extra-limit',
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/public config mismatch at "config\.limits"/i);
  });

  it('accepts the matching server publication marker while exactly verifying expected nested fields', async () => {
    const revision = 'revision-server-marker';
    const limits = { perWalletPerDay: 2 };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: verifiedConfig(revision, {
            limits,
            workerCanonicalPublicationRevision: revision,
          }),
        }),
      );

    await expect(
      persistAndVerifySessionWizardWorkerConfig({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
        config: { ...baseConfig(), limits },
        signAdminAction: async () => ({ signature: '0xsigned' }),
        fetchImpl,
        configRevision: revision,
        retryDelaysMs: [],
      }),
    ).resolves.toEqual(expect.objectContaining({ configRevision: revision }));
  });

  it('rejects a server publication marker that does not match the requested revision', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          config: verifiedConfig('revision-marker-mismatch', {
            workerCanonicalPublicationRevision: 'different-revision',
          }),
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
        configRevision: 'revision-marker-mismatch',
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/publication revision mismatch/i);
  });

  it('signs the exact non-secret Lit descriptor fields for a worker-canonical Lit session', async () => {
    const litCredentials = {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    };
    const signAdminAction = jest.fn(async (_input: SessionWizardWorkerConfigSignInput) => ({
      signature: '0xsigned',
    }));
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
    sessionModeProfile.storage.payloadAccessControl = {
      ...sessionModeProfile.storage.payloadAccessControl!,
      encryption: 'lit',
    };
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
    let persistedPublicConfig: Record<string, unknown> = {};
    const signAdminAction = jest.fn(async (input) => {
      const { litCredentials: _privateDescriptor, ...publicConfig } = input.body.config;
      persistedPublicConfig = publicConfig;
      return { signature: '0xsigned' };
    });
    const fetchImpl = jest.fn(async (_url, init) =>
      init?.method === 'POST' ? jsonResponse(200, { ok: true }) : jsonResponse(200, { config: persistedPublicConfig }),
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
    ['zero session id', { sessionId: '0x00000000000000000000000000000000' }],
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
    ['credential-bearing Lit API base', { litCredentials: { litApiBase: CREDENTIALED_LIT_API_BASE } }],
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
