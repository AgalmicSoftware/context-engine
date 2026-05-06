import {
  areSbtOptionsEqual,
  areSbtSelectorAddressListsEqual,
  applySbtSelectorAddressHydrationResultsToList,
  applySbtSelectorDiscoveredAddressesToList,
  applySbtSelectorHydrationResults,
  buildSbtSelectorCustomAddressClearPatch,
  buildSbtSelectorCustomAddressInputPatch,
  buildAggregatedSbtSelectorListFromContexts,
  buildFeaturedEntrySignature,
  buildEffectiveFeaturedAddressSet,
  buildLinkedSbtSelectorListFromKnownCache,
  buildSbtOptionsRequestSignature,
  buildScopedSbtIgnoreKey,
  buildSbtLookupKey,
  buildSbtOptionsByAddress,
  buildSbtOptionsBySelectionKey,
  buildSbtSelectorScopeFeaturedAddresses,
  buildSelectedSbtAddressSet,
  buildSelectedSbtKeySet,
  buildIgnoredSbtSelectorAddressSet,
  buildScopeFeaturedSbtSelectorEntries,
  buildSbtSelectorLogContext,
  buildSbtSelectorListScopeTargetSlugSet,
  buildSbtSelectorDiscoverySessionRef,
  buildSbtSelectorDiscoveringPatch,
  buildSharedLightUniverseKickoffSignature,
  buildSbtSelectorMetadataLookupConfig,
  buildSbtSelectorAutoSearchSessionOptions,
  buildSbtSelectorFeaturedOrder,
  buildSbtSelectorMergedSelectableOptions,
  buildSbtSelectorNameHydrationEntries,
  buildSbtSelectorNameLookupFetchList,
  buildSbtSelectorOptionFromEntry,
  buildSbtSelectorOptions,
  buildSbtSelectorOptionsStatePatch,
  buildSbtSelectorGroupOptions,
  buildSbtSelectorGroupOptionsPatch,
  buildSbtSelectorGroupPickerTogglePatch,
  buildSbtSelectorGroupSourceSelectionPatch,
  buildSbtSelectorLoadingStatusClassName,
  buildSbtSelectorRootClassName,
  buildSbtSelectorLoadingOptionsPatch,
  buildSbtSelectorManualInputTogglePatch,
  buildSbtSelectorManualInputWarningPatch,
  buildSbtSelectorCustomSbtSelection,
  buildSbtSelectorSelectedDisplayEntries,
  buildSbtSelectorSelectedOptionResetPatch,
  buildSbtSelectorSelectOptions,
  buildSbtSelectorSourceSessionSlugPatch,
  buildSelectedSbtHydrationAddresses,
  buildSelectedSbtHydrationSignature,
  buildSessionConfigSig,
  buildSessionSlugSignature,
  buildTargetSlugChainSignature,
  canRetryNameLookup,
  clearNameLookupFailure,
  compareSbtSelectorOptions,
  decorateScopedSbtEntry,
  ensureNameLookupState,
  getNameLookupDelayMs,
  getNormalizedDiscoveryOverride,
  getNormalizedNetworkChainValue,
  getSelectableSbtKey,
  getSelectOptionValue,
  getSbtSelectorLoadingOptionCount,
  getSbtSelectorLoadingStatusText,
  hasAuthoritativeSessionSlug,
  hasOwn,
  hasSelectedOrPendingSbtSelectorAddress,
  hasSelectedOrPendingSbtSelectorKey,
  isMaskedHiddenTitle,
  isMaskedSbtOptionLabel,
  isSbtSelectorForcedDebugEnabled,
  isSbtSelectorOptionsLoading,
  isUnresolvedSessionConfig,
  markNameLookupFailure,
  mergeSbtSelectorLatestCacheState,
  mergeSbtSelectorLinkedScopedEntries,
  mergeScopedSbtEntry,
  normalizeAdditionalSbtOptions,
  normalizeAddressListForSig,
  normalizeChainValue,
  normalizeSbtCacheForNet,
  normalizeDiscoverySlugs,
  normalizeSelectableSbtAddress,
  normalizeSessionSlugListForSig,
  pickNormalizedSessionSlug,
  pickOptionalNormalizedSessionSlug,
  readBoolishDebugFlag,
  readSbtSelectorScopedCacheContexts,
  resolveAuthoritativeSbtSessionBindingSlug,
  resolveConcreteSbtSessionBindingSlug,
  shouldPreferIncomingScopedSbtEntry,
  resolveDeclaredSbtSessionSlug,
  resolveDirectSbtSelectorTargetSlugs,
  resolveLinkedSbtSelectorScopeEntry,
  resolveSbtSelectorDisplayLookupSessionConfig,
  resolveSbtSelectorOptionEntryContext,
  resolveSbtDetailLinkSessionSlug,
  resolveSbtEntryChainId,
  resolveSbtSelectorDisplayOptions,
  resolveSbtSelectorEffectiveSessionSlug,
  resolveSbtSelectorGroupSourceSelection,
  resolveSbtSelectorAutoSearchButtonsState,
  resolveSbtSelectorGroupPickerState,
  resolveSbtSelectorHeaderLoadingStatusState,
  resolveSbtSelectorLabelImageState,
  resolveSbtSelectorLoadingStatusDisplayState,
  resolveSbtSelectorLoadOptionsRequestDecision,
  resolveSbtSelectorManualControlsState,
  resolveSbtSelectorManualEntryState,
  resolveSbtSelectorNoOptionsMessage,
  resolveSbtSelectorScopeMode,
  resolveSbtSelectorSelectedAddressesState,
  resolveSbtSelectorSessionLabel,
  resolveSbtSelectorSessionNetworkId,
  resolveSbtSelectorTargetedHydrationDecision,
  resolveSbtSelectorTargetSlugs,
  resolveSbtSelectorUpdateEffects,
  resolveSbtSelectorUpdateSignals,
  resolveSbtSelectorVariantDisplayState,
  resolvePropSessionSlug,
  SBT_SELECTOR_DEBUG_STORAGE_KEY,
  SBT_SELECTOR_DEBUG_QUERY_KEY,
  shouldIncludeSbtSelectorEntryForListScope,
  shouldSkipSbtSelectorEntryForOptions,
  shouldAutoSearchOtherSbtSelectorSessions,
  shouldWarmSbtSelectorRegistryCacheForTargets,
  shouldUsePropsSbtSelectorSessionConfigForSlug,
} from './sbtSelectorHelpers';

