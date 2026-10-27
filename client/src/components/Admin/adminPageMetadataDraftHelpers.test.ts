import {
  applyAdminMetadataDraft,
  buildAdminMetadataDraft,
  buildEditableSessionMetadataPayload,
  buildWorkerCanonicalMetadataConfigPatch,
  parseChainIdInput,
  shouldShowInlineResourceSummary,
} from './adminPageMetadataDraftHelpers';
import { withoutNewInterviewDefaults } from '../../utilities/session/interviewModeWrite';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  DEFAULT_RESULTS_ANALYSIS_SETTINGS,
  resolveResultsAnalysisSectionKeys,
} from '../../../../shared/resultsAnalysisSettings.mjs';

describe('adminPageMetadataDraftHelpers', () => {
  it.each([true, false])('round-trips the interview research-sharing default (%s)', (shareDraftChangesByDefault) => {
    const metadata = { interviewMode: { shareDraftChangesByDefault } };
    const draft = buildAdminMetadataDraft(metadata);
    const applied = applyAdminMetadataDraft(metadata, draft);
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata: applied,
      slug: 'research-default',
      adminAddress: '0x00000000000000000000000000000000000000aa',
    });
    expect(draft.interviewMode.shareDraftChangesByDefault).toBe(shareDraftChangesByDefault);
    // An off default is left out so Workers before 0.7.0, which reject unknown keys, still accept the save.
    expect(Object.hasOwn(applied.interviewMode, 'shareDraftChangesByDefault')).toBe(shareDraftChangesByDefault);
    expect(Object.hasOwn(patch.interviewMode as object, 'shareDraftChangesByDefault')).toBe(shareDraftChangesByDefault);
    if (shareDraftChangesByDefault)
      expect(patch.interviewMode).toEqual(expect.objectContaining({ shareDraftChangesByDefault }));
  });

  it('saves only interview keys that Workers before 0.7.0 accept while research sharing is off', () => {
    // The 0.6.14 Session Worker allowlist for interviewMode keys.
    const legacyKeys = [
      'enabled',
      'provider',
      'realtimeModel',
      'openingMode',
      'openingPrompt',
      'steeringPrompt',
      'autoRegenerate',
      'questionGrowthPercent',
      'followNewQuestions',
      'suggestQuestions',
      'allowManualRefresh',
    ];
    const draft = buildAdminMetadataDraft({ interviewMode: { enabled: true, openingMode: 'auto' } });
    draft.interviewMode = { ...draft.interviewMode, shareDraftChangesByDefault: false };
    const applied = applyAdminMetadataDraft({}, draft);
    expect(Object.keys(applied.interviewMode).filter((key) => !legacyKeys.includes(key))).toEqual([]);
  });

  it.each(['minimal', 'full'] as const)('round-trips the interview research detail (%s)', (researchDetail) => {
    const metadata = { interviewMode: { researchDetail } };
    const draft = buildAdminMetadataDraft(metadata);
    const applied = applyAdminMetadataDraft(metadata, draft);
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata: applied,
      slug: 'research-detail',
      adminAddress: '0x00000000000000000000000000000000000000aa',
    });
    expect(draft.interviewMode.researchDetail).toBe(researchDetail);
    // Minimal is the default, left out so older Session Workers still accept the save.
    expect((patch.interviewMode as Record<string, unknown>).researchDetail).toBe(
      researchDetail === 'full' ? 'full' : undefined,
    );
  });

  it('round-trips the share of hidden AI drafts', () => {
    const metadata = { interviewMode: { hiddenDraftShare: 0.2 } };
    const draft = buildAdminMetadataDraft(metadata);
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata: applyAdminMetadataDraft(metadata, draft),
      slug: 'hidden-drafts',
      adminAddress: '0x00000000000000000000000000000000000000aa',
    });
    expect(draft.interviewMode.hiddenDraftShare).toBe(0.2);
    expect(patch.interviewMode).toEqual(expect.objectContaining({ hiddenDraftShare: 0.2 }));
  });

  it('round-trips editable metadata and preserves contract chain fallback', () => {
    const draft = buildAdminMetadataDraft({
      networkChainId: 11155420,
      contracts: {
        surveys: { address: '0x0000000000000000000000000000000000000001' },
      },
      HIGHLIGHTED_QUESTION_IDS: ['q1', 'Q1', 'q2'],
      ai: {
        models: {
          fast: { provider: 'openrouter', model: 'openrouter/fast' },
        },
      },
    });

    const applied = applyAdminMetadataDraft(
      { networkChainId: 11155420 },
      {
        ...draft,
        contractSurveysAddress: '0x0000000000000000000000000000000000000002',
      },
    );

    expect(applied.contracts.surveys).toEqual({
      address: '0x0000000000000000000000000000000000000002',
      chainId: 11155420,
    });
    expect(applied.HIGHLIGHTED_QUESTION_IDS).toEqual(['q1', 'q2']);
    expect(applied.ai.models.fast).toEqual({
      provider: 'openrouter',
      model: 'openrouter/fast',
    });
  });

  it('round-trips results analysis settings through editable metadata and worker patches', () => {
    const sourceMetadata = {
      resultsAnalysis: {
        version: 1,
        generationMode: 'both',
        views: { circles: true, breakdown: false, riskMatrix: true },
        autoAfter: { threshold: 12, unit: 'distinctParticipants' },
        inputScope: 'submitted',
        publication: 'latest_success_visible',
      },
    };
    const draft = buildAdminMetadataDraft(sourceMetadata);
    const applied = applyAdminMetadataDraft(sourceMetadata, draft);
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata: applied,
      slug: 'results-session',
      adminAddress: '0x00000000000000000000000000000000000000aa',
    });

    expect(draft.resultsAnalysis).toEqual(sourceMetadata.resultsAnalysis);
    expect(applied.resultsAnalysis).toEqual(sourceMetadata.resultsAnalysis);
    expect(patch.resultsAnalysis).toEqual(sourceMetadata.resultsAnalysis);
    expect(resolveResultsAnalysisSectionKeys(applied.resultsAnalysis)).toEqual(['riskMatrix', 'argumentMap', 'atlas']);
  });

  it('preserves existing results analysis settings during unrelated metadata edits', () => {
    const existingResultsAnalysis = {
      version: 1,
      generationMode: 'automatic',
      views: { circles: true, breakdown: true, riskMatrix: false },
      autoAfter: { threshold: 18, unit: 'distinctParticipants' },
      inputScope: 'submitted',
      publication: 'latest_success_visible',
    };
    const payload = buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'preserve-results-analysis',
        sessionName: 'Original title',
        defaultTags: 'old',
        blockLimits: { start: 100 },
        resultsAnalysis: existingResultsAnalysis,
      },
      blockLimits: { start: 100 },
      advancedDraft: {
        ...buildAdminMetadataDraft({
          defaultTags: 'old',
          resultsAnalysis: existingResultsAnalysis,
        }),
        defaultTags: 'new tag',
      },
    });

    expect(payload.defaultTags).toBe('new tag');
    expect(payload.resultsAnalysis).toEqual(existingResultsAnalysis);
  });

  it('defaults missing results analysis settings without enabling automatic generation', () => {
    const draft = buildAdminMetadataDraft({});
    expect(draft.resultsAnalysis).toEqual(DEFAULT_RESULTS_ANALYSIS_SETTINGS);
    expect(applyAdminMetadataDraft({}, draft).resultsAnalysis.generationMode).toBe('manual');
  });

  it('rejects invalid results analysis settings before admin normalization can mask them', () => {
    const sourceInvalid = {
      generationMode: 'automatic',
      autoAfter: { threshold: 0, unit: 'distinctParticipants' },
    };
    expect(buildAdminMetadataDraft({ resultsAnalysis: sourceInvalid }).resultsAnalysis).toBe(sourceInvalid);
    const draft = {
      ...buildAdminMetadataDraft({}),
      resultsAnalysis: {
        version: 1,
        generationMode: 'automatic',
        views: { circles: true, breakdown: true, riskMatrix: true },
        autoAfter: { threshold: 0, unit: 'distinctParticipants' },
        inputScope: 'submitted',
        publication: 'latest_success_visible',
      },
    };

    expect(() => applyAdminMetadataDraft({}, draft)).toThrow('Session results analysis settings are invalid.');
  });

  it('builds sanitized editable payloads and resource summary state', () => {
    const payload = buildEditableSessionMetadataPayload({
      sessionConfig: {
        blockLimits: { start: 123, end: 456 },
        autoFeatureSBTsWithFeaturedSbtTags: true,
        sponsoredKeys: { secret: 'redacted' },
      },
    });

    expect(payload.blockLimits).toEqual({ start: 123, end: 456 });
    expect(payload.autoFeatureSBTsBySessionSlug).toBe(true);
    expect(payload.autoFeatureSBTsWithFeaturedSbtTags).toBeUndefined();
    expect(payload.sponsoredKeys).toBeUndefined();

    expect(parseChainIdInput('OP Sepolia (11155420)')).toBe(11155420);
    expect(shouldShowInlineResourceSummary({ display: '0.25 ETH' })).toBe(true);
    expect(shouldShowInlineResourceSummary({ display: '0 ETH' })).toBe(false);
    expect(shouldShowInlineResourceSummary({ manualRefreshAvailable: true })).toBe(true);
  });

  it('does not inject default AI metadata when the source has no ai field and draft is untouched', () => {
    const sourceMetadata = {
      slug: 'legacy-session',
      sessionName: 'Legacy Session',
      defaultTags: 'governance',
      blockLimits: { start: 100, end: 200 },
    };
    const draft = buildAdminMetadataDraft(sourceMetadata);
    const result = applyAdminMetadataDraft(sourceMetadata, draft);

    expect(result.ai).toBeUndefined();
    expect(result.defaultTags).toBe('governance');
    expect(result.blockLimits).toEqual({ start: 100, end: 200 });
  });

  it('applies AI metadata when the admin changes a model field even if source had no ai', () => {
    const sourceMetadata = { slug: 'legacy-session' };
    const draft = buildAdminMetadataDraft(sourceMetadata);
    draft.aiThinkingProvider = 'anthropic';
    draft.aiThinkingModel = 'claude-3-7-sonnet';

    const result = applyAdminMetadataDraft(sourceMetadata, draft);

    expect(result.ai).toBeDefined();
    expect(result.ai.models.thinking.provider).toBe('anthropic');
    expect(result.ai.models.thinking.model).toBe('claude-3-7-sonnet');
  });

  it('preserves unknown contract keys through metadata save round-trip', () => {
    const sessionConfig = {
      slug: 'edge',
      networkChainId: 84532,
      blockLimits: { start: 100 },
      contracts: {
        surveys: { address: '0x111', chainId: 84532 },
        xp: { address: '0x999', chainId: 84532 },
        governance: { address: '0xabc', chainId: 84532 },
      },
    };

    const result = buildEditableSessionMetadataPayload({
      sessionConfig,
      blockLimits: sessionConfig.blockLimits,
    });

    expect(result.contracts.surveys).toEqual({ address: '0x111', chainId: 84532 });
    expect(result.contracts.xp).toEqual({ address: '0x999', chainId: 84532 });
    expect(result.contracts.governance).toEqual({ address: '0xabc', chainId: 84532 });
  });

  it('builds a revision-free worker metadata patch without requiring an EVM block window', () => {
    const metadata = buildEditableSessionMetadataPayload({
      sessionConfig: {
        sessionId: '0x1234567890abcdef1234567890abcdef',
        configRevision: 'published-revision',
        workerCanonicalPublicationRevision: 'published-revision',
        corsWorkerUrl: 'https://worker.example.test',
        registryChainId: 84532,
        defaultTags: 'worker, canonical',
      },
      requireBlockLimits: false,
    });
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata,
      slug: ' Worker Metadata!? ',
      adminAddress: ' 0x00000000000000000000000000000000000000aa ',
    });

    expect(patch).toEqual(
      expect.objectContaining({
        slug: 'workermetadata',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        defaultTags: 'worker, canonical',
      }),
    );
    expect(patch).not.toHaveProperty('blockLimits');
    expect(patch).not.toHaveProperty('sessionId');
    expect(patch).not.toHaveProperty('configRevision');
    expect(patch).not.toHaveProperty('workerCanonicalPublicationRevision');
    expect(patch).not.toHaveProperty('corsWorkerUrl');
    expect(patch).not.toHaveProperty('registryChainId');
  });

  it('does not require or synthesize chain defaults for a pure worker-canonical save', () => {
    const metadata = buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'worker-session',
        sessionName: 'Worker Session',
        autoFeatureSBTsBySessionSlug: true,
        blockLimits: { start: 123 },
        contracts: {
          sessionRegistry: {
            address: '0x0000000000000000000000000000000000000001',
            chainId: 11155420,
          },
        },
        defaultFeaturedSBTs: ['0x0000000000000000000000000000000000000002'],
        defaultSbtTags: 'legacy',
        faucet: { amountEth: '0.01' },
        registryChainId: 11155420,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      },
      advancedDraft: {
        ...buildAdminMetadataDraft({}),
        defaultTags: 'worker',
        defaultSbtTags: 'must-not-save',
        contractSurveysAddress: '0x0000000000000000000000000000000000000001',
        faucetAmountEth: '0.01',
      },
      requireBlockLimits: false,
      includeChainFields: false,
    });
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata,
      slug: 'worker-session',
      adminAddress: '0x00000000000000000000000000000000000000aa',
      includeChainFields: false,
    });

    expect(metadata.defaultTags).toBe('worker');
    [
      'autoFeatureSBTsBySessionSlug',
      'blockLimits',
      'contracts',
      'defaultSbtTags',
      'defaultFeaturedSBTs',
      'faucet',
      'networkChainId',
      'registryChainId',
    ].forEach((key) => expect(metadata).not.toHaveProperty(key));
    expect(patch).toEqual(
      expect.objectContaining({
        slug: 'worker-session',
        adminAddress: '0x00000000000000000000000000000000000000aa',
        defaultTags: 'worker',
      }),
    );
    [
      'autoFeatureSBTsBySessionSlug',
      'blockLimits',
      'contracts',
      'defaultSbtTags',
      'defaultFeaturedSBTs',
      'faucet',
    ].forEach((key) => expect(patch).not.toHaveProperty(key));
  });

  it('allowlists editor-owned worker metadata without replaying authority or runtime config', () => {
    const patch = buildWorkerCanonicalMetadataConfigPatch({
      metadata: {
        defaultTags: 'worker',
        ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
        contracts: { surveys: { address: '0x0000000000000000000000000000000000000001', chainId: 84532 } },
        blockLimits: { start: 123, end: null },
        faucet: {
          amountEth: '0.0002',
          balanceThresholdEth: '0.001',
          privateKey: 'must-not-copy',
          rpcUrl: 'https://rpc.example.test',
        },
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        storageProfile: { backend: 'cloudflare' },
        workerAuthority: { mode: 'worker_canonical' },
        networkChainId: 84532,
        allowOrigins: ['https://app.example.test'],
        limits: { perWalletPerDay: 3 },
        scopes: { ai: true },
        embeddedDeployHelperEnabled: true,
      },
      slug: 'worker',
      adminAddress: '0x00000000000000000000000000000000000000aa',
    });

    expect(patch).toEqual(
      expect.objectContaining({
        defaultTags: 'worker',
        ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
        contracts: { surveys: { address: '0x0000000000000000000000000000000000000001', chainId: 84532 } },
        blockLimits: { start: 123, end: null },
        faucet: { amountEth: '0.0002', balanceThresholdEth: '0.001' },
      }),
    );
    [
      'sessionModeProfile',
      'storageProfile',
      'workerAuthority',
      'networkChainId',
      'allowOrigins',
      'limits',
      'scopes',
      'embeddedDeployHelperEnabled',
    ].forEach((key) => expect(patch).not.toHaveProperty(key));
  });
});

