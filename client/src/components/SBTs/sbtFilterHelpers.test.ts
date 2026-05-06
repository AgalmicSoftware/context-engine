import {
  asCacheObject,
  asQuestionEntry,
  asQuestionNetBucket,
  asResponseEntry,
  asSbtNetBucket,
  asSelectedSbtEntry,
  appendSbtFilterOption,
  buildHolderUnionSet,
  buildHistorySummaryFromCounts,
  buildItemsSourceSignature,
  buildNetHoldersSet,
  buildNetHoldersSetFromCounts,
  buildSbtEntrySignature,
  buildSbtFilterBooleanTogglePatch,
  buildSbtFilterExternalStateSyncPatch,
  buildSbtFilterFetchedHolderCacheEntryPatch,
  buildSbtFilterFetchedHolderRevisionKey,
  buildSbtFilterHolderFetchResult,
  buildSbtFilterInitialState,
  buildSbtFilterHolderRequestKey,
  buildSbtFilterHolderRevisionKey,
  buildSbtFilterHolderSelectionSets,
  buildSbtFilterLastAppliedSnapshotPatch,
  buildSbtFilterLoadingPatch,
  buildSbtFilterQuickChipClassName,
  buildSbtFilterQuickChipDisplayState,
  buildSbtFilterQuickChipSelectedAddressSet,
  buildSbtFilterSbtCacheMemoKey,
  buildSbtFilterSbtEntryCachePatch,
  buildSbtFilterSelectionAddPatch,
  buildSbtFilterSelectionRemovePatch,
  buildSbtFilterSelectionStateFromState,
  buildSbtFilterSnapshot,
  buildSbtFilterSelectedEntryList,
  buildSbtFilterStateSignature,
  buildSbtFilterSurfaceClassNames,
  buildSbtListSignature,
  buildUniqueSbtEntries,
  computeHolderListFingerprint,
  countMapFingerprint,
  doesAddressPassHolderSets,
  doesSbtFilterAddressPassSelection,
  doesSbtFilterModeNeedQuestionCache,
  filterSbtFilterObjectItems,
  formatSbtFilterQuickChipAddress,
  getCachedSbtFilterQuestionEntry,
  getCachedSbtFilterQuestionResponseMap,
  hasMatchingSbtOptionAddress,
  hasActiveSbtFilterState,
  hasRelevantSbtFilterStateChanged,
  hasSbtFilterFeaturedOptions,
  isLatestSbtFilterApplyRun,
  isSbtFilterDataReady,
  getSbtFilterItemCount,
  mergeKnownQuestionsIntoFilterItems,
  normalizeAddressCountMap,
  normalizeAggregatorResponseEntries,
  normalizeIncomingFilterState,
  readSbtOptionAddress,
  readMemoizedSbtFilterSbtCacheBySlug,
  readMemoizedSbtFilterSbtNetBucketBySlug,
  readSbtFilterQuestionsCacheBySlug,
  readSbtFilterQuestionsNetBucketBySlug,
  readSbtFilterSbtCacheBySlug,
  removeMatchingSbtOptionAddress,
  resolveSbtFilterButtonText,
  resolveSbtFilterAddressItemDecision,
  resolveSbtFilterAddressItemsToFilter,
  resolveEffectiveSbtFilterNetwork,
  resolveSbtFilterCreationBlock,
  resolveSbtFilterChainId,
  resolveSbtFilterEmptyResponderShortCircuit,
  resolveSbtFilterEntryCountMapUsage,
  resolveSbtFilterExternalStateSync,
  resolveSbtFilterGroupSlug,
  resolveSbtFilterHolderScanFromBlock,
  resolveSbtFilterItemParticipantAddresses,
  resolveSbtFilterLayoutDisplayState,
  resolveSbtFilterLoadingUpdate,
  resolveSbtFilterModeSectionsState,
  resolveSbtFilterOptionsVisibilityState,
  resolveSbtFilterPanelDisplayState,
  resolveSbtFilterSurfaceDisplayState,
  scheduleMicrotask,
  setBoundedSbtHolderMemoEntry,
  shouldAppendSbtFilterSelection,
  shouldExpandMissingAddressItemsForSbtFilter,
  shouldApplySbtFilterOnDataReady,
  shouldPassThroughSbtFilter,
  shouldReapplySbtFilterAfterUpdate,
  unifySbtFilterAggregatorWithAllLocalQuestions,
} from './sbtFilterHelpers';

