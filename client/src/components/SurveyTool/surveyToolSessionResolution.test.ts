import {
  resolveSurveyToolDecryptHydrationContext,
  resolveSurveyToolDraftSessionContext,
  resolveSurveyToolDraftStorageContext,
  resolveSurveyToolEffectiveSlug,
  resolveSurveyToolEnsureQuestionCachedContext,
  resolveSurveyToolExplicitSessionContext,
  resolveSurveyToolIdLookupContext,
  resolveSurveyToolLockAudienceSessionNameContext,
  resolveSurveyToolQuestionConfigContext,
  resolveSurveyToolQuestionCountContext,
  resolveSurveyToolQuestionPayloadCacheWriteContext,
  resolveSurveyToolQuestionsDashboardLoadContext,
  resolveSurveyToolQuestionReadCacheContext,
  resolveSurveyToolQuestionBootstrapContext,
  resolveSurveyToolResponseJsonContext,
  resolveSurveyToolResponseHydrationContext,
  resolveSurveyToolResponseGateSessionContext,
  resolveSurveyToolSubmittedCacheWriteContext,
  resolveSurveyToolPileFilterContext,
  resolveSurveyToolPileLoadContext,
  resolveSurveyToolPileWarmSeedContext,
  resolveSurveyToolPileResponseReadContext,
  resolveSurveyToolSurveyReadContext,
  resolveSurveyToolUpdateCacheContext,
} from './surveyToolSessionResolution.js';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile.js';

const makeResolveBySlug = (resolver: (slug: string) => any) => jest.fn(resolver);
const makeLegacyRegistryConfig = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  networkChainId: 84532,
  __registry: {
    registryChainId: 84532,
    sessionIdHex: '0x00112233445566778899aabbccddeeff',
  },
  ...extra,
});

