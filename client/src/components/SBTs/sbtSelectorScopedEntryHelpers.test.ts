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

describe('sbtSelector scoped entry helpers', () => {
  it('resolves explicit and declared SBT session bindings', () => {
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha' })).toBe(true);
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha', sessionSlugExplicit: true })).toBe(true);
    expect(hasAuthoritativeSessionSlug({ sessionSlug: 'Alpha', sessionSlugExplicit: false })).toBe(false);
    expect(hasAuthoritativeSessionSlug({ slug: 'Alpha' })).toBe(false);

    expect(
      resolveAuthoritativeSbtSessionBindingSlug({
        sbtInfo: { sessionSlug: 'Alpha', sessionSlugExplicit: true },
      }),
    ).toBe('Alpha');
    expect(
      resolveAuthoritativeSbtSessionBindingSlug({
        sessionSlug: 'Beta',
      }),
    ).toBe('Beta');
    expect(
      resolveAuthoritativeSbtSessionBindingSlug({
        sbtInfo: { slug: 'Legacy' },
      }),
    ).toBe('Legacy');
    expect(
      resolveAuthoritativeSbtSessionBindingSlug({
        sessionSlug: 'Inferred',
        sessionSlugExplicit: false,
      }),
    ).toBeNull();

    expect(
      resolveDeclaredSbtSessionSlug({
        sbtInfo: { sessionSlug: 'Declared' },
        sessionSlug: 'Fallback',
      }),
    ).toBe('Declared');
    expect(resolveDeclaredSbtSessionSlug({ sessionSlug: 'Fallback' })).toBe('Fallback');
    expect(resolveDeclaredSbtSessionSlug({})).toBeNull();
    const listScopeTargetSlugSet = new Set(['alpha']);
    expect(
      shouldIncludeSbtSelectorEntryForListScope({
        declaredSessionSlug: 'alpha',
        hasVisibleMetadata: true,
        listScopeTargetSlugSet,
        scopedBucketSlug: 'beta',
      }),
    ).toBe(true);
    expect(
      shouldIncludeSbtSelectorEntryForListScope({
        declaredSessionSlug: 'beta',
        listScopeTargetSlugSet,
        scopedBucketSlug: 'alpha',
      }),
    ).toBe(false);
    expect(
      shouldIncludeSbtSelectorEntryForListScope({
        declaredSessionSlug: null,
        hasVisibleMetadata: false,
        listScopeTargetSlugSet,
        scopedBucketSlug: 'alpha',
      }),
    ).toBe(true);
    expect(
      shouldIncludeSbtSelectorEntryForListScope({
        declaredSessionSlug: null,
        hasVisibleMetadata: true,
        listScopeTargetSlugSet,
        scopedBucketSlug: 'alpha',
      }),
    ).toBe(false);
    expect(
      shouldSkipSbtSelectorEntryForOptions({
        address: '0xabc',
        ignoredAddressSet: new Set(['alpha|0xabc']),
        resolvedSlug: 'alpha',
      }),
    ).toBe(true);
    expect(
      shouldSkipSbtSelectorEntryForOptions({
        address: '0xabc',
        isManual: false,
        sbtInfo: { unlisted: true },
      }),
    ).toBe(true);
    expect(
      shouldSkipSbtSelectorEntryForOptions({
        address: '0xabc',
        isManual: true,
        sbtInfo: { unlisted: true },
      }),
    ).toBe(false);
    expect(
      shouldSkipSbtSelectorEntryForOptions({
        address: '0xabc',
        sbtOptionsMap: new Map([['0xabc:1', {}]]),
        selectionKey: '0xabc:1',
      }),
    ).toBe(true);
    expect(
      resolveSbtSelectorOptionEntryContext({
        fallbackSlug: 'fallback',
        sbt: {
          chainId: '11155420',
          manual: true,
          sbtAddress: '0xABC',
          sbtInfo: { name: 'Visible Badge' },
          sessionBindingSlug: 'Binding',
          slug: 'alpha',
        },
      }),
    ).toEqual({
      address: '0xabc',
      chainId: 11155420,
      isManual: true,
      resolvedSlug: 'Binding',
      sbtInfo: { name: 'Visible Badge' },
      selectionKey: '11155420:0xabc',
    });
    expect(
      resolveSbtSelectorOptionEntryContext({
        fallbackSlug: 'fallback',
        sbt: {
          sbtAddress: '',
        },
      }),
    ).toBeNull();
    expect(
      buildSbtSelectorNameHydrationEntries({
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
      }),
    ).toEqual([
      {
        address: '0x1111111111111111111111111111111111111111',
        slug: 'Binding',
      },
    ]);
    expect(
      buildSbtSelectorOptionFromEntry({
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
      }),
    ).toEqual({
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
    expect(
      buildSbtSelectorOptionFromEntry({
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
      }),
    ).toEqual({
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
    const resolveSbtLabel = jest.fn((sbtInfo, address, slug) => `${String(sbtInfo?.name || address)}@${slug}`);
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

    expect(
      resolveConcreteSbtSessionBindingSlug({
        sessionSlug: 'Concrete',
        sessionSlugExplicit: true,
      }),
    ).toBe('Concrete');
    expect(
      resolveConcreteSbtSessionBindingSlug({
        sessionSlug: 'Inferred',
        sessionSlugExplicit: false,
      }),
    ).toBeNull();
  });

  it('builds stable selector request signatures', () => {
    const sessionConfigSig = buildSessionConfigSig({
      slug: 'alpha',
      contracts: { sbtFactory: { address: ' 0xF00 ', chainId: '84532' } },
      blockLimits: { start: '10', end: '20' },
    });
    expect(sessionConfigSig).toBe('alpha|0xf00|84532|10|20');
    expect(
      buildFeaturedEntrySignature([{ slug: 'alpha', address: ' 0xB ' }, { slug: 'General', address: '' }, null]),
    ).toBe('alpha:0xb');
    expect(
      buildSbtOptionsRequestSignature({
        slug: 'alpha',
        cacheRevision: 3,
        sessionConfigSig,
        targetSlugChainSig: 'alpha:84532',
        featuredEntries: [{ slug: 'alpha', address: '0xB' }],
        ignoredFromConfig: ['0xC', '0xc'],
      }),
    ).toBe('alpha|3|alpha|0xf00|84532|10|20|alpha:84532|alpha:0xb|0xc');
  });

  it('resolves load-options request decisions', () => {
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: false,
        inflightRequest: null,
        lastRequestSig: 'same',
        requestSig: 'same',
      }),
    ).toEqual({
      shouldQueueRerun: false,
      shouldReturnInflight: false,
      shouldSkipUnchanged: true,
    });

    const inflight = Promise.resolve();
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: false,
        inflightRequest: inflight,
        inflightSig: 'same',
        requestSig: 'same',
      }),
    ).toEqual({
      shouldQueueRerun: false,
      shouldReturnInflight: true,
      shouldSkipUnchanged: false,
    });
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: false,
        inflightRequest: inflight,
        inflightSig: 'old',
        requestSig: 'new',
      }),
    ).toEqual({
      shouldQueueRerun: true,
      shouldReturnInflight: true,
      shouldSkipUnchanged: false,
    });
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: true,
        inflightRequest: inflight,
        inflightSig: 'same',
        requestSig: 'same',
      }).shouldQueueRerun,
    ).toBe(true);
  });

  it('resolves SBT entry chain IDs with fallbacks', () => {
    expect(resolveSbtEntryChainId({ chainId: '10' }, 84532)).toBe(10);
    expect(resolveSbtEntryChainId({ sbtInfo: { chainID: '84532' } })).toBe(84532);
    expect(resolveSbtEntryChainId({}, '11155420')).toBe(11155420);
    expect(resolveSbtEntryChainId({})).toBeNull();
  });

  it('decorates scoped SBT entries with source, binding, and chain context', () => {
    expect(
      decorateScopedSbtEntry(
        {
          slug: 'Alpha',
          sbtInfo: {
            chainID: '84532',
            sessionSlug: 'Concrete',
            sessionSlugExplicit: true,
          },
        },
        'Fallback',
      ),
    ).toMatchObject({
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
      'Fallback',
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
    expect(
      mergeScopedSbtEntry(
        {
          slug: 'Alpha',
          sbtInfo: { name: 'Existing Badge' },
        },
        {
          slug: 'Beta',
          sbtInfo: { name: 'Incoming Badge' },
        },
        'Fallback',
      )?.sbtInfo,
    ).toEqual({ name: 'Existing Badge' });
    expect(
      mergeScopedSbtEntry({ slug: 'Alpha', sbtInfo: {} }, { slug: 'Beta', sbtInfo: { nameLocked: true } }, 'Fallback')
        ?.sbtInfo,
    ).toEqual({ nameLocked: true });
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
    expect(shouldPreferIncomingScopedSbtEntry({ sbtInfo: {} }, { sbtInfo: { name: 'Named Badge' } })).toBe(true);
    expect(
      shouldPreferIncomingScopedSbtEntry(
        { sbtInfo: { name: 'Existing Badge' } },
        { sbtInfo: { name: 'Incoming Badge' } },
      ),
    ).toBe(false);
    expect(
      shouldPreferIncomingScopedSbtEntry({ sbtInfo: { name: 'Existing Badge' } }, { sbtInfo: { image: 'ar://image' } }),
    ).toBe(true);
    expect(
      shouldPreferIncomingScopedSbtEntry(
        { sbtInfo: { image: 'ar://existing' } },
        { sbtInfo: { image: 'ar://incoming' } },
      ),
    ).toBe(false);
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

    expect(
      buildSelectedSbtHydrationSignature({
        addresses: [first, second],
        networkID: '84532',
        slug: 'Alpha',
      }),
    ).toBe(`Alpha|84532|${first},${second}`);
    expect(
      buildSelectedSbtHydrationSignature({
        addresses: 'bad',
        networkID: 'bad',
        slug: null,
      }),
    ).toBe('|NaN|');

    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: [first],
        hits: null,
        targetedLookupEnabled: false,
      }),
    ).toEqual({
      hasHits: false,
      hasUnresolvedAddresses: true,
      shouldClearRetry: true,
      shouldReloadOptions: false,
      shouldRetry: false,
    });

    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: [first],
        hits: [],
        targetedLookupEnabled: true,
      }),
    ).toEqual({
      hasHits: false,
      hasUnresolvedAddresses: true,
      shouldClearRetry: false,
      shouldReloadOptions: false,
      shouldRetry: true,
    });

    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: [first, second],
        hits: [{ address: first.toUpperCase() }],
        targetedLookupEnabled: true,
      }),
    ).toEqual({
      hasHits: true,
      hasUnresolvedAddresses: true,
      shouldClearRetry: false,
      shouldReloadOptions: true,
      shouldRetry: true,
    });

    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: [first],
        hits: [{ address: first.toUpperCase() }],
        targetedLookupEnabled: true,
      }),
    ).toEqual({
      hasHits: true,
      hasUnresolvedAddresses: false,
      shouldClearRetry: true,
      shouldReloadOptions: true,
      shouldRetry: false,
    });
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
    expect(
      buildLinkedSbtSelectorListFromKnownCache({
        knownEntries,
        targetSlugs: [],
      }),
    ).toEqual({});
  });

  it('resolves linked scoped entries against source and binding scope', () => {
    expect(
      resolveLinkedSbtSelectorScopeEntry({
        scopedEntry: {
          __sourceSessionSlug: 'Outside',
          sessionBindingSlug: 'Beta',
          slug: 'Outside',
        },
        sourceSlug: 'Outside',
        targetSlugSet: new Set(['Beta']),
      }),
    ).toMatchObject({
      __sourceSessionSlug: 'Outside',
      sessionBindingSlug: 'Beta',
      slug: 'Beta',
    });
    expect(
      resolveLinkedSbtSelectorScopeEntry({
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
      }),
    ).toMatchObject({
      sessionBindingSlug: 'Beta',
      slug: 'Beta',
    });
    expect(
      resolveLinkedSbtSelectorScopeEntry({
        requireConcreteBinding: true,
        scopedEntry: {
          __sourceSessionSlug: 'Alpha',
          slug: 'Alpha',
        },
        sourceSlug: 'Alpha',
        targetSlugSet: new Set(['Alpha']),
      }),
    ).toMatchObject({
      __sourceSessionSlug: 'Alpha',
      slug: 'Alpha',
    });
    expect(
      resolveLinkedSbtSelectorScopeEntry({
        scopedEntry: {
          __sourceSessionSlug: 'Outside',
          sessionBindingSlug: 'Other',
          slug: 'Outside',
        },
        sourceSlug: 'Outside',
        targetSlugSet: new Set(['Beta']),
      }),
    ).toBeNull();
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
    expect(areSbtOptionsEqual([null], [{}])).toBe(true);
    expect(isUnresolvedSessionConfig({ __unresolved: true })).toBe(true);
    expect(isUnresolvedSessionConfig({ __unresolved: false })).toBe(false);
    expect(isUnresolvedSessionConfig(null)).toBe(false);
  });

  it('identifies masked hidden titles only when the name is still locked', () => {
    expect(isMaskedSbtOptionLabel(' [ENCRYPTED] ')).toBe(true);
    expect(isMaskedSbtOptionLabel('Visible title')).toBe(false);
    expect(isMaskedHiddenTitle({ label: '[encrypted]', sbtInfo: null })).toBe(true);
    expect(
      isMaskedHiddenTitle({
        label: '[encrypted]',
        sbtInfo: { nameLocked: true },
      }),
    ).toBe(true);
    expect(
      isMaskedHiddenTitle({
        label: '[encrypted]',
        sbtInfo: { name: 'Visible name', nameLocked: true },
      }),
    ).toBe(false);
    expect(
      isMaskedHiddenTitle({
        label: '[encrypted]',
        sbtInfo: { nameLocked: true, nameDecrypted: true },
      }),
    ).toBe(false);
    expect(
      isMaskedHiddenTitle({
        label: 'Visible title',
        sbtInfo: { nameLocked: true },
      }),
    ).toBe(false);
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

    expect(options.sort((left, right) => compareSbtSelectorOptions(left, right, featuredOrder))).toEqual([
      { address: '0xb', name: 'Zulu', chainId: 1, maskedTitleHidden: false },
      { address: '0xa', name: 'Beta', chainId: 1, maskedTitleHidden: false },
      { address: '0xd', name: 'Alpha', chainId: 1, maskedTitleHidden: false },
      { address: '0xe', name: 'Alpha', chainId: 2, maskedTitleHidden: false },
      { address: '0xc', name: 'Alpha', chainId: 10, maskedTitleHidden: true },
    ]);
    expect(
      compareSbtSelectorOptions(
        { address: '0xf', name: 'Same', chainId: 2 },
        { address: '0xf', name: 'Same', chainId: 1 },
        featuredOrder,
      ),
    ).toBe(1);
    expect(compareSbtSelectorOptions('bad', { address: '0x1' }, featuredOrder)).toBeLessThan(0);
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

    expect(
      buildSbtSelectorOptionsStatePatch({
        currentLoadingOptions: true,
        currentSbtOptions: [currentOption],
        currentScopeFeaturedAddresses: ['0xa'],
        featuredEntries: [{ address: '0xA' }],
        loadingOptions: true,
        sbtOptions: [{ ...currentOption, extraIgnored: 'same' }],
      }),
    ).toEqual({});
    expect(
      buildSbtSelectorOptionsStatePatch({
        currentLoadingOptions: true,
        currentSbtOptions: [currentOption],
        currentScopeFeaturedAddresses: ['0xa'],
        featuredEntries: [{ address: '0xB' }],
        loadingOptions: false,
        sbtOptions: [nextOption],
      }),
    ).toEqual({
      loadingOptions: false,
      sbtOptions: [nextOption],
      scopeFeaturedAddresses: ['0xb'],
    });
    expect(
      buildSbtSelectorOptionsStatePatch({
        currentSbtOptions: [currentOption],
        sbtOptions: 'bad',
      }),
    ).toEqual({
      sbtOptions: [],
    });
  });

  it('resolves SBT detail link session slug precedence', () => {
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: {
          sessionBindingSlug: 'Binding',
          sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
          sessionSlug: 'Selected',
        },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Binding');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: {
          sbtInfo: { sessionSlug: 'Info', sessionSlugExplicit: true },
          sessionSlug: 'Selected',
        },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Info');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: { sessionSlug: 'Selected', sessionSlugExplicit: true },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Selected');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: { sessionSlug: 'Selected', sessionSlugExplicit: false },
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Selected');
    expect(
      resolveSbtDetailLinkSessionSlug({
        sbt: {},
        fallbackSlug: 'Fallback',
      }),
    ).toBe('Fallback');
  });
});
