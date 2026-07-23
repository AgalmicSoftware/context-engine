import { CLOUDFLARE_CORS_WORKER_URL, USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import { overlayCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';
import { parseWorkerConfig } from './sessionParsers.js';
import { resolveSessionCapabilityProjection } from './sessionCapabilityProjection.js';
import { parseSessionWorkerDiscoveryOrigin, resolveWorkerCanonicalSessionIdHex } from './sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../worker/workerUrl.js';
import type { SessionConfigLike } from './sessionTypes.js';

type WorkerConfigInput = Parameters<typeof parseWorkerConfig>[0];

type SessionWorkerAvailabilityOptions = {
  slug?: unknown;
  sessionConfig?: unknown;
  allowSharedFallback?: boolean;
  requireExactWorkerSession?: boolean;
};

const isObj = (value: unknown): value is SessionConfigLike =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const getConfiguredSessionWorkerUrlFromConfig = (sessionConfig: unknown = null): string => {
  const parsed = parseWorkerConfig(sessionConfig as WorkerConfigInput);
  const canonicalUrl = normalizeWorkerUrl(parsed?.config?.corsWorkerUrl || '');
  return canonicalUrl;
};

export const resolveConfiguredSessionWorkerUrlFromConfig = (sessionConfig: unknown = null): string =>
  getConfiguredSessionWorkerUrlFromConfig(sessionConfig);

export const getSharedFallbackWorkerUrl = (): string => normalizeWorkerUrl(CLOUDFLARE_CORS_WORKER_URL);

export const shouldUseSharedFallbackWorkerUrl = ({
  slug,
  sessionConfig,
}: SessionWorkerAvailabilityOptions = {}): boolean => {
  const sessionConfigSource = isObj(sessionConfig) ? sessionConfig : null;
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfigSource?.slug ?? '');
  if (normalizedSlug !== '') return false;
  if (!USE_ONCHAIN_SESSION_REGISTRY) return false;
  const baseConfig = sessionConfigSource;
  if (!baseConfig) return false;
  if (resolveConfiguredSessionWorkerUrlFromConfig(baseConfig)) {
    return false;
  }
  return !isObj(baseConfig.__registry);
};

const getEffectiveSessionWorkerConfig = ({
  slug,
  sessionConfig,
}: SessionWorkerAvailabilityOptions = {}): SessionConfigLike | null => {
  const baseConfig = isObj(sessionConfig) ? sessionConfig : null;
  const normalizedSlug = canonicalizeSessionSlug(slug ?? baseConfig?.slug ?? '');
  return (
    overlayCachedSessionWorkerConfig({
      slug: normalizedSlug,
      sessionConfig: baseConfig,
    }) || baseConfig
  );
};

export const getUsableSessionWorkerUrl = ({
  slug,
  sessionConfig,
  allowSharedFallback = false,
  requireExactWorkerSession = false,
}: SessionWorkerAvailabilityOptions = {}): string => {
  const sessionConfigSource = isObj(sessionConfig) ? sessionConfig : null;
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfigSource?.slug ?? '');
  if (requireExactWorkerSession) {
    const configuredSlug = canonicalizeSessionSlug(sessionConfigSource?.slug ?? '');
    const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfigSource);
    const projection = resolveSessionCapabilityProjection(sessionConfigSource);
    if (
      !normalizedSlug ||
      configuredSlug !== normalizedSlug ||
      !sessionId ||
      projection.source !== 'profile' ||
      !projection.profileValid ||
      !projection.isWorkerCanonical
    ) {
      return '';
    }
    // Exact Worker-native routes are pinned to the already validated canonical
    // config. A generic slug cache replica may refresh non-authoritative read
    // paths, but it must never repoint Groups to a different Worker origin.
    try {
      return parseSessionWorkerDiscoveryOrigin(resolveConfiguredSessionWorkerUrlFromConfig(sessionConfigSource));
    } catch {
      return '';
    }
  }
  const effectiveSessionConfig = getEffectiveSessionWorkerConfig({
    slug: normalizedSlug,
    sessionConfig,
  });
  const configuredUrl = shouldUseSharedFallbackWorkerUrl({
    slug: normalizedSlug,
    sessionConfig: effectiveSessionConfig,
  })
    ? ''
    : resolveConfiguredSessionWorkerUrlFromConfig(effectiveSessionConfig);
  if (configuredUrl) return configuredUrl;
  if (allowSharedFallback && normalizedSlug === '') {
    return getSharedFallbackWorkerUrl();
  }
  return '';
};

export const hasUsableSessionWorkerConfig = ({
  slug,
  sessionConfig,
  allowSharedFallback = true,
}: SessionWorkerAvailabilityOptions = {}): boolean => {
  const sessionConfigSource = isObj(sessionConfig) ? sessionConfig : null;
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfigSource?.slug ?? '');
  return (
    getUsableSessionWorkerUrl({
      slug: normalizedSlug,
      sessionConfig,
      allowSharedFallback,
    }).length > 0
  );
};
