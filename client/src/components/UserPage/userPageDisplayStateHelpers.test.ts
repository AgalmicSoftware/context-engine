import {
  buildUserPageAnalysisModalStatePatch,
  buildUserPageBooleanTogglePatch,
  buildUserPageNicknameSaveStatePatch,
  buildUserPageRootClassName,
  buildUserPageSurveyExpansionTogglePatch,
  buildUserPageUsernameSaveStatePatch,
  resolveUserPageAvatarDisplayState,
  resolveUserPageCopyIconDisplayState,
  resolveUserPageUsernameErrorDisplayState,
} from './userPageDisplayStateHelpers';

describe('userPageDisplayStateHelpers', () => {
  it('builds simple modal, toggle, and edit state patches', () => {
    expect(buildUserPageAnalysisModalStatePatch({ open: true })).toEqual({
      showAnalysisModal: true,
    });
    expect(
      buildUserPageBooleanTogglePatch({
        state: { expanded: false },
        stateKey: 'expanded',
      }),
    ).toEqual({ expanded: true });
    expect(
      buildUserPageNicknameSaveStatePatch({
        bookmarked: true,
        nickname: 'Alpha',
      }),
    ).toEqual({
      bookmarked: true,
      isEditingNickname: false,
      nicknameInput: 'Alpha',
    });
    expect(buildUserPageUsernameSaveStatePatch({ username: 'alpha-user' })).toEqual({
      isEditingUsername: false,
      username: 'alpha-user',
      usernameError: '',
    });
  });

  it('builds display state without mutating caller-owned state', () => {
    expect(resolveUserPageCopyIconDisplayState({ copied: true })).toEqual({
      copiedIconStyle: { display: 'inline' },
      defaultIconStyle: { display: 'none' },
    });
    expect(resolveUserPageAvatarDisplayState({ blockieUrl: 'https://asset.example/avatar.png' })).toEqual({
      avatarStyle: {
        backgroundImage: 'url(https://asset.example/avatar.png)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      },
    });
    expect(resolveUserPageUsernameErrorDisplayState({ usernameError: 'Taken' })).toEqual({
      shouldRenderUsernameError: true,
      usernameErrorText: 'Taken',
    });
    expect(
      buildUserPageRootClassName({
        baseClassName: 'root',
        minimized: true,
        minimizedClassName: 'mini',
      }),
    ).toBe('root mini');
  });

  it('toggles nested survey expansion state by collection and survey id', () => {
    expect(
      buildUserPageSurveyExpansionTogglePatch({
        state: { expanded: { s1: true } },
        stateKey: 'expanded',
        surveyId: 's1',
      }),
    ).toEqual({
      expanded: { s1: false },
    });
    expect(
      buildUserPageSurveyExpansionTogglePatch({
        state: { expanded: { s1: true } },
        stateKey: 'expanded',
        surveyId: 's2',
      }),
    ).toEqual({
      expanded: { s1: true, s2: true },
    });
  });
});
