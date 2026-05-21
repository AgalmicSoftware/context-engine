import {
  buildSbtListDetailHref,
  buildSbtListExpandedCardShellClassName,
  buildSbtListFilterContainerClassName,
  buildSbtListFilterLabelClassName,
  buildSbtListLoadingGroupStatusClassName,
  buildSbtListLoadingProgressFillClassName,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRenderBuckets,
  buildSbtListRootClassName,
  buildSbtListSessionChipStateBySlug,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionProgressSnapshot,
  buildSbtListSessionUniversePanelClassName,
  dedupeNormalizedSbtListSlugs,
  getVisibleSbtListSessionSlugsFromEntries,
  getSbtListItemSignature,
  getSbtListNetHolderCount,
  hasSbtListAuthoritativeSessionSlug,
  hasSbtListExplicitNoSessionAssociation,
  hasSbtListMetadataSessionSlugField,
  hasSbtListMissingOrEmptySessionSlug,
  hasSbtListOwn,
  isSbtListManagedDgCacheName,
  isSbtListSessionIdLikeSlug,
  isSbtListSyntheticNoSessionSlug,
  mergeSbtListsByAddress,
  normalizeSbtListItems,
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
  resolveSbtListLoadingProgressFillStyle,
  resolveSbtListRelativeImageStyle,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
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
      getItem: jest.fn((key: string) =>
        key === SBT_LIST_MODE_SELECTION_STORAGE_KEY ? JSON.stringify(['Alpha', 'alpha', 'General', '', null]) : null,
      ),
    };

    expect(readStoredSbtListModeSelectedSessionSlugs(storage)).toEqual(['Alpha', 'alpha', '']);
    expect(readStoredSbtListModeSelectedSessionSlugs({ getItem: () => '{bad' })).toEqual([]);
    expect(readStoredSbtListModeSelectedSessionSlugs(null)).toEqual([]);
    expect(
      resolveSbtListCreateGroupInitialVisibility({
        hasCachedCreateSbtForm: jest.fn(() => true),
        listSlug: ' Alpha ',
      }),
    ).toBe(true);
    const hasCachedCreateSbtForm = jest.fn(() => false);
    expect(
      resolveSbtListCreateGroupInitialVisibility({
        hasCachedCreateSbtForm,
        listSlug: ' General ',
      }),
    ).toBe(false);
    expect(hasCachedCreateSbtForm).toHaveBeenCalledWith({
      sessionSlug: '',
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    });
    expect(readSbtListUniverseCollapsedState({ getItem: () => 'true' })).toBe(true);
    expect(readSbtListUniverseCollapsedState({ getItem: () => 'false' })).toBe(false);
    expect(
      readSbtListUniverseCollapsedState({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe(false);
    expect(isSbtListManagedDgCacheName('sbtCache')).toBe(true);
    expect(isSbtListManagedDgCacheName('customCache')).toBe(false);
    expect(readSbtListShowDemoSessions({ SHOW_DEMO_SESSIONS: 0 }, true)).toBe(false);
    expect(readSbtListShowDemoSessions({}, true)).toBe(true);
    expect(readSbtListSyncBarResearchBlockStep({ CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP: '12.8' }, 4)).toBe(12);
    expect(readSbtListSyncBarResearchBlockStep({ CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP: 'bad' }, '7.9')).toBe(7);
    expect(readSbtListSyncBarResearchBlockStep({}, 0)).toBe(50);
    expect(
      buildSbtListLoadingGroupStatusClassName({
        activeClassName: 'status-active',
        baseClassName: 'status',
        pendingClassName: 'status-pending',
        scanInProgress: true,
      }),
    ).toBe('status status-active');
    expect(
      buildSbtListLoadingProgressFillClassName({
        baseClassName: 'fill',
        hasLatest: false,
        indeterminateClassName: 'indeterminate',
      }),
    ).toBe('fill indeterminate');
    expect(
      resolveSbtListLoadingProgressFillStyle({
        hasLatest: true,
        progressPct: 42,
      }),
    ).toEqual({ width: '42%' });
    expect(
      resolveSbtListLoadingProgressFillStyle({
        hasLatest: false,
        progressPct: 42,
      }),
    ).toEqual({ width: undefined });
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
    expect(buildSbtListSessionChipStateBySlug({
      allSessionsMode: true,
      displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      getSessionProgressSnapshot: (slug) => (
        slug === 'alpha' ? { scanInProgress: true } : null
      ),
      hasNoSessionCards: false,
      readSbtCacheMeta: (slug) => (slug === 'beta' ? { lastBlock: 200 } : null),
      refreshing: false,
      sbtListBySlug: {
        beta: [{ sbtAddress: '0x2222222222222222222222222222222222222222' }],
      },
      sessionHasLoadedOnceBySlug: {
        alpha: true,
        beta: true,
      },
      sessionLoadStateBySlug: {
        alpha: 'loaded',
        beta: 'idle',
      },
    })).toEqual({
      alpha: {
        hasCards: false,
        hasLoadedOnce: true,
        isLoaded: false,
        isLoading: true,
      },
      beta: {
        hasCards: true,
        hasLoadedOnce: true,
        isLoaded: true,
        isLoading: false,
      },
      [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: {
        hasCards: false,
        hasLoadedOnce: true,
        isLoaded: true,
        isLoading: false,
      },
    });
    expect(buildSbtListSessionProgressSnapshot({
      allSessionsMode: true,
      bridgeMs: 2500,
      bridgeTailBlocks: 5,
      bridgedLiveProgress: {
        currentBlock: 198,
        latestBlock: 200,
        updatedAtMs: 1000,
      },
      cacheMeta: {
        lastBlock: 150,
        sbtCount: 3,
      },
      cfg: {
        blockLimits: { start: 100 },
      },
      recentLiveProgressNowMs: 1200,
      slug: 'alpha',
    })).toEqual(expect.objectContaining({
      displayCurrentBlock: 198,
      hasCache: true,
      hasLatest: true,
      latestForGroup: 200,
      liveCurrentBlock: 198,
      remainingBlocks: 2,
      scanInProgress: false,
    }));
    expect(buildSbtListSessionProgressSnapshot({
      allSessionsMode: true,
      bridgeMs: 2500,
      bridgeTailBlocks: 5,
      bridgedLiveProgress: {
        currentBlock: 198,
        latestBlock: 220,
        updatedAtMs: 1000,
      },
      cacheMeta: {
        lastBlock: 220,
        sbtCount: 3,
      },
      cfg: {
        blockLimits: { start: 100 },
      },
      latestBlock: 220,
      recentLiveProgressNowMs: 4000,
      scanInProgressRaw: true,
      deferredRaw: true,
      slug: 'alpha',
    })).toEqual(expect.objectContaining({
      displayCurrentBlock: 220,
      liveProgress: null,
      remainingBlocks: 0,
      scanInProgress: false,
      deferred: false,
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

  it('builds SBT detail hrefs', () => {
    expect(buildSbtListDetailHref('0xABC', 'alpha')).toMatch(
      /^\/(?:group|sbt)\/0xABC\?session=alpha$/
    );
    expect(buildSbtListDetailHref('0xABC', SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toMatch(
      /^\/(?:group|sbt)\/0xABC$/
    );
    expect(buildSbtListDetailHref('', 'alpha')).toBe('#');
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
