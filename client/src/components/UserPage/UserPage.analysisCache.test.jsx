/** @file UserPage.analysisCache.test.jsx */
import UserPage from './UserPage';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { analyzeUserOpinions } from 'utilities/ai/aiClient.js';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiClient.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

let analysisCacheTestSeq = 0;

const makeAnalysisCacheInstance = (props = {}) => {
  analysisCacheTestSeq += 1;
  const slug = props.activeSessionSlug || `analysis-cache-test-${analysisCacheTestSeq}`;
  const viewAddress = props.viewAddress || '0x00000000000000000000000000000000000000aa';
  const networkID = String(props.network?.id || 84532);
  const instance = makeInstance({
    activeSessionSlug: slug,
    viewAddress,
    network: { id: Number(networkID) },
    account: '0x00000000000000000000000000000000000000bb',
    ...props,
  });

  instance.state = {
    ...instance.state,
    username: 'Cache Test User',
    sbtList: [
      {
        sbtInfo: {
          name: 'Cache Badge',
          sbtAddress: '0x00000000000000000000000000000000000000cc',
        },
      },
    ],
    questionResponseInfo: [
      {
        id: 'q1',
        type: 'freeform',
        prompt: 'What should be cached?',
      },
    ],
    detailedQuestionResponses: {
      q1: {
        answer: { value: 'A deterministic answer' },
        conviction: 4,
      },
    },
    surveyResponseInfo: [],
    detailedSurveyResponses: {},
    questionCreationInfo: [],
    surveyCreationInfo: [],
  };

  jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue([slug]);
  jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((candidate) =>
    candidate === slug
      ? {
          slug,
          ai: {
            mode: 'openai',
            models: { thinking: 'gpt-5' },
            modelProviders: { thinking: 'openai' },
          },
        }
      : null,
  );
  checkSponsoredAccess.mockResolvedValue({
    status: 'no-gate',
    gate: null,
    resourceKey: 'ai',
  });

  return {
    instance,
    slug,
    networkID,
    addressLower: viewAddress.toLowerCase(),
  };
};

const getSingleAnalysisCacheEntry = ({ slug, networkID, addressLower }) => {
  const cacheObj = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false });
  const bucket = cacheObj?.[networkID]?.[addressLower] || {};
  const [[fingerprint, entry] = []] = Object.entries(bucket);
  return { cacheObj, fingerprint, entry };
};

const writeSingleAnalysisCacheEntry = async ({ slug, networkID, addressLower, fingerprint, entry }) => {
  const current = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false }) || {};
  await cacheScripts.writeCache('analysisCache', slug, {
    ...current,
    [networkID]: {
      ...(current[networkID] || {}),
      [addressLower]: {
        ...(current[networkID]?.[addressLower] || {}),
        [fingerprint]: entry,
      },
    },
  });
};

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

