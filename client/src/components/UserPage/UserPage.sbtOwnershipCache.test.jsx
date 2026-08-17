/** @file UserPage.sbtOwnershipCache.test.jsx */
import UserPage from './UserPage';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiClient.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

describe('UserPage SBT ownership cache fallback', () => {
  it('uses sbtCache ownership counts to keep SBT after mint-burn-mint', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              sbtList: {
                '0x100': {
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                  mintedAddresses: [viewAddress],
                  burnedAddresses: [viewAddress],
                  mintedCountByAddress: { [viewLower]: 2 },
                  burnedCountByAddress: { [viewLower]: 1 },
                },
              },
            },
          },
        },
      ],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sbtInfo: expect.objectContaining({
            name: 'Badge 100',
            sbtAddress: '0x100',
          }),
        }),
      ]),
    );
  });

  it('lets authoritative sbtCache zero counts override earlier legacy mint signal', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const legacyEntry = {
      slug: 'legacy',
      data: {
        [networkID]: {
          sbtList: {
            '0x100': {
              sbtAddress: '0x100',
              sbtInfo: { name: 'Badge 100', unlisted: false },
              mintedAddresses: [viewAddress],
              burnedAddresses: [],
            },
          },
        },
      },
    };
    const authoritativeEntry = {
      slug: 'authoritative',
      data: {
        [networkID]: {
          sbtList: {
            '0x100': {
              sbtAddress: '0x100',
              sbtInfo: { name: 'Badge 100', unlisted: false },
              mintedAddresses: [],
              burnedAddresses: [],
              mintedCountByAddress: {},
              burnedCountByAddress: {},
              countsLoaded: true,
            },
          },
        },
      },
    };
    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [legacyEntry, authoritativeEntry],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toHaveLength(0);
  });

  it('keeps authoritative sbtCache zero counts sticky over later legacy mint signal', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const legacyEntry = {
      slug: 'legacy',
      data: {
        [networkID]: {
          sbtList: {
            '0x100': {
              sbtAddress: '0x100',
              sbtInfo: { name: 'Badge 100', unlisted: false },
              mintedAddresses: [viewAddress],
              burnedAddresses: [],
            },
          },
        },
      },
    };
    const authoritativeEntry = {
      slug: 'authoritative',
      data: {
        [networkID]: {
          sbtList: {
            '0x100': {
              sbtAddress: '0x100',
              sbtInfo: { name: 'Badge 100', unlisted: false },
              mintedAddresses: [],
              burnedAddresses: [],
              mintedCountByAddress: {},
              burnedCountByAddress: {},
              countsLoaded: true,
            },
          },
        },
      },
    };
    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [authoritativeEntry, legacyEntry],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toHaveLength(0);
  });

  it('honors legacy sbtCache mintedAddresses when count maps are empty placeholders', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              sbtList: {
                '0x100': {
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                  mintedAddresses: [viewAddress],
                  burnedAddresses: [],
                  mintedCountByAddress: {},
                  burnedCountByAddress: {},
                  countsLoaded: false,
                },
              },
            },
          },
        },
      ],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sbtInfo: expect.objectContaining({
            name: 'Badge 100',
            sbtAddress: '0x100',
          }),
        }),
      ]),
    );
  });

  it('keeps legacy sbtCache set-only burn behavior when ownership counts are absent', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              sbtList: {
                '0x100': {
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                  mintedAddresses: [viewAddress],
                  burnedAddresses: [viewAddress],
                },
              },
            },
          },
        },
      ],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toHaveLength(0);
  });

  it('does not let userCache fallback SBT entries override burned ownership from sbtCache', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              sbtList: {
                '0x100': {
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                  mintedAddresses: [viewAddress],
                  burnedAddresses: [viewAddress],
                },
              },
            },
          },
        },
      ],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewLower]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  sbts: [
                    {
                      sbtAddress: '0x100',
                      sbtInfo: { name: 'Badge 100', unlisted: false },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.sbtList).toHaveLength(0);
  });

  it('userCache row with explicit burn count > mint count marks SBT as burned when no prior sbtCache signal', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewLower]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  sbts: [
                    {
                      sbtAddress: '0x100',
                      sbtInfo: { name: 'Badge 100', unlisted: false },
                      mintedCountByAddress: { [viewLower]: 1 },
                      burnedCountByAddress: { [viewLower]: 2 },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    const aggregate = instance._collectUnifiedCacheData({ networkID, viewAddressLower: viewLower });
    const sbtEntry = aggregate.sbtAggregate['0x100'];

    expect(sbtEntry.burnedSet.has(viewLower)).toBe(true);
    expect(sbtEntry.mintedSet.has(viewLower)).toBe(false);
    expect(instance._deriveSbtSection(aggregate, viewLower).sbtList).toHaveLength(0);
  });
});
