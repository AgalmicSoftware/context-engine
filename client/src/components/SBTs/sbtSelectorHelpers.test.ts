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
  compareSbtSelectorOptions,
  decorateScopedSbtEntry,
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
  isSbtSelectorOptionsLoading,
  isUnresolvedSessionConfig,
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
  resolveSbtSelectorTargetedHydrationDecision,
  resolveSbtSelectorTargetSlugs,
  resolveSbtSelectorVariantDisplayState,
  resolvePropSessionSlug,
  shouldIncludeSbtSelectorEntryForListScope,
  shouldSkipSbtSelectorEntryForOptions,
  shouldWarmSbtSelectorRegistryCacheForTargets,
  shouldUsePropsSbtSelectorSessionConfigForSlug,
} from './sbtSelectorHelpers';

describe('sbtSelectorHelpers', () => {
  it('builds unique selected SBT hydration addresses from valid selected entries', () => {
    expect(
      buildSelectedSbtHydrationAddresses([
        { address: ' 0x0000000000000000000000000000000000000001 ' },
        { address: '0x0000000000000000000000000000000000000001' },
        { address: 'not-an-address' },
        null,
        { address: '0x0000000000000000000000000000000000000002' },
      ]),
    ).toEqual(['0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002']);
    expect(buildSelectedSbtHydrationAddresses('bad')).toEqual([]);
  });

  it('normalizes signature lists and lookup keys', () => {
    expect(normalizeAddressListForSig([' 0xB ', '0xa', '0xA', ''])).toEqual(['0xa', '0xb']);
    expect(normalizeSessionSlugListForSig([' Edge ', 'Edge', ''])).toEqual(['Edge', '']);
    expect(buildSessionSlugSignature(['a', 'b'])).toBe('a,b');
    expect(buildSharedLightUniverseKickoffSignature(['Beta', 'Alpha', 'Alpha', 'General'])).toBe('3:,Alpha,Beta');
    expect(
      buildSbtSelectorLogContext({
        effectiveSessionSlug: ' Edge Session ',
        extra: { scopeMode: 'targeted' },
        id: ' selector-a ',
        label: 'Selector A',
      }),
    ).toEqual({
      selectorId: 'selector-a',
      effectiveSessionSlug: 'Edge Session',
      scopeMode: 'targeted',
    });
    expect(
      buildSbtSelectorLogContext({
        effectiveSessionSlug: '',
        label: '  ',
      })?.selectorId,
    ).toBe('unnamed-selector');
    expect(
      buildTargetSlugChainSignature(['Alpha', 'General', 'Alpha'], (slug) => (slug ? `${slug.length}` : '11155420')),
    ).toBe('Alpha:5|:11155420');
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
      '0x000000000000000000000000000000000000000a',
    );
    expect(normalizeSelectableSbtAddress('not-an-address')).toBe('');
    expect(
      getSelectableSbtKey({
        address: '0x000000000000000000000000000000000000000A',
        chainId: '84532',
      }),
    ).toBe('84532:0x000000000000000000000000000000000000000a');
    expect(
      getSelectableSbtKey({
        sbtAddress: '0x000000000000000000000000000000000000000B',
        sbtInfo: { chainID: '11155420' },
      }),
    ).toBe('11155420:0x000000000000000000000000000000000000000b');
    expect(
      getSelectableSbtKey({
        selectionKey: 'custom-key',
        address: '0x000000000000000000000000000000000000000A',
      }),
    ).toBe('custom-key');
    expect(getSelectableSbtKey('84532:0x000000000000000000000000000000000000000A')).toBe(
      '84532:0x000000000000000000000000000000000000000a',
    );
    expect(getSelectableSbtKey('0x000000000000000000000000000000000000000A')).toBe(
      '0x000000000000000000000000000000000000000a',
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
    expect(
      hasSelectedOrPendingSbtSelectorAddress({
        address: '0x000000000000000000000000000000000000000A',
        selectedAddresses: new Set(['0x000000000000000000000000000000000000000a']),
      }),
    ).toBe(true);
    expect(
      hasSelectedOrPendingSbtSelectorAddress({
        address: '0x000000000000000000000000000000000000000C',
        pendingAddresses: new Set(['0x000000000000000000000000000000000000000c']),
      }),
    ).toBe(true);
    expect(
      hasSelectedOrPendingSbtSelectorAddress({
        address: 'bad',
        pendingAddresses: new Set(['bad']),
      }),
    ).toBe(false);
    expect(
      hasSelectedOrPendingSbtSelectorKey({
        value: first,
        selectedKeys: new Set(['first-key']),
      }),
    ).toBe(true);
    expect(
      hasSelectedOrPendingSbtSelectorKey({
        value: second,
        pendingKeys: new Set(['84532:0x000000000000000000000000000000000000000b']),
      }),
    ).toBe(true);
    expect(
      hasSelectedOrPendingSbtSelectorKey({
        value: 'bad',
        pendingKeys: new Set(['bad']),
      }),
    ).toBe(false);
    expect(
      Array.from(
        buildEffectiveFeaturedAddressSet({
          scopeFeaturedAddresses: ['0x000000000000000000000000000000000000000C'],
          defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000D'],
        }),
      ),
    ).toEqual(['0x000000000000000000000000000000000000000c']);
    expect(
      Array.from(
        buildEffectiveFeaturedAddressSet({
          scopeFeaturedAddresses: [],
          defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000D'],
        }),
      ),
    ).toEqual(['0x000000000000000000000000000000000000000d']);
  });

  it('merges selectable options while preserving cached address precedence', () => {
    const cached = { address: '0x000000000000000000000000000000000000000A', name: 'Cached' };
    const duplicateAdditional = { address: '0x000000000000000000000000000000000000000a', name: 'Additional duplicate' };
    const newAdditional = { address: '0x000000000000000000000000000000000000000B', name: 'Additional' };

    expect(
      buildSbtSelectorMergedSelectableOptions({
        sbtOptions: [cached],
        additionalOptions: [duplicateAdditional, newAdditional],
      }),
    ).toEqual([cached, newAdditional]);
    expect(
      buildSbtSelectorMergedSelectableOptions({
        sbtOptions: 'bad',
        additionalOptions: [newAdditional],
      }),
    ).toEqual([newAdditional]);
  });

  it('resolves display options using scope featured entries before defaults', () => {
    const optionA = { address: '0x000000000000000000000000000000000000000A', name: 'A' };
    const optionB = { address: '0x000000000000000000000000000000000000000B', name: 'B' };

    expect(
      resolveSbtSelectorDisplayOptions({
        defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000A'],
        limitToFeatured: true,
        mergedSbtOptions: [optionA, optionB],
        scopeFeaturedAddresses: ['0x000000000000000000000000000000000000000B'],
      }),
    ).toEqual({
      displayOptions: [optionB],
      effectiveFeatured: ['0x000000000000000000000000000000000000000B'],
      hasFeaturedSBTs: true,
    });
    expect(
      resolveSbtSelectorDisplayOptions({
        defaultFeaturedSBTs: ['0x000000000000000000000000000000000000000A'],
        limitToFeatured: false,
        mergedSbtOptions: [optionA, optionB],
        scopeFeaturedAddresses: [],
      }).displayOptions,
    ).toEqual([optionA, optionB]);
  });

  it('builds react-select options from display SBT options', () => {
    expect(
      buildSbtSelectorSelectOptions([
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
      ]),
    ).toEqual([
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
    expect(
      normalizeAdditionalSbtOptions([
        { sbtAddress: ' 0xabc ', label: 'Labelled' },
        { value: '0xdef' },
        { name: 'Named', address: '0x123' },
        { label: 'missing address' },
        null,
      ]),
    ).toEqual([
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
    const resolveSbtLabel = jest.fn((_info: unknown, _address: string, _sessionSlug: string) => 'Resolved Label');

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
      'Current',
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
    expect(
      buildSbtSelectorLoadingStatusClassName({
        baseClassName: 'loading-status',
        compactClassName: 'loading-status-compact',
        shouldUseCompactClass: false,
      }),
    ).toBe('loading-status');
    expect(
      buildSbtSelectorLoadingStatusClassName({
        baseClassName: 'loading-status',
        compactClassName: 'loading-status-compact',
        shouldUseCompactClass: true,
      }),
    ).toBe('loading-status loading-status-compact');
    expect(resolveSbtSelectorHeaderLoadingStatusState({ isLoading: true })).toEqual({
      shouldRenderHeaderLoadingStatus: true,
    });
    expect(resolveSbtSelectorHeaderLoadingStatusState({ isLoading: false })).toEqual({
      shouldRenderHeaderLoadingStatus: false,
    });
    expect(getSbtSelectorLoadingStatusText({ count: 0 })).toBe('Loading');
    expect(getSbtSelectorLoadingStatusText({ count: 2 })).toBe('Loading 2');
    expect(getSbtSelectorLoadingStatusText({ compact: true, count: 2 })).toBe('Loading 2');
    expect(getSbtSelectorLoadingStatusText({ compact: true, count: 0 })).toBe('Loading');
  });

  it('builds selector metadata lookup config with merged contracts and chain context', () => {
    expect(
      buildSbtSelectorMetadataLookupConfig({
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
      }),
    ).toEqual({
      sessionName: 'Props',
      slug: 'Alpha',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0xBase' },
        surveys: { address: '0xSurvey' },
      },
      __registry: { source: 'base', chainId: 84532 },
    });
    expect(
      buildSbtSelectorMetadataLookupConfig({
        baseConfig: {
          networkChainId: 10,
          __registry: { chainId: 10 },
        },
        propsConfig: {
          networkChainId: 84532,
        },
        sessionSlug: null,
        shouldUsePropsConfig: false,
      }),
    ).toEqual({
      slug: '',
      networkChainId: 10,
      contracts: {},
      __registry: { chainId: 10 },
    });
    expect(
      buildSbtSelectorDiscoverySessionRef({
        metadataLookupConfig: { sessionName: 'Base', slug: 'Old' },
        sessionSlug: 'Alpha',
      }),
    ).toEqual({ sessionName: 'Base', slug: 'Alpha' });
    expect(
      buildSbtSelectorDiscoverySessionRef({
        metadataLookupConfig: null,
        sessionSlug: null,
      }),
    ).toEqual({ slug: '' });
    expect(
      resolveSbtSelectorSessionLabel({
        sessionConfig: { sessionName: 'Alpha Session' },
        sessionSlug: 'alpha',
      }),
    ).toBe('Alpha Session (alpha)');
    expect(
      resolveSbtSelectorSessionLabel({
        sessionConfig: { sessionName: 'alpha' },
        sessionSlug: 'alpha',
      }),
    ).toBe('alpha');
    expect(
      resolveSbtSelectorSessionLabel({
        sessionConfig: {},
        sessionSlug: '',
      }),
    ).toBe('General');
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
    expect(
      Array.from(
        buildSbtSelectorListScopeTargetSlugSet({
          fallbackSlug: 'Fallback',
          scopeMode: 'list',
          targetSlugs: ['Alpha', 'Alpha', null],
        }) || [],
      ),
    ).toEqual(['Alpha', '']);
    expect(
      Array.from(
        buildSbtSelectorListScopeTargetSlugSet({
          fallbackSlug: 'Fallback',
          scopeMode: 'list',
          targetSlugs: [],
        }) || [],
      ),
    ).toEqual(['Fallback']);
    expect(
      buildSbtSelectorListScopeTargetSlugSet({
        fallbackSlug: 'Fallback',
        scopeMode: 'active',
        targetSlugs: ['Alpha'],
      }),
    ).toBeNull();
    expect(getNormalizedDiscoveryOverride({ discoverySessionSlugs: ['Alpha', 'Alpha'] })).toEqual(['Alpha']);
    expect(getNormalizedDiscoveryOverride({ discoverySessionSlugs: [] })).toEqual([]);
    expect(getNormalizedDiscoveryOverride({})).toEqual([]);
  });
});
