import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import { parseWorkerConfig } from './sessionParsers.js';
import { readConfiguredSessionWorkerUrlCandidate } from './sessionWorkerUrlCompatibility.js';
import { normalizeSessionIdHex } from '../shared/primitives.js';
import { normalizeWorkerUrl } from '../worker/workerUrl.js';
import type {
  SessionConfigLike,
  SessionWorkerConfig,
  SessionWorkerConfigFieldPresence,
  SessionWorkerConfigReplica,
  SessionWorkerConfigReplicaMeta,
  UnknownRecord,
  WorkerConfigRecord,
} from './sessionTypes.js';

type WorkerConfig = SessionWorkerConfig;
type WorkerConfigFieldPresence = SessionWorkerConfigFieldPresence;
type WorkerCanonicalBootstrapRecord = WorkerConfigRecord & {
  authorityMode?: string;
  canonicalConfig?: SessionConfigLike;
  configRevision?: string;
  workerOrigin?: string;
};
type CacheIdentity = {
  slug: string;
  sessionIdHex: string;
  registryChainId: number | null;
};
type WorkerConfigStore = {
  v: number;
  bySession: Record<string, WorkerConfigRecord>;
  slugIndex: Record<string, string | null>;
};
type VisibleCachedWorkerConfig = {
  corsWorkerUrl: string;
  allowOrigins?: string[];
  limits?: UnknownRecord;
  rpcEndpoint?: string;
  embeddedDeployHelperEnabled?: boolean;
  litCredentials?: UnknownRecord;
} | null;
type ReplicaMeta = SessionWorkerConfigReplicaMeta;
type CacheLookupArgs = {
  slug?: unknown;
  sessionConfig?: unknown;
};
type CacheIdentityInput = {
  slug?: unknown;
  sessionConfig?: unknown;
  sessionIdHex?: unknown;
  registryChainId?: unknown;
};
type SessionWorkerConfigReplicaState = {
  sessionConfig: SessionWorkerConfigReplica | null;
  cachedConfig: WorkerConfig | null;
  cacheApplied: boolean;
  cacheUpdatedAtMs: number | null;
  registryUpdatedAtMs: number | null;
  reason: string;
};
type UpsertCachedSessionWorkerConfigArgs = {
  slug?: unknown;
  config?: unknown;
  sessionConfig?: unknown;
  sessionIdHex?: unknown;
  registryChainId?: unknown;
};

const WORKER_CONFIG_CACHE_KEY = 'ce:sessionWorkerConfigCache:v1';
const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
const WORKER_CONFIG_CACHE_VERSION = 3;
const WORKER_CONFIG_REPLICA_META = '__workerConfigReplicaMeta';
const SESSION_WORKER_CACHE_KEY_PREFIX = 'session:';
const SLUG_WORKER_CACHE_KEY_PREFIX = 'slug:';
const verifiedWorkerCanonicalBootstrapKeys = new Set<string>();

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isObj(value)) {
    return Object.keys(value).reduce((acc: UnknownRecord, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {}) as T;
  }
  return value;
};
const parseWorkerCanonicalOrigin = (value: unknown): string => {
  try {
    return parseSessionWorkerDiscoveryOrigin(value);
  } catch {
    return '';
  }
};
const hasWorkerConfigValue = (config: unknown): boolean => {
  const configObj = isObj(config) ? config : {};
  const allowOrigins = configObj.allowOrigins;
  const limits = configObj.limits;
  return (
    !!config &&
    (!!configObj.corsWorkerUrl ||
      (Array.isArray(allowOrigins) && allowOrigins.length > 0) ||
      (isObj(limits) && Object.keys(limits).length > 0) ||
      !!configObj.rpcEndpoint ||
      hasOwn(configObj, 'embeddedDeployHelperEnabled') ||
      hasOwn(configObj, 'litCredentials'))
  );
};
const normalizeTimestampMs = (value: unknown): number => {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1e12 ? Math.trunc(raw) : Math.trunc(raw * 1000);
};
const normalizeChainId = (value: unknown): number | null => {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.trunc(raw);
};
const normalizeWriteNonce = (value: unknown, fallback = 0): number => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.trunc(raw);
};
const buildSlugCacheKey = (slugIn: unknown = ''): string =>
  `${SLUG_WORKER_CACHE_KEY_PREFIX}${canonicalizeSessionSlug(slugIn)}`;
