import { resolveSlugForIds } from './surveyToolSlugLookup.js';
import { getAllSessionSlugs, getSessionConfigBySlug, getSessionSlugByName } from '../../utilities/web3/chainGateway.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  getAllSessionSlugs: jest.fn(() => []),
  getSessionConfigBySlug: jest.fn(() => null),
  getSessionSlugByName: jest.fn(() => null),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => ({})),
  readCache: jest.fn(async () => ({})),
  writeCacheOptimistic: jest.fn((_: string, __: string, value: unknown) => value),
}));

const mockedGetAllSessionSlugs = getAllSessionSlugs as jest.MockedFunction<typeof getAllSessionSlugs>;
const mockedGetSessionConfigBySlug = getSessionConfigBySlug as jest.MockedFunction<typeof getSessionConfigBySlug>;
const mockedGetSessionSlugByName = getSessionSlugByName as jest.MockedFunction<typeof getSessionSlugByName>;
const mockedPeekCacheSync = peekCacheSync as jest.MockedFunction<typeof peekCacheSync>;

describe('surveyToolSlugLookup', () => {
  beforeEach(() => {
    mockedGetAllSessionSlugs.mockReset();
    mockedGetSessionConfigBySlug.mockReset();
    mockedGetSessionSlugByName.mockReset();
    mockedPeekCacheSync.mockReset();

    mockedGetAllSessionSlugs.mockReturnValue([]);
    mockedGetSessionSlugByName.mockReturnValue(null);
    mockedGetSessionConfigBySlug.mockImplementation((slug) => {
      if (slug === 'edge') {
        return {
          slug: 'edge',
          networkChainId: 84532,
        };
      }
      return null;
    });
    mockedPeekCacheSync.mockReturnValue({});
  });

  it('uses clone:false cache reads while resolving slug candidates by question id', () => {
    mockedGetAllSessionSlugs.mockReturnValue(['edge']);
    mockedPeekCacheSync.mockImplementation((namespace) => {
      if (namespace === 'questionsCache') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1' },
            },
          },
        };
      }
      return {};
    });

    const resolved = resolveSlugForIds({
      questionId: 'Q1',
      props: {
        network: { id: 84532 },
        activeSessionSlug: '',
      },
      network: { id: 84532 },
    });

    expect(resolved).toBe('edge');
    expect(mockedPeekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
  });

  it('does not resolve question ids from a borrowed general network cache when a candidate slug is unresolved', () => {
    const strictLookup = (slug: unknown) =>
      String(slug || '')
        .trim()
        .toLowerCase() === 'edge'
        ? { slug: 'edge', networkChainId: 84532 }
        : null;

    mockedGetAllSessionSlugs.mockReturnValue(['ghost', 'edge']);
    mockedGetSessionConfigBySlug.mockImplementation((slug) => strictLookup(slug));
    mockedPeekCacheSync.mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache') return {};
      if (slug === 'ghost') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Borrowed ghost prompt' },
            },
          },
        };
      }
      if (slug === 'edge') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Edge prompt' },
            },
          },
        };
      }
      return {};
    });

    const resolved = resolveSlugForIds({
      questionId: 'q1',
      props: {
        activeSessionSlug: 'missing-session-slug',
      },
      network: null,
    });

    expect(resolved).toBe('edge');
    expect(mockedPeekCacheSync).toHaveBeenCalledWith('questionsCache', 'ghost', { clone: false });
    expect(mockedPeekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
  });
});
