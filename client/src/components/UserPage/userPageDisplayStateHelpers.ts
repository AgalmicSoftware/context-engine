import { toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';

type BuildUserPageBooleanTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
};
type BuildUserPageSelectedTabStatePatchArgs = {
  selectedTab?: unknown;
};
type BuildUserPageAnalysisModalStatePatchArgs = {
  open?: unknown;
};
type BuildUserPageFullProfileModalStatePatchArgs = {
  open?: unknown;
};
type BuildUserPageCopiedStatePatchArgs = {
  copied?: unknown;
};
type ResolveUserPageCopyIconDisplayStateArgs = {
  copied?: unknown;
};
type BuildUserPageRootClassNameArgs = {
  baseClassName?: unknown;
  minimized?: unknown;
  minimizedClassName?: unknown;
};
type BuildUserPageCreatedQuestionWrapperClassNameArgs = {
  baseClassName?: unknown;
  bolderClassName?: unknown;
};
type ResolveUserPageAvatarDisplayStateArgs = {
  blockieUrl?: unknown;
};
type ResolveUserPageInlineEnteredIndicatorDisplayStateArgs = {
  value?: unknown;
};
type BuildUserPageNicknameInputStatePatchArgs = {
  nicknameInput?: unknown;
};
type BuildUserPageNicknameSaveStatePatchArgs = {
  bookmarked?: unknown;
  nickname?: unknown;
};
type BuildUserPageUsernameStatePatchArgs = {
  username?: unknown;
};
type BuildUserPageUsernameErrorStatePatchArgs = {
  usernameError?: unknown;
};
type ResolveUserPageUsernameErrorDisplayStateArgs = {
  usernameError?: unknown;
};
type UserPageUsernameErrorDisplayState = {
  shouldRenderUsernameError: boolean;
  usernameErrorText: string;
};
type UserPageCopyIconDisplayState = {
  copiedIconStyle: Record<string, string>;
  defaultIconStyle: Record<string, string>;
};
type UserPageAvatarDisplayState = {
  avatarStyle: Record<string, string>;
};
type UserPageInlineEnteredIndicatorDisplayState = {
  shouldRenderEnteredIndicator: boolean;
};
type BuildUserPageViewAddressStatePatchArgs = {
  viewAddress?: unknown;
};
type BuildUserPageSurveyExpansionTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
  surveyId?: unknown;
};

export const buildUserPageBooleanTogglePatch = ({
  state = {},
  stateKey = '',
}: BuildUserPageBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  const source = toAnalysisRecord(state);
  return {
    [key]: !source[key],
  };
};

export const buildUserPageSelectedTabStatePatch = ({
  selectedTab = '',
}: BuildUserPageSelectedTabStatePatchArgs = {}): Record<string, string> => ({
  selectedTab: String(selectedTab || ''),
});

export const buildUserPageAnalysisModalStatePatch = ({
  open = false,
}: BuildUserPageAnalysisModalStatePatchArgs = {}): Record<string, boolean> => ({
  showAnalysisModal: open === true,
});

export const buildUserPageFullProfileModalStatePatch = ({
  open = false,
}: BuildUserPageFullProfileModalStatePatchArgs = {}): Record<string, boolean> => ({
  showFullProfileModal: open === true,
});

export const buildUserPageCopiedStatePatch = ({ copied = false }: BuildUserPageCopiedStatePatchArgs = {}): Record<
  string,
  boolean
> => ({
  copied: copied === true,
});

export const resolveUserPageCopyIconDisplayState = ({
  copied = false,
}: ResolveUserPageCopyIconDisplayStateArgs = {}): UserPageCopyIconDisplayState => {
  const isCopied = !!copied;
  return {
    copiedIconStyle: { display: isCopied ? 'inline' : 'none' },
    defaultIconStyle: { display: isCopied ? 'none' : 'inline' },
  };
};

export const buildUserPageRootClassName = ({
  baseClassName = '',
  minimized = false,
  minimizedClassName = '',
}: BuildUserPageRootClassNameArgs = {}): string =>
  [String(baseClassName || ''), minimized ? String(minimizedClassName || '') : ''].filter(Boolean).join(' ');

