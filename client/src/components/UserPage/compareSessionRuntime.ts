import { normalizeSessionSlug, resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';

type UnknownRecord = Record<string, unknown>;

type CompareCacheEntry = {
  slug?: unknown;
  value?: unknown;
};

export type CompareSessionScope = { kind: 'session'; slug: string };

type ResolveCompareSessionScopeOptions = {
  activeSessionSlug?: unknown;
  pathname?: unknown;
  search?: unknown;
};

type ScanCompareAddressesOptions = {
  addresses?: unknown[];
  sessionSlug?: unknown;
  scanSpecificUserProfile?: ((address: string) => Promise<unknown> | unknown) | null;
  seen?: Set<string>;
};

type CompareSectionTask = () => Promise<void> | void;

export type CompareProfileScanFailure = {
  address: string;
  error: unknown;
};

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const COMPARE_GRAPHIC_FILENAME = 'contextEngine_comparisonGraphic.png';

export const resolveCompareRunLabel = (sessionCachesReady?: boolean): string =>
  sessionCachesReady === false ? 'Loading session data…' : 'Comparing';

export const runCompareSectionTasks = (tasks: CompareSectionTask[] = []): Promise<PromiseSettledResult<void>[]> => {
  const pending = (Array.isArray(tasks) ? tasks : []).map((task) => {
    try {
      return Promise.resolve(task());
    } catch (error) {
      return Promise.reject(error);
    }
  });
  return Promise.allSettled(pending);
};

export const resolveCompareSessionScope = ({
  activeSessionSlug,
  pathname = '',
  search = '',
}: ResolveCompareSessionScopeOptions = {}): CompareSessionScope => {
  const scope = (slug: unknown): CompareSessionScope => ({ kind: 'session', slug: normalizeSessionSlug(slug) });
  const query = new URLSearchParams(String(search || ''));
  // Comparison URLs carry the profile's session even if the global picker lags behind navigation.
  if (/^\/compare(?:\/|$)/.test(String(pathname)) && query.has('session')) return scope(query.get('session'));
  if (activeSessionSlug != null) return scope(activeSessionSlug);
  if (query.has('session')) return scope(query.get('session'));
  return scope(resolveSessionSlugFromPathname(pathname) || '');
};

export const resolveCompareCachesReady = ({
  onChainProfileEnabled,
  isAllCachesReady,
  isQuestionCacheReady,
  isSurveyCacheReady,
  isResponsesCacheReady,
}: {
  onChainProfileEnabled?: boolean;
  isAllCachesReady?: boolean;
  isQuestionCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
}): boolean | undefined =>
  onChainProfileEnabled === false
    ? !!(isQuestionCacheReady && isSurveyCacheReady && isResponsesCacheReady)
    : isAllCachesReady;

export const selectCompareCacheValues = (
  entries: CompareCacheEntry[] = [],
  scope: CompareSessionScope = { kind: 'session', slug: '' },
): UnknownRecord[] => {
  const normalizedSessionSlug = normalizeSessionSlug(scope.slug);
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => normalizeSessionSlug(entry?.slug ?? '') === normalizedSessionSlug)
    .map((entry) => entry?.value)
    .filter(isUnknownRecord);
};

export const scanCompareAddressesSequentially = async ({
  addresses = [],
  sessionSlug = '',
  scanSpecificUserProfile,
  seen = new Set<string>(),
}: ScanCompareAddressesOptions = {}): Promise<CompareProfileScanFailure[]> => {
  if (typeof scanSpecificUserProfile !== 'function') return [];
  const failures: CompareProfileScanFailure[] = [];
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);

  for (const rawAddress of Array.isArray(addresses) ? addresses : []) {
    const address = String(rawAddress || '').trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) continue;
    const scanKey = `${normalizedSessionSlug}:${address.toLowerCase()}`;
    if (seen.has(scanKey)) continue;
    seen.add(scanKey);
    try {
      await scanSpecificUserProfile(address);
    } catch (error) {
      seen.delete(scanKey);
      failures.push({ address, error });
    }
  }

  return failures;
};
