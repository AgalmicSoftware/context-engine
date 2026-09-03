import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { surveyResultsCachePort, type SurveyResultsCacheUpdateHandler } from './surveyResultsCachePort';

describe('surveyResultsCachePort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes cache reads, writes, lists, and subscriptions with unchanged arguments', async () => {
    const unsubscribe = jest.fn();
    const updateHandler: SurveyResultsCacheUpdateHandler = jest.fn();
    const peekCacheSync = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ cached: true });
    const readCache = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({ asyncCached: true });
    const writeCache = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue('written' as never);
    const listNamespaceEntriesSync = jest
      .spyOn(cacheScripts, 'listNamespaceEntriesSync')
      .mockReturnValue([{ namespace: 'surveysCache', slug: 'alpha', value: { survey: true } }] as never);
    const subscribeCacheUpdates = jest.spyOn(cacheScripts, 'subscribeCacheUpdates').mockReturnValue(unsubscribe);

    expect(surveyResultsCachePort.peekCacheSync('bookmarksCache', 'edge', { clone: false })).toEqual({ cached: true });
    await expect(surveyResultsCachePort.readCache('analysisCache', 'edge')).resolves.toEqual({ asyncCached: true });
    await expect(surveyResultsCachePort.writeCache('filters', 'edge', { bookmarkedFilters: [] })).resolves.toBe(
      'written',
    );
    expect(surveyResultsCachePort.listNamespaceEntriesSync('surveysCache', { cloneValues: false })).toEqual([
      { namespace: 'surveysCache', slug: 'alpha', value: { survey: true } },
    ]);
    expect(surveyResultsCachePort.subscribeCacheUpdates(updateHandler)).toBe(unsubscribe);

    expect(peekCacheSync).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(readCache).toHaveBeenCalledWith('analysisCache', 'edge');
    expect(writeCache).toHaveBeenCalledWith('filters', 'edge', { bookmarkedFilters: [] });
    expect(listNamespaceEntriesSync).toHaveBeenCalledWith('surveysCache', { cloneValues: false });
    expect(subscribeCacheUpdates).toHaveBeenCalledWith(updateHandler);
  });

  it('performs call-time cacheScripts lookup so spies and replacements stay live', async () => {
    const readCache = jest
      .spyOn(cacheScripts, 'readCache')
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const writeCache = jest
      .spyOn(cacheScripts, 'writeCache')
      .mockResolvedValueOnce('old-write' as never)
      .mockResolvedValueOnce('new-write' as never);

    await expect(surveyResultsCachePort.readCache('questionsCache', 'alpha')).resolves.toBe('first');
    await expect(surveyResultsCachePort.writeCache('bookmarksCache', 'alpha', { questions: [] })).resolves.toBe(
      'old-write',
    );
    await expect(surveyResultsCachePort.readCache('questionsCache', 'beta')).resolves.toBe('second');
    await expect(surveyResultsCachePort.writeCache('bookmarksCache', 'beta', { questions: ['q1'] })).resolves.toBe(
      'new-write',
    );

    expect(readCache).toHaveBeenNthCalledWith(1, 'questionsCache', 'alpha');
    expect(readCache).toHaveBeenNthCalledWith(2, 'questionsCache', 'beta');
    expect(writeCache).toHaveBeenNthCalledWith(1, 'bookmarksCache', 'alpha', { questions: [] });
    expect(writeCache).toHaveBeenNthCalledWith(2, 'bookmarksCache', 'beta', { questions: ['q1'] });
  });
});