export const buildUserPageCreatedQuestionWrapperClassName = ({
  baseClassName = '',
  bolderClassName = '',
}: BuildUserPageCreatedQuestionWrapperClassNameArgs = {}): string =>
  [String(baseClassName || ''), String(bolderClassName || '')].filter(Boolean).join(' ');

export const resolveUserPageAvatarDisplayState = ({
  blockieUrl = '',
}: ResolveUserPageAvatarDisplayStateArgs = {}): UserPageAvatarDisplayState => ({
  avatarStyle: {
    backgroundImage: `url(${String(blockieUrl || '')})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  },
});

export const resolveUserPageInlineEnteredIndicatorDisplayState = ({
  value = '',
}: ResolveUserPageInlineEnteredIndicatorDisplayStateArgs = {}): UserPageInlineEnteredIndicatorDisplayState => ({
  shouldRenderEnteredIndicator: String(value || '').length > 0,
});

export const buildUserPageNicknameEditOpenStatePatch = (): Record<string, boolean> => ({
  isEditingNickname: true,
});

export const buildUserPageNicknameEditCancelStatePatch = ({
  nicknameInput = '',
}: BuildUserPageNicknameInputStatePatchArgs = {}): Record<string, string | boolean> => ({
  isEditingNickname: false,
  nicknameInput: String(nicknameInput || ''),
});

export const buildUserPageNicknameInputStatePatch = ({
  nicknameInput = '',
}: BuildUserPageNicknameInputStatePatchArgs = {}): Record<string, string> => ({
  nicknameInput: String(nicknameInput || ''),
});

export const buildUserPageNicknameSaveStatePatch = ({
  bookmarked = false,
  nickname = '',
}: BuildUserPageNicknameSaveStatePatchArgs = {}): Record<string, string | boolean> => ({
  nicknameInput: String(nickname || ''),
  bookmarked: Boolean(bookmarked),
  isEditingNickname: false,
});

export const buildUserPageUsernameChangeStatePatch = ({
  username = '',
}: BuildUserPageUsernameStatePatchArgs = {}): Record<string, string> => ({
  username: String(username || ''),
  usernameError: '',
});

export const buildUserPageUsernameLoadedStatePatch = ({
  username = '',
}: BuildUserPageUsernameStatePatchArgs = {}): Record<string, string> => ({
  username: String(username || ''),
});

export const buildUserPageUsernameEditOpenStatePatch = (): Record<string, boolean> => ({
  isEditingUsername: true,
});

export const buildUserPageUsernameEditCancelStatePatch = (): Record<string, boolean> => ({
  isEditingUsername: false,
});

export const buildUserPageUsernameSaveStatePatch = ({
  username = '',
}: BuildUserPageUsernameStatePatchArgs = {}): Record<string, string | boolean> => ({
  username: String(username || ''),
  usernameError: '',
  isEditingUsername: false,
});

export const buildUserPageUsernameErrorStatePatch = ({
  usernameError = '',
}: BuildUserPageUsernameErrorStatePatchArgs = {}): Record<string, string> => ({
  usernameError: String(usernameError || ''),
});

export const resolveUserPageUsernameErrorDisplayState = ({
  usernameError = '',
}: ResolveUserPageUsernameErrorDisplayStateArgs = {}): UserPageUsernameErrorDisplayState => {
  const usernameErrorText = String(usernameError || '');
  return {
    shouldRenderUsernameError: !!usernameErrorText,
    usernameErrorText,
  };
};

export const buildUserPageViewAddressStatePatch = (
  args: BuildUserPageViewAddressStatePatchArgs = {},
): Record<string, unknown> => ({
  viewAddress: Object.prototype.hasOwnProperty.call(args, 'viewAddress') ? args.viewAddress : '',
});

export const buildUserPageSurveyExpansionTogglePatch = ({
  state = {},
  stateKey = '',
  surveyId = '',
}: BuildUserPageSurveyExpansionTogglePatchArgs = {}): UserPageUnknownRecord => {
  const collectionKey = String(stateKey || '');
  const surveyKey = String(surveyId);
  const source = toAnalysisRecord(state);
  const previousExpansion = toAnalysisRecord(source[collectionKey]);
  return {
    [collectionKey]: {
      ...previousExpansion,
      [surveyKey]: !previousExpansion[surveyKey],
    },
  };
};
