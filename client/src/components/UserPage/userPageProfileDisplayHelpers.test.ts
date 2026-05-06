import {
  buildUserPageProfileEditVisibility,
  resolveUserPageAddressDisplayState,
  resolveUserPageBlockieSeed,
  resolveUserPageHeaderActionVisibility,
} from './userPageProfileDisplayHelpers';

describe('userPageProfileDisplayHelpers', () => {
  it('resolves owner and nickname editor visibility', () => {
    expect(buildUserPageProfileEditVisibility({
      account: '0xABC',
      cachedNickname: '',
      isEditingNickname: false,
      isEditingUsername: false,
      minimized: false,
      pendingNickname: 'Pending',
      viewAddress: '0xabc',
    })).toEqual({
      hasNickForThis: true,
      isOwner: true,
      notOwnPage: false,
      showPen: false,
      showUsernamePen: true,
    });

    expect(buildUserPageProfileEditVisibility({
      account: '0xABC',
      isEditingNickname: false,
      minimized: false,
      viewAddress: '0xDEF',
    })).toMatchObject({
      isOwner: false,
      notOwnPage: true,
      showPen: true,
      showUsernamePen: false,
    });
  });

  it('resolves header actions without exposing simulated pages as copyable addresses', () => {
    expect(resolveUserPageHeaderActionVisibility({
      explorerUrl: 'https://explorer.test/address/0xabc',
      isEditingNickname: true,
      isOwner: false,
      isSimulated: false,
      minimized: false,
      notOwnPage: true,
      propViewAddress: '0xabc',
    })).toEqual({
      showBookmarkButton: true,
      showBookmarksLink: false,
      showCopyAddressButton: true,
      showExplorerLink: false,
      showNicknameEditor: true,
      showSimulatedBadge: false,
    });

    expect(resolveUserPageHeaderActionVisibility({
      isOwner: false,
      isSimulated: true,
      minimized: false,
      propViewAddress: '0xsim',
    })).toMatchObject({
      showBookmarkButton: false,
      showCopyAddressButton: false,
      showSimulatedBadge: true,
    });
  });

  it('preserves address label precedence and profile link state', () => {
    const shorten = jest.fn((address) => `short:${address}`);

    expect(resolveUserPageAddressDisplayState({
      cachedNickname: 'Cached Nick',
      explorerUrl: 'https://explorer.test/address/0xABC',
      getShortenedAddress: shorten,
      minimized: false,
      propViewAddress: '0xABC',
      username: 'user.eth',
    })).toMatchObject({
      addressHref: 'https://explorer.test/address/0xABC',
      addressLabel: 'Cached Nick',
      nicknameToUse: 'Cached Nick',
      pendingNicknameForThis: '',
      profileUrl: '/u/0xABC',
      shouldLinkAddressLabel: true,
    });

    expect(resolveUserPageAddressDisplayState({
      bookmarked: true,
      getShortenedAddress: shorten,
      minimized: true,
      nicknameInput: '  Pending Nick  ',
      propViewAddress: '0xABC',
      stateViewAddress: '0xabc',
      username: 'user.eth',
    })).toMatchObject({
      addressHref: '/u/0xABC',
      addressLabel: 'Pending Nick',
      nicknameToUse: 'Pending Nick',
      pendingNicknameForThis: 'Pending Nick',
    });

    expect(resolveUserPageAddressDisplayState({
      getShortenedAddress: shorten,
      isSimulated: false,
      propViewAddress: '0xDEF',
      username: 'real.eth',
    }).addressLabel).toBe('real.eth');
    expect(resolveUserPageAddressDisplayState({
      getShortenedAddress: shorten,
      propViewAddress: '0xDEF',
    }).addressLabel).toBe('short:0xDEF');
  });

  it('falls back to username and the default seed for blockies', () => {
    expect(resolveUserPageBlockieSeed({
      propViewAddress: '0xABC',
      username: 'user.eth',
    })).toBe('0xABC');
    expect(resolveUserPageBlockieSeed({
      username: 'user.eth',
    })).toBe('user.eth');
    expect(resolveUserPageBlockieSeed()).toBe('contextengine-default-seed');
  });
});
