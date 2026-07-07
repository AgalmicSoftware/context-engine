import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';

export type UserPageBookmarkUserEntry = UserPageUnknownRecord & {
  address?: unknown;
  nickname?: unknown;
  username?: unknown;
  networkId?: unknown;
};
export type UserPageBookmarkUserValue = string | UserPageBookmarkUserEntry;
export type UserPageBookmarksCache = UserPageUnknownRecord & {
  surveys: unknown[];
  questions: unknown[];
  users: UserPageBookmarkUserValue[];
  filters: unknown[];
};
export type UserPageBookmarkStatus = {
  bookmarked: boolean;
  nickname: string | null;
};

type ResolveUserPageBookmarkButtonDisplayStateArgs = {
  bookmarked?: unknown;
};
type BuildUserPageHeaderBookmarkClassNameArgs = {
  baseClassName?: unknown;
  headerClassName?: unknown;
};
type ResolveUserPageBookmarksLinkDisplayStateArgs = {
  baseClassName?: unknown;
  inlineClassName?: unknown;
};
type UserPageBookmarkButtonDisplayState = {
  ariaLabel: string;
  iconStyle: Record<string, string | undefined>;
  title: string;
};
type UserPageBookmarksLinkDisplayState = {
  className: string;
  style: Record<string, string>;
};
type ResolveUserPageBookmarkStatusArgs = {
  address?: unknown;
  users?: unknown;
};
type ResolveUserPageBookmarkNicknameArgs = ResolveUserPageBookmarkStatusArgs & {
  trim?: unknown;
};
type ApplyUserPageBookmarkNicknameSaveArgs = {
  address?: unknown;
  bookmarksCache?: unknown;
  networkId?: unknown;
  nickname?: unknown;
  onchainUsername?: unknown;
};
type UserPageBookmarkNicknameSaveResult = {
  bookmarksCache: UserPageBookmarksCache;
  nickname: string;
  stillBookmarked: boolean;
};
type ApplyUserPageBookmarkToggleArgs = {
  address?: unknown;
  bookmarkMeta?: unknown;
  bookmarksCache?: unknown;
  currentNickname?: unknown;
  networkId?: unknown;
  onchainUsername?: unknown;
};
type UserPageBookmarkToggleResult = {
  bookmarked: boolean;
  bookmarksCache: UserPageBookmarksCache;
  statePatch: UserPageUnknownRecord;
};
type BuildUserPageBookmarkStatusStateUpdateArgs = {
  bookmarked?: unknown;
  nickname?: unknown;
  state?: unknown;
};

export const resolveUserPageBookmarkButtonDisplayState = ({
  bookmarked = false,
}: ResolveUserPageBookmarkButtonDisplayStateArgs = {}): UserPageBookmarkButtonDisplayState => {
  const isBookmarked = !!bookmarked;
  const label = isBookmarked ? 'Remove bookmark' : 'Bookmark user';
  return {
    ariaLabel: label,
    iconStyle: { color: isBookmarked ? 'yellow' : undefined },
    title: label,
  };
};

export const buildUserPageHeaderBookmarkClassName = ({
  baseClassName = '',
  headerClassName = '',
}: BuildUserPageHeaderBookmarkClassNameArgs = {}): string =>
  [String(baseClassName || ''), String(headerClassName || '')].filter(Boolean).join(' ');

export const resolveUserPageBookmarksLinkDisplayState = ({
  baseClassName = '',
  inlineClassName = '',
}: ResolveUserPageBookmarksLinkDisplayStateArgs = {}): UserPageBookmarksLinkDisplayState => ({
  className: [String(baseClassName || ''), String(inlineClassName || '')].filter(Boolean).join(' '),
  style: { marginLeft: '12px' },
});

export const buildUserPageBookmarkStatusStateUpdate = ({
  bookmarked = false,
  nickname = null,
  state = null,
}: BuildUserPageBookmarkStatusStateUpdateArgs = {}): UserPageUnknownRecord | null => {
  const currentState = isPlainAnalysisObject(state) ? state : {};
  const nextState: UserPageUnknownRecord = {};
  const nextBookmarked = Boolean(bookmarked);
  if (currentState.bookmarked !== nextBookmarked) {
    nextState.bookmarked = nextBookmarked;
  }
  if (nickname != null && currentState.nicknameInput !== nickname) {
    nextState.nicknameInput = nickname;
  }
  return Object.keys(nextState).length > 0 ? nextState : null;
};

