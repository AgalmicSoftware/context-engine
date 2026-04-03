import { __test__areSbtListArraysEqual, readSbtCacheMetaSnapshot } from './SBTsList.jsx';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('./SBTPage', () => () => null);
jest.mock('./CreateSBTGroup', () => () => null);

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  default: {},
  getAllSessionEntries: jest.fn(() => []),
  getDemoSessionConfigBySlug: jest.fn(() => null),
  getAllSessionSlugs: jest.fn(() => []),
  getSessionChainId: jest.fn(() => null),
  getSessionConfigBySlug: jest.fn(() => ({})),
  getSessionLists: jest.fn(() => ({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] })),
  normalizeSessionSlug: jest.fn((value = '') => String(value || '').trim().toLowerCase()),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  listNamespaceEntriesSync: jest.fn(() => []),
  peekCacheSync: jest.fn(() => ({})),
  readCache: jest.fn(),
  removeCache: jest.fn(),
  writeCache: jest.fn(),
}));

describe('SBTsList cache watermark reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads managed sbt cache without cloning for meta lookups', () => {
    cacheScripts.peekCacheSync.mockReturnValue({
      '84532': {
        lastBlock: 123,
        sbtList: {
          '0x1': {},
          '0x2': {},
        },
      },
    });

    const meta = readSbtCacheMetaSnapshot('edge', '84532');

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith(
      'sbtCache',
      'edge',
      { clone: false }
    );
    expect(meta).toEqual({ lastBlock: 123, sbtCount: 2 });
  });

  it('treats visible metadata changes as list changes', () => {
    const previous = [{
      sbtAddress: '0x1',
      blockNumber: 123,
      mintedAddresses: ['0xa'],
      burnedAddresses: [],
      sbtInfo: {
        name: 'Alpha Group',
        description: 'Original description',
        image: 'https://example.com/original.png',
      },
    }];
    const next = [{
      sbtAddress: '0x1',
      blockNumber: 123,
      mintedAddresses: ['0xa'],
      burnedAddresses: [],
      sbtInfo: {
        name: 'Renamed Group',
        description: 'Updated description',
        image: 'https://example.com/updated.png',
      },
    }];

    expect(__test__areSbtListArraysEqual(previous, next)).toBe(false);
  });
});
