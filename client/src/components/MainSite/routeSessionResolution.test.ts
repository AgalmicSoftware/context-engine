import {
  mergeMainSiteSessionDisplayConfig,
  resolveMainSiteExplicitSessionSlugFromPath,
  resolveMainSiteGlobalPrimarySessionSlug,
  resolveMainSiteQuestionRouteSessionContext,
  resolveMainSiteRenderActiveSessionSlug,
  resolveMainSiteRouteSessionIdHint,
  resolveMainSiteRouteSessionSlugHint,
  resolveMainSiteSessionRouteContext,
  resolveMainSiteSessionRouteSourceSlug,
  resolveMainSiteSessionSlugFromProps,
  resolveMainSiteSessionSlugFromPathToken,
} from './routeSessionResolution.js';

describe('routeSessionResolution', () => {
  it('resolves explicit session path slugs before Redux session state', () => {
    const resolveSessionSlugFromPathToken = jest.fn((token) => (token === 'DEBATE' ? 'debate' : ''));

    expect(
      resolveMainSiteSessionSlugFromProps({
        path: '/session/DEBATE',
        activeSessionSlug: 'active',
        sessionState: {
          selectedSessionScope: 'list',
          selectedSessionSlugs: ['fallback'],
        },
        resolveSessionSlugFromPathToken,
        derivePrimarySessionSlugFromList: () => 'fallback',
      }),
    ).toBe('debate');

    expect(resolveSessionSlugFromPathToken).toHaveBeenCalledWith('DEBATE');
  });

  it('preserves explicit new and general session path handling', () => {
    expect(
      resolveMainSiteExplicitSessionSlugFromPath({
        path: '/session/new',
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toEqual({
      hasExplicitSessionSlug: true,
      sessionSlug: '',
    });

    expect(
      resolveMainSiteExplicitSessionSlugFromPath({
        path: '/session/general',
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toEqual({
      hasExplicitSessionSlug: true,
      sessionSlug: '',
    });
  });

  it('derives primary and active slugs from selected list state without normalizing active props', () => {
    const derivePrimarySessionSlugFromList = jest.fn(() => 'beta');
    const sessionState = {
      selectedSessionScope: 'LIST',
      selectedSessionSlugs: ['alpha', 'beta'],
    };

    expect(
      resolveMainSiteGlobalPrimarySessionSlug({
        sessionState,
        derivePrimarySessionSlugFromList,
      }),
    ).toBe('beta');

    expect(
      resolveMainSiteSessionSlugFromProps({
        path: '/questions',
        activeSessionSlug: 'ActiveCase',
        sessionState,
        derivePrimarySessionSlugFromList,
      }),
    ).toBe('ActiveCase');
  });

  it('does not derive a non-general list primary when primary selection explicitly includes general', () => {
    const derivePrimarySessionSlugFromList = jest.fn(() => 'alpha');
    const sessionState = {
      primarySessionExplicit: true,
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general', 'alpha'],
    };

    expect(
      resolveMainSiteGlobalPrimarySessionSlug({
        sessionState,
        derivePrimarySessionSlugFromList,
      }),
    ).toBe('');

    expect(
      resolveMainSiteSessionSlugFromProps({
        path: '/questions',
        activeSessionSlug: '',
        sessionState,
        derivePrimarySessionSlugFromList,
      }),
    ).toBe('');
    expect(derivePrimarySessionSlugFromList).not.toHaveBeenCalled();
  });

  it('canonicalizes explicit query session aliases and preserves survey-route slug-only behavior', () => {
    expect(
      resolveMainSiteRouteSessionSlugHint({
        search: '?session=DEBATE',
        allowSessionIdLookup: false,
      }),
    ).toBe('DEBATE');

    expect(
      resolveMainSiteRouteSessionSlugHint({
        search: '?sid=0xsessionid',
        allowSessionIdLookup: false,
        resolveSessionConfigById: () => ({ slug: 'edge' }),
      }),
    ).toBeNull();
  });

  it('resolves question-route session slug hints from session ids when allowed', () => {
    expect(
      resolveMainSiteRouteSessionSlugHint({
        search: '?sid=0xsessionid',
        allowSessionIdLookup: true,
        resolveSessionConfigById: (sessionId) => (sessionId === '0xsessionid' ? { slug: 'DEBATE' } : null),
      }),
    ).toBe('DEBATE');
  });

  it('requires resolved session ids only when requested', () => {
    expect(
      resolveMainSiteRouteSessionIdHint({
        search: '?session=edge&sid=stale-id',
        requireResolved: false,
        formatSessionId: (value) => value.toUpperCase(),
        resolveSessionConfigById: () => null,
      }),
    ).toBe('STALE-ID');

    expect(
      resolveMainSiteRouteSessionIdHint({
        search: '?session=edge&sid=stale-id',
        requireResolved: true,
        formatSessionId: (value) => value.toUpperCase(),
        resolveSessionConfigById: () => null,
      }),
    ).toBeNull();
  });

  it('pins unknown question-route slugs only until cache bootstrap completes', () => {
    expect(
      resolveMainSiteQuestionRouteSessionContext({
        search: '?session=general3',
        isCacheManagerReady: false,
        getSessionConfigBySlug: () => null,
        formatSessionId: (value) => value,
        resolveSessionConfigById: () => null,
      }),
    ).toMatchObject({
      sessionSlug: 'general3',
      sessionSlugPinned: true,
      shouldBlockDuringBootstrap: false,
    });

    expect(
      resolveMainSiteQuestionRouteSessionContext({
        search: '?session=general3',
        isCacheManagerReady: true,
        getSessionConfigBySlug: () => null,
        formatSessionId: (value) => value,
        resolveSessionConfigById: () => null,
      }),
    ).toMatchObject({
      sessionSlug: 'general3',
      sessionSlugPinned: false,
      shouldBlockDuringBootstrap: false,
    });
  });

  it('prefers session path tokens over query and active session slugs for render-time context', () => {
    const resolveSessionSlugFromPathToken = jest.fn(() => 'edge');

    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/session/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        search: '?session=rxc',
        activeSessionSlug: 'general2',
        isCacheManagerReady: true,
        getSessionConfigBySlug: () => null,
        resolveSessionConfigById: () => null,
        resolveSessionSlugFromPathToken,
      }),
    ).toBe('edge');

    expect(resolveSessionSlugFromPathToken).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('preserves an explicit general session route instead of falling back to the active session', () => {
    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/session/general',
        activeSessionSlug: 'demo',
        resolveSessionSlugFromPathToken: (token) =>
          String(token || '')
            .trim()
            .toLowerCase() === 'general'
            ? ''
            : String(token || '')
                .trim()
                .toLowerCase(),
      }),
    ).toBe('');
  });

  it('keeps unknown query slugs only until cache bootstrap completes for render-time context', () => {
    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/questions',
        search: '?session=general3',
        activeSessionSlug: 'edge',
        isCacheManagerReady: false,
        getSessionConfigBySlug: () => null,
        resolveSessionConfigById: () => null,
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toBe('general3');

    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/questions',
        search: '?session=general3',
        activeSessionSlug: 'edge',
        isCacheManagerReady: true,
        getSessionConfigBySlug: () => null,
        resolveSessionConfigById: () => null,
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toBe('edge');
  });

  it('inherits the provided active session slug for bare questions routes when no route pin is present', () => {
    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/questions',
        search: '',
        activeSessionSlug: 'demo',
        isCacheManagerReady: true,
        getSessionConfigBySlug: () => null,
        resolveSessionConfigById: () => null,
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toBe('demo');
  });

  it('falls back to the active session when a session token is still unresolved', () => {
    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/session/123e4567-e89b-12d3-a456-426614174000',
        activeSessionSlug: 'demo',
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toBe('demo');
  });

  it('falls back to the active session when display lookup misses an explicit non-general query slug', () => {
    const resolveDisplaySessionConfigBySlug = jest.fn((slug) =>
      slug === 'rxc' ? { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate' } : null,
    );

    expect(
      resolveMainSiteRenderActiveSessionSlug({
        path: '/surveys',
        search: '?session=DEBATE',
        activeSessionSlug: 'edge',
        isCacheManagerReady: true,
        getSessionConfigBySlug: () => null,
        resolveDisplaySessionConfigBySlug,
        resolveSessionConfigById: () => null,
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toBe('edge');

    expect(resolveDisplaySessionConfigBySlug).toHaveBeenCalledWith('DEBATE');
  });

  it('resolves session-route config via session id before slug and preserves unresolved-id behavior', () => {
    const resolveSessionConfigById = jest.fn((sessionId) =>
      sessionId === '0xsessionid' ? { slug: 'DEBATE', networkChainId: 84532 } : null,
    );
    const resolveSessionConfigBySlug = jest.fn((slug) =>
      slug === 'rxc'
        ? { slug: 'rxc', networkChainId: 84532 }
        : slug === ''
          ? { slug: '', networkChainId: 84532 }
          : null,
    );

    expect(
      resolveMainSiteSessionRouteContext({
        sessionTokenRaw: '0xsessionid',
        formatSessionId: (value) => value,
        resolveSessionConfigById,
        resolveSessionConfigBySlug,
        resolveSessionSlugFromPathToken: () => 'rxc',
      }),
    ).toMatchObject({
      sessionIdFromPath: '0xsessionid',
      sessionSlug: 'rxc',
      sessionConfig: { slug: 'DEBATE', networkChainId: 84532 },
      hasUnresolvedSessionId: false,
    });

    expect(
      resolveMainSiteSessionRouteContext({
        sessionTokenRaw: 'stale-id',
        formatSessionId: (value) => value,
        resolveSessionConfigById: () => null,
        resolveSessionConfigBySlug,
        resolveSessionSlugFromPathToken: () => '',
      }),
    ).toMatchObject({
      sessionIdFromPath: 'stale-id',
      sessionSlug: '',
      sessionConfig: null,
      hasUnresolvedSessionId: true,
    });
    expect(resolveSessionConfigBySlug).not.toHaveBeenCalledWith('');
  });

  it('can opt into display-only demo fallback for session-route config after strict lookup misses', () => {
    const resolveSessionConfigBySlug = jest.fn(() => null);
    const resolveDisplaySessionConfigBySlug = jest.fn((slug) =>
      slug === 'rxc' ? { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate', networkChainId: 84532 } : null,
    );

    expect(
      resolveMainSiteSessionRouteContext({
        sessionTokenRaw: 'DEBATE',
        formatSessionId: () => null,
        resolveSessionConfigById: () => null,
        resolveSessionConfigBySlug,
        resolveDisplaySessionConfigBySlug,
        resolveSessionSlugFromPathToken: () => 'rxc',
      }),
    ).toMatchObject({
      sessionSlug: 'rxc',
      sessionConfig: { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate', networkChainId: 84532 },
      hasUnresolvedSessionId: false,
    });

    expect(resolveSessionConfigBySlug).toHaveBeenCalledWith('rxc');
    expect(resolveDisplaySessionConfigBySlug).toHaveBeenCalledWith('rxc');
  });

  it('fills demo display fields without replacing registry worker or gate config', () => {
    const registryConfig = {
      slug: 'demo-1',
      sessionName: 'Registry Demo',
      networkChainId: 11155420,
      corsWorkerUrl: 'https://registry-worker.example',
      sponsoredKeys: { arweave: true, faucet: true },
      __registry: {
        metadataURI: 'ar://registry-metadata',
        gatesByResource: {
          arweave: { lookupStatus: 'ok', sbtAddresses: [] },
        },
      },
      contracts: {
        surveys: { address: '0xregistry' },
      },
      blockLimits: { start: 44967477, end: null },
    };
    const displayConfig = {
      slug: 'demo-1',
      sessionName: 'Demo Session',
      defaultFeaturedSBTs: ['0x29563ff3aCC8AFb220D810F8022218095e25C1f6'],
      featured_SBTs_LIST: ['0x5d2f0207B7EB26e807C4a12f2A185928558C00b9'],
      demoCompatibilitySeed: {
        temporary: true,
        sourceSessionSlug: 'demo',
      },
      corsWorkerUrl: '',
      sponsoredKeys: {},
      contracts: {
        surveys: { address: '0xfixture' },
      },
      blockLimits: { start: 1, end: null },
    };

    const result = resolveMainSiteSessionRouteContext({
      sessionTokenRaw: 'demo-1',
      formatSessionId: () => null,
      resolveSessionConfigById: () => null,
      resolveSessionConfigBySlug: () => registryConfig,
      resolveDisplaySessionConfigBySlug: () => displayConfig,
      resolveSessionSlugFromPathToken: () => 'demo-1',
    });

    expect(result.sessionConfig).toMatchObject({
      slug: 'demo-1',
      sessionName: 'Demo Session',
      corsWorkerUrl: 'https://registry-worker.example',
      sponsoredKeys: { arweave: true, faucet: true },
      __registry: registryConfig.__registry,
      contracts: registryConfig.contracts,
      blockLimits: registryConfig.blockLimits,
      defaultFeaturedSBTs: ['0x29563ff3aCC8AFb220D810F8022218095e25C1f6'],
      featured_SBTs_LIST: ['0x5d2f0207B7EB26e807C4a12f2A185928558C00b9'],
      demoCompatibilitySeed: {
        temporary: true,
        sourceSessionSlug: 'demo',
      },
    });
  });

  it('fills a missing registry start block from the matching demo display config', () => {
    const result = mergeMainSiteSessionDisplayConfig(
      {
        slug: 'demo-1',
        corsWorkerUrl: 'https://registry-worker.example',
        blockLimits: { end: null },
      },
      {
        slug: 'demo-1',
        demoCompatibilitySeed: { temporary: true },
        blockLimits: { start: 44967477, end: null },
      },
    );

    expect(result).toMatchObject({
      slug: 'demo-1',
      corsWorkerUrl: 'https://registry-worker.example',
      blockLimits: { start: 44967477, end: null },
    });
  });

  it('uses the default bucket as the source slug for the built-in demo route only', () => {
    expect(
      resolveMainSiteSessionRouteSourceSlug({
        sessionTokenRaw: 'demo',
        sessionSlug: 'demo',
        sessionConfig: { slug: '', sessionName: 'Context Engine' },
      }),
    ).toBe('');

    expect(
      resolveMainSiteSessionRouteSourceSlug({
        sessionTokenRaw: 'demo',
        sessionSlug: 'demo',
        sessionConfig: {
          slug: 'demo',
          sessionName: 'Registry Demo',
          __registry: { sessionIdHex: '0xabc' },
        },
      }),
    ).toBe('demo');

    expect(
      resolveMainSiteSessionRouteSourceSlug({
        sessionTokenRaw: 'rxc',
        sessionSlug: 'rxc',
        sessionConfig: { slug: 'rxc', sessionName: 'Weyl v. Yarvin Debate' },
      }),
    ).toBe('rxc');
  });

  it('resolves non-UUID tokens directly via slug normalization', () => {
    expect(
      resolveMainSiteSessionSlugFromPathToken({
        rawToken: 'DEBATE',
        formatSessionId: () => null,
        resolveSessionConfigById: () => null,
        resolveSessionConfigBySlug: () => null,
      }),
    ).toBe('DEBATE');
  });

  it('returns empty string for empty or new tokens', () => {
    expect(resolveMainSiteSessionSlugFromPathToken({ rawToken: '' })).toBe('');
    expect(resolveMainSiteSessionSlugFromPathToken({ rawToken: null })).toBe('');
    expect(resolveMainSiteSessionSlugFromPathToken({ rawToken: 'new' })).toBe('');
    expect(resolveMainSiteSessionSlugFromPathToken({ rawToken: 'NEW' })).toBe('');
  });

  it('prefers registry ID lookup over slug lookup for UUID-shaped tokens', () => {
    const resolveSessionConfigById = jest.fn((id) => (id === '0xsessionid' ? { slug: 'DEBATE' } : null));
    const resolveSessionConfigBySlug = jest.fn(() => ({ slug: 'other' }));

    expect(
      resolveMainSiteSessionSlugFromPathToken({
        rawToken: '0xsessionid',
        formatSessionId: (v) => v,
        resolveSessionConfigById,
        resolveSessionConfigBySlug,
      }),
    ).toBe('DEBATE');

    expect(resolveSessionConfigById).toHaveBeenCalledWith('0xsessionid');
    expect(resolveSessionConfigBySlug).not.toHaveBeenCalled();
  });

  it('falls back to slug lookup when UUID-shaped token has no ID config', () => {
    expect(
      resolveMainSiteSessionSlugFromPathToken({
        rawToken: '0xsessionid',
        formatSessionId: (v) => v,
        resolveSessionConfigById: () => null,
        resolveSessionConfigBySlug: (slug) => (slug === '0xsessionid' ? { slug: 'edge' } : null),
      }),
    ).toBe('edge');
  });

  it('returns empty string when no resolution matches for UUID-shaped tokens', () => {
    expect(
      resolveMainSiteSessionSlugFromPathToken({
        rawToken: '0xunknown',
        formatSessionId: (v) => v,
        resolveSessionConfigById: () => null,
        resolveSessionConfigBySlug: () => null,
      }),
    ).toBe('');
  });
});
