import {
  areSbtListArraysEqual as __test__areSbtListArraysEqual,
  buildSbtListRenderBuckets as __test__buildSbtRenderBuckets,
  getSbtCardDetails as __test__getSbtCardDetails,
  readSbtListCacheMetaSnapshot as readSbtCacheMetaSnapshot,
} from './sbtListHelpers';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';

jest.mock('./SBTPage', () => () => null);
jest.mock('./CreateSBTGroup', () => () => null);

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {},
  getAllSessionEntries: jest.fn(() => []),
  getDemoSessionConfigBySlug: jest.fn(() => null),
  getAllSessionSlugs: jest.fn(() => []),
  getSessionChainId: jest.fn(() => null),
  getSessionConfigBySlug: jest.fn(() => ({})),
  getSessionLists: jest.fn(() => ({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] })),
  normalizeSessionSlug: jest.fn((value = '') =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
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
    normalizeSessionSlug.mockImplementation((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
  });

  it('reads managed sbt cache without cloning for meta lookups', () => {
    cacheScripts.peekCacheSync.mockReturnValue({
      84532: {
        lastBlock: 123,
        sbtList: {
          '0x1': {},
          '0x2': {},
        },
      },
    });

    const meta = readSbtCacheMetaSnapshot('edge', '84532');

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('sbtCache', 'edge', { clone: false });
    expect(meta).toEqual({ lastBlock: 123, sbtCount: 2 });
  });

  it('treats visible metadata changes as list changes', () => {
    const previous = [
      {
        sbtAddress: '0x1',
        blockNumber: 123,
        mintedAddresses: ['0xa'],
        burnedAddresses: [],
        sbtInfo: {
          name: 'Alpha Group',
          description: 'Original description',
          image: 'https://example.com/original.png',
        },
      },
    ];
    const next = [
      {
        sbtAddress: '0x1',
        blockNumber: 123,
        mintedAddresses: ['0xa'],
        burnedAddresses: [],
        sbtInfo: {
          name: 'Renamed Group',
          description: 'Updated description',
          image: 'https://example.com/updated.png',
        },
      },
    ];

    expect(__test__areSbtListArraysEqual(previous, next)).toBe(false);
  });

  it('dedupes tag labels and normalizes document links for card details', () => {
    const details = __test__getSbtCardDetails({
      tags: ['Builder', { label: 'builder' }, 'Research, Ops'],
      documentUrls: [
        { href: 'ipfs://bafy-doc' },
        { value: 'https://example.com/readme' },
        { url: 'https://example.com/readme' },
      ],
      sbtInfo: {
        featuredSbtTags: [{ name: 'Research' }, { value: 'Signal' }],
        documents: [{ docUrl: 'ar://abc123' }],
      },
    });

    expect(details.tags).toEqual(['Builder', 'Research', 'Ops', 'Signal']);
    expect(details.documentUrls).toEqual([
      { href: 'ar://abc123', label: 'ar://abc123' },
      { href: 'https://ipfs.io/ipfs/bafy-doc', label: 'ipfs://bafy-doc' },
      { href: 'https://example.com/readme', label: 'https://example.com/readme' },
    ]);
    expect(details.hasDetails).toBe(true);
  });

  it('builds single-session featured and lifecycle buckets without leaking hidden cards', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000f1';
    const expiredAddress = '0x00000000000000000000000000000000000000e1';
    const ignoredAddress = '0x00000000000000000000000000000000000000d1';
    const lockedAddress = '0x00000000000000000000000000000000000000c1';
    const hiddenAddress = '0x00000000000000000000000000000000000000b1';

    const buckets = __test__buildSbtRenderBuckets({
      allSessionsMode: false,
      excludePasswordLocked: true,
      featuredSbtAddresses: [featuredAddress, featuredAddress.toUpperCase(), lockedAddress],
      getSessionListsForSlug: jest.fn(),
      ignoredSbtAddressesLower: [ignoredAddress.toLowerCase()],
      isListModeScopeEnabled: false,
      isMintingLive: (sbt) => sbt.sbtInfo.mintingEndTime === 0,
      isPasswordLocked: (sbt) => !!sbt.sbtInfo.hasPasswordMint,
      listSlug: 'alpha',
      resolveSbtSessionSlug: (sbt) => String(sbt.slug || ''),
      sbtList: [
        {
          sbtAddress: featuredAddress,
          slug: 'alpha',
          sbtInfo: { name: 'Featured Live', mintingEndTime: 0 },
        },
        {
          sbtAddress: ignoredAddress,
          slug: 'alpha',
          sbtInfo: { name: 'Ignored Live', mintingEndTime: 0 },
        },
        {
          sbtAddress: hiddenAddress,
          slug: 'alpha',
          sbtInfo: { name: 'Hidden Live', mintingEndTime: 0, unlisted: true },
        },
        {
          sbtAddress: lockedAddress,
          slug: 'alpha',
          sbtInfo: { name: 'Locked Featured', mintingEndTime: 0, hasPasswordMint: true },
        },
        {
          sbtAddress: expiredAddress,
          slug: 'alpha',
          sbtInfo: { name: 'Expired', mintingEndTime: 1 },
        },
      ],
    });

    expect(buckets.baseFilteredList.map((sbt) => sbt.sbtAddress)).toEqual([featuredAddress, expiredAddress]);
    expect(buckets.displayedFeatured.map((sbt) => sbt.sbtAddress)).toEqual([featuredAddress]);
    expect(buckets.mintingLiveList.map((sbt) => sbt.sbtAddress)).toEqual([featuredAddress]);
    expect(buckets.expiredList.map((sbt) => sbt.sbtAddress)).toEqual([expiredAddress]);
    expect(Array.from(buckets.featuredItemKeySet)).toEqual([`alpha|${featuredAddress.toLowerCase()}`]);
  });

  it('keeps all-session featured cards keyed by session slug', () => {
    const sharedAddress = '0x00000000000000000000000000000000000000aa';
    const gammaAddress = '0x00000000000000000000000000000000000000bb';
    const getSessionListsForSlug = jest.fn((slug) => {
      if (slug === 'gamma') {
        return {
          featured_SBTs_LIST: [gammaAddress],
          ignored_SBTs_LIST: [gammaAddress],
        };
      }
      return {
        featured_SBTs_LIST: [sharedAddress],
        ignored_SBTs_LIST: [],
      };
    });

    const buckets = __test__buildSbtRenderBuckets({
      allSessionsMode: true,
      excludePasswordLocked: false,
      getSessionListsForSlug,
      isListModeScopeEnabled: true,
      isMintingLive: () => true,
      isPasswordLocked: () => false,
      listSlug: 'alpha',
      resolveSbtSessionSlug: (sbt) => String(sbt.slug || ''),
      sbtList: [
        { sbtAddress: sharedAddress, slug: 'alpha', sbtInfo: { name: 'Alpha Shared' } },
        { sbtAddress: sharedAddress, slug: 'beta', sbtInfo: { name: 'Beta Shared' } },
        { sbtAddress: gammaAddress, slug: 'gamma', sbtInfo: { name: 'Ignored Gamma' } },
      ],
      sectionSessionSlugs: ['alpha', 'beta', 'gamma'],
    });

    expect(buckets.displayedFeatured.map((sbt) => `${sbt.slug}:${sbt.sbtAddress}`)).toEqual([
      `alpha:${sharedAddress}`,
      `beta:${sharedAddress}`,
    ]);
    expect(Array.from(buckets.featuredItemKeySet)).toEqual([
      `alpha|${sharedAddress.toLowerCase()}`,
      `beta|${sharedAddress.toLowerCase()}`,
    ]);
    expect(getSessionListsForSlug).toHaveBeenCalledWith('gamma');
  });
});
