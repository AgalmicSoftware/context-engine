import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  buildSessionWizardWorkerRequirementProof,
  resolveSessionWizardWorkerSecretSelection,
  resolveSessionWizardWorkerRequirementReadiness,
} from './sessionWizardWorkerRequirementProof';

const workerUrl = 'https://deployed.example.test';
const sessionSlug = 'proof-session';
const sessionId = '0x123e4567e89b12d3a456426614174000';
const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
const ai = {
  models: {
    fast: { provider: 'openai' },
    thinking: { provider: 'openai' },
    transcription: { provider: 'openai' },
  },
};
const workerSecrets = { openaiKey: 'sk-verified-openai' };

const buildProof = () =>
  buildSessionWizardWorkerRequirementProof({
    workerUrl,
    sessionSlug,
    sessionId,
    sessionModeProfile: profile,
    sessionAi: ai,
    workerSecrets,
    requiredSecretFields: ['openaiKey'],
  });

const resolveReadiness = (overrides: Record<string, unknown> = {}) =>
  resolveSessionWizardWorkerRequirementReadiness({
    proof: buildProof(),
    workerUrl,
    sessionSlug,
    sessionId,
    sessionModeProfile: profile,
    sessionAi: ai,
    workerSecrets,
    workerSecretsEnabled: true,
    ...overrides,
  });