export const isBookmarkUserEntry = (value: unknown): value is UserPageBookmarkUserEntry => isPlainAnalysisObject(value);

export const isBookmarkUserObjectForAddress = (
  value: unknown,
  addressLower: string,
): value is UserPageBookmarkUserEntry =>
  isBookmarkUserEntry(value) && String(value.address || '').toLowerCase() === addressLower;

export const isBookmarkValueForAddress = (value: unknown, addressLower: string): boolean =>
  (typeof value === 'string' && String(value).toLowerCase() === addressLower) ||
  isBookmarkUserObjectForAddress(value, addressLower);

export const buildDefaultUserPageBookmarksCache = (): UserPageBookmarksCache => ({
  surveys: [],
  questions: [],
  users: [],
  filters: [],
});

export const normalizeUserPageBookmarksCache = (value: unknown): UserPageBookmarksCache => {
  const defaultCache = buildDefaultUserPageBookmarksCache();
  if (!isPlainAnalysisObject(value)) return defaultCache;
  return {
    ...defaultCache,
    ...value,
    surveys: Array.isArray(value.surveys) ? [...value.surveys] : [],
    questions: Array.isArray(value.questions) ? [...value.questions] : [],
    users: Array.isArray(value.users) ? ([...value.users] as UserPageBookmarkUserValue[]) : [],
    filters: Array.isArray(value.filters) ? [...value.filters] : [],
  };
};

export const resolveUserPageBookmarkStatus = ({
  address = '',
  users = [],
}: ResolveUserPageBookmarkStatusArgs = {}): UserPageBookmarkStatus => {
  const addressLower = String(address || '').toLowerCase();
  let bookmarked = false;
  let nickname: string | null = null;
  if (!addressLower) return { bookmarked, nickname };

  for (const user of Array.isArray(users) ? users : []) {
    if (typeof user === 'string') {
      if (String(user).toLowerCase() === addressLower) {
        bookmarked = true;
      }
    } else if (isBookmarkUserEntry(user)) {
      const userAddress = String(user.address || '').toLowerCase();
      if (userAddress === addressLower) {
        bookmarked = true;
        if (typeof user.nickname === 'string' && user.nickname) {
          nickname = user.nickname;
        }
      }
    }
    if (bookmarked && nickname) break;
  }

  return { bookmarked, nickname };
};

export const resolveUserPageBookmarkNickname = ({
  address = '',
  trim = false,
  users = [],
}: ResolveUserPageBookmarkNicknameArgs = {}): string => {
  const addressLower = String(address || '').toLowerCase();
  if (!addressLower) return '';
  const user = (Array.isArray(users) ? users : []).find((entry) => isBookmarkUserObjectForAddress(entry, addressLower));
  if (!user || typeof user.nickname !== 'string') return '';
  const nickname = trim ? user.nickname.trim() : user.nickname;
  return nickname || '';
};