it('persists Interview settings through the admin editor and Worker metadata patch', () => {
  const source = { interviewMode: { realtimeModel: 'gpt-live-1' } };
  const draft = buildAdminMetadataDraft(source);
  draft.interviewMode = {
    ...draft.interviewMode,
    openingMode: 'owner',
    openingPrompt: 'Which AI view is overlooked?',
    followNewQuestions: true,
    suggestQuestions: true,
    questionGrowthPercent: 30,
  };
  const metadata = applyAdminMetadataDraft(source, draft);
  const patch = buildWorkerCanonicalMetadataConfigPatch({ metadata, slug: 'demo', adminAddress: '0xabc' });
  expect(patch.interviewMode).toEqual(
    withoutNewInterviewDefaults({ ...draft.interviewMode, autoRegenerate: false, allowManualRefresh: true }),
  );
});

it('turns voice interviews back on when the fidelity switch does', () => {
  const source = { interviewModeEnabled: false, interviewMode: { enabled: false, realtimeModel: 'gpt-live-1' } };
  const draft = buildAdminMetadataDraft(source);
  // What the switch writes in /admin: the research settings, `enabled`, and the top-level switch.
  draft.interviewMode = {
    ...draft.interviewMode,
    shareDraftChangesByDefault: true,
    hiddenDraftShare: 0.2,
    showFidelityScore: true,
    enabled: true,
  };
  draft.interviewModeEnabled = true;
  const patch = buildWorkerCanonicalMetadataConfigPatch({
    metadata: applyAdminMetadataDraft(source, draft),
    slug: 'demo',
    adminAddress: '0xabc',
  });
  expect(patch.interviewModeEnabled).toBe(true);
  expect(patch.interviewMode).toEqual(
    expect.objectContaining({ enabled: true, shareDraftChangesByDefault: true, hiddenDraftShare: 0.2 }),
  );
  // A session that never set the top-level switch doesn't start sending it.
  const untouched = buildWorkerCanonicalMetadataConfigPatch({
    metadata: applyAdminMetadataDraft({}, buildAdminMetadataDraft({})),
    slug: 'demo',
    adminAddress: '0xabc',
  });
  expect(untouched).not.toHaveProperty('interviewModeEnabled');
});