const buildAuthoritativeCacheKey = ({ sessionIdHex, registryChainId }: Partial<CacheIdentityInput> = {}): string => {
  const normalizedSessionIdHex = normalizeSessionIdHex(sessionIdHex);
  if (!normalizedSessionIdHex) return '';
  const normalizedRegistryChainId = normalizeChainId(registryChainId);
  const hasExplicitZeroChain = Number(registryChainId) === 0;
  return normalizedRegistryChainId
    ? `${SESSION_WORKER_CACHE_KEY_PREFIX}${normalizedRegistryChainId}:${normalizedSessionIdHex}`
    : hasExplicitZeroChain
      ? `${SESSION_WORKER_CACHE_KEY_PREFIX}0:${normalizedSessionIdHex}`
      : `${SESSION_WORKER_CACHE_KEY_PREFIX}${normalizedSessionIdHex}`;
};
const buildCacheKeyFromIdentity = ({ slug, sessionIdHex, registryChainId }: Partial<CacheIdentity> = {}): string =>
  buildAuthoritativeCacheKey({ sessionIdHex, registryChainId }) || buildSlugCacheKey(slug);
const parseStoredCacheKey = (keyIn: unknown = ''): CacheIdentity => {
  const key = toTrimmedString(keyIn);
  if (!key) {
    return {
      slug: '',
      sessionIdHex: '',
      registryChainId: null,
    };
  }
  if (key.startsWith(SLUG_WORKER_CACHE_KEY_PREFIX)) {
    return {
      slug: canonicalizeSessionSlug(key.slice(SLUG_WORKER_CACHE_KEY_PREFIX.length)),
      sessionIdHex: '',
      registryChainId: null,
    };
  }
  if (key.startsWith(SESSION_WORKER_CACHE_KEY_PREFIX)) {
    const rawRemainder = key.slice(SESSION_WORKER_CACHE_KEY_PREFIX.length);
    const separatorIdx = rawRemainder.indexOf(':');
    if (separatorIdx >= 0) {
      return {
        slug: '',
        sessionIdHex: normalizeSessionIdHex(rawRemainder.slice(separatorIdx + 1)),
        registryChainId: normalizeChainId(rawRemainder.slice(0, separatorIdx)),
      };
    }
    return {
      slug: '',
      sessionIdHex: normalizeSessionIdHex(rawRemainder),
      registryChainId: null,
    };
  }
  return {
    slug: canonicalizeSessionSlug(key),
    sessionIdHex: '',
    registryChainId: null,
  };
};
const getSessionIdentityFromConfig = (sessionConfig: unknown = null): CacheIdentity => {
  const baseConfig = isObj(sessionConfig) ? sessionConfig : {};
  const registryMeta = isObj(baseConfig.__registry) ? baseConfig.__registry : {};
  return {
    slug: canonicalizeSessionSlug(baseConfig.slug ?? ''),
    sessionIdHex: normalizeSessionIdHex(
      registryMeta.sessionIdHex ?? baseConfig.sessionIdHex ?? registryMeta.sessionId ?? baseConfig.sessionId,
    ),
    registryChainId: normalizeChainId(
      registryMeta.registryChainId ??
        registryMeta.chainId ??
        baseConfig.registryChainId ??
        baseConfig.chainId ??
        baseConfig.networkChainId,
    ),
  };
};
const readRegistrySessionConfigBySlug = (slugIn: unknown = ''): SessionConfigLike | null => {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY) || 'null');
    if (!isObj(parsed)) return null;
    const sessions = isObj(parsed.sessions) ? parsed.sessions : isObj(parsed.groups) ? parsed.groups : {};
    const slug = canonicalizeSessionSlug(slugIn);
    return isObj(sessions[slug]) ? (sessions[slug] as SessionConfigLike) : null;
  } catch (_) {
    return null;
  }
};
const resolveSessionWorkerCacheIdentity = ({
  slug,
  sessionConfig,
  sessionIdHex,
  registryChainId,
}: CacheIdentityInput = {}): CacheIdentity => {
  const sessionConfigSlug = isObj(sessionConfig) ? sessionConfig.slug : '';
  const normalizedSlug = canonicalizeSessionSlug(slug ?? sessionConfigSlug ?? '');
  const explicitSessionIdHex = normalizeSessionIdHex(sessionIdHex);
  const explicitRegistryChainId = normalizeChainId(registryChainId);
  if (explicitSessionIdHex) {
    return {
      slug: normalizedSlug,
      sessionIdHex: explicitSessionIdHex,
      registryChainId: explicitRegistryChainId,
    };
  }
  const directIdentity = getSessionIdentityFromConfig(sessionConfig);
  if (directIdentity.sessionIdHex) {
    return {
      slug: normalizedSlug,
      sessionIdHex: directIdentity.sessionIdHex,
      registryChainId: directIdentity.registryChainId,
    };
  }
  const workerConfigStore = readSessionWorkerConfigCache();
  if (hasOwn(workerConfigStore.slugIndex, normalizedSlug) && workerConfigStore.slugIndex[normalizedSlug] === null) {
    return {
      slug: normalizedSlug,
      sessionIdHex: '',
      registryChainId: 0,
    };
  }
  const registrySessionConfig = readRegistrySessionConfigBySlug(normalizedSlug);
  const registryIdentity = getSessionIdentityFromConfig(registrySessionConfig);
  return {
    slug: normalizedSlug,
    sessionIdHex: registryIdentity.sessionIdHex,
    registryChainId: registryIdentity.registryChainId,
  };
};
const buildSlugIndex = (bySession: Record<string, WorkerConfigRecord> = {}): Record<string, string | null> => {
  const slugIndex: Record<string, string | null> = {};
  Object.entries(bySession).forEach(([key, value]) => {
    const slug = canonicalizeSessionSlug(value?.slug ?? '');
    if (!hasOwn(slugIndex, slug)) {
      slugIndex[slug] = key;
      return;
    }
    if (slugIndex[slug] !== key) {
      slugIndex[slug] = null;
    }
  });
  return slugIndex;
};
const finalizeStore = (bySession: Record<string, WorkerConfigRecord> = {}): WorkerConfigStore => ({
  v: WORKER_CONFIG_CACHE_VERSION,
  bySession,
  slugIndex: buildSlugIndex(bySession),
});

