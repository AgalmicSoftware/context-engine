import {
  areStringArraysEqual,
  dedupeNormalizedSbtListSlugs,
  getVisibleSbtListSessionSlugsFromEntries,
  isSbtListSessionIdLikeSlug,
  isSbtListSyntheticNoSessionSlug,
  mergeSbtListsByAddress,
  pickNormalizedSbtListSessionSlug,
  resolveSbtListActionableSessionSlugs,
  resolveSbtListChipSelectedSessionSlugs,
  resolveSbtListClampedSelectedSessionSlugs,
  resolveSbtListDefaultSelectedSessionSlugs,
  resolveSbtListDisplayedSessionUniverseSlugs,
  resolveSbtListHiddenRegistrySessionSlugs,
  resolveSbtListRemainingHiddenRegistrySessionSlugs,
  resolveSbtListSelectedHiddenRegistrySessionSlugs,
  resolveSbtListSelectedSessionUniverseSlugs,
  resolveSbtListSectionSessionSlugs,
  resolveSbtListSessionUniverseSnapshotUpdate,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
  sortSbtListSlugsByUniverseOrder,
} from './sbtListSessionUniverseHelpers';

describe('sbtListSessionUniverseHelpers', () => {
  it('detects session id shaped slugs before list display', () => {
    expect(isSbtListSessionIdLikeSlug('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isSbtListSessionIdLikeSlug('0x11111111111111111111111111111111')).toBe(true);
    expect(isSbtListSessionIdLikeSlug('11111111111111111111111111111111')).toBe(true);
    expect(isSbtListSessionIdLikeSlug('alpha')).toBe(false);
    expect(isSbtListSyntheticNoSessionSlug(SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toBe(true);
  });

  it('normalizes visible session universe slugs while hiding id-like entries', () => {
    expect(
      getVisibleSbtListSessionSlugsFromEntries([
        ['Alpha', { slug: 'Alpha' }],
        ['alpha', { slug: 'alpha' }],
        ['General', { slug: 'General' }],
        ['11111111-1111-4111-8111-111111111111', { slug: '11111111-1111-4111-8111-111111111111' }],
      ]),
    ).toEqual(['Alpha', 'alpha', '']);
  });

  it('dedupes, picks, and sorts normalized session slugs', () => {
    expect(
      dedupeNormalizedSbtListSlugs(['Alpha', 'alpha', 'General', '11111111111111111111111111111111', 'Beta']),
    ).toEqual(['Alpha', 'alpha', '', 'Beta']);
    expect(pickNormalizedSbtListSessionSlug(null, undefined, 'General', 'Alpha')).toBe('');
    expect(sortSbtListSlugsByUniverseOrder(['gamma', 'beta', 'alpha'], ['alpha', 'beta'])).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(
      resolveSbtListSectionSessionSlugs({
        allSessionsMode: false,
        listSlug: ' General ',
        selectedSessionUniverseSlugs: ['alpha'],
      }),
    ).toEqual(['']);
    expect(
      resolveSbtListSectionSessionSlugs({
        allSessionsMode: true,
        isListModeScopeEnabled: true,
        listSlug: 'beta',
        selectedSessionUniverseSlugs: ['alpha', 'beta'],
      }),
    ).toEqual(['alpha', 'beta']);
    expect(
      resolveSbtListSectionSessionSlugs({
        allSessionsMode: true,
        isListModeScopeEnabled: false,
        listSlug: ' Beta ',
        selectedSessionUniverseSlugs: ['alpha'],
      }),
    ).toEqual(['Beta']);
    expect(
      resolveSbtListActionableSessionSlugs(['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG, 'Alpha', 'General']),
    ).toEqual(['alpha', 'Alpha', '']);
    const previousUniverseSnapshot = {
      fallbackEntryCount: 2,
      registryEntryCount: 1,
      registryHydrated: true,
      slugs: ['alpha', 'beta'],
    };
    expect(
      resolveSbtListSessionUniverseSnapshotUpdate({
        nextSnapshot: {
          fallbackEntryCount: 2,
          registryEntryCount: 1,
          registryHydrated: true,
          slugs: ['alpha', 'beta'],
        },
        previousSnapshot: previousUniverseSnapshot,
      }),
    ).toBe(previousUniverseSnapshot);
    const changedUniverseSnapshot = {
      fallbackEntryCount: 2,
      registryEntryCount: 1,
      registryHydrated: true,
      slugs: ['beta', 'alpha'],
    };
    expect(
      resolveSbtListSessionUniverseSnapshotUpdate({
        nextSnapshot: changedUniverseSnapshot,
        previousSnapshot: previousUniverseSnapshot,
      }),
    ).toBe(changedUniverseSnapshot);
    expect(
      resolveSbtListSessionUniverseSnapshotUpdate({
        nextSnapshot: { registryHydrated: true, slugs: [] },
        previousSnapshot: { registryHydrated: false, slugs: [] },
      }),
    ).toEqual({ registryHydrated: true, slugs: [] });
    expect(
      resolveSbtListDefaultSelectedSessionSlugs({
        displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        isListModeScopeEnabled: false,
        listModeConfiguredSessionSlugs: ['beta'],
      }),
    ).toEqual([]);
    expect(
      resolveSbtListDefaultSelectedSessionSlugs({
        displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        isListModeScopeEnabled: true,
        listModeConfiguredSessionSlugs: ['gamma', 'beta'],
      }),
    ).toEqual(['beta']);
    expect(
      resolveSbtListDefaultSelectedSessionSlugs({
        displayedSessionUniverseSlugs: ['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        isListModeScopeEnabled: true,
        listModeConfiguredSessionSlugs: [],
      }),
    ).toEqual(['alpha']);
    expect(
      resolveSbtListDefaultSelectedSessionSlugs({
        displayedSessionUniverseSlugs: [SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        isListModeScopeEnabled: true,
        listModeConfiguredSessionSlugs: [],
      }),
    ).toEqual([SBT_LIST_NO_SESSION_UNIVERSE_SLUG]);
    expect(
      resolveSbtListDisplayedSessionUniverseSlugs({
        availableSessionSlugs: ['alpha', 'beta'],
        baseSessionUniverseSlugs: ['gamma'],
        hiddenRegistrySessionSlugs: ['delta'],
        isListModeScopeEnabled: false,
        selectedHiddenRegistrySessionSlugs: ['delta'],
        showMoreSessions: true,
      }),
    ).toEqual(['alpha', 'beta']);
    expect(
      resolveSbtListDisplayedSessionUniverseSlugs({
        baseSessionUniverseSlugs: ['alpha'],
        hiddenRegistrySessionSlugs: ['beta', 'gamma'],
        isListModeScopeEnabled: true,
        selectedHiddenRegistrySessionSlugs: ['gamma'],
        showMoreSessions: false,
      }),
    ).toEqual(['alpha', 'gamma']);
    expect(
      resolveSbtListDisplayedSessionUniverseSlugs({
        baseSessionUniverseSlugs: ['alpha'],
        hiddenRegistrySessionSlugs: ['beta', 'gamma'],
        isListModeScopeEnabled: true,
        selectedHiddenRegistrySessionSlugs: ['gamma'],
        showMoreSessions: true,
      }),
    ).toEqual(['alpha', 'beta', 'gamma']);
    expect(
      resolveSbtListDisplayedSessionUniverseSlugs({
        allSessionsMode: true,
        baseSessionUniverseSlugs: ['alpha'],
        hasNoSessionUniverseItems: true,
        isListModeScopeEnabled: true,
      }),
    ).toEqual(['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG]);
    expect(
      resolveSbtListHiddenRegistrySessionSlugs({
        availableSessionSlugs: ['alpha', 'beta', 'General'],
        baseSessionUniverseSlugs: ['alpha', 'General'],
        isListModeScopeEnabled: false,
        registrySessionUniverseSlugs: ['gamma'],
      }),
    ).toEqual([]);
    expect(
      resolveSbtListHiddenRegistrySessionSlugs({
        availableSessionSlugs: ['alpha', 'beta', 'General'],
        baseSessionUniverseSlugs: ['alpha', 'General'],
        isListModeScopeEnabled: true,
        registrySessionUniverseSlugs: ['gamma', 'beta'],
      }),
    ).toEqual(['beta', 'gamma']);
    expect(
      resolveSbtListSelectedHiddenRegistrySessionSlugs({
        hiddenRegistrySessionSlugs: ['beta', 'General'],
        isListModeScopeEnabled: true,
        selectedSessionSlugs: ['alpha', 'General', 'beta'],
      }),
    ).toEqual(['', 'beta']);
    expect(
      resolveSbtListRemainingHiddenRegistrySessionSlugs({
        hiddenRegistrySessionSlugs: ['beta', 'gamma', 'General'],
        isListModeScopeEnabled: true,
        selectedHiddenRegistrySessionSlugs: ['gamma', 'General'],
      }),
    ).toEqual(['beta']);
    const unchangedSelection = ['alpha', 'alpha', 'beta'];
    expect(
      resolveSbtListClampedSelectedSessionSlugs({
        availableSessionSlugs: ['beta'],
        displayedSessionUniverseSlugs: ['alpha'],
        selectedSessionSlugs: unchangedSelection,
      }),
    ).toBe(unchangedSelection);
    expect(
      resolveSbtListClampedSelectedSessionSlugs({
        displayedSessionUniverseSlugs: ['alpha', 'General'],
        hiddenRegistrySessionSlugs: ['beta'],
        selectedSessionSlugs: ['alpha', 'gamma', 'General', 'beta'],
      }),
    ).toEqual(['alpha', '', 'beta']);
    expect(
      resolveSbtListChipSelectedSessionSlugs({
        defaultListModeSelectedSessionSlugs: ['alpha'],
        displayedSessionUniverseSlugs: ['beta', 'alpha'],
        selectedSessionSlugs: ['alpha'],
        selectedSlug: 'beta',
        wasSelected: false,
      }),
    ).toEqual(['beta', 'alpha']);
    expect(
      resolveSbtListChipSelectedSessionSlugs({
        displayedSessionUniverseSlugs: ['alpha', 'beta'],
        selectedSessionSlugs: ['alpha', 'beta'],
        selectedSlug: 'beta',
        wasSelected: true,
      }),
    ).toEqual(['alpha']);
    expect(
      resolveSbtListChipSelectedSessionSlugs({
        displayedSessionUniverseSlugs: ['alpha'],
        selectedSessionSlugs: ['alpha'],
        selectedSlug: 'alpha',
        wasSelected: true,
      }),
    ).toEqual(['alpha']);
    expect(
      resolveSbtListChipSelectedSessionSlugs({
        defaultListModeSelectedSessionSlugs: ['alpha'],
        displayedSessionUniverseSlugs: ['alpha', 'beta'],
        selectedSessionSlugs: ['stale'],
        selectedSlug: 'beta',
        wasSelected: false,
      }),
    ).toEqual(['alpha', 'beta']);
    expect(
      resolveSbtListSelectedSessionUniverseSlugs({
        allSessionsMode: false,
        defaultListModeSelectedSessionSlugs: ['alpha'],
        displayedSessionUniverseSlugs: ['alpha'],
        isListModeScopeEnabled: true,
        selectedSessionSlugs: ['alpha'],
      }),
    ).toEqual([]);
    expect(
      resolveSbtListSelectedSessionUniverseSlugs({
        allSessionsMode: true,
        defaultListModeSelectedSessionSlugs: ['alpha'],
        displayedSessionUniverseSlugs: ['alpha', 'beta'],
        isListModeScopeEnabled: true,
        selectedSessionSlugs: ['gamma', 'beta'],
      }),
    ).toEqual(['beta']);
    expect(
      resolveSbtListSelectedSessionUniverseSlugs({
        allSessionsMode: true,
        defaultListModeSelectedSessionSlugs: ['alpha'],
        displayedSessionUniverseSlugs: ['alpha', 'beta'],
        isListModeScopeEnabled: true,
        selectedSessionSlugs: ['gamma'],
      }),
    ).toEqual(['alpha']);
  });

  it('compares string arrays and merges SBT lists by first address occurrence', () => {
    expect(areStringArraysEqual(['a', 2], ['a', '2'])).toBe(true);
    expect(areStringArraysEqual(['a'], ['a', 'b'])).toBe(false);
    expect(
      mergeSbtListsByAddress(
        [{ sbtAddress: '0xA', sbtInfo: { name: 'First' } }],
        [
          { sbtAddress: '0xa', sbtInfo: { name: 'Duplicate' } },
          { sbtAddress: '0xB', sbtInfo: { name: 'Second' } },
        ],
        [null],
      ),
    ).toEqual([
      { sbtAddress: '0xA', sbtInfo: { name: 'First' } },
      { sbtAddress: '0xB', sbtInfo: { name: 'Second' } },
    ]);
  });
});
