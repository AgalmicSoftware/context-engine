import {
  areStringArraysEqual,
  areSbtListArraysEqual,
  buildSbtListDetailHref,
  buildSbtListDisplayCardModel,
  buildSbtListExpandedAddressSetToggle,
  buildSbtListExpandedCardShellClassName,
  buildSbtListFeaturedCardModel,
  buildSbtListFilterContainerClassName,
  buildSbtListFilterLabelClassName,
  buildSbtListInteractiveMiniCardModel,
  buildSbtListLoadingGroupStatusClassName,
  buildSbtListLoadingProgressFillClassName,
  buildSbtListMetaRowModel,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRenderItemKey,
  buildSbtListRenderBuckets,
  buildSbtListRootClassName,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionUniversePanelClassName,
  collectSbtDocumentUrls,
  collectSbtTagValues,
  coerceSbtMintEndSeconds,
  dedupeNormalizedSbtListSlugs,
  getSbtCardDetails,
  getVisibleSbtListSessionSlugsFromEntries,
  getSbtListItemSignature,
  getSbtListNetHolderCount,
  hasSbtListAuthoritativeSessionSlug,
  hasSbtListExplicitNoSessionAssociation,
  hasSbtListMetadataSessionSlugField,
  hasSbtListMissingOrEmptySessionSlug,
  hasSbtListOwn,
  isSbtListManagedDgCacheName,
  isModifiedSbtListPointerNavigation,
  isSbtListSessionIdLikeSlug,
  isSbtListSyntheticNoSessionSlug,
  lowerSbtListAddressSet,
  mergeSbtListsByAddress,
  normalizeSbtListAddressLower,
  normalizeSbtListItems,
  normalizeSbtListTokenUri,
  pickNormalizedSbtListSessionSlug,
  readSbtListShowDemoSessions,
  readSbtListUniverseCollapsedState,
  readSbtListSyncBarResearchBlockStep,
  readStoredSbtListModeSelectedSessionSlugs,
  resolveSbtListConcreteSessionBindingSlug,
  resolveSbtListCreateGroupInitialVisibility,
  resolveSbtListActionableSessionSlugs,
  resolveSbtListChipSelectedSessionSlugs,
  resolveSbtListClampedSelectedSessionSlugs,
  resolveSbtListDefaultSelectedSessionSlugs,
  resolveSbtListDisplayedSessionUniverseSlugs,
  resolveSbtListHiddenRegistrySessionSlugs,
  resolveSbtListItemSessionSlug,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListRemainingHiddenRegistrySessionSlugs,
  resolveSbtListSelectedSessionUniverseSlugs,
  resolveSbtListSelectedHiddenRegistrySessionSlugs,
  resolveSbtListSectionSessionSlugs,
  resolveSbtListSessionUniverseSnapshotUpdate,
  resolveSbtListLoadingProgressFillStyle,
  resolveSbtListRelativeImageStyle,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
  sortSbtListSlugsByUniverseOrder,
} from './sbtListHelpers';