describe('surveyToolSessionResolution', () => {
  it('canonicalizes explicit general routes and preserves SurveyTool prop precedence', () => {
    expect(
      resolveSurveyToolEffectiveSlug({
        pathname: '/session/GeNeRal',
        activeSessionSlug: 'edge',
        sessionSlug: 'alpha',
      }),
    ).toBe('');

    expect(
      resolveSurveyToolEffectiveSlug({
        pathname: '',
        activeSessionSlug: 'edge',
        sessionSlug: 'rxc',
      }),
    ).toBe('rxc');
  });

  it('lets pinned embedded callers override the browser session path with the default slug', () => {
    expect(
      resolveSurveyToolEffectiveSlug({
        pathname: '/session/demo',
        activeSessionSlug: 'demo',
        sessionSlug: '',
        sessionSlugPinned: true,
      }),
    ).toBe('');
  });

  it('prefers explicit route or prop session context over inferred draft slugs', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === 'edge' ? { slug: 'edge', networkChainId: 84532 } : null,
    );

    const resolved = resolveSurveyToolDraftSessionContext({
      pathname: '',
      activeSessionSlug: '',
      sessionSlug: 'edge',
      effectiveDraftSlug: 'other',
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'edge',
      sessionConfig: { slug: 'edge', networkChainId: 84532 },
    });
    expect(resolveBySlug).toHaveBeenCalledWith('edge');
    expect(resolveBySlug).not.toHaveBeenCalledWith('other');
  });

  it('does not inherit the general session config for unknown non-general slugs', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const draftResolved = resolveSurveyToolDraftSessionContext({
      pathname: '',
      activeSessionSlug: '',
      sessionSlug: '',
      effectiveDraftSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const explicitResolved = resolveSurveyToolExplicitSessionContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });

    expect(draftResolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(explicitResolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps response-gate overlays without borrowing general config for unresolved explicit slugs', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === ''
        ? {
            slug: '',
            networkChainId: 84532,
            sponsored: {
              defaultGateId: 'general_gate',
              gates: {
                general_gate: {
                  gateId: 'general_gate',
                  type: 'sbt',
                },
              },
            },
          }
        : null,
    );

    const resolved = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: 'missing-session-slug',
      sessionConfig: {
        sessionName: 'Pinned Missing Session',
      },
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      error: 'Session config not found for "missing-session-slug".',
      effectiveSessionConfig: {
        slug: 'missing-session-slug',
        sessionName: 'Pinned Missing Session',
      },
    });
    expect(resolved.effectiveSessionConfig?.sponsored).toBeUndefined();
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('does not augment a validated Worker response-gate config from a same-slug registry session', () => {
    const workerConfig = {
      slug: 'worker-edge',
      lit: {
        litNetwork: 'worker-lit',
      },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    const resolveBySlug = makeResolveBySlug(() => ({
      slug: 'worker-edge',
      lit: {
        litNetwork: 'registry-lit',
        accessControlConditions: [{ contractAddress: '0xregistry' }],
      },
      sponsored: {
        defaultGateId: 'registry_gate',
        gates: {
          registry_gate: { gateId: 'registry_gate', type: 'sbt' },
        },
      },
      __registry: {
        registryChainId: 84532,
        gatesByResource: {
          responses: ['registry_gate'],
        },
      },
    }));

    const resolved = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: 'worker-edge',
      sessionConfig: workerConfig,
      resolveBySlug,
    });

    expect(resolveBySlug).not.toHaveBeenCalled();
    expect(resolved.sessionConfig).toBe(workerConfig);
    expect(resolved.effectiveSessionConfig).toEqual(workerConfig);
    expect(resolved.effectiveSessionConfig?.lit).toEqual({ litNetwork: 'worker-lit' });
    expect(resolved.effectiveSessionConfig?.sponsored).toBeUndefined();
    expect(resolved.effectiveSessionConfig?.__registry).toBeUndefined();
  });

  it('treats an invalid Worker authority claim as a fail-closed response-gate boundary', () => {
    const invalidWorkerConfig = {
      slug: 'worker-edge',
      sessionModeProfile: {
        profileVersion: 1,
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
      },
    };
    const resolveBySlug = makeResolveBySlug(() =>
      makeLegacyRegistryConfig('worker-edge', {
        lit: { litNetwork: 'registry-lit' },
        sponsored: { defaultGateId: 'registry-gate' },
      }),
    );

    const resolved = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: 'worker-edge',
      sessionConfig: invalidWorkerConfig,
      resolveBySlug,
    });

    expect(resolveBySlug).not.toHaveBeenCalled();
    expect(resolved.sessionConfig).toBe(invalidWorkerConfig);
    expect(resolved.effectiveSessionConfig).toBeNull();
  });

  it('keeps unresolved question-config slugs off borrowed general blocked/highlighted ids', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === ''
        ? {
            slug: '',
            BLOCKED_QUESTION_IDS: ['q-blocked'],
            HIGHLIGHTED_QUESTION_IDS: ['q-highlighted'],
          }
        : null,
    );

    const resolved = resolveSurveyToolQuestionConfigContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      blockedQuestionIds: [],
      highlightedQuestionIds: [],
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved lock-audience-session-name slugs off borrowed general labels', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === ''
        ? {
            slug: '',
            sessionName: 'General Session',
          }
        : null,
    );

    const resolved = resolveSurveyToolLockAudienceSessionNameContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      sessionName: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved draft-storage slugs on pending network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolDraftStorageContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolDraftStorageContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved response-hydration slugs off cache scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolResponseHydrationContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolResponseHydrationContext({
      sessionSlug: 'missing-session-slug',
      networkChainId: 84532,
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('uses a stable worker cache scope for chainless worker-canonical sessions', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === 'demo-sh'
        ? {
            slug,
            sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          }
        : null,
    );

    const hydration = resolveSurveyToolResponseHydrationContext({
      sessionSlug: 'demo-sh',
      network: { id: 84532 },
      resolveBySlug,
    });
    const submitted = resolveSurveyToolSubmittedCacheWriteContext({
      sessionSlug: 'demo-sh',
      resolveBySlug,
    });

    expect(hydration).toMatchObject({
      sessionSlug: 'demo-sh',
      networkId: null,
      networkIdStr: 'worker',
      networkSourceSlug: 'demo-sh',
    });
    expect(submitted).toMatchObject({
      sessionSlug: 'demo-sh',
      networkId: null,
      networkIdStr: 'worker',
      networkSourceSlug: 'demo-sh',
    });
  });

  it('keeps unresolved question-bootstrap slugs off bootstrap network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolQuestionBootstrapContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolQuestionBootstrapContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved question-read-cache slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolQuestionReadCacheContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolQuestionReadCacheContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('prefers __registry.registryChainId over the wallet-facing network when session config omits networkChainId', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === 'edge'
        ? {
            slug: 'edge',
            __registry: {
              registryChainId: 84532,
              sessionIdHex: '0x00112233445566778899aabbccddeeff',
            },
          }
        : null,
    );

    const resolved = resolveSurveyToolQuestionReadCacheContext({
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          registryChainId: 84532,
        },
      },
      networkId: 84532,
      networkIdStr: '84532',
    });
  });

  it('keeps unresolved questions-dashboard-load slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolQuestionsDashboardLoadContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolQuestionsDashboardLoadContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('recovers questions-dashboard network scope from fallback list slugs when bare /questions has no base session config', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === 'alpha' ? { slug: 'alpha', networkChainId: 84532 } : null,
    );

    const resolved = resolveSurveyToolQuestionsDashboardLoadContext({
      sessionSlug: '',
      fallbackSessionSlugs: ['alpha', 'beta'],
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: '',
      sessionConfig: null,
      networkId: 84532,
      networkIdStr: '84532',
      networkSourceSlug: 'alpha',
      scopedSessionSlugs: ['', 'alpha', 'beta'],
    });
    expect(resolveBySlug).toHaveBeenCalledWith('');
    expect(resolveBySlug).toHaveBeenCalledWith('alpha');
  });

  it('keeps unresolved question-payload-cache-write slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolQuestionPayloadCacheWriteContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolQuestionPayloadCacheWriteContext({
      sessionSlug: 'missing-session-slug',
      networkChainId: 84532,
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved ensure-question-cached slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolEnsureQuestionCachedContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolEnsureQuestionCachedContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved question-count slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolQuestionCountContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolQuestionCountContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('recovers question-count network scope from fallback list slugs when bare /questions has no base session config', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === 'alpha' ? { slug: 'alpha', networkChainId: 84532 } : null,
    );

    const resolved = resolveSurveyToolQuestionCountContext({
      sessionSlug: '',
      fallbackSessionSlugs: ['alpha', 'beta'],
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: '',
      sessionConfig: null,
      networkId: 84532,
      networkIdStr: '84532',
      networkSourceSlug: 'alpha',
      scopedSessionSlugs: ['', 'alpha', 'beta'],
    });
    expect(resolveBySlug).toHaveBeenCalledWith('');
    expect(resolveBySlug).toHaveBeenCalledWith('alpha');
  });

  it('keeps unresolved id-lookup slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolIdLookupContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolIdLookupContext({
      sessionSlug: 'missing-session-slug',
      networkChainId: 84532,
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved survey-read slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolSurveyReadContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolSurveyReadContext({
      sessionSlug: 'missing-session-slug',
      networkChainId: 84532,
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved update-cache slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolUpdateCacheContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolUpdateCacheContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved submitted-cache-write slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolSubmittedCacheWriteContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolSubmittedCacheWriteContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved pile-warm-seed slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolPileWarmSeedContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolPileWarmSeedContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved pile-load slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolPileLoadContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolPileLoadContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved pile-response-read slugs off cache/network scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolPileResponseReadContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolPileResponseReadContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('prefers the resolved session chain over wallet-facing network props for pile cache contexts', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === 'edge'
        ? makeLegacyRegistryConfig('edge', {
            contracts: {
              surveys: { chainId: 84532 },
            },
          }
        : null,
    );

    const warmSeed = resolveSurveyToolPileWarmSeedContext({
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453 },
      networkChainId: 8453,
      resolveBySlug,
    });
    const pileLoad = resolveSurveyToolPileLoadContext({
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453 },
      networkChainId: 8453,
      resolveBySlug,
    });

    expect(warmSeed).toMatchObject({
      sessionSlug: 'edge',
      networkId: 84532,
      networkIdStr: '84532',
    });
    expect(pileLoad).toMatchObject({
      sessionSlug: 'edge',
      networkId: 84532,
      networkIdStr: '84532',
    });
  });

  it('keeps unresolved pile-filter slugs off cache/config scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === ''
        ? {
            slug: '',
            networkChainId: 84532,
            BLOCKED_QUESTION_IDS: ['q-blocked'],
            HIGHLIGHTED_QUESTION_IDS: ['q-highlighted'],
          }
        : null,
    );

    const unresolved = resolveSurveyToolPileFilterContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolPileFilterContext({
      sessionSlug: 'missing-session-slug',
      networkChainId: 84532,
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      blockedQuestionIds: [],
      highlightedQuestionIds: [],
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      blockedQuestionIds: [],
      highlightedQuestionIds: [],
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved decrypt-hydration slugs off cache scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const unresolved = resolveSurveyToolDecryptHydrationContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolDecryptHydrationContext({
      sessionSlug: 'missing-session-slug',
      networkChainId: 84532,
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps unresolved response-json slugs off metadata scope unless props provide the chain id', () => {
    const resolveBySlug = makeResolveBySlug((slug) =>
      slug === '' ? { slug: '', networkChainId: 84532, sessionName: 'General Session' } : null,
    );

    const unresolved = resolveSurveyToolResponseJsonContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug,
    });
    const propsPinned = resolveSurveyToolResponseJsonContext({
      sessionSlug: 'missing-session-slug',
      network: { id: 84532 },
      resolveBySlug,
    });

    expect(unresolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(propsPinned).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: 'Session config not found for "missing-session-slug".',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });
});
