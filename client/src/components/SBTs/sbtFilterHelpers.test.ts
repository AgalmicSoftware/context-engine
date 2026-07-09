import {
  asCacheObject,
  asQuestionEntry,
  asQuestionNetBucket,
  asResponseEntry,
  asSbtNetBucket,
  asSelectedSbtEntry,
  buildItemsSourceSignature,
  buildSbtEntrySignature,
  buildSbtFilterBooleanTogglePatch,
  buildSbtFilterExternalStateSyncPatch,
  buildSbtFilterInitialState,
  buildSbtFilterLastAppliedSnapshotPatch,
  buildSbtFilterLoadingPatch,
  buildSbtFilterSelectionStateFromState,
  buildSbtFilterSnapshot,
  buildSbtFilterSelectedEntryList,
  buildSbtFilterStateSignature,
  buildSbtListSignature,
  buildUniqueSbtEntries,
  doesAddressPassHolderSets,
  doesSbtFilterAddressPassSelection,
  doesSbtFilterModeNeedQuestionCache,
  filterSbtFilterObjectItems,
  hasActiveSbtFilterState,
  hasRelevantSbtFilterStateChanged,
  isLatestSbtFilterApplyRun,
  isSbtFilterDataReady,
  getSbtFilterItemCount,
  mergeKnownQuestionsIntoFilterItems,
  normalizeAggregatorResponseEntries,
  normalizeIncomingFilterState,
  resolveSbtFilterAddressItemDecision,
  resolveSbtFilterAddressItemsToFilter,
  resolveEffectiveSbtFilterNetwork,
  resolveSbtFilterEmptyResponderShortCircuit,
  resolveSbtFilterExternalStateSync,
  resolveSbtFilterItemParticipantAddresses,
  resolveSbtFilterLoadingUpdate,
  scheduleMicrotask,
  shouldExpandMissingAddressItemsForSbtFilter,
  shouldApplySbtFilterOnDataReady,
  shouldPassThroughSbtFilter,
  shouldReapplySbtFilterAfterUpdate,
} from './sbtFilterHelpers';

