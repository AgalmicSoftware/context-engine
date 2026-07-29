import {
  applyAdminMetadataDraft,
  buildAdminMetadataDraft,
  buildEditableSessionMetadataPayload,
  buildWorkerCanonicalMetadataConfigPatch,
  parseChainIdInput,
  shouldShowInlineResourceSummary,
} from './adminPageMetadataDraftHelpers';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

describe('adminPageMetadataDraftHelpers', () => {
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
