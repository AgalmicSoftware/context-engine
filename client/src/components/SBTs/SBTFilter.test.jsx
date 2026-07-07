import SBTFilter from './SBTFilter';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('./SBTSelector', () => () => null);

jest.mock('../../utilities/web3/contractScripts.js', () => ({
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

const flushMicrotasks = async (cycles = 3) => {
  for (let i = 0; i < cycles; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

describe('SBTFilter performance guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('coalesces rapid apply scheduling into one run', async () => {
    const subject = createSubject();
    subject.runApplyFilter = jest.fn().mockResolvedValue(undefined);

    subject.scheduleApplyFilter('first');
    subject.scheduleApplyFilter('second');
    subject.scheduleApplyFilter('third');
    await flushMicrotasks();

    expect(subject.runApplyFilter).toHaveBeenCalledTimes(1);
    expect(subject.runApplyFilter).toHaveBeenCalledWith('third');
  });

  it('uses net-holder set diff for address filtering and updates parent loading state', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              mintedAddresses: ['0xA', '0xB'],
              burnedAddresses: ['0xB'],
              mintedCountByAddress: { '0xa': 1, '0xb': 1 },
              burnedCountByAddress: { '0xb': 1 },
              countsLoaded: true,
              creationBlock: 1,
            },
          },
        },
      };
    });

    const onFilter = jest.fn();
    const setFilterLoading = jest.fn();
    const subject = createSubject(
      {
        items: ['0xa', '0xb', '0xc'],
        onFilter,
        setFilterLoading,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('manual');

    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
    expect(contractScripts.getSbtMintBurnCountsByAddress).not.toHaveBeenCalled();
    expect(setFilterLoading).toHaveBeenNthCalledWith(1, true);
    expect(setFilterLoading).toHaveBeenLastCalledWith(false);
  });

  it('does not enter loading state while caches are not ready', async () => {
    const setFilterLoading = jest.fn();
    const subject = createSubject({
      isSBTCacheReady: false,
      mode: 'responder',
      setFilterLoading,
    });

    await subject.runApplyFilter('unready-cache');

    expect(setFilterLoading).not.toHaveBeenCalledWith(true);
    expect(subject.state.loading).toBe(false);
  });

  it('does not enter loading state for pass-through no-op filters', async () => {
    const setFilterLoading = jest.fn();
    const onFilter = jest.fn();
    const subject = createSubject({
      items: ['0xa'],
      onFilter,
      setFilterLoading,
    });

    await subject.runApplyFilter('initial');
    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
    expect(setFilterLoading).not.toHaveBeenCalledWith(true);

    setFilterLoading.mockClear();
    const result = await subject.runApplyFilter('unchanged');

    expect(result).toBe(false);
    expect(setFilterLoading).not.toHaveBeenCalledWith(true);
  });

  it('accepts a network prop shaped with chainId when resolving filter network', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              mintedAddresses: ['0xA'],
              burnedAddresses: [],
              mintedCountByAddress: { '0xa': 1 },
              burnedCountByAddress: {},
              countsLoaded: true,
              creationBlock: 1,
            },
          },
        },
      };
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        items: ['0xa', '0xb'],
        onFilter,
        network: { chainId: 84532, name: 'Base Sepolia' },
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('chainid-network-shape');

    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('prefers count maps over unique holder arrays so reburn/remint holders stay included', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              mintedAddresses: ['0xA'],
              burnedAddresses: ['0xA'],
              mintedCountByAddress: { '0xa': 2 },
              burnedCountByAddress: { '0xa': 1 },
              countsLoaded: true,
              creationBlock: 1,
            },
          },
        },
      };
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        items: ['0xa', '0xb'],
        onFilter,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('reburn-remint');

    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
    expect(contractScripts.getSbtMintBurnCountsByAddress).not.toHaveBeenCalled();
  });

  it('ignores checkpoint-backed partial count maps and refetches holders before filtering', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              mintedAddresses: ['0xA'],
              burnedAddresses: [],
              mintedCountByAddress: { '0xa': 1 },
              burnedCountByAddress: {},
              countsLoaded: false,
              countsScanCheckpoint: {
                phase: 'activity',
                blockNumber: 15,
                mintedCountByAddress: { '0xa': 1 },
                burnedCountByAddress: {},
              },
              creationBlock: 1,
            },
          },
        },
      };
    });
    contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValue({
      mintedCountByAddress: { '0xa': 1 },
      burnedCountByAddress: { '0xa': 1 },
      mintedEventCount: 1,
      burnedEventCount: 1,
      scannedToBlock: 25,
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

    await subject.runApplyFilter('checkpoint-backed-partial');

    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith([], expect.any(Object));
  });

  it('expands address-mode results to selected SBT holders even when input items are missing', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              mintedAddresses: ['0xHolderOnly'],
              burnedAddresses: [],
              countsLoaded: true,
              creationBlock: 1,
            },
          },
        },
      };
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        mode: 'addresses',
        items: null,
        expandToSbtHolders: true,
        onFilter,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('expand-missing-items');

    expect(onFilter).toHaveBeenCalledWith(['0xholderonly'], expect.any(Object));
  });

  it('does not treat empty placeholder holder arrays as authoritative before counts load', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
          sbtList: {
            '0xsbt': {
              mintedAddresses: [],
              burnedAddresses: [],
              countsLoaded: false,
              creationBlock: 1,
            },
          },
        },
      };
    });
    contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValue({
      mintedCountByAddress: { '0xa': 1 },
      burnedCountByAddress: {},
      mintedEventCount: 1,
      burnedEventCount: 0,
    });

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        items: ['0xa', '0xb'],
        onFilter,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    await subject.runApplyFilter('placeholder-arrays');

    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('deduplicates in-flight holder fetches across overlapping apply runs', async () => {
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

    let resolveMinted;
    const countsPromise = new Promise((resolve) => {
      resolveMinted = resolve;
    });
    contractScripts.getSbtMintBurnCountsByAddress.mockImplementation(() => countsPromise);

    const onFilter = jest.fn();
    const subject = createSubject(
      {
        mode: 'responder',
        items: {
          q1: [
            { responder: '0xholder', response: 'yes' },
            { responder: '0xother', response: 'no' },
          ],
        },
        onFilter,
      },
      {
        selectedSBTGroupsResponder: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      },
    );

    const firstRun = subject.runApplyFilter('first');
    const secondRun = subject.runApplyFilter('second');
    resolveMinted({
      mintedCountByAddress: { '0xholder': 1 },
      burnedCountByAddress: {},
    });

    await Promise.all([firstRun, secondRun]);

    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenLastCalledWith({ q1: [{ responder: '0xholder', response: 'yes' }] }, expect.any(Object));
  });
});