describe('UserPage analysis cache and routing', () => {
  beforeEach(() => {
    checkSponsoredAccess.mockResolvedValue({
      status: 'unknown',
      gate: null,
      resourceKey: 'default',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
    try {
      localStorage.removeItem(REGISTRY_CACHE_KEY);
    } catch (_) {}
  });

  it('selects an AI-open session for analyze when active-session AI gate is denied', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'active-slug',
    });
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: {},
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['active-slug', 'open-slug']);
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((slug) => ({ slug }));
    checkSponsoredAccess.mockImplementation(async ({ sessionSlug }) =>
      sessionSlug === 'open-slug'
        ? { status: 'no-gate', gate: null, resourceKey: 'ai' }
        : { status: 'denied', gate: { type: 'sbt' }, resourceKey: 'ai' },
    );

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'open-slug',
        sessionConfig: expect.objectContaining({ slug: 'open-slug' }),
      }),
    );
  });

  it('writes analysisCache after a cache miss calls AI', async () => {
    const now = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    const result = {
      summary: 'fresh summary',
      details: 'fresh details',
      name: 'Fresh Analysis',
      historicalAlignment: {
        figure: 'Ada Lovelace',
        reasoning: 'Analytical framing.',
      },
    };
    analyzeUserOpinions.mockResolvedValueOnce(result);

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      const { fingerprint, entry } = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      expect(fingerprint).toEqual(expect.any(String));
      expect(entry).toMatchObject({
        version: 1,
        fingerprint,
        cachedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
        address: addressLower,
        networkId: networkID,
        aiContext: {
          sessionSlug: slug,
          provider: 'openai',
          model: 'gpt-5',
        },
        result,
      });
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps fresh analysis visible when the analysisCache write port throws', async () => {
    const now = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { instance, slug } = makeAnalysisCacheInstance();
    const writeSpy = jest
      .spyOn(instance, '_writeAnalysisCacheEntry')
      .mockRejectedValue(new Error('analysis write failed'));
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'fresh summary despite write failure',
      details: 'fresh details despite write failure',
      name: 'Fresh Despite Write Failure',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionSlug: slug,
          result: expect.objectContaining({
            summary: 'fresh summary despite write failure',
          }),
        }),
      );
      expect(instance.state.analysisName).toBe('Fresh Despite Write Failure');
      expect(instance.state.aiAnalysis).toBe('fresh summary despite write failure');
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
      expect(instance.state.analysisError).toBe('');
    } finally {
      nowSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('hydrates unchanged analysis input from analysisCache without calling AI', async () => {
    const cachedAt = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(cachedAt);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'seed summary',
      details: 'seed details',
      name: 'Seed Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();
      const seeded = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      const cachedResult = {
        name: 'Cached Analysis',
        summary: 'cached summary',
        details: 'cached details',
        historicalAlignment: {
          figure: 'Grace Hopper',
          reasoning: 'Cached reasoning.',
        },
      };
      await writeSingleAnalysisCacheEntry({
        slug,
        networkID,
        addressLower,
        fingerprint: seeded.fingerprint,
        entry: {
          ...seeded.entry,
          result: cachedResult,
        },
      });

      analyzeUserOpinions.mockClear();
      nowSpy.mockReturnValue(cachedAt + 2 * 60 * 60 * 1000);

      await instance.analyzeUser();

      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(instance.state.analysisName).toBe('Cached Analysis');
      expect(instance.state.aiAnalysis).toBe('cached summary');
      expect(instance.state.analysisDetails).toBe('cached details');
      expect(instance.state.analysisHistoricalFigure).toBe('Grace Hopper');
      expect(instance.state.analysisHistoricalReasoning).toBe('Cached reasoning.');
      expect(instance.state.analysisServedFromCache).toBe(true);
      expect(instance.state.analysisCachedAt).toBe(cachedAt);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('treats expired analysisCache entries as misses', async () => {
    const cachedAt = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(cachedAt);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'seed summary',
      details: 'seed details',
      name: 'Seed Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();
      const seeded = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      await writeSingleAnalysisCacheEntry({
        slug,
        networkID,
        addressLower,
        fingerprint: seeded.fingerprint,
        entry: {
          ...seeded.entry,
          expiresAt: cachedAt - 1,
        },
      });

      analyzeUserOpinions.mockClear();
      analyzeUserOpinions.mockResolvedValueOnce({
        summary: 'new summary after expiry',
        details: 'new details after expiry',
        name: 'Fresh After Expiry',
        historicalAlignment: {},
      });
      instance.state = {
        ...instance.state,
        aiAnalysis: 'stale cached summary',
        analysisCachedAt: cachedAt - 1000,
        analysisServedFromCache: true,
      };

      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(instance.state.aiAnalysis).toBe('new summary after expiry');
      expect(instance.state.analysisName).toBe('Fresh After Expiry');
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
      const refreshed = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      expect(refreshed.entry.cachedAt).toBe(cachedAt);
      expect(refreshed.entry.result.summary).toBe('new summary after expiry');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('falls back to AI when the analysisCache read port throws', async () => {
    const now = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const realPeekCache = cacheScripts.peekCacheSync;
    let analysisReadAttempts = 0;
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug, options) => {
      if (namespace === 'analysisCache' && analysisReadAttempts === 0) {
        analysisReadAttempts += 1;
        throw new Error('analysis read failed');
      }
      return realPeekCache(namespace, slug, options);
    });
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'fallback summary after cache read error',
      details: 'fallback details',
      name: 'Fallback Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(instance.state.analysisName).toBe('Fallback Analysis');
      expect(instance.state.aiAnalysis).toBe('fallback summary after cache read error');
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
      expect(analysisReadAttempts).toBe(1);
    } finally {
      nowSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('forceRefresh bypasses analysisCache and overwrites the cached entry', async () => {
    const cachedAt = 1710000000000;
    const refreshedAt = cachedAt + 5000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(cachedAt);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'seed summary',
      details: 'seed details',
      name: 'Seed Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();
      const seeded = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });

      analyzeUserOpinions.mockClear();
      analyzeUserOpinions.mockResolvedValueOnce({
        summary: 'force refreshed summary',
        details: 'force refreshed details',
        name: 'Force Refreshed Analysis',
        historicalAlignment: {
          figure: 'Katherine Johnson',
          reasoning: 'Fresh calculation.',
        },
      });
      nowSpy.mockReturnValue(refreshedAt);

      await instance.analyzeUser(true);

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(instance.state.analysisName).toBe('Force Refreshed Analysis');
      expect(instance.state.analysisServedFromCache).toBe(false);
      const refreshed = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      expect(refreshed.fingerprint).toBe(seeded.fingerprint);
      expect(refreshed.entry.cachedAt).toBe(refreshedAt);
      expect(refreshed.entry.result.summary).toBe('force refreshed summary');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('prefers in-scope open-gate session over stale cache slugs for analyze routing', async () => {
    const inScopeSlug = 'in-scope-open-session';
    const secondaryScopeSlug = 'in-scope-secondary-session';
    const staleCacheSlug = 'stale-cache-session';

    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [inScopeSlug, secondaryScopeSlug];
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: inScopeSlug,
    });
    jest
      .spyOn(cacheScripts, 'listNamespaceSlugsSync')
      .mockImplementation((namespace) => (namespace === 'userCache' ? [staleCacheSlug, inScopeSlug] : []));
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((slug) => ({ slug }));
    checkSponsoredAccess.mockResolvedValue({
      status: 'no-gate',
      gate: null,
      resourceKey: 'ai',
    });

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: inScopeSlug,
        sessionConfig: expect.objectContaining({ slug: inScopeSlug }),
        sessionSelection: expect.objectContaining({
          gateStatus: 'no-gate',
          reason: 'open-ai-gate',
        }),
      }),
    );
  });

  it('keeps the active session candidate even when strict list scope excludes it', () => {
    const inScopeSlug = 'in-scope-open-session';
    const outOfScopeActiveSlug = 'active-out-of-scope-session';
    const staleCacheSlug = 'stale-cache-session';

    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [inScopeSlug];
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: outOfScopeActiveSlug,
    });
    jest
      .spyOn(cacheScripts, 'listNamespaceSlugsSync')
      .mockImplementation((namespace) => (namespace === 'userCache' ? [staleCacheSlug] : []));

    const candidates = instance._getAiSessionSlugCandidates();

    expect(candidates).toEqual([outOfScopeActiveSlug, inScopeSlug]);
  });

  it('uses the active primary session for single-session behavior while preserving the full list scope for deep-scan ordering', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = ['', 'edge'];
    const instance = makeInstance({
      activeSessionSlug: 'primary-session',
    });

    expect(instance.getActiveSessionSlug()).toBe('primary-session');
    expect(instance._getDeepScanPrioritySlugs()).toEqual(['primary-session', '', 'edge']);
  });

  it('does not route analyze calls through default worker fallback when no exact session config resolves', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'missing-session-slug',
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['missing-session-slug']);
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockReturnValue(null);

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(instance.state.analyzing).toBe(false);
      expect(instance.state.analysisError).toContain('Unable to generate analysis');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[account]', '[UserPage] analyzeUser failed:', expect.any(Error));
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not treat demo-only slugs as valid analyze-session configs', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'rxc',
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['rxc']);
    const exactSpy = jest.spyOn(instance, '_getSessionConfigForSlugExact');
    const demoSpy = jest.spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug').mockReturnValue({
      slug: 'rxc',
      sessionName: 'Weyl v. Yarvin Debate',
    });

    try {
      const session = await instance.resolveAnalysisSessionContext();

      expect(session).toBeNull();
      expect(checkSponsoredAccess).not.toHaveBeenCalled();
      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(demoSpy).not.toHaveBeenCalled();
      expect(exactSpy).toHaveBeenCalledWith('rxc');
      expect(instance._getSessionConfigForSlugExact('rxc')).toBeNull();
    } finally {
      exactSpy.mockRestore();
      demoSpy.mockRestore();
    }
  });

  it('does not treat demo-only alias session keys as valid analyze-session configs', () => {
    const instance = makeInstance();
    const aliasConfig = instance._getSessionConfigForSlugExact('legacyEdge');

    expect(aliasConfig).toBeNull();
  });

  it('does not treat unknown non-general slugs as valid analyze-session configs', () => {
    const instance = makeInstance();
    const unresolved = instance._getSessionConfigForSlugExact('slug-that-does-not-exist-xyz');

    expect(unresolved).toBeNull();
  });

  it('preserves explicit general analyze-session configs when an authoritative empty-slug config exists', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
          },
        },
      }),
    );

    try {
      const instance = makeInstance();
      const general = instance._getSessionConfigForSlugExact('');

      expect(general).toEqual(
        expect.objectContaining({
          slug: '',
          sessionName: 'Registry General',
        }),
      );
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });
});
