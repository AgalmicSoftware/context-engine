import {
  buildUserPageAiSessionSlugCandidates,
  buildUserPageAiSessionScopeContext,
  buildUserPageAnalysisCandidateLogRows,
  buildUserPageAnalysisExcludeSlugSet,
  deriveAnalysisAiContextFromSessionConfig,
  resolveUserPageAnalysisAiContext,
  resolveUserPageAnalysisSessionConfigForSlug,
  resolveUserPageAnalysisSessionFallback,
} from './userPageHelpers';

describe('userPageHelpers analysis session helpers', () => {
  it('builds AI session scope contexts from scan globals', () => {
    expect(
      buildUserPageAiSessionScopeContext({
        scanScope: ' General ',
        activeSessionSlug: 'alpha',
      }),
    ).toEqual({
      mode: 'general',
      strict: true,
      allowedSlugs: [''],
    });

    expect(
      buildUserPageAiSessionScopeContext({
        scanScope: 'active',
        activeSessionSlug: ' Alpha Session ',
      }),
    ).toEqual({
      mode: 'active',
      strict: true,
      allowedSlugs: ['Alpha Session'],
    });

    expect(
      buildUserPageAiSessionScopeContext({
        scanScope: 'active',
        activeSessionSlug: '',
      }),
    ).toEqual({
      mode: 'active',
      strict: false,
      allowedSlugs: [],
    });

    expect(
      buildUserPageAiSessionScopeContext({
        scanScope: 'list',
        scanSlugs: [' Beta ', 'beta', '', 'General'],
      }),
    ).toEqual({
      mode: 'list',
      strict: true,
      allowedSlugs: ['Beta', 'beta', ''],
    });

    expect(buildUserPageAiSessionScopeContext()).toEqual({
      mode: 'all',
      strict: false,
      allowedSlugs: [],
    });
  });

  it('builds AI session slug candidates from active, scope, cache, and SBT sources', () => {
    const listNamespaceSlugs = jest.fn((namespace: string) => {
      if (namespace === 'userCache') return ['cached-user', 'active-session'];
      if (namespace === 'surveysCache') return ['survey-session'];
      if (namespace === 'questionsCache') return [''];
      return ['sbt-cache-session'];
    });

    expect(
      buildUserPageAiSessionSlugCandidates({
        activeSessionSlug: ' active-session ',
        listNamespaceSlugs,
        sbtList: [{ slug: 'minted-session' }, { slug: 'cached-user' }],
        scopeContext: { mode: 'all', strict: false, allowedSlugs: [] },
      }),
    ).toEqual(['active-session', 'cached-user', 'survey-session', '', 'sbt-cache-session', 'minted-session']);

    expect(listNamespaceSlugs).toHaveBeenCalledWith('userCache');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('surveysCache');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('questionsCache');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('sbtCache');
  });

  it('keeps active AI session candidates eligible under strict scope filters', () => {
    expect(
      buildUserPageAiSessionSlugCandidates({
        activeSessionSlug: 'active-out-of-scope',
        listNamespaceSlugs: () => ['stale-cache'],
        scopeContext: {
          mode: 'list',
          strict: true,
          allowedSlugs: ['in-scope'],
        },
      }),
    ).toEqual(['active-out-of-scope', 'in-scope']);

    expect(
      buildUserPageAiSessionSlugCandidates({
        activeSessionSlug: '',
        listNamespaceSlugs: () => ['stale-cache'],
        scopeContext: {
          mode: 'general',
          strict: true,
          allowedSlugs: [''],
        },
      }),
    ).toEqual(['']);
  });

  it('resolves analysis session configs without demo fallback for unknown slugs', () => {
    const defaultConfig = { slug: '', ai: { enabled: true } };
    const alphaConfig = { slug: 'alpha', ai: { enabled: true } };
    const getSessionConfigBySlug = jest.fn((slug: string) => (slug === 'alpha' ? alphaConfig : null));
    const getSessionConfigBySlugOrDefault = jest.fn(() => defaultConfig);

    expect(
      resolveUserPageAnalysisSessionConfigForSlug({
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: '',
      }),
    ).toBe(defaultConfig);
    expect(
      resolveUserPageAnalysisSessionConfigForSlug({
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: ' alpha ',
      }),
    ).toBe(alphaConfig);
    expect(
      resolveUserPageAnalysisSessionConfigForSlug({
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: 'missing',
      }),
    ).toBeNull();
    expect(getSessionConfigBySlugOrDefault).toHaveBeenCalledTimes(1);
  });

  it('normalizes excluded analysis session slugs', () => {
    expect(
      Array.from(
        buildUserPageAnalysisExcludeSlugSet({
          excludeSlugs: [' alpha ', null, undefined, '', 'beta'],
        }).values(),
      ),
    ).toEqual(['alpha', '', 'beta']);
    expect(buildUserPageAnalysisExcludeSlugSet({ excludeSlugs: 'alpha' }).size).toBe(0);
  });

  it('resolves analysis session fallback precedence', () => {
    const activeCandidate = { slug: 'active', status: 'denied' };
    const firstUsable = { slug: 'usable', status: 'unknown' };
    const firstChecked = { slug: 'first', status: 'denied' };

    expect(
      resolveUserPageAnalysisSessionFallback({
        activeCandidate,
        checked: [firstChecked],
        firstUsable,
      }),
    ).toEqual({
      candidate: activeCandidate,
      reason: 'fallback-active-session',
    });
    expect(
      resolveUserPageAnalysisSessionFallback({
        checked: [firstChecked],
        firstUsable,
      }),
    ).toEqual({
      candidate: firstUsable,
      reason: 'fallback-first-usable-session',
    });
    expect(
      resolveUserPageAnalysisSessionFallback({
        checked: [firstChecked],
      }),
    ).toEqual({
      candidate: firstChecked,
      reason: 'fallback-first-checked-session',
    });
    expect(resolveUserPageAnalysisSessionFallback()).toBeNull();
  });

  it('builds analysis candidate log rows with general fallback labels', () => {
    expect(
      buildUserPageAnalysisCandidateLogRows([
        { slug: 'alpha', status: 'granted' },
        { slug: '', status: 'no-gate' },
        null,
      ]),
    ).toEqual([
      { slug: 'alpha', status: 'granted' },
      { slug: 'general', status: 'no-gate' },
      { slug: 'general', status: undefined },
    ]);
    expect(buildUserPageAnalysisCandidateLogRows(null)).toEqual([]);
  });

  it('derives AI context from session config with provider and model precedence', () => {
    expect(
      deriveAnalysisAiContextFromSessionConfig('alpha', {
        ai: {
          mode: ' Anthropic ',
          modelProviders: {
            default: 'openai',
            reasoning: 'google',
          },
          models: {
            thinking: {
              provider: ' OpenAI ',
              model: ' gpt-5.2 ',
            },
          },
        },
      }),
    ).toEqual({
      sessionSlug: 'alpha',
      provider: 'openai',
      model: 'gpt-5.2',
    });

    expect(deriveAnalysisAiContextFromSessionConfig('', {})).toEqual({
      sessionSlug: '',
      provider: 'openai',
      model: 'gpt-5',
    });
  });

  it('resolves analysis AI context from effective config with fallback logging', async () => {
    const getEffectiveAiConfig = jest.fn(async () => ({
      provider: ' Anthropic ',
      model: ' claude-sonnet ',
    }));
    await expect(
      resolveUserPageAnalysisAiContext({
        getEffectiveAiConfig,
        sessionConfig: {
          ai: {
            provider: 'openai',
            models: { thinking: 'gpt-5' },
          },
        },
        sessionSlug: 'alpha',
      }),
    ).resolves.toEqual({
      sessionSlug: 'alpha',
      provider: 'anthropic',
      model: 'claude-sonnet',
    });
    expect(getEffectiveAiConfig).toHaveBeenCalledWith({
      sessionSlug: 'alpha',
      thinking: true,
      resolveSecrets: false,
    });

    const logger = { warn: jest.fn() };
    await expect(
      resolveUserPageAnalysisAiContext({
        getEffectiveAiConfig: jest.fn(async () => {
          throw new Error('offline');
        }),
        logger,
        sessionConfig: {
          ai: {
            provider: 'Google',
            models: { thinking: { model: 'gemini-pro' } },
          },
        },
        sessionSlug: 'beta',
      }),
    ).resolves.toEqual({
      sessionSlug: 'beta',
      provider: 'google',
      model: 'gemini-pro',
    });
    expect(logger.warn).toHaveBeenCalledWith('[UserPage] analysis AI context fallback:', expect.any(Error));
  });
});
