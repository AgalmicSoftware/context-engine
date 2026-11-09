import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import { setWorkerCanonicalCacheReader } from '../../utilities/survey/workerCanonicalCacheReader';
import {
  readSurveyToolScopedCacheNode,
  persistSurveyToolCachePatchForCurrentTarget,
  resolveSurveyToolWorkerTargetSignature,
  shouldUseSurveyToolChainCacheMissFallback,
} from './surveyToolWorkerCacheIsolation';

const makeConfig = (workerOrigin: string, sessionId: string) => ({
  slug: 'worker-session',
  sessionId,
  corsWorkerUrl: workerOrigin,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
    },
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      mode: 'authorized_read',
    },
  },
});

describe('surveyToolWorkerCacheIsolation', () => {
  it('reads a Worker cache node only for the exact origin, slug, and session id', () => {
    const configA = makeConfig('https://a.example.com', '0x00112233445566778899aabbccddeeff');
    const configB = makeConfig('https://b.example.com', '0xffeeddccbbaa99887766554433221100');
    const identityA = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: configA,
      sessionSlug: 'worker-session',
    });
    const worker = withWorkerCanonicalCacheIdentity(
      {
        surveys: {
          '0xsurvey': { title: 'Worker A survey' },
        },
      },
      identityA,
    );
    const cache = { worker };

    expect(
      readSurveyToolScopedCacheNode({
        cache,
        cacheScope: 'worker',
        sessionConfig: configA,
        sessionSlug: 'worker-session',
      }),
    ).toBe(worker);
    expect(
      readSurveyToolScopedCacheNode({
        cache,
        cacheScope: 'worker',
        sessionConfig: configB,
        sessionSlug: 'worker-session',
      }),
    ).toBeNull();
  });

  it('keeps ordinary chain cache nodes readable', () => {
    const chainNode = { surveys: {} };
    expect(
      readSurveyToolScopedCacheNode({
        cache: { '11155420': chainNode },
        cacheScope: '11155420',
      }),
    ).toBe(chainNode);
  });

  it('reads chain text decrypted for another reader, or while signed out, locked without changing the cache', () => {
    const open = { prompt: 'Open prompt' };
    const node = {
      questions: {
        open,
        own: { prompt: 'Private prompt', promptEncrypted: 'envelope', promptDecrypted: true, decryptedFor: '0xaaa' },
      },
      surveys: {
        own: {
          title: 'Private title',
          titleDecrypted: true,
          documentURLs: ['https://docs.example/private'],
          documentURLsDecrypted: true,
          decryptedFor: '0xaaa',
        },
      },
    };
    const cache = { '11155420': node };
    const stored = JSON.stringify(cache);
    const read = () => readSurveyToolScopedCacheNode({ cache, cacheScope: '11155420' }) as typeof node;

    try {
      setWorkerCanonicalCacheReader('0xAAA');
      expect(read()).toBe(node);
      for (const reader of ['0xbbb', '']) {
        setWorkerCanonicalCacheReader(reader);
        expect(read().questions.own).toEqual({ prompt: '[encrypted]', promptEncrypted: 'envelope' });
        expect(read().questions.open).toBe(open);
        expect(read().surveys.own).toEqual({ title: '[encrypted]', documentURLs: [] });
      }
      expect(JSON.stringify(cache)).toBe(stored);
    } finally {
      setWorkerCanonicalCacheReader('');
    }
  });

  it('allows chain fallback only for a resolved chain cache scope', () => {
    expect(shouldUseSurveyToolChainCacheMissFallback('')).toBe(false);
    expect(shouldUseSurveyToolChainCacheMissFallback(undefined)).toBe(false);
    expect(shouldUseSurveyToolChainCacheMissFallback('worker')).toBe(false);
    expect(shouldUseSurveyToolChainCacheMissFallback('11155420')).toBe(true);
  });

  it('resets and stamps generic cache writes for the exact Worker target', () => {
    const configA = makeConfig('https://a.example.com', '0x00112233445566778899aabbccddeeff');
    const configB = makeConfig('https://b.example.com', '0xffeeddccbbaa99887766554433221100');
    const identityA = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: configA,
      sessionSlug: 'worker-session',
    });
    const readSurveysCache = jest.fn(() => ({
      worker: withWorkerCanonicalCacheIdentity(
        {
          surveys: {
            old: { id: 'old' },
          },
          surveyResponses: {},
        },
        identityA,
      ),
    }));
    const writeSurveysCache = jest.fn();

    expect(
      persistSurveyToolCachePatchForCurrentTarget({
        expectedContext: {
          networkIdStr: 'worker',
          sessionConfig: configB,
          sessionSlug: 'worker-session',
        },
        expectedSessionSlug: 'worker-session',
        getCurrentContext: () => ({
          networkIdStr: 'worker',
          sessionConfig: configB,
          sessionSlug: 'worker-session',
        }),
        patch: {
          surveys: {
            fresh: { id: 'fresh' },
          },
        },
        readSurveysCache,
        writeSurveysCache,
      }),
    ).toBe(true);

    const writtenWorkerNode = writeSurveysCache.mock.calls[0][1].worker;
    expect(writtenWorkerNode.surveys.old).toBeUndefined();
    expect(writtenWorkerNode.surveys.fresh).toEqual({ id: 'fresh' });
    expect(
      resolveSurveyToolWorkerTargetSignature({
        sessionConfig: configB,
        sessionSlug: 'worker-session',
      }).identity,
    ).toEqual(writtenWorkerNode.workerCanonicalIdentity);
  });

  it('drops a generic cache write when the same slug changes Worker target before persistence', () => {
    const configA = makeConfig('https://a.example.com', '0x00112233445566778899aabbccddeeff');
    const configB = makeConfig('https://b.example.com', '0xffeeddccbbaa99887766554433221100');
    const writeSurveysCache = jest.fn();

    expect(
      persistSurveyToolCachePatchForCurrentTarget({
        expectedContext: {
          networkIdStr: 'worker',
          sessionConfig: configA,
          sessionSlug: 'worker-session',
        },
        expectedSessionSlug: 'worker-session',
        getCurrentContext: () => ({
          networkIdStr: 'worker',
          sessionConfig: configB,
          sessionSlug: 'worker-session',
        }),
        patch: { surveys: { stale: { id: 'stale' } } },
        readSurveysCache: () => ({}),
        writeSurveysCache,
      }),
    ).toBe(false);
    expect(writeSurveysCache).not.toHaveBeenCalled();
  });
});