const getConfiguredSessionWorkerUrlFromConfig = (sessionConfig: unknown = null): string => {
  const parsed = parseWorkerConfig(isObj(sessionConfig) ? sessionConfig : {});
  const canonicalUrl = normalizeWorkerUrl(parsed?.config?.corsWorkerUrl || '');
  if (canonicalUrl) return canonicalUrl;
  const rawCompatibilityUrl = readConfiguredSessionWorkerUrlCandidate(sessionConfig);
  if (typeof rawCompatibilityUrl === 'string') {
    const compatibilityUrl = normalizeWorkerUrl(rawCompatibilityUrl);
    if (compatibilityUrl) return compatibilityUrl;
  }
  return '';
};
const detectWorkerConfigFieldPresence = (value: unknown): WorkerConfigFieldPresence => {
  const rawConfig = isObj(value) ? value : {};
  const rawRpc = isObj(rawConfig.rpc) ? rawConfig.rpc : {};
  return {
    allowOrigins: hasOwn(rawConfig, 'allowOrigins'),
    limits: hasOwn(rawConfig, 'limits'),
    rpcEndpoint:
      hasOwn(rawConfig, 'rpcEndpoint') ||
      hasOwn(rawConfig, 'rpcUrl') ||
      hasOwn(rawRpc, 'endpoint') ||
      hasOwn(rawRpc, 'url'),
    embeddedDeployHelperEnabled:
      hasOwn(rawConfig, 'embeddedDeployHelperEnabled') || hasOwn(rawConfig, 'deployHelperEnabled'),
  };
};
const normalizeWorkerConfigFieldPresence = (value: unknown, rawConfig: unknown): WorkerConfigFieldPresence => {
  const fallback = detectWorkerConfigFieldPresence(rawConfig);
  if (!isObj(value)) return fallback;
  return {
    allowOrigins: value.allowOrigins === true || (value.allowOrigins !== false && fallback.allowOrigins),
    limits: value.limits === true || (value.limits !== false && fallback.limits),
    rpcEndpoint: value.rpcEndpoint === true || (value.rpcEndpoint !== false && fallback.rpcEndpoint),
    embeddedDeployHelperEnabled:
      value.embeddedDeployHelperEnabled === true ||
      (value.embeddedDeployHelperEnabled !== false && fallback.embeddedDeployHelperEnabled),
  };
};
const shouldOverlayAllowOrigins = (record: WorkerConfigRecord | null | undefined): boolean =>
  record?.fieldPresence?.allowOrigins === true ||
  (Array.isArray(record?.config?.allowOrigins) && record.config.allowOrigins.length > 0);
