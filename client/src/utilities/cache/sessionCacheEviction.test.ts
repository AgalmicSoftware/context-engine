import {
  evictOldDgEntries,
  removeDgMetaTimestamp,
  trimLargeArrays,
  updateDgMetaTimestamp,
} from './sessionCacheEviction';

jest.mock(
  'utilities/logging.js',
  () => ({
    __esModule: true,
    createLogger: jest.fn(() => ({
      warn: jest.fn(),
    })),
  }),
  { virtual: true },
);

const DG_META_STORAGE_KEY = 'dg_meta_v1';

const readStoredMeta = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem(DG_META_STORAGE_KEY) || '{}') as Record<string, unknown>;

describe('sessionCacheEviction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('trims nested arrays while preserving circular references', () => {
    const payload: {
      items: number[];
      nested: { values: string[] };
      self?: unknown;
    } = {
      items: [1, 2, 3, 4],
      nested: { values: ['a', 'b', 'c'] },
    };
    payload.self = payload;

    trimLargeArrays(payload, 2);

    expect(payload.items).toEqual([3, 4]);
    expect(payload.nested.values).toEqual(['b', 'c']);
    expect(payload.self).toBe(payload);
  });

  it('evicts expired DG entries and keeps recent metadata', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    localStorage.setItem('dg:old', 'old-value');
    localStorage.setItem('dg:new', 'new-value');
    localStorage.setItem('other:key', 'other-value');
    localStorage.setItem(
      DG_META_STORAGE_KEY,
      JSON.stringify({
        'dg:old': 1_000,
        'dg:new': 9_500,
        'other:key': 1_000,
      }),
    );

    expect(evictOldDgEntries(1_000)).toBe(1);

    expect(localStorage.getItem('dg:old')).toBeNull();
    expect(localStorage.getItem('dg:new')).toBe('new-value');
    expect(localStorage.getItem('other:key')).toBe('other-value');
    expect(readStoredMeta()).toEqual({
      'dg:new': 9_500,
      'other:key': 1_000,
    });
  });

  it('updates and removes DG metadata timestamps', () => {
    jest.spyOn(Date, 'now').mockReturnValue(12_345);

    updateDgMetaTimestamp('dg:session:current');
    expect(readStoredMeta()).toEqual({ 'dg:session:current': 12_345 });

    removeDgMetaTimestamp('dg:session:current');
    expect(readStoredMeta()).toEqual({});
  });
});
