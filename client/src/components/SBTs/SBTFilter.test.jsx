import SBTFilter from './SBTFilter.jsx';
import contractScripts, {
  getSessionChainId,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('./SBTSelector.jsx', () => () => null);

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  default: {
    getSbtMintBurnCountsByAddress: jest.fn(),
  },
  getSessionChainId: jest.fn(() => null),
  getSessionSlugByName: jest.fn(() => ''),
  normalizeSessionSlug: jest.fn((value) => String(value || '').trim().toLowerCase()),
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

const findElementsInTree = (node, predicate, acc = []) => {
  if (!node || typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  const children = node?.props?.children;
  if (Array.isArray(children)) {
    children.forEach((child) => findElementsInTree(child, predicate, acc));
    return acc;
  }
  if (children) {
    findElementsInTree(children, predicate, acc);
  }
  return acc;
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
        '84532': {
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
      }
    );

    await subject.runApplyFilter('manual');

    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
    expect(contractScripts.getSbtMintBurnCountsByAddress).not.toHaveBeenCalled();
    expect(setFilterLoading).toHaveBeenNthCalledWith(1, true);
    expect(setFilterLoading).toHaveBeenLastCalledWith(false);
  });

  it('accepts a network prop shaped with chainId when resolving filter network', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
    );

    await subject.runApplyFilter('chainid-network-shape');

    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('prefers count maps over unique holder arrays so reburn/remint holders stay included', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
    );

    await subject.runApplyFilter('reburn-remint');

    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
    expect(contractScripts.getSbtMintBurnCountsByAddress).not.toHaveBeenCalled();
  });

  it('ignores checkpoint-backed partial count maps and refetches holders before filtering', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
    );

    await subject.runApplyFilter('checkpoint-backed-partial');

    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith([], expect.any(Object));
  });

  it('expands address-mode results to selected SBT holders even when input items are missing', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
    );

    await subject.runApplyFilter('expand-missing-items');

    expect(onFilter).toHaveBeenCalledWith(['0xholderonly'], expect.any(Object));
  });

  it('does not treat empty placeholder holder arrays as authoritative before counts load', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
    );

    await subject.runApplyFilter('placeholder-arrays');

    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('deduplicates in-flight holder fetches across overlapping apply runs', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
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
    expect(onFilter).toHaveBeenLastCalledWith(
      { q1: [{ responder: '0xholder', response: 'yes' }] },
      expect.any(Object)
    );
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
      '84532': {
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
      }
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
      }
    );

    await subject.runApplyFilter('legacy-cache');

    expect(Object.prototype.hasOwnProperty.call(sbtCache, '84532')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(questionsCache, '84532')).toBe(false);
    expect(Object.keys(sbtCache)).toEqual(['084532']);
    expect(Object.keys(questionsCache)).toEqual(['084532']);
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(
      { filteredQuestions: [], filteredResponsesByQuestion: {} },
      expect.any(Object)
    );
  });

  it('keeps unresolved non-general selected SBT slugs scoped to their explicit cache bucket and fetch slug', async () => {
    getSessionChainId.mockImplementation((slug) => (slug === '' ? 84532 : null));
    getSessionSlugByName.mockReturnValue('');
    normalizeSessionSlug.mockImplementation((value) => String(value || '').trim().toLowerCase());
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
        selectedSBTGroups: [{
          address: '0xSBT',
          sessionSlug: 'edge',
          sessionName: 'Context Engine',
        }],
      }
    );

    await subject.runApplyFilter('strict-unresolved-sbt-slug');

    expect(getSessionSlugByName).not.toHaveBeenCalled();
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledWith(
      'none',
      '0xsbt',
      0,
      'latest',
      'edge'
    );
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('sbtCache', 'edge', { clone: false });
    expect(
      cacheScripts.peekCacheSync.mock.calls.some(
        ([namespace, slug]) => namespace === 'sbtCache' && slug === ''
      )
    ).toBe(false);
    expect(cacheScripts.writeCache).toHaveBeenCalledWith(
      'sbtCache',
      'edge',
      expect.objectContaining({
        '84532': expect.objectContaining({
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
      })
    );
    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('does not mark holder counts loaded when the count scan fails', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
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
      }
    );

    await subject.runApplyFilter('failed-holder-scan');

    expect(cacheScripts.writeCache).not.toHaveBeenCalled();
    expect(onFilter).toHaveBeenCalledWith([], expect.any(Object));
  });

  it('reapplies when array item identities change at equal item counts', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'addresses',
      items: ['0x1', '0x2'],
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    subject.props = {
      ...subject.props,
      items: ['0x1', '0x3'],
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(['0x1', '0x3'], expect.any(Object));
  });

  it('reapplies when large arrays mutate in unsampled middle indexes', async () => {
    const onFilter = jest.fn();
    const items = Array.from({ length: 300 }, (_, index) => `0x${String(index).padStart(3, '0')}`);
    const subject = createSubject({
      mode: 'addresses',
      items,
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    items[150] = '0xmid-changed';
    subject.props = {
      ...subject.props,
      items,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(items, expect.any(Object));
  });

  it('treats aggregator objects with identical content but reordered keys as unchanged', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: [{ responder: '0xA', response: 'yes' }],
        q2: [{ responder: '0xB', response: 'no' }],
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    subject.props = {
      ...subject.props,
      items: {
        q2: [{ responder: '0xB', response: 'no' }],
        q1: [{ responder: '0xA', response: 'yes' }],
      },
    };

    await subject.runApplyFilter('second');

    expect(onFilter).not.toHaveBeenCalled();
  });

  it('reapplies in aggregator mode when question keys change at equal item counts', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: [{ responder: '0xA', response: 'yes' }],
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    subject.props = {
      ...subject.props,
      items: {
        q3: [{ responder: '0xA', response: 'yes' }],
      },
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(
      { q3: [{ responder: '0xA', response: 'yes' }] },
      expect.any(Object)
    );
  });

  it('reapplies in large aggregator objects when middle-key values change', async () => {
    const onFilter = jest.fn();
    const items = {};
    for (let i = 0; i < 300; i += 1) {
      items[`q${i}`] = [{ responder: '0xA', response: `r-${i}` }];
    }
    const subject = createSubject({
      mode: 'responder',
      items,
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = { ...items };
    nextItems.q150 = [{ responder: '0xA', response: 'r-150-updated' }];
    subject.props = {
      ...subject.props,
      items: nextItems,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(nextItems, expect.any(Object));
  });

  it('reapplies when nested response object content changes with same shape', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: [{ responder: '0xA', response: { answer: { value: 'yes', type: 'freeform' } } }],
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: [{ responder: '0xA', response: { answer: { value: 'no', type: 'freeform' } } }],
    };
    subject.props = {
      ...subject.props,
      items: nextItems,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(nextItems, expect.any(Object));
  });

  it('reapplies when deep multi-select payload values change with same shape', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: [{
          responder: '0xA',
          response: {
            responses: [{
              questionID: 'q1',
              answer: {
                type: 'multi-select',
                value: ['yes', 'maybe'],
              },
            }],
          },
        }],
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: [{
        responder: '0xA',
        response: {
          responses: [{
            questionID: 'q1',
            answer: {
              type: 'multi-select',
              value: ['yes', 'no'],
            },
          }],
        },
      }],
    };
    subject.props = {
      ...subject.props,
      items: nextItems,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(nextItems, expect.any(Object));
  });

  it('reapplies when map-style responder payload changes with same key shape', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: {
          '0xA': {
            answer: { value: 'yes', type: 'freeform' },
            timeStamp: 1,
          },
        },
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: {
        '0xA': {
          answer: { value: 'no', type: 'freeform' },
          timeStamp: 1,
        },
      },
    };
    subject.props = {
      ...subject.props,
      items: nextItems,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    const [filteredPayload] = onFilter.mock.calls[0];
    expect(Array.isArray(filteredPayload?.q1)).toBe(true);
    expect(filteredPayload.q1[0]?.responder).toBe('0xA');
    expect(filteredPayload.q1[0]?.response?.answer?.value).toBe('no');
  });

  it('reapplies when map-style additional payload changes with stable answer and keys', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: {
          '0xA': {
            answer: { value: 'yes', type: 'freeform' },
            additional: { value: 'hello' },
            timeStamp: 1,
          },
        },
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    subject.props = {
      ...subject.props,
      items: {
        q1: {
          '0xA': {
            answer: { value: 'yes', type: 'freeform' },
            additional: { value: 'world' },
            timeStamp: 1,
          },
        },
      },
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    const [filteredPayload] = onFilter.mock.calls[0];
    expect(Array.isArray(filteredPayload?.q1)).toBe(true);
    expect(filteredPayload.q1[0]?.responder).toBe('0xA');
    expect(filteredPayload.q1[0]?.response?.additional?.value).toBe('world');
  });

  it('reapplies when top-level timestamp metadata changes with same response payload', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: [{
          responder: '0xA',
          questionId: 'q1',
          response: { answer: { value: 'yes', type: 'freeform' } },
          timeStamp: 1,
        }],
      },
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: [{
        responder: '0xA',
        questionId: 'q1',
        response: { answer: { value: 'yes', type: 'freeform' } },
        timeStamp: 2,
      }],
    };
    subject.props = {
      ...subject.props,
      items: nextItems,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(nextItems, expect.any(Object));
  });

  it('passes through updated aggregator items when no filter is active', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'responder',
      items: {
        q1: [{ responder: '0xA', response: { answer: { value: 'yes' } } }],
      },
      onFilter,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: [{ responder: '0xA', response: { answer: { value: 'no' } } }],
    };
    subject.props = {
      ...subject.props,
      items: nextItems,
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(nextItems, expect.any(Object));
  });

  it('reapplies when item text changes by case only under active filters', async () => {
    const onFilter = jest.fn();
    const subject = createSubject({
      mode: 'addresses',
      items: ['CaseSensitiveValue'],
      onFilter,
    }, {
      onlyVerifiedHumans: true,
    });

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    subject.props = {
      ...subject.props,
      items: ['casesensitivevalue'],
    };

    await subject.runApplyFilter('second');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(['casesensitivevalue'], expect.any(Object));
  });

  it('reruns active filtering when network becomes available after a no-network pass', async () => {
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        '84532': {
          sbtList: {
            '0xsbt': {
              mintedAddresses: ['0xA'],
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
        items: ['0xa', '0xb'],
        network: {},
        onFilter,
      },
      {
        selectedSBTGroups: [{ address: '0xSBT', sessionSlug: 'edge', chainId: 84532 }],
      }
    );

    await subject.runApplyFilter('no-network');
    expect(onFilter).toHaveBeenCalledWith(['0xa', '0xb'], expect.any(Object));

    onFilter.mockClear();
    subject.props = {
      ...subject.props,
      network: { id: 84532 },
    };

    await subject.runApplyFilter('network-ready');

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
  });

  it('syncs external SBT filter state when payload mutates in place under a stable prop reference', () => {
    const sharedExternalFilterState = {
      selectedSBTGroups: [{ address: '0xaaa', sessionSlug: 'edge', chainId: 84532 }],
      excludedSBTGroups: [],
      selectedSBTGroupsCreator: [],
      excludedSBTGroupsCreator: [],
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: [],
      onlyVerifiedHumans: false,
    };
    const subject = createSubject({
      externalSBTFilterState: sharedExternalFilterState,
    });

    const prevProps = {
      ...subject.props,
      externalSBTFilterState: sharedExternalFilterState,
    };
    const prevState = { ...subject.state };

    sharedExternalFilterState.selectedSBTGroups = [
      { address: '0xbbb', sessionSlug: 'edge', chainId: 84532 },
    ];

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.state.selectedSBTGroups).toEqual(sharedExternalFilterState.selectedSBTGroups);
  });

  it('still reapplies when external signature changes but local state already matches incoming filters', () => {
    const externalStateA = {
      selectedSBTGroups: [{ address: '0xaaa', sessionSlug: 'edge', chainId: 84532 }],
      excludedSBTGroups: [],
      selectedSBTGroupsCreator: [],
      excludedSBTGroupsCreator: [],
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: [],
      onlyVerifiedHumans: false,
    };
    const externalStateB = {
      ...externalStateA,
      selectedSBTGroups: [{ address: '0xbbb', sessionSlug: 'edge', chainId: 84532 }],
    };

    const subject = createSubject({
      mode: 'addresses',
      items: ['0xold'],
      externalSBTFilterState: externalStateA,
    });
    subject.scheduleApplyFilter = jest.fn();

    // Simulate a parent sync tick where the local filter state is already in sync
    // with the incoming external payload before this lifecycle pass.
    subject.state = {
      ...subject.state,
      selectedSBTGroups: externalStateB.selectedSBTGroups,
    };
    const prevState = { ...subject.state };
    const prevProps = {
      ...subject.props,
      items: ['0xold'],
      externalSBTFilterState: externalStateA,
    };
    subject.props = {
      ...subject.props,
      items: ['0xnew'],
      externalSBTFilterState: externalStateB,
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.scheduleApplyFilter).toHaveBeenCalledTimes(1);
    expect(subject.scheduleApplyFilter).toHaveBeenCalledWith('state-change');
  });

  it('passes defaultFeaturedSBTs through to address-mode SBT selectors', () => {
    const featured = [
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
    ];
    const subject = createSubject({
      mode: 'addresses',
      autoExpand: true,
      defaultFeaturedSBTs: featured,
    });

    const tree = subject.render();
    const addressSelectors = findElementsInTree(
      tree,
      (element) => ['includeAddresses', 'excludeAddresses'].includes(element?.props?.id)
    );

    expect(addressSelectors).toHaveLength(2);
    addressSelectors.forEach((selectorNode) => {
      expect(selectorNode.props.defaultFeaturedSBTs).toBe(featured);
    });
  });

  it('adds light-surface classes to the collapsed filter button and panel when requested', () => {
    const subject = createSubject(
      {
        mode: 'responder',
        autoExpand: false,
        buttonSurface: 'light',
      },
      {
        showFilterOptions: true,
      }
    );

    const tree = subject.render();
    const [filterButton] = findElementsInTree(
      tree,
      (element) => element?.props?.id === 'filterButton'
    );
    const [filterOptions] = findElementsInTree(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterOptionsOnLight')
    );

    expect(filterButton).toBeTruthy();
    expect(filterButton.props.className).toContain('filterButtonOnLight');
    expect(filterOptions).toBeTruthy();
  });
});
