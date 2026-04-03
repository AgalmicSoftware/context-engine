import {
  buildSurveyBookmarkHref,
  buildBookmarkPageDataSignature,
  buildBookmarkPageSourceSignature,
  readManagedBookmarkPageEntries,
} from './BookmarksPage.jsx';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  listNamespaceEntriesSync: jest.fn(() => []),
  subscribeCacheUpdates: jest.fn(() => () => {}),
}));

describe('BookmarksPage cache scan helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads bookmark and filter namespaces with cloneValues disabled', () => {
    cacheScripts.listNamespaceEntriesSync
      .mockImplementationOnce(() => [{ slug: 'edge', value: { users: [] } }])
      .mockImplementationOnce(() => [{ slug: 'edge', value: { bookmarkedFilters: [] } }]);

    const result = readManagedBookmarkPageEntries();

    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenNthCalledWith(
      1,
      'bookmarksCache',
      { cloneValues: false }
    );
    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenNthCalledWith(
      2,
      'filters',
      { cloneValues: false }
    );
    expect(result.bookmarkEntries).toHaveLength(1);
    expect(result.filtersEntries).toHaveLength(1);
  });

  it('builds stable source signatures for unchanged cache entry refs', () => {
    const valueA = { users: [] };
    const valueB = { users: [] };
    const refIds = new WeakMap();
    let nextRefId = 1;
    const getRefId = (value) => {
      if (!value || typeof value !== 'object') return `p:${String(value)}`;
      let ref = refIds.get(value);
      if (!ref) {
        ref = `o:${nextRefId}`;
        nextRefId += 1;
        refIds.set(value, ref);
      }
      return ref;
    };

    const first = buildBookmarkPageSourceSignature({
      bookmarkEntries: [{ key: 'dg:bookmarksCache:edge', slug: 'edge', value: valueA }],
      filtersEntries: [{ key: 'dg:filters:edge', slug: 'edge', value: valueA }],
      legacyBookmarksRaw: '{"sbts":["0x1"]}',
      atlasNodesRaw: '["node-1"]',
      getRefId,
    });
    const second = buildBookmarkPageSourceSignature({
      bookmarkEntries: [{ key: 'dg:bookmarksCache:edge', slug: 'edge', value: valueA }],
      filtersEntries: [{ key: 'dg:filters:edge', slug: 'edge', value: valueA }],
      legacyBookmarksRaw: '{"sbts":["0x1"]}',
      atlasNodesRaw: '["node-1"]',
      getRefId,
    });
    const changed = buildBookmarkPageSourceSignature({
      bookmarkEntries: [{ key: 'dg:bookmarksCache:edge', slug: 'edge', value: valueB }],
      filtersEntries: [{ key: 'dg:filters:edge', slug: 'edge', value: valueA }],
      legacyBookmarksRaw: '{"sbts":["0x1"]}',
      atlasNodesRaw: '["node-1"]',
      getRefId,
    });

    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('returns identical data signatures for equivalent bookmark page payloads', () => {
    const base = {
      users: [{ address: '0xabc', nickname: '', username: '', networkId: '' }],
      surveys: ['s1'],
      questions: ['q1'],
      sbts: ['0x1'],
      filters: [{ key: 'k1', raw: 'x', parsed: {} }],
      atlasNodes: ['node-1'],
    };
    const clone = JSON.parse(JSON.stringify(base));

    expect(buildBookmarkPageDataSignature(clone)).toBe(buildBookmarkPageDataSignature(base));
  });

  it('builds survey bookmark links without inheriting route session hints', () => {
    const priorUrl = window.location.href;
    try {
      window.history.replaceState({}, '', '/bookmarks?session=edge');
      expect(buildSurveyBookmarkHref('0xabc')).toBe('/survey/0xabc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });
});
