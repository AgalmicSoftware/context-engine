/** @file AdminPage.test.tsx */
import { ethers } from 'ethers';
import AdminPage, { __adminPageTestUtils } from './AdminPage';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { getDefaultHttpRpc, getSessionRegistryAddress } from '../../variables/chains.js';

const DEFAULT_CONFIG_CHAIN_ID = DEFAULT_CHAIN_ID;
const adminPageTestUtils = __adminPageTestUtils as any;

describe('AdminPage', () => {
  it('exports a component', () => {
    expect(typeof AdminPage).toBe('function');
  });
  it('keeps the open-session display URL when group metadata is available without a selected config', () => {
    expect(
      adminPageTestUtils.getAdminSessionDisplayUrl({
        selectedSlug: 'debate',
        selectedConfig: null,
        groupMetadata: { slug: 'rxc', sessionName: 'Debate Session' },
      }),
    ).toBe('http://localhost/session/rxc');
    expect(
      adminPageTestUtils.getAdminSessionDisplayUrl({
        selectedSlug: '',
        selectedConfig: null,
        groupMetadata: { slug: '', sessionName: 'Context Engine' },
      }),
    ).toBe('http://localhost/session');

    expect(
      adminPageTestUtils.getAdminSessionDisplayUrl({
        selectedSlug: 'missing-session-slug',
        selectedConfig: null,
        groupMetadata: null,
      }),
    ).toBe('');
  });

  it('builds worker config payload with registry/rpc fallbacks from chain defaults', () => {
    const payload = adminPageTestUtils.buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'test-3',
        networkChainId: DEFAULT_CONFIG_CHAIN_ID,
        __registry: {
          chainId: DEFAULT_CONFIG_CHAIN_ID,
          adminAddress: '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119',
        },
      },
      account: '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119',
      fallbackChainId: DEFAULT_CONFIG_CHAIN_ID,
    });

    expect(payload.registryAddress).toBe(getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID));
    expect(payload.rpcUrl).toBe(getDefaultHttpRpc(DEFAULT_CONFIG_CHAIN_ID));
    expect(payload.rpcUrlsByChainId).toEqual(
      expect.objectContaining({
        [String(DEFAULT_CONFIG_CHAIN_ID)]: [getDefaultHttpRpc(DEFAULT_CONFIG_CHAIN_ID)],
      }),
    );
  });

  it('includes normalized blockLimits in worker config payload', () => {
    const payload = adminPageTestUtils.buildWorkerSessionConfigPayload({
      sessionConfig: {
        slug: 'test-8',
        networkChainId: 84532,
        blockLimits: {
          start: '12345',
          end: '13000',
        },
      },
      account: '0x7384f81c5505Cb11F69607e3b293AD7AAf1b1119',
      fallbackChainId: 84532,
    });

    expect(payload.blockLimits).toEqual({
      start: 12345,
      end: 13000,
    });
  });

  it('resolves the faucet resource RPC from the session chain instead of the registry chain', () => {
    const rpcConfig = adminPageTestUtils.getSessionReadRpcConfig({
      sessionConfig: {
        slug: 'test-resource-rpc',
        networkChainId: 8453,
        __registry: {
          chainId: 84532,
          registryChainId: 84532,
        },
        rpcUrlsByChainId: {
          8453: ['https://base-mainnet.example'],
          84532: ['https://base-sepolia.example'],
        },
      },
      fallbackChainId: 84532,
    });

    expect(rpcConfig).toEqual({
      chainId: 8453,
      rpcUrl: 'https://base-mainnet.example',
    });
  });

  it('falls back to the first non-empty rpcUrlsByChainId map after sanitization', () => {
    const rpcConfig = adminPageTestUtils.getSessionReadRpcConfig({
      sessionConfig: {
        slug: 'test-resource-rpc-fallback',
        networkChainId: 8453,
        rpc: {
          providers: {
            path: {
              rpcUrlsByChainId: {},
            },
          },
          rpcUrlsByChainId: {
            8453: ['https://base-mainnet-root.example'],
          },
        },
        rpcUrlsByChainId: {
          8453: ['https://base-mainnet-config.example'],
        },
      },
      fallbackChainId: 84532,
    });

    expect(rpcConfig).toEqual({
      chainId: 8453,
      rpcUrl: 'https://base-mainnet-root.example',
    });
  });

  it('builds editable session metadata payload with fallback start and strips registry-only fields', () => {
    const payload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-9',
        sessionName: ' Test 9 ',
        blockLimits: {},
        sponsoredKeys: { ai: true },
        sponsored: { defaultGateId: 'gate-1' },
        __registry: {
          metadataURI: 'ar://old',
        },
      },
      blockLimits: { start: '', end: '' },
      fallbackStart: 7654321,
    });

    expect(payload).toEqual(
      expect.objectContaining({
        slug: 'test-9',
        sessionName: 'Test 9',
        blockLimits: {
          start: 7654321,
          end: null,
        },
      }),
    );
    expect(payload.__registry).toBeUndefined();
    expect(payload.sponsoredKeys).toBeUndefined();
    expect(payload.sponsored).toBeUndefined();
  });

  it('applies an admin metadata auto-feature override only when requested', () => {
    const basePayload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-10',
        blockLimits: { start: 12345 },
      },
    });
    const legacyPayload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-10',
        blockLimits: { start: 12345 },
        autoFeatureSBTsWithFeaturedSbtTags: false,
      },
    });
    const precedencePayload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-10',
        blockLimits: { start: 12345 },
        autoFeatureSBTsBySessionSlug: true,
        autoFeatureSBTsWithFeaturedSbtTags: false,
      },
    });
    const overriddenPayload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-10',
        blockLimits: { start: 12345 },
        autoFeatureSBTsWithFeaturedSbtTags: false,
      },
      autoFeatureSBTsBySessionSlug: true,
      hasAutoFeatureOverride: true,
    });

    expect(basePayload).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
    expect(basePayload).not.toHaveProperty('autoFeatureSBTsBySessionSlug');
    expect(legacyPayload.autoFeatureSBTsBySessionSlug).toBe(false);
    expect(legacyPayload).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
    expect(precedencePayload.autoFeatureSBTsBySessionSlug).toBe(true);
    expect(precedencePayload).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
    expect(overriddenPayload.autoFeatureSBTsBySessionSlug).toBe(true);
    expect(overriddenPayload).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
  });

  it('builds admin metadata drafts from existing config values', () => {
    const draft = adminPageTestUtils.buildAdminMetadataDraft({
      defaultTags: 'alpha, beta',
      defaultFilterState: { sort: 'recent' },
      defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000aa'],
      HIGHLIGHTED_QUESTION_IDS: ['q1', 'q2'],
      faucet: {
        amountEth: '0.0002',
      },
      ai: {
        models: {
          fast: { provider: 'openai', model: 'gpt-4o-mini' },
          thinking: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
          transcription: { provider: 'openai', model: 'whisper-1' },
        },
      },
    });

    expect(draft).toEqual(
      expect.objectContaining({
        defaultTags: 'alpha, beta',
        defaultFilterState: '{\n  "sort": "recent"\n}',
        highlightedQuestionIds: 'q1\nq2',
        faucetAmountEth: '0.0002',
        aiFastProvider: 'openai',
        aiFastModel: 'gpt-4o-mini',
        aiThinkingProvider: 'anthropic',
        aiThinkingModel: 'claude-3-7-sonnet',
        aiTranscriptionProvider: 'openai',
        aiTranscriptionModel: 'whisper-1',
      }),
    );
    const expectedFeatured = ethers.utils.getAddress('0x00000000000000000000000000000000000000aa');
    expect(draft.defaultFeaturedSBTs).toEqual([expect.objectContaining({ address: expectedFeatured })]);
  });

  it('defaults admin AI metadata drafts to GPT-5 when metadata is missing AI settings', () => {
    const draft = adminPageTestUtils.buildAdminMetadataDraft({});

    expect(draft.aiFastProvider).toBe('openai');
    expect(draft.aiFastModel).toBe('gpt-5');
    expect(draft.aiThinkingProvider).toBe('openai');
    expect(draft.aiThinkingModel).toBe('gpt-5');
    expect(draft.aiTranscriptionProvider).toBe('openai');
    expect(draft.aiTranscriptionModel).toBe('whisper-1');
  });

  it('preserves legacy AI fields when building and applying admin metadata drafts', () => {
    const draft = adminPageTestUtils.buildAdminMetadataDraft({
      ai: {
        mode: 'openai',
        model: 'gpt-4',
        provider: 'openai',
      },
    });

    expect(draft.aiFastProvider).toBe('openai');
    expect(draft.aiFastModel).toBe('gpt-4');

    const applied = adminPageTestUtils.applyAdminMetadataDraft(
      {
        ai: {
          mode: 'openai',
          model: 'gpt-4',
          provider: 'openai',
        },
      },
      draft,
    );

    expect(applied.ai.models.fast).toEqual(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4',
      }),
    );
  });

  it('applies advanced admin metadata edits and strips worker-only fields from the published payload', () => {
    const payload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-11',
        blockLimits: { start: 12345 },
        allowOrigins: ['https://app.example'],
        rpcUrlsByChainId: { 84532: ['https://rpc.example'] },
        faucet: {
          amountEth: '0.0001',
          rpcUrl: 'https://rpc.example',
          privateKey: 'secret',
        },
        ai: {
          providers: {
            openai: { apiKey: 'sk-live' },
          },
        },
      },
      advancedDraft: {
        defaultTags: 'governance',
        questionsGenPrompt: 'Ask governance questions',
        defaultSbtTags: 'member',
        defaultFilterState: '{"sort":"recent"}',
        defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000bb'],
        highlightedQuestionIds: 'q1\nq2',
        blockedQuestionIds: 'q3',
        highlightedSurveyIds: 's1',
        blockedSurveyIds: 's2',
        ignoredSbtsList: '0x00000000000000000000000000000000000000cc',
        featuredSbtsList: '0x00000000000000000000000000000000000000dd',
        faucetAmountEth: '0.0002',
        faucetBalanceThresholdEth: '0.001',
        aiFastProvider: 'openai',
        aiFastModel: 'gpt-4o',
        aiThinkingProvider: 'anthropic',
        aiThinkingModel: 'claude-3-7-sonnet',
        aiTranscriptionProvider: 'openai',
        aiTranscriptionModel: 'whisper-1',
      },
    });

    expect(payload).toEqual(
      expect.objectContaining({
        defaultTags: 'governance',
        questionsGenPrompt: 'Ask governance questions',
        defaultSbtTags: 'member',
        defaultFilterState: { sort: 'recent' },
        defaultFeaturedSBTs: [ethers.utils.getAddress('0x00000000000000000000000000000000000000bb')],
        HIGHLIGHTED_QUESTION_IDS: ['q1', 'q2'],
        BLOCKED_QUESTION_IDS: ['q3'],
        HIGHLIGHTED_SURVEY_IDS: ['s1'],
        BLOCKED_SURVEY_IDS: ['s2'],
        ignored_SBTs_LIST: ['0x00000000000000000000000000000000000000cc'],
        featured_SBTs_LIST: ['0x00000000000000000000000000000000000000dd'],
        faucet: {
          amountEth: '0.0002',
          balanceThresholdEth: '0.001',
        },
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-4o' },
            thinking: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
            transcription: { provider: 'openai', model: 'whisper-1' },
          },
        },
      }),
    );
    expect(payload).not.toHaveProperty('allowOrigins');
    expect(payload).not.toHaveProperty('rpcUrlsByChainId');
    expect(payload.ai.providers).toBeUndefined();
    expect(payload.faucet.rpcUrl).toBeUndefined();
    expect(payload.faucet.privateKey).toBeUndefined();
  });

  it('applies editable contract overrides while preserving unknown contract metadata', () => {
    const payload = adminPageTestUtils.buildEditableSessionMetadataPayload({
      sessionConfig: {
        slug: 'test-12',
        networkChainId: 84532,
        blockLimits: { start: 12345 },
        __registry: {
          registryChainId: 84532,
        },
        contracts: {
          surveys: { address: '0x0000000000000000000000000000000000000011', chainId: 84532 },
          governance: { address: '0x0000000000000000000000000000000000000099', chainId: 84532 },
        },
      },
      advancedDraft: {
        contractSurveysAddress: '0x00000000000000000000000000000000000000a1',
        contractSbtFactoryAddress: '0x00000000000000000000000000000000000000a2',
        contractSessionRegistryAddress: '0x00000000000000000000000000000000000000a3',
      },
    });

    expect(payload.contracts.surveys).toEqual({
      address: ethers.utils.getAddress('0x00000000000000000000000000000000000000a1'),
      chainId: 84532,
    });
    expect(payload.contracts.sbtFactory).toEqual({
      address: ethers.utils.getAddress('0x00000000000000000000000000000000000000a2'),
      chainId: 84532,
    });
    expect(payload.contracts.sessionRegistry).toEqual({
      address: ethers.utils.getAddress('0x00000000000000000000000000000000000000a3'),
      chainId: 84532,
    });
    expect(payload.contracts.governance).toEqual({
      address: '0x0000000000000000000000000000000000000099',
      chainId: 84532,
    });
  });

  it('classifies gated health + unsupported auth login route as an explicit compatibility mismatch', () => {
    const mismatch = adminPageTestUtils.buildHealthAuthMismatchState({
      unauthStatus: 401,
      unauthError: 'Unauthorized',
      authError: 'Worker auth login route not supported (404).',
    });

    expect(mismatch).toEqual({
      healthLabel: 'Auth required: Unauthorized; /auth/login unsupported (404)',
      statusMessage: 'Health endpoint is gated, but this worker URL does not expose /auth/login.',
    });
  });

  it('does not classify unrelated auth failures as route compatibility mismatches', () => {
    const mismatch = adminPageTestUtils.buildHealthAuthMismatchState({
      unauthStatus: 401,
      unauthError: 'Unauthorized',
      authError: 'Worker login failed (500).',
    });

    expect(mismatch).toBeNull();
  });
});
