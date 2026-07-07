type SimUserLookupEntry = {
  username?: unknown;
};
type BuildSimUserPageRootClassNameArgs = {
  baseClassName?: unknown;
  minimized?: unknown;
  minimizedClassName?: unknown;
};
type ResolveSimUserStanceMarkerStyleArgs = {
  value?: unknown;
};
type BuildSimUserVoteIndicatorClassNameArgs = {
  baseClassName?: unknown;
  negativeClassName?: unknown;
  positiveClassName?: unknown;
  vote?: unknown;
};
type BuildSimUserRelatedScoreClassNameArgs = {
  baseClassName?: unknown;
  disagreeClassName?: unknown;
};

export type SimUserInfoStatePatch<T extends SimUserLookupEntry> = {
  userInfo: T | null;
};

export type SimFullProfileModalStatePatch = {
  showFullProfileModal: boolean;
};

export const resolveSimUserInfoByUsername = <T extends SimUserLookupEntry>(
  figures: readonly T[] = [],
  simUsername?: unknown,
): T | null => figures.find((figure) => figure?.username === simUsername) || null;

export const buildSimUserInfoStatePatch = <T extends SimUserLookupEntry>({
  figures = [],
  simUsername,
}: {
  figures?: readonly T[];
  simUsername?: unknown;
} = {}): SimUserInfoStatePatch<T> => ({
  userInfo: resolveSimUserInfoByUsername(figures, simUsername),
});

export const buildSimFullProfileModalStatePatch = ({
  open = false,
}: {
  open?: unknown;
} = {}): SimFullProfileModalStatePatch => ({
  showFullProfileModal: open === true,
});

export const buildSimUserPageRootClassName = ({
  baseClassName = '',
  minimized = false,
  minimizedClassName = '',
}: BuildSimUserPageRootClassNameArgs = {}): string =>
  [String(baseClassName || ''), minimized ? String(minimizedClassName || '') : ''].filter(Boolean).join(' ');

export const resolveSimUserStanceMarkerStyle = ({ value = 0 }: ResolveSimUserStanceMarkerStyleArgs = {}): Record<
  string,
  string
> => ({
  left: `${((Number(value || 0) + 1) / 2) * 100}%`,
});

export const buildSimUserVoteIndicatorClassName = ({
  baseClassName = '',
  negativeClassName = '',
  positiveClassName = '',
  vote = 0,
}: BuildSimUserVoteIndicatorClassNameArgs = {}): string =>
  [
    String(baseClassName || ''),
    Number(vote || 0) > 0 ? String(positiveClassName || '') : String(negativeClassName || ''),
  ]
    .filter(Boolean)
    .join(' ');

export const buildSimUserRelatedScoreClassName = ({
  baseClassName = '',
  disagreeClassName = '',
}: BuildSimUserRelatedScoreClassNameArgs = {}): string =>
  [String(baseClassName || ''), String(disagreeClassName || '')].filter(Boolean).join(' ');
