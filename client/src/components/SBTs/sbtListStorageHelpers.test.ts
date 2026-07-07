import {
  isSbtListManagedDgCacheName,
  readSbtListShowDemoSessions,
  readSbtListSyncBarResearchBlockStep,
  readSbtListUniverseCollapsedState,
  readStoredSbtListModeSelectedSessionSlugs,
  resolveSbtListCreateGroupInitialVisibility,
  resolveSbtListInitialActiveSessionSlug,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
} from './sbtListStorageHelpers';

describe('sbtListStorageHelpers', () => {
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
  });
});
