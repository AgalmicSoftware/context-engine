export type SessionFallbackRedirectTarget = {
  slug: string;
  path: string;
};

export type FirstVisitRootRedirectTarget = {
  path: string;
  cacheSlug?: string;
  requiresPersistedCache?: boolean;
};

type FirstVisitRootRedirectStorage =
  | {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
    }
  | null
  | undefined;

type SessionFallbackRedirectStorageTarget = {
  slug?: string;
  path?: string;
} | null;

type SessionRegistryStoreLike = {
  getAllSessionEntries: () => unknown;
};

type NormalizeSessionSlugFn = (slug: unknown) => string;

const isGeneralSessionSlug = (slug: unknown, defaultAlias: string): boolean => slug === '' || slug === defaultAlias;

export const FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY = 'ce:firstVisitRootAboutRedirectConsumed:v20260618b';

const dedupeNormalizedSessionSlugs = (values: unknown, normalizeSessionSlug: NormalizeSessionSlugFn): string[] => {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const normalized = normalizeSessionSlug(value || '');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });

  return out;
};

export const getSessionFallbackScopeSlugs = (deps: {
  readSessionScanScope: () => unknown;
  readSessionScanSlugs: () => unknown;
  sessionRegistryStore: SessionRegistryStoreLike;
  normalizeSessionSlug: NormalizeSessionSlugFn;
}): string[] => {
  const scope = String(deps.readSessionScanScope() || '')
    .trim()
    .toLowerCase();
  if (scope !== 'list') return [];

  const runtimeScopeSlugs = dedupeNormalizedSessionSlugs(deps.readSessionScanSlugs(), deps.normalizeSessionSlug);
  if (runtimeScopeSlugs.length) return runtimeScopeSlugs;

  try {
    const entries = deps.sessionRegistryStore.getAllSessionEntries();
    if (!Array.isArray(entries) || !entries.length) return [];

    return dedupeNormalizedSessionSlugs(
      entries.map((entry) => {
        const cfg = (Array.isArray(entry) ? entry[1] : entry) as
          | {
              slug?: unknown;
              sessionSlug?: unknown;
            }
          | null
          | undefined;
        return cfg?.slug || cfg?.sessionSlug || '';
      }),
      deps.normalizeSessionSlug,
    );
  } catch (_) {
    return [];
  }
};

export const getSessionFallbackPreferredTarget = (
  scopeSlugs: string[],
  deps: { DEFAULT_SESSION_SLUG_ALIAS: string },
): SessionFallbackRedirectTarget | null => {
  if (!scopeSlugs.length) return null;

  const generalInScope = scopeSlugs.some((slug) => isGeneralSessionSlug(slug, deps.DEFAULT_SESSION_SLUG_ALIAS));
  if (generalInScope) return null;

  const firstScopedSlug = scopeSlugs.find(
    (slug) => slug && !isGeneralSessionSlug(slug, deps.DEFAULT_SESSION_SLUG_ALIAS),
  );
  if (!firstScopedSlug) return null;

  return {
    slug: firstScopedSlug,
    path: `/session/${firstScopedSlug}`,
  };
};

export const isFirstVisitRootRedirectEnabled = (deps: {
  readBoolishRuntimeFlag: (raw: unknown, fallback?: boolean) => boolean;
  CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED: unknown;
}): boolean => {
  const buildTimeFallback = !!deps.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED;

  try {
    if (typeof globalThis !== 'undefined') {
      const runtimeGlobals = globalThis as Record<string, unknown>;
      if (typeof runtimeGlobals.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED !== 'undefined') {
        return deps.readBoolishRuntimeFlag(runtimeGlobals.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED, buildTimeFallback);
      }
    }
  } catch (_) {}

  return buildTimeFallback;
};

export const getFirstVisitRootRedirectTarget = (deps: {
  isFirstVisitRootRedirectEnabled: () => boolean;
}): FirstVisitRootRedirectTarget | null => {
  if (!deps.isFirstVisitRootRedirectEnabled()) return null;

  return {
    path: '/about',
  };
};

const getTemporaryInitialLoadSessionCacheSlug = (
  normalizedPath: string,
  normalizeSessionSlug: NormalizeSessionSlugFn,
): string => {
  if (!normalizedPath.startsWith('/session/')) return '';
  const token = normalizedPath.slice('/session/'.length).split('/')[0];
  return normalizeSessionSlug(token || '');
};