export const applyUserPageBookmarkNicknameSave = ({
  address = '',
  bookmarksCache = null,
  networkId = null,
  nickname = '',
  onchainUsername = null,
}: ApplyUserPageBookmarkNicknameSaveArgs = {}): UserPageBookmarkNicknameSaveResult => {
  const rawAddr = String(address || '');
  const addrLower = rawAddr.toLowerCase();
  const normalizedNickname = String(nickname || '').trim();
  const networkIdStr = networkId != null ? String(networkId) : null;
  const username = String(onchainUsername || '').trim();
  const cache = isPlainAnalysisObject(bookmarksCache)
    ? (bookmarksCache as UserPageBookmarksCache)
    : buildDefaultUserPageBookmarksCache();

  cache.surveys = Array.isArray(cache.surveys) ? cache.surveys : [];
  cache.questions = Array.isArray(cache.questions) ? cache.questions : [];
  cache.users = Array.isArray(cache.users) ? cache.users : [];
  cache.filters = Array.isArray(cache.filters) ? cache.filters : [];

  if (!addrLower) {
    return {
      bookmarksCache: cache,
      nickname: normalizedNickname,
      stillBookmarked: false,
    };
  }

  const users = cache.users;
  const objIdx = users.findIndex((user) => isBookmarkUserObjectForAddress(user, addrLower));
  const strIdx = users.findIndex((user) => typeof user === 'string' && String(user).toLowerCase() === addrLower);
  const baseObj: UserPageBookmarkUserEntry = {
    address: addrLower,
    ...(normalizedNickname ? { nickname: normalizedNickname } : {}),
  };
  if (username) baseObj.username = username;
  if (networkIdStr) baseObj.networkId = networkIdStr;

  if (objIdx > -1) {
    const existing = isBookmarkUserEntry(users[objIdx]) ? users[objIdx] : {};
    const merged: UserPageBookmarkUserEntry = {
      ...existing,
      address: addrLower,
      ...(username ? { username } : {}),
      ...(networkIdStr ? { networkId: networkIdStr } : {}),
    };
    if (normalizedNickname) {
      merged.nickname = normalizedNickname;
    } else if ('nickname' in merged) {
      delete merged.nickname;
    }
    users[objIdx] = merged;
  } else if (strIdx > -1) {
    if (normalizedNickname) {
      users[strIdx] = baseObj;
    }
  } else if (normalizedNickname) {
    users.push(baseObj);
  }

  return {
    bookmarksCache: cache,
    nickname: normalizedNickname,
    stillBookmarked: users.some((user) => isBookmarkValueForAddress(user, addrLower)),
  };
};

export const applyUserPageBookmarkToggle = ({
  address = '',
  bookmarkMeta = null,
  bookmarksCache = null,
  currentNickname = '',
  networkId = null,
  onchainUsername = null,
}: ApplyUserPageBookmarkToggleArgs = {}): UserPageBookmarkToggleResult => {
  const rawAddr = String(address || '');
  const addrLower = rawAddr.toLowerCase();
  const cache = isPlainAnalysisObject(bookmarksCache)
    ? (bookmarksCache as UserPageBookmarksCache)
    : buildDefaultUserPageBookmarksCache();
  cache.surveys = Array.isArray(cache.surveys) ? cache.surveys : [];
  cache.questions = Array.isArray(cache.questions) ? cache.questions : [];
  cache.users = Array.isArray(cache.users) ? cache.users : [];
  cache.filters = Array.isArray(cache.filters) ? cache.filters : [];

  if (!addrLower) {
    return {
      bookmarked: false,
      bookmarksCache: cache,
      statePatch: {},
    };
  }

  const users = cache.users;
  const idx = users.findIndex((user) => isBookmarkValueForAddress(user, addrLower));
  if (idx > -1) {
    users.splice(idx, 1);
    return {
      bookmarked: false,
      bookmarksCache: cache,
      statePatch: {
        isEditingNickname: false,
        nicknameInput: '',
      },
    };
  }

  const meta = isPlainAnalysisObject(bookmarkMeta) ? bookmarkMeta : {};
  const username = onchainUsername || '';
  const shouldUseObject = Boolean(meta.nickname || meta.username) || Boolean(currentNickname) || Boolean(username);
  if (shouldUseObject) {
    const entry: UserPageBookmarkUserEntry = {
      address: addrLower,
      ...(currentNickname ? { nickname: currentNickname } : {}),
      ...(username ? { username } : {}),
      ...(networkId != null ? { networkId: String(networkId) } : {}),
    };
    if (meta.nickname != null) entry.nickname = meta.nickname;
    if (meta.username != null) entry.username = meta.username;
    users.push(entry);
  } else {
    users.push(rawAddr);
  }

  return {
    bookmarked: true,
    bookmarksCache: cache,
    statePatch: {},
  };
};

export const buildUserPageBookmarkToggleStatePatch = ({
  bookmarked = false,
  statePatch = {},
}: {
  bookmarked?: unknown;
  statePatch?: unknown;
} = {}): UserPageUnknownRecord => ({
  bookmarked: Boolean(bookmarked),
  ...toAnalysisRecord(statePatch),
});
