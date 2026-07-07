import SBTFilter from './SBTFilter';
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

describe('SBTFilter signature guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('reapplies when array item identities change at equal item counts', async () => {
    const onFilter = jest.fn();
    const subject = createSubject(
      {
        mode: 'addresses',
        items: ['0x1', '0x2'],
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
        mode: 'addresses',
        items,
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
        mode: 'responder',
        items: {
          q1: [{ responder: '0xA', response: 'yes' }],
          q2: [{ responder: '0xB', response: 'no' }],
        },
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
        mode: 'responder',
        items: {
          q1: [{ responder: '0xA', response: 'yes' }],
        },
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    expect(onFilter).toHaveBeenCalledWith({ q3: [{ responder: '0xA', response: 'yes' }] }, expect.any(Object));
  });

  it('reapplies in large aggregator objects when middle-key values change', async () => {
    const onFilter = jest.fn();
    const items = {};
    for (let i = 0; i < 300; i += 1) {
      items[`q${i}`] = [{ responder: '0xA', response: `r-${i}` }];
    }
    const subject = createSubject(
      {
        mode: 'responder',
        items,
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
        mode: 'responder',
        items: {
          q1: [{ responder: '0xA', response: { answer: { value: 'yes', type: 'freeform' } } }],
        },
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
        mode: 'responder',
        items: {
          q1: [
            {
              responder: '0xA',
              response: {
                responses: [
                  {
                    questionID: 'q1',
                    answer: {
                      type: 'multi-select',
                      value: ['yes', 'maybe'],
                    },
                  },
                ],
              },
            },
          ],
        },
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: [
        {
          responder: '0xA',
          response: {
            responses: [
              {
                questionID: 'q1',
                answer: {
                  type: 'multi-select',
                  value: ['yes', 'no'],
                },
              },
            ],
          },
        },
      ],
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
    const subject = createSubject(
      {
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
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
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
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const subject = createSubject(
      {
        mode: 'responder',
        items: {
          q1: [
            {
              responder: '0xA',
              questionId: 'q1',
              response: { answer: { value: 'yes', type: 'freeform' } },
              timeStamp: 1,
            },
          ],
        },
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

    await subject.runApplyFilter('first');
    onFilter.mockClear();

    const nextItems = {
      q1: [
        {
          responder: '0xA',
          questionId: 'q1',
          response: { answer: { value: 'yes', type: 'freeform' } },
          timeStamp: 2,
        },
      ],
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
    const subject = createSubject(
      {
        mode: 'addresses',
        items: ['CaseSensitiveValue'],
        onFilter,
      },
      {
        onlyVerifiedHumans: true,
      },
    );

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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    cacheScripts.peekCacheSync.mockImplementation((namespace) => {
      if (namespace !== 'sbtCache') return {};
      return {
        84532: {
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
      },
    );

    try {
      await subject.runApplyFilter('no-network');
      expect(onFilter).toHaveBeenCalledWith(['0xa', '0xb'], expect.any(Object));
      expect(consoleErrorSpy).toHaveBeenCalledWith('[sbt]', 'Network ID is undefined in SBTFilter. Cannot proceed.');

      onFilter.mockClear();
      subject.props = {
        ...subject.props,
        network: { id: 84532 },
      };

      await subject.runApplyFilter('network-ready');

      expect(onFilter).toHaveBeenCalledTimes(1);
      expect(onFilter).toHaveBeenCalledWith(['0xa'], expect.any(Object));
    } finally {
      consoleErrorSpy.mockRestore();
    }
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

    sharedExternalFilterState.selectedSBTGroups = [{ address: '0xbbb', sessionSlug: 'edge', chainId: 84532 }];

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
});
