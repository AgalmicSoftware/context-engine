import {
  FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY,
  consumeOneTimeFirstVisitRootRedirect,
  consumeSessionFallbackRedirect,
  getFirstVisitRootRedirectTarget,
  getSessionFallbackPreferredTarget,
  getSessionFallbackRedirectStorageKey,
  getSessionFallbackScopeSlugs,
  getTemporaryInitialLoadAboutRedirectTarget,
  hasConsumedOneTimeFirstVisitRootRedirect,
  hasConsumedSessionFallbackRedirect,
  isFirstVisitRootRedirectEnabled,
  isTemporaryInitialLoadAboutRedirectPath,
  shouldForceOneTimeFirstVisitRootRedirect,
} from './sessionFallbackRedirect.js';

const GLOBAL_FIRST_VISIT_REDIRECT_KEY = 'CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED';
const runtimeGlobals = globalThis as typeof globalThis & Record<string, unknown>;

const normalizeSessionSlug = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeRoutePath = (value: unknown): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === '/') return '/';
  const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
};

describe('sessionFallbackRedirect', () => {
  beforeEach(() => {
    delete runtimeGlobals[GLOBAL_FIRST_VISIT_REDIRECT_KEY];
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete runtimeGlobals[GLOBAL_FIRST_VISIT_REDIRECT_KEY];
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('getSessionFallbackScopeSlugs', () => {
    it('deduplicates normalized slugs in list mode', () => {
      expect(
        getSessionFallbackScopeSlugs({
          readSessionScanScope: () => ' list ',
          readSessionScanSlugs: () => [' Alpha ', 'alpha', 'beta', 'BETA'],
          sessionRegistryStore: {
            getAllSessionEntries: jest.fn(() => []),
          },
          normalizeSessionSlug,
        }),
      ).toEqual(['alpha', 'beta']);
    });

    it('returns empty outside list mode', () => {
      const readSessionScanSlugs = jest.fn(() => ['alpha']);

      expect(
        getSessionFallbackScopeSlugs({
          readSessionScanScope: () => 'active',
          readSessionScanSlugs,
          sessionRegistryStore: {
            getAllSessionEntries: jest.fn(() => []),
          },
          normalizeSessionSlug,
        }),
      ).toEqual([]);
      expect(readSessionScanSlugs).not.toHaveBeenCalled();
    });

    it('falls back to registry entries when the runtime list is empty', () => {
      expect(
        getSessionFallbackScopeSlugs({
          readSessionScanScope: () => 'list',
          readSessionScanSlugs: () => [],
          sessionRegistryStore: {
            getAllSessionEntries: jest.fn(() => [
              ['alpha-key', { slug: ' Alpha ' }],
              { sessionSlug: 'Beta' },
              ['duplicate-alpha-key', { slug: 'alpha' }],
            ]),
          },
          normalizeSessionSlug,
        }),
      ).toEqual(['alpha', 'beta']);
    });
  });

  describe('getSessionFallbackPreferredTarget', () => {
    it('returns the first non-general scoped slug', () => {
      expect(
        getSessionFallbackPreferredTarget(['alpha', 'beta'], {
          DEFAULT_SESSION_SLUG_ALIAS: 'general',
        }),
      ).toEqual({
        slug: 'alpha',
        path: '/session/alpha',
      });
    });

    it('returns null when general is first', () => {
      expect(
        getSessionFallbackPreferredTarget(['general', 'alpha'], {
          DEFAULT_SESSION_SLUG_ALIAS: 'general',
        }),
      ).toBeNull();
    });

    it('returns null when no slugs are scoped', () => {
      expect(
        getSessionFallbackPreferredTarget([], {
          DEFAULT_SESSION_SLUG_ALIAS: 'general',
        }),
      ).toBeNull();
    });
  });

  describe('isFirstVisitRootRedirectEnabled', () => {
    it('uses the globalThis override when present', () => {
      runtimeGlobals[GLOBAL_FIRST_VISIT_REDIRECT_KEY] = 'yes';
      const readBoolishRuntimeFlag = jest.fn(() => true);

      expect(
        isFirstVisitRootRedirectEnabled({
          readBoolishRuntimeFlag,
          CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED: false,
        }),
      ).toBe(true);
      expect(readBoolishRuntimeFlag).toHaveBeenCalledWith('yes', false);
    });

    it('falls back to the build-time constant', () => {
      const readBoolishRuntimeFlag = jest.fn(() => false);

      expect(
        isFirstVisitRootRedirectEnabled({
          readBoolishRuntimeFlag,
          CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED: true,
        }),
      ).toBe(true);
      expect(readBoolishRuntimeFlag).not.toHaveBeenCalled();
    });
  });

  describe('getFirstVisitRootRedirectTarget', () => {
    it('uses the public about route when enabled', () => {
      expect(
        getFirstVisitRootRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => true,
        }),
      ).toEqual({
        path: '/about',
      });
    });

    it('returns null when disabled', () => {
      expect(
        getFirstVisitRootRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => false,
        }),
      ).toBeNull();
    });
  });

  describe('temporary initial-load about redirect', () => {
    it('matches root and concrete session pages while excluding the session wizard', () => {
      expect(isTemporaryInitialLoadAboutRedirectPath('/', { normalizeRoutePath })).toBe(true);
      expect(isTemporaryInitialLoadAboutRedirectPath('/session/demo-1', { normalizeRoutePath })).toBe(true);
      expect(isTemporaryInitialLoadAboutRedirectPath('/session/demo-1/questions/results', { normalizeRoutePath })).toBe(
        true,
      );
      expect(isTemporaryInitialLoadAboutRedirectPath('/session/new', { normalizeRoutePath })).toBe(false);
      expect(isTemporaryInitialLoadAboutRedirectPath('/session/new/details', { normalizeRoutePath })).toBe(false);
      expect(isTemporaryInitialLoadAboutRedirectPath('/about', { normalizeRoutePath })).toBe(false);
    });

    it('returns the about target only when the redirect flag is enabled', () => {
      expect(
        getTemporaryInitialLoadAboutRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => true,
          normalizeRoutePath,
          normalizeSessionSlug,
          pathIn: '/',
        }),
      ).toEqual({ path: '/about' });
      expect(
        getTemporaryInitialLoadAboutRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => true,
          normalizeRoutePath,
          normalizeSessionSlug,
          pathIn: '/session/demo-1',
        }),
      ).toEqual({
        path: '/about',
        cacheSlug: 'demo-1',
        requiresPersistedCache: true,
      });
      expect(
        getTemporaryInitialLoadAboutRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => false,
          normalizeRoutePath,
          normalizeSessionSlug,
          pathIn: '/session/demo-1',
        }),
      ).toBeNull();
    });

    it('lets callers restrict session about redirects to temporary demo slugs', () => {
      const isTemporaryInitialLoadAboutRedirectSessionSlug = jest.fn((slug: string) => slug === 'demo-1');

      expect(
        getTemporaryInitialLoadAboutRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => true,
          isTemporaryInitialLoadAboutRedirectSessionSlug,
          normalizeRoutePath,
          normalizeSessionSlug,
          pathIn: '/session/demo-1/questions/results',
        }),
      ).toEqual({
        path: '/about',
        cacheSlug: 'demo-1',
        requiresPersistedCache: true,
      });
      expect(
        getTemporaryInitialLoadAboutRedirectTarget({
          isFirstVisitRootRedirectEnabled: () => true,
          isTemporaryInitialLoadAboutRedirectSessionSlug,
          normalizeRoutePath,
          normalizeSessionSlug,
          pathIn: '/session/e2e-custom-20260623-113657/questions',
        }),
      ).toBeNull();
    });
  });

  describe('one-time first-visit root redirect consumption', () => {
    it('forces the redirect until the versioned consumed key is written', () => {
      expect(hasConsumedOneTimeFirstVisitRootRedirect(window.localStorage)).toBe(false);
      expect(shouldForceOneTimeFirstVisitRootRedirect(window.localStorage)).toBe(true);

      expect(
        consumeOneTimeFirstVisitRootRedirect(window.localStorage, {
          firstVisitStorageKey: 'firstVisit',
        }),
      ).toBe(true);

      expect(window.localStorage.getItem(FIRST_VISIT_ROOT_REDIRECT_CONSUMED_STORAGE_KEY)).toBe('true');
      expect(window.localStorage.getItem('firstVisit')).toBe('false');
      expect(hasConsumedOneTimeFirstVisitRootRedirect(window.localStorage)).toBe(true);
      expect(shouldForceOneTimeFirstVisitRootRedirect(window.localStorage)).toBe(false);
    });

    it('does not force the redirect when storage is unavailable', () => {
      expect(hasConsumedOneTimeFirstVisitRootRedirect(null)).toBe(true);
      expect(shouldForceOneTimeFirstVisitRootRedirect(null)).toBe(false);
      expect(consumeOneTimeFirstVisitRootRedirect(null)).toBe(false);
    });
  });

  describe('getSessionFallbackRedirectStorageKey', () => {
    it('builds a scoped storage key with a slug', () => {
      expect(
        getSessionFallbackRedirectStorageKey(' Edge ', {
          normalizeSessionSlug,
          DEFAULT_SESSION_SLUG_ALIAS: 'general',
          SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX: 'seen:',
        }),
      ).toBe('seen:edge');
    });

    it('uses the default alias without a slug', () => {
      expect(
        getSessionFallbackRedirectStorageKey('', {
          normalizeSessionSlug,
          DEFAULT_SESSION_SLUG_ALIAS: 'general',
          SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX: 'seen:',
        }),
      ).toBe('seen:general');
    });
  });

  describe('session fallback redirect consumption', () => {
    it('reads and writes consumed targets from sessionStorage', () => {
      const target = { slug: 'edge', path: '/session/edge' };
      const getStorageKey = jest.fn((slug: unknown) => `seen:${slug || 'general'}`);

      expect(hasConsumedSessionFallbackRedirect(target, { getStorageKey })).toBe(false);
      expect(consumeSessionFallbackRedirect(target, { getStorageKey })).toBe(true);
      expect(window.sessionStorage.getItem('seen:edge')).toBe('true');
      expect(hasConsumedSessionFallbackRedirect(target, { getStorageKey })).toBe(true);
    });

    it('ignores null targets', () => {
      const getStorageKey = jest.fn((slug: unknown) => `seen:${slug || 'general'}`);

      expect(hasConsumedSessionFallbackRedirect(null, { getStorageKey })).toBe(false);
      expect(consumeSessionFallbackRedirect(null, { getStorageKey })).toBe(false);
      expect(getStorageKey).not.toHaveBeenCalled();
    });
  });
});
