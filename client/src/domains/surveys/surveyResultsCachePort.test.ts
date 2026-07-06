import {
  bindSurveyResultsCachePort,
  type SurveyResultsCacheScriptsModule,
  type SurveyResultsCacheUpdateHandler,
} from './surveyResultsCachePort';

const createCacheScripts = (): SurveyResultsCacheScriptsModule => ({
  listNamespaceEntriesSync: jest.fn(() => []),
  peekCacheSync: jest.fn(() => null),
  readCache: jest.fn(async () => null),
  subscribeCacheUpdates: jest.fn(() => jest.fn()),
  writeCache: jest.fn(async () => true),
});

describe('surveyResultsCachePort', () => {
  it('routes cache reads, writes, lists, and subscriptions with unchanged arguments', async () => {
    const cacheScripts = createCacheScripts();
    const unsubscribe = jest.fn();
    const updateHandler: SurveyResultsCacheUpdateHandler = jest.fn();
    (cacheScripts.peekCacheSync as jest.Mock).mockReturnValue({ cached: true });
    (cacheScripts.readCache as jest.Mock).mockResolvedValue({ asyncCached: true });
    (cacheScripts.writeCache as jest.Mock).mockResolvedValue('written');
    (cacheScripts.listNamespaceEntriesSync as jest.Mock).mockReturnValue([
      { namespace: 'surveysCache', slug: 'alpha', value: { survey: true } },
    ]);
    (cacheScripts.subscribeCacheUpdates as jest.Mock).mockReturnValue(unsubscribe);

    const port = bindSurveyResultsCachePort({
      cacheScripts: () => cacheScripts,
    });

    expect(port.peekCacheSync('bookmarksCache', 'edge', { clone: false })).toEqual({ cached: true });
    await expect(port.readCache('analysisCache', 'edge')).resolves.toEqual({ asyncCached: true });
    await expect(port.writeCache('filters', 'edge', { bookmarkedFilters: [] })).resolves.toBe('written');
    expect(port.listNamespaceEntriesSync('surveysCache', { cloneValues: false })).toEqual([
      { namespace: 'surveysCache', slug: 'alpha', value: { survey: true } },
    ]);
    expect(port.subscribeCacheUpdates(updateHandler)).toBe(unsubscribe);

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(cacheScripts.readCache).toHaveBeenCalledWith('analysisCache', 'edge');
    expect(cacheScripts.writeCache).toHaveBeenCalledWith('filters', 'edge', { bookmarkedFilters: [] });
    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenCalledWith('surveysCache', { cloneValues: false });
    expect(cacheScripts.subscribeCacheUpdates).toHaveBeenCalledWith(updateHandler);
  });

  it('performs call-time cacheScripts lookup so spies and replacements stay live', async () => {
    const firstRead = jest.fn(async () => 'first');
    const secondRead = jest.fn(async () => 'second');
    const firstWrite = jest.fn(async () => 'old-write');
    const secondWrite = jest.fn(async () => 'new-write');
    const cacheScripts = {
      ...createCacheScripts(),
      readCache: firstRead,
      writeCache: firstWrite,
    };
    const port = bindSurveyResultsCachePort({
      cacheScripts: () => cacheScripts,
    });

    await expect(port.readCache('questionsCache', 'alpha')).resolves.toBe('first');
    await expect(port.writeCache('bookmarksCache', 'alpha', { questions: [] })).resolves.toBe('old-write');

    cacheScripts.readCache = secondRead;
    cacheScripts.writeCache = secondWrite;

    await expect(port.readCache('questionsCache', 'beta')).resolves.toBe('second');
    await expect(port.writeCache('bookmarksCache', 'beta', { questions: ['q1'] })).resolves.toBe('new-write');

    expect(firstRead).toHaveBeenCalledWith('questionsCache', 'alpha');
    expect(secondRead).toHaveBeenCalledWith('questionsCache', 'beta');
    expect(firstWrite).toHaveBeenCalledWith('bookmarksCache', 'alpha', { questions: [] });
    expect(secondWrite).toHaveBeenCalledWith('bookmarksCache', 'beta', { questions: ['q1'] });
  });
});
