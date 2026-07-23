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
    ).toEqual(
      expect.objectContaining({
        sessionName: 'Cached Session',
        corsWorkerUrl: '',
        embeddedDeployHelperEnabled: true,
      }),
    );

    expect(
      buildSessionWizardInitialDraftFromCache({
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
      }),
    ).toEqual(
      expect.objectContaining({
        corsWorkerUrl: 'https://cached.example/worker',
        embeddedDeployHelperEnabled: false,
      }),
    );
  });

  it('migrates cached Cloudflare Lit storage drafts into a session mode profile', () => {
    const normalized = buildSessionWizardInitialDraftFromCache({
      cachedWizard: {
        draft: {
          sessionName: 'Cached Lit Cloudflare Session',
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { mode: 'lit_encrypted' },
          },
        },
      },
    });

    expect(normalized.sessionModeProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        storage: expect.objectContaining({ backend: 'cloudflare' }),
        encryption: { mode: 'lit' },
      }),
    );
    expect(normalized.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: expect.objectContaining({ mode: 'lit_encrypted' }),
        sbtGatedAccess: expect.objectContaining({
          litRequired: 'required_for_cloudflare_payload_encryption',
        }),
      }),
    );
  });

  it('applies registry-chain contract defaults and worker RPC fallbacks without mutating the draft', () => {
    const draft = {
      networkChainId: 84532,
      contracts: {
        surveys: { address: '', chainId: 84532 },
        custom: { address: '0xCustom', chainId: 84532 },
      },
      rpc: {
        providers: {
          path: { rpcUrl: '' },
        },
      },
      faucet: {},
    };

    const next = applySessionWizardRegistryChainDraftDefaults({
      draft,
      chainId: 11155420,
      contractDefaults: {
        surveys: ' 0xSurveys ',
        sessionRegistry: '0xRegistry',
      },
      pathRpc: ' https://rpc.example ',
    });

    expect(next).toEqual(
      expect.objectContaining({
        networkChainId: 11155420,
        contracts: expect.objectContaining({
          surveys: { address: '0xSurveys', chainId: 11155420 },
          sessionRegistry: { address: '0xRegistry', chainId: 11155420 },
          custom: { address: '0xCustom', chainId: 11155420 },
        }),
        rpc: {
          provider: 'path',
          providers: {
            path: { rpcUrl: 'https://rpc.example' },
          },
        },
        faucet: { rpcUrl: 'https://rpc.example' },
      }),
    );
    expect(draft).toEqual({
      networkChainId: 84532,
      contracts: {
        surveys: { address: '', chainId: 84532 },
        custom: { address: '0xCustom', chainId: 84532 },
      },
      rpc: {
        providers: {
          path: { rpcUrl: '' },
        },
      },
      faucet: {},
    });
  });

  it('preserves existing RPC and faucet values when registry-chain fallbacks are applied', () => {
    const next = applySessionWizardRegistryChainDraftDefaults({
      draft: {
        rpc: {
          provider: 'custom',
          providers: {
            path: { rpcUrl: 'https://existing-rpc.example' },
          },
        },
        faucet: { rpcUrl: 'https://existing-faucet.example' },
      },
      chainId: 11155420,
      contractDefaults: {},
      pathRpc: 'https://fallback-rpc.example',
    });

    expect(next.rpc).toEqual({
      provider: 'custom',
      providers: {
        path: { rpcUrl: 'https://existing-rpc.example' },
      },
    });
    expect(next.faucet).toEqual({ rpcUrl: 'https://existing-faucet.example' });
  });

  it('synchronizes chain-relevant profiles without adding chain capability to pure Worker profiles', () => {
    const pureWorker = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const workerNext = applySessionWizardRegistryChainDraftDefaults({
      draft: {
        networkChainId: 11155420,
        sessionModeProfile: pureWorker,
      },
      chainId: 84532,
    });

    expect(workerNext.networkChainId).toBe(84532);
    expect(workerNext.sessionModeProfile).toEqual(pureWorker);
    expect(workerNext.sessionModeProfile.evm.registryChainId).toBeNull();

    const registry = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const registryNext = applySessionWizardRegistryChainDraftDefaults({
      draft: { sessionModeProfile: registry },
      chainId: 84532,
    });

    expect(registryNext.sessionModeProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        evm: { registryChainId: 84532 },
      }),
    );
  });

  it('keeps explicit Worker SBT access rules on the selected wizard network', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = 11155420;
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x00000000000000000000000000000000000000aa',
          anyOrAll: 'any',
        },
      ],
    };

    const next = applySessionWizardRegistryChainDraftDefaults({
      draft: { sessionModeProfile: profile },
      chainId: 84532,
    });

    expect(next.sessionModeProfile.evm.registryChainId).toBe(84532);
    expect(next.sessionModeProfile.encryption.accessConditions.conditions[0].chainId).toBe(84532);
  });

  it('limits Worker hybrid chain defaults to RPC without adding registry or faucet capabilities', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = 11155420;
    profile.encryption = { mode: 'lit' };
    profile.storage.payloadAccessControl = {
      ...profile.storage.payloadAccessControl,
      encryption: 'lit',
    };
    const next = applySessionWizardRegistryChainDraftDefaults({
      draft: {
        sessionModeProfile: profile,
      },
      chainId: 84532,
      contractDefaults: {
        sessionRegistry: '0xRegistry',
      },
      pathRpc: 'https://rpc.example',
      includeContracts: false,
      includeFaucet: false,
    });

    expect(next.sessionModeProfile.evm.registryChainId).toBe(84532);
    expect(next.rpc).toEqual({
      provider: 'path',
      providers: {
        path: { rpcUrl: 'https://rpc.example' },
      },
    });
    expect(next.contracts).toBeUndefined();
    expect(next.faucet).toBeUndefined();
  });

  it('builds cache write payloads with public Worker config only and durable pending draft isolation', () => {
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

    expect(payload).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        draft: { sessionName: 'Draft' },
        pendingSbtDrafts: [],
        persistWorkerSecrets: false,
        workerSecrets: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: 'group-1',
          litPkpId: 'pkp-1',
          litActionCid: 'bafy-action-1',
        },
        deployForm: {
          workerName: 'worker',
          adminAddress: '0xAdmin',
          accountId: 'account',
          bundleUrl: 'https://bundle.example/worker.js',
        },
      }),
    );
    expect(payload.deployForm.apiToken).toBeUndefined();
    expect(payload.deployForm.accountId).toBeUndefined();
    expect(payload.workerRequirementProof).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('cf-secret');
    expect(JSON.stringify(payload)).not.toContain('"apiToken":"secret"');
  });

  it('keeps multi-gate resource selections in the cache write payload', () => {
    const resourceGateMap = {
      ai: ['gate-1', 'gate-2'],
      rpc: 'gate-2',
    };

    const payload = buildSessionWizardCacheWritePayload({
      resourceGateMap,
    });

    expect(payload.resourceGateMap).toBe(resourceGateMap);
  });

  it('never serializes worker credentials even when legacy persistence input is enabled', () => {
    const workerSecrets = {
      apiToken: 'secret',
      accountId: 'account',
    };

    const payload = buildSessionWizardCacheWritePayload({
      effectivePersistWorkerSecrets: true,
      workerSecrets,
    });

    expect(payload.persistWorkerSecrets).toBe(false);
    expect(payload.workerSecrets).toEqual({});
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(JSON.stringify(payload)).not.toContain('account');
  });
});