describe('sbtSelectorHelpers', () => {
  it('reads boolish debug flags', () => {
    expect(readBoolishDebugFlag(true)).toBe(true);
    expect(readBoolishDebugFlag(false)).toBe(false);
    expect(readBoolishDebugFlag(null)).toBe(false);
    expect(readBoolishDebugFlag('1')).toBe(true);
    expect(readBoolishDebugFlag(' TRUE ')).toBe(true);
    expect(readBoolishDebugFlag('yes')).toBe(true);
    expect(readBoolishDebugFlag('on')).toBe(true);
    expect(readBoolishDebugFlag('off')).toBe(false);
  });

  it('reads selector debug and auto-search runtime flags defensively', () => {
    const inactiveStorage = { getItem: jest.fn(() => null) };
    const debugStorage = {
      getItem: jest.fn((key: string) => (
        key === SBT_SELECTOR_DEBUG_STORAGE_KEY ? 'yes' : null
      )),
    };

    expect(isSbtSelectorForcedDebugEnabled({
      runtimeGlobal: { CE_SBT_SELECTOR_DEBUG: true },
      windowRef: null,
      localStorageRef: inactiveStorage,
      sessionStorageRef: inactiveStorage,
    })).toBe(true);
    expect(isSbtSelectorForcedDebugEnabled({
      runtimeGlobal: {},
      windowRef: { location: { search: `?${SBT_SELECTOR_DEBUG_QUERY_KEY}=on` } },
      localStorageRef: inactiveStorage,
      sessionStorageRef: inactiveStorage,
    })).toBe(true);
    expect(isSbtSelectorForcedDebugEnabled({
      runtimeGlobal: {},
      windowRef: null,
      localStorageRef: debugStorage,
      sessionStorageRef: inactiveStorage,
    })).toBe(true);
    expect(isSbtSelectorForcedDebugEnabled({
      runtimeGlobal: {},
      windowRef: null,
      localStorageRef: inactiveStorage,
      sessionStorageRef: debugStorage,
    })).toBe(true);
    expect(isSbtSelectorForcedDebugEnabled({
      runtimeGlobal: {},
      windowRef: null,
      localStorageRef: inactiveStorage,
      sessionStorageRef: inactiveStorage,
    })).toBe(false);
    expect(shouldAutoSearchOtherSbtSelectorSessions({
      CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS: 'on',
    }, false)).toBe(true);
    expect(shouldAutoSearchOtherSbtSelectorSessions({
      CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS: 'off',
    }, true)).toBe(false);
    expect(shouldAutoSearchOtherSbtSelectorSessions({}, true)).toBe(true);
  });

  it('backs off name lookups with a capped delay', () => {
    expect(getNameLookupDelayMs(0)).toBe(30 * 1000);
    expect(getNameLookupDelayMs(1)).toBe(30 * 1000);
    expect(getNameLookupDelayMs(2)).toBe(60 * 1000);
    expect(getNameLookupDelayMs(99)).toBe(60 * 60 * 1000);
  });

  it('builds unique selected SBT hydration addresses from valid selected entries', () => {
    expect(buildSelectedSbtHydrationAddresses([
      { address: ' 0x0000000000000000000000000000000000000001 ' },
      { address: '0x0000000000000000000000000000000000000001' },
      { address: 'not-an-address' },
      null,
      { address: '0x0000000000000000000000000000000000000002' },
    ])).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
    ]);
    expect(buildSelectedSbtHydrationAddresses('bad')).toEqual([]);
  });

  it('tracks name lookup retry state', () => {
    const cache: Record<string, unknown> = {};
    const state = ensureNameLookupState(cache, 84532);
    expect(cache).toEqual({ '84532': { sbtList: {}, nameLookupState: {} } });
    expect(ensureNameLookupState(cache, 84532)).toBe(state);

    markNameLookupFailure(state, '0xabc', 1000);
    expect(state['0xabc']).toEqual({
      attempts: 1,
      nextRetryAt: 31_000,
      lastFailureAt: 1000,
    });
    expect(canRetryNameLookup(state, '0xabc', 30_999)).toBe(false);
    expect(canRetryNameLookup(state, '0xabc', 31_000)).toBe(true);

    markNameLookupFailure(state, '0xabc', 31_000);
    expect(state['0xabc'].attempts).toBe(2);
    expect(state['0xabc'].nextRetryAt).toBe(91_000);

    clearNameLookupFailure(state, '0xabc');
    expect(state['0xabc']).toBeUndefined();
  });

  it('normalizes signature lists and lookup keys', () => {
    expect(normalizeAddressListForSig([' 0xB ', '0xa', '0xA', ''])).toEqual(['0xa', '0xb']);
    expect(normalizeSessionSlugListForSig([' Edge ', 'Edge', ''])).toEqual(['Edge', '']);
    expect(buildSessionSlugSignature(['a', 'b'])).toBe('a,b');
    expect(buildSharedLightUniverseKickoffSignature(['Beta', 'Alpha', 'Alpha', 'General'])).toBe('3:,Alpha,Beta');
    expect(buildSbtSelectorLogContext({
      effectiveSessionSlug: ' Edge Session ',
      extra: { scopeMode: 'targeted' },
      id: ' selector-a ',
      label: 'Selector A',
    })).toEqual({
      selectorId: 'selector-a',
      effectiveSessionSlug: 'Edge Session',
      scopeMode: 'targeted',
    });
    expect(buildSbtSelectorLogContext({
      effectiveSessionSlug: '',
      label: '  ',
    })?.selectorId).toBe('unnamed-selector');
    expect(buildTargetSlugChainSignature(
      ['Alpha', 'General', 'Alpha'],
      (slug) => (slug ? `${slug.length}` : '11155420')
    )).toBe('Alpha:5|:11155420');
    expect(normalizeChainValue('84532')).toBe(84532);
    expect(normalizeChainValue(0)).toBeNull();
    expect(buildSbtLookupKey({ address: ' 0xABC ', chainId: '84532' })).toBe('84532:0xabc');
    expect(buildSbtLookupKey({ address: '0xABC' })).toBe('0xabc');
    expect(buildSbtLookupKey({ address: '' })).toBe('');
    expect(getNormalizedNetworkChainValue({ chainId: '10' })).toBe(10);
    expect(getNormalizedNetworkChainValue(null)).toBeNull();
  });

  it('normalizes selectable SBT addresses and keys', () => {
    expect(normalizeSelectableSbtAddress(' 0x000000000000000000000000000000000000000A ')).toBe(
      '0x000000000000000000000000000000000000000a'
    );
    expect(normalizeSelectableSbtAddress('not-an-address')).toBe('');
    expect(getSelectableSbtKey({
      address: '0x000000000000000000000000000000000000000A',
      chainId: '84532',
    })).toBe('84532:0x000000000000000000000000000000000000000a');
    expect(getSelectableSbtKey({
      sbtAddress: '0x000000000000000000000000000000000000000B',
      sbtInfo: { chainID: '11155420' },
    })).toBe('11155420:0x000000000000000000000000000000000000000b');
    expect(getSelectableSbtKey({
      selectionKey: 'custom-key',
      address: '0x000000000000000000000000000000000000000A',
    })).toBe('custom-key');
    expect(getSelectableSbtKey('84532:0x000000000000000000000000000000000000000A')).toBe(
      '84532:0x000000000000000000000000000000000000000a'
    );
    expect(getSelectableSbtKey('0x000000000000000000000000000000000000000A')).toBe(
      '0x000000000000000000000000000000000000000a'
    );
    expect(getSelectableSbtKey('bad')).toBe('');
    expect(getSelectOptionValue({ value: 'fallback-value' })).toBe('fallback-value');
  });

  it('builds selectable option maps and selected address sets', () => {
    const first = {
      address: '0x000000000000000000000000000000000000000A',
      chainId: 84532,
      selectionKey: 'first-key',
    };
    const duplicateAddress = {
      address: '0x000000000000000000000000000000000000000a',
      chainId: 11155420,
      selectionKey: 'second-key',
    };
    const second = {
      address: '0x000000000000000000000000000000000000000B',
      chainId: 84532,
    };
    const byAddress = buildSbtOptionsByAddress([first, duplicateAddress, second]);
    expect(Array.from(byAddress.keys())).toEqual([
      '0x000000000000000000000000000000000000000a',
      '0x000000000000000000000000000000000000000b',
    ]);
    expect(byAddress.get('0x000000000000000000000000000000000000000a')).toBe(first);

    const bySelectionKey = buildSbtOptionsBySelectionKey([first, duplicateAddress, second]);
    expect(Array.from(bySelectionKey.keys())).toEqual([
      'first-key',
      'second-key',
      '84532:0x000000000000000000000000000000000000000b',
    ]);

    expect(Array.from(buildSelectedSbtKeySet([first, second]))).toEqual([
      'first-key',
      '84532:0x000000000000000000000000000000000000000b',
    ]);
    expect(Array.from(buildSelectedSbtAddressSet([first, { address: 'bad' }, second]))).toEqual([
      '0x000000000000000000000000000000000000000a',
      '0x000000000000000000000000000000000000000b',
    ]);
    expect(hasSelectedOrPendingSbtSelectorAddress({
      address: '0x000000000000000000000000000000000000000A',
      selectedAddresses: new Set(['0x000000000000000000000000000000000000000a']),
    })).toBe(true);
    expect(hasSelectedOrPendingSbtSelectorAddress({
      address: '0x000000000000000000000000000000000000000C',
      pendingAddresses: new Set(['0x000000000000000000000000000000000000000c']),
    })).toBe(true);
    expect(hasSelectedOrPendingSbtSelectorAddress({
      address: 'bad',
      pendingAddresses: new Set(['bad']),
    })).toBe(false);
    expect(hasSelectedOrPendingSbtSelectorKey({
      value: first,
      selectedKeys: new Set(['first-key']),
    })).toBe(true);
    expect(hasSelectedOrPendingSbtSelectorKey({
      value: second,
      pendingKeys: new Set(['84532:0x000000000000000000000000000000000000000b']),
    })).toBe(true);
    expect(hasSelectedOrPendingSbtSelectorKey({
      value: 'bad',
      pendingKeys: new Set(['bad']),
    })).toBe(false);
    expect(Array.from(buildEffectiveFeaturedAddressSet({
      scopeFeaturedAddresses: ['0x000000000000000000000000000000000000000C'],
      defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000D'],
    }))).toEqual(['0x000000000000000000000000000000000000000c']);
    expect(Array.from(buildEffectiveFeaturedAddressSet({
      scopeFeaturedAddresses: [],
      defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000D'],
    }))).toEqual(['0x000000000000000000000000000000000000000d']);
  });

  it('merges selectable options while preserving cached address precedence', () => {
    const cached = { address: '0x000000000000000000000000000000000000000A', name: 'Cached' };
    const duplicateAdditional = { address: '0x000000000000000000000000000000000000000a', name: 'Additional duplicate' };
    const newAdditional = { address: '0x000000000000000000000000000000000000000B', name: 'Additional' };

    expect(buildSbtSelectorMergedSelectableOptions({
      sbtOptions: [cached],
      additionalOptions: [duplicateAdditional, newAdditional],
    })).toEqual([cached, newAdditional]);
    expect(buildSbtSelectorMergedSelectableOptions({
      sbtOptions: 'bad',
      additionalOptions: [newAdditional],
    })).toEqual([newAdditional]);
  });

  it('resolves display options using scope featured entries before defaults', () => {
    const optionA = { address: '0x000000000000000000000000000000000000000A', name: 'A' };
    const optionB = { address: '0x000000000000000000000000000000000000000B', name: 'B' };

    expect(resolveSbtSelectorDisplayOptions({
      defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000A'],
      limitToFeatured: true,
      mergedSbtOptions: [optionA, optionB],
      scopeFeaturedAddresses: ['0x000000000000000000000000000000000000000B'],
    })).toEqual({
      displayOptions: [optionB],
      effectiveFeatured: ['0x000000000000000000000000000000000000000B'],
      hasFeaturedSBTs: true,
    });
    expect(resolveSbtSelectorDisplayOptions({
      defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000A'],
      limitToFeatured: false,
      mergedSbtOptions: [optionA, optionB],
      scopeFeaturedAddresses: [],
    }).displayOptions).toEqual([optionA, optionB]);
  });

  it('builds react-select options from display SBT options', () => {
    expect(buildSbtSelectorSelectOptions([
      {
        address: '0x000000000000000000000000000000000000000A',
        chainId: 84532,
        image: 'badge.png',
        name: 'Alpha',
      },
      {
        address: '0x000000000000000000000000000000000000000B',
        name: null,
        selectionKey: 'custom-selection',
      },
    ])).toEqual([
      {
        value: '0x000000000000000000000000000000000000000A',
        selectionKey: '84532:0x000000000000000000000000000000000000000a',
        label: 'Alpha',
        image: 'badge.png',
        chainId: 84532,
      },
      {
        value: '0x000000000000000000000000000000000000000B',
        selectionKey: 'custom-selection',
        label: '',
        image: undefined,
        chainId: undefined,
      },
    ]);
    expect(buildSbtSelectorSelectOptions('bad')).toEqual([]);
  });

  it('normalizes additional SBT options', () => {
    expect(normalizeAdditionalSbtOptions([
      { sbtAddress: ' 0xabc ', label: 'Labelled' },
      { value: '0xdef' },
      { name: 'Named', address: '0x123' },
      { label: 'missing address' },
      null,
    ])).toEqual([
      { sbtAddress: ' 0xabc ', label: 'Labelled', address: '0xabc', name: 'Labelled' },
      { value: '0xdef', address: '0xdef', name: '0xdef' },
      { name: 'Named', address: '0x123' },
    ]);
    expect(normalizeAdditionalSbtOptions(null)).toEqual([]);
  });

  it('builds selected display entries from selected SBTs and option cache data', () => {
    const selected = [
      {
        address: '0x000000000000000000000000000000000000000A',
        chainId: 84532,
        name: '',
        sessionSlug: 'Selected',
        sessionBindingSlug: 'SelectedBinding',
      },
      {
        address: '0x000000000000000000000000000000000000000B',
        chainId: 84532,
        sbtInfo: { title: 'Fallback Badge' },
      },
      'not-an-option',
    ];
    const optionA = {
      address: '0x000000000000000000000000000000000000000a',
      chainId: 84532,
      name: 'Cached Badge',
      image: 'ar://image',
      sessionName: 'Cached Session',
      sessionSlug: 'Cached',
      sessionBindingSlug: 'CachedBinding',
    };
    const resolveSbtLabel = jest.fn(() => 'Resolved Label');

    const display = buildSbtSelectorSelectedDisplayEntries({
      currentSessionSlug: 'Current',
      resolveSbtLabel,
      sbtOptionsByAddress: buildSbtOptionsByAddress([optionA]),
      sbtOptionsBySelectionKey: buildSbtOptionsBySelectionKey([]),
      selectedSbts: selected,
    });

    expect(display[0]).toMatchObject({
      name: 'Cached Badge',
      image: 'ar://image',
      sessionName: 'Cached Session',
      sessionSlug: 'Cached',
      sessionBindingSlug: 'CachedBinding',
    });
    expect(display[1]).toMatchObject({
      name: 'Resolved Label',
      image: null,
      sessionName: null,
      sessionSlug: 'Current',
    });
    expect(display[2]).toBe('not-an-option');
    expect(resolveSbtLabel).toHaveBeenCalledWith(
      { title: 'Fallback Badge' },
      '0x000000000000000000000000000000000000000b',
      'Current'
    );
  });

  it('formats selector loading counts and text', () => {
    expect(getSbtSelectorLoadingOptionCount([{ address: 'a' }, { address: 'b' }])).toBe(2);
    expect(getSbtSelectorLoadingOptionCount(null)).toBe(0);
    expect(isSbtSelectorOptionsLoading({ loadingOptions: false, discovering: true })).toBe(true);
    expect(isSbtSelectorOptionsLoading({ loadingOptions: false, discovering: false })).toBe(false);
    expect(resolveSbtSelectorNoOptionsMessage({ isLoading: true, pluralLabel: 'Groups' })).toBeNull();
    expect(resolveSbtSelectorNoOptionsMessage({ isLoading: false, pluralLabel: 'Groups' })).toBe('No Groups');
    expect(resolveSbtSelectorLabelImageState({ image: '' })).toEqual({
      imageSrc: '',
      shouldRenderImage: false,
    });
    expect(resolveSbtSelectorLabelImageState({ image: 'https://example.test/badge.png' })).toEqual({
      imageSrc: 'https://example.test/badge.png',
      shouldRenderImage: true,
    });
    expect(resolveSbtSelectorLoadingStatusDisplayState({ compact: false, includeTestId: true })).toEqual({
      shouldAttachRootTestId: true,
      shouldAttachTextTestId: true,
      shouldUseCompactClass: false,
    });
    expect(resolveSbtSelectorLoadingStatusDisplayState({ compact: true, includeTestId: false })).toEqual({
      shouldAttachRootTestId: false,
      shouldAttachTextTestId: false,
      shouldUseCompactClass: true,
    });
    expect(buildSbtSelectorLoadingStatusClassName({
      baseClassName: 'loading-status',
      compactClassName: 'loading-status-compact',
      shouldUseCompactClass: false,
    })).toBe('loading-status');
    expect(buildSbtSelectorLoadingStatusClassName({
      baseClassName: 'loading-status',
      compactClassName: 'loading-status-compact',
      shouldUseCompactClass: true,
    })).toBe('loading-status loading-status-compact');
    expect(resolveSbtSelectorHeaderLoadingStatusState({ isLoading: true })).toEqual({
      shouldRenderHeaderLoadingStatus: true,
    });
    expect(resolveSbtSelectorHeaderLoadingStatusState({ isLoading: false })).toEqual({
      shouldRenderHeaderLoadingStatus: false,
    });
    expect(getSbtSelectorLoadingStatusText({ count: 0 })).toBe('Loading');
    expect(getSbtSelectorLoadingStatusText({ count: 2 })).toBe('Loading 2');
    expect(getSbtSelectorLoadingStatusText({ compact: true, count: 2 })).toBe('2');
    expect(getSbtSelectorLoadingStatusText({ compact: true, count: 0 })).toBe('Loading');
  });

  it('resolves selector session network id by source precedence', () => {
    const baseArgs = {
      defaultFallbackChainId: 11155420,
      directChainId: 84532,
      getNormalizedNetworkChainValue: () => 10,
      getSessionChainId: () => 420,
      network: { id: 5 },
      slug: 'Alpha',
    };

    expect(resolveSbtSelectorSessionNetworkId({
      ...baseArgs,
      propsSessionConfig: { networkChainId: '999' },
      shouldUsePropsSessionConfig: true,
    })).toBe(999);
    expect(resolveSbtSelectorSessionNetworkId({
      ...baseArgs,
      displayLookupSessionConfig: { networkChainId: 777 },
      getSessionChainId: () => null,
    })).toBe(777);
    expect(resolveSbtSelectorSessionNetworkId({
      ...baseArgs,
      displayLookupSessionConfig: { __registry: { chainId: 778 } },
      getSessionChainId: () => null,
    })).toBe(778);
    expect(resolveSbtSelectorSessionNetworkId({
      ...baseArgs,
      displayLookupSessionConfig: { contracts: { sbtFactory: { chainId: 779 } } },
      getSessionChainId: () => null,
    })).toBe(779);
    expect(resolveSbtSelectorSessionNetworkId({
      ...baseArgs,
      getSessionChainId: () => null,
      directChainId: '',
    })).toBe(10);
    expect(resolveSbtSelectorSessionNetworkId({
      defaultFallbackChainId: 11155420,
      getNormalizedNetworkChainValue: () => null,
      getSessionChainId: () => null,
    })).toBe(11155420);
  });

  it('builds selector metadata lookup config with merged contracts and chain context', () => {
    expect(buildSbtSelectorMetadataLookupConfig({
      baseConfig: {
        sessionName: 'Base',
        contracts: { sbtFactory: { address: '0xBase' } },
        __registry: { source: 'base' },
      },
      chainId: 84532,
      propsConfig: {
        sessionName: 'Props',
        contracts: { surveys: { address: '0xSurvey' } },
      },
      sessionSlug: 'Alpha',
      shouldUsePropsConfig: true,
    })).toEqual({
      sessionName: 'Props',
      slug: 'Alpha',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0xBase' },
        surveys: { address: '0xSurvey' },
      },
      __registry: { source: 'base', chainId: 84532 },
    });
    expect(buildSbtSelectorMetadataLookupConfig({
      baseConfig: {
        networkChainId: 10,
        __registry: { chainId: 10 },
      },
      propsConfig: {
        networkChainId: 84532,
      },
      sessionSlug: null,
      shouldUsePropsConfig: false,
    })).toEqual({
      slug: '',
      networkChainId: 10,
      contracts: {},
      __registry: { chainId: 10 },
    });
    expect(buildSbtSelectorDiscoverySessionRef({
      metadataLookupConfig: { sessionName: 'Base', slug: 'Old' },
      sessionSlug: 'Alpha',
    })).toEqual({ sessionName: 'Base', slug: 'Alpha' });
    expect(buildSbtSelectorDiscoverySessionRef({
      metadataLookupConfig: null,
      sessionSlug: null,
    })).toEqual({ slug: '' });
    expect(resolveSbtSelectorSessionLabel({
      sessionConfig: { sessionName: 'Alpha Session' },
      sessionSlug: 'alpha',
    })).toBe('Alpha Session (alpha)');
    expect(resolveSbtSelectorSessionLabel({
      sessionConfig: { sessionName: 'alpha' },
      sessionSlug: 'alpha',
    })).toBe('alpha');
    expect(resolveSbtSelectorSessionLabel({
      sessionConfig: {},
      sessionSlug: '',
    })).toBe('General');
  });

  it('normalizes selector slugs and scoped ignore keys', () => {
    expect(pickNormalizedSessionSlug(null, undefined, 'Alpha')).toBe('Alpha');
    expect(pickNormalizedSessionSlug(null, 'General', 'Alpha')).toBe('');
    expect(pickNormalizedSessionSlug(null, undefined)).toBe('');
    expect(pickOptionalNormalizedSessionSlug(undefined, null)).toBeNull();
    expect(pickOptionalNormalizedSessionSlug('General')).toBe('');
    expect(buildScopedSbtIgnoreKey({ slug: 'Alpha', address: ' 0xABC ' })).toBe('Alpha|0xabc');
    expect(buildScopedSbtIgnoreKey({ slug: 'General', address: '0xABC' })).toBe('|0xabc');
    expect(buildScopedSbtIgnoreKey({ slug: 'Alpha', address: '' })).toBe('');
    expect(hasOwn({ present: undefined }, 'present')).toBe(true);
    expect(hasOwn(Object.create({ inherited: true }), 'inherited')).toBe(false);
    expect(hasOwn(null, 'missing')).toBe(false);
  });

  it('normalizes prop and discovery slugs', () => {
    expect(resolvePropSessionSlug({ sessionSlug: 'Alpha', activeSessionSlug: 'Beta' })).toBe('Alpha');
    expect(resolvePropSessionSlug({ activeSessionSlug: 'Beta' })).toBe('Beta');
    expect(resolvePropSessionSlug({ sessionSlug: 'General', activeSessionSlug: 'Beta' })).toBe('');
    expect(normalizeDiscoverySlugs(['Alpha', 'Alpha', 'General', null], { allowEmpty: true })).toEqual(['Alpha', '']);
    expect(normalizeDiscoverySlugs(['Alpha', 'General', null], { allowEmpty: false })).toEqual(['Alpha']);
    expect(Array.from(buildSbtSelectorListScopeTargetSlugSet({
      fallbackSlug: 'Fallback',
      scopeMode: 'list',
      targetSlugs: ['Alpha', 'Alpha', null],
    }) || [])).toEqual(['Alpha', '']);
    expect(Array.from(buildSbtSelectorListScopeTargetSlugSet({
      fallbackSlug: 'Fallback',
      scopeMode: 'list',
      targetSlugs: [],
    }) || [])).toEqual(['Fallback']);
    expect(buildSbtSelectorListScopeTargetSlugSet({
      fallbackSlug: 'Fallback',
      scopeMode: 'active',
      targetSlugs: ['Alpha'],
    })).toBeNull();
    expect(getNormalizedDiscoveryOverride({ discoverySessionSlugs: ['Alpha', 'Alpha'] })).toEqual(['Alpha']);
    expect(getNormalizedDiscoveryOverride({ discoverySessionSlugs: [] })).toEqual([]);
    expect(getNormalizedDiscoveryOverride({})).toEqual([]);
  });

  it('resolves directly invoked target slugs from overrides and scan scope', () => {
    const normalizeSlugs = (slugs: unknown, options = {}) => normalizeDiscoverySlugs(slugs, options);
    expect(resolveDirectSbtSelectorTargetSlugs({
      explicitOverride: [' Alpha ', 'beta'],
      normalizeDiscoverySlugs: normalizeSlugs,
      propSessionSlug: 'ignored',
      readSessionScanScope: () => 'all',
    })).toEqual(['Alpha', 'beta']);
    expect(resolveDirectSbtSelectorTargetSlugs({
      normalizeDiscoverySlugs: normalizeSlugs,
      propSessionSlug: 'edge',
      readSessionScanScope: () => 'general',
    })).toEqual(['']);
    expect(resolveDirectSbtSelectorTargetSlugs({
      normalizeDiscoverySlugs: normalizeSlugs,
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['gamma', ''],
    })).toEqual(['gamma', '']);
    expect(resolveDirectSbtSelectorTargetSlugs({
      getAllSessionSlugs: () => ['alpha', ''],
      normalizeDiscoverySlugs: normalizeSlugs,
      readSessionScanScope: () => 'all',
    })).toEqual(['alpha', '']);
    expect(resolveDirectSbtSelectorTargetSlugs({
      normalizeDiscoverySlugs: normalizeSlugs,
      propSessionSlug: 'edge',
      readSessionScanScope: () => 'unknown',
    })).toEqual(['edge']);
    expect(resolveSbtSelectorEffectiveSessionSlug({
      props: { sessionSlug: 'Active' },
      sourceSessionSlug: 'Override',
    })).toBe('Active');
    expect(resolveSbtSelectorEffectiveSessionSlug({
      groupOverride: true,
      props: { sessionSlug: 'Active' },
      sourceSessionSlug: 'Override',
    })).toBe('Override');
    expect(resolveSbtSelectorEffectiveSessionSlug({
      groupOverride: true,
      sourceSessionSlug: null,
    })).toBe('');
    expect(resolveSbtSelectorGroupSourceSelection({
      activeSlug: 'Active',
      next: '__active__',
    })).toEqual({
      groupOverride: false,
      slugOverride: 'Active',
      sourceSessionSlug: 'Active',
    });
    expect(resolveSbtSelectorGroupSourceSelection({
      activeSlug: 'Active',
      next: 'Override',
    })).toEqual({
      groupOverride: true,
      slugOverride: 'Override',
      sourceSessionSlug: 'Override',
    });
    expect(buildSbtSelectorGroupOptions({
      slugs: ['Alpha', '', null],
      getSessionLabel: (slug) => `Label:${String(slug || 'General')}`,
    })).toEqual([
      { value: 'Alpha', label: 'Label:Alpha' },
      { value: '', label: 'Label:General' },
      { value: '', label: 'Label:General' },
    ]);
    expect(buildSbtSelectorGroupOptions({
      slugs: 'Alpha',
    })).toEqual([]);
    expect(buildSbtSelectorGroupSourceSelectionPatch({
      selection: {
        groupOverride: true,
        sourceSessionSlug: 'Override',
        slugOverride: 'Ignored by patch',
      },
    })).toEqual({
      groupOverride: true,
      sourceSessionSlug: 'Override',
    });
    expect(buildSbtSelectorGroupSourceSelectionPatch({
      selection: null,
    })).toEqual({
      groupOverride: false,
      sourceSessionSlug: '',
    });
    expect(buildSbtSelectorManualInputTogglePatch({
      showManualInput: false,
    })).toEqual({
      manualInputWarning: '',
      showManualInput: true,
    });
    expect(buildSbtSelectorManualInputTogglePatch({
      showManualInput: true,
    })).toEqual({
      manualInputWarning: '',
      showManualInput: false,
    });
    expect(buildSbtSelectorGroupPickerTogglePatch({
      showGroupPicker: false,
    })).toEqual({
      showGroupPicker: true,
    });
    expect(buildSbtSelectorGroupPickerTogglePatch({
      showGroupPicker: true,
    })).toEqual({
      showGroupPicker: false,
    });
    expect(buildSbtSelectorCustomAddressInputPatch(' 0xabc ')).toEqual({
      customSBTAddress: ' 0xabc ',
      manualInputWarning: '',
    });
    expect(buildSbtSelectorCustomAddressInputPatch(null)).toEqual({
      customSBTAddress: '',
      manualInputWarning: '',
    });
    expect(buildSbtSelectorCustomAddressClearPatch()).toEqual({
      customSBTAddress: '',
      manualInputWarning: '',
    });
    expect(resolveSbtSelectorManualEntryState({
      customSBTAddress: '0x00000000000000000000000000000000000000AA',
      isAddress: (value: string) => value.endsWith('AA'),
    })).toEqual({
      canAddCustomAddress: true,
    });
    expect(resolveSbtSelectorManualEntryState({
      customSBTAddress: ' 0x00000000000000000000000000000000000000AA ',
      isAddress: (value: string) => value.endsWith('AA'),
    })).toEqual({
      canAddCustomAddress: false,
    });
    expect(resolveSbtSelectorManualControlsState({
      manualInputWarning: '',
      showManualInput: false,
    })).toEqual({
      manualToggleLabel: '+ By Address',
      shouldRenderManualEntry: false,
      shouldRenderManualWarning: false,
    });
    expect(resolveSbtSelectorManualControlsState({
      manualInputWarning: 'Invalid address',
      showManualInput: true,
    })).toEqual({
      manualToggleLabel: 'Hide',
      shouldRenderManualEntry: true,
      shouldRenderManualWarning: true,
    });
    expect(resolveSbtSelectorSelectedAddressesState({
      selectedSbts: [{ address: '0xabc' }],
    })).toEqual({
      shouldRenderSelectedAddresses: true,
    });
    expect(resolveSbtSelectorSelectedAddressesState({
      selectedSbts: [],
    })).toEqual({
      shouldRenderSelectedAddresses: false,
    });
    expect(resolveSbtSelectorSelectedAddressesState({
      selectedSbts: 'bad',
    })).toEqual({
      shouldRenderSelectedAddresses: false,
    });
    expect(resolveSbtSelectorAutoSearchButtonsState({
      autoSearchSessionOptions: [],
      enableGroupSelect: true,
      groupOverride: true,
    })).toEqual({
      shouldRenderAutoSearchSessionButtons: true,
    });
    expect(resolveSbtSelectorAutoSearchButtonsState({
      autoSearchSessionOptions: [{ value: 'alpha' }],
      enableGroupSelect: true,
      groupOverride: false,
    })).toEqual({
      shouldRenderAutoSearchSessionButtons: true,
    });
    expect(resolveSbtSelectorAutoSearchButtonsState({
      autoSearchSessionOptions: [{ value: 'alpha' }],
      enableGroupSelect: false,
      groupOverride: true,
    })).toEqual({
      shouldRenderAutoSearchSessionButtons: false,
    });
    expect(resolveSbtSelectorGroupPickerState({
      currentSessionSlug: 'Alpha',
      enableGroupSelect: true,
      groupOverride: true,
      showGroupPicker: true,
    })).toEqual({
      selectedGroupValue: 'Alpha',
      shouldRenderGroupPicker: true,
      shouldRenderGroupSettingsButton: true,
    });
    expect(resolveSbtSelectorGroupPickerState({
      currentSessionSlug: 'Alpha',
      enableGroupSelect: true,
      groupOverride: false,
      showGroupPicker: false,
    })).toEqual({
      selectedGroupValue: '__active__',
      shouldRenderGroupPicker: false,
      shouldRenderGroupSettingsButton: true,
    });
    expect(resolveSbtSelectorGroupPickerState({
      currentSessionSlug: 'Alpha',
      enableGroupSelect: false,
      groupOverride: true,
      showGroupPicker: true,
    })).toEqual({
      selectedGroupValue: 'Alpha',
      shouldRenderGroupPicker: false,
      shouldRenderGroupSettingsButton: false,
    });
    expect(resolveSbtSelectorVariantDisplayState({ variant: 'admin' })).toEqual({
      shouldUseAdminVariant: true,
      shouldUseCreateVariant: false,
    });
    expect(resolveSbtSelectorVariantDisplayState({ variant: 'create' })).toEqual({
      shouldUseAdminVariant: false,
      shouldUseCreateVariant: true,
    });
    expect(resolveSbtSelectorVariantDisplayState({ variant: 'other' })).toEqual({
      shouldUseAdminVariant: false,
      shouldUseCreateVariant: false,
    });
    expect(buildSbtSelectorRootClassName({
      adminClassName: 'admin',
      baseClassName: 'root',
      createClassName: 'create',
      variant: 'admin',
    })).toBe('root admin');
    expect(buildSbtSelectorRootClassName({
      adminClassName: 'admin',
      baseClassName: 'root',
      createClassName: 'create',
      variant: 'create',
    })).toBe('root create');
    expect(buildSbtSelectorRootClassName({
      baseClassName: 'root',
      variant: 'other',
    })).toBe('root');
    expect(buildSbtSelectorSourceSessionSlugPatch({ slug: 'Alpha' })).toEqual({
      sourceSessionSlug: 'Alpha',
    });
    expect(buildSbtSelectorSourceSessionSlugPatch({ slug: null })).toEqual({
      sourceSessionSlug: '',
    });
    expect(buildSbtSelectorDiscoveringPatch({ discovering: true })).toEqual({
      discovering: true,
    });
    expect(buildSbtSelectorDiscoveringPatch({ discovering: 'true' })).toEqual({
      discovering: false,
    });
    expect(buildSbtSelectorLoadingOptionsPatch({ loadingOptions: true })).toEqual({
      loadingOptions: true,
    });
    expect(buildSbtSelectorLoadingOptionsPatch({ loadingOptions: 1 })).toEqual({
      loadingOptions: false,
    });
    const groupOptions = [{ value: 'Alpha', label: 'Alpha' }];
    expect(buildSbtSelectorGroupOptionsPatch({ groupOptions })).toEqual({
      groupOptions,
    });
    expect(buildSbtSelectorGroupOptionsPatch({ groupOptions: null })).toEqual({
      groupOptions: [],
    });
    expect(buildSbtSelectorSelectedOptionResetPatch()).toEqual({
      selectedOption: null,
    });
    expect(buildSbtSelectorManualInputWarningPatch({ warning: 'Featured only' })).toEqual({
      manualInputWarning: 'Featured only',
    });
    expect(buildSbtSelectorManualInputWarningPatch({ warning: null })).toEqual({
      manualInputWarning: '',
    });
    expect(buildSbtSelectorCustomSbtSelection({
      address: '0x00000000000000000000000000000000000000AA',
      image: 'https://example.test/badge.png',
      name: 'Custom SBT',
      resolvedSlug: 'Alpha',
      sbtInfo: {
        chainID: 84532,
        sessionName: 'Alpha Session',
        sessionSlug: 'Alpha',
      },
    })).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      name: 'Custom SBT',
      image: 'https://example.test/badge.png',
      sessionSlug: 'Alpha',
      sessionName: 'Alpha Session',
      chainId: 84532,
      sessionBindingSlug: 'Alpha',
      selectionKey: '84532:0x00000000000000000000000000000000000000aa',
    });
    expect(buildSbtSelectorCustomSbtSelection({
      address: '0xabc',
      resolvedSlug: '',
      sbtInfo: null,
    })).toEqual({
      address: '0xabc',
      name: '',
      image: null,
      sessionSlug: '',
      sessionName: null,
      chainId: null,
      sessionBindingSlug: '',
      selectionKey: '0xabc',
    });
    expect(resolveSbtSelectorTargetSlugs({
      directlyInvokedTargetSlugs: ['Direct'],
      groupOverride: true,
      sourceSessionSlug: 'Override',
    })).toEqual(['Override']);
    expect(resolveSbtSelectorTargetSlugs({
      directlyInvokedTargetSlugs: ['Direct'],
      groupOverride: true,
      sourceSessionSlug: 'Override',
      slugOverride: null,
    })).toEqual(['']);
    expect(resolveSbtSelectorTargetSlugs({
      directlyInvokedTargetSlugs: ['Direct'],
      groupOverride: false,
    })).toEqual(['Direct']);
    expect(shouldWarmSbtSelectorRegistryCacheForTargets({
      targetSlugs: [],
      shouldUsePropsSessionConfigForSlug: () => true,
    })).toBe(true);
    expect(shouldWarmSbtSelectorRegistryCacheForTargets({
      targetSlugs: ['active', 'missing'],
      shouldUsePropsSessionConfigForSlug: (slug) => slug === 'active',
    })).toBe(true);
    expect(shouldWarmSbtSelectorRegistryCacheForTargets({
      targetSlugs: ['active'],
      shouldUsePropsSessionConfigForSlug: (slug) => slug === 'active',
    })).toBe(false);
    expect(shouldUsePropsSbtSelectorSessionConfigForSlug({
      effectiveSessionSlug: 'Active',
      sessionConfig: { slug: 'Props' },
      slugIn: 'Props',
    })).toBe(true);
    expect(shouldUsePropsSbtSelectorSessionConfigForSlug({
      effectiveSessionSlug: 'Active',
      sessionConfig: { slug: 'Props' },
      slugIn: 'Active',
    })).toBe(true);
    expect(shouldUsePropsSbtSelectorSessionConfigForSlug({
      effectiveSessionSlug: 'Active',
      sessionConfig: { slug: 'Props' },
      slugIn: 'Missing',
    })).toBe(false);
    expect(shouldUsePropsSbtSelectorSessionConfigForSlug({
      effectiveSessionSlug: 'Active',
      sessionConfig: null,
      slugIn: 'Active',
    })).toBe(false);
    expect(resolveSbtSelectorDisplayLookupSessionConfig({
      allowDemoSessionFallback: true,
      getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
      getSessionConfigBySlugOrDefault: () => ({ slug: 'strict' }),
      isUnresolvedSessionConfig: () => false,
      sessionSlug: 'Alpha',
    })).toEqual({ slug: 'strict' });
    expect(resolveSbtSelectorDisplayLookupSessionConfig({
      allowDemoSessionFallback: true,
      getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
      getSessionConfigBySlugOrDefault: () => ({ __unresolved: true }),
      isUnresolvedSessionConfig: () => true,
      sessionSlug: 'Alpha',
    })).toEqual({ slug: 'demo' });
    expect(resolveSbtSelectorDisplayLookupSessionConfig({
      allowDemoSessionFallback: false,
      getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
      getSessionConfigBySlugOrDefault: () => ({ __unresolved: true }),
      isUnresolvedSessionConfig: () => true,
      sessionSlug: 'Alpha',
    })).toEqual({ __unresolved: true });
    expect(resolveSbtSelectorDisplayLookupSessionConfig({
      allowDemoSessionFallback: true,
      getSessionConfigBySlugOrDefault: () => null,
      sessionSlug: 'Alpha',
    })).toBeNull();
  });

  it('resolves selector scope mode precedence', () => {
    expect(resolveSbtSelectorScopeMode({
      groupOverride: true,
      discoveryOverride: ['alpha'],
      readSessionScanScope: () => 'all',
    })).toBe('override');
    expect(resolveSbtSelectorScopeMode({
      groupOverride: false,
      discoveryOverride: ['alpha'],
      readSessionScanScope: () => 'all',
    })).toBe('explicit');
    expect(resolveSbtSelectorScopeMode({
      groupOverride: false,
      discoveryOverride: [],
      readSessionScanScope: () => 'list',
    })).toBe('list');
    expect(resolveSbtSelectorScopeMode()).toBe('');
  });

  it('normalizes SBT cache buckets for a network key', () => {
    expect(normalizeSbtCacheForNet(null, 84532)).toEqual({
      '84532': { sbtList: {} },
    });
    const existingList = {
      '0xabc': { address: '0xabc' },
    };
    const normalized = normalizeSbtCacheForNet({
      '84532': { sbtList: existingList, other: true },
    }, '84532');
    expect(normalized['84532'].sbtList).toBe(existingList);
    expect(normalized['84532'].other).toBe(true);
    expect(normalizeSbtCacheForNet({
      '84532': { sbtList: null },
    }, '84532')['84532'].sbtList).toEqual({});
  });

  it('reads scoped SBT cache contexts with cloned lists and lookup state', async () => {
    const existingList = {
      '0xabc': { sbtAddress: '0xabc', slug: 'alpha' },
    };
    const existingLookupState = {
      '0xabc': { attempts: 1 },
    };
    const readSbtCacheBySlug = jest.fn(async (slug) => (
      slug === 'alpha'
        ? { 84532: { sbtList: existingList, nameLookupState: existingLookupState } }
        : { 11155420: { sbtList: { '0xdef': { sbtAddress: '0xdef' } } } }
    ));
    const getSessionNetworkId = jest.fn((slug) => (
      slug === 'alpha' ? 84532 : (slug === 'beta' ? 11155420 : 0)
    ));

    const result = await readSbtSelectorScopedCacheContexts({
      targetSlugs: [' alpha ', 'missing', 'beta'],
      getSessionNetworkId,
      readSbtCacheBySlug,
    });

    expect(result.contexts.map((context) => context.slug)).toEqual(['alpha', 'beta']);
    expect(result.contexts[0]).toMatchObject({
      chainId: 84532,
      netKey: '84532',
      slug: 'alpha',
      nameLookupState: existingLookupState,
    });
    expect(result.contexts[0].sbtList).toEqual(existingList);
    expect(result.contexts[0].sbtList).not.toBe(existingList);
    expect(result.contexts[0].cache['84532'].sbtList).toBe(result.contexts[0].sbtList);
    expect(result.contextBySlug.get('beta')?.chainId).toBe(11155420);
    expect(readSbtCacheBySlug).toHaveBeenCalledWith('alpha');
    expect(readSbtCacheBySlug).toHaveBeenCalledWith('beta');
  });

  it('applies hydrated SBT metadata to scoped contexts and aggregate cache', () => {
    const context = {
      cache: {},
      chainId: 84532,
      nameLookupState: {
        '0xaaa': { attempts: 1 },
        '0xbbb': { attempts: 1 },
      },
      netKey: '84532',
      sbtList: {
        '0xaaa': { sbtAddress: '0xAAA', slug: 'alpha', sbtInfo: {} },
      },
      slug: 'alpha',
    };
    const aggregate: Record<string, unknown> = {};

    const touchedContexts = applySbtSelectorHydrationResults({
      now: 1710000000000,
      resolvedAggregatedSbtList: aggregate,
      results: [
        {
          address: '0xAAA',
          lower: '0xaaa',
          slug: 'alpha',
          context,
          sbtInfo: { name: 'Alpha Badge', image: 'ar://alpha' },
        },
        {
          address: '0xBBB',
          lower: '0xbbb',
          slug: 'alpha',
          context,
          sbtInfo: null,
        },
      ],
    });

    expect(touchedContexts.has(context as never)).toBe(true);
    expect(context.sbtList['0xaaa']).toMatchObject({
      chainId: 84532,
      sbtAddress: '0xAAA',
      sbtInfo: { name: 'Alpha Badge', image: 'ar://alpha' },
      slug: 'alpha',
    });
    expect(context.nameLookupState['0xaaa']).toBeUndefined();
    expect(context.nameLookupState['0xbbb']).toMatchObject({
      attempts: 2,
      lastFailureAt: 1710000000000,
    });
    expect(aggregate['84532:0xaaa']).toMatchObject({
      sbtAddress: '0xAAA',
      sbtInfo: { name: 'Alpha Badge', image: 'ar://alpha' },
    });
    expect(aggregate['84532:0xbbb']).toMatchObject({
      sbtAddress: '0xBBB',
      sbtInfo: null,
    });
  });

  it('builds scoped ignored SBT address sets from session lists', () => {
    const listsBySlug: Record<string, unknown> = {
      Alpha: {
        ignored_SBTs_LIST: [
          ' 0x000000000000000000000000000000000000000A ',
          '',
          '0x000000000000000000000000000000000000000A',
        ],
      },
      '': {
        ignored_SBTs_LIST: ['0x000000000000000000000000000000000000000B'],
      },
    };
    const getSessionLists = jest.fn((slug: string) => listsBySlug[slug] || {});

    expect(Array.from(buildIgnoredSbtSelectorAddressSet({
      effectiveSlug: ' Alpha ',
      getSessionLists,
      scopeMode: '',
    }))).toEqual([
      'Alpha|0x000000000000000000000000000000000000000a',
    ]);
    expect(Array.from(buildIgnoredSbtSelectorAddressSet({
      effectiveSlug: 'Alpha',
      getSessionLists,
      scopeMode: 'general',
    }))).toEqual([
      '|0x000000000000000000000000000000000000000b',
    ]);
    expect(Array.from(buildIgnoredSbtSelectorAddressSet({
      getSessionLists,
      scopeMode: 'general',
      targetSlugs: ['Alpha', 'Beta'],
    }))).toEqual([
      'Alpha|0x000000000000000000000000000000000000000b',
      'Beta|0x000000000000000000000000000000000000000b',
    ]);
  });

  it('builds scoped featured SBT entries with default entries first', () => {
    const listsBySlug: Record<string, unknown> = {
      Alpha: {
        featured_SBTs_LIST: ['0x000000000000000000000000000000000000000D'],
      },
      Beta: {
        featured_SBTs_LIST: ['0x000000000000000000000000000000000000000E'],
      },
    };
    const getSessionLists = jest.fn((slug: string) => listsBySlug[slug] || {});
    const readFeatured = jest.fn((config: unknown) => (
      Array.isArray((config as Record<string, unknown>)?.featured)
        ? (config as Record<string, unknown>).featured
        : []
    ));

    expect(buildScopeFeaturedSbtSelectorEntries({
      defaultFeaturedSBTs: [
        ' 0x000000000000000000000000000000000000000A ',
      ],
      effectiveSlug: ' Alpha ',
      getCanonicalSessionFeaturedSBTs: readFeatured,
      getDisplayLookupSessionConfig: (slug: string) => (
        slug === 'Beta'
          ? {
            featured: [
              '0x000000000000000000000000000000000000000C',
              '0x000000000000000000000000000000000000000B',
            ],
          }
          : {}
      ),
      getSessionLists,
      sessionConfig: {
        featured: [
          '0x000000000000000000000000000000000000000B',
          '0x000000000000000000000000000000000000000A',
        ],
      },
      shouldUsePropsSessionConfigForSlug: (slug: string) => slug === 'Alpha',
      targetSlugs: ['Alpha', 'Beta'],
    })).toEqual([
      { address: '0x000000000000000000000000000000000000000A', slug: 'Alpha' },
      { address: '0x000000000000000000000000000000000000000B', slug: 'Alpha' },
      { address: '0x000000000000000000000000000000000000000D', slug: 'Alpha' },
      { address: '0x000000000000000000000000000000000000000C', slug: 'Beta' },
      { address: '0x000000000000000000000000000000000000000E', slug: 'Beta' },
    ]);
  });

  it('builds auto-search session options while hiding active targets', () => {
    const groupOptions = [
      { label: 'Alpha', value: 'Alpha' },
      { label: 'General', value: 'General' },
      { label: 'Beta', value: 'Beta' },
      { label: 'Gamma', value: 'Gamma' },
    ];

    expect(buildSbtSelectorAutoSearchSessionOptions({
      autoSearchOtherSessions: true,
      directlyInvokedTargetSlugs: ['Alpha', 'General'],
      enableGroupSelect: true,
      groupOptions,
      groupOverride: true,
      sourceSessionSlug: 'Beta',
    })).toEqual([
      { label: 'Gamma', value: 'Gamma' },
    ]);
    expect(buildSbtSelectorAutoSearchSessionOptions({
      autoSearchOtherSessions: false,
      enableGroupSelect: true,
      groupOptions,
    })).toEqual([]);
    expect(buildSbtSelectorAutoSearchSessionOptions({
      autoSearchOtherSessions: true,
      enableGroupSelect: false,
      groupOptions,
    })).toEqual([]);
  });

  it('resolves explicit and declared SBT session bindings', () => {
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha' })).toBe(true);
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha', sessionSlugExplicit: true })).toBe(true);
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha', sessionSlugExplicit: false })).toBe(false);
    expect(hasAuthoritativeSessionSlug({ slug: 'Alpha' })).toBe(false);

    expect(resolveAuthoritativeSbtSessionBindingSlug({
      sbtInfo: { sessionSlug: 'Alpha', sessionSlugExplicit: true },
    })).toBe('Alpha');
    expect(resolveAuthoritativeSbtSessionBindingSlug({
      sessionSlug: 'Beta',
    })).toBe('Beta');
    expect(resolveAuthoritativeSbtSessionBindingSlug({
      sbtInfo: { slug: 'Legacy' },
    })).toBe('Legacy');
    expect(resolveAuthoritativeSbtSessionBindingSlug({
      sessionSlug: 'Inferred',
      sessionSlugExplicit: false,
    })).toBeNull();

    expect(resolveDeclaredSbtSessionSlug({
      sbtInfo: { sessionSlug: 'Declared' },
      sessionSlug: 'Fallback',
    })).toBe('Declared');
    expect(resolveDeclaredSbtSessionSlug({ sessionSlug: 'Fallback' })).toBe('Fallback');
    expect(resolveDeclaredSbtSessionSlug({})).toBeNull();
    const listScopeTargetSlugSet = new Set(['alpha']);
    expect(shouldIncludeSbtSelectorEntryForListScope({
      declaredSessionSlug: 'alpha',
      hasVisibleMetadata: true,
      listScopeTargetSlugSet,
      scopedBucketSlug: 'beta',
    })).toBe(true);
    expect(shouldIncludeSbtSelectorEntryForListScope({
      declaredSessionSlug: 'beta',
      listScopeTargetSlugSet,
      scopedBucketSlug: 'alpha',
    })).toBe(false);
    expect(shouldIncludeSbtSelectorEntryForListScope({
      declaredSessionSlug: null,
      hasVisibleMetadata: false,
      listScopeTargetSlugSet,
      scopedBucketSlug: 'alpha',
    })).toBe(true);
    expect(shouldIncludeSbtSelectorEntryForListScope({
      declaredSessionSlug: null,
      hasVisibleMetadata: true,
      listScopeTargetSlugSet,
      scopedBucketSlug: 'alpha',
    })).toBe(false);
    expect(shouldSkipSbtSelectorEntryForOptions({
      address: '0xabc',
      ignoredAddressSet: new Set(['alpha|0xabc']),
      resolvedSlug: 'alpha',
    })).toBe(true);
    expect(shouldSkipSbtSelectorEntryForOptions({
      address: '0xabc',
      isManual: false,
      sbtInfo: { unlisted: true },
    })).toBe(true);
    expect(shouldSkipSbtSelectorEntryForOptions({
      address: '0xabc',
      isManual: true,
      sbtInfo: { unlisted: true },
    })).toBe(false);
    expect(shouldSkipSbtSelectorEntryForOptions({
      address: '0xabc',
      sbtOptionsMap: new Map([['0xabc:1', {}]]),
      selectionKey: '0xabc:1',
    })).toBe(true);
    expect(resolveSbtSelectorOptionEntryContext({
      fallbackSlug: 'fallback',
      sbt: {
        chainId: '11155420',
        manual: true,
        sbtAddress: '0xABC',
        sbtInfo: { name: 'Visible Badge' },
        sessionBindingSlug: 'Binding',
        slug: 'alpha',
      },
    })).toEqual({
      address: '0xabc',
      chainId: 11155420,
      isManual: true,
      resolvedSlug: 'Binding',
      sbtInfo: { name: 'Visible Badge' },
      selectionKey: '11155420:0xabc',
    });
    expect(resolveSbtSelectorOptionEntryContext({
      fallbackSlug: 'fallback',
      sbt: {
        sbtAddress: '',
      },
    })).toBeNull();
    expect(buildSbtSelectorNameHydrationEntries({
      fallbackSlug: 'fallback',
      sbtList: {
        '0x1111111111111111111111111111111111111111': {
          sbtAddress: '0x1111111111111111111111111111111111111111',
          sessionBindingSlug: 'Binding',
          slug: 'alpha',
        },
        '0x2222222222222222222222222222222222222222': {
          sbtAddress: '0x2222222222222222222222222222222222222222',
          sbtInfo: { name: 'Already Named' },
          slug: 'beta',
        },
        invalid: {
          sbtAddress: 'not-an-address',
        },
      },
    })).toEqual([{
      address: '0x1111111111111111111111111111111111111111',
      slug: 'Binding',
    }]);
    expect(buildSbtSelectorOptionFromEntry({
      address: '0xabc',
      chainId: 11155420,
      resolvedName: 'Visible Badge',
      resolvedSlug: 'alpha',
      sbt: {
        sessionBindingSlug: 'Binding',
        sessionName: 'Entry Session',
      },
      sbtInfo: {
        image: 'ar://image',
        sessionName: 'Metadata Session',
      },
      selectionKey: '0xabc:11155420',
    })).toEqual({
      address: '0xabc',
      chainId: 11155420,
      image: 'ar://image',
      maskedTitleHidden: false,
      name: 'Visible Badge',
      selectionKey: '0xabc:11155420',
      sessionBindingSlug: 'Binding',
      sessionName: 'Metadata Session',
      sessionSlug: 'alpha',
    });
    expect(buildSbtSelectorOptionFromEntry({
      address: '0xdef',
      chainId: 0,
      resolvedName: '[encrypted]',
      resolvedSlug: 'beta',
      sbt: {
        sessionName: 'Entry Session',
      },
      sbtInfo: {
        nameLocked: true,
      },
    })).toEqual({
      address: '0xdef',
      chainId: null,
      image: null,
      maskedTitleHidden: true,
      name: '[encrypted]',
      selectionKey: '0xdef',
      sessionName: 'Entry Session',
      sessionSlug: 'beta',
    });

    const onMissingAddress = jest.fn();
    const resolveSbtLabel = jest.fn((sbtInfo, address, slug) => (
      `${String(sbtInfo?.name || address)}@${slug}`
    ));
    const options = buildSbtSelectorOptions({
      fallbackSlug: 'alpha',
      featuredEntries: [{ address: '0xbbbb', slug: 'alpha' }],
      ignoredSet: new Set([buildScopedSbtIgnoreKey({ slug: 'alpha', address: '0xcccc' })]),
      onMissingAddress,
      resolveSbtLabel,
      sbtList: {
        alpha: {
          sbtAddress: '0xAAAA',
          sbtInfo: { name: 'Alpha Badge', sessionSlug: 'alpha' },
          slug: 'alpha',
        },
        betaFeatured: {
          sbtAddress: '0xBBBB',
          sbtInfo: {},
          slug: 'alpha',
        },
        ignored: {
          sbtAddress: '0xCCCC',
          sbtInfo: { name: 'Ignored Badge' },
          slug: 'alpha',
        },
        duplicate: {
          sbtAddress: '0xAAAA',
          sbtInfo: { name: 'Duplicate Badge' },
          slug: 'alpha',
        },
        scopedOut: {
          sbtAddress: '0xDDDD',
          sbtInfo: { name: 'Scoped Out', sessionSlug: 'beta' },
          slug: 'beta',
        },
        missingAddress: {
          sbtInfo: { name: 'Missing Address' },
        },
      },
      scopeMode: 'list',
      targetSlugs: ['alpha'],
    });

    expect(options.map((option) => option.address)).toEqual(['0xbbbb', '0xaaaa']);
    expect(options.map((option) => option.name)).toEqual(['0xbbbb@alpha', 'Alpha Badge@alpha']);
    expect(onMissingAddress).toHaveBeenCalledWith({ sbtInfo: { name: 'Missing Address' } });

    expect(resolveConcreteSbtSessionBindingSlug({
      sessionSlug: 'Concrete',
      sessionSlugExplicit: true,
    })).toBe('Concrete');
    expect(resolveConcreteSbtSessionBindingSlug({
      sessionSlug: 'Inferred',
      sessionSlugExplicit: false,
    })).toBeNull();
  });

  it('builds stable selector request signatures', () => {
    const sessionConfigSig = buildSessionConfigSig({
      slug: 'alpha',
      contracts: { sbtFactory: { address: ' 0xF00 ', chainId: '84532' } },
      blockLimits: { start: '10', end: '20' },
    });
    expect(sessionConfigSig).toBe('alpha|0xf00|84532|10|20');
    expect(buildFeaturedEntrySignature([
      { slug: 'alpha', address: ' 0xB ' },
      { slug: 'General', address: '' },
      null,
    ])).toBe('alpha:0xb');
    expect(buildSbtOptionsRequestSignature({
      slug: 'alpha',
      cacheRevision: 3,
      sessionConfigSig,
      targetSlugChainSig: 'alpha:84532',
      featuredEntries: [{ slug: 'alpha', address: '0xB' }],
      ignoredFromConfig: ['0xC', '0xc'],
    })).toBe('alpha|3|alpha|0xf00|84532|10|20|alpha:84532|alpha:0xb|0xc');
  });

  it('resolves load-options request decisions', () => {
    expect(resolveSbtSelectorLoadOptionsRequestDecision({
      forceReload: false,
      inflightRequest: null,
      lastRequestSig: 'same',
      requestSig: 'same',
    })).toEqual({
      shouldQueueRerun: false,
      shouldReturnInflight: false,
      shouldSkipUnchanged: true,
    });

    const inflight = Promise.resolve();
    expect(resolveSbtSelectorLoadOptionsRequestDecision({
      forceReload: false,
      inflightRequest: inflight,
      inflightSig: 'same',
      requestSig: 'same',
    })).toEqual({
      shouldQueueRerun: false,
      shouldReturnInflight: true,
      shouldSkipUnchanged: false,
    });
    expect(resolveSbtSelectorLoadOptionsRequestDecision({
      forceReload: false,
      inflightRequest: inflight,
      inflightSig: 'old',
      requestSig: 'new',
    })).toEqual({
      shouldQueueRerun: true,
      shouldReturnInflight: true,
      shouldSkipUnchanged: false,
    });
    expect(resolveSbtSelectorLoadOptionsRequestDecision({
      forceReload: true,
      inflightRequest: inflight,
      inflightSig: 'same',
      requestSig: 'same',
    }).shouldQueueRerun).toBe(true);
  });

  it('resolves SBT entry chain IDs with fallbacks', () => {
    expect(resolveSbtEntryChainId({ chainId: '10' }, 84532)).toBe(10);
    expect(resolveSbtEntryChainId({ sbtInfo: { chainID: '84532' } })).toBe(84532);
    expect(resolveSbtEntryChainId({}, '11155420')).toBe(11155420);
    expect(resolveSbtEntryChainId({})).toBeNull();
  });

  it('decorates scoped SBT entries with source, binding, and chain context', () => {
    expect(decorateScopedSbtEntry({
      slug: 'Alpha',
      sbtInfo: {
        chainID: '84532',
        sessionSlug: 'Concrete',
        sessionSlugExplicit: true,
      },
    }, 'Fallback')).toMatchObject({
      chainId: 84532,
      slug: 'Alpha',
      __sourceSessionSlug: 'Alpha',
      sessionBindingSlug: 'Concrete',
    });
    expect(decorateScopedSbtEntry({ __sourceSessionSlug: 'General' }, 'Fallback')).toMatchObject({
      slug: 'Fallback',
      __sourceSessionSlug: '',
    });
  });

  it('merges scoped SBT entries while preserving slug and display-name precedence', () => {
    const merged = mergeScopedSbtEntry(
      {
        slug: 'Alpha',
        sessionBindingSlug: 'Alpha',
        sbtInfo: {},
      },
      {
        slug: 'Beta',
        sessionBindingSlug: 'Beta',
        sbtInfo: {
          chainID: '11155420',
          image: 'ar://image',
          name: 'Named Badge',
        },
      },
      'Fallback'
    );

    expect(merged).toMatchObject({
      chainId: 11155420,
      slug: 'Alpha',
      __sourceSessionSlug: 'Beta',
      sessionBindingSlug: 'Alpha',
      sbtInfo: {
        image: 'ar://image',
        name: 'Named Badge',
      },
    });
    expect(mergeScopedSbtEntry(
      {
        slug: 'Alpha',
        sbtInfo: { name: 'Existing Badge' },
      },
      {
        slug: 'Beta',
        sbtInfo: { name: 'Incoming Badge' },
      },
      'Fallback'
    )?.sbtInfo).toEqual({ name: 'Existing Badge' });
    expect(mergeScopedSbtEntry(
      { slug: 'Alpha', sbtInfo: {} },
      { slug: 'Beta', sbtInfo: { nameLocked: true } },
      'Fallback'
    )?.sbtInfo).toEqual({ nameLocked: true });
  });

  it('merges linked scoped SBT entries into the active selector list', () => {
    const baseList = {
      '0x1111111111111111111111111111111111111111': {
        slug: 'Alpha',
        sbtInfo: { name: 'Existing Badge' },
      },
    };
    const result = mergeSbtSelectorLinkedScopedEntries({
      fallbackSlug: 'Fallback',
      sbtList: baseList,
      linkedScopedSbtList: {
        '0x1111111111111111111111111111111111111111': {
          slug: 'Beta',
          sbtInfo: { name: 'Incoming Badge' },
        },
        '0x2222222222222222222222222222222222222222': {
          sbtAddress: '0x2222222222222222222222222222222222222222',
          sbtInfo: { image: 'ar://image' },
        },
      },
    });

    expect(result.linkedScopedCount).toBe(2);
    expect(result.mergedOptionCount).toBe(2);
    expect(result.sbtList).toBe(baseList);
    expect(result.sbtList['0x1111111111111111111111111111111111111111']?.sbtInfo).toEqual({
      name: 'Existing Badge',
    });
    expect(result.sbtList['0x2222222222222222222222222222222222222222']).toMatchObject({
      slug: 'Fallback',
      sbtInfo: { image: 'ar://image' },
    });
  });

  it('identifies when incoming scoped SBT entries should replace existing metadata', () => {
    expect(shouldPreferIncomingScopedSbtEntry(
      { sbtInfo: {} },
      { sbtInfo: { name: 'Named Badge' } }
    )).toBe(true);
    expect(shouldPreferIncomingScopedSbtEntry(
      { sbtInfo: { name: 'Existing Badge' } },
      { sbtInfo: { name: 'Incoming Badge' } }
    )).toBe(false);
    expect(shouldPreferIncomingScopedSbtEntry(
      { sbtInfo: { name: 'Existing Badge' } },
      { sbtInfo: { image: 'ar://image' } }
    )).toBe(true);
    expect(shouldPreferIncomingScopedSbtEntry(
      { sbtInfo: { image: 'ar://existing' } },
      { sbtInfo: { image: 'ar://incoming' } }
    )).toBe(false);
  });

  it('applies discovered SBT addresses to scoped cache lists', () => {
    const existingAddress = '0x00000000000000000000000000000000000000aa';
    const existingAddressMixed = '0x00000000000000000000000000000000000000AA';
    const discoveredAddress = '0x00000000000000000000000000000000000000bb';
    const discoveredAddressMixed = '0x00000000000000000000000000000000000000BB';
    const sbtList = {
      [existingAddress]: {
        sbtAddress: existingAddressMixed,
        sbtInfo: { name: 'Existing Badge' },
        slug: 'Alpha',
      },
    };

    const unchanged = applySbtSelectorDiscoveredAddressesToList({
      addresses: [existingAddressMixed, 'not-an-address'],
      resolvedSlug: 'Alpha',
      sbtList,
    });
    expect(unchanged.mutated).toBe(false);
    expect(unchanged.sbtList[existingAddress]).toEqual(sbtList[existingAddress]);

    const updated = applySbtSelectorDiscoveredAddressesToList({
      addresses: [discoveredAddressMixed, discoveredAddress, 'bad'],
      resolvedSlug: 'Alpha',
      sbtList,
    });
    expect(updated.mutated).toBe(true);
    expect(updated.sbtList[discoveredAddress]).toMatchObject({
      sbtAddress: discoveredAddressMixed,
      sbtInfo: null,
      slug: 'Alpha',
      __sourceSessionSlug: 'Alpha',
    });
  });

  it('applies address hydration results to scoped cache lists and retry state', () => {
    const namedAddress = '0x00000000000000000000000000000000000000aa';
    const unnamedAddress = '0x00000000000000000000000000000000000000bb';
    const nameLookupState = {
      [namedAddress]: {
        attempts: 2,
        lastFailureAt: 100,
        nextRetryAt: 200,
      },
    };
    const sbtList = {
      [namedAddress]: {
        sbtAddress: namedAddress,
        sbtInfo: { image: 'ar://old' },
        slug: 'Alpha',
      },
      [unnamedAddress]: {
        sbtAddress: unnamedAddress,
        sbtInfo: null,
        slug: 'Alpha',
      },
    };

    const result = applySbtSelectorAddressHydrationResultsToList({
      nameLookupState,
      now: 1000,
      resolvedSlug: 'Alpha',
      results: [
        { address: namedAddress, sbtInfo: { name: 'Named Badge' } },
        { address: unnamedAddress, sbtInfo: null },
      ],
      sbtList,
    });
    expect(result.sbtList[namedAddress]).toMatchObject({
      sbtAddress: namedAddress,
      sbtInfo: { name: 'Named Badge' },
      slug: 'Alpha',
      __sourceSessionSlug: 'Alpha',
    });
    expect(result.nameLookupState[namedAddress]).toBeUndefined();
    expect(result.sbtList[unnamedAddress]).toMatchObject({
      sbtAddress: unnamedAddress,
      sbtInfo: null,
      slug: 'Alpha',
    });
    expect(result.nameLookupState[unnamedAddress]).toMatchObject({
      attempts: 1,
      lastFailureAt: 1000,
    });
  });

  it('merges latest SBT cache state into progressive discovery state', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const latestCache = {
      84532: {
        nameLookupState: {
          [address]: { attempts: 1, lastFailureAt: 100 },
          stale: { attempts: 3 },
        },
        sbtList: {
          [address]: {
            sbtAddress: address,
            sbtInfo: {
              image: 'ar://fresh',
              name: 'Fresh Badge',
            },
            slug: 'Beta',
          },
        },
      },
    };
    const currentLookup = {
      [address]: { attempts: 2, lastFailureAt: 200 },
    };
    const currentList = {
      [address]: {
        sbtAddress: address,
        sbtInfo: {},
        slug: 'Alpha',
      },
    };

    const result = mergeSbtSelectorLatestCacheState({
      latestCache,
      nameLookupState: currentLookup,
      netKey: '84532',
      resolvedSlug: 'Alpha',
      sbtList: currentList,
    });
    expect(result.sbtList[address]).toMatchObject({
      sbtAddress: address,
      slug: 'Alpha',
      __sourceSessionSlug: 'Beta',
      sbtInfo: {
        image: 'ar://fresh',
        name: 'Fresh Badge',
      },
    });
    expect(result.nameLookupState).toMatchObject({
      [address]: { attempts: 2, lastFailureAt: 200 },
      stale: { attempts: 3 },
    });
    expect(result.cache['84532'].sbtList).toBe(result.sbtList);
    expect(result.cache['84532'].nameLookupState).toBe(result.nameLookupState);
  });

  it('builds name lookup fetch lists while respecting cached names and retry state', () => {
    const namedAddress = '0x00000000000000000000000000000000000000aa';
    const retryAddress = '0x00000000000000000000000000000000000000bb';
    const delayedAddress = '0x00000000000000000000000000000000000000cc';
    const nameLookupState = {
      [namedAddress]: { attempts: 1, lastFailureAt: 100 },
      [delayedAddress]: { attempts: 1, lastFailureAt: 900, nextRetryAt: 2000 },
    };
    const result = buildSbtSelectorNameLookupFetchList({
      addresses: [namedAddress, retryAddress, retryAddress, '', delayedAddress],
      nameLookupState,
      now: 1000,
      sbtList: {
        [namedAddress]: {
          sbtInfo: { name: 'Named Badge' },
        },
        [retryAddress]: {
          sbtInfo: null,
        },
        [delayedAddress]: {
          sbtInfo: null,
        },
      },
    });

    expect(result.addresses).toEqual([retryAddress]);
    expect(result.nameLookupState[namedAddress]).toBeUndefined();
    expect(result.nameLookupState[delayedAddress]).toEqual({
      attempts: 1,
      lastFailureAt: 900,
      nextRetryAt: 2000,
    });
  });

  it('resolves targeted selected SBT hydration retry decisions', () => {
    const first = '0x00000000000000000000000000000000000000aa';
    const second = '0x00000000000000000000000000000000000000bb';

    expect(buildSelectedSbtHydrationSignature({
      addresses: [first, second],
      networkID: '84532',
      slug: 'Alpha',
    })).toBe(`Alpha|84532|${first},${second}`);
    expect(buildSelectedSbtHydrationSignature({
      addresses: 'bad',
      networkID: 'bad',
      slug: null,
    })).toBe('|NaN|');

    expect(resolveSbtSelectorTargetedHydrationDecision({
      addresses: [first],
      hits: null,
      targetedLookupEnabled: false,
    })).toEqual({
      hasHits: false,
      hasUnresolvedAddresses: true,
      shouldClearRetry: true,
      shouldReloadOptions: false,
      shouldRetry: false,
    });

    expect(resolveSbtSelectorTargetedHydrationDecision({
      addresses: [first],
      hits: [],
      targetedLookupEnabled: true,
    })).toEqual({
      hasHits: false,
      hasUnresolvedAddresses: true,
      shouldClearRetry: false,
      shouldReloadOptions: false,
      shouldRetry: true,
    });

    expect(resolveSbtSelectorTargetedHydrationDecision({
      addresses: [first, second],
      hits: [{ address: first.toUpperCase() }],
      targetedLookupEnabled: true,
    })).toEqual({
      hasHits: true,
      hasUnresolvedAddresses: true,
      shouldClearRetry: false,
      shouldReloadOptions: true,
      shouldRetry: true,
    });

    expect(resolveSbtSelectorTargetedHydrationDecision({
      addresses: [first],
      hits: [{ address: first.toUpperCase() }],
      targetedLookupEnabled: true,
    })).toEqual({
      hasHits: true,
      hasUnresolvedAddresses: false,
      shouldClearRetry: true,
      shouldReloadOptions: true,
      shouldRetry: false,
    });

    const sharedLightUniverse = () => null;
    const selectedSBTs = [{ address: first }];
    expect(resolveSbtSelectorUpdateSignals({
      prevNetwork: { chainId: '10' },
      nextNetwork: { chainId: 11155420 },
      prevChainId: '10',
      nextChainId: 11155420,
      prevSessionConfig: { sessionSlug: 'alpha', networkChainId: 10 },
      nextSessionConfig: { sessionSlug: 'alpha', networkChainId: 11155420 },
      prevSbtCacheRevision: 1,
      nextSbtCacheRevision: 2,
      prevPropSessionSlug: 'alpha',
      nextPropSessionSlug: 'beta',
      prevSourceSessionSlug: 'alpha',
      nextSourceSessionSlug: 'beta',
      prevSelectedSBTs: selectedSBTs,
      nextSelectedSBTs: [{ address: first }],
      prevDiscoveryOverrideSignature: 'alpha',
      nextDiscoveryOverrideSignature: 'beta',
      prevEnsureLightSbtUniverse: null,
      nextEnsureLightSbtUniverse: sharedLightUniverse,
    })).toEqual({
      cacheChanged: true,
      chainIdChanged: true,
      discoveryOverrideChanged: true,
      networkChanged: true,
      selectedSbtPropsChanged: true,
      sessionConfigChanged: true,
      sharedLightUniverseFnChanged: true,
      slugPropChanged: true,
      sourceGroupChanged: true,
      universeScopeChanged: true,
    });
    expect(resolveSbtSelectorUpdateSignals({
      prevNetwork: { chainId: '10' },
      nextNetwork: { id: 10 },
      prevChainId: '10',
      nextChainId: 10,
      prevSessionConfig: { sessionSlug: 'alpha', networkChainId: 10 },
      nextSessionConfig: { sessionSlug: 'alpha', networkChainId: 10 },
      prevSbtCacheRevision: 2,
      nextSbtCacheRevision: 2,
      prevPropSessionSlug: 'alpha',
      nextPropSessionSlug: 'alpha',
      prevSourceSessionSlug: 'alpha',
      nextSourceSessionSlug: 'alpha',
      prevSelectedSBTs: selectedSBTs,
      nextSelectedSBTs: selectedSBTs,
      prevDiscoveryOverrideSignature: 'alpha',
      nextDiscoveryOverrideSignature: 'alpha',
      prevEnsureLightSbtUniverse: sharedLightUniverse,
      nextEnsureLightSbtUniverse: sharedLightUniverse,
    }).universeScopeChanged).toBe(false);

    expect(resolveSbtSelectorUpdateEffects({
      cacheChanged: true,
    })).toEqual({
      shouldEnsureUniverse: false,
      shouldHydrateSelectedNames: true,
      shouldKickoffSharedLightUniverse: false,
      shouldLoadOptions: true,
      shouldWarmRegistryCache: false,
    });
    expect(resolveSbtSelectorUpdateEffects({
      hasSharedLightUniverse: true,
      selectedSbtPropsChanged: true,
      sessionConfigChanged: true,
      sharedLightUniverseFnChanged: true,
      shouldWarmRegistryCache: true,
    })).toEqual({
      shouldEnsureUniverse: true,
      shouldHydrateSelectedNames: true,
      shouldKickoffSharedLightUniverse: true,
      shouldLoadOptions: true,
      shouldWarmRegistryCache: true,
    });
    expect(resolveSbtSelectorUpdateEffects({
      hasSharedLightUniverse: false,
      sharedLightUniverseFnChanged: true,
    }).shouldKickoffSharedLightUniverse).toBe(false);
  });

  it('aggregates scoped SBT cache contexts by chain-scoped lookup key', () => {
    const aggregated = buildAggregatedSbtSelectorListFromContexts([
      null,
      {
        slug: 'Alpha',
        chainId: 84532,
        sbtList: {
          '0xA': {
            sbtInfo: {},
          },
        },
      },
      {
        slug: 'Beta',
        chainId: 84532,
        sbtList: {
          '0xa': {
            sbtInfo: {
              chainID: '84532',
              image: 'ar://image',
              name: 'Named Badge',
            },
          },
          '': {
            sbtInfo: { name: 'Missing address' },
          },
        },
      },
    ]);

    expect(Object.keys(aggregated)).toEqual(['84532:0xa']);
    expect(aggregated['84532:0xa']).toMatchObject({
      chainId: 84532,
      sbtAddress: '0xa',
      slug: 'Alpha',
      __sourceSessionSlug: 'Beta',
      sbtInfo: {
        image: 'ar://image',
        name: 'Named Badge',
      },
    });
    expect(buildAggregatedSbtSelectorListFromContexts('bad')).toEqual({});
  });

  it('links scoped SBT entries from known cache by source and binding scope', () => {
    const knownEntries = [
      null,
      {
        slug: 'Alpha',
        value: {
          84532: {
            sbtList: {
              '0xA': {
                sbtInfo: { name: 'Alpha Badge' },
              },
            },
          },
        },
      },
      {
        slug: 'Outside',
        value: {
          84532: {
            sbtList: {
              '0xB': {
                sessionBindingSlug: 'Beta',
                sbtInfo: { name: 'Bound Badge' },
              },
              '0xC': {
                sbtInfo: {
                  name: 'Concrete Badge',
                  sessionSlug: 'Beta',
                  sessionSlugExplicit: true,
                },
              },
              '': {
                sbtInfo: { name: 'Missing address' },
              },
            },
          },
        },
      },
    ];

    const linked = buildLinkedSbtSelectorListFromKnownCache({
      fallbackSlug: 'Fallback',
      knownEntries,
      targetSlugs: ['Alpha', 'Beta'],
    });
    expect(Object.keys(linked).sort()).toEqual(['84532:0xa', '84532:0xb', '84532:0xc']);
    expect(linked['84532:0xa']).toMatchObject({
      __sourceSessionSlug: 'Alpha',
      slug: 'Alpha',
    });
    expect(linked['84532:0xb']).toMatchObject({
      __sourceSessionSlug: 'Outside',
      sessionBindingSlug: 'Beta',
      slug: 'Beta',
    });

    const concreteOnly = buildLinkedSbtSelectorListFromKnownCache({
      fallbackSlug: 'Fallback',
      knownEntries,
      requireConcreteBinding: true,
      targetSlugs: ['Beta'],
    });
    expect(Object.keys(concreteOnly)).toEqual(['84532:0xc']);
    expect(concreteOnly['84532:0xc']).toMatchObject({
      sessionBindingSlug: 'Beta',
      slug: 'Beta',
    });
    expect(buildLinkedSbtSelectorListFromKnownCache({
      knownEntries,
      targetSlugs: [],
    })).toEqual({});
  });

  it('resolves linked scoped entries against source and binding scope', () => {
    expect(resolveLinkedSbtSelectorScopeEntry({
      scopedEntry: {
        __sourceSessionSlug: 'Outside',
        sessionBindingSlug: 'Beta',
        slug: 'Outside',
      },
      sourceSlug: 'Outside',
      targetSlugSet: new Set(['Beta']),
    })).toMatchObject({
      __sourceSessionSlug: 'Outside',
      sessionBindingSlug: 'Beta',
      slug: 'Beta',
    });
    expect(resolveLinkedSbtSelectorScopeEntry({
      requireConcreteBinding: true,
      scopedEntry: {
        __sourceSessionSlug: 'Outside',
        sbtInfo: {
          sessionSlug: 'Beta',
          sessionSlugExplicit: true,
        },
        slug: 'Outside',
      },
      sourceSlug: 'Outside',
      targetSlugSet: new Set(['Beta']),
    })).toMatchObject({
      sessionBindingSlug: 'Beta',
      slug: 'Beta',
    });
    expect(resolveLinkedSbtSelectorScopeEntry({
      requireConcreteBinding: true,
      scopedEntry: {
        __sourceSessionSlug: 'Alpha',
        slug: 'Alpha',
      },
      sourceSlug: 'Alpha',
      targetSlugSet: new Set(['Alpha']),
    })).toMatchObject({
      __sourceSessionSlug: 'Alpha',
      slug: 'Alpha',
    });
    expect(resolveLinkedSbtSelectorScopeEntry({
      scopedEntry: {
        __sourceSessionSlug: 'Outside',
        sessionBindingSlug: 'Other',
        slug: 'Outside',
      },
      sourceSlug: 'Outside',
      targetSlugSet: new Set(['Beta']),
    })).toBeNull();
  });

  it('compares option display fields and unresolved configs', () => {
    const baseOption = {
      address: '0xabc',
      name: 'Builder',
      image: 'ar://image',
      sessionSlug: 'alpha',
      sessionName: 'Alpha',
      chainId: 84532,
      selectionKey: '84532:0xabc',
      extraIgnored: 'left',
    };
    expect(areSbtOptionsEqual([baseOption], [{ ...baseOption, extraIgnored: 'right' }])).toBe(true);
    expect(areSbtOptionsEqual([baseOption], [{ ...baseOption, name: 'Other' }])).toBe(false);
    expect(areSbtOptionsEqual([baseOption], [])).toBe(false);
    expect(areSbtOptionsEqual(null, undefined)).toBe(true);
    expect(isUnresolvedSessionConfig({ __unresolved: true })).toBe(true);
    expect(isUnresolvedSessionConfig({ __unresolved: false })).toBe(false);
    expect(isUnresolvedSessionConfig(null)).toBe(false);
  });

  it('identifies masked hidden titles only when the name is still locked', () => {
    expect(isMaskedSbtOptionLabel(' [ENCRYPTED] ')).toBe(true);
    expect(isMaskedSbtOptionLabel('Visible title')).toBe(false);
    expect(isMaskedHiddenTitle({ label: '[encrypted]', sbtInfo: null })).toBe(true);
    expect(isMaskedHiddenTitle({
      label: '[encrypted]',
      sbtInfo: { nameLocked: true },
    })).toBe(true);
    expect(isMaskedHiddenTitle({
      label: '[encrypted]',
      sbtInfo: { name: 'Visible name', nameLocked: true },
    })).toBe(false);
    expect(isMaskedHiddenTitle({
      label: '[encrypted]',
      sbtInfo: { nameLocked: true, nameDecrypted: true },
    })).toBe(false);
    expect(isMaskedHiddenTitle({
      label: 'Visible title',
      sbtInfo: { nameLocked: true },
    })).toBe(false);
  });

  it('sorts SBT selector options by masked state, featured rank, label, address, and chain', () => {
    const featuredOrder = buildSbtSelectorFeaturedOrder([
      { address: '0xB' },
      { address: '0xb' },
      { address: '0xA' },
      { address: '' },
    ]);
    expect(Array.from(featuredOrder.entries())).toEqual([
      ['0xb', 0],
      ['0xa', 2],
    ]);

    const options = [
      { address: '0xc', name: 'Alpha', chainId: 10, maskedTitleHidden: true },
      { address: '0xd', name: 'Alpha', chainId: 1, maskedTitleHidden: false },
      { address: '0xb', name: 'Zulu', chainId: 1, maskedTitleHidden: false },
      { address: '0xa', name: 'Beta', chainId: 1, maskedTitleHidden: false },
      { address: '0xe', name: 'Alpha', chainId: 2, maskedTitleHidden: false },
    ];

    expect(options.sort((left, right) => compareSbtSelectorOptions(left, right, featuredOrder)))
      .toEqual([
        { address: '0xb', name: 'Zulu', chainId: 1, maskedTitleHidden: false },
        { address: '0xa', name: 'Beta', chainId: 1, maskedTitleHidden: false },
        { address: '0xd', name: 'Alpha', chainId: 1, maskedTitleHidden: false },
        { address: '0xe', name: 'Alpha', chainId: 2, maskedTitleHidden: false },
        { address: '0xc', name: 'Alpha', chainId: 10, maskedTitleHidden: true },
      ]);
    expect(compareSbtSelectorOptions(
      { address: '0xf', name: 'Same', chainId: 2 },
      { address: '0xf', name: 'Same', chainId: 1 },
      featuredOrder
    )).toBe(1);
  });

  it('normalizes and compares scope-featured address lists in order', () => {
    const addresses = buildSbtSelectorScopeFeaturedAddresses([
      { address: ' 0xA ' },
      { address: '' },
      null,
      { address: '0xB' },
    ]);
    expect(addresses).toEqual(['0xa', '0xb']);
    expect(areSbtSelectorAddressListsEqual(addresses, ['0xa', '0xb'])).toBe(true);
    expect(areSbtSelectorAddressListsEqual(addresses, ['0xb', '0xa'])).toBe(false);
    expect(areSbtSelectorAddressListsEqual(null, undefined)).toBe(true);
  });

  it('builds SBT selector option state patches only for changed fields', () => {
    const currentOption = {
      address: '0xa',
      chainId: 84532,
      image: null,
      name: 'Alpha',
      selectionKey: '84532:0xa',
      sessionName: 'Alpha Session',
      sessionSlug: 'alpha',
    };
    const nextOption = { ...currentOption, name: 'Beta' };

    expect(buildSbtSelectorOptionsStatePatch({
      currentLoadingOptions: true,
      currentSbtOptions: [currentOption],
      currentScopeFeaturedAddresses: ['0xa'],
      featuredEntries: [{ address: '0xA' }],
      loadingOptions: true,
      sbtOptions: [{ ...currentOption, extraIgnored: 'same' }],
    })).toEqual({});
    expect(buildSbtSelectorOptionsStatePatch({
      currentLoadingOptions: true,
      currentSbtOptions: [currentOption],
      currentScopeFeaturedAddresses: ['0xa'],
      featuredEntries: [{ address: '0xB' }],
      loadingOptions: false,
      sbtOptions: [nextOption],
    })).toEqual({
      loadingOptions: false,
      sbtOptions: [nextOption],
      scopeFeaturedAddresses: ['0xb'],
    });
  });

  it('resolves SBT detail link session slug precedence', () => {
    expect(resolveSbtDetailLinkSessionSlug({
      sbt: {
        sessionBindingSlug: 'Binding',
        sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
        sessionSlug: 'Selected',
      },
      fallbackSlug: 'Fallback',
    })).toBe('Binding');
    expect(resolveSbtDetailLinkSessionSlug({
      sbt: {
        sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
        sessionSlug: 'Selected',
      },
      fallbackSlug: 'Fallback',
    })).toBe('Info');
    expect(resolveSbtDetailLinkSessionSlug({
      sbt: { sessionSlug: 'Selected', sessionSlugExplicit: true },
      fallbackSlug: 'Fallback',
    })).toBe('Selected');
    expect(resolveSbtDetailLinkSessionSlug({
      sbt: { sessionSlug: 'Selected', sessionSlugExplicit: false },
      fallbackSlug: 'Fallback',
    })).toBe('Selected');
    expect(resolveSbtDetailLinkSessionSlug({
      sbt: {},
      fallbackSlug: 'Fallback',
    })).toBe('Fallback');
  });
});