const shouldOverlayLimits = (record: WorkerConfigRecord | null | undefined): boolean =>
  record?.fieldPresence?.limits === true ||
  (isObj(record?.config?.limits) && Object.keys(record.config.limits).length > 0);
const shouldOverlayRpcEndpoint = (record: WorkerConfigRecord | null | undefined): boolean =>
  record?.fieldPresence?.rpcEndpoint === true || !!record?.config?.rpcEndpoint;
const shouldOverlayEmbeddedDeployHelperEnabled = (record: WorkerConfigRecord | null | undefined): boolean =>
  record?.fieldPresence?.embeddedDeployHelperEnabled === true || hasOwn(record?.config, 'embeddedDeployHelperEnabled');
const buildVisibleCachedWorkerConfig = (record: WorkerConfigRecord | null | undefined): VisibleCachedWorkerConfig => {
  if (!record?.config) return null;
  const next: NonNullable<VisibleCachedWorkerConfig> = {
    corsWorkerUrl: record.config.corsWorkerUrl || '',
  };
  if (shouldOverlayAllowOrigins(record)) {
    next.allowOrigins = cloneValue(record.config.allowOrigins);
  }
  if (shouldOverlayLimits(record)) {
    next.limits = cloneValue(record.config.limits);
  }
  if (shouldOverlayRpcEndpoint(record)) {
    next.rpcEndpoint = record.config.rpcEndpoint || '';
  }
  if (shouldOverlayEmbeddedDeployHelperEnabled(record)) {
    next.embeddedDeployHelperEnabled = record.config.embeddedDeployHelperEnabled !== false;
  }
  if (hasOwn(record.config, 'litCredentials')) {
    next.litCredentials = cloneValue(record.config.litCredentials || {});
  }
  return next;
};

