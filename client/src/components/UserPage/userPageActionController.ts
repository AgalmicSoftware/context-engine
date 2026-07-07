export type UserPageActionEventLike = {
  preventDefault?: () => void;
};

export type UserPageActionDispatch<Args extends readonly unknown[] = readonly unknown[]> = (...args: Args) => unknown;

export type UserPageAnalyzeActionPlanLike = {
  blockedReason?: unknown;
  disabled?: boolean;
  shouldRenderAnalyzeAction?: boolean;
};

export type UserPageBookmarkActionPlanLike = {
  blockedReason?: unknown;
  disabled?: boolean;
  shouldRenderBookmarkAction?: boolean;
};

export type UserPageCacheRefreshActionPlanLike = {
  blockedReason?: unknown;
  disabled?: boolean;
  shouldRenderCacheRefreshAction?: boolean;
};

export type UserPageAnalyzeActionControllerPorts<AnalyzeArgs extends readonly unknown[] = readonly unknown[]> = {
  dispatchAnalyze?: UserPageActionDispatch<AnalyzeArgs>;
};

export type UserPageBookmarkActionControllerPorts<BookmarkArgs extends readonly unknown[] = readonly unknown[]> = {
  dispatchBookmark?: UserPageActionDispatch<BookmarkArgs>;
};

export type UserPageCacheRefreshActionControllerPorts<
  CacheRefreshArgs extends readonly unknown[] = readonly unknown[],
> = {
  dispatchCacheRefresh?: UserPageActionDispatch<CacheRefreshArgs>;
};

export type RunUserPageAnalyzeActionControllerArgs<AnalyzeArgs extends readonly unknown[] = readonly unknown[]> = {
  analyzeArgs?: AnalyzeArgs;
  event?: UserPageActionEventLike | null;
  plan?: UserPageAnalyzeActionPlanLike | null;
  ports?: UserPageAnalyzeActionControllerPorts<AnalyzeArgs>;
};

export type RunUserPageBookmarkActionControllerArgs<BookmarkArgs extends readonly unknown[] = readonly unknown[]> = {
  bookmarkArgs?: BookmarkArgs;
  event?: UserPageActionEventLike | null;
  plan?: UserPageBookmarkActionPlanLike | null;
  ports?: UserPageBookmarkActionControllerPorts<BookmarkArgs>;
};

export type RunUserPageCacheRefreshActionControllerArgs<
  CacheRefreshArgs extends readonly unknown[] = readonly unknown[],
> = {
  cacheRefreshArgs?: CacheRefreshArgs;
  event?: UserPageActionEventLike | null;
  plan?: UserPageCacheRefreshActionPlanLike | null;
  ports?: UserPageCacheRefreshActionControllerPorts<CacheRefreshArgs>;
};

export type UserPageActionControllerResult = {
  blockedReason: unknown;
  status: 'blocked' | 'disabled' | 'dispatched' | 'hidden' | 'unhandled';
};

const isBlocked = (blockedReason: unknown): boolean => !!blockedReason && blockedReason !== 'none';

const preventDefault = (event?: UserPageActionEventLike | null): void => {
  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
};

export const runUserPageAnalyzeActionController = <AnalyzeArgs extends readonly unknown[] = readonly unknown[]>({
  analyzeArgs = [] as unknown as AnalyzeArgs,
  event = null,
  plan = null,
  ports = {},
}: RunUserPageAnalyzeActionControllerArgs<AnalyzeArgs> = {}): UserPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderAnalyzeAction) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (plan.disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (typeof ports.dispatchAnalyze !== 'function') {
    return {
      blockedReason: plan.blockedReason,
      status: 'unhandled',
    };
  }

  const dispatchAnalyze = ports.dispatchAnalyze as UserPageActionDispatch<readonly unknown[]>;
  dispatchAnalyze(...(analyzeArgs || []));
  return {
    blockedReason: plan.blockedReason,
    status: 'dispatched',
  };
};

export const runUserPageBookmarkActionController = <BookmarkArgs extends readonly unknown[] = readonly unknown[]>({
  bookmarkArgs = [] as unknown as BookmarkArgs,
  event = null,
  plan = null,
  ports = {},
}: RunUserPageBookmarkActionControllerArgs<BookmarkArgs> = {}): UserPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderBookmarkAction) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (plan.disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (typeof ports.dispatchBookmark !== 'function') {
    return {
      blockedReason: plan.blockedReason,
      status: 'unhandled',
    };
  }

  const dispatchBookmark = ports.dispatchBookmark as UserPageActionDispatch<readonly unknown[]>;
  dispatchBookmark(...(bookmarkArgs || []));
  return {
    blockedReason: plan.blockedReason,
    status: 'dispatched',
  };
};

export const runUserPageCacheRefreshActionController = <
  CacheRefreshArgs extends readonly unknown[] = readonly unknown[],
>({
  cacheRefreshArgs,
  event = null,
  plan = null,
  ports = {},
}: RunUserPageCacheRefreshActionControllerArgs<CacheRefreshArgs> = {}): UserPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderCacheRefreshAction) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (plan.disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (typeof ports.dispatchCacheRefresh !== 'function') {
    return {
      blockedReason: plan.blockedReason,
      status: 'unhandled',
    };
  }

  const dispatchCacheRefresh = ports.dispatchCacheRefresh as UserPageActionDispatch<readonly unknown[]>;
  dispatchCacheRefresh(...(cacheRefreshArgs || []));
  return {
    blockedReason: plan.blockedReason,
    status: 'dispatched',
  };
};
