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

const mockListNamespaceEntriesSync = cacheScripts.listNamespaceEntriesSync as jest.Mock;
const buildSourceSignature = buildBookmarkPageSourceSignature as (payload: any) => string;
const buildDataSignature = buildBookmarkPageDataSignature as (payload: any) => string;
const readEntries = readManagedBookmarkPageEntries as () => {
  bookmarkEntries: unknown[];
  filtersEntries: unknown[];
};

describe('BookmarksPage cache scan helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads bookmark and filter namespaces with cloneValues disabled', () => {
    mockListNamespaceEntriesSync
      .mockImplementationOnce(() => [{ slug: 'edge', value: { users: [] } }])
      .mockImplementationOnce(() => [{ slug: 'edge', value: { bookmarkedFilters: [] } }]);

    const result = readEntries();

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
    const refIds = new WeakMap<object, string>();
    let nextRefId = 1;
    const getRefId = (value: unknown) => {
      if (!value || typeof value !== 'object') return `p:${String(value)}`;
      let ref = refIds.get(value);
      if (!ref) {
        ref = `o:${nextRefId}`;
        nextRefId += 1;
        refIds.set(value, ref);
      }
      return ref;
    };

    const first = buildSourceSignature({
      bookmarkEntries: [{ key: 'dg:bookmarksCache:edge', slug: 'edge', value: valueA }],
      filtersEntries: [{ key: 'dg:filters:edge', slug: 'edge', value: valueA }],
      legacyBookmarksRaw: '{"sbts":["0x1"]}',
      atlasNodesRaw: '["node-1"]',
      getRefId,
    });
    const second = buildSourceSignature({
      bookmarkEntries: [{ key: 'dg:bookmarksCache:edge', slug: 'edge', value: valueA }],
      filtersEntries: [{ key: 'dg:filters:edge', slug: 'edge', value: valueA }],
      legacyBookmarksRaw: '{"sbts":["0x1"]}',
      atlasNodesRaw: '["node-1"]',
      getRefId,
    });
    const changed = buildSourceSignature({
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

    expect(buildDataSignature(clone)).toBe(buildDataSignature(base));
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
