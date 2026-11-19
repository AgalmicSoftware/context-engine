import {
  buildSessionWizardLitBootstrapRecovery,
  createSessionWizardEnsureWorkerSessionConfig,
  matchesSessionWizardLitBootstrapRecovery,
  mergeRecoveredSessionWizardLitRuntime,
  resolveCompleteSessionWizardLitRuntime,
  syncSessionWizardLitRuntimeConfigAfterDeploy,
} from './sessionWizardWorkerDeployLitRuntime';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const litCredentials = {
  litApiBase: 'https://api.chipotle.litprotocol.com',
  litGroupId: 'group-1',
  litPkpId: 'pkp-1',
  litActionCid: 'bafy-action-1',
  litAuthorizationVersion: 'worker-signed-v1',
  litAuthorizationSigner: '0x00000000000000000000000000000000000000aa',
};

describe('sessionWizardWorkerDeployLitRuntime', () => {
  it('requires and normalizes the public Lit tuple including Worker authorization', () => {
    expect(resolveCompleteSessionWizardLitRuntime({ ...litCredentials, litGroupId: ' group-1 ' })).toEqual(
      litCredentials,
    );
    expect(resolveCompleteSessionWizardLitRuntime({ ...litCredentials, litPkpId: '' })).toBeNull();
  });

  it('keeps a bootstrap tuple recoverable without clearing account authority', () => {
    expect(mergeRecoveredSessionWizardLitRuntime({ litAccountApiKey: 'account-key' }, litCredentials)).toEqual({
      litAccountApiKey: 'account-key',
      ...litCredentials,
      litRuntimeRecovered: 'bootstrap',
    });
  });

  it('matches recovery only for the same worker, slug, and tuple', () => {
    const recovery = buildSessionWizardLitBootstrapRecovery({
      workerUrl: 'https://worker.example.test/',
      slug: 'lit-session',
      litCredentials,
    });
    expect(
      matchesSessionWizardLitBootstrapRecovery({
        recovery,
        workerUrl: 'https://worker.example.test',
        slug: 'lit-session',
        litCredentials,
      }),
    ).toBe(true);
    expect(
      matchesSessionWizardLitBootstrapRecovery({
        recovery,
        workerUrl: 'https://worker.example.test',
        slug: 'lit-session',
        litCredentials: { ...litCredentials, litGroupId: 'edited' },
      }),
    ).toBe(false);
  });

  it('requires a tuple-specific remote config write before reporting sync', async () => {
    const ensureSessionConfig = jest.fn(async () => undefined);
    await expect(
      syncSessionWizardLitRuntimeConfigAfterDeploy({
        requiresLit: true,
        workerUrl: 'https://worker.example.test',
        slug: 'lit-session',
        litCredentials,
        ensureSessionConfig,
      }),
    ).resolves.toEqual(expect.objectContaining({ synced: true }));
    expect(ensureSessionConfig).toHaveBeenCalledWith({
      workerUrl: 'https://worker.example.test',
      slug: 'lit-session',
    });
  });

  it('builds each signed config write from the latest mutable config snapshot', async () => {
    let config = { slug: 'lit-session', revision: 1 };
    const signTypedAdminAction = jest.fn(async () => ({ address: '0xadmin', signature: '0xsig' }));
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
      getWorkerConfig: () => config,
      getAdminAddress: () => '0xadmin',
      signTypedAdminAction,
      fetchImpl,
    });
    config = { slug: 'lit-session', revision: 2 };

    await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'lit-session' });

    expect(signTypedAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ config: expect.objectContaining({ revision: 2 }) }) }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example.test/admin/set-config',
      expect.objectContaining({ body: expect.stringContaining('"revision":2') }),
    );
    // Only a Worker-canonical session has instructions for AI agents to clear.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['clears the instructions for AI agents a Worker config has', { agentInstructions: 'Join the open group.' }, ''],
    ['leaves out instructions for AI agents a Worker config lacks', {}, undefined],
  ])('%s when the config leaves them blank', async (_label, stored, expected) => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === 'POST' ? { ok: true } : { config: { slug: 'lit-session', ...stored } }),
    }));
    const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
      getWorkerConfig: () => ({
        slug: 'lit-session',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      getAdminAddress: () => '0xadmin',
      signTypedAdminAction: async () => ({ address: '0xadmin', signature: '0xsig' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'lit-session' });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://worker.example.test/session-config');
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).config.agentInstructions).toBe(expected);
  });

  // The sync /new makes after a deploy, onto what the Worker holds for the session.
  const synced = async (page: Record<string, unknown>, stored: Record<string, unknown>, features?: string[]) => {
    const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => {
        if (String(url).includes('/capabilities')) return { features };
        return init?.method === 'POST' ? { ok: true } : { config: { slug: 'card-session', ...stored } };
      },
    }));
    const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
      getWorkerConfig: () => ({
        slug: 'card-session',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        ...page,
      }),
      getAdminAddress: () => '0xadmin',
      signTypedAdminAction: async () => ({ address: '0xadmin', signature: '0xsig' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'card-session' });
    const [, init] = fetchImpl.mock.calls.find(([, sent]) => sent?.method === 'POST') || [];
    const { contextCardsEnabled, analysisCardEnabled } = JSON.parse(String(init?.body)).config;
    return { contextCardsEnabled, analysisCardEnabled };
  };
  const PUBLISHED = { workerCanonicalPublicationRevision: 'config:published' };
  const HAS_BOTH = ['context_cards_v1', 'analysis_card_v1'];

  it('never changes a published session’s card switches, though the /new draft says otherwise', async () => {
    // As the real session: the analysis card never turned on, and /new's box ticked as it always starts.
    expect(await synced({ analysisCardEnabled: true }, { ...PUBLISHED }, HAS_BOTH)).toEqual({});
    expect(await synced({ analysisCardEnabled: true }, { ...PUBLISHED, analysisCardEnabled: false }, HAS_BOTH)).toEqual(
      {
        analysisCardEnabled: false,
      },
    );
    // And Context cards an admin turned on in Settings stay on though the draft's box is unticked.
    expect(await synced({}, { ...PUBLISHED, contextCardsEnabled: true, analysisCardEnabled: true }, HAS_BOTH)).toEqual({
      contextCardsEnabled: true,
      analysisCardEnabled: true,
    });
    expect(await synced({ contextCardsEnabled: true }, { ...PUBLISHED }, HAS_BOTH)).toEqual({});
  });

  it('makes a session as the page says while it is still being made', async () => {
    // The first sync after a deploy: the analysis card on, as its box starts; Context cards as ticked.
    expect(await synced({ analysisCardEnabled: true }, {}, HAS_BOTH)).toEqual({ analysisCardEnabled: true });
    expect(await synced({ analysisCardEnabled: true, contextCardsEnabled: true }, {}, HAS_BOTH)).toEqual({
      contextCardsEnabled: true,
      analysisCardEnabled: true,
    });
    // A box unticked since an earlier attempt is turned off.
    expect(await synced({}, { contextCardsEnabled: true, analysisCardEnabled: true }, HAS_BOTH)).toEqual({
      contextCardsEnabled: false,
      analysisCardEnabled: false,
    });
    expect(await synced({}, {}, HAS_BOTH)).toEqual({});
  });

  it('sends Context cards on only to a Worker that says it keeps them', async () => {
    const save = async (capabilities: () => unknown) => {
      const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes('/capabilities')) return capabilities();
        return { ok: true, status: 200, json: async () => (init?.method === 'POST' ? { ok: true } : { config: {} }) };
      });
      const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
        getWorkerConfig: () => ({
          slug: 'lit-session',
          contextCardsEnabled: true,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        }),
        getAdminAddress: () => '0xadmin',
        signTypedAdminAction: async () => ({ address: '0xadmin', signature: '0xsig' }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const outcome = await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'lit-session' }).then(
        () => 'saved',
        (error: Error) => error.message,
      );
      const posts = fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST');
      return { outcome, sent: posts.map(([, init]) => JSON.parse(String(init?.body)).config.contextCardsEnabled) };
    };
    const answers = (features: string[]) => () => ({ ok: true, status: 200, json: async () => ({ features }) });

    expect(await save(answers(['worker_groups', 'context_cards_v1']))).toEqual({ outcome: 'saved', sent: [true] });
    // An older Worker, and one from before capabilities, are never sent the setting.
    const tooOld = expect.stringContaining('too old to keep Context cards');
    expect(await save(answers(['worker_groups']))).toEqual({ outcome: tooOld, sent: [] });
    expect(await save(() => ({ ok: false, status: 404, json: async () => ({}) }))).toEqual({
      outcome: tooOld,
      sent: [],
    });
    // Nor is a Worker that could not be asked.
    const unchecked = expect.stringContaining('be checked for Context cards');
    expect(await save(() => ({ ok: false, status: 503, json: async () => ({}) }))).toEqual({
      outcome: unchecked,
      sent: [],
    });
    expect(
      await save(() => {
        throw new Error('offline');
      }),
    ).toEqual({ outcome: unchecked, sent: [] });
  });

  it('keeps the AI daily limit the Worker stores, which /new has no field for', async () => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () =>
        init?.method === 'POST'
          ? { ok: true }
          : { config: { slug: 'lit-session', limits: { perWalletPerDay: 25, aiPerWalletPerDay: 40 } } },
    }));
    const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
      getWorkerConfig: () => ({
        slug: 'lit-session',
        agentInstructions: '',
        sessionAgent: null,
        limits: { perWalletPerDay: 100 },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      getAdminAddress: () => '0xadmin',
      signTypedAdminAction: async () => ({ address: '0xadmin', signature: '0xsig' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'lit-session' });

    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).config.limits).toEqual({
      perWalletPerDay: 100,
      aiPerWalletPerDay: 40,
    });
  });

  it('sends the analysis card on only to a Worker that has it, and makes the session without it otherwise', async () => {
    const save = async (capabilities: () => unknown) => {
      const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes('/capabilities')) return capabilities();
        return { ok: true, status: 200, json: async () => (init?.method === 'POST' ? { ok: true } : { config: {} }) };
      });
      const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
        getWorkerConfig: () => ({
          slug: 'card-session',
          analysisCardEnabled: true,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        }),
        getAdminAddress: () => '0xadmin',
        signTypedAdminAction: async () => ({ address: '0xadmin', signature: '0xsig' }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const outcome = await ensureSessionConfig({
        workerUrl: 'https://worker.example.test',
        slug: 'card-session',
      }).then(
        () => 'saved',
        (error: Error) => error.message,
      );
      const posts = fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST');
      return {
        outcome,
        sent: posts.map(([, init]) => JSON.parse(String(init?.body)).config.analysisCardEnabled ?? 'left out'),
      };
    };
    const answers = (features: string[]) => () => ({ ok: true, status: 200, json: async () => ({ features }) });

    expect(await save(answers(['worker_groups', 'analysis_card_v1']))).toEqual({ outcome: 'saved', sent: [true] });
    // The box starts ticked, so an older Worker, or one from before capabilities, must not stop Create: the
    // session is made without the card, and the setting it would refuse is never sent.
    expect(await save(answers(['worker_groups']))).toEqual({ outcome: 'saved', sent: ['left out'] });
    expect(await save(() => ({ ok: false, status: 404, json: async () => ({}) }))).toEqual({
      outcome: 'saved',
      sent: ['left out'],
    });
    // A Worker that could not be asked is sent nothing.
    const unchecked = expect.stringContaining('be checked for the Analysis card');
    expect(await save(() => ({ ok: false, status: 503, json: async () => ({}) }))).toEqual({
      outcome: unchecked,
      sent: [],
    });
    expect(
      await save(() => {
        throw new Error('offline');
      }),
    ).toEqual({ outcome: unchecked, sent: [] });
  });
});
