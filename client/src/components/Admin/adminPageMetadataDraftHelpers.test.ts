import {
  applyAdminMetadataDraft,
  buildAdminMetadataDraft,
  buildEditableSessionMetadataPayload,
  parseChainIdInput,
  shouldShowInlineResourceSummary,
} from './adminPageMetadataDraftHelpers';

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
});
