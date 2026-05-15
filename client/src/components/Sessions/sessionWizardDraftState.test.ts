import {
  buildSessionWizardInitialDraftFromCache,
  buildSessionWizardDefaultTemplate,
  normalizeSessionWizardDraftShape,
} from './sessionWizardDraftState';

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

    expect(normalized).toEqual(expect.objectContaining({
      sessionName: 'Draft Name',
      sessionInfo: 'Draft Info',
      sessionHeader: 'https://example.test/header.png',
      autoFeatureSBTsBySessionSlug: true,
      embeddedDeployHelperEnabled: true,
    }));
    expect(normalized.ai).toEqual(expect.objectContaining({
      models: expect.any(Object),
    }));
    expect(normalized.rpc.providers.path.rpcUrl).toBeTruthy();
    expect(normalized.faucet.rpcUrl).toBeTruthy();
  });

  it('builds the default template with openai defaults and empty authoring fields', () => {
    const template = buildSessionWizardDefaultTemplate();
    expect(template).toEqual(expect.objectContaining({
      slug: '',
      sessionName: '',
      sessionInfo: '',
      corsWorkerUrl: '',
      defaultSbtTags: expect.any(String),
    }));
    expect(template.ai).toEqual(expect.objectContaining({
      reasoningEffort: 'low',
      models: expect.objectContaining({
        fast: expect.objectContaining({ provider: 'openai', model: 'gpt-5' }),
        thinking: expect.objectContaining({ provider: 'openai', model: 'gpt-5' }),
      }),
    }));
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
});