describe('sbtListHelpers', () => {
  it('detects session id shaped slugs before list display', () => {
    expect(isSbtListSessionIdLikeSlug('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isSbtListSessionIdLikeSlug('0x11111111111111111111111111111111')).toBe(true);
    expect(isSbtListSessionIdLikeSlug('11111111111111111111111111111111')).toBe(true);
    expect(isSbtListSessionIdLikeSlug('alpha')).toBe(false);
  });

  it('resolves SBT session metadata authority flags', () => {
    expect(hasSbtListOwn({ sessionSlug: 'alpha' }, 'sessionSlug')).toBe(true);
    expect(hasSbtListAuthoritativeSessionSlug({ sessionSlug: 'alpha' })).toBe(true);
    expect(hasSbtListAuthoritativeSessionSlug({ sessionSlug: 'alpha', sessionSlugExplicit: false })).toBe(false);
    expect(hasSbtListMetadataSessionSlugField({ sbtInfo: { sessionSlug: 'info' } })).toBe(true);
    expect(hasSbtListMetadataSessionSlugField({ sessionSlug: 'top' })).toBe(true);
    expect(hasSbtListExplicitNoSessionAssociation({
      sessionSlug: 'top',
      sbtInfo: { sessionSlug: '', sessionSlugExplicit: true },
    })).toBe(true);
    expect(hasSbtListMissingOrEmptySessionSlug({ sbtInfo: {} })).toBe(true);
    expect(hasSbtListMissingOrEmptySessionSlug({ sbtInfo: { sessionSlug: 'alpha' } })).toBe(false);
  });

  it('resolves concrete and display SBT session slugs by metadata precedence', () => {
    const getSessionSlugByName = jest.fn((sessionName: string) => (
      sessionName === 'Legacy Alpha' ? 'alpha' : null
    ));

    expect(resolveSbtListConcreteSessionBindingSlug({
      sbtInfo: { sessionSlug: 'beta', sessionSlugExplicit: true },
      sessionName: 'Legacy Alpha',
    }, { getSessionSlugByName })).toBe('beta');
    expect(resolveSbtListConcreteSessionBindingSlug({
      sbtInfo: { slug: 'legacyslug' },
    }, { getSessionSlugByName })).toBe('legacyslug');
    expect(resolveSbtListConcreteSessionBindingSlug({
      sbtInfo: { sessionSlug: 'Inferred', sessionSlugExplicit: false },
      sessionName: 'Legacy Alpha',
    }, { getSessionSlugByName })).toBeNull();
    expect(resolveSbtListConcreteSessionBindingSlug({
      sessionName: 'Legacy Alpha',
    }, { getSessionSlugByName })).toBe('alpha');

    expect(resolveSbtListItemSessionSlug({
      __sourceSessionSlug: 'source',
      sbtInfo: { sessionSlug: 'inferred', sessionSlugExplicit: false },
    }, {
      allSessionsMode: false,
      listSlug: 'fallback',
    })).toBe('source');
    expect(resolveSbtListItemSessionSlug({
      sbtInfo: { sessionSlug: '', sessionSlugExplicit: true },
    }, {
      allSessionsMode: true,
      isListModeScopeEnabled: true,
      resolveConcreteSessionBindingSlug: () => '',
    })).toBe(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
    expect(resolveSbtListItemSessionSlug({
      sbtInfo: { sessionSlug: 'beta', sessionSlugExplicit: true },
    }, {
      allSessionsMode: true,
      isListModeScopeEnabled: true,
      resolveConcreteSessionBindingSlug: () => 'beta',
    })).toBe('beta');
    expect(resolveSbtListItemSessionSlug({}, {
      allSessionsMode: false,
      listSlug: 'fallback',
    })).toBe('fallback');
  });

  it('reads SBT list storage and runtime settings defensively', () => {
    const storage = {
      getItem: jest.fn((key: string) => (
        key === SBT_LIST_MODE_SELECTION_STORAGE_KEY
          ? JSON.stringify(['Alpha', 'alpha', 'General', '', null])
          : null
      )),
    };

    expect(readStoredSbtListModeSelectedSessionSlugs(storage)).toEqual(['Alpha', 'alpha', '']);
    expect(readStoredSbtListModeSelectedSessionSlugs({ getItem: () => '{bad' })).toEqual([]);
    expect(readStoredSbtListModeSelectedSessionSlugs(null)).toEqual([]);
    expect(resolveSbtListCreateGroupInitialVisibility({
      hasCachedCreateSbtForm: jest.fn(() => true),
      listSlug: ' Alpha ',
    })).toBe(true);
    const hasCachedCreateSbtForm = jest.fn(() => false);
    expect(resolveSbtListCreateGroupInitialVisibility({
      hasCachedCreateSbtForm,
      listSlug: ' General ',
    })).toBe(false);
    expect(hasCachedCreateSbtForm).toHaveBeenCalledWith({
      sessionSlug: '',
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    });
    expect(readSbtListUniverseCollapsedState({ getItem: () => 'true' })).toBe(true);
    expect(readSbtListUniverseCollapsedState({ getItem: () => 'false' })).toBe(false);
    expect(readSbtListUniverseCollapsedState({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
    expect(isSbtListManagedDgCacheName('sbtCache')).toBe(true);
    expect(isSbtListManagedDgCacheName('customCache')).toBe(false);
    expect(readSbtListShowDemoSessions({ SHOW_DEMO_SESSIONS: 0 }, true)).toBe(false);
    expect(readSbtListShowDemoSessions({}, true)).toBe(true);
    expect(readSbtListSyncBarResearchBlockStep({ CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP: '12.8' }, 4)).toBe(12);
    expect(readSbtListSyncBarResearchBlockStep({ CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP: 'bad' }, '7.9')).toBe(7);
    expect(readSbtListSyncBarResearchBlockStep({}, 0)).toBe(50);
    expect(buildSbtListLoadingGroupStatusClassName({
      activeClassName: 'status-active',
      baseClassName: 'status',
      pendingClassName: 'status-pending',
      scanInProgress: true,
    })).toBe('status status-active');
    expect(buildSbtListLoadingProgressFillClassName({
      baseClassName: 'fill',
      hasLatest: false,
      indeterminateClassName: 'indeterminate',
    })).toBe('fill indeterminate');
    expect(resolveSbtListLoadingProgressFillStyle({
      hasLatest: true,
      progressPct: 42,
    })).toEqual({ width: '42%' });
    expect(resolveSbtListLoadingProgressFillStyle({
      hasLatest: false,
      progressPct: 42,
    })).toEqual({ width: undefined });
    expect(resolveSbtListRelativeImageStyle()).toEqual({ position: 'relative' });
    expect(resolveSbtListHeaderSpinnerWrapStyle()).toEqual({
      alignItems: 'center',
      display: 'flex',
      gap: '6px',
    });
    expect(resolveSbtListHeaderBlocksLeftStyle()).toEqual({
      fontSize: '0.85rem',
      opacity: 0.85,
    });
    expect(buildSbtListSessionLoadingStatus({
      allSessionsMode: true,
      formatBlockCount: (value) => `#${value}`,
      snapshot: {
        cfg: { sessionName: 'Alpha' },
        displayCurrentBlock: 1050,
        hasCache: true,
        hasLatest: true,
        lastBlock: 1040,
        latestForGroup: 1100,
        remainingBlocks: 50,
        scanInProgress: true,
        slug: 'alpha',
        startBlock: 1000,
      },
    })).toEqual(expect.objectContaining({
      chipBlockProgressText: '#1050 / #1100',
      chipRemainingText: '#50 remaining',
      displayName: 'Alpha',
      progressPct: 50,
      progressText: 'Remaining Blocks: #50 (Current: #1050 / Latest: #1100)',
      statusLabel: 'Scanning',
    }));
    expect(buildSbtListSessionLoadingStatus({
      allSessionsMode: true,
      loading: false,
      snapshot: {
        cfg: { sessionName: 'Alpha' },
        displayCurrentBlock: 1100,
        hasCache: true,
        hasLatest: true,
        latestForGroup: 1100,
        remainingBlocks: 0,
        slug: 'alpha',
        startBlock: 1000,
      },
    })).toBeNull();
    expect(buildSbtListSessionLoadingStatus({
      alwaysShow: true,
      snapshot: {
        cfg: { sessionName: 'General' },
        displayCurrentBlock: 0,
        hasLatest: false,
        slug: '',
      },
    })).toEqual(expect.objectContaining({
      chipRemainingText: 'Syncing',
      displayName: 'General',
      slugLabel: 'general',
      statusLabel: 'Loading',
    }));
    expect(buildSbtListExpandedCardShellClassName({
      baseClassName: 'card',
      expandedClassName: 'card-expanded',
      isExpanded: true,
    })).toBe('card card-expanded');
    expect(buildSbtListExpandedCardShellClassName({
      baseClassName: 'card',
      expandedClassName: 'card-expanded',
      isExpanded: false,
    })).toBe('card');
    expect(buildSbtListRootClassName({
      baseClassName: 'base',
      rootClassName: 'root',
    })).toBe('base root');
    expect(buildSbtListSessionUniversePanelClassName({
      baseClassName: 'panel',
      closedClassName: 'panel-closed',
      isClosed: true,
    })).toBe('panel panel-closed');
    expect(buildSbtListMiniSettingsButtonClassName({
      activeClassName: 'settings-active',
      baseClassName: 'settings',
      isActive: true,
    })).toBe('settings settings-active');
    expect(buildSbtListFilterContainerClassName({
      baseClassName: 'filters',
      panelClassName: 'filters-panel',
    })).toBe('filters filters-panel');
    expect(buildSbtListFilterLabelClassName({
      activeClassName: 'filter-active',
      baseClassName: 'filter',
      isActive: true,
      toggleClassName: 'filter-toggle',
    })).toBe('filter filter-toggle filter-active');
  });

  it('normalizes visible session universe slugs while hiding id-like entries', () => {
    expect(getVisibleSbtListSessionSlugsFromEntries([
      ['Alpha', { slug: 'Alpha' }],
      ['alpha', { slug: 'alpha' }],
      ['General', { slug: 'General' }],
      ['11111111-1111-4111-8111-111111111111', { slug: '11111111-1111-4111-8111-111111111111' }],
    ])).toEqual(['Alpha', 'alpha', '']);
  });

  it('dedupes, picks, and sorts normalized session slugs', () => {
    expect(dedupeNormalizedSbtListSlugs([
      'Alpha',
      'alpha',
      'General',
      '11111111111111111111111111111111',
      'Beta',
    ])).toEqual(['Alpha', 'alpha', '', 'Beta']);
    expect(pickNormalizedSbtListSessionSlug(null, undefined, 'General', 'Alpha')).toBe('');
    expect(sortSbtListSlugsByUniverseOrder(['gamma', 'beta', 'alpha'], ['alpha', 'beta'])).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(resolveSbtListSectionSessionSlugs({
      allSessionsMode: false,
      listSlug: ' General ',
      selectedSessionUniverseSlugs: ['alpha'],
    })).toEqual(['']);
    expect(resolveSbtListSectionSessionSlugs({
      allSessionsMode: true,
      isListModeScopeEnabled: true,
      listSlug: 'beta',
      selectedSessionUniverseSlugs: ['alpha', 'beta'],
    })).toEqual(['alpha', 'beta']);
    expect(resolveSbtListSectionSessionSlugs({
      allSessionsMode: true,
      isListModeScopeEnabled: false,
      listSlug: ' Beta ',
      selectedSessionUniverseSlugs: ['alpha'],
    })).toEqual(['Beta']);
    expect(resolveSbtListActionableSessionSlugs([
      'alpha',
      SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
      'Alpha',
      'General',
    ])).toEqual(['alpha', 'Alpha', '']);
    const previousUniverseSnapshot = {
      fallbackEntryCount: 2,
      registryEntryCount: 1,
      registryHydrated: true,
      slugs: ['alpha', 'beta'],
    };
    expect(resolveSbtListSessionUniverseSnapshotUpdate({
      nextSnapshot: {
        fallbackEntryCount: 2,
        registryEntryCount: 1,
        registryHydrated: true,
        slugs: ['alpha', 'beta'],
      },
      previousSnapshot: previousUniverseSnapshot,
    })).toBe(previousUniverseSnapshot);
    const changedUniverseSnapshot = {
      fallbackEntryCount: 2,
      registryEntryCount: 1,
      registryHydrated: true,
      slugs: ['beta', 'alpha'],
    };
    expect(resolveSbtListSessionUniverseSnapshotUpdate({
      nextSnapshot: changedUniverseSnapshot,
      previousSnapshot: previousUniverseSnapshot,
    })).toBe(changedUniverseSnapshot);
    expect(resolveSbtListSessionUniverseSnapshotUpdate({
      nextSnapshot: { registryHydrated: true, slugs: [] },
      previousSnapshot: { registryHydrated: false, slugs: [] },
    })).toEqual({ registryHydrated: true, slugs: [] });
    expect(resolveSbtListDefaultSelectedSessionSlugs({
      displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      isListModeScopeEnabled: false,
      listModeConfiguredSessionSlugs: ['beta'],
    })).toEqual([]);
    expect(resolveSbtListDefaultSelectedSessionSlugs({
      displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      isListModeScopeEnabled: true,
      listModeConfiguredSessionSlugs: ['gamma', 'beta'],
    })).toEqual(['beta']);
    expect(resolveSbtListDefaultSelectedSessionSlugs({
      displayedSessionUniverseSlugs: ['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      isListModeScopeEnabled: true,
      listModeConfiguredSessionSlugs: [],
    })).toEqual(['alpha']);
    expect(resolveSbtListDefaultSelectedSessionSlugs({
      displayedSessionUniverseSlugs: [SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      isListModeScopeEnabled: true,
      listModeConfiguredSessionSlugs: [],
    })).toEqual([SBT_LIST_NO_SESSION_UNIVERSE_SLUG]);
    expect(resolveSbtListDisplayedSessionUniverseSlugs({
      availableSessionSlugs: ['alpha', 'beta'],
      baseSessionUniverseSlugs: ['gamma'],
      hiddenRegistrySessionSlugs: ['delta'],
      isListModeScopeEnabled: false,
      selectedHiddenRegistrySessionSlugs: ['delta'],
      showMoreSessions: true,
    })).toEqual(['alpha', 'beta']);
    expect(resolveSbtListDisplayedSessionUniverseSlugs({
      baseSessionUniverseSlugs: ['alpha'],
      hiddenRegistrySessionSlugs: ['beta', 'gamma'],
      isListModeScopeEnabled: true,
      selectedHiddenRegistrySessionSlugs: ['gamma'],
      showMoreSessions: false,
    })).toEqual(['alpha', 'gamma']);
    expect(resolveSbtListDisplayedSessionUniverseSlugs({
      baseSessionUniverseSlugs: ['alpha'],
      hiddenRegistrySessionSlugs: ['beta', 'gamma'],
      isListModeScopeEnabled: true,
      selectedHiddenRegistrySessionSlugs: ['gamma'],
      showMoreSessions: true,
    })).toEqual(['alpha', 'beta', 'gamma']);
    expect(resolveSbtListDisplayedSessionUniverseSlugs({
      allSessionsMode: true,
      baseSessionUniverseSlugs: ['alpha'],
      hasNoSessionUniverseItems: true,
      isListModeScopeEnabled: true,
    })).toEqual(['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG]);
    expect(resolveSbtListHiddenRegistrySessionSlugs({
      availableSessionSlugs: ['alpha', 'beta', 'General'],
      baseSessionUniverseSlugs: ['alpha', 'General'],
      isListModeScopeEnabled: false,
      registrySessionUniverseSlugs: ['gamma'],
    })).toEqual([]);
    expect(resolveSbtListHiddenRegistrySessionSlugs({
      availableSessionSlugs: ['alpha', 'beta', 'General'],
      baseSessionUniverseSlugs: ['alpha', 'General'],
      isListModeScopeEnabled: true,
      registrySessionUniverseSlugs: ['gamma', 'beta'],
    })).toEqual(['beta', 'gamma']);
    expect(resolveSbtListSelectedHiddenRegistrySessionSlugs({
      hiddenRegistrySessionSlugs: ['beta', 'General'],
      isListModeScopeEnabled: true,
      selectedSessionSlugs: ['alpha', 'General', 'beta'],
    })).toEqual(['', 'beta']);
    expect(resolveSbtListRemainingHiddenRegistrySessionSlugs({
      hiddenRegistrySessionSlugs: ['beta', 'gamma', 'General'],
      isListModeScopeEnabled: true,
      selectedHiddenRegistrySessionSlugs: ['gamma', 'General'],
    })).toEqual(['beta']);
    const unchangedSelection = ['alpha', 'alpha', 'beta'];
    expect(resolveSbtListClampedSelectedSessionSlugs({
      availableSessionSlugs: ['beta'],
      displayedSessionUniverseSlugs: ['alpha'],
      selectedSessionSlugs: unchangedSelection,
    })).toBe(unchangedSelection);
    expect(resolveSbtListClampedSelectedSessionSlugs({
      displayedSessionUniverseSlugs: ['alpha', 'General'],
      hiddenRegistrySessionSlugs: ['beta'],
      selectedSessionSlugs: ['alpha', 'gamma', 'General', 'beta'],
    })).toEqual(['alpha', '', 'beta']);
    expect(resolveSbtListChipSelectedSessionSlugs({
      defaultListModeSelectedSessionSlugs: ['alpha'],
      displayedSessionUniverseSlugs: ['beta', 'alpha'],
      selectedSessionSlugs: ['alpha'],
      selectedSlug: 'beta',
      wasSelected: false,
    })).toEqual(['beta', 'alpha']);
    expect(resolveSbtListChipSelectedSessionSlugs({
      displayedSessionUniverseSlugs: ['alpha', 'beta'],
      selectedSessionSlugs: ['alpha', 'beta'],
      selectedSlug: 'beta',
      wasSelected: true,
    })).toEqual(['alpha']);
    expect(resolveSbtListChipSelectedSessionSlugs({
      displayedSessionUniverseSlugs: ['alpha'],
      selectedSessionSlugs: ['alpha'],
      selectedSlug: 'alpha',
      wasSelected: true,
    })).toEqual(['alpha']);
    expect(resolveSbtListChipSelectedSessionSlugs({
      defaultListModeSelectedSessionSlugs: ['alpha'],
      displayedSessionUniverseSlugs: ['alpha', 'beta'],
      selectedSessionSlugs: ['stale'],
      selectedSlug: 'beta',
      wasSelected: false,
    })).toEqual(['alpha', 'beta']);
    expect(resolveSbtListSelectedSessionUniverseSlugs({
      allSessionsMode: false,
      defaultListModeSelectedSessionSlugs: ['alpha'],
      displayedSessionUniverseSlugs: ['alpha'],
      isListModeScopeEnabled: true,
      selectedSessionSlugs: ['alpha'],
    })).toEqual([]);
    expect(resolveSbtListSelectedSessionUniverseSlugs({
      allSessionsMode: true,
      defaultListModeSelectedSessionSlugs: ['alpha'],
      displayedSessionUniverseSlugs: ['alpha', 'beta'],
      isListModeScopeEnabled: true,
      selectedSessionSlugs: ['gamma', 'beta'],
    })).toEqual(['beta']);
    expect(resolveSbtListSelectedSessionUniverseSlugs({
      allSessionsMode: true,
      defaultListModeSelectedSessionSlugs: ['alpha'],
      displayedSessionUniverseSlugs: ['alpha', 'beta'],
      isListModeScopeEnabled: true,
      selectedSessionSlugs: ['gamma'],
    })).toEqual(['alpha']);
  });

  it('compares string arrays and merges SBT lists by first address occurrence', () => {
    expect(areStringArraysEqual(['a', 2], ['a', '2'])).toBe(true);
    expect(areStringArraysEqual(['a'], ['a', 'b'])).toBe(false);
    expect(mergeSbtListsByAddress(
      [{ sbtAddress: '0xA', sbtInfo: { name: 'First' } }],
      [
        { sbtAddress: '0xa', sbtInfo: { name: 'Duplicate' } },
        { sbtAddress: '0xB', sbtInfo: { name: 'Second' } },
      ],
      [null]
    )).toEqual([
      { sbtAddress: '0xA', sbtInfo: { name: 'First' } },
      { sbtAddress: '0xB', sbtInfo: { name: 'Second' } },
    ]);
  });

  it('collects card tags and document URLs from metadata variants', () => {
    expect(collectSbtTagValues(
      ['Builder', { label: 'builder' }],
      'Research, Ops',
      [{ name: 'Signal' }]
    )).toEqual(['Builder', 'Research', 'Ops', 'Signal']);
    expect(collectSbtDocumentUrls(
      [{ href: 'ipfs://bafy-doc' }],
      { docUrl: 'ar://abc123' },
      'https://example.com/readme',
      { url: 'https://example.com/readme' }
    )).toEqual([
      'ipfs://bafy-doc',
      'ar://abc123',
      'https://example.com/readme',
    ]);
  });

  it('normalizes SBT card detail links without hydrating token metadata', () => {
    const details = getSbtCardDetails({
      tags: ['Builder', { label: 'builder' }],
      documentUrls: [
        { href: 'ipfs://bafy-doc' },
        { value: 'https://example.com/readme' },
      ],
      sbtInfo: {
        featuredSbtTags: [{ value: 'Signal' }],
        documents: [{ docUrl: 'ar://abc123' }],
      },
    });

    expect(normalizeSbtListTokenUri('ipfs://bafy-image')).toBe('https://ipfs.io/ipfs/bafy-image');
    expect(details.tags).toEqual(['Builder', 'Signal']);
    expect(details.documentUrls).toEqual([
      { href: 'ar://abc123', label: 'ar://abc123' },
      { href: 'https://ipfs.io/ipfs/bafy-doc', label: 'ipfs://bafy-doc' },
      { href: 'https://example.com/readme', label: 'https://example.com/readme' },
    ]);
    expect(details.hasDetails).toBe(true);
  });

  it('normalizes render addresses and keys by display scope', () => {
    const sbt = { sbtAddress: ' 0xABC ', slug: 'alpha' };

    expect(normalizeSbtListAddressLower(sbt.sbtAddress)).toBe('0xabc');
    expect(Array.from(lowerSbtListAddressSet([' 0xABC ', '', null, '0xdef']))).toEqual([
      '0xabc',
      '0xdef',
    ]);
    expect(Array.from(buildSbtListExpandedAddressSetToggle(new Set(['0xabc']), ' 0xABC '))).toEqual([]);
    expect(Array.from(buildSbtListExpandedAddressSetToggle(new Set(['0xabc']), ' 0xDEF '))).toEqual([
      '0xabc',
      '0xdef',
    ]);
    expect(Array.from(buildSbtListExpandedAddressSetToggle('bad', ''))).toEqual([]);
    expect(buildSbtListRenderItemKey(sbt, {
      allSessionsMode: false,
      listSlug: 'alpha',
      resolveSbtSessionSlug: () => 'beta',
    })).toBe('alpha|0xabc');
    expect(buildSbtListRenderItemKey(sbt, {
      allSessionsMode: true,
      listSlug: 'alpha',
      resolveSbtSessionSlug: (item) => item.slug,
    })).toBe('alpha|0xabc');
  });

  it('builds SBT detail hrefs and detects modified pointer navigation', () => {
    expect(buildSbtListDetailHref('0xABC', 'alpha')).toMatch(
      /^\/(?:group|sbt)\/0xABC\?session=alpha$/
    );
    expect(buildSbtListDetailHref('0xABC', SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toMatch(
      /^\/(?:group|sbt)\/0xABC$/
    );
    expect(buildSbtListDetailHref('', 'alpha')).toBe('#');

    expect(isModifiedSbtListPointerNavigation({ metaKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ ctrlKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ shiftKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ altKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ button: 1 })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ button: 0 })).toBe(false);
    expect(isModifiedSbtListPointerNavigation(null)).toBe(false);
  });

  it('builds interactive mini-card models from SBT list items', () => {
    expect(buildSbtListInteractiveMiniCardModel({
      keyPrefix: 'featured-mini',
      resolveSbtSessionSlug: (sbt) => sbt.slug,
      sbt: {
        sbtAddress: ' 0xABC ',
        slug: 'alpha',
      },
    })).toEqual({
      key: 'featured-mini-alpha|0xabc',
      sbtAddress: '0xABC',
      sbtAddressLower: '0xabc',
      sessionSlug: 'alpha',
    });
    expect(buildSbtListInteractiveMiniCardModel({
      resolveSbtSessionSlug: () => 'alpha',
      sbt: {
        sbtAddress: '',
      },
    })).toBeNull();
    expect(buildSbtListInteractiveMiniCardModel({
      resolveSbtSessionSlug: () => 'alpha',
      sbt: null,
    })).toBeNull();
  });

  it('builds display card models with explicit address handling', () => {
    const baseOptions = {
      getDescriptionText: (sbtInfo: any) => sbtInfo.description || '',
      getDisplayName: (sbtInfo: any) => sbtInfo.name,
      isPasswordLocked: (sbt: any) => sbt.locked,
      resolveSbtSessionSlug: (sbt: any) => sbt.slug,
      sbt: {
        locked: true,
        sbtAddress: ' 0xABC ',
        sbtInfo: {
          description: 'Builder access',
          image: 'ipfs://bafy-image',
          name: '',
        },
        slug: 'alpha',
      },
      unnamedLabel: 'Badge',
    };

    expect(buildSbtListDisplayCardModel(baseOptions)).toEqual({
      description: 'Builder access',
      imageSrc: 'https://ipfs.io/ipfs/bafy-image',
      key: 'sbt-alpha|0xabc',
      locked: true,
      name: 'Unnamed Badge',
      sbtAddress: '0xABC',
      sbtAddressLower: '0xabc',
      sessionSlug: 'alpha',
    });
    expect(buildSbtListDisplayCardModel({
      ...baseOptions,
      addressMode: 'raw',
      keyPrefix: 'compact',
    })).toEqual(expect.objectContaining({
      key: 'compact-alpha| 0xabc ',
      sbtAddress: ' 0xABC ',
      sbtAddressLower: ' 0xabc ',
    }));
    expect(buildSbtListDisplayCardModel({
      ...baseOptions,
      sbt: { sbtAddress: '0xABC' },
    })).toBeNull();
  });

  it('builds meta row models for tag and details controls', () => {
    expect(buildSbtListMetaRowModel({
      details: {
        documentUrls: [{ href: 'https://example.com/doc', label: 'https://example.com/doc' }],
        hasDetails: true,
        tags: ['Builder'],
      },
      expandedSbtAddresses: new Set([' 0xabc ']),
      sbt: { sbtAddress: ' 0xABC ' },
    })).toEqual({
      hasDetailsToggle: true,
      hasTags: true,
      isExpanded: true,
      sbtAddressLower: ' 0xabc ',
      tags: ['Builder'],
    });
    expect(buildSbtListMetaRowModel({
      details: {
        documentUrls: [{ href: 'https://example.com/doc', label: 'https://example.com/doc' }],
        hasDetails: true,
        tags: [],
      },
      miniaturized: true,
      sbt: { sbtAddress: '0xABC' },
    })).toBeNull();
    expect(buildSbtListMetaRowModel({
      details: {
        documentUrls: [],
        hasDetails: false,
        tags: ['Research'],
      },
      miniaturized: true,
      sbt: { sbtAddress: '0xABC' },
    })).toEqual(expect.objectContaining({
      hasDetailsToggle: false,
      hasTags: true,
      tags: ['Research'],
    }));
  });

  it('builds featured card models from display state', () => {
    expect(buildSbtListFeaturedCardModel({
      expandedSbtAddresses: new Set(['0xabc']),
      fallbackLabel: 'Credential',
      getDisplayName: (sbtInfo: any) => sbtInfo?.name,
      resolveSbtSessionSlug: (sbt: any) => sbt.slug,
      sbt: {
        sbtAddress: ' 0xABC ',
        sbtInfo: { name: '' },
        slug: 'alpha',
      },
    })).toEqual({
      detailsId: 'featured-sbt-details-0xabc',
      isExpanded: true,
      linkLabel: '0xABC',
      sbtAddress: '0xABC',
      sbtAddressLower: '0xabc',
      sessionSlug: 'alpha',
    });
    expect(buildSbtListFeaturedCardModel({
      fallbackLabel: 'Credential',
      getDisplayName: () => 'Named credential',
      resolveSbtSessionSlug: () => '',
      sbt: { sbtAddress: '0xDEF' },
    })).toEqual(expect.objectContaining({
      isExpanded: false,
      linkLabel: 'Named credential',
      sbtAddressLower: '0xdef',
      sessionSlug: '',
    }));
    expect(buildSbtListFeaturedCardModel({
      getDisplayName: () => '',
      resolveSbtSessionSlug: () => 'alpha',
      sbt: null,
    })).toBeNull();
  });

  it('coerces mint end timestamps to seconds', () => {
    expect(coerceSbtMintEndSeconds('1700000000')).toBe(1700000000);
    expect(coerceSbtMintEndSeconds(1700000000000)).toBe(1700000000);
    expect(coerceSbtMintEndSeconds(-1)).toBe(0);
    expect(coerceSbtMintEndSeconds('bad')).toBe(0);
  });

  it('builds render buckets with featured, ignored, and synthetic no-session handling', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000f1';
    const ignoredAddress = '0x00000000000000000000000000000000000000d1';
    const hiddenAddress = '0x00000000000000000000000000000000000000b1';
    const getSessionListsForSlug = jest.fn(() => ({
      featured_SBTs_LIST: [featuredAddress],
      ignored_SBTs_LIST: [ignoredAddress],
    }));

    expect(isSbtListSyntheticNoSessionSlug(SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toBe(true);
    expect(buildSbtListRenderBuckets({
      allSessionsMode: true,
      excludePasswordLocked: false,
      getSessionListsForSlug,
      isListModeScopeEnabled: true,
      isMintingLive: (sbt) => sbt.sbtInfo?.mintingEndTime === 0,
      isPasswordLocked: () => false,
      listSlug: 'alpha',
      resolveSbtSessionSlug: (sbt) => String(sbt.slug || ''),
      sbtList: [
        { sbtAddress: featuredAddress, slug: 'alpha', sbtInfo: { name: 'Featured', mintingEndTime: 0 } },
        { sbtAddress: ignoredAddress, slug: 'alpha', sbtInfo: { name: 'Ignored', mintingEndTime: 0 } },
        { sbtAddress: hiddenAddress, slug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG, sbtInfo: { name: 'Hidden', mintingEndTime: 1 } },
      ],
      sectionSessionSlugs: ['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
    }).displayedFeatured.map((sbt) => sbt.sbtAddress)).toEqual([featuredAddress]);
    expect(getSessionListsForSlug).not.toHaveBeenCalledWith(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
  });

  it('computes net holder counts from summaries before address lists', () => {
    expect(getSbtListNetHolderCount({
      historySummary: { currentHolderCount: '4.9' },
      mintedAddresses: ['0x1'],
      burnedAddresses: [],
    })).toBe(4);
    expect(getSbtListNetHolderCount({
      mintedAddresses: ['0x1', '0x2'],
      burnedAddresses: ['0x1'],
    })).toBe(1);
    expect(getSbtListNetHolderCount({
      mintedAddresses: ['0x1'],
      burnedAddresses: ['0x1', '0x2'],
    })).toBe(0);
  });

  it('normalizes SBT list items by valid shape, net holders, and address', () => {
    expect(normalizeSbtListItems([
      { sbtAddress: '0xB', sbtInfo: { name: 'Beta' }, mintedAddresses: ['0x1'] },
      { sbtAddress: '0xA', sbtInfo: { name: 'Alpha' }, mintedAddresses: ['0x1', '0x2'] },
      { sbtAddress: '0xC' },
      'bad',
    ])).toEqual([
      { sbtAddress: '0xA', sbtInfo: { name: 'Alpha' }, mintedAddresses: ['0x1', '0x2'] },
      { sbtAddress: '0xB', sbtInfo: { name: 'Beta' }, mintedAddresses: ['0x1'] },
    ]);
  });

  it('compares SBT list arrays by visible item signatures', () => {
    const first = [{
      sbtAddress: '0xA',
      blockNumber: 5,
      mintedAddresses: ['0x1'],
      burnedAddresses: [],
      sbtInfo: {
        name: 'Alpha',
        description: 'One',
        image: 'image-a',
      },
    }];
    const same = [{
      sbtAddress: '0xa',
      blockNumber: 5,
      mintedAddresses: ['0x1'],
      burnedAddresses: [],
      sbtInfo: {
        name: 'Alpha',
        description: 'One',
        image: 'image-a',
      },
    }];
    const changed = [{
      ...same[0],
      sbtInfo: {
        ...same[0].sbtInfo,
        image: 'image-b',
      },
    }];

    expect(getSbtListItemSignature(first[0])).toBe(getSbtListItemSignature(same[0]));
    expect(areSbtListArraysEqual(first, same)).toBe(true);
    expect(areSbtListArraysEqual(first, changed)).toBe(false);
    expect(areSbtListArraysEqual(first, [])).toBe(false);
  });
});
