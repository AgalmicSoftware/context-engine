import type {
  GroupSlugLookupRecord,
  GroupSlugLookupDeps,
  QuestionGroupSlugLookupDeps,
  SbtSlugResolveDeps,
} from './groupSlugLookup.js';
import { findGroupSlugForQuestion, findGroupSlugForSurvey, resolveGroupSlugForSbtAddress } from './groupSlugLookup.js';

type CollectionCache = Record<string, Record<string, GroupSlugLookupRecord>>;
type SessionCfgMap = Record<string, GroupSlugLookupRecord>;

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const normalizeSessionSlug = (value: unknown): string => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

const isLookupRecord = (value: unknown): value is GroupSlugLookupRecord => value !== null && typeof value === 'object';

const readMetadataSessionSlug = (metadata: unknown, fallbackSlug: string): string => {
  if (!isLookupRecord(metadata)) return normalizeSessionSlug(fallbackSlug);
  return normalizeSessionSlug(metadata.sessionSlug ?? metadata.slug ?? fallbackSlug);
};

const buildGroupDeps = ({
  currentSlug = 'current',
  queryHintSlug = null,
  isCacheManagerReady = true,
  sessionCfgs = { current: { slug: 'current' } },
  caches = {},
  allSlugs = ['current'],
  referrerSlug = null,
  resolveMetadataSessionSlug = readMetadataSessionSlug,
}: {
  currentSlug?: string;
  queryHintSlug?: string | null;
  isCacheManagerReady?: boolean;
  sessionCfgs?: SessionCfgMap;
  caches?: CollectionCache;
  allSlugs?: string[];
  referrerSlug?: string | null;
  resolveMetadataSessionSlug?: (metadata: unknown, fallbackSlug: string) => string;
} = {}): GroupSlugLookupDeps => ({
  getCurrentSlug: () => currentSlug,
  getQueryHintSlug: () => queryHintSlug,
  isCacheManagerReady,
  getSessionCfg: (slug: string) => sessionCfgs[slug] ?? null,
  dgRead: (collection: string, slug: string) => caches[collection]?.[slug] ?? null,
  resolveMetadataSessionSlug,
  getAllSessionSlugs: () => allSlugs,
  normalizeSessionSlug,
  getReferrerSlug: () => referrerSlug,
});

const buildQuestionDeps = (
  overrides: Parameters<typeof buildGroupDeps>[0] & {
    isKnownOrGeneralSessionSlug?: (slug: string) => boolean;
  } = {},
): QuestionGroupSlugLookupDeps => ({
  ...buildGroupDeps(overrides),
  isKnownOrGeneralSessionSlug: overrides.isKnownOrGeneralSessionSlug ?? (() => false),
});

const buildSbtDeps = ({
  fallbackSlug = 'fallback',
  isValidAddress = (addr: string) => addr === ADDRESS,
  scanScope = 'all',
  scopedSlugs = ['fallback'],
  allSlugs = ['fallback'],
  caches = {},
  getSbtMetadata = async () => null,
  getSbtCreationBlockByAddress = async () => null,
  getSessionSlugByName = () => null,
  getSessionConfigBySlugOrDefault = () => ({}),
  resolveMetadataSessionSlug = readMetadataSessionSlug,
}: {
  fallbackSlug?: string;
  isValidAddress?: (addr: string) => boolean;
  scanScope?: string;
  scopedSlugs?: string[];
  allSlugs?: string[];
  caches?: CollectionCache;
  getSbtMetadata?: (
    provider: string,
    address: string,
    slug: string,
  ) => Promise<GroupSlugLookupRecord | null | undefined>;
  getSbtCreationBlockByAddress?: (provider: string, address: string, slug: string) => Promise<number | null>;
  getSessionSlugByName?: (name: unknown) => string | null;
  getSessionConfigBySlugOrDefault?: (slug: string) => GroupSlugLookupRecord | null | undefined;
  resolveMetadataSessionSlug?: (metadata: unknown, fallbackSlug: string) => string;
} = {}): SbtSlugResolveDeps => ({
  fallbackSlug,
  isValidAddress,
  getSessionScanScope: () => scanScope,
  getScopedSessionSlugs: () => scopedSlugs,
  getAllSessionSlugs: () => allSlugs,
  dgRead: (collection: string, slug: string) => caches[collection]?.[slug] ?? null,
  getSbtMetadata,
  getSbtCreationBlockByAddress,
  normalizeSessionSlug,
  getSessionSlugByName,
  getSessionConfigBySlugOrDefault,
  resolveMetadataSessionSlug,
});