const normalizeWorkerConfigEntry = (value: unknown): WorkerConfig | null => {
  const parsed = parseWorkerConfig(isObj(value) ? value : {});
  if (!parsed?.ok && !hasWorkerConfigValue(parsed?.config)) return null;
  return hasWorkerConfigValue(parsed?.config) ? parsed.config : null;
};
const normalizeWorkerConfigRecord = (
  value: unknown,
  fallbackMeta: Partial<CacheIdentity> = {},
): WorkerConfigRecord | null => {
  const rawRecord = isObj(value) ? value : null;
  const rawConfig = isObj(rawRecord?.config) ? rawRecord.config : value;
  const normalizedConfig = normalizeWorkerConfigEntry(rawConfig);
  if (!normalizedConfig) return null;
  const canonicalConfig = isObj(rawRecord?.canonicalConfig)
    ? (cloneValue(rawRecord.canonicalConfig) as SessionConfigLike)
    : undefined;
  const authorityMode = toTrimmedString(rawRecord?.authorityMode);
  const sessionIdHex =
    authorityMode === 'worker_canonical'
      ? normalizeWorkerCanonicalSessionIdHex(rawRecord?.sessionIdHex ?? fallbackMeta.sessionIdHex)
      : normalizeSessionIdHex(rawRecord?.sessionIdHex ?? fallbackMeta.sessionIdHex);
  const workerOrigin =
    authorityMode === 'worker_canonical'
      ? parseWorkerCanonicalOrigin(rawRecord?.workerOrigin)
      : normalizeWorkerUrl(rawRecord?.workerOrigin);
  if (authorityMode === 'worker_canonical' && (!sessionIdHex || !workerOrigin || !canonicalConfig)) return null;
  return {
    config: normalizedConfig,
    cachedAtMs: normalizeTimestampMs(rawRecord?.cachedAtMs || rawRecord?.cachedAt || rawRecord?.updatedAt),
    writeNonce: normalizeWriteNonce(rawRecord?.writeNonce, 1),
    slug: canonicalizeSessionSlug(rawRecord?.slug ?? fallbackMeta.slug ?? ''),
    sessionIdHex: normalizeSessionIdHex(rawRecord?.sessionIdHex ?? fallbackMeta.sessionIdHex),
    registryChainId: normalizeChainId(rawRecord?.registryChainId ?? fallbackMeta.registryChainId),
    fieldPresence: normalizeWorkerConfigFieldPresence(
      rawRecord?.fieldPresence ?? rawRecord?.configFieldPresence,
      rawConfig,
    ),
    ...(canonicalConfig ? { canonicalConfig } : {}),
    ...(workerOrigin ? { workerOrigin } : {}),
    ...(toTrimmedString(rawRecord?.configRevision)
      ? { configRevision: toTrimmedString(rawRecord?.configRevision) }
      : {}),
    ...(authorityMode ? { authorityMode } : {}),
  };
};

const normalizeStore = (raw: unknown = null): WorkerConfigStore => {
  const obj = isObj(raw) ? raw : {};
  const bySessionRaw = isObj(obj.bySession) ? obj.bySession : {};
  const bySession: Record<string, WorkerConfigRecord> = {};
  Object.entries(bySessionRaw).forEach(([rawKey, value]) => {
    const storedKeyMeta = parseStoredCacheKey(rawKey);
    const normalizedRecord = normalizeWorkerConfigRecord(value, storedKeyMeta);
    if (!normalizedRecord) return;
    const cacheKey = buildCacheKeyFromIdentity(normalizedRecord);
    bySession[cacheKey] = normalizedRecord;
  });
  return finalizeStore(bySession);
};

const writeStore = (payload: WorkerConfigStore): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORKER_CONFIG_CACHE_KEY, JSON.stringify(payload));
  } catch (_) {}
};

export const readSessionWorkerConfigCache = (): WorkerConfigStore => {
  if (typeof window === 'undefined') return normalizeStore(null);
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKER_CONFIG_CACHE_KEY) || 'null');
    return normalizeStore(parsed);
  } catch (_) {
    return normalizeStore(null);
  }
};

