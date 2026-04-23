/** @file CompareAddresses.test.tsx */
import {
  buildCompareSbtImageMap,
  buildCompareSbtKeySets,
  buildNicknameByAddressMap,
  readDgObjectValues,
} from './CompareAddresses';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  listNamespaceEntriesSync: jest.fn(() => []),
  subscribeCacheUpdates: jest.fn(() => () => {}),
}));

const mockListNamespaceEntriesSync = cacheScripts.listNamespaceEntriesSync as jest.Mock;
const buildNicknameMap = buildNicknameByAddressMap as (entries: any[]) => Map<string, string>;
const buildSbtKeySets = buildCompareSbtKeySets as (entries: any[]) => Set<string>[];
const buildSbtImageMap = buildCompareSbtImageMap as (entries: any[]) => Map<string, { name: string; image: string }>;
const readObjectValues = readDgObjectValues as (namespace: string) => unknown[];

describe('CompareAddresses cache scan helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads namespace values without cloning cache objects', () => {
    mockListNamespaceEntriesSync.mockReturnValue([
      { slug: 'edge', value: { a: 1 } },
      { slug: 'edge2', value: null },
      { slug: 'edge3', value: 'x' },
      { slug: 'edge4', value: { b: 2 } },
    ]);

    const result = readObjectValues('questionsCache');

    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenCalledWith(
      'questionsCache',
      { cloneValues: false }
    );
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('builds nickname maps from already-hydrated bookmarks state', () => {
    const map = buildNicknameMap([
      {
        addressLower: '0xabc',
        label: 'Alice',
        nickname: 'Alice',
      },
      {
        addressLower: '0xabc',
        label: 'Ignored duplicate',
        nickname: 'ShouldNotReplace',
      },
      {
        addressLower: '0xdef',
        label: 'Short 0xdef',
      },
      {
        addressLower: '0x123',
        label: 'Bob',
        nickname: 'Bob',
      },
    ]);

    expect(Array.from(map.entries())).toEqual([
      ['0xabc', 'Alice'],
      ['0x123', 'Bob'],
    ]);
  });

  it('keeps distinct locked-name SBTs separate in compare key sets', () => {
    const sets = buildSbtKeySets([
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt1',
          },
        ],
      },
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt2',
          },
        ],
      },
    ]);

    expect(sets.map((set) => Array.from(set))).toEqual([
      ['0xsbt1'],
      ['0xsbt2'],
    ]);
  });

  it('keeps separate image map entries for different locked-name SBTs', () => {
    const map = buildSbtImageMap([
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt1',
            image: 'https://img.test/1.png',
          },
        ],
      },
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt2',
            image: 'https://img.test/2.png',
          },
        ],
      },
    ]);

    expect(Array.from(map.entries())).toEqual([
      ['0xsbt1', { name: '[encrypted]', image: 'https://img.test/1.png' }],
      ['0xsbt2', { name: '[encrypted]', image: 'https://img.test/2.png' }],
    ]);
  });
});