describe('groupSlugLookup survey resolution', () => {
  it('pins the query slug during bootstrap when caches are not ready', () => {
    const deps = buildGroupDeps({
      queryHintSlug: 'hinted',
      isCacheManagerReady: false,
      sessionCfgs: { current: { slug: 'current' } },
    });

    expect(findGroupSlugForSurvey('survey-1', deps)).toBe('hinted');
  });

  it('matches highlighted survey ids from session config', () => {
    const deps = buildGroupDeps({
      sessionCfgs: {
        current: {
          slug: 'current',
          HIGHLIGHTED_SURVEY_IDS: ['SURVEY-1'],
        },
      },
    });

    expect(findGroupSlugForSurvey('survey-1', deps)).toBe('current');
  });

  it('returns a cache hit on the current slug', () => {
    const deps = buildGroupDeps({
      caches: {
        surveysCache: {
          current: {
            '11155420': {
              surveys: {
                'survey-1': { sessionSlug: 'current' },
              },
            },
          },
        },
      },
    });

    expect(findGroupSlugForSurvey('survey-1', deps)).toBe('current');
  });

  it('falls back to the referrer slug when no cache hit exists', () => {
    const deps = buildGroupDeps({
      sessionCfgs: {
        current: { slug: 'current' },
        referrer: { slug: 'referrer' },
      },
      allSlugs: ['current', 'referrer'],
      referrerSlug: 'referrer',
    });

    expect(findGroupSlugForSurvey('survey-1', deps)).toBe('referrer');
  });

  it('finds surveys by scanning other session caches', () => {
    const deps = buildGroupDeps({
      sessionCfgs: {
        current: { slug: 'current' },
        other: { slug: 'other' },
      },
      caches: {
        surveysCache: {
          other: {
            '11155420': {
              surveys: {
                'survey-1': { sessionSlug: 'other' },
              },
            },
          },
        },
      },
      allSlugs: ['current', 'other'],
    });

    expect(findGroupSlugForSurvey('survey-1', deps)).toBe('other');
  });

  it('returns the current slug when no survey id is provided', () => {
    const deps = buildGroupDeps({ currentSlug: 'current' });

    expect(findGroupSlugForSurvey(null, deps)).toBe('current');
  });

  it('continues to fallback when getSessionCfg throws during referrer validation', () => {
    const warn = jest.fn();
    let cfgCallCount = 0;
    const deps: GroupSlugLookupDeps = {
      ...buildGroupDeps({
        allSlugs: ['current'],
        referrerSlug: 'bad-ref',
      }),
      getSessionCfg: (slug: string) => {
        if (slug === 'bad-ref') {
          cfgCallCount++;
          if (cfgCallCount === 1) throw new Error('cfg lookup failed');
        }
        return null;
      },
      warn,
    };

    expect(findGroupSlugForSurvey('survey-1', deps)).toBe('current');
    expect(warn).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('groupSlugLookup question resolution', () => {
  it('returns a cache hit from questionsCache', () => {
    const deps = buildQuestionDeps({
      caches: {
        questionsCache: {
          current: {
            '11155420': {
              questions: {
                'question-1': { sessionSlug: 'current' },
              },
            },
          },
        },
      },
    });

    expect(findGroupSlugForQuestion('question-1', deps)).toBe('current');
  });

  it('returns a cache hit from survey questionIDs', () => {
    const deps = buildQuestionDeps({
      caches: {
        surveysCache: {
          current: {
            '11155420': {
              surveys: {
                'survey-1': {
                  sessionSlug: 'linked-group',
                  questionIDs: ['QUESTION-1'],
                },
              },
            },
          },
        },
      },
    });

    expect(findGroupSlugForQuestion('question-1', deps)).toBe('linked-group');
  });

  it('pins the query slug when it is known or general', () => {
    const deps = buildQuestionDeps({
      queryHintSlug: 'hinted',
      isKnownOrGeneralSessionSlug: (slug: string) => slug === 'hinted',
    });

    expect(findGroupSlugForQuestion('question-1', deps)).toBe('hinted');
  });

  it('falls back to the referrer slug before the current slug', () => {
    const referrerDeps = buildQuestionDeps({
      sessionCfgs: {
        current: { slug: 'current' },
        referrer: { slug: 'referrer' },
      },
      allSlugs: ['current', 'referrer'],
      referrerSlug: 'referrer',
    });

    expect(findGroupSlugForQuestion('question-1', referrerDeps)).toBe('referrer');

    const currentFallbackDeps = buildQuestionDeps({
      sessionCfgs: { current: { slug: 'current' } },
      referrerSlug: 'unknown',
    });

    expect(findGroupSlugForQuestion('question-1', currentFallbackDeps)).toBe('current');
  });

  it('continues to fallback when getSessionCfg throws during referrer validation', () => {
    const warn = jest.fn();
    let cfgCallCount = 0;
    const deps: QuestionGroupSlugLookupDeps = {
      ...buildQuestionDeps({
        allSlugs: ['current'],
        referrerSlug: 'bad-ref',
      }),
      getSessionCfg: (slug: string) => {
        if (slug === 'bad-ref') {
          cfgCallCount++;
          if (cfgCallCount === 1) throw new Error('cfg lookup failed');
        }
        return null;
      },
      warn,
    };

    expect(findGroupSlugForQuestion('question-1', deps)).toBe('current');
    expect(warn).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('groupSlugLookup sbt resolution', () => {
  it('returns a cache hit from sbtCache', async () => {
    const deps = buildSbtDeps({
      fallbackSlug: 'fallback',
      allSlugs: ['fallback', 'cached'],
      caches: {
        sbtCache: {
          cached: {
            '11155420': {
              sbtList: {
                [ADDRESS.toLowerCase()]: { slug: 'cached-owner' },
              },
            },
          },
        },
      },
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('cached-owner');
  });

  it('returns an explicit sessionSlug from metadata', async () => {
    const deps = buildSbtDeps({
      getSbtMetadata: async () => ({
        sessionSlug: 'Meta-Group',
        sessionSlugExplicit: true,
      }),
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('meta-group');
  });

  it('resolves a session slug from metadata sessionName lookup', async () => {
    const deps = buildSbtDeps({
      getSbtMetadata: async () => ({
        sessionName: 'Alpha Group',
      }),
      getSessionSlugByName: (name: unknown) => (name === 'Alpha Group' ? 'alpha-group' : null),
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('alpha-group');
  });

  it('scans factory slugs in descending block-start order', async () => {
    const getSbtCreationBlockByAddress = jest.fn(async (_provider: string, _address: string, slug: string) => {
      if (slug === 'middle') return 123;
      return null;
    });

    const deps = buildSbtDeps({
      allSlugs: ['older', 'newer', 'middle'],
      getSbtMetadata: async () => ({}),
      getSessionConfigBySlugOrDefault: (slug: string) => ({
        blockLimits: {
          start:
            {
              older: 10,
              newer: 100,
              middle: 50,
            }[slug] ?? -1,
        },
      }),
      getSbtCreationBlockByAddress,
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('middle');
    expect(getSbtCreationBlockByAddress.mock.calls.map(([, , slug]) => slug)).toEqual(['newer', 'middle']);
  });

  it('returns the fallback slug for invalid addresses', async () => {
    const deps = buildSbtDeps({
      fallbackSlug: 'fallback',
      isValidAddress: () => false,
    });

    await expect(resolveGroupSlugForSbtAddress('not-an-address', deps)).resolves.toBe('fallback');
  });

  it('returns first scoped slug for non-all non-list scope', async () => {
    const deps = buildSbtDeps({
      fallbackSlug: 'fallback',
      scanScope: 'active',
      scopedSlugs: ['active-group'],
      allSlugs: ['active-group', 'other'],
      getSbtMetadata: async () => ({}),
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('active-group');
  });

  it('probes scoped slugs via creation block in list mode', async () => {
    const getSbtCreationBlockByAddress = jest.fn(async (_p: string, _a: string, slug: string) => {
      if (slug === 'list-b') return 500;
      return null;
    });

    const deps = buildSbtDeps({
      fallbackSlug: 'fallback',
      scanScope: 'list',
      scopedSlugs: ['list-a', 'list-b'],
      allSlugs: ['list-a', 'list-b'],
      getSbtMetadata: async () => ({}),
      getSbtCreationBlockByAddress,
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('list-b');
    expect(getSbtCreationBlockByAddress).toHaveBeenCalledTimes(2);
  });

  it('returns first scoped slug when list probe finds nothing', async () => {
    const deps = buildSbtDeps({
      fallbackSlug: 'fallback',
      scanScope: 'list',
      scopedSlugs: ['list-a', 'list-b'],
      allSlugs: ['list-a', 'list-b'],
      getSbtMetadata: async () => ({}),
      getSbtCreationBlockByAddress: async () => null,
    });

    await expect(resolveGroupSlugForSbtAddress(ADDRESS, deps)).resolves.toBe('list-a');
  });
});