describe('sessionWizardWorkerRequirementProof', () => {
  it('selects a present faucet key only for profiles that expose transaction funding', () => {
    const decentralizedProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const secrets = {
      openaiKey: 'sk-verified-openai',
      faucetPrivateKey: 'faucet-test-secret',
    };

    expect(
      resolveSessionWizardWorkerSecretSelection({
        sessionModeProfile: decentralizedProfile,
        sessionAi: ai,
        workerSecrets: secrets,
      }),
    ).toEqual(
      expect.objectContaining({
        requiredSecretFields: ['openaiKey', 'faucetPrivateKey'],
        selectedSecrets: secrets,
      }),
    );
    expect(
      resolveSessionWizardWorkerSecretSelection({
        sessionModeProfile: decentralizedProfile,
        sessionAi: ai,
        workerSecrets: workerSecrets,
      }),
    ).toEqual(
      expect.objectContaining({
        requiredSecretFields: ['openaiKey'],
        selectedSecrets: workerSecrets,
      }),
    );
    expect(
      resolveSessionWizardWorkerSecretSelection({
        sessionModeProfile: profile,
        sessionAi: ai,
        workerSecrets: secrets,
        fallbackRequiredSecretFields: ['openaiKey', 'faucetPrivateKey'],
      }),
    ).toEqual(
      expect.objectContaining({
        requiredSecretFields: ['openaiKey'],
        selectedSecrets: workerSecrets,
      }),
    );
  });

  it('binds a selected faucet key into decentralized Worker readiness', () => {
    const decentralizedProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const decentralizedSecrets = {
      openaiKey: 'sk-verified-openai',
      faucetPrivateKey: 'faucet-test-secret',
    };
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: decentralizedProfile,
      sessionAi: ai,
      workerSecrets: decentralizedSecrets,
    });

    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: decentralizedProfile,
        sessionAi: ai,
        workerSecrets: decentralizedSecrets,
      }),
    ).toEqual(expect.objectContaining({ verified: true }));
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: decentralizedProfile,
        sessionAi: ai,
        workerSecrets: { openaiKey: decentralizedSecrets.openaiKey },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'secret-values-changed' }));
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: decentralizedProfile,
        sessionAi: ai,
        workerSecrets: { ...decentralizedSecrets, faucetPrivateKey: 'edited-faucet-test-secret' },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'secret-values-changed' }));
  });

  it('keeps an unchanged verified deployment requirement snapshot publish-ready', () => {
    expect(resolveReadiness()).toEqual(expect.objectContaining({ verified: true, reason: '' }));
  });

  it('invalidates readiness when a selected required secret value changes', () => {
    expect(resolveReadiness({ workerSecrets: { openaiKey: 'sk-edited-openai' } })).toEqual(
      expect.objectContaining({ verified: false, reason: 'secret-values-changed' }),
    );
  });

  it('invalidates readiness when the selected AI provider changes', () => {
    const anthropicAi = {
      models: {
        fast: { provider: 'anthropic' },
        thinking: { provider: 'anthropic' },
        transcription: { provider: 'anthropic' },
      },
    };
    expect(
      resolveReadiness({
        sessionAi: anthropicAi,
        workerSecrets: { anthropicKey: 'sk-ant-new' },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'requirements-changed' }));
  });

  it('invalidates readiness when provider assignments swap but the required secret set stays unchanged', () => {
    const mixedAi = {
      models: {
        fast: { provider: 'openai', model: 'gpt-5' },
        thinking: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
        transcription: { provider: 'openai', model: 'whisper-1' },
      },
    };
    const mixedSecrets = {
      openaiKey: 'sk-verified-openai',
      anthropicKey: 'sk-verified-anthropic',
    };
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: profile,
      sessionAi: mixedAi,
      workerSecrets: mixedSecrets,
      requiredSecretFields: ['openaiKey', 'anthropicKey'],
    });

    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: profile,
        sessionAi: {
          models: {
            fast: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
            thinking: { provider: 'openai', model: 'gpt-5' },
            transcription: { provider: 'openai', model: 'whisper-1' },
          },
        },
        workerSecrets: mixedSecrets,
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'requirements-changed' }));
  });

  it('invalidates readiness when a selected AI model changes under the same provider', () => {
    const modelAi = {
      models: {
        fast: { provider: 'openai', model: 'gpt-5' },
        thinking: { provider: 'openai', model: 'gpt-5' },
        transcription: { provider: 'openai', model: 'whisper-1' },
      },
    };
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: profile,
      sessionAi: modelAi,
      workerSecrets,
      requiredSecretFields: ['openaiKey'],
    });

    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: profile,
        sessionAi: {
          models: {
            ...modelAi.models,
            fast: { provider: 'openai', model: 'gpt-4o' },
          },
        },
        workerSecrets,
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'requirements-changed' }));
  });

  it('invalidates readiness when the normalized profile changes without changing broad requirements', () => {
    const editedProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    editedProfile.results = { ...editedProfile.results, visibility: 'private_admin' };

    expect(resolveReadiness({ sessionModeProfile: editedProfile })).toEqual(
      expect.objectContaining({ verified: false, reason: 'requirements-changed' }),
    );
  });

  it('invalidates readiness when the verified Worker allowlist changes', () => {
    const verifiedOrigins = ['https://app.example.test', 'https://admin.example.test'];
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: profile,
      sessionAi: ai,
      workerAllowOrigins: verifiedOrigins,
      workerSecrets,
      requiredSecretFields: ['openaiKey'],
    });

    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: profile,
        sessionAi: ai,
        workerAllowOrigins: [...verifiedOrigins].reverse(),
        workerSecrets,
      }),
    ).toEqual(expect.objectContaining({ verified: true }));
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: profile,
        sessionAi: ai,
        workerAllowOrigins: ['https://other.example.test'],
        workerSecrets,
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'requirements-changed' }));
  });

  it('invalidates readiness when the selected profile adds Lit and RPC requirements', () => {
    const litProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    litProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    litProfile.encryption = { mode: 'lit' };
    litProfile.evm.registryChainId = 11155420;
    litProfile.storage.payloadAccessControl = {
      ...litProfile.storage.payloadAccessControl!,
      encryption: 'lit',
    };
    expect(
      resolveReadiness({
        sessionModeProfile: litProfile,
        workerSecrets: {
          ...workerSecrets,
          customRpcUrl: 'https://rpc.example.test',
          litUsageApiKey: 'lit-new',
        },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'requirements-changed' }));
  });

  it.each([
    ['worker URL', { workerUrl: 'https://other-worker.example.test' }],
    ['session slug', { sessionSlug: 'other-session' }],
    ['session ID', { sessionId: '0x00000000000000000000000000000002' }],
  ])('invalidates readiness when the %s changes', (_label, override) => {
    expect(resolveReadiness(override)).toEqual(
      expect.objectContaining({ verified: false, reason: 'worker-identity-changed' }),
    );
  });

  it('binds unknown public config fields while ignoring only server-managed state', () => {
    const workerConfig = {
      slug: sessionSlug,
      adminAddress: '0x00000000000000000000000000000000000000aa',
      futureAuthorizationPolicy: { enabled: true },
    };
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: profile,
      sessionAi: ai,
      workerSecrets,
      workerConfig: {
        ...workerConfig,
        authzEpoch: 1,
        configRevision: 'draft-revision',
        workerCanonicalPublicationRevision: 'published-revision',
        workerGroupsBootstrap: { state: 'fresh_empty' },
      },
    });
    const readinessInput = {
      proof,
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: profile,
      sessionAi: ai,
      workerSecrets,
    };

    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        ...readinessInput,
        workerConfig: {
          ...workerConfig,
          authzEpoch: 9,
          configRevision: 'other-draft-revision',
          workerCanonicalPublicationRevision: 'other-published-revision',
          workerGroupsBootstrap: { state: 'migrated' },
        },
      }),
    ).toEqual(expect.objectContaining({ verified: true }));
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        ...readinessInput,
        workerConfig: {
          ...workerConfig,
          futureAuthorizationPolicy: { enabled: false },
        },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'worker-config-changed' }));
  });

  it('allows a live remote-managed bootstrap field to be absent but still rejects an override', () => {
    const litProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    litProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    litProfile.encryption = { mode: 'lit' };
    litProfile.evm.registryChainId = 11155420;
    litProfile.storage.payloadAccessControl = {
      ...litProfile.storage.payloadAccessControl!,
      encryption: 'lit',
    };
    const litSecrets = {
      openaiKey: 'sk-verified-openai',
      customRpcUrl: 'https://rpc.example.test',
      litAccountApiKey: 'lit-bootstrap-key',
    };
    const litRuntimeConfig = {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group-1',
      litPkpId: 'pkp-1',
      litActionCid: 'bafy-action-1',
    };
    const bootstrapProof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: litProfile,
      sessionAi: ai,
      workerSecrets: litSecrets,
      requiredSecretFields: ['openaiKey', 'litAccountApiKey', 'customRpcUrl'],
      remoteManagedSecretFields: ['litAccountApiKey'],
      litRuntimeConfig,
    });
    const readinessInput = {
      proof: bootstrapProof,
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: litProfile,
      sessionAi: ai,
      workerSecrets: {
        openaiKey: litSecrets.openaiKey,
        customRpcUrl: litSecrets.customRpcUrl,
        ...litRuntimeConfig,
      },
      workerSecretsEnabled: true,
    };

    expect(resolveSessionWizardWorkerRequirementReadiness(readinessInput).verified).toBe(true);
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        ...readinessInput,
        workerSecrets: {
          ...readinessInput.workerSecrets,
          litAccountApiKey: 'lit-bootstrap-override',
        },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'secret-values-changed' }));
  });

  it.each([
    ['missing', {}],
    [
      'edited',
      {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group-edited',
        litPkpId: 'pkp-1',
        litActionCid: 'bafy-action-1',
      },
    ],
  ])('invalidates a verified Lit runtime when its tuple is %s', (_label, currentLitRuntime) => {
    const litProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    litProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    litProfile.encryption = { mode: 'lit' };
    litProfile.evm.registryChainId = 11155420;
    litProfile.storage.payloadAccessControl = {
      ...litProfile.storage.payloadAccessControl!,
      encryption: 'lit',
    };
    const verifiedLitRuntime = {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group-1',
      litPkpId: 'pkp-1',
      litActionCid: 'bafy-action-1',
    };
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl,
      sessionSlug,
      sessionId,
      sessionModeProfile: litProfile,
      sessionAi: ai,
      workerSecrets: { ...workerSecrets, customRpcUrl: 'https://rpc.example.test', litUsageApiKey: 'lit-usage' },
      litRuntimeConfig: verifiedLitRuntime,
    });

    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        proof,
        workerUrl,
        sessionSlug,
        sessionId,
        sessionModeProfile: litProfile,
        sessionAi: ai,
        workerSecrets: {
          ...workerSecrets,
          customRpcUrl: 'https://rpc.example.test',
          litUsageApiKey: 'lit-usage',
          ...currentLitRuntime,
        },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'lit-runtime-changed' }));
  });
});