describe('sbtFilterHelpers', () => {
  it('coerces selected entries to safe records', () => {
    expect(asSelectedSbtEntry({ address: '0xSBT', sessionSlug: 'edge' })).toEqual({
      address: '0xSBT',
      sessionSlug: 'edge',
    });
    expect(asSelectedSbtEntry('0xSBT')).toEqual({});
  });

  it('normalizes external filter state to array-backed selections', () => {
    const selected = [{ address: '0xA' }];
    const normalized = normalizeIncomingFilterState({
      selectedSBTGroupsCreator: selected,
      excludedSBTGroupsCreator: 'bad',
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: null,
      selectedSBTGroups: [{ address: '0xB' }],
      excludedSBTGroups: undefined,
      onlyVerifiedHumans: 'yes',
    });

    expect(normalized.selectedSBTGroupsCreator).toBe(selected);
    expect(normalized.excludedSBTGroupsCreator).toEqual([]);
    expect(normalized.selectedSBTGroupsResponder).toEqual([]);
    expect(normalized.excludedSBTGroupsResponder).toEqual([]);
    expect(normalized.selectedSBTGroups).toEqual([{ address: '0xB' }]);
    expect(normalized.excludedSBTGroups).toEqual([]);
    expect(normalized.onlyVerifiedHumans).toBe(true);
    expect(hasActiveSbtFilterState(normalized)).toBe(true);
    expect(hasActiveSbtFilterState({ onlyVerifiedHumans: true })).toBe(true);
    expect(hasActiveSbtFilterState({ selectedSBTGroups: 'bad' })).toBe(false);
  });

  it('builds initial SBTFilter state from external selections with existing fallback semantics', () => {
    const selected = [{ address: '0xA' }];
    expect(
      buildSbtFilterInitialState({
        autoExpand: 'yes',
        externalSBTFilterState: {
          selectedSBTGroupsCreator: selected,
          excludedSBTGroupsCreator: 'truthy legacy payload',
          selectedSBTGroupsResponder: [],
          excludedSBTGroupsResponder: null,
          selectedSBTGroups: [{ address: '0xB' }],
          excludedSBTGroups: undefined,
          onlyVerifiedHumans: 'yes',
        },
      }),
    ).toEqual({
      selectedSBTGroupsCreator: selected,
      excludedSBTGroupsCreator: 'truthy legacy payload',
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: [],
      selectedSBTGroups: [{ address: '0xB' }],
      excludedSBTGroups: [],
      onlyVerifiedHumans: 'yes',
      showFilterOptions: 'yes',
      loading: false,
      showAllSBTs: false,
      lastAppliedFilterSnapshot: null,
    });
    expect(
      buildSbtFilterInitialState({
        autoExpand: 0,
        externalSBTFilterState: 'bad',
      }),
    ).toEqual({
      selectedSBTGroupsCreator: [],
      excludedSBTGroupsCreator: [],
      selectedSBTGroupsResponder: [],
      excludedSBTGroupsResponder: [],
      selectedSBTGroups: [],
      excludedSBTGroups: [],
      onlyVerifiedHumans: false,
      showFilterOptions: false,
      loading: false,
      showAllSBTs: false,
      lastAppliedFilterSnapshot: null,
    });
  });

  it('builds SBTFilter boolean toggle patches with truthiness inversion', () => {
    expect(
      buildSbtFilterBooleanTogglePatch({
        state: { onlyVerifiedHumans: false },
        stateKey: 'onlyVerifiedHumans',
      }),
    ).toEqual({ onlyVerifiedHumans: true });
    expect(
      buildSbtFilterBooleanTogglePatch({
        state: { showFilterOptions: 'yes' },
        stateKey: 'showFilterOptions',
      }),
    ).toEqual({ showFilterOptions: false });
    expect(
      buildSbtFilterBooleanTogglePatch({
        state: null,
        stateKey: 'showAllSBTs',
      }),
    ).toEqual({ showAllSBTs: true });
  });

  it('builds stable SBT signatures across ordering and address casing', () => {
    expect(
      buildSbtEntrySignature({
        address: ' 0xABC ',
        sessionSlug: ' Edge ',
        chainID: 84532,
      }),
    ).toBe('0xabc|edge|84532');
    expect(buildSbtEntrySignature(' 0xABC ')).toBe('0xabc');
    expect(buildSbtEntrySignature(null)).toBe('');

    expect(
      buildSbtListSignature([
        { address: '0xB', slug: 'Group', chainId: 10 },
        { address: '0xA', group: 'Group', chainID: 10 },
        null,
      ]),
    ).toBe('0xa|group|10,0xb|group|10');
  });

  it('builds stable filter-state signatures for equivalent selections', () => {
    const first = buildSbtFilterStateSignature({
      selectedSBTGroups: [
        { address: '0xB', slug: 'edge', chainId: 84532 },
        { address: '0xA', slug: 'edge', chainId: 84532 },
      ],
      onlyVerifiedHumans: true,
    });
    const second = buildSbtFilterStateSignature({
      selectedSBTGroups: [
        { address: '0xa', sessionSlug: 'edge', chainID: 84532 },
        { address: '0xb', group: 'edge', chainId: 84532 },
      ],
      onlyVerifiedHumans: 1,
    });

    expect(first).toBe(second);
    expect(first.endsWith('|1')).toBe(true);
    expect(buildSbtFilterStateSignature({ selectedSBTGroups: 'bad' })).toBe('||||||0');
  });

  it('detects relevant local filter state changes', () => {
    const prev = {
      selectedSBTGroups: [],
      excludedSBTGroups: [],
      onlyVerifiedHumans: false,
      loading: false,
    };
    expect(
      hasRelevantSbtFilterStateChanged({
        prevState: prev,
        nextState: { ...prev, loading: true },
      }),
    ).toBe(false);
    expect(
      hasRelevantSbtFilterStateChanged({
        prevState: prev,
        nextState: { ...prev, onlyVerifiedHumans: true },
      }),
    ).toBe(true);
    expect(
      hasRelevantSbtFilterStateChanged({
        fields: ['loading'],
        prevState: prev,
        nextState: { ...prev, loading: true },
      }),
    ).toBe(true);
  });

  it('resolves external filter state sync decisions', () => {
    const prevExternalState = { selectedSBTGroups: [{ address: '0xA' }] };
    const currentExternalState = { selectedSBTGroups: [{ address: '0xB' }] };
    const currentLocalSignature = buildSbtFilterStateSignature(currentExternalState);

    expect(
      resolveSbtFilterExternalStateSync({
        currentExternalState,
        currentLocalSignature,
        lastExternalSignature: buildSbtFilterStateSignature(prevExternalState),
        prevExternalState,
      }),
    ).toMatchObject({
      hasExternalChanged: true,
      nextExternalSig: buildSbtFilterStateSignature(currentExternalState),
      shouldSyncLocalState: false,
    });

    const syncDecision = resolveSbtFilterExternalStateSync({
      currentExternalState,
      currentLocalSignature: buildSbtFilterStateSignature({ selectedSBTGroups: [] }),
      lastExternalSignature: buildSbtFilterStateSignature(prevExternalState),
      prevExternalState,
    });
    expect(syncDecision).toMatchObject({
      hasExternalChanged: true,
      shouldSyncLocalState: true,
    });
    expect(syncDecision.incomingStateNormalized.selectedSBTGroups).toEqual([{ address: '0xB' }]);
    expect(
      buildSbtFilterExternalStateSyncPatch({
        incomingStateNormalized: syncDecision.incomingStateNormalized,
      }),
    ).toMatchObject({
      selectedSBTGroups: [{ address: '0xB' }],
      lastAppliedFilterSnapshot: null,
    });
    expect(
      buildSbtFilterExternalStateSyncPatch({
        incomingStateNormalized: 'bad',
      }),
    ).toEqual({ lastAppliedFilterSnapshot: null });
    expect(buildSbtFilterLastAppliedSnapshotPatch({ snapshot: 'sig:1' })).toEqual({
      lastAppliedFilterSnapshot: 'sig:1',
    });
    expect(buildSbtFilterLastAppliedSnapshotPatch()).toEqual({
      lastAppliedFilterSnapshot: null,
    });

    expect(
      resolveSbtFilterExternalStateSync({
        currentExternalState,
        currentLocalSignature,
        lastExternalSignature: buildSbtFilterStateSignature(currentExternalState),
        prevExternalState,
      }).hasExternalChanged,
    ).toBe(false);
  });

  it('detects SBT filter reapply update decisions', () => {
    const items = [{ id: 'one' }];
    const prevProps = { items, mode: 'addresses', sbtCacheRevision: 1 };
    const nextProps = { items, mode: 'addresses', sbtCacheRevision: 1 };
    const prevState = { selectedSBTGroups: [], onlyVerifiedHumans: false };

    expect(
      shouldReapplySbtFilterAfterUpdate({
        nextProps,
        nextState: { ...prevState, showFilterOptions: true },
        prevProps,
        prevState,
      }),
    ).toBe(false);
    expect(
      shouldReapplySbtFilterAfterUpdate({
        nextProps,
        nextState: { ...prevState, onlyVerifiedHumans: true },
        prevProps,
        prevState,
      }),
    ).toBe(true);
    expect(
      shouldReapplySbtFilterAfterUpdate({
        nextProps: { ...nextProps, mode: 'questions' },
        nextState: prevState,
        prevProps,
        prevState,
      }),
    ).toBe(true);
    expect(
      shouldReapplySbtFilterAfterUpdate({
        nextProps: { ...nextProps, sbtCacheRevision: 2 },
        nextState: prevState,
        prevProps,
        prevState,
      }),
    ).toBe(true);
  });

  it('builds stable item-source signatures for equivalent object key ordering', () => {
    const first = buildItemsSourceSignature({
      q2: [{ responder: '0xB', answer: 'no' }],
      q1: [{ responder: '0xA', answer: 'yes' }],
    });
    const second = buildItemsSourceSignature({
      q1: [{ responder: '0xA', answer: 'yes' }],
      q2: [{ responder: '0xB', answer: 'no' }],
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^o:2:2:/);
  });

  it('tracks response-like field changes in item-source signatures', () => {
    const additionalComment = buildItemsSourceSignature([
      {
        id: 'q1',
        responder: '0xA',
        answer: 'yes',
        additionalComment: 'detail',
        importance: 4,
        conviction: 5,
      },
    ]);
    const additionalComments = buildItemsSourceSignature([
      {
        id: 'q1',
        responder: '0xA',
        answer: 'yes',
        additionalComments: 'detail',
        importance: 4,
        conviction: 5,
      },
    ]);
    const changedAnswer = buildItemsSourceSignature([
      {
        id: 'q1',
        responder: '0xA',
        answer: 'no',
        additionalComment: 'detail',
        importance: 4,
        conviction: 5,
      },
    ]);

    expect(additionalComment).not.toBe(additionalComments);
    expect(changedAnswer).not.toBe(additionalComment);
  });

  it('keeps item-source signatures bounded for circular nested objects', () => {
    const circular: Record<string, unknown> = { id: 'q1' };
    circular.self = circular;

    expect(() => buildItemsSourceSignature([circular])).not.toThrow();
    expect(buildItemsSourceSignature(Number.NaN)).toBe('p:nan');
  });

  it('deduplicates SBT entries by lower-case address and fills missing session metadata', () => {
    expect(
      buildSbtFilterSelectedEntryList({
        selectedSBTGroupsCreator: [{ address: '0xCreator' }],
        excludedSBTGroupsCreator: [null, { address: '0xCreatorExclude' }],
        selectedSBTGroupsResponder: [{ address: '0xResponder' }],
        excludedSBTGroupsResponder: [false, { address: '0xResponderExclude' }],
        selectedSBTGroups: [{ address: '0xAddress' }],
        excludedSBTGroups: [undefined, { address: '0xAddressExclude' }],
      }),
    ).toEqual([
      { address: '0xCreator' },
      { address: '0xCreatorExclude' },
      { address: '0xResponder' },
      { address: '0xResponderExclude' },
      { address: '0xAddress' },
      { address: '0xAddressExclude' },
    ]);
    const unique = buildUniqueSbtEntries([
      { address: '0xA', label: 'Original' },
      { address: '0xa', sessionSlug: 'edge', sessionName: 'Edge', chainID: 84532 },
      { address: '0xB', sessionSlug: 'other' },
      'bad',
      { label: 'missing address' },
    ]);

    expect(Array.from(unique.keys())).toEqual(['0xa', '0xb']);
    expect(unique.get('0xa')).toEqual({
      address: '0xA',
      label: 'Original',
      sessionSlug: 'edge',
      sessionName: 'Edge',
      chainId: 84532,
    });
    expect(unique.get('0xb')).toEqual({ address: '0xB', sessionSlug: 'other' });
  });

  it('applies include and exclude holder set checks', () => {
    expect(doesAddressPassHolderSets('', new Set(), true, new Set(['0xa']))).toBe(true);
    expect(doesAddressPassHolderSets('0xA', new Set(['0xa']), true, new Set())).toBe(true);
    expect(doesAddressPassHolderSets('0xB', new Set(['0xa']), true, new Set())).toBe(false);
    expect(doesAddressPassHolderSets('0xA', new Set(['0xa']), true, new Set(['0xa']))).toBe(false);
    expect(doesAddressPassHolderSets('0xB', new Set(), false, new Set())).toBe(true);
  });

  it('picks local SBT filter selection state without normalizing values', () => {
    const selectedCreator = [{ address: '0xCreator' }];
    const selectedResponder = [{ address: '0xResponder' }];
    const selectedAddress = [{ address: '0xAddress' }];
    const state = {
      selectedSBTGroupsCreator: selectedCreator,
      excludedSBTGroupsCreator: [],
      selectedSBTGroupsResponder: selectedResponder,
      excludedSBTGroupsResponder: [],
      selectedSBTGroups: selectedAddress,
      excludedSBTGroups: [],
      onlyVerifiedHumans: 'truthy',
      ignored: true,
    };

    expect(buildSbtFilterSelectionStateFromState(state)).toEqual({
      selectedSBTGroupsCreator: selectedCreator,
      excludedSBTGroupsCreator: [],
      selectedSBTGroupsResponder: selectedResponder,
      excludedSBTGroupsResponder: [],
      selectedSBTGroups: selectedAddress,
      excludedSBTGroups: [],
      onlyVerifiedHumans: 'truthy',
    });
  });

  it('applies SBT filter address selections using precomputed and fallback holder sets', () => {
    const selectedCreator = [{ address: '0xCreatorSbt' }];
    const excludedCreator = [{ address: '0xBlockedCreatorSbt' }];
    const selectedResponder = [{ address: '0xResponderSbt' }];
    const excludedResponder: unknown[] = [];
    const selectedAddress = [{ address: '0xAddressSbt' }];
    const excludedAddress: unknown[] = [];
    const baseArgs = {
      excludedAddressHolderSet: new Set<string>(),
      excludedCreatorHolderSet: new Set(['0xblocked']),
      excludedResponderHolderSet: new Set<string>(),
      excludedSBTGroups: excludedAddress,
      excludedSBTGroupsCreator: excludedCreator,
      excludedSBTGroupsResponder: excludedResponder,
      sbtHoldersMap: {
        '0xfallback': new Set(['0xfallback-holder']),
        '0xfallbackblocked': new Set(['0xfallback-blocked-holder']),
      },
      selectedAddressHolderSet: new Set(['0xaddress-holder']),
      selectedCreatorHolderSet: new Set(['0xcreator-holder']),
      selectedResponderHolderSet: new Set(['0xresponder-holder']),
      selectedSBTGroups: selectedAddress,
      selectedSBTGroupsCreator: selectedCreator,
      selectedSBTGroupsResponder: selectedResponder,
    };

    expect(
      doesSbtFilterAddressPassSelection({
        ...baseArgs,
        address: '0xCreator-Holder',
        excludedSBTs: excludedCreator,
        selectedSBTs: selectedCreator,
      }),
    ).toBe(true);
    expect(
      doesSbtFilterAddressPassSelection({
        ...baseArgs,
        address: '0xBlocked',
        excludedSBTs: excludedCreator,
        selectedSBTs: selectedCreator,
      }),
    ).toBe(false);
    expect(
      doesSbtFilterAddressPassSelection({
        ...baseArgs,
        address: '0xResponder-Holder',
        excludedSBTs: excludedResponder,
        selectedSBTs: selectedResponder,
      }),
    ).toBe(true);
    expect(
      doesSbtFilterAddressPassSelection({
        ...baseArgs,
        address: '0xAddress-Holder',
        excludedSBTs: excludedAddress,
        selectedSBTs: selectedAddress,
      }),
    ).toBe(true);
    expect(
      doesSbtFilterAddressPassSelection({
        ...baseArgs,
        address: '0xFallback-Holder',
        excludedSBTs: [{ address: '0xFallbackBlocked' }],
        selectedSBTs: [{ address: '0xFallback' }],
      }),
    ).toBe(true);
    expect(
      doesSbtFilterAddressPassSelection({
        ...baseArgs,
        address: '0xFallback-Blocked-Holder',
        excludedSBTs: [{ address: '0xFallbackBlocked' }],
        selectedSBTs: [{ address: '0xFallback' }],
      }),
    ).toBe(false);
  });

  it('resolves empty responder holder short-circuit results by mode', () => {
    const emptyHolderSet = new Set<string>();
    const selectedResponderSbts = [{ address: '0xResponderSbt' }];

    expect(
      resolveSbtFilterEmptyResponderShortCircuit({
        items: [{ id: 'q1' }],
        mode: 'responder',
        selectedResponderHolderSet: emptyHolderSet,
        selectedSBTGroupsResponder: selectedResponderSbts,
      }),
    ).toEqual({
      shouldShortCircuit: true,
      result: [],
      logMessage: '[SBTFilter] Responder include list has no holders. Returning empty result.',
    });

    expect(
      resolveSbtFilterEmptyResponderShortCircuit({
        items: { q1: [] },
        mode: 'questionResponses',
        selectedResponderHolderSet: emptyHolderSet,
        selectedSBTGroupsResponder: selectedResponderSbts,
      }),
    ).toEqual({
      shouldShortCircuit: true,
      result: {},
      logMessage: '[SBTFilter] Responder include list has no holders. Returning empty result.',
    });

    expect(
      resolveSbtFilterEmptyResponderShortCircuit({
        items: [{ id: 'q1' }],
        mode: 'creatorAndResponder',
        selectedResponderHolderSet: emptyHolderSet,
        selectedSBTGroupsResponder: selectedResponderSbts,
      }),
    ).toEqual({
      shouldShortCircuit: true,
      result: { filteredQuestions: [], filteredResponsesByQuestion: {} },
      logMessage: '[SBTFilter] (creatorAndResponder) Responder include has 0 holders -> return empty.',
    });

    expect(
      resolveSbtFilterEmptyResponderShortCircuit({
        items: null,
        mode: 'creatorAndResponder',
        selectedResponderHolderSet: emptyHolderSet,
        selectedSBTGroupsResponder: selectedResponderSbts,
      }),
    ).toEqual({
      shouldShortCircuit: true,
      result: [],
      logMessage: '[SBTFilter] (creatorAndResponder) Responder include has 0 holders -> return empty.',
    });

    expect(
      resolveSbtFilterEmptyResponderShortCircuit({
        mode: 'responder',
        selectedResponderHolderSet: new Set(['0xholder']),
        selectedSBTGroupsResponder: selectedResponderSbts,
      }),
    ).toEqual({
      shouldShortCircuit: false,
      result: null,
      logMessage: '',
    });
  });

  it('coerces cache and question values without cloning records', () => {
    const record = { questions: { q1: { id: 'q1', creator: '0xA' } } };
    const arrayRecord = [{ id: 'q1' }];

    expect(asCacheObject(record)).toBe(record);
    expect(asCacheObject(arrayRecord)).toBe(arrayRecord);
    expect(asCacheObject('bad')).toEqual({});
    expect(asQuestionNetBucket(record)).toBe(record);
    expect(asSbtNetBucket({ sbtList: {} })).toEqual({ sbtList: {} });
    expect(asQuestionEntry(record.questions.q1)).toEqual({ id: 'q1', creator: '0xA' });
    expect(asQuestionEntry('bad')).toBeNull();
  });

  it('normalizes aggregator response maps and arrays', () => {
    expect(asResponseEntry('yes')).toEqual({ response: 'yes' });
    expect(asResponseEntry({ responder: '0xA', response: 'yes' })).toEqual({
      responder: '0xA',
      response: 'yes',
    });
    expect(normalizeAggregatorResponseEntries([{ responder: '0xA', response: 'yes' }, 'no'])).toEqual([
      { responder: '0xA', response: 'yes' },
      { response: 'no' },
    ]);
    expect(
      normalizeAggregatorResponseEntries({
        '0xA': { responder: '0xB', response: 'yes' },
        '0xC': 'no',
      }),
    ).toEqual([
      { responder: '0xB', response: 'yes' },
      { responder: '0xC', response: 'no' },
    ]);
  });

  it('filters object-mode SBT filter payloads while preserving arrays and response maps', () => {
    const passes = (item: unknown): boolean =>
      asResponseEntry(item).responder === '0xA' || asResponseEntry(item).response === 'keep';

    expect(
      filterSbtFilterObjectItems(
        {
          q1: [
            { responder: '0xA', response: 'keep' },
            { responder: '0xB', response: 'drop' },
          ],
          q2: {
            '0xA': { responder: '0xA', response: 'yes' },
            '0xB': { responder: '0xB', response: 'no' },
          },
          q3: {
            '0xC': { responder: '0xC', response: 'drop' },
          },
        },
        passes,
      ),
    ).toEqual({
      q1: [{ responder: '0xA', response: 'keep' }],
      q2: {
        '0xA': { responder: '0xA', response: 'yes' },
      },
    });
  });

  it('schedules callbacks on a microtask and ignores non-functions', async () => {
    const cb = jest.fn();

    scheduleMicrotask(null);
    scheduleMicrotask(cb);
    expect(cb).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('identifies mode-specific cache readiness requirements', () => {
    expect(doesSbtFilterModeNeedQuestionCache('creator')).toBe(true);
    expect(doesSbtFilterModeNeedQuestionCache('creatorAndResponder')).toBe(true);
    expect(doesSbtFilterModeNeedQuestionCache('questions')).toBe(true);
    expect(doesSbtFilterModeNeedQuestionCache('responder')).toBe(false);
    expect(
      isSbtFilterDataReady({
        mode: 'addresses',
        isSBTCacheReady: false,
        isQuestionCacheReady: false,
      }),
    ).toBe(true);
    expect(
      isSbtFilterDataReady({
        mode: 'creator',
        isSBTCacheReady: true,
        isQuestionCacheReady: false,
      }),
    ).toBe(false);
    expect(
      isSbtFilterDataReady({
        mode: 'creator',
        isSBTCacheReady: true,
        isQuestionCacheReady: true,
      }),
    ).toBe(true);
    expect(
      isSbtFilterDataReady({
        mode: 'responder',
        isSBTCacheReady: true,
        isQuestionCacheReady: false,
      }),
    ).toBe(true);
    expect(
      isSbtFilterDataReady({
        mode: 'responder',
        isSBTCacheReady: false,
        isQuestionCacheReady: true,
      }),
    ).toBe(false);
    expect(
      shouldApplySbtFilterOnDataReady({
        hasActiveFilter: true,
        isDataReady: true,
        wasDataReady: false,
      }),
    ).toBe(true);
    expect(
      shouldApplySbtFilterOnDataReady({
        hasActiveFilter: false,
        isDataReady: true,
        wasDataReady: false,
      }),
    ).toBe(false);
    expect(
      shouldApplySbtFilterOnDataReady({
        hasActiveFilter: true,
        isDataReady: true,
        wasDataReady: true,
      }),
    ).toBe(false);
    expect(shouldApplySbtFilterOnDataReady()).toBe(false);
    expect(
      resolveSbtFilterLoadingUpdate({
        currentLoading: false,
        isMounted: true,
        loading: true,
        setFilterLoading: jest.fn(),
      }),
    ).toEqual({
      nextLoading: true,
      shouldNotifyParent: true,
      shouldSetLocalLoading: true,
    });
    expect(
      resolveSbtFilterLoadingUpdate({
        currentLoading: true,
        isMounted: true,
        loading: true,
        setFilterLoading: null,
      }),
    ).toEqual({
      nextLoading: true,
      shouldNotifyParent: false,
      shouldSetLocalLoading: false,
    });
    expect(
      resolveSbtFilterLoadingUpdate({
        currentLoading: false,
        isMounted: false,
        loading: true,
        setFilterLoading: jest.fn(),
      }),
    ).toMatchObject({
      shouldNotifyParent: true,
      shouldSetLocalLoading: false,
    });
    expect(buildSbtFilterLoadingPatch({ loading: true })).toEqual({ loading: true });
    expect(buildSbtFilterLoadingPatch({ loading: 1 })).toEqual({ loading: false });
    expect(
      isLatestSbtFilterApplyRun({
        activeApplyFilterRunId: '3',
        runId: 3,
      }),
    ).toBe(true);
    expect(
      isLatestSbtFilterApplyRun({
        activeApplyFilterRunId: 4,
        runId: 3,
      }),
    ).toBe(false);
    expect(isLatestSbtFilterApplyRun()).toBe(true);
  });

  it('builds SBT filter item counts and pass-through snapshots', () => {
    expect(getSbtFilterItemCount(['a', 'b'])).toBe(2);
    expect(getSbtFilterItemCount({ a: 1, b: 2 })).toBe(2);
    expect(getSbtFilterItemCount('3')).toBe(3);
    expect(
      shouldExpandMissingAddressItemsForSbtFilter({
        mode: 'addresses',
        expandToSbtHolders: true,
        selectedSBTGroups: [{ address: '0xA' }],
      }),
    ).toBe(true);
    expect(
      shouldExpandMissingAddressItemsForSbtFilter({
        mode: 'responder',
        expandToSbtHolders: true,
        selectedSBTGroups: [{ address: '0xA' }],
      }),
    ).toBe(false);
    expect(
      shouldPassThroughSbtFilter({
        hasActiveFilter: false,
        items: [],
        shouldExpandMissingAddressItems: false,
      }),
    ).toBe(true);
    expect(
      shouldPassThroughSbtFilter({
        hasActiveFilter: true,
        items: null,
        shouldExpandMissingAddressItems: true,
      }),
    ).toBe(false);
    expect(
      resolveSbtFilterAddressItemsToFilter({
        items: [' 0xABC ', '', null, '0xDEF'],
        selectedAddressHolderSet: new Set(['0xholder', '0xabc']),
        shouldExpandAddresses: true,
      }),
    ).toEqual([' 0xabc ', '0xdef', '0xholder', '0xabc']);
    const objectItems = { a: ['0xA'] };
    expect(
      resolveSbtFilterAddressItemsToFilter({
        items: objectItems,
        shouldExpandAddresses: false,
      }),
    ).toBe(objectItems);
    expect(
      resolveSbtFilterAddressItemDecision({
        item: '0xABC',
        selectedAddressHolderSet: new Set(['0xabc']),
        hasSelectedGroups: true,
        excludedAddressHolderSet: new Set(),
      }),
    ).toEqual({
      address: '0xabc',
      passes: true,
      shouldLogInvalidType: false,
    });
    expect(
      resolveSbtFilterAddressItemDecision({
        item: '0xABC',
        selectedAddressHolderSet: new Set(['0xdef']),
        hasSelectedGroups: true,
        excludedAddressHolderSet: new Set(),
      }).passes,
    ).toBe(false);
    expect(
      resolveSbtFilterAddressItemDecision({
        item: '0xABC',
        selectedAddressHolderSet: new Set(['0xabc']),
        hasSelectedGroups: true,
        excludedAddressHolderSet: new Set(['0xabc']),
      }).passes,
    ).toBe(false);
    expect(resolveSbtFilterAddressItemDecision({ item: { address: '0xABC' } })).toEqual({
      address: '',
      passes: false,
      shouldLogInvalidType: true,
    });
    expect(
      resolveSbtFilterItemParticipantAddresses({
        creator: '0xABC',
        responder: '0xDEF',
      }),
    ).toEqual({
      creator: '0xabc',
      responder: '0xdef',
    });
    expect(resolveSbtFilterItemParticipantAddresses(null)).toEqual({
      creator: null,
      responder: null,
    });
    expect(
      buildSbtFilterSnapshot({
        filterStateSignature: 'filter',
        mode: 'addresses',
        itemCount: 2,
        networkID: '',
        itemsSourceSignature: 'items',
        sbtCacheRevision: 7,
        passive: true,
      }),
    ).toBe('filter|addresses|2|__no-network__|items|7|passive');
  });

  it('resolves effective filter networks from props and session chain fallback', () => {
    const readSessionChainId = jest.fn((slug) => (slug === 'edge' ? 84532 : null));

    expect(
      resolveEffectiveSbtFilterNetwork({
        network: { chainId: 10, name: 'OP' },
        readSessionChainId,
        sessionSlug: 'edge',
      }),
    ).toEqual({ chainId: 10, name: 'OP', id: 10 });
    expect(
      resolveEffectiveSbtFilterNetwork({
        network: { id: 11155420, chainId: 10 },
        readSessionChainId,
        sessionSlug: 'edge',
      }),
    ).toEqual({ id: 11155420, chainId: 10 });
    expect(
      resolveEffectiveSbtFilterNetwork({
        readSessionChainId,
        sessionSlug: 'edge',
      }),
    ).toEqual({ id: 84532, chainId: 84532 });
    expect(
      resolveEffectiveSbtFilterNetwork({
        readSessionChainId,
        sessionSlug: 'missing',
      }),
    ).toBeNull();
  });

  it('merges known cache questions into question arrays and aggregators', () => {
    const questionNetCache = {
      questions: {
        q1: { id: 'q1', prompt: 'One' },
        q2: { id: 'q2', prompt: 'Two' },
      },
    };

    expect(
      mergeKnownQuestionsIntoFilterItems([{ id: 'Q1', prompt: 'Existing' }], questionNetCache, 'questions'),
    ).toEqual([
      { id: 'Q1', prompt: 'Existing' },
      { id: 'q2', prompt: 'Two' },
    ]);
    expect(mergeKnownQuestionsIntoFilterItems({ q1: [{ response: 'yes' }] }, questionNetCache, 'responder')).toEqual({
      q1: [{ response: 'yes' }],
      q2: [],
    });
    expect(mergeKnownQuestionsIntoFilterItems([{ id: 'q1' }], questionNetCache, 'addresses')).toEqual([{ id: 'q1' }]);
  });
});
