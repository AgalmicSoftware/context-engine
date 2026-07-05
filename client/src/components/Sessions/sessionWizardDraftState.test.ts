import {
  buildSessionWizardCacheWritePayload,
  buildSessionWizardInitialDraftFromCache,
  buildSessionWizardDefaultTemplate,
  normalizeSessionWizardDraftShape,
} from './sessionWizardDraftState';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

describe('sessionWizardDraftState', () => {
  it('normalizes draft naming, ai fields, and fallback worker resources', () => {
    const normalized = normalizeSessionWizardDraftShape({
      sessionName: '  Draft Name  ',
      sessionInfo: '  Draft Info  ',
      sessionHeaderImg: ' https://example.test/header.png ',
      ai: {
        mode: 'openai',
        models: {},
      },
      rpc: {},
      faucet: {},
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        sessionName: 'Draft Name',
        sessionInfo: 'Draft Info',
        sessionHeader: 'https://example.test/header.png',
        autoFeatureSBTsBySessionSlug: true,
        embeddedDeployHelperEnabled: true,
      }),
    );
    expect(normalized.ai).toEqual(
      expect.objectContaining({
        models: expect.any(Object),
      }),
    );
    expect(normalized.rpc.providers.path.rpcUrl).toBeTruthy();
    expect(normalized.faucet.rpcUrl).toBeTruthy();
  });

  it('builds the default template with openai defaults and empty authoring fields', () => {
    const template = buildSessionWizardDefaultTemplate();
    expect(template).toEqual(
      expect.objectContaining({
        slug: '',
        sessionName: '',
        sessionInfo: '',
        corsWorkerUrl: '',
        defaultSbtTags: expect.any(String),
      }),
    );
    expect(template.ai).toEqual(
      expect.objectContaining({
        reasoningEffort: 'low',
        models: expect.objectContaining({
          fast: expect.objectContaining({ provider: 'openai', model: 'gpt-5' }),
          thinking: expect.objectContaining({ provider: 'openai', model: 'gpt-5' }),
        }),
      }),
    );
    expect(template.sessionModeProfile).toBeUndefined();
    expect(template.telegramOnly).toBeUndefined();
    expect(template.sessionMode).toBeUndefined();
    expect(template.telegramBridgeEnabled).toBeUndefined();
  });

  it('normalizes cached legacy Telegram drafts into the profile without rewriting legacy fields', () => {
    const normalized = normalizeSessionWizardDraftShape({
      sessionName: 'Legacy Telegram',
      telegramOnly: true,
      sessionMode: 'telegram_only',
      telegramBridgeEnabled: true,
      telegram: { only: true, mode: 'telegram_only' },
      storageProfile: { backend: 'cloudflare' },
    });

    expect(normalized.sessionModeProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        storage: expect.objectContaining({ backend: 'cloudflare' }),
        surfaces: expect.objectContaining({
          telegram: true,
          miniApp: true,
          web: true,
        }),
      }),
    );
    expect(normalized.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: expect.objectContaining({ mode: 'worker_sbt_gate' }),
      }),
    );
    expect(normalized.telegramOnly).toBeUndefined();
    expect(normalized.sessionMode).toBeUndefined();
    expect(normalized.telegramBridgeEnabled).toBeUndefined();
    expect(normalized.telegram).toBeUndefined();
  });

  it('merges cached wizard drafts with source defaults and normal-mode worker fallback', () => {
    const defaultTemplate = {
      slug: '',
      sessionName: '',
      corsWorkerUrl: 'https://hosted.example/default-worker.js',
      embeddedDeployHelperEnabled: false,
      rpc: {},
      faucet: {},
    };

    expect(
      buildSessionWizardInitialDraftFromCache({
        cachedWizard: {
          draft: {
            sessionName: 'Cached Session',
            corsWorkerUrl: 'https://cached.example/worker',
          },
          deployComplete: false,
        },
        defaultTemplate,
        normalModeSharedHostedWorkerEnabled: false,
        sourceEmbeddedDeployHelperDefault: true,
      }),
    }));
    expect(template.sessionModeProfile).toBeUndefined();
    expect(template.telegramOnly).toBeUndefined();
    expect(template.sessionMode).toBeUndefined();
    expect(template.telegramBridgeEnabled).toBeUndefined();
  });

  it('normalizes cached legacy Telegram drafts into the profile without rewriting legacy fields', () => {
    const normalized = normalizeSessionWizardDraftShape({
      sessionName: 'Legacy Telegram',
      telegramOnly: true,
      sessionMode: 'telegram_only',
      telegramBridgeEnabled: true,
      telegram: { only: true, mode: 'telegram_only' },
      storageProfile: { backend: 'cloudflare' },
    });

    expect(normalized.sessionModeProfile).toEqual(expect.objectContaining({
      preset: 'custom',
      authority: { mode: 'worker_canonical' },
      storage: { backend: 'cloudflare' },
      surfaces: expect.objectContaining({
        telegram: true,
        miniApp: true,
        web: true,
      }),
    }));
    expect(normalized.storageProfile).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      payloadAccessControl: expect.objectContaining({ mode: 'worker_sbt_gate' }),
    }));
    expect(normalized.telegramOnly).toBeUndefined();
    expect(normalized.sessionMode).toBeUndefined();
    expect(normalized.telegramBridgeEnabled).toBeUndefined();
    expect(normalized.telegram).toBeUndefined();
  });

  it('merges cached wizard drafts with source defaults and normal-mode worker fallback', () => {
    const defaultTemplate = {
      slug: '',
      sessionName: '',
      corsWorkerUrl: 'https://hosted.example/default-worker.js',
      embeddedDeployHelperEnabled: false,
      rpc: {},
      faucet: {},
    };

    expect(buildSessionWizardInitialDraftFromCache({
      cachedWizard: {
        draft: {
          sessionName: 'Cached Session',
          corsWorkerUrl: 'https://cached.example/worker',
        },
        deployComplete: false,
      },
      defaultTemplate,
      normalModeSharedHostedWorkerEnabled: false,
      sourceEmbeddedDeployHelperDefault: true,
    })).toEqual(expect.objectContaining({
      sessionName: 'Cached Session',
      corsWorkerUrl: '',
      embeddedDeployHelperEnabled: true,
    }));

    expect(buildSessionWizardInitialDraftFromCache({
      cachedWizard: {
        draft: {
          embeddedDeployHelperEnabled: false,
          corsWorkerUrl: 'https://cached.example/worker',
        },
        deployComplete: true,
      },
      defaultTemplate,
      normalModeSharedHostedWorkerEnabled: false,
      sourceEmbeddedDeployHelperDefault: true,
    })).toEqual(expect.objectContaining({
      corsWorkerUrl: 'https://cached.example/worker',
      embeddedDeployHelperEnabled: false,
    }));
  });

  it('builds cache write payloads with redacted worker secrets and durable pending draft isolation', () => {
    const payload = buildSessionWizardCacheWritePayload({
      sessionId: 'session-1',
      draft: { sessionName: 'Draft' },
      pendingSbtDrafts: [{ address: '0xpending' }],
      effectivePersistWorkerSecrets: false,
      workerSecrets: {
        apiToken: 'secret',
        optional: '',
      },
      deployForm: {
        apiToken: 'cf-secret',
        workerName: ' worker ',
        adminAddress: ' 0xAdmin ',
        accountId: ' account ',
        bundleUrl: ' https://bundle.example/worker.js ',
      },
    });

    expect(payload).toEqual(expect.objectContaining({
      sessionId: 'session-1',
      draft: { sessionName: 'Draft' },
      pendingSbtDrafts: [],
      persistWorkerSecrets: false,
      workerSecrets: {
        apiToken: '[redacted]',
        optional: '',
      },
      deployForm: {
        workerName: 'worker',
        adminAddress: '0xAdmin',
        accountId: 'account',
        bundleUrl: 'https://bundle.example/worker.js',
      },
    }));
    expect(payload.deployForm.apiToken).toBeUndefined();
  });

  it('keeps worker secrets only when local secret persistence is explicitly enabled', () => {
    const workerSecrets = {
      apiToken: 'secret',
      accountId: 'account',
    };

    const payload = buildSessionWizardCacheWritePayload({
      effectivePersistWorkerSecrets: true,
      workerSecrets,
    });

    expect(payload.persistWorkerSecrets).toBe(true);
    expect(payload.workerSecrets).toBe(workerSecrets);
  });
});