const normalizeCacheLookupArgs = (slugOrOptions: unknown = '', sessionConfig: unknown = null): CacheLookupArgs =>
  isObj(slugOrOptions)
    ? {
        slug: slugOrOptions.slug,
        sessionConfig: slugOrOptions.sessionConfig ?? null,
      }
    : {
        slug: slugOrOptions,
        sessionConfig,
      };

const getCachedSessionWorkerConfigRecord = ({
  slug,
  sessionConfig,
}: CacheLookupArgs = {}): WorkerConfigRecord | null => {
  const identity = resolveSessionWorkerCacheIdentity({ slug, sessionConfig });
  const store = readSessionWorkerConfigCache();
  const authoritativeKey = buildAuthoritativeCacheKey(identity);
  if (authoritativeKey) {
    const authoritativeRecord = store.bySession[authoritativeKey];
    if (authoritativeRecord) return authoritativeRecord;
  }
  const slugKey = store.slugIndex[identity.slug];
  if (slugKey === null) return null;
  const legacySlugKey = buildSlugCacheKey(identity.slug);
  if (slugKey && slugKey !== legacySlugKey) return null;
  const fallbackKey = slugKey || legacySlugKey;
  return store.bySession[fallbackKey] || null;
};

export const getCachedSessionWorkerConfig = (
  slugOrOptions: unknown = '',
  sessionConfig: unknown = null,
): VisibleCachedWorkerConfig => {
  const record = getCachedSessionWorkerConfigRecord(normalizeCacheLookupArgs(slugOrOptions, sessionConfig));
  return buildVisibleCachedWorkerConfig(record);
};

const buildOverlaySessionWorkerConfig = (
  baseConfig: SessionWorkerConfigReplica,
  record: WorkerConfigRecord,
): SessionWorkerConfigReplica => {
  const cachedConfig: Partial<WorkerConfig> = isObj(record?.config) ? record.config : {};
  const next: SessionWorkerConfigReplica = {
    ...baseConfig,
    corsWorkerUrl: cachedConfig.corsWorkerUrl || baseConfig.corsWorkerUrl || '',
  };
  if (shouldOverlayAllowOrigins(record)) {
    next.allowOrigins = cloneValue(cachedConfig.allowOrigins);
  }
  if (shouldOverlayLimits(record)) {
    next.limits = cloneValue(cachedConfig.limits);
  }
  if (shouldOverlayRpcEndpoint(record)) {
    next.rpcEndpoint = cachedConfig.rpcEndpoint || '';
    next.rpcUrl = cachedConfig.rpcEndpoint || '';
  }
  if (shouldOverlayEmbeddedDeployHelperEnabled(record)) {
    next.embeddedDeployHelperEnabled = cachedConfig.embeddedDeployHelperEnabled !== false;
  }
  if (hasOwn(cachedConfig, 'litCredentials')) {
    next.litCredentials = cloneValue(cachedConfig.litCredentials || {});
  }
  return next;
};

const getReplicaMeta = (sessionConfig: unknown = null): ReplicaMeta | null => {
  if (!isObj(sessionConfig)) return null;
  return isObj(sessionConfig[WORKER_CONFIG_REPLICA_META])
    ? (sessionConfig[WORKER_CONFIG_REPLICA_META] as ReplicaMeta)
    : null;
};

const getReplicaSourceConfig = (
  existingMeta: ReplicaMeta | null,
  fallbackConfig: unknown,
): SessionWorkerConfigReplica | null => {
  if (isObj(existingMeta?.sourceConfig)) {
    return cloneValue(existingMeta.sourceConfig) as SessionWorkerConfigReplica;
  }
  return isObj(fallbackConfig) ? (cloneValue(fallbackConfig) as SessionWorkerConfigReplica) : null;
};

