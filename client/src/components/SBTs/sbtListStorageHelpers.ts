import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP, SHOW_DEMO_SESSIONS } from '../../variables/appConfig.js';

type SbtListRuntimeRecord = Record<string, unknown>;

export type SbtListStorageReader = {
  getItem?: (key: string) => string | null;
};

type SbtListCreateFormCacheChecker = (args: {
  clearInvalid: true;
  migrateLegacyToSessionKey: true;
  sessionSlug: string;
}) => boolean;

type ResolveSbtListCreateGroupInitialVisibilityArgs = {
  hasCachedCreateSbtForm?: SbtListCreateFormCacheChecker | null;
  listSlug?: unknown;
};

export const SBT_LIST_MODE_SELECTION_STORAGE_KEY = 'dg:sbtListModeSelectedSessions';

const SBT_LIST_MANAGED_DG_CACHE_NAMES = new Set<string>([
  'questionsCache',
  'surveysCache',
  'bookmarksCache',
  'filters',
  'sbtCache',
  'userCache',
]);

const getDefaultSbtListStorage = (): SbtListStorageReader | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
};

const getDefaultSbtListRuntimeGlobal = (): SbtListRuntimeRecord => {
  try {
    if (typeof globalThis === 'undefined') return {};
    return globalThis as unknown as SbtListRuntimeRecord;
  } catch (_) {
    return {};
  }
};

const isSbtListRuntimeRecord = (value: unknown): value is SbtListRuntimeRecord => !!value && typeof value === 'object';

const dedupeNormalizedSbtListSlugs = (list: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(list) ? list : []).forEach((raw: unknown) => {
    const slug = normalizeSessionSlug(raw);
    if (raw == null || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

export const isSbtListManagedDgCacheName = (name: unknown): boolean =>
  SBT_LIST_MANAGED_DG_CACHE_NAMES.has(String(name || ''));

export const readStoredSbtListModeSelectedSessionSlugs = (storage?: SbtListStorageReader | null): string[] => {
  try {
    const resolvedStorage = typeof storage === 'undefined' ? getDefaultSbtListStorage() : storage;
    if (!resolvedStorage?.getItem) return [];
    const raw = resolvedStorage.getItem(SBT_LIST_MODE_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return dedupeNormalizedSbtListSlugs(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return [];
  }
};

export const resolveSbtListCreateGroupInitialVisibility = ({
  hasCachedCreateSbtForm = null,
  listSlug = '',
}: ResolveSbtListCreateGroupInitialVisibilityArgs = {}): boolean =>
  typeof hasCachedCreateSbtForm === 'function'
    ? hasCachedCreateSbtForm({
        sessionSlug: normalizeSessionSlug(listSlug || ''),
        migrateLegacyToSessionKey: true,
        clearInvalid: true,
      })
    : false;

export const readSbtListUniverseCollapsedState = (storage?: SbtListStorageReader | null): boolean => {
  try {
    const resolvedStorage = typeof storage === 'undefined' ? getDefaultSbtListStorage() : storage;
    return resolvedStorage?.getItem?.('dg:sbtUniverseCollapsed') === 'true';
  } catch (_) {
    return false;
  }
};

export const readSbtListShowDemoSessions = (
  runtimeGlobal = getDefaultSbtListRuntimeGlobal(),
  fallback: unknown = SHOW_DEMO_SESSIONS,
): boolean => {
  try {
    if (isSbtListRuntimeRecord(runtimeGlobal) && typeof runtimeGlobal.SHOW_DEMO_SESSIONS !== 'undefined') {
      return !!runtimeGlobal.SHOW_DEMO_SESSIONS;
    }
  } catch (e) {
    void e; /* fallback: demo visibility lookup. */
  }
  return !!fallback;
};

export const readSbtListSyncBarResearchBlockStep = (
  runtimeGlobal = getDefaultSbtListRuntimeGlobal(),
  fallback: unknown = CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP,
): number => {
  try {
    if (
      isSbtListRuntimeRecord(runtimeGlobal) &&
      typeof runtimeGlobal.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP !== 'undefined'
    ) {
      const runtimeValue = Number(runtimeGlobal.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP);
      if (Number.isFinite(runtimeValue) && runtimeValue > 0) {
        return Math.max(1, Math.floor(runtimeValue));
      }
    }
  } catch (e) {
    void e; /* fallback: sync-bar research step lookup. */
  }

  const defaultValue = Number(fallback || 0);
  if (Number.isFinite(defaultValue) && defaultValue > 0) {
    return Math.max(1, Math.floor(defaultValue));
  }
  return 50;
};
