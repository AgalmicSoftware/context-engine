export type BuildUserPageProfileEditVisibilityArgs = {
  account?: unknown;
  cachedNickname?: unknown;
  isEditingNickname?: unknown;
  isEditingUsername?: unknown;
  minimized?: unknown;
  pendingNickname?: unknown;
  viewAddress?: unknown;
};

export type ResolveUserPageHeaderActionVisibilityArgs = {
  explorerUrl?: unknown;
  isEditingNickname?: unknown;
  isOwner?: unknown;
  isSimulated?: unknown;
  minimized?: unknown;
  notOwnPage?: unknown;
  propViewAddress?: unknown;
};

export type ResolveUserPageAddressDisplayStateArgs = {
  bookmarked?: unknown;
  cachedNickname?: unknown;
  explorerUrl?: unknown;
  getShortenedAddress?: ((address: unknown, compact?: boolean) => unknown) | null;
  isEditingNickname?: unknown;
  isSimulated?: unknown;
  minimized?: unknown;
  nicknameInput?: unknown;
  propViewAddress?: unknown;
  stateViewAddress?: unknown;
  username?: unknown;
};

export type ResolveUserPageBlockieSeedArgs = {
  propViewAddress?: unknown;
  username?: unknown;
};

export type ResolveUserPageHeaderPassiveDisplayStateArgs = BuildUserPageProfileEditVisibilityArgs & {
  explorerUrl?: unknown;
  isSimulated?: unknown;
  propViewAddress?: unknown;
};

export type UserPageProfileEditVisibility = {
  hasNickForThis: boolean;
  isOwner: boolean;
  notOwnPage: boolean;
  showPen: boolean;
  showUsernamePen: boolean;
};

export type UserPageHeaderActionVisibility = {
  showBookmarkButton: boolean;
  showBookmarksLink: boolean;
  showCopyAddressButton: boolean;
  showExplorerLink: boolean;
  showNicknameEditor: boolean;
  showSimulatedBadge: boolean;
};

export type UserPageAddressDisplayState = {
  addressHref: string;
  addressLabel: string;
  nicknameToUse: string;
  pendingNicknameForThis: string;
  profileUrl: string;
  shouldLinkAddressLabel: boolean;
};

export type UserPageHeaderPassiveDisplayState = {
  headerActionVisibility: UserPageHeaderActionVisibility;
  profileEditVisibility: UserPageProfileEditVisibility;
};

export const buildUserPageProfileEditVisibility = ({
  account = '',
  cachedNickname = '',
  isEditingNickname = false,
  isEditingUsername = false,
  minimized = false,
  pendingNickname = '',
  viewAddress = '',
}: BuildUserPageProfileEditVisibilityArgs = {}): UserPageProfileEditVisibility => {
  const accountLower = String(account || '').toLowerCase();
  const viewAddressLower = String(viewAddress || '').toLowerCase();
  const isOwner = !!(accountLower && viewAddressLower && accountLower === viewAddressLower);
  const notOwnPage = !isOwner;
  return {
    hasNickForThis: Boolean(cachedNickname || pendingNickname),
    isOwner,
    notOwnPage,
    showPen: !minimized && notOwnPage && !isEditingNickname,
    showUsernamePen: !minimized && isOwner && !isEditingUsername,
  };
};

export const resolveUserPageHeaderActionVisibility = ({
  explorerUrl = '',
  isEditingNickname = false,
  isOwner = false,
  isSimulated = false,
  minimized = false,
  notOwnPage = false,
  propViewAddress = '',
}: ResolveUserPageHeaderActionVisibilityArgs = {}): UserPageHeaderActionVisibility => ({
  showBookmarkButton: !isSimulated && !!propViewAddress && !isOwner,
  showBookmarksLink: !!isOwner && !minimized,
  showCopyAddressButton: !isSimulated && !!propViewAddress,
  showExplorerLink: !!minimized && !!explorerUrl,
  showNicknameEditor: !!notOwnPage && !!isEditingNickname,
  showSimulatedBadge: !!isSimulated,
});

export const resolveUserPageHeaderPassiveDisplayState = ({
  account = '',
  cachedNickname = '',
  explorerUrl = '',
  isEditingNickname = false,
  isEditingUsername = false,
  isSimulated = false,
  minimized = false,
  pendingNickname = '',
  propViewAddress = '',
  viewAddress = '',
}: ResolveUserPageHeaderPassiveDisplayStateArgs = {}): UserPageHeaderPassiveDisplayState => {
  const profileEditVisibility = buildUserPageProfileEditVisibility({
    account,
    cachedNickname,
    isEditingNickname,
    isEditingUsername,
    minimized,
    pendingNickname,
    viewAddress,
  });

  return {
    headerActionVisibility: resolveUserPageHeaderActionVisibility({
      explorerUrl,
      isEditingNickname,
      isOwner: profileEditVisibility.isOwner,
      isSimulated,
      minimized,
      notOwnPage: profileEditVisibility.notOwnPage,
      propViewAddress,
    }),
    profileEditVisibility,
  };
};

export const resolveUserPageAddressDisplayState = ({
  bookmarked = false,
  cachedNickname = '',
  explorerUrl = '',
  getShortenedAddress = null,
  isEditingNickname = false,
  isSimulated = false,
  minimized = false,
  nicknameInput = '',
  propViewAddress = '',
  stateViewAddress = '',
  username = '',
}: ResolveUserPageAddressDisplayStateArgs = {}): UserPageAddressDisplayState => {
  const currentLower = String(propViewAddress || '').toLowerCase();
  const pendingNick = String(nicknameInput || '').trim();
  const stateViewLower = String(stateViewAddress || '').toLowerCase();
  const pendingNicknameForThis =
    stateViewLower === currentLower && (isEditingNickname || bookmarked) ? pendingNick : '';
  const nicknameToUse = String(cachedNickname || '') || pendingNicknameForThis;
  const profileUrl = propViewAddress ? `/u/${propViewAddress}` : '';
  const usernameText = String(username || '');
  const shortAddress = propViewAddress
    ? String(typeof getShortenedAddress === 'function' ? getShortenedAddress(propViewAddress, false) : propViewAddress)
    : '';
  const addressLabel =
    nicknameToUse ||
    (isSimulated && usernameText ? usernameText : '') ||
    (usernameText && !isSimulated ? usernameText : '') ||
    shortAddress;
  const addressHref = minimized ? profileUrl : String(explorerUrl || '');
  return {
    addressHref,
    addressLabel,
    nicknameToUse,
    pendingNicknameForThis,
    profileUrl,
    shouldLinkAddressLabel: !!addressHref,
  };
};

export const resolveUserPageBlockieSeed = ({
  propViewAddress = '',
  username = '',
}: ResolveUserPageBlockieSeedArgs = {}): string =>
  String(propViewAddress || '') || (username ? String(username) : 'contextengine-default-seed');
