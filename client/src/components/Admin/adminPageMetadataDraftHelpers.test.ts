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
});
