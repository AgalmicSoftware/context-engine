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
  buildSbtListSessionUniversePanelClassName,
  isSbtListManagedDgCacheName,
  readSbtListShowDemoSessions,
  readSbtListUniverseCollapsedState,
  readSbtListSyncBarResearchBlockStep,
  readStoredSbtListModeSelectedSessionSlugs,
  resolveSbtListCreateGroupInitialVisibility,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListLoadingProgressFillStyle,
  resolveSbtListRelativeImageStyle,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
} from './sbtListHelpers';

describe('sbtListHelpers', () => {
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
    expect(
      buildSbtListExpandedCardShellClassName({
        baseClassName: 'card',
        expandedClassName: 'card-expanded',
        isExpanded: true,
      }),
    ).toBe('card card-expanded');
    expect(
      buildSbtListExpandedCardShellClassName({
        baseClassName: 'card',
        expandedClassName: 'card-expanded',
        isExpanded: false,
      }),
    ).toBe('card');
    expect(
      buildSbtListRootClassName({
        baseClassName: 'base',
        rootClassName: 'root',
      }),
    ).toBe('base root');
    expect(
      buildSbtListSessionUniversePanelClassName({
        baseClassName: 'panel',
        closedClassName: 'panel-closed',
        isClosed: true,
      }),
    ).toBe('panel panel-closed');
    expect(
      buildSbtListMiniSettingsButtonClassName({
        activeClassName: 'settings-active',
        baseClassName: 'settings',
        isActive: true,
      }),
    ).toBe('settings settings-active');
    expect(
      buildSbtListFilterContainerClassName({
        baseClassName: 'filters',
        panelClassName: 'filters-panel',
      }),
    ).toBe('filters filters-panel');
    expect(
      buildSbtListFilterLabelClassName({
        activeClassName: 'filter-active',
        baseClassName: 'filter',
        isActive: true,
        toggleClassName: 'filter-toggle',
      }),
    ).toBe('filter filter-toggle filter-active');
  });

  it('builds SBT detail hrefs', () => {
    expect(buildSbtListDetailHref('0xABC', 'alpha')).toMatch(/^\/(?:group|sbt)\/0xABC\?session=alpha$/);
    expect(buildSbtListDetailHref('0xABC', SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toMatch(/^\/(?:group|sbt)\/0xABC$/);
    expect(buildSbtListDetailHref('', 'alpha')).toBe('#');
  });
});
