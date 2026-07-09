import SBTFilter from './SBTFilter';
import contractScripts, {
  getSessionChainId,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('./SBTSelector', () => () => null);

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    getSbtMintBurnCountsByAddress: jest.fn(),
  },
  getSessionChainId: jest.fn(() => null),
  getSessionSlugByName: jest.fn(() => ''),
  normalizeSessionSlug: jest.fn((value) =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(),
  writeCache: jest.fn(() => Promise.resolve(true)),
}));

const createSubject = (props = {}, stateOverrides = {}) => {
  const mergedProps = {
    items: [],
    mode: 'addresses',
    provider: 'mock',
    network: { id: 84532 },
    sessionSlug: 'edge',
    isQuestionCacheReady: true,
    isSBTCacheReady: true,
    onFilter: jest.fn(),
    setFilterLoading: jest.fn(),
    ...props,
  };
  const subject = new SBTFilter(mergedProps);
  subject._isMounted = true;
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  subject.state = {
    ...subject.state,
    ...stateOverrides,
  };
  return subject;
};

describe('SBTFilter holder cache guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bounds holder memo growth and evicts oldest entries', () => {
    const subject = createSubject();

    for (let i = 0; i < 520; i += 1) {
      subject.setHolderSetMemo(`rev-${i}`, new Set([`0x${i.toString(16)}`]));
    }

    expect(subject._holderSetMemo.size).toBeLessThanOrEqual(500);
    expect(subject._holderSetMemo.has('rev-0')).toBe(false);
    expect(subject._holderSetMemo.has('rev-519')).toBe(true);
  });

  it('invalidates holder memo when sbtCacheRevision changes', async () => {
    const sbtCache = {
      84532: {
        sbtList: {
          '0xsbt': {
            mintedAddresses: ['0xAA'],
            burnedAddresses: [],
            countsLoaded: true,
            creationBlock: 1,
          },
        },
      },
    };
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return sbtCache;
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        items: ['0xaa', '0xbb'],
        onFilter,
        sbtCacheRevision: 1,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('rev1');
    expect(onFilter).toHaveBeenLastCalledWith(['0xaa'], expect.any(Object));

    sbtCache['84532'].sbtList['0xsbt'].mintedAddresses = ['0xBB'];
    subject.props = {
      ...subject.props,
      sbtCacheRevision: 2,
    };

    await subject.runApplyFilter('rev2');
    expect(onFilter).toHaveBeenLastCalledWith(['0xbb'], expect.any(Object));
  });

  it('ignores legacy-keyed caches without mutating them', async () => {
    const sbtCache = {
      '084532': {
        sbtList: {
          '0xsbt': {
            mintedAddresses: ['0xcreator'],
            burnedAddresses: [],
            countsLoaded: true,
            creationBlock: 1,
          },
        },
      },
    };
    const questionsCache = {
      '084532': {
        questions: {
          q1: {
            id: 'q1',
            creator: '0xcreator',
            prompt: 'Question 1',
            type: 'freeform',
          },
        },
        questionResponses: {
          q1: {
            '0xresponder': '{"answer":{"value":"yes"}}',
          },
        },
      },
    };
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace === 'sbtCache') return sbtCache;
      if (namespace === 'questionsCache') return questionsCache;
      return {};
    });
    contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValue({
      mintedCountByAddress: {},
      burnedCountByAddress: {},
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        mode: 'creatorAndResponder',
        items: [{ id: 'q1', creator: '0xcreator' }],
        onFilter,
      },
      {
        selectedSBTGroupsCreator: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('legacy-cache');

    expect(Object.prototype.hasOwnProperty.call(sbtCache, '84532')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(questionsCache, '84532')).toBe(false);
    expect(Object.keys(sbtCache)).toEqual(['084532']);
    expect(Object.keys(questionsCache)).toEqual(['084532']);
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(
      { filteredQuestions: [], filteredResponsesByQuestion: {} },
      expect.any(Object),
    );
  });

  it('keeps unresolved non-general selected SBT slugs scoped to their explicit cache bucket and fetch slug', async () => {
    getSessionChainId.mockImplementation((slug) => (slug === '' ? 84532 : null));
    getSessionSlugByName.mockReturnValue('');
    normalizeSessionSlug.mockImplementation((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {};
    });
    contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValue({
      mintedCountByAddress: { '0xa': 1 },
      burnedCountByAddress: {},
      scannedToBlock: 99,
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        sessionSlug: '',
        mode: 'addresses',
        items: ['0xa', '0xb'],
        network: { id: 84532 },
        onFilter,
      },
      {
        selectedSBTGroups: [
          {
            address: '0xSBT',
            sessionSlug: 'edge',
            sessionName: 'Context Engine',
          },
        ],
      },
    );

    await subject.runApplyFilter('strict-unresolved-sbt-slug');

    expect(getSessionSlugByName).not.toHaveBeenCalled();
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledWith('none', '0xsbt', 0, 'latest', 'edge');
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('sbtCache', 'edge', { clone: false });
    expect(
      cacheScripts.peekCacheSync.mock.calls.some(([namespace, slug]) => namespace === 'sbtCache' && slug === ''),
    ).toBe(false);
    expect(cacheScripts.writeCache).toHaveBeenCalledWith(
      'sbtCache',
      'edge',
      expect.objectContaining({
        84532: expect.objectContaining({
          sbtList: expect.objectContaining({
            '0xsbt': expect.objectContaining({
              mintedAddresses: ['0xa'],
              burnedAddresses: [],
              mintedCountByAddress: { '0xa': 1 },
              burnedCountByAddress: {},
              mintedEventCount: 0,
              burnedEventCount: 0,
              blockNumber: 99,
              countsLoaded: true,
              historySummary: expect.objectContaining({
                totalMinted: '1',
                totalBurned: '0',
                activeSupply: '1',
                currentHolderCount: '1',
                historicalHolderCount: '1',
              }),
            }),
          }),
        }),
      }),
    );
    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('does not mark holder counts loaded when the count scan fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              creationBlock: 1,
            },
          },
        },
      };
    });
    contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValue({
      mintedCountByAddress: {},
      burnedCountByAddress: {},
      ok: false,
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        items: ['0xa'],
        onFilter,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    try {
      await subject.runApplyFilter('failed-holder-scan');

      expect(cacheScripts.writeCache).not.toHaveBeenCalled();
      expect(onFilter).toHaveBeenCalledWith([], expect.any(Object));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[sbt]',
        'Error fetching SBT holders:',
        expect.objectContaining({
          message: 'SBT holder count scan failed',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
