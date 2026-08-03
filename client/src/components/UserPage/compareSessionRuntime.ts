import { normalizeSessionSlug, resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';

type UnknownRecord = Record<string, unknown>;

type CompareCacheEntry = {
  slug?: unknown;
  value?: unknown;
};

type ResolveCompareSessionSlugOptions = {
  activeSessionSlug?: unknown;
  pathname?: unknown;
  search?: unknown;
};

type BuildCompareRoutePathOptions = {
  addresses?: unknown[];
  sessionSlug?: unknown;
  search?: unknown;
};

type ScanCompareAddressesOptions = {
  addresses?: unknown[];
  sessionSlug?: unknown;
  scanSpecificUserProfile?: ((address: string) => Promise<unknown> | unknown) | null;
  seen?: Set<string>;
};

export type CompareProfileScanFailure = {
  address: string;
  error: unknown;
};

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const resolveCompareSessionSlug = ({
  activeSessionSlug,
  pathname = '',
  search = '',
}: ResolveCompareSessionSlugOptions = {}): string => {
  const explicit = normalizeSessionSlug(activeSessionSlug ?? '');
  if (explicit) return explicit;

  try {
    const querySlug = normalizeSessionSlug(new URLSearchParams(String(search || '')).get('session') || '');
    if (querySlug) return querySlug;
  } catch {
    // Fall through to the path resolver for malformed or unavailable query state.
  }

  return normalizeSessionSlug(resolveSessionSlugFromPathname(pathname) || '');
};

export const buildCompareRoutePath = ({
  addresses = [],
  sessionSlug = '',
  search = '',
}: BuildCompareRoutePathOptions = {}): string => {
  const addressPath = (Array.isArray(addresses) ? addresses : [])
    .map((address) => String(address || '').trim())
    .filter(Boolean)
    .join('&');
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  if (normalizedSessionSlug) params.set('session', normalizedSessionSlug);
  const query = params.toString();
  return `/compare/${addressPath}${query ? `?${query}` : ''}`;
};

export const selectCompareCacheValues = (
  entries: CompareCacheEntry[] = [],
  sessionSlug: unknown = '',
): UnknownRecord[] => {
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  return (Array.isArray(entries) ? entries : [])
    .filter(
      (entry) =>
        !normalizedSessionSlug || normalizeSessionSlug(entry?.slug ?? '') === normalizedSessionSlug,
    )
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
