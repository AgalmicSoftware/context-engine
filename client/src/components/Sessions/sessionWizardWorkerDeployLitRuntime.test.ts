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

  it.each([
    ['turns off Context cards a Worker config has on', { contextCardsEnabled: true }, false],
    ['leaves Context cards out for a Worker config without them', {}, undefined],
  ])('%s when the config leaves them out', async (_label, stored, expected) => {
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

    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).config.contextCardsEnabled).toBe(expected);
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

  it.each([
    ['turns the analysis card back on where a Worker config has it off', { analysisCardEnabled: false }, true],
    ['leaves the analysis card out for a Worker config without it', {}, undefined],
  ])('%s when the config leaves it out', async (_label, stored, expected) => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === 'POST' ? { ok: true } : { config: { slug: 'card-session', ...stored } }),
    }));
    const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
      getWorkerConfig: () => ({
        slug: 'card-session',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      getAdminAddress: () => '0xadmin',
      signTypedAdminAction: async () => ({ address: '0xadmin', signature: '0xsig' }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'card-session' });

    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).config.analysisCardEnabled).toBe(expected);
  });

  it('sends the analysis card off only to a Worker that has the card', async () => {
    const save = async (capabilities: () => unknown) => {
      const fetchImpl = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes('/capabilities')) return capabilities();
        return { ok: true, status: 200, json: async () => (init?.method === 'POST' ? { ok: true } : { config: {} }) };
      });
      const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
        getWorkerConfig: () => ({
          slug: 'card-session',
          analysisCardEnabled: false,
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
      return { outcome, sent: posts.map(([, init]) => JSON.parse(String(init?.body)).config.analysisCardEnabled) };
    };
    const answers = (features: string[]) => () => ({ ok: true, status: 200, json: async () => ({ features }) });

    expect(await save(answers(['worker_groups', 'analysis_card_v1']))).toEqual({ outcome: 'saved', sent: [false] });
    // An older Worker, and one from before capabilities, have no card and are never sent the setting.
    const tooOld = expect.stringContaining('too old to have the Analysis card');
    expect(await save(answers(['worker_groups']))).toEqual({ outcome: tooOld, sent: [] });
    expect(await save(() => ({ ok: false, status: 404, json: async () => ({}) }))).toEqual({
      outcome: tooOld,
      sent: [],
    });
    // Nor is a Worker that could not be asked.
    const unchecked = expect.stringContaining('be checked for the Analysis card');
    expect(await save(() => ({ ok: false, status: 503, json: async () => ({}) }))).toEqual({
      outcome: unchecked,
      sent: [],
    });
  });
});
