import {
  applyUserPageBookmarkNicknameSave,
  applyUserPageBookmarkToggle,
  buildUserPageBookmarkStatusStateUpdate,
  buildUserPageBookmarkToggleStatePatch,
  normalizeUserPageBookmarksCache,
  resolveUserPageBookmarkButtonDisplayState,
  resolveUserPageBookmarkNickname,
  resolveUserPageBookmarkStatus,
} from './userPageBookmarkHelpers';

describe('userPageBookmarkHelpers', () => {
  const address = '0x00000000000000000000000000000000000000aa';
  const addressUpper = address.toUpperCase();

  it('normalizes bookmark caches and resolves mixed user bookmark entries', () => {
    const cache = normalizeUserPageBookmarksCache({
      surveys: [{ id: 'survey-a' }],
      users: [
        addressUpper,
        { address: '0x00000000000000000000000000000000000000bb', nickname: 'Beta' },
      ],
      filters: 'invalid',
    });

    expect(cache.surveys).toEqual([{ id: 'survey-a' }]);
    expect(cache.questions).toEqual([]);
    expect(cache.users).toHaveLength(2);
    expect(cache.filters).toEqual([]);
    expect(resolveUserPageBookmarkStatus({ address, users: cache.users })).toEqual({
      bookmarked: true,
      nickname: null,
    });
  });

  it('resolves object bookmark nicknames with optional trimming', () => {
    const users = [{ address: addressUpper, nickname: '  Alpha  ' }];

    expect(resolveUserPageBookmarkNickname({ address, users })).toBe('  Alpha  ');
    expect(resolveUserPageBookmarkNickname({ address, users, trim: true })).toBe('Alpha');
    expect(resolveUserPageBookmarkNickname({ address: '', users })).toBe('');
  });

  it('saves bookmark nicknames without dropping bookmark status', () => {
    const result = applyUserPageBookmarkNicknameSave({
      address,
      bookmarksCache: { surveys: [], questions: [], users: [address], filters: [] },
      networkId: 11155420,
      nickname: 'Alpha',
      onchainUsername: 'alpha-user',
    });

    expect(result.stillBookmarked).toBe(true);
    expect(result.bookmarksCache.users).toEqual([{
      address,
      networkId: '11155420',
      nickname: 'Alpha',
      username: 'alpha-user',
    }]);
  });

  it('toggles bookmarks and builds UI state patches', () => {
    const added = applyUserPageBookmarkToggle({
      address,
      bookmarksCache: { surveys: [], questions: [], users: [], filters: [] },
    });
    expect(added.bookmarked).toBe(true);
    expect(buildUserPageBookmarkToggleStatePatch(added)).toEqual({ bookmarked: true });

    const removed = applyUserPageBookmarkToggle({
      address,
      bookmarksCache: added.bookmarksCache,
    });
    expect(removed.bookmarked).toBe(false);
    expect(buildUserPageBookmarkToggleStatePatch(removed)).toEqual({
      bookmarked: false,
      isEditingNickname: false,
      nicknameInput: '',
    });

    expect(buildUserPageBookmarkStatusStateUpdate({
      bookmarked: true,
      nickname: 'Alpha',
      state: { bookmarked: false, nicknameInput: '' },
    })).toEqual({ bookmarked: true, nicknameInput: 'Alpha' });
  });

  it('resolves bookmark button display labels from bookmark state', () => {
    expect(resolveUserPageBookmarkButtonDisplayState({ bookmarked: false })).toEqual({
      ariaLabel: 'Bookmark user',
      iconStyle: { color: undefined },
      title: 'Bookmark user',
    });
    expect(resolveUserPageBookmarkButtonDisplayState({ bookmarked: true })).toEqual({
      ariaLabel: 'Remove bookmark',
      iconStyle: { color: 'yellow' },
      title: 'Remove bookmark',
    });
  });
});
