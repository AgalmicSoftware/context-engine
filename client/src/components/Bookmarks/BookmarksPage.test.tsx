import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import {
  default as BookmarksPage,
  buildQuestionBookmarkHref,
  buildSurveyBookmarkHref,
  buildBookmarkPageDataSignature,
  buildBookmarkPageSourceSignature,
  readManagedBookmarkPageEntries,
} from './BookmarksPage';
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
    window.localStorage.clear();
  });

  it('reads bookmark and filter namespaces with cloneValues disabled', () => {
    mockListNamespaceEntriesSync
      .mockImplementationOnce(() => [{ slug: 'edge', value: { users: [] } }])
      .mockImplementationOnce(() => [{ slug: 'edge', value: { bookmarkedFilters: [] } }]);

    const result = readEntries();

    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenNthCalledWith(1, 'bookmarksCache', { cloneValues: false });
    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenNthCalledWith(2, 'filters', { cloneValues: false });
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
      surveys: [{ id: 's1', sessionSlug: '' }],
      questions: [{ id: 'q1', sessionSlug: '' }],
      sbts: ['0x1'],
      filters: [{ key: 'k1', raw: 'x', parsed: {} }],
      atlasNodes: ['node-1'],
    };
    const clone = JSON.parse(JSON.stringify(base));

    expect(buildDataSignature(clone)).toBe(buildDataSignature(base));
  });

  it('builds bookmark links only from persisted session pins', () => {
    const priorUrl = window.location.href;
    try {
      window.history.replaceState({}, '', '/bookmarks?session=edge');
      expect(buildSurveyBookmarkHref('0xabc')).toBe('/survey/0xabc');
      expect(buildSurveyBookmarkHref({ id: '0xabc', sessionSlug: 'edge' })).toBe('/survey/0xabc?session=edge');
      expect(buildSurveyBookmarkHref({ id: '0xabc', sessionSlug: 'general' })).toBe('/survey/0xabc');
      expect(buildQuestionBookmarkHref({ id: '0xdef', sessionSlug: 'edge' })).toBe('/question/0xdef?session=edge');
      expect(buildQuestionBookmarkHref({ id: '0xdef', sessionSlug: 'general' })).toBe('/question/0xdef');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('preserves duplicate survey and question IDs across bookmarked session namespaces', async () => {
    mockListNamespaceEntriesSync.mockImplementation((namespace: string) => {
      if (namespace === 'bookmarksCache') {
        return [
          {
            key: 'dg:bookmarksCache:edge',
            slug: 'edge',
            value: {
              surveys: ['0xsame'],
              questions: ['0qsame'],
            },
          },
          {
            key: 'dg:bookmarksCache:beta',
            slug: 'beta',
            value: {
              surveys: ['0xsame'],
              questions: ['0qsame'],
            },
          },
        ];
      }
      return [];
    });

    render(<BookmarksPage />);

    await waitFor(() => {
      const surveyLinks = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href')?.startsWith('/survey/0xsame'));
      expect(surveyLinks.map((link) => link.getAttribute('href')).sort()).toEqual([
        '/survey/0xsame?session=beta',
        '/survey/0xsame?session=edge',
      ]);
    });

    const questionLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/question/0qsame'));
    expect(questionLinks.map((link) => link.getAttribute('href')).sort()).toEqual([
      '/question/0qsame?session=beta',
      '/question/0qsame?session=edge',
    ]);
  });
});
