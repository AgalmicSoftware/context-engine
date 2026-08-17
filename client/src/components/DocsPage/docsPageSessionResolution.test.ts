import {
  resolveDocsPageActiveSession,
  resolveDocsPageReferrerSlug,
  resolveDocsPageSessionConfig,
} from './docsPageSessionResolution.js';

describe('DocsPage session resolution', () => {
  const sessionConfigs = {
    '': { slug: '', sessionName: 'Context Engine' },
    rxc: { slug: 'rxc', sessionName: 'Debate' },
    edge: { slug: 'edge', sessionName: 'Edge' },
    route: { slug: 'route', sessionName: 'Route Session' },
    redux: { slug: 'redux', sessionName: 'Redux Session' },
    ref: { slug: 'ref', sessionName: 'Referrer Session' },
  };

  type SessionConfigMap = Record<string, { slug: string; sessionName: string }>;

  const createReaders = ({
    strictConfigs = sessionConfigs,
    demoConfigs = {},
  }: {
    strictConfigs?: SessionConfigMap;
    demoConfigs?: SessionConfigMap;
  } = {}) => ({
    resolveBySlug: jest.fn((slug: string) => strictConfigs[slug] || null),
    resolveDemoBySlug: jest.fn((slug: string) => demoConfigs[slug] || null),
    getDefaultSessionConfig: jest.fn(() => sessionConfigs['']),
  });

  it('delegates slug lookup through the general alias when allowed', () => {
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders();

    expect(
      resolveDocsPageSessionConfig('general', {
        allowGeneral: true,
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(sessionConfigs['']);
    expect(resolveBySlug).toHaveBeenCalledWith('');
  });

  it('does not silently inherit the general session for unknown non-general slugs', () => {
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders();

    expect(
      resolveDocsPageSessionConfig('missing-session-slug', {
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBeNull();
    expect(getDefaultSessionConfig).not.toHaveBeenCalled();
  });

  it('only resolves the general session when the caller explicitly allows it', () => {
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders();

    expect(
      resolveDocsPageSessionConfig('general', {
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBeNull();

    expect(
      resolveDocsPageSessionConfig('general', {
        allowGeneral: true,
        resolveBySlug: jest.fn(() => null),
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(sessionConfigs['']);
  });

  it('uses explicit demo fallback for canonical session slugs when strict lookup misses', () => {
    const demoSession = { slug: 'rxc', sessionName: 'Debate Demo' };
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders({
      strictConfigs: { '': sessionConfigs[''] },
      demoConfigs: { rxc: demoSession },
    });

    expect(
      resolveDocsPageSessionConfig('rxc', {
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(demoSession);
    expect(resolveBySlug).toHaveBeenCalledWith('rxc');
    expect(resolveDemoBySlug).toHaveBeenCalledWith('rxc');
    expect(getDefaultSessionConfig).not.toHaveBeenCalled();
  });

  it('preserves DocsPage source precedence while skipping unresolved higher-priority slugs', () => {
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders();

    expect(
      resolveDocsPageActiveSession({
        urlSlugLike: 'missing-session-slug',
        querySessionRaw: 'rxc',
        activeSessionSlug: 'route',
        reduxActiveSessionSlug: 'redux',
        referrerSlug: 'ref',
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(sessionConfigs.rxc);

    expect(
      resolveDocsPageActiveSession({
        urlSlugLike: 'edge',
        querySessionRaw: 'rxc',
        activeSessionSlug: 'route',
        reduxActiveSessionSlug: 'redux',
        referrerSlug: 'ref',
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(sessionConfigs.edge);
  });

  it('preserves explicit active session slugs before generic /contracts sync uses them', () => {
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders();

    expect(
      resolveDocsPageActiveSession({
        urlSlugLike: undefined,
        querySessionRaw: null,
        activeSessionSlug: 'rxc',
        reduxActiveSessionSlug: '',
        referrerSlug: '',
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(sessionConfigs.rxc);
    expect(resolveBySlug).toHaveBeenCalledWith('rxc');
  });

  it('keeps demo-only higher-priority sources ahead of lower-priority strict sessions', () => {
    const demoEdgeSession = { slug: 'edge', sessionName: 'Edge Demo' };
    const { resolveBySlug, resolveDemoBySlug, getDefaultSessionConfig } = createReaders({
      strictConfigs: {
        '': sessionConfigs[''],
        route: sessionConfigs.route,
        redux: sessionConfigs.redux,
        ref: sessionConfigs.ref,
      },
      demoConfigs: { edge: demoEdgeSession },
    });

    expect(
      resolveDocsPageActiveSession({
        urlSlugLike: 'edge',
        querySessionRaw: 'route',
        activeSessionSlug: 'redux',
        reduxActiveSessionSlug: 'ref',
        referrerSlug: '',
        resolveBySlug,
        resolveDemoBySlug,
        getDefaultSessionConfig,
      }),
    ).toBe(demoEdgeSession);
    expect(resolveDemoBySlug).toHaveBeenCalledWith('edge');
  });

  it('preserves explicit referrer session slugs from session URLs', () => {
    expect(resolveDocsPageReferrerSlug('https://contextengine.example.test/session/DEBATE?foo=1')).toBe('DEBATE');
    expect(resolveDocsPageReferrerSlug('')).toBe('');
  });
});