const setReplicaMeta = <T>(sessionConfig: T, meta: ReplicaMeta): T => {
  if (!isObj(sessionConfig)) return sessionConfig;
  try {
    Object.defineProperty(sessionConfig, WORKER_CONFIG_REPLICA_META, {
      value: meta,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } catch (_) {}
  return sessionConfig;
};

const shouldApplyCachedWorkerConfig = ({
  record,
  sessionConfig,
}: {
  record?: WorkerConfigRecord | null;
  sessionConfig?: unknown;
} = {}): boolean => {
  const baseConfig = isObj(sessionConfig) ? sessionConfig : null;
  if (!baseConfig || !record?.config) return false;

  const existingMeta = getReplicaMeta(baseConfig);
  if (existingMeta?.applied === true) return true;

  const authoritativeWorkerUrl = getConfiguredSessionWorkerUrlFromConfig(baseConfig);
  if (!authoritativeWorkerUrl) return true;

  const cachedAtMs = normalizeTimestampMs(record.cachedAtMs);
  if (!cachedAtMs) return false;

  const registryMeta = isObj(baseConfig.__registry) ? baseConfig.__registry : {};
  const registryUpdatedAtMs = normalizeTimestampMs(registryMeta.updatedAt);
  if (!registryUpdatedAtMs) return true;

  return cachedAtMs > registryUpdatedAtMs;
};

export const getSessionWorkerConfigReplicaState = ({
  slug,
  sessionConfig,
}: CacheLookupArgs = {}): SessionWorkerConfigReplicaState => {
  const inputConfig = isObj(sessionConfig) ? (sessionConfig as SessionWorkerConfigReplica) : null;
  if (!inputConfig) {
    return {
      sessionConfig: null,
      cachedConfig: null,
      cacheApplied: false,
      cacheUpdatedAtMs: null,
      registryUpdatedAtMs: null,
      reason: 'no-base-config',
    };
  }

  const normalizedSlug = canonicalizeSessionSlug(slug ?? inputConfig.slug ?? '');
  const existingMeta = getReplicaMeta(inputConfig);
  let existingRecord = null;
  let baseConfig: SessionWorkerConfigReplica | null = inputConfig;

  if (existingMeta?.applied === true) {
    existingRecord = getCachedSessionWorkerConfigRecord({
      slug: normalizedSlug,
      sessionConfig: inputConfig,
    });
    const existingCachedAtMs = normalizeTimestampMs(existingMeta.cachedAtMs) || null;
    const latestCachedAtMs = normalizeTimestampMs(existingRecord?.cachedAtMs) || null;
    const existingWriteNonce = normalizeWriteNonce(existingMeta.writeNonce, 0);
    const latestWriteNonce = normalizeWriteNonce(existingRecord?.writeNonce, 0);
    if (existingRecord?.config && latestCachedAtMs === existingCachedAtMs && latestWriteNonce === existingWriteNonce) {
      return {
        sessionConfig: inputConfig,
        cachedConfig: existingMeta.cachedConfig || null,
        cacheApplied: true,
        cacheUpdatedAtMs: existingCachedAtMs,
        registryUpdatedAtMs: normalizeTimestampMs(existingMeta.registryUpdatedAtMs) || null,
        reason: existingMeta.reason || 'cache-applied',
      };
    }

    // Rebuild the replica from the last known source config when the cache entry changes or disappears.
    baseConfig = getReplicaSourceConfig(existingMeta, inputConfig) || inputConfig;
  }

  const record =
    existingRecord ||
    getCachedSessionWorkerConfigRecord({
      slug: normalizedSlug,
      sessionConfig: baseConfig,
    });
  const cacheUpdatedAtMs = normalizeTimestampMs(record?.cachedAtMs) || null;
  const registryUpdatedAtMs = normalizeTimestampMs(baseConfig?.__registry?.updatedAt) || null;
  if (!record?.config) {
    return {
      sessionConfig: baseConfig,
      cachedConfig: null,
      cacheApplied: false,
      cacheUpdatedAtMs,
      registryUpdatedAtMs,
      reason: 'no-cache',
    };
  }

  const cacheApplied = shouldApplyCachedWorkerConfig({
    record,
    sessionConfig: baseConfig,
  });
  if (!cacheApplied) {
    return {
      sessionConfig: baseConfig,
      cachedConfig: record.config,
      cacheApplied: false,
      cacheUpdatedAtMs,
      registryUpdatedAtMs,
      reason: cacheUpdatedAtMs ? 'registry-newer' : 'legacy-cache',
    };
  }

  const reason = cacheUpdatedAtMs ? 'cache-newer' : 'cache-bridge-no-mirror';
  const next = buildOverlaySessionWorkerConfig(baseConfig, record);
  setReplicaMeta(next, {
    applied: true,
    cachedConfig: cloneValue(record.config),
    cachedAtMs: cacheUpdatedAtMs,
    writeNonce: normalizeWriteNonce(record.writeNonce, 0),
    registryUpdatedAtMs,
    reason,
    sourceConfig: cloneValue(baseConfig),
  });

  return {
    sessionConfig: next,
    cachedConfig: record.config,
    cacheApplied: true,
    cacheUpdatedAtMs,
    registryUpdatedAtMs,
    reason,
  };
};

export const overlayCachedSessionWorkerConfig = ({
  slug,
  sessionConfig,
}: CacheLookupArgs = {}): SessionWorkerConfigReplica | null =>
  getSessionWorkerConfigReplicaState({
    slug,
    sessionConfig,
  }).sessionConfig;

export const upsertCachedSessionWorkerConfig = ({
  slug,
  config,
  sessionConfig,
  sessionIdHex,
  registryChainId,
}: UpsertCachedSessionWorkerConfigArgs = {}): WorkerConfig | null => {
  const identity = resolveSessionWorkerCacheIdentity({
    slug,
    sessionConfig,
    sessionIdHex,
    registryChainId,
  });
  const normalizedConfig = normalizeWorkerConfigEntry(config);
  const store = readSessionWorkerConfigCache();
  const cacheKey = buildCacheKeyFromIdentity(identity);
  const slugKey = buildSlugCacheKey(identity.slug);
  const existingRecord = store.bySession[cacheKey] || (cacheKey !== slugKey ? store.bySession[slugKey] : null);
  if (!normalizedConfig) {
    delete store.bySession[cacheKey];
    if (cacheKey !== slugKey) delete store.bySession[slugKey];
    writeStore(finalizeStore(store.bySession));
    return null;
  }
  if (cacheKey !== slugKey) delete store.bySession[slugKey];
  store.bySession[cacheKey] = {
    config: normalizedConfig,
    cachedAtMs: Date.now(),
    writeNonce: normalizeWriteNonce(existingRecord?.writeNonce, 0) + 1,
    slug: identity.slug,
    sessionIdHex: identity.sessionIdHex,
    registryChainId: identity.registryChainId,
    fieldPresence: detectWorkerConfigFieldPresence(config),
  };
  writeStore(finalizeStore(store.bySession));
  return normalizedConfig;
};

export const clearCachedSessionWorkerConfig = (slugOrOptions: unknown = '', sessionConfig: unknown = null): void => {
  const identity = resolveSessionWorkerCacheIdentity(normalizeCacheLookupArgs(slugOrOptions, sessionConfig));
  const store = readSessionWorkerConfigCache();
  const cacheKey = buildCacheKeyFromIdentity(identity);
  const slugKey = buildSlugCacheKey(identity.slug);
  const hadExactEntry = Object.prototype.hasOwnProperty.call(store.bySession, cacheKey);
  const hadSlugEntry = cacheKey !== slugKey && Object.prototype.hasOwnProperty.call(store.bySession, slugKey);
  if (!hadExactEntry && !hadSlugEntry) return;
  delete store.bySession[cacheKey];
  if (cacheKey !== slugKey) delete store.bySession[slugKey];
  writeStore(finalizeStore(store.bySession));
};