// Temporary demo-launch guard: root loads go to /about, and cached session
// document loads may go to /about while stale pages retire.
export const isTemporaryInitialLoadAboutRedirectPath = (
  pathIn: unknown,
  deps: { normalizeRoutePath: NormalizeSessionSlugFn },
): boolean => {
  const path = deps.normalizeRoutePath(pathIn || '');
  if (path === '/') return true;
  if (!path.startsWith('/session/')) return false;
  return path !== '/session/new' && !path.startsWith('/session/new/');
};

export const getTemporaryInitialLoadAboutRedirectTarget = (deps: {
  isFirstVisitRootRedirectEnabled: () => boolean;
  isTemporaryInitialLoadAboutRedirectSessionSlug?: (slug: string) => boolean;
  normalizeRoutePath: NormalizeSessionSlugFn;
  normalizeSessionSlug: NormalizeSessionSlugFn;
  pathIn: unknown;
}): FirstVisitRootRedirectTarget | null => {
  if (!deps.isFirstVisitRootRedirectEnabled()) return null;
  const path = deps.normalizeRoutePath(deps.pathIn || '');
  if (
    !isTemporaryInitialLoadAboutRedirectPath(path, {
      normalizeRoutePath: deps.normalizeRoutePath,
    })
  ) {
    return null;
  }

  const cacheSlug = getTemporaryInitialLoadSessionCacheSlug(path, deps.normalizeSessionSlug);
  if (cacheSlug) {
    if (
      typeof deps.isTemporaryInitialLoadAboutRedirectSessionSlug === 'function' &&
      !deps.isTemporaryInitialLoadAboutRedirectSessionSlug(cacheSlug)
    ) {
      return null;
    }
    return {
      path: '/about',
      cacheSlug,
      requiresPersistedCache: true,
    };
  }

  return {
    path: '/about',
  };
};

export const hasConsumedOneTimeFirstVisitRootRedirect = (storage: FirstVisitRootRedirectStorage): boolean => {
  if (!storage) return true;

  try {
    return storage.getItem(FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY) === 'true';
  } catch (_) {
    return true;
  }
};

export const shouldForceOneTimeFirstVisitRootRedirect = (storage: FirstVisitRootRedirectStorage): boolean =>
  !hasConsumedOneTimeFirstVisitRootRedirect(storage);

export const consumeOneTimeFirstVisitRootRedirect = (
  storage: FirstVisitRootRedirectStorage,
  deps: { firstVisitStorageKey?: string } = {},
): boolean => {
  if (!storage) return false;

  try {
    storage.setItem(FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY, 'true');
    if (deps.firstVisitStorageKey) {
      storage.setItem(deps.firstVisitStorageKey, 'false');
    }
    return true;
  } catch (_) {
    return false;
  }
};

export const getSessionFallbackRedirectStorageKey = (
  slugIn: unknown,
  deps: {
    normalizeSessionSlug: NormalizeSessionSlugFn;
    DEFAULT_SESSION_SLUG_ALIAS: string;
    SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX: string;
  },
): string => {
  const normalizedSlug = deps.normalizeSessionSlug(slugIn || '');
  const storageSlug = normalizedSlug || deps.DEFAULT_SESSION_SLUG_ALIAS;
  return `${deps.SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX}${storageSlug}`;
};

export const hasConsumedSessionFallbackRedirect = (
  target: SessionFallbackRedirectStorageTarget,
  deps: { getStorageKey: (slug: unknown) => string },
): boolean => {
  if (typeof window === 'undefined' || !window.sessionStorage || !target?.path) {
    return false;
  }

  try {
    return window.sessionStorage.getItem(deps.getStorageKey(target.slug)) === 'true';
  } catch (_) {
    return false;
  }
};

export const consumeSessionFallbackRedirect = (
  target: SessionFallbackRedirectStorageTarget,
  deps: { getStorageKey: (slug: unknown) => string },
): boolean => {
  if (typeof window === 'undefined' || !window.sessionStorage || !target?.path) {
    return false;
  }

  try {
    window.sessionStorage.setItem(deps.getStorageKey(target.slug), 'true');
    return true;
  } catch (_) {
    return false;
  }
};