describe('sbtFilterHelpers', () => {
  it('reads and filters SBT option addresses without normalizing identity', () => {
    const selected = [
      { address: '0xA', label: 'Alpha' },
      { address: '0xB', label: 'Beta' },
      '0xC',
      null,
    ];

    expect(readSbtOptionAddress(selected[0])).toBe('0xA');
    expect(readSbtOptionAddress('0xA')).toBeUndefined();
    expect(hasMatchingSbtOptionAddress(selected, '0xA')).toBe(true);
    expect(hasMatchingSbtOptionAddress(selected, '0xa')).toBe(false);
    expect(appendSbtFilterOption(selected, { address: '0xD', label: 'Delta' })).toEqual([
      { address: '0xA', label: 'Alpha' },
      { address: '0xB', label: 'Beta' },
      '0xC',
      null,
      { address: '0xD', label: 'Delta' },
    ]);
    expect(appendSbtFilterOption(null, selected[0])).toEqual([{ address: '0xA', label: 'Alpha' }]);
    expect(removeMatchingSbtOptionAddress(selected, '0xA')).toEqual([
      { address: '0xB', label: 'Beta' },
      '0xC',
      null,
    ]);
    expect(removeMatchingSbtOptionAddress(null, '0xA')).toEqual([]);
    expect(shouldAppendSbtFilterSelection({
      address: '0xA',
      state: { selectedSBTGroups: selected },
      stateKey: 'selectedSBTGroups',
    })).toBe(false);
    expect(shouldAppendSbtFilterSelection({
      address: '0xD',
      state: { selectedSBTGroups: selected },
      stateKey: 'selectedSBTGroups',
    })).toBe(true);
    expect(buildSbtFilterSelectionAddPatch({
      sbtObject: { address: '0xD', label: 'Delta' },
      state: { selectedSBTGroups: selected },
      stateKey: 'selectedSBTGroups',
    })).toEqual({
      selectedSBTGroups: [
        { address: '0xA', label: 'Alpha' },
        { address: '0xB', label: 'Beta' },
        '0xC',
        null,
        { address: '0xD', label: 'Delta' },
      ],
    });
    expect(buildSbtFilterSelectionRemovePatch({
      address: '0xB',
      state: { selectedSBTGroups: selected },
      stateKey: 'selectedSBTGroups',
    })).toEqual({
      selectedSBTGroups: [
        { address: '0xA', label: 'Alpha' },
        '0xC',
        null,
      ],
    });
  });

  it('builds quick-chip selected address sets and short labels', () => {
    const selectedSet = buildSbtFilterQuickChipSelectedAddressSet([
      { address: ' 0xABCDEF0000000000000000000000000000001234 ' },
      { label: 'missing address' },
      '0xnot-object',
      { address: '' },
    ]);

    expect(Array.from(selectedSet)).toEqual(['0xabcdef0000000000000000000000000000001234']);
    expect(formatSbtFilterQuickChipAddress('')).toBe('');
    expect(formatSbtFilterQuickChipAddress('0x1234567890')).toBe('0x1234567890');
    expect(formatSbtFilterQuickChipAddress('0xABCDEF0000000000000000000000000000001234')).toBe('0xABCD...01234');
    expect(buildSbtFilterQuickChipDisplayState({
      address: ' 0xABCDEF0000000000000000000000000000001234 ',
      filterKey: 'creator',
      gateColors: ['#111111', '#222222'],
      index: 2,
      resolveDisplayLabel: () => 'Builder Badge',
      selectedSet,
      sessionSlug: 'edge',
    })).toEqual({
      address: '0xABCDEF0000000000000000000000000000001234',
      addressLower: '0xabcdef0000000000000000000000000000001234',
      chipLabel: 'Builder Badge',
      isDisabled: true,
      isSelected: true,
      key: 'creator-0xabcdef0000000000000000000000000000001234-2',
      shouldUseSelectedClass: true,
      style: { backgroundColor: '#111111' },
      testId: 'ce-sbt-quick-chip-creator-0xABCDEF0000000000000000000000000000001234',
    });
    expect(buildSbtFilterQuickChipDisplayState({
      address: '0x9999000000000000000000000000000000001234',
      selectedSet,
    })).toMatchObject({
      isDisabled: false,
      isSelected: false,
      shouldUseSelectedClass: false,
      style: { backgroundColor: undefined },
    });
    expect(buildSbtFilterQuickChipDisplayState({
      address: '0xABCDEF0000000000000000000000000000001234',
      resolveDisplayLabel: () => '0xabcdef0000000000000000000000000000001234',
    }).chipLabel).toBe('0xABCD...01234');
    expect(buildSbtFilterQuickChipDisplayState({
      address: '0xABCDEF0000000000000000000000000000001234',
      resolveDisplayLabel: () => {
        throw new Error('lookup failed');
      },
    }).chipLabel).toBe('0xABCD...01234');
    expect(buildSbtFilterQuickChipClassName({
      baseClassName: 'quick-chip',
      selectedClassName: 'quick-chip-selected',
      shouldUseSelectedClass: false,
    })).toBe('quick-chip');
    expect(buildSbtFilterQuickChipClassName({
      baseClassName: 'quick-chip',
      selectedClassName: 'quick-chip-selected',
      shouldUseSelectedClass: true,
    })).toBe('quick-chip quick-chip-selected');
    expect(hasSbtFilterFeaturedOptions(['0xA'])).toBe(true);
    expect(hasSbtFilterFeaturedOptions([])).toBe(false);
    expect(resolveSbtFilterButtonText({ mode: 'questions' })).toBe('Response Filter');
    expect(resolveSbtFilterButtonText({ mode: 'creatorAndResponder' })).toBe('Response Filter');
    expect(resolveSbtFilterButtonText({ mode: 'sbt' })).toBe('Filter');
    expect(resolveSbtFilterOptionsVisibilityState({
      autoExpand: true,
      hideLoadingOverlay: false,
      loading: true,
      showFilterOptions: false,
    })).toEqual({
      shouldRenderFilterOptions: true,
      shouldRenderLoadingOverlay: true,
    });
    expect(resolveSbtFilterOptionsVisibilityState({
      autoExpand: false,
      hideLoadingOverlay: true,
      loading: true,
      showFilterOptions: true,
    })).toEqual({
      shouldRenderFilterOptions: true,
      shouldRenderLoadingOverlay: false,
    });
    expect(resolveSbtFilterOptionsVisibilityState({
      autoExpand: false,
      loading: false,
      showFilterOptions: false,
    })).toEqual({
      shouldRenderFilterOptions: false,
      shouldRenderLoadingOverlay: false,
    });
    expect(resolveSbtFilterLayoutDisplayState()).toEqual({
      filterOptionsFrameStyle: { position: 'relative' },
      hiddenRootStyle: { display: 'none' },
      loadingOverlayStyle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 'inherit',
      },
    });
    expect(resolveSbtFilterPanelDisplayState({
      autoExpand: false,
      hasFeaturedSBTs: true,
      hideUI: false,
    })).toEqual({
      shouldRenderFilterToggleButton: true,
      shouldRenderHiddenRoot: false,
      shouldRenderShowAllCheckbox: true,
    });
    expect(resolveSbtFilterPanelDisplayState({
      autoExpand: true,
      hasFeaturedSBTs: false,
      hideUI: true,
    })).toEqual({
      shouldRenderFilterToggleButton: false,
      shouldRenderHiddenRoot: true,
      shouldRenderShowAllCheckbox: false,
    });
    expect(resolveSbtFilterSurfaceDisplayState({ buttonSurface: 'light' })).toEqual({
      shouldUseLightSurface: true,
    });
    expect(resolveSbtFilterSurfaceDisplayState({ buttonSurface: 'dark' })).toEqual({
      shouldUseLightSurface: false,
    });
    expect(buildSbtFilterSurfaceClassNames({
      filterButtonLightClassName: 'filter-button-light',
      filterOptionsBaseClassName: 'filter-options',
      filterOptionsLightClassName: 'filter-options-light',
      shouldUseLightSurface: true,
    })).toEqual({
      filterButtonClassName: 'filter-button-light',
      filterOptionsClassName: 'filter-options filter-options-light',
    });
    expect(buildSbtFilterSurfaceClassNames({
      filterButtonLightClassName: 'filter-button-light',
      filterOptionsBaseClassName: 'filter-options',
      filterOptionsLightClassName: 'filter-options-light',
      shouldUseLightSurface: false,
    })).toEqual({
      filterButtonClassName: undefined,
      filterOptionsClassName: 'filter-options',
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'responder' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: true,
      shouldRenderResponderFilter: true,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'addresses' })).toEqual({
      shouldRenderAddressFilter: true,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: false,
      shouldRenderResponderFilter: false,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'creatorAndResponder' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: true,
      shouldRenderQuestionFilter: true,
      shouldRenderQuestionResponderFilter: true,
      shouldRenderResponderFilter: false,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'questionResponses' })).toMatchObject({
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: true,
      shouldRenderQuestionResponderFilter: true,
    });
    expect(resolveSbtFilterModeSectionsState({ mode: 'unknown' })).toEqual({
      shouldRenderAddressFilter: false,
      shouldRenderQuestionCreatorFilter: false,
      shouldRenderQuestionFilter: false,
      shouldRenderQuestionResponderFilter: false,
      shouldRenderResponderFilter: false,
    });
  });

  it('resolves selected SBT slugs and chain ids with existing precedence', () => {
    const normalizeSessionSlug = jest.fn((value) => String(value || '').trim().toLowerCase());
    const getSessionSlugByName = jest.fn((name) => (name === 'Named Session' ? 'named-session' : null));

    expect(resolveSbtFilterGroupSlug({
      fallbackSlug: 'fallback',
      normalizeSessionSlug,
      sbtInput: { sessionSlug: ' Direct ' },
    })).toBe('direct');
    expect(resolveSbtFilterGroupSlug({
      fallbackSlug: 'fallback',
      getSessionSlugByName,
      normalizeSessionSlug,
      sbtInput: { sessionName: 'Named Session' },
    })).toBe('named-session');
    expect(resolveSbtFilterGroupSlug({
      fallbackSlug: 'fallback',
      getSessionSlugByName,
      normalizeSessionSlug,
      sbtInput: { sessionName: 'Missing' },
    })).toBe('fallback');

    expect(resolveSbtFilterChainId({
      getSessionChainId: () => 10,
      networkID: 84532,
      sbtInput: { chainId: 11155420 },
      sbtSlug: 'edge',
    })).toBe(10);
    expect(resolveSbtFilterChainId({
      getSessionChainId: () => 0,
      networkID: 84532,
      sbtInput: { chainID: 11155420 },
      sbtSlug: 'edge',
    })).toBe(11155420);
    expect(resolveSbtFilterChainId({
      getSessionChainId: () => null,
      networkID: 84532,
      sbtInput: {},
      sbtSlug: 'edge',
    })).toBe(84532);
  });

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
    expect(buildSbtFilterInitialState({
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
    })).toEqual({
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
    expect(buildSbtFilterInitialState({
      autoExpand: 0,
      externalSBTFilterState: 'bad',
    })).toEqual({
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
    expect(buildSbtFilterBooleanTogglePatch({
      state: { onlyVerifiedHumans: false },
      stateKey: 'onlyVerifiedHumans',
    })).toEqual({ onlyVerifiedHumans: true });
    expect(buildSbtFilterBooleanTogglePatch({
      state: { showFilterOptions: 'yes' },
      stateKey: 'showFilterOptions',
    })).toEqual({ showFilterOptions: false });
    expect(buildSbtFilterBooleanTogglePatch({
      state: null,
      stateKey: 'showAllSBTs',
    })).toEqual({ showAllSBTs: true });
  });

  it('reads filter cache buckets and merges local questions through injected cache readers', () => {
    const readCache = jest.fn((namespace: string, slug: string) => ({
      namespace,
      slug,
      84532: {
        questions: {
          q1: { id: 'q1', creator: '0xCreator' },
          q2: { id: 'q2', creator: '0xOther' },
        },
        questionResponses: {
          q1: { '0xResponder': { answer: 'yes' } },
        },
      },
    }));

    const questionCache = readSbtFilterQuestionsCacheBySlug(' alpha ', readCache);
    const sbtCache = readSbtFilterSbtCacheBySlug(' alpha ', readCache);
    const netBucket = readSbtFilterQuestionsNetBucketBySlug(' alpha ', 84532, readCache);

    expect(readCache).toHaveBeenCalledWith('questionsCache', ' alpha ', { clone: false });
    expect(readCache).toHaveBeenCalledWith('sbtCache', ' alpha ', { clone: false });
    expect(questionCache.slug).toBe(' alpha ');
    expect(sbtCache.namespace).toBe('sbtCache');
    expect(getCachedSbtFilterQuestionEntry(netBucket, 'q1')).toEqual({
      id: 'q1',
      creator: '0xCreator',
    });
    expect(getCachedSbtFilterQuestionResponseMap(netBucket, 'q1')).toEqual({
      '0xResponder': { answer: 'yes' },
    });
    expect(unifySbtFilterAggregatorWithAllLocalQuestions(
      [{ id: 'q1' }],
      84532,
      'questions',
      ' alpha ',
      readCache
    )).toEqual([
      { id: 'q1' },
      { id: 'q2', creator: '0xOther' },
    ]);
    expect(unifySbtFilterAggregatorWithAllLocalQuestions([{ id: 'q1' }], '', 'questions', 'alpha', readCache))
      .toEqual([{ id: 'q1' }]);
  });

  it('builds SBT entry cache patches without mutating existing cache buckets', () => {
    const rawCache = {
      untouched: true,
      '84532': {
        otherNetValue: 'keep',
        sbtList: {
          '0xabc': {
            name: 'Old',
            mintedAddresses: ['0x1'],
          },
          '0xdef': {
            name: 'Other',
          },
        },
      },
    };

    expect(buildSbtFilterSbtEntryCachePatch({
      rawCache,
      netKey: 84532,
      sbtAddress: '0xabc',
      entryPatch: {
        countsLoaded: true,
        mintedAddresses: ['0x2'],
      },
    })).toEqual({
      untouched: true,
      '84532': {
        otherNetValue: 'keep',
        sbtList: {
          '0xabc': {
            name: 'Old',
            mintedAddresses: ['0x2'],
            countsLoaded: true,
          },
          '0xdef': {
            name: 'Other',
          },
        },
      },
    });
    expect(rawCache['84532'].sbtList['0xabc'].mintedAddresses).toEqual(['0x1']);
    expect(buildSbtFilterSbtEntryCachePatch({
      rawCache,
      netKey: '',
      sbtAddress: '0xabc',
      entryPatch: { countsLoaded: true },
    })).toBeNull();
  });

  it('memoizes SBT cache reads by slug and resolves net buckets from the memo', () => {
    const rawCache = {
      '84532': {
        sbtList: {
          '0xabc': { countsLoaded: true },
        },
      },
    };
    const cacheBySlug = new Map<string, Record<string, unknown>>();
    const readSbtCacheBySlug = jest.fn(() => rawCache);

    const first = readMemoizedSbtFilterSbtCacheBySlug({
      cacheBySlug,
      readSbtCacheBySlug,
      slugForCache: 'alpha',
    });
    const second = readMemoizedSbtFilterSbtCacheBySlug({
      cacheBySlug,
      readSbtCacheBySlug,
      slugForCache: 'alpha',
    });
    const netBucket = readMemoizedSbtFilterSbtNetBucketBySlug({
      cacheBySlug,
      netKeyForCache: 84532,
      readSbtCacheBySlug,
      slugForCache: 'alpha',
    });

    expect(first).toBe(rawCache);
    expect(second).toBe(first);
    expect(netBucket).toBe(rawCache['84532']);
    expect(buildSbtFilterSbtCacheMemoKey('alpha')).toBe('dg:sbtCache:alpha');
    expect(buildSbtFilterSbtCacheMemoKey(null)).toBe('dg:sbtCache:');
    expect(readSbtCacheBySlug).toHaveBeenCalledTimes(1);
    expect(readSbtCacheBySlug).toHaveBeenCalledWith('alpha');
  });

  it('builds stable SBT signatures across ordering and address casing', () => {
    expect(buildSbtEntrySignature({
      address: ' 0xABC ',
      sessionSlug: ' Edge ',
      chainID: 84532,
    })).toBe('0xabc|edge|84532');
    expect(buildSbtEntrySignature(' 0xABC ')).toBe('0xabc');
    expect(buildSbtEntrySignature(null)).toBe('');

    expect(buildSbtListSignature([
      { address: '0xB', slug: 'Group', chainId: 10 },
      { address: '0xA', group: 'Group', chainID: 10 },
      null,
    ])).toBe('0xa|group|10,0xb|group|10');
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
    expect(hasRelevantSbtFilterStateChanged({
      prevState: prev,
      nextState: { ...prev, loading: true },
    })).toBe(false);
    expect(hasRelevantSbtFilterStateChanged({
      prevState: prev,
      nextState: { ...prev, onlyVerifiedHumans: true },
    })).toBe(true);
    expect(hasRelevantSbtFilterStateChanged({
      fields: ['loading'],
      prevState: prev,
      nextState: { ...prev, loading: true },
    })).toBe(true);
  });

  it('resolves external filter state sync decisions', () => {
    const prevExternalState = { selectedSBTGroups: [{ address: '0xA' }] };
    const currentExternalState = { selectedSBTGroups: [{ address: '0xB' }] };
    const currentLocalSignature = buildSbtFilterStateSignature(currentExternalState);

    expect(resolveSbtFilterExternalStateSync({
      currentExternalState,
      currentLocalSignature,
      lastExternalSignature: buildSbtFilterStateSignature(prevExternalState),
      prevExternalState,
    })).toMatchObject({
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
    expect(buildSbtFilterExternalStateSyncPatch({
      incomingStateNormalized: syncDecision.incomingStateNormalized,
    })).toMatchObject({
      selectedSBTGroups: [{ address: '0xB' }],
      lastAppliedFilterSnapshot: null,
    });
    expect(buildSbtFilterExternalStateSyncPatch({
      incomingStateNormalized: 'bad',
    })).toEqual({ lastAppliedFilterSnapshot: null });
    expect(buildSbtFilterLastAppliedSnapshotPatch({ snapshot: 'sig:1' })).toEqual({
      lastAppliedFilterSnapshot: 'sig:1',
    });
    expect(buildSbtFilterLastAppliedSnapshotPatch()).toEqual({
      lastAppliedFilterSnapshot: null,
    });

    expect(resolveSbtFilterExternalStateSync({
      currentExternalState,
      currentLocalSignature,
      lastExternalSignature: buildSbtFilterStateSignature(currentExternalState),
      prevExternalState,
    }).hasExternalChanged).toBe(false);
  });

  it('detects SBT filter reapply update decisions', () => {
    const items = [{ id: 'one' }];
    const prevProps = { items, mode: 'addresses', sbtCacheRevision: 1 };
    const nextProps = { items, mode: 'addresses', sbtCacheRevision: 1 };
    const prevState = { selectedSBTGroups: [], onlyVerifiedHumans: false };

    expect(shouldReapplySbtFilterAfterUpdate({
      nextProps,
      nextState: { ...prevState, showFilterOptions: true },
      prevProps,
      prevState,
    })).toBe(false);
    expect(shouldReapplySbtFilterAfterUpdate({
      nextProps,
      nextState: { ...prevState, onlyVerifiedHumans: true },
      prevProps,
      prevState,
    })).toBe(true);
    expect(shouldReapplySbtFilterAfterUpdate({
      nextProps: { ...nextProps, mode: 'questions' },
      nextState: prevState,
      prevProps,
      prevState,
    })).toBe(true);
    expect(shouldReapplySbtFilterAfterUpdate({
      nextProps: { ...nextProps, sbtCacheRevision: 2 },
      nextState: prevState,
      prevProps,
      prevState,
    })).toBe(true);
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
    const additionalComment = buildItemsSourceSignature([{
      id: 'q1',
      responder: '0xA',
      answer: 'yes',
      additionalComment: 'detail',
      importance: 4,
      conviction: 5,
    }]);
    const additionalComments = buildItemsSourceSignature([{
      id: 'q1',
      responder: '0xA',
      answer: 'yes',
      additionalComments: 'detail',
      importance: 4,
      conviction: 5,
    }]);
    const changedAnswer = buildItemsSourceSignature([{
      id: 'q1',
      responder: '0xA',
      answer: 'no',
      additionalComment: 'detail',
      importance: 4,
      conviction: 5,
    }]);

    expect(additionalComment).not.toBe(additionalComments);
    expect(changedAnswer).not.toBe(additionalComment);
  });

  it('keeps item-source signatures bounded for circular nested objects', () => {
    const circular: Record<string, unknown> = { id: 'q1' };
    circular.self = circular;

    expect(() => buildItemsSourceSignature([circular])).not.toThrow();
    expect(buildItemsSourceSignature(Number.NaN)).toBe('p:nan');
  });

  it('normalizes holder count maps to positive lower-case integer counts', () => {
    expect(normalizeAddressCountMap({
      '0xA': 2.9,
      '0xB': '3',
      '0xC': 0,
      '0xD': -2,
      '': 5,
      '0xE': Number.NaN,
    })).toEqual({
      '0xa': 2,
      '0xb': 3,
    });
    expect(normalizeAddressCountMap(null)).toEqual({});
    expect(resolveSbtFilterEntryCountMapUsage({
      entry: { countsLoaded: true },
      entryBurned: null,
      entryBurnedCountMap: {},
      entryMinted: null,
      entryMintedCountMap: {},
      rawEntryBurnedCounts: {},
      rawEntryMintedCounts: {},
    })).toEqual({
      checkpointBackedPartialCounts: false,
      hasAuthoritativeEntryCountMaps: true,
      hasStructuredEntryCountMaps: true,
      shouldUseEntryCountMaps: true,
    });
    expect(resolveSbtFilterEntryCountMapUsage({
      entry: { countsLoaded: false, countsScanCheckpoint: { fromBlock: 1 } },
      entryBurned: null,
      entryBurnedCountMap: {},
      entryMinted: null,
      entryMintedCountMap: { '0xa': 1 },
      rawEntryMintedCounts: { '0xa': 1 },
    })).toEqual({
      checkpointBackedPartialCounts: true,
      hasAuthoritativeEntryCountMaps: true,
      hasStructuredEntryCountMaps: true,
      shouldUseEntryCountMaps: false,
    });
    expect(resolveSbtFilterEntryCountMapUsage({
      entry: { countsLoaded: false },
      entryBurned: [],
      entryBurnedCountMap: {},
      entryMinted: [],
      entryMintedCountMap: {},
      rawEntryBurnedCounts: null,
      rawEntryMintedCounts: null,
    }).shouldUseEntryCountMaps).toBe(false);
  });

  it('builds stable count-map fingerprints', () => {
    expect(countMapFingerprint({ '0xB': 2, '0xA': 1 })).toBe(
      countMapFingerprint({ '0xa': 1, '0xb': 2 })
    );
    expect(countMapFingerprint({})).toBe('nil');
    expect(countMapFingerprint({ '0xA': 2 })).not.toBe(countMapFingerprint({ '0xA': 1 }));
  });

  it('builds holder-list fingerprints without sorting address arrays', () => {
    expect(computeHolderListFingerprint(null)).toBe('nil');
    expect(computeHolderListFingerprint(['0xA', '0xB'])).toBe(
      computeHolderListFingerprint(['0xa', '0xb'])
    );
    expect(computeHolderListFingerprint(['0xA', '0xB'])).not.toBe(
      computeHolderListFingerprint(['0xB', '0xA'])
    );
  });

  it('builds holder revision keys for cached and fetched holder sets', () => {
    expect(buildSbtFilterHolderRevisionKey({
      sbtSlug: 'alpha',
      netKey: 84532,
      sbtAddress: '0xSBT',
      sbtCacheRevision: 7,
      countsLoaded: true,
      shouldUseEntryCountMaps: true,
      mintedCountFingerprint: 'mint-counts',
      burnedCountFingerprint: 'burn-counts',
      mintedListFingerprint: 'mint-list',
      burnedListFingerprint: 'burn-list',
      creationBlock: 123,
    })).toBe('alpha|84532|0xSBT|7|1|1|mint-counts|burn-counts|mint-list|burn-list|123');
    expect(buildSbtFilterHolderRevisionKey({
      sbtSlug: '',
      netKey: '',
      sbtCacheRevision: 0,
      creationBlock: null,
    })).toBe('|||0|0|0|||||');
  });

  it('resolves SBT holder creation block precedence', () => {
    expect(resolveSbtFilterCreationBlock({
      entry: { creationBlock: null },
      entrySbtInfo: { creationBlock: '12' },
      sbtRecord: { creationBlock: '34' },
      sbtInfoRecord: { creationBlock: '56' },
    })).toBe('12');
    expect(resolveSbtFilterCreationBlock({
      entry: {},
      entrySbtInfo: {},
      sbtRecord: { creationBlock: 34 },
      sbtInfoRecord: { creationBlock: 56 },
    })).toBe(34);
    expect(resolveSbtFilterCreationBlock({
      entry: 'bad',
      entrySbtInfo: null,
      sbtRecord: {},
      sbtInfoRecord: {},
    })).toBeUndefined();
  });

  it('normalizes holder scan from-blocks and request keys', () => {
    expect(resolveSbtFilterHolderScanFromBlock('12.9')).toBe(12);
    expect(resolveSbtFilterHolderScanFromBlock(-1)).toBe(0);
    expect(resolveSbtFilterHolderScanFromBlock('bad')).toBe(0);
    expect(resolveSbtFilterHolderScanFromBlock(null)).toBe(0);
    expect(buildSbtFilterHolderRequestKey({
      sbtSlug: 'alpha',
      netKey: 84532,
      sbtAddress: '0xSBT',
      fromBlock: 12,
    })).toBe('alpha|84532|0xSBT|12');
    expect(buildSbtFilterHolderRequestKey({
      sbtSlug: '',
      netKey: '',
      sbtAddress: '',
      fromBlock: 0,
    })).toBe('|||0');
  });

  it('sets bounded holder memo entries with refresh ordering and oldest eviction', () => {
    const memo = new Map<string, Set<string>>();
    const alpha = new Set(['0x1']);
    const beta = new Set(['0x2']);
    const alphaNext = new Set(['0x3']);
    const gamma = new Set(['0x4']);

    setBoundedSbtHolderMemoEntry(memo, '', alpha, 2);
    expect(Array.from(memo.keys())).toEqual([]);

    setBoundedSbtHolderMemoEntry(memo, 'alpha', alpha, 2);
    setBoundedSbtHolderMemoEntry(memo, 'beta', beta, 2);
    setBoundedSbtHolderMemoEntry(memo, 'alpha', alphaNext, 2);
    expect(Array.from(memo.keys())).toEqual(['beta', 'alpha']);
    expect(memo.get('alpha')).toBe(alphaNext);

    setBoundedSbtHolderMemoEntry(memo, 'gamma', gamma, 2);
    expect(Array.from(memo.keys())).toEqual(['alpha', 'gamma']);
    expect(memo.get('beta')).toBeUndefined();
  });

  it('builds history summaries from event counts and net holder counts', () => {
    expect(buildHistorySummaryFromCounts({
      mintedCountByAddress: { '0xA': 2, '0xB': 1 },
      burnedCountByAddress: { '0xA': 1, '0xC': 1 },
      mintedEventCount: 0,
      burnedEventCount: 4,
    })).toEqual({
      totalMinted: '3',
      totalBurned: '4',
      activeSupply: '2',
      currentHolderCount: '2',
      historicalHolderCount: '2',
    });
  });

  it('builds net holder sets from arrays and count maps', () => {
    expect(Array.from(buildNetHoldersSet(['0xA', '0xB', '0xA'], ['0xa']))).toEqual(['0xb']);
    expect(Array.from(buildNetHoldersSetFromCounts(
      { '0xA': 2, '0xB': 1 },
      { '0xA': 1, '0xB': 1 }
    ))).toEqual(['0xa']);
  });

  it('builds fetched holder count results without changing count coercion', () => {
    const resolveHoldersSet = jest.fn(() => new Set(['0xa']));
    const result = buildSbtFilterHolderFetchResult({
      counts: {
        mintedCountByAddress: {
          '0xA': 2.9,
          '0xB': '1',
          '0xEmpty': 0,
        },
        burnedCountByAddress: {
          '0xA': 1,
          '0xDead': -1,
        },
        mintedEventCount: 4.8,
        burnedEventCount: -2,
        scannedToBlock: '18.9',
      },
      resolveHoldersSet,
    });

    expect(result).toEqual({
      mintedAddresses: ['0xa', '0xb'],
      burnedAddresses: ['0xa'],
      mintedCountByAddress: { '0xa': 2, '0xb': 1 },
      burnedCountByAddress: { '0xa': 1 },
      mintedEventCount: 4,
      burnedEventCount: 0,
      scannedToBlock: 18,
      holdersSet: new Set(['0xa']),
    });
    expect(resolveHoldersSet).toHaveBeenCalledWith(
      { '0xa': 2, '0xb': 1 },
      { '0xa': 1 }
    );

    const defaultResult = buildSbtFilterHolderFetchResult({
      counts: {
        mintedCountByAddress: { '0xA': 1, '0xB': 1 },
        burnedCountByAddress: { '0xB': 1 },
        mintedEventCount: 'bad',
        scannedToBlock: 'bad',
      },
    });
    expect(Array.from(defaultResult.holdersSet)).toEqual(['0xa']);
    expect(Number.isNaN(defaultResult.mintedEventCount)).toBe(true);
    expect(defaultResult.burnedEventCount).toBe(0);
    expect(defaultResult.scannedToBlock).toBeNull();
  });

  it('builds fetched holder cache entry patches with existing fallbacks', () => {
    expect(buildSbtFilterFetchedHolderCacheEntryPatch({
      fetched: {
        mintedAddresses: ['0xa'],
        burnedAddresses: ['0xb'],
        mintedCountByAddress: { '0xa': 2 },
        burnedCountByAddress: { '0xb': 1 },
        mintedEventCount: 3,
        burnedEventCount: 1,
        scannedToBlock: 22,
      },
    })).toEqual({
      mintedAddresses: ['0xa'],
      burnedAddresses: ['0xb'],
      mintedCountByAddress: { '0xa': 2 },
      burnedCountByAddress: { '0xb': 1 },
      mintedEventCount: 3,
      burnedEventCount: 1,
      historySummary: {
        totalMinted: '3',
        totalBurned: '1',
        activeSupply: '2',
        currentHolderCount: '1',
        historicalHolderCount: '1',
      },
      blockNumber: 22,
      countsLoaded: true,
      countsScanCheckpoint: null,
    });

    const invalidScannedBlockPatch = buildSbtFilterFetchedHolderCacheEntryPatch({
      fetched: {
        mintedEventCount: Number.NaN,
        burnedEventCount: Number.NaN,
        scannedToBlock: null,
      },
    });
    expect(invalidScannedBlockPatch.mintedEventCount).toBe(0);
    expect(invalidScannedBlockPatch.burnedEventCount).toBe(0);
    expect(invalidScannedBlockPatch.blockNumber).toBe(0);
  });

  it('builds fetched holder revision keys from fetched count evidence', () => {
    const fetched = {
      mintedAddresses: ['0xA', '0xB'],
      burnedAddresses: ['0xB'],
      mintedCountByAddress: { '0xA': 2, '0xB': 1 },
      burnedCountByAddress: { '0xB': 1 },
    };

    expect(buildSbtFilterFetchedHolderRevisionKey({
      sbtSlug: 'alpha',
      netKey: 84532,
      sbtAddress: '0xSBT',
      sbtCacheRevision: 3,
      fromBlock: 12,
      fetched,
    })).toBe(buildSbtFilterHolderRevisionKey({
      sbtSlug: 'alpha',
      netKey: 84532,
      sbtAddress: '0xSBT',
      sbtCacheRevision: 3,
      countsLoaded: true,
      shouldUseEntryCountMaps: true,
      mintedCountFingerprint: countMapFingerprint(fetched.mintedCountByAddress),
      burnedCountFingerprint: countMapFingerprint(fetched.burnedCountByAddress),
      mintedListFingerprint: computeHolderListFingerprint(fetched.mintedAddresses),
      burnedListFingerprint: computeHolderListFingerprint(fetched.burnedAddresses),
      creationBlock: 12,
    }));

    expect(buildSbtFilterFetchedHolderRevisionKey({
      fromBlock: null,
      fetched: null,
    })).toBe(buildSbtFilterHolderRevisionKey({
      countsLoaded: true,
      shouldUseEntryCountMaps: true,
      mintedCountFingerprint: countMapFingerprint({}),
      burnedCountFingerprint: countMapFingerprint({}),
      mintedListFingerprint: computeHolderListFingerprint([]),
      burnedListFingerprint: computeHolderListFingerprint([]),
      creationBlock: 0,
    }));
  });

  it('unions SBT holder sets for selected SBT entries', () => {
    const holders = buildHolderUnionSet(
      [
        { address: '0xA' },
        { address: '0xB' },
        { address: '0xMissing' },
        '0xBad',
      ],
      {
        '0xa': new Set(['0x1', '0x2']),
        '0xb': new Set(['0x2', '0x3']),
      }
    );

    expect(Array.from(holders)).toEqual(['0x1', '0x2', '0x3']);
    expect(Array.from(buildHolderUnionSet(null, { '0xa': new Set(['0x1']) }))).toEqual([]);
  });

  it('builds holder selection sets for each SBT filter lane', () => {
    const sets = buildSbtFilterHolderSelectionSets({
      selectedSBTGroupsCreator: [{ address: '0xCreator' }],
      excludedSBTGroupsCreator: [{ address: '0xCreatorExclude' }],
      selectedSBTGroupsResponder: [{ address: '0xResponder' }],
      excludedSBTGroupsResponder: [{ address: '0xResponderExclude' }],
      selectedSBTGroups: [{ address: '0xAddress' }],
      excludedSBTGroups: [{ address: '0xAddressExclude' }],
      sbtHoldersMap: {
        '0xcreator': new Set(['0xc1']),
        '0xcreatorexclude': new Set(['0xce1']),
        '0xresponder': new Set(['0xr1']),
        '0xresponderexclude': new Set(['0xre1']),
        '0xaddress': new Set(['0xa1']),
        '0xaddressexclude': new Set(['0xae1']),
      },
    });

    expect(Array.from(sets.selectedCreatorHolderSet)).toEqual(['0xc1']);
    expect(Array.from(sets.excludedCreatorHolderSet)).toEqual(['0xce1']);
    expect(Array.from(sets.selectedResponderHolderSet)).toEqual(['0xr1']);
    expect(Array.from(sets.excludedResponderHolderSet)).toEqual(['0xre1']);
    expect(Array.from(sets.selectedAddressHolderSet)).toEqual(['0xa1']);
    expect(Array.from(sets.excludedAddressHolderSet)).toEqual(['0xae1']);
    expect(buildSbtFilterHolderSelectionSets().selectedCreatorHolderSet.size).toBe(0);
  });

  it('deduplicates SBT entries by lower-case address and fills missing session metadata', () => {
    expect(buildSbtFilterSelectedEntryList({
      selectedSBTGroupsCreator: [{ address: '0xCreator' }],
      excludedSBTGroupsCreator: [null, { address: '0xCreatorExclude' }],
      selectedSBTGroupsResponder: [{ address: '0xResponder' }],
      excludedSBTGroupsResponder: [false, { address: '0xResponderExclude' }],
      selectedSBTGroups: [{ address: '0xAddress' }],
      excludedSBTGroups: [undefined, { address: '0xAddressExclude' }],
    })).toEqual([
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

    expect(doesSbtFilterAddressPassSelection({
      ...baseArgs,
      address: '0xCreator-Holder',
      excludedSBTs: excludedCreator,
      selectedSBTs: selectedCreator,
    })).toBe(true);
    expect(doesSbtFilterAddressPassSelection({
      ...baseArgs,
      address: '0xBlocked',
      excludedSBTs: excludedCreator,
      selectedSBTs: selectedCreator,
    })).toBe(false);
    expect(doesSbtFilterAddressPassSelection({
      ...baseArgs,
      address: '0xResponder-Holder',
      excludedSBTs: excludedResponder,
      selectedSBTs: selectedResponder,
    })).toBe(true);
    expect(doesSbtFilterAddressPassSelection({
      ...baseArgs,
      address: '0xAddress-Holder',
      excludedSBTs: excludedAddress,
      selectedSBTs: selectedAddress,
    })).toBe(true);
    expect(doesSbtFilterAddressPassSelection({
      ...baseArgs,
      address: '0xFallback-Holder',
      excludedSBTs: [{ address: '0xFallbackBlocked' }],
      selectedSBTs: [{ address: '0xFallback' }],
    })).toBe(true);
    expect(doesSbtFilterAddressPassSelection({
      ...baseArgs,
      address: '0xFallback-Blocked-Holder',
      excludedSBTs: [{ address: '0xFallbackBlocked' }],
      selectedSBTs: [{ address: '0xFallback' }],
    })).toBe(false);
  });

  it('resolves empty responder holder short-circuit results by mode', () => {
    const emptyHolderSet = new Set<string>();
    const selectedResponderSbts = [{ address: '0xResponderSbt' }];

    expect(resolveSbtFilterEmptyResponderShortCircuit({
      items: [{ id: 'q1' }],
      mode: 'responder',
      selectedResponderHolderSet: emptyHolderSet,
      selectedSBTGroupsResponder: selectedResponderSbts,
    })).toEqual({
      shouldShortCircuit: true,
      result: [],
      logMessage: '[SBTFilter] Responder include list has no holders. Returning empty result.',
    });

    expect(resolveSbtFilterEmptyResponderShortCircuit({
      items: { q1: [] },
      mode: 'questionResponses',
      selectedResponderHolderSet: emptyHolderSet,
      selectedSBTGroupsResponder: selectedResponderSbts,
    })).toEqual({
      shouldShortCircuit: true,
      result: {},
      logMessage: '[SBTFilter] Responder include list has no holders. Returning empty result.',
    });

    expect(resolveSbtFilterEmptyResponderShortCircuit({
      items: [{ id: 'q1' }],
      mode: 'creatorAndResponder',
      selectedResponderHolderSet: emptyHolderSet,
      selectedSBTGroupsResponder: selectedResponderSbts,
    })).toEqual({
      shouldShortCircuit: true,
      result: { filteredQuestions: [], filteredResponsesByQuestion: {} },
      logMessage: '[SBTFilter] (creatorAndResponder) Responder include has 0 holders -> return empty.',
    });

    expect(resolveSbtFilterEmptyResponderShortCircuit({
      items: null,
      mode: 'creatorAndResponder',
      selectedResponderHolderSet: emptyHolderSet,
      selectedSBTGroupsResponder: selectedResponderSbts,
    })).toEqual({
      shouldShortCircuit: true,
      result: [],
      logMessage: '[SBTFilter] (creatorAndResponder) Responder include has 0 holders -> return empty.',
    });

    expect(resolveSbtFilterEmptyResponderShortCircuit({
      mode: 'responder',
      selectedResponderHolderSet: new Set(['0xholder']),
      selectedSBTGroupsResponder: selectedResponderSbts,
    })).toEqual({
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
    expect(normalizeAggregatorResponseEntries([
      { responder: '0xA', response: 'yes' },
      'no',
    ])).toEqual([
      { responder: '0xA', response: 'yes' },
      { response: 'no' },
    ]);
    expect(normalizeAggregatorResponseEntries({
      '0xA': { responder: '0xB', response: 'yes' },
      '0xC': 'no',
    })).toEqual([
      { responder: '0xB', response: 'yes' },
      { responder: '0xC', response: 'no' },
    ]);
  });

  it('filters object-mode SBT filter payloads while preserving arrays and response maps', () => {
    const passes = (item: unknown): boolean => (
      asResponseEntry(item).responder === '0xA' ||
      asResponseEntry(item).response === 'keep'
    );

    expect(filterSbtFilterObjectItems({
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
    }, passes)).toEqual({
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
    expect(isSbtFilterDataReady({
      mode: 'addresses',
      isSBTCacheReady: false,
      isQuestionCacheReady: false,
    })).toBe(true);
    expect(isSbtFilterDataReady({
      mode: 'creator',
      isSBTCacheReady: true,
      isQuestionCacheReady: false,
    })).toBe(false);
    expect(isSbtFilterDataReady({
      mode: 'creator',
      isSBTCacheReady: true,
      isQuestionCacheReady: true,
    })).toBe(true);
    expect(isSbtFilterDataReady({
      mode: 'responder',
      isSBTCacheReady: true,
      isQuestionCacheReady: false,
    })).toBe(true);
    expect(isSbtFilterDataReady({
      mode: 'responder',
      isSBTCacheReady: false,
      isQuestionCacheReady: true,
    })).toBe(false);
    expect(shouldApplySbtFilterOnDataReady({
      hasActiveFilter: true,
      isDataReady: true,
      wasDataReady: false,
    })).toBe(true);
    expect(shouldApplySbtFilterOnDataReady({
      hasActiveFilter: false,
      isDataReady: true,
      wasDataReady: false,
    })).toBe(false);
    expect(shouldApplySbtFilterOnDataReady({
      hasActiveFilter: true,
      isDataReady: true,
      wasDataReady: true,
    })).toBe(false);
    expect(shouldApplySbtFilterOnDataReady()).toBe(false);
    expect(resolveSbtFilterLoadingUpdate({
      currentLoading: false,
      isMounted: true,
      loading: true,
      setFilterLoading: jest.fn(),
    })).toEqual({
      nextLoading: true,
      shouldNotifyParent: true,
      shouldSetLocalLoading: true,
    });
    expect(resolveSbtFilterLoadingUpdate({
      currentLoading: true,
      isMounted: true,
      loading: true,
      setFilterLoading: null,
    })).toEqual({
      nextLoading: true,
      shouldNotifyParent: false,
      shouldSetLocalLoading: false,
    });
    expect(resolveSbtFilterLoadingUpdate({
      currentLoading: false,
      isMounted: false,
      loading: true,
      setFilterLoading: jest.fn(),
    })).toMatchObject({
      shouldNotifyParent: true,
      shouldSetLocalLoading: false,
    });
    expect(buildSbtFilterLoadingPatch({ loading: true })).toEqual({ loading: true });
    expect(buildSbtFilterLoadingPatch({ loading: 1 })).toEqual({ loading: false });
    expect(isLatestSbtFilterApplyRun({
      activeApplyFilterRunId: '3',
      runId: 3,
    })).toBe(true);
    expect(isLatestSbtFilterApplyRun({
      activeApplyFilterRunId: 4,
      runId: 3,
    })).toBe(false);
    expect(isLatestSbtFilterApplyRun()).toBe(true);
  });

  it('builds SBT filter item counts and pass-through snapshots', () => {
    expect(getSbtFilterItemCount(['a', 'b'])).toBe(2);
    expect(getSbtFilterItemCount({ a: 1, b: 2 })).toBe(2);
    expect(getSbtFilterItemCount('3')).toBe(3);
    expect(shouldExpandMissingAddressItemsForSbtFilter({
      mode: 'addresses',
      expandToSbtHolders: true,
      selectedSBTGroups: [{ address: '0xA' }],
    })).toBe(true);
    expect(shouldExpandMissingAddressItemsForSbtFilter({
      mode: 'responder',
      expandToSbtHolders: true,
      selectedSBTGroups: [{ address: '0xA' }],
    })).toBe(false);
    expect(shouldPassThroughSbtFilter({
      hasActiveFilter: false,
      items: [],
      shouldExpandMissingAddressItems: false,
    })).toBe(true);
    expect(shouldPassThroughSbtFilter({
      hasActiveFilter: true,
      items: null,
      shouldExpandMissingAddressItems: true,
    })).toBe(false);
    expect(resolveSbtFilterAddressItemsToFilter({
      items: [' 0xABC ', '', null, '0xDEF'],
      selectedAddressHolderSet: new Set(['0xholder', '0xabc']),
      shouldExpandAddresses: true,
    })).toEqual([' 0xabc ', '0xdef', '0xholder', '0xabc']);
    const objectItems = { a: ['0xA'] };
    expect(resolveSbtFilterAddressItemsToFilter({
      items: objectItems,
      shouldExpandAddresses: false,
    })).toBe(objectItems);
    expect(resolveSbtFilterAddressItemDecision({
      item: '0xABC',
      selectedAddressHolderSet: new Set(['0xabc']),
      hasSelectedGroups: true,
      excludedAddressHolderSet: new Set(),
    })).toEqual({
      address: '0xabc',
      passes: true,
      shouldLogInvalidType: false,
    });
    expect(resolveSbtFilterAddressItemDecision({
      item: '0xABC',
      selectedAddressHolderSet: new Set(['0xdef']),
      hasSelectedGroups: true,
      excludedAddressHolderSet: new Set(),
    }).passes).toBe(false);
    expect(resolveSbtFilterAddressItemDecision({
      item: '0xABC',
      selectedAddressHolderSet: new Set(['0xabc']),
      hasSelectedGroups: true,
      excludedAddressHolderSet: new Set(['0xabc']),
    }).passes).toBe(false);
    expect(resolveSbtFilterAddressItemDecision({ item: { address: '0xABC' } })).toEqual({
      address: '',
      passes: false,
      shouldLogInvalidType: true,
    });
    expect(resolveSbtFilterItemParticipantAddresses({
      creator: '0xABC',
      responder: '0xDEF',
    })).toEqual({
      creator: '0xabc',
      responder: '0xdef',
    });
    expect(resolveSbtFilterItemParticipantAddresses(null)).toEqual({
      creator: null,
      responder: null,
    });
    expect(buildSbtFilterSnapshot({
      filterStateSignature: 'filter',
      mode: 'addresses',
      itemCount: 2,
      networkID: '',
      itemsSourceSignature: 'items',
      sbtCacheRevision: 7,
      passive: true,
    })).toBe('filter|addresses|2|__no-network__|items|7|passive');
  });

  it('resolves effective filter networks from props and session chain fallback', () => {
    const readSessionChainId = jest.fn((slug) => (slug === 'edge' ? 84532 : null));

    expect(resolveEffectiveSbtFilterNetwork({
      network: { chainId: 10, name: 'OP' },
      readSessionChainId,
      sessionSlug: 'edge',
    })).toEqual({ chainId: 10, name: 'OP', id: 10 });
    expect(resolveEffectiveSbtFilterNetwork({
      network: { id: 11155420, chainId: 10 },
      readSessionChainId,
      sessionSlug: 'edge',
    })).toEqual({ id: 11155420, chainId: 10 });
    expect(resolveEffectiveSbtFilterNetwork({
      readSessionChainId,
      sessionSlug: 'edge',
    })).toEqual({ id: 84532, chainId: 84532 });
    expect(resolveEffectiveSbtFilterNetwork({
      readSessionChainId,
      sessionSlug: 'missing',
    })).toBeNull();
  });

  it('merges known cache questions into question arrays and aggregators', () => {
    const questionNetCache = {
      questions: {
        q1: { id: 'q1', prompt: 'One' },
        q2: { id: 'q2', prompt: 'Two' },
      },
    };

    expect(mergeKnownQuestionsIntoFilterItems(
      [{ id: 'Q1', prompt: 'Existing' }],
      questionNetCache,
      'questions'
    )).toEqual([
      { id: 'Q1', prompt: 'Existing' },
      { id: 'q2', prompt: 'Two' },
    ]);
    expect(mergeKnownQuestionsIntoFilterItems(
      { q1: [{ response: 'yes' }] },
      questionNetCache,
      'responder'
    )).toEqual({
      q1: [{ response: 'yes' }],
      q2: [],
    });
    expect(mergeKnownQuestionsIntoFilterItems(
      [{ id: 'q1' }],
      questionNetCache,
      'addresses'
    )).toEqual([{ id: 'q1' }]);
  });
});
