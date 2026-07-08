import { normalizeBaseUrl } from '../urlUtils.js';

const WORKER_ENDPOINT_SUFFIXES = [
  '/auth/nonce',
  '/auth/login',
  '/admin/set-config',
  '/admin/set-secrets',
  '/admin/set-limits',
  '/admin/secret-presence',
  '/transcribe',
  '/ai',
  '/arweave/upload',
  '/fetch_url',
  '/fetch_image',
  '/fetch',
  '/health',
];

export const normalizeWorkerBaseUrl = (rawUrl: unknown): string => {
  const base = normalizeBaseUrl(rawUrl || '');
  if (!base) return '';
  try {
    const parsed = new URL(base);
    const rawPath = String(parsed.pathname || '').replace(/\/+$/, '');
    const lowerPath = rawPath.toLowerCase();
    for (const suffix of WORKER_ENDPOINT_SUFFIXES) {
      if (lowerPath === suffix) {
        return parsed.origin;
      }
      if (lowerPath.endsWith(suffix)) {
        const nextPath = rawPath.slice(0, rawPath.length - suffix.length).replace(/\/+$/, '');
        return nextPath ? `${parsed.origin}${nextPath}` : parsed.origin;
      }
    }
    return base;
  } catch {
    return base;
  }
};

export const normalizeUploadSessionSlug = (raw: unknown): string => {
  const slug = String(raw ?? '').trim();
  if (!slug || slug === 'general') return '';
  return slug;
};

export const resolveUploadSessionSlug = (opts: { sessionSlug?: unknown; sessionConfig?: { slug?: unknown } } = {}) => {
  if (Object.prototype.hasOwnProperty.call(opts, 'sessionSlug')) {
    return normalizeUploadSessionSlug(opts.sessionSlug);
  }
  const config = opts?.sessionConfig || {};
  return normalizeUploadSessionSlug(config?.slug || '');
};

export const resolveUploadSlugField = (): 'sessionSlug' => 'sessionSlug';

export const isGateUnavailableError = (message = ''): boolean =>
  /on-chain gate data unavailable/i.test(String(message || ''));

export const isWorkerAuthRouteUnsupportedError = (message = ''): boolean =>
  /worker auth (?:nonce|login) route not supported \(404\)/i.test(String(message || ''));

export const isWorkerMissingArweaveKeyError = (message = ''): boolean =>
  /arweave key not configured/i.test(String(message || ''));

export const isWorkerMissingSessionSecretsError = (message = ''): boolean =>
  /session secrets not configured/i.test(String(message || ''));

export const isTransientWorkerUploadError = ({
  message = '',
  status = null,
}: {
  message?: unknown;
  status?: unknown;
} = {}): boolean => {
  const normalizedMessage = String(message || '')
    .trim()
    .toLowerCase();
  const normalizedStatus = Number(status || 0) || 0;
  if (
    normalizedMessage.includes('could not getprice') ||
    normalizedMessage.includes('bad gateway') ||
    normalizedMessage.includes('gateway timeout') ||
    normalizedMessage.includes('temporary internal error')
  ) {
    return true;
  }
  return normalizedStatus === 502 || normalizedStatus === 503 || normalizedStatus === 504;
};

export const shouldFallbackUploadCandidate = ({ message = '' }: { message?: unknown } = {}): boolean =>
  isGateUnavailableError(String(message || '')) ||
  isWorkerAuthRouteUnsupportedError(String(message || '')) ||
  isWorkerMissingArweaveKeyError(String(message || ''));

export const getGateSnapshotSbtAddresses = (snapshot: unknown = null): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: unknown) => {
    const addr = String(value || '').trim();
    if (!addr) return;
    const key = addr.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(addr);
  };
  const value = snapshot as { sbtAddresses?: unknown; sbtAddress?: unknown } | null;
  if (Array.isArray(value?.sbtAddresses)) {
    value.sbtAddresses.forEach(push);
  }
  push(value?.sbtAddress);
  return out;
};

export const hasSponsoredArweaveKey = (sessionConfig: unknown = null): boolean => {
  const config = sessionConfig as { sponsoredKeys?: { arweave?: unknown } } | null;
  const value = config?.sponsoredKeys?.arweave;
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const getUploadCandidateReasonPriority = (reason = ''): number => {
  const normalized = String(reason || '')
    .trim()
    .toLowerCase();
  if (normalized === 'sponsored-referrer') return 0;
  if (normalized === 'shared-fallback') return 1;
  if (normalized === 'scope-list') return 2;
  return 3;
};

export const classifyUploadGateStatus = (sessionConfig: unknown = null, resourceKey = 'arweave') => {
  const config = sessionConfig as {
    __registry?: {
      gateAuthority?: unknown;
      gatesByResource?: Record<string, unknown>;
    };
  } | null;
  const registry = config?.__registry && typeof config.__registry === 'object' ? config.__registry : {};
  const gateAuthority = String(registry?.gateAuthority || '')
    .trim()
    .toLowerCase();
  const gatesByResource =
    registry?.gatesByResource && typeof registry.gatesByResource === 'object' ? registry.gatesByResource : null;
  const primaryKey = String(resourceKey || '').trim() || 'arweave';

  const readStatusForKey = (key: string) => {
    if (gateAuthority !== 'onchain') {
      return { key, status: 'unknown' };
    }
    if (!gatesByResource) {
      return { key, status: 'unavailable' };
    }
    const snapshot = gatesByResource[key] as { lookupStatus?: unknown; sbtAddresses?: unknown; sbtAddress?: unknown };
    if (!snapshot || typeof snapshot !== 'object') {
      return { key, status: 'missing' };
    }
    const lookupStatus = String(snapshot.lookupStatus || '')
      .trim()
      .toLowerCase();
    if (lookupStatus !== 'ok') {
      return { key, status: 'unresolved' };
    }
    const sbtAddresses = getGateSnapshotSbtAddresses(snapshot);
    if (!sbtAddresses.length) {
      return { key, status: 'no-gate' };
    }
    return { key, status: 'restricted' };
  };

  const primary = readStatusForKey(primaryKey);
  const fallback = primaryKey === 'default' ? null : readStatusForKey('default');
  const allowsPrimary = primary.status === 'no-gate';
  const allowsFallback = fallback?.status === 'no-gate';
  const selectedKey = allowsPrimary ? primary.key : allowsFallback ? fallback.key : primary.key;
  const selectedStatus = allowsPrimary ? primary.status : allowsFallback ? fallback.status : primary.status;
  const preferenceRank =
    selectedStatus === 'no-gate'
      ? selectedKey === primaryKey
        ? 0
        : 1
      : selectedStatus === 'unknown' || selectedStatus === 'missing'
        ? 2
        : 3;
  return {
    gateStatus: fallback
      ? `${primary.key}:${primary.status}|default:${fallback.status}`
      : `${primary.key}:${primary.status}`,
    allowsArweaveUpload: selectedStatus === 'no-gate',
    preferenceRank,
  };
};
