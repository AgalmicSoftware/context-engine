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
  resolveSbtSelectorSessionNetworkId,
  resolveSbtSelectorTargetedHydrationDecision,
  resolveSbtSelectorTargetSlugs,
  resolveSbtSelectorVariantDisplayState,
  resolvePropSessionSlug,
  shouldIncludeSbtSelectorEntryForListScope,
  shouldSkipSbtSelectorEntryForOptions,
  shouldWarmSbtSelectorRegistryCacheForTargets,
  shouldUsePropsSbtSelectorSessionConfigForSlug,
} from './sbtSelectorHelpers';

describe('sbtSelector target scope helpers', () => {
  it('resolves directly invoked target slugs from overrides and scan scope', () => {
    const normalizeSlugs = (slugs: unknown, options = {}) => normalizeDiscoverySlugs(slugs, options);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        explicitOverride: [' Alpha ', 'beta'],
        normalizeDiscoverySlugs: normalizeSlugs,
        propSessionSlug: 'ignored',
        readSessionScanScope: () => 'all',
      }),
    ).toEqual(['Alpha', 'beta']);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        normalizeDiscoverySlugs: normalizeSlugs,
        propSessionSlug: 'edge',
        readSessionScanScope: () => 'general',
      }),
    ).toEqual(['']);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        normalizeDiscoverySlugs: normalizeSlugs,
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['gamma', ''],
      }),
    ).toEqual(['gamma', '']);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        getAllSessionSlugs: () => ['alpha', ''],
        normalizeDiscoverySlugs: normalizeSlugs,
        readSessionScanScope: () => 'all',
      }),
    ).toEqual(['alpha', '']);
    expect(
      resolveDirectSbtSelectorTargetSlugs({
        normalizeDiscoverySlugs: normalizeSlugs,
        propSessionSlug: 'edge',
        readSessionScanScope: () => 'unknown',
      }),
    ).toEqual(['edge']);
    expect(
      resolveSbtSelectorEffectiveSessionSlug({
        props: { sessionSlug: 'Active' },
        sourceSessionSlug: 'Override',
      }),
    ).toBe('Active');
    expect(
      resolveSbtSelectorEffectiveSessionSlug({
        groupOverride: true,
        props: { sessionSlug: 'Active' },
        sourceSessionSlug: 'Override',
      }),
    ).toBe('Override');
    expect(
      resolveSbtSelectorEffectiveSessionSlug({
        groupOverride: true,
        sourceSessionSlug: null,
      }),
    ).toBe('');
    expect(
      resolveSbtSelectorGroupSourceSelection({
        activeSlug: 'Active',
        next: '__active__',
      }),
    ).toEqual({
      groupOverride: false,
      slugOverride: 'Active',
      sourceSessionSlug: 'Active',
    });
    expect(
      resolveSbtSelectorGroupSourceSelection({
        activeSlug: 'Active',
        next: 'Override',
      }),
    ).toEqual({
      groupOverride: true,
      slugOverride: 'Override',
      sourceSessionSlug: 'Override',
    });
    expect(
      buildSbtSelectorGroupOptions({
        slugs: ['Alpha', '', null],
        getSessionLabel: (slug) => `Label:${String(slug || 'General')}`,
      }),
    ).toEqual([
      { value: 'Alpha', label: 'Label:Alpha' },
      { value: '', label: 'Label:General' },
      { value: '', label: 'Label:General' },
    ]);
    expect(
      buildSbtSelectorGroupOptions({
        slugs: 'Alpha',
      }),
    ).toEqual([]);
    expect(
      buildSbtSelectorGroupSourceSelectionPatch({
        selection: {
          groupOverride: true,
          sourceSessionSlug: 'Override',
          slugOverride: 'Ignored by patch',
        },
      }),
    ).toEqual({
      groupOverride: true,
      sourceSessionSlug: 'Override',
    });
    expect(
      buildSbtSelectorGroupSourceSelectionPatch({
        selection: null,
      }),
    ).toEqual({
      groupOverride: false,
      sourceSessionSlug: '',
    });
    expect(
      buildSbtSelectorManualInputTogglePatch({
        showManualInput: false,
      }),
    ).toEqual({
      manualInputWarning: '',
      showManualInput: true,
    });
    expect(
      buildSbtSelectorManualInputTogglePatch({
        showManualInput: true,
      }),
    ).toEqual({
      manualInputWarning: '',
      showManualInput: false,
    });
    expect(
      buildSbtSelectorGroupPickerTogglePatch({
        showGroupPicker: false,
      }),
    ).toEqual({
      showGroupPicker: true,
    });
    expect(
      buildSbtSelectorGroupPickerTogglePatch({
        showGroupPicker: true,
      }),
    ).toEqual({
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
    expect(
      resolveSbtSelectorManualEntryState({
        customSBTAddress: '0x00000000000000000000000000000000000000AA',
        isAddress: (value: string) => value.endsWith('AA'),
      }),
    ).toEqual({
      canAddCustomAddress: true,
    });
    expect(
      resolveSbtSelectorManualEntryState({
        customSBTAddress: ' 0x00000000000000000000000000000000000000AA ',
        isAddress: (value: string) => value.endsWith('AA'),
      }),
    ).toEqual({
      canAddCustomAddress: false,
    });
    expect(
      resolveSbtSelectorManualControlsState({
        manualInputWarning: '',
        showManualInput: false,
      }),
    ).toEqual({
      manualToggleLabel: '+ By Address',
      shouldRenderManualEntry: false,
      shouldRenderManualWarning: false,
    });
    expect(
      resolveSbtSelectorManualControlsState({
        manualInputWarning: 'Invalid address',
        showManualInput: true,
      }),
    ).toEqual({
      manualToggleLabel: 'Hide',
      shouldRenderManualEntry: true,
      shouldRenderManualWarning: true,
    });
    expect(
      resolveSbtSelectorSelectedAddressesState({
        selectedSbts: [{ address: '0xabc' }],
      }),
    ).toEqual({
      shouldRenderSelectedAddresses: true,
    });
    expect(
      resolveSbtSelectorSelectedAddressesState({
        selectedSbts: [],
      }),
    ).toEqual({
      shouldRenderSelectedAddresses: false,
    });
    expect(
      resolveSbtSelectorSelectedAddressesState({
        selectedSbts: 'bad',
      }),
    ).toEqual({
      shouldRenderSelectedAddresses: false,
    });
    expect(
      resolveSbtSelectorAutoSearchButtonsState({
        autoSearchSessionOptions: [],
        enableGroupSelect: true,
        groupOverride: true,
      }),
    ).toEqual({
      shouldRenderAutoSearchSessionButtons: true,
    });
    expect(
      resolveSbtSelectorAutoSearchButtonsState({
        autoSearchSessionOptions: [{ value: 'alpha' }],
        enableGroupSelect: true,
        groupOverride: false,
      }),
    ).toEqual({
      shouldRenderAutoSearchSessionButtons: true,
    });
    expect(
      resolveSbtSelectorAutoSearchButtonsState({
        autoSearchSessionOptions: [{ value: 'alpha' }],
        enableGroupSelect: false,
        groupOverride: true,
      }),
    ).toEqual({
      shouldRenderAutoSearchSessionButtons: false,
    });
    expect(
      resolveSbtSelectorGroupPickerState({
        currentSessionSlug: 'Alpha',
        enableGroupSelect: true,
        groupOverride: true,
        showGroupPicker: true,
      }),
    ).toEqual({
      selectedGroupValue: 'Alpha',
      shouldRenderGroupPicker: true,
      shouldRenderGroupSettingsButton: true,
    });
    expect(
      resolveSbtSelectorGroupPickerState({
        currentSessionSlug: 'Alpha',
        enableGroupSelect: true,
        groupOverride: false,
        showGroupPicker: false,
      }),
    ).toEqual({
      selectedGroupValue: '__active__',
      shouldRenderGroupPicker: false,
      shouldRenderGroupSettingsButton: true,
    });
    expect(
      resolveSbtSelectorGroupPickerState({
        currentSessionSlug: 'Alpha',
        enableGroupSelect: false,
        groupOverride: true,
        showGroupPicker: true,
      }),
    ).toEqual({
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
    expect(
      buildSbtSelectorRootClassName({
        adminClassName: 'admin',
        baseClassName: 'root',
        createClassName: 'create',
        variant: 'admin',
      }),
    ).toBe('root admin');
    expect(
      buildSbtSelectorRootClassName({
        adminClassName: 'admin',
        baseClassName: 'root',
        createClassName: 'create',
        variant: 'create',
      }),
    ).toBe('root create');
    expect(
      buildSbtSelectorRootClassName({
        baseClassName: 'root',
        variant: 'other',
      }),
    ).toBe('root');
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
    expect(
      buildSbtSelectorCustomSbtSelection({
        address: '0x00000000000000000000000000000000000000AA',
        image: 'https://example.test/badge.png',
        name: 'Custom SBT',
        resolvedSlug: 'Alpha',
        sbtInfo: {
          chainID: 84532,
          sessionName: 'Alpha Session',
          sessionSlug: 'Alpha',
        },
      }),
    ).toEqual({
      address: '0x00000000000000000000000000000000000000aa',
      name: 'Custom SBT',
      image: 'https://example.test/badge.png',
      sessionSlug: 'Alpha',
      sessionName: 'Alpha Session',
      chainId: 84532,
      sessionBindingSlug: 'Alpha',
      selectionKey: '84532:0x00000000000000000000000000000000000000aa',
    });
    expect(
      buildSbtSelectorCustomSbtSelection({
        address: '0xabc',
        resolvedSlug: '',
        sbtInfo: null,
      }),
    ).toEqual({
      address: '0xabc',
      name: '',
      image: null,
      sessionSlug: '',
      sessionName: null,
      chainId: null,
      sessionBindingSlug: '',
      selectionKey: '0xabc',
    });
    expect(
      resolveSbtSelectorTargetSlugs({
        directlyInvokedTargetSlugs: ['Direct'],
        groupOverride: true,
        sourceSessionSlug: 'Override',
      }),
    ).toEqual(['Override']);
    expect(
      resolveSbtSelectorTargetSlugs({
        directlyInvokedTargetSlugs: ['Direct'],
        groupOverride: true,
        sourceSessionSlug: 'Override',
        slugOverride: null,
      }),
    ).toEqual(['']);
    expect(
      resolveSbtSelectorTargetSlugs({
        directlyInvokedTargetSlugs: ['Direct'],
        groupOverride: false,
      }),
    ).toEqual(['Direct']);
    expect(
      shouldWarmSbtSelectorRegistryCacheForTargets({
        targetSlugs: [],
        shouldUsePropsSessionConfigForSlug: () => true,
      }),
    ).toBe(true);
    expect(
      shouldWarmSbtSelectorRegistryCacheForTargets({
        targetSlugs: ['active', 'missing'],
        shouldUsePropsSessionConfigForSlug: (slug) => slug === 'active',
      }),
    ).toBe(true);
    expect(
      shouldWarmSbtSelectorRegistryCacheForTargets({
        targetSlugs: ['active'],
        shouldUsePropsSessionConfigForSlug: (slug) => slug === 'active',
      }),
    ).toBe(false);
    expect(
      shouldUsePropsSbtSelectorSessionConfigForSlug({
        effectiveSessionSlug: 'Active',
        sessionConfig: { slug: 'Props' },
        slugIn: 'Props',
      }),
    ).toBe(true);
    expect(
      shouldUsePropsSbtSelectorSessionConfigForSlug({
        effectiveSessionSlug: 'Active',
        sessionConfig: { slug: 'Props' },
        slugIn: 'Active',
      }),
    ).toBe(true);
    expect(
      shouldUsePropsSbtSelectorSessionConfigForSlug({
        effectiveSessionSlug: 'Active',
        sessionConfig: { slug: 'Props' },
        slugIn: 'Missing',
      }),
    ).toBe(false);
    expect(
      shouldUsePropsSbtSelectorSessionConfigForSlug({
        effectiveSessionSlug: 'Active',
        sessionConfig: null,
        slugIn: 'Active',
      }),
    ).toBe(false);
    expect(
      resolveSbtSelectorDisplayLookupSessionConfig({
        allowDemoSessionFallback: true,
        getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
        getSessionConfigBySlugOrDefault: () => ({ slug: 'strict' }),
        isUnresolvedSessionConfig: () => false,
        sessionSlug: 'Alpha',
      }),
    ).toEqual({ slug: 'strict' });
    expect(
      resolveSbtSelectorDisplayLookupSessionConfig({
        allowDemoSessionFallback: true,
        getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
        getSessionConfigBySlugOrDefault: () => ({ __unresolved: true }),
        isUnresolvedSessionConfig: () => true,
        sessionSlug: 'Alpha',
      }),
    ).toEqual({ slug: 'demo' });
    expect(
      resolveSbtSelectorDisplayLookupSessionConfig({
        allowDemoSessionFallback: false,
        getDemoSessionConfigBySlug: () => ({ slug: 'demo' }),
        getSessionConfigBySlugOrDefault: () => ({ __unresolved: true }),
        isUnresolvedSessionConfig: () => true,
        sessionSlug: 'Alpha',
      }),
    ).toEqual({ __unresolved: true });
    expect(
      resolveSbtSelectorDisplayLookupSessionConfig({
        allowDemoSessionFallback: true,
        getSessionConfigBySlugOrDefault: () => null,
        sessionSlug: 'Alpha',
      }),
    ).toBeNull();
  });

  it('resolves selector scope mode precedence', () => {
    expect(
      resolveSbtSelectorScopeMode({
        groupOverride: true,
        discoveryOverride: ['alpha'],
        readSessionScanScope: () => 'all',
      }),
    ).toBe('override');
    expect(
      resolveSbtSelectorScopeMode({
        groupOverride: false,
        discoveryOverride: ['alpha'],
        readSessionScanScope: () => 'all',
      }),
    ).toBe('explicit');
    expect(
      resolveSbtSelectorScopeMode({
        groupOverride: false,
        discoveryOverride: [],
        readSessionScanScope: () => 'list',
      }),
    ).toBe('list');
    expect(resolveSbtSelectorScopeMode()).toBe('');
  });

  it('normalizes SBT cache buckets for a network key', () => {
    expect(normalizeSbtCacheForNet(null, 84532)).toEqual({
      '84532': { sbtList: {} },
    });
    const existingList = {
      '0xabc': { address: '0xabc' },
    };
    const normalized = normalizeSbtCacheForNet(
      {
        '84532': { sbtList: existingList, other: true },
      },
      '84532',
    );
    expect(normalized['84532'].sbtList).toBe(existingList);
    expect(normalized['84532'].other).toBe(true);
    expect(
      normalizeSbtCacheForNet(
        {
          '84532': { sbtList: null },
        },
        '84532',
      )['84532'].sbtList,
    ).toEqual({});
  });

  it('reads scoped SBT cache contexts with cloned lists and lookup state', async () => {
    const existingList = {
      '0xabc': { sbtAddress: '0xabc', slug: 'alpha' },
    };
    const existingLookupState = {
      '0xabc': { attempts: 1 },
    };
    const readSbtCacheBySlug = jest.fn(async (slug) =>
      slug === 'alpha'
        ? { 84532: { sbtList: existingList, nameLookupState: existingLookupState } }
        : { 11155420: { sbtList: { '0xdef': { sbtAddress: '0xdef' } } } },
    );
    const getSessionNetworkId = jest.fn((slug) => (slug === 'alpha' ? 84532 : slug === 'beta' ? 11155420 : 0));

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

    expect(
      Array.from(
        buildIgnoredSbtSelectorAddressSet({
          effectiveSlug: ' Alpha ',
          getSessionLists,
          scopeMode: '',
        }),
      ),
    ).toEqual(['Alpha|0x000000000000000000000000000000000000000a']);
    expect(
      Array.from(
        buildIgnoredSbtSelectorAddressSet({
          effectiveSlug: 'Alpha',
          getSessionLists,
          scopeMode: 'general',
        }),
      ),
    ).toEqual(['|0x000000000000000000000000000000000000000b']);
    expect(
      Array.from(
        buildIgnoredSbtSelectorAddressSet({
          getSessionLists,
          scopeMode: 'general',
          targetSlugs: ['Alpha', 'Beta'],
        }),
      ),
    ).toEqual(['Alpha|0x000000000000000000000000000000000000000b', 'Beta|0x000000000000000000000000000000000000000b']);
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
    const readFeatured = jest.fn((config: unknown) =>
      Array.isArray((config as Record<string, unknown>)?.featured) ? (config as Record<string, unknown>).featured : [],
    );

    expect(
      buildScopeFeaturedSbtSelectorEntries({
        defaultFeaturedSBTs: [' 0x000000000000000000000000000000000000000A '],
        effectiveSlug: ' Alpha ',
        getCanonicalSessionFeaturedSBTs: readFeatured,
        getDisplayLookupSessionConfig: (slug: string) =>
          slug === 'Beta'
            ? {
                featured: ['0x000000000000000000000000000000000000000C', '0x000000000000000000000000000000000000000B'],
              }
            : {},
        getSessionLists,
        sessionConfig: {
          featured: ['0x000000000000000000000000000000000000000B', '0x000000000000000000000000000000000000000A'],
        },
        shouldUsePropsSessionConfigForSlug: (slug: string) => slug === 'Alpha',
        targetSlugs: ['Alpha', 'Beta'],
      }),
    ).toEqual([
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

    expect(
      buildSbtSelectorAutoSearchSessionOptions({
        autoSearchOtherSessions: true,
        directlyInvokedTargetSlugs: ['Alpha', 'General'],
        enableGroupSelect: true,
        groupOptions,
        groupOverride: true,
        sourceSessionSlug: 'Beta',
      }),
    ).toEqual([{ label: 'Gamma', value: 'Gamma' }]);
    expect(
      buildSbtSelectorAutoSearchSessionOptions({
        autoSearchOtherSessions: false,
        enableGroupSelect: true,
        groupOptions,
      }),
    ).toEqual([]);
    expect(
      buildSbtSelectorAutoSearchSessionOptions({
        autoSearchOtherSessions: true,
        enableGroupSelect: false,
        groupOptions,
      }),
    ).toEqual([]);
  });
});
