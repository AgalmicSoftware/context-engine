/**
 * @module canonicalSessionContext
 * @description Pure session identity/config resolution helpers. Centralizes slug canonicalization,
 *              source-aware session config lookup, and provenance for read-side consumers.
 *
 * Key exports: canonicalizeSessionSlug, resolveSessionSlugAliasFromDemoSessions,
 *              resolveSessionConfigFromSources, resolveCanonicalSessionConfig,
 *              resolveCanonicalSessionContext
 */
import { toStr, normalizeSlug as normalizeBaseSlug } from '../shared/primitives.js';
import { USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import {
  AUTHORITY_MATRIX,
  AUTHORITY_SOURCES,
  isDemoSourceAllowed,
  resolveSessionAuthorityGroup,
} from './sessionAuthorityMatrix.js';
import {
  parseSessionIdentity,
  parseSessionMetadata,
  parseWorkerConfig,
  parseLocalResourceOverrides,
} from './sessionParsers.js';
import { canonicalizeLegacySessionAlias } from './sessionDemoCompat.js';
import { SESSION_WORKER_METADATA_ALIAS_KEYS } from './sessionWorkerUrlCompatibility.js';
import { resolveSessionCapabilityProjection } from './sessionCapabilityProjection';
import type {
  LocalResourceOverrides,
  SessionConfigLike,
  SessionIdentity,
  SessionMetadataRecord,
  SessionWorkerConfig,
  UnknownRecord,
} from './sessionTypes.js';

type ParsedSessionIdentity = ReturnType<typeof parseSessionIdentity>;
type ParsedSessionMetadata = ReturnType<typeof parseSessionMetadata>;
type ParsedWorkerConfig = ReturnType<typeof parseWorkerConfig>;
type ParsedLocalResourceOverrides = ReturnType<typeof parseLocalResourceOverrides>;
type ResolveSessionConfigFromSourcesOptions = {
  sessionSlug?: unknown;
  getRegistrySessionConfig?: ((slug: string) => unknown) | null;
  demoSessions?: unknown;
  preferRegistry?: boolean;
  allowDemoFallback?: boolean;
};
type SessionConfigResolution = {
  sessionSlug: string;
  sessionConfig: SessionConfigLike | null;
  sessionConfigSource: string;
  warnings: string[];
};
type ResolveCanonicalSessionConfigOptions = {
  source?: unknown;
  defaults?: unknown;
  resolveBySlug?: ((slug: string) => unknown) | null;
  fallbackConfig?: unknown;
};
type CanonicalSessionConfigResolution = {
  hasExplicitSessionSlug: boolean;
  activeSessionSlug: string;
  requestedSessionSlug: string;
  sessionSlug: string;
  sessionConfig: SessionConfigLike | null;
  sessionConfigSource: string;
  warnings: string[];
  ok: boolean;
  error: string;
  provenance: {
    sessionSlug: string;
    sessionConfig: string;
  };
};
type ResolveSessionSlugAliasOptions = {
  sessionSlug?: unknown;
  demoSessions?: unknown;
  allowSessionName?: boolean;
};
type ResolveCanonicalSessionContextOptions = {
  requestedSlug?: unknown;
  routeContext?: unknown;
  registrySession?: unknown;
  validatedWorkerCanonicalSource?: unknown;
  metadata?: unknown;
  workerConfig?: unknown;
  localOverrides?: unknown;
  demoSession?: unknown;
  mode?: unknown;
};
type CanonicalSessionContextResult = {
  ok: boolean;
  context: {
    identity: SessionIdentity;
    metadata: SessionMetadataRecord;
    worker: SessionWorkerConfig;
    local: LocalResourceOverrides;
    effective: UnknownRecord;
  };
  provenance: {
    identity: string;
    metadata: string;
    worker: string;
    local: string;
  };
  warnings: string[];
  errors: string[];
};

const EMPTY_IDENTITY: ParsedSessionIdentity = {
  ok: true,
  slug: '',
  sessionId: '',
  metadataURI: '',
  chainId: null,
  errors: [],
};

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
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
const buildEmptyWorkerConfig = (): SessionWorkerConfig => ({
  corsWorkerUrl: '',
  allowOrigins: [],
  limits: {},
  rpcEndpoint: '',
});
const buildEmptyLocalOverrides = (): LocalResourceOverrides => ({
  rpc: { useLocal: false, apiKey: '' },
  arweave: { useLocal: false, jwk: '' },
  faucet: { useLocal: false, privateKey: '' },
});
const hasOwnKeys = (value: unknown): value is UnknownRecord => isObj(value) && Object.keys(value).length > 0;
const readTrimmedSessionSlug = (raw: unknown): string => toStr(raw).trim();
const normalizeSessionAliasToken = (raw: unknown): string => normalizeBaseSlug(readTrimmedSessionSlug(raw));
const RESERVED_SESSION_SLUG_KEYS = new Set<string>(['__proto__', 'constructor', 'prototype']);
export const isReservedSessionSlugKey = (rawSlug: unknown): boolean =>
  RESERVED_SESSION_SLUG_KEYS.has(normalizeSessionAliasToken(rawSlug));
// chainId alone is not sufficient — a partial/malformed registry record with only
// chainId should not suppress the route identity or mark resolution as authoritative.
const hasIdentityValue = (identity: ParsedSessionIdentity | UnknownRecord | null | undefined): boolean =>
  !!(identity && (identity.slug || identity.sessionId || identity.metadataURI));
const hasWorkerCanonicalIdentityValue = (identity: ParsedSessionIdentity | UnknownRecord | null | undefined): boolean =>
  !!(identity?.slug && identity?.sessionId);
const collectPrefixedErrors = (target: string[], prefix: string, entries: string[] = []): void => {
  entries.forEach((entry) => {
    target.push(`${prefix}: ${entry}`);
  });
};
const buildRouteIdentityInput = (requestedSlug: unknown, routeContext: unknown): UnknownRecord => {
  const route = isObj(routeContext) ? routeContext : {};
  return {
    slug:
      requestedSlug !== undefined
        ? requestedSlug
        : (route.sessionSlug ?? route.slug ?? route.activeSessionSlug ?? route.requestedSlug),
    sessionId: route.sessionIdHex ?? route.sessionId ?? route.id,
    metadataURI: route.metadataURI,
    chainId: route.chainId ?? route.networkChainId,
  };
};
const buildRegistryIdentityInput = (registrySession: unknown): UnknownRecord => {
  const registry = isObj(registrySession) ? registrySession : {};
  const registryMeta = isObj(registry.__registry) ? registry.__registry : {};
  return {
    slug: registry.slug,
    // Prefer hex-format IDs over UUID-format across both levels.
    // Real registry cache entries store UUID at top level (registry.sessionId)
    // and canonical hex in __registry.sessionIdHex — check hex fields first.
    sessionId: registry.sessionIdHex ?? registryMeta.sessionIdHex ?? registry.sessionId ?? registryMeta.sessionId,
    metadataURI: registry.metadataURI ?? registryMeta.metadataURI,
    chainId: registry.chainId ?? registry.networkChainId ?? registryMeta.chainId ?? registryMeta.registryChainId,
  };
};
const resolveValidatedWorkerCanonicalConfig = (source: unknown): UnknownRecord | null => {
  // Regression guard: the worker query is routing data only. Authority can switch
  // to worker KV only after the discovery boundary supplies this validated wrapper.
  if (!isObj(source) || source.validated !== true || source.source !== AUTHORITY_SOURCES.WORKER_KV) return null;
  const config = isObj(source.config) ? source.config : null;
  const projection = resolveSessionCapabilityProjection(config);
  return config && projection.profileValid && projection.isWorkerCanonical ? config : null;
};
const buildWorkerCanonicalIdentityInput = (config: unknown): UnknownRecord => {
  const source = isObj(config) ? config : {};
  return {
    slug: source.slug,
    sessionId: source.sessionIdHex ?? source.sessionId,
  };
};
const restoreWorkerCanonicalGateFields = (
  metadata: SessionMetadataRecord,
  config: UnknownRecord,
): SessionMetadataRecord => {
  const next = cloneValue(metadata);
  const gateAuthority = resolveSessionAuthorityGroup('gates', 'worker_canonical');
  (gateAuthority?.fields || []).forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(config, field)) next[field] = cloneValue(config[field]);
  });
  return next;
};
const pickAuthorityFields = (value: UnknownRecord, fields: string[]): UnknownRecord =>
  fields.reduce((next: UnknownRecord, field) => {
    if (Object.prototype.hasOwnProperty.call(value, field)) next[field] = cloneValue(value[field]);
    return next;
  }, {});
const buildDemoIdentityInput = (requestedSlug: unknown, demoSession: unknown): UnknownRecord => {
  const demo = isObj(demoSession) ? demoSession : {};
  return {
    slug: demo.slug ?? requestedSlug,
    sessionId: demo.sessionIdHex ?? demo.sessionId,
    metadataURI: demo.metadataURI,
    chainId: demo.chainId ?? demo.networkChainId,
  };
};
const EFFECTIVE_METADATA_STRIP_KEYS = Array.from(
  new Set([
    'slug',
    'sessionId',
    'metadataURI',
    'chainId',
    'networkChainId',
    'rpc',
    'arweave',
    'faucet',
    ...AUTHORITY_MATRIX.gates.fields,
    ...AUTHORITY_MATRIX.workerConfig.fields,
    ...AUTHORITY_MATRIX.secrets.fields,
    ...SESSION_WORKER_METADATA_ALIAS_KEYS,
    'faucetKey',
  ]),
);
const stripEffectiveMetadataOverrides = (metadata: unknown): UnknownRecord => {
  if (!isObj(metadata)) return {};
  const next = cloneValue(metadata);
  EFFECTIVE_METADATA_STRIP_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
};

export const canonicalizeSessionSlug = (rawSlug: unknown): string => {
  const slug = readTrimmedSessionSlug(rawSlug);
  if (!slug) return '';
  // Preserve real session slugs verbatim; only canonicalize reserved aliases.
  const canonicalSlug = canonicalizeLegacySessionAlias(slug);
  if (isReservedSessionSlugKey(canonicalSlug)) return '';
  return canonicalSlug;
};

const findDemoSessionConfigBySlug = (demoSessions: unknown, slugIn: unknown = ''): SessionConfigLike | null => {
  const demo = isObj(demoSessions) ? demoSessions : {};
  const slug = canonicalizeSessionSlug(slugIn);
  if (!slug) return isObj(demo.general) ? (demo.general as SessionConfigLike) : null;
  const byKey = demo[slug];
  if (isObj(byKey) && canonicalizeSessionSlug(byKey.slug || slug) === slug) return byKey as SessionConfigLike;
  const bySlug = Object.values(demo).find(
    (entry) => isObj(entry) && canonicalizeSessionSlug(entry.slug || '') === slug,
  );
  return isObj(bySlug) ? (bySlug as SessionConfigLike) : null;
};

const findDemoSessionConfigByAlias = (
  demoSessions: unknown,
  slugIn: unknown = '',
  { allowSessionName = false }: { allowSessionName?: boolean } = {},
): SessionConfigLike | null => {
  const demo = isObj(demoSessions) ? demoSessions : {};
  const slug = canonicalizeSessionSlug(slugIn);
  const aliasToken = normalizeSessionAliasToken(slugIn);
  const entries = Object.entries(demo);
  for (const [key, entry] of entries) {
    if (!isObj(entry)) continue;
    if (slug && canonicalizeSessionSlug(key) === slug) return entry as SessionConfigLike;
    if (slug && canonicalizeSessionSlug(entry.slug || '') === slug) return entry as SessionConfigLike;
    if (allowSessionName && slug && canonicalizeSessionSlug(entry.sessionName || '') === slug)
      return entry as SessionConfigLike;
    if (aliasToken && normalizeSessionAliasToken(key) === aliasToken) return entry as SessionConfigLike;
    if (aliasToken && normalizeSessionAliasToken(entry.slug || '') === aliasToken) return entry as SessionConfigLike;
    if (allowSessionName && aliasToken && normalizeSessionAliasToken(entry.sessionName || '') === aliasToken)
      return entry as SessionConfigLike;
  }
  return null;
};

export const resolveSessionSlugAliasFromDemoSessions = ({
  sessionSlug,
  demoSessions,
  allowSessionName = false,
}: ResolveSessionSlugAliasOptions = {}) => {
  const requestedSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const sessionConfig = findDemoSessionConfigByAlias(demoSessions, requestedSessionSlug, {
    allowSessionName,
  });
  return {
    requestedSessionSlug,
    sessionSlug: sessionConfig ? canonicalizeSessionSlug(sessionConfig.slug || '') : requestedSessionSlug,
    sessionConfig,
    sessionConfigSource: sessionConfig ? 'demo' : 'missing',
    warnings: [],
  };
};

export const resolveSessionConfigFromSources = ({
  sessionSlug,
  getRegistrySessionConfig,
  demoSessions,
  preferRegistry = true,
  allowDemoFallback = !USE_ONCHAIN_SESSION_REGISTRY,
}: ResolveSessionConfigFromSourcesOptions = {}): SessionConfigResolution => {
  const slug = canonicalizeSessionSlug(sessionSlug);
  if (preferRegistry && typeof getRegistrySessionConfig === 'function') {
    const cached = getRegistrySessionConfig(slug);
    if (isObj(cached)) {
      return {
        sessionSlug: slug,
        sessionConfig: cached as SessionConfigLike,
        sessionConfigSource: 'registry',
        warnings: [],
      };
    }
  }

  if (!allowDemoFallback) {
    return {
      sessionSlug: slug,
      sessionConfig: null,
      sessionConfigSource: 'missing',
      warnings: [],
    };
  }

  const demoConfig = findDemoSessionConfigBySlug(demoSessions, slug);
  return {
    sessionSlug: slug,
    sessionConfig: demoConfig,
    sessionConfigSource: demoConfig ? 'demo' : 'missing',
    warnings: [],
  };
};

export const resolveCanonicalSessionConfig = ({
  source = {},
  defaults = {},
  resolveBySlug,
  fallbackConfig,
}: ResolveCanonicalSessionConfigOptions = {}): CanonicalSessionConfigResolution => {
  const sourceObj = isObj(source) ? source : {};
  const defaultsObj = isObj(defaults) ? defaults : {};

  const hasExplicitSessionSlug =
    Object.prototype.hasOwnProperty.call(sourceObj, 'sessionSlug') && sourceObj.sessionSlug !== undefined;
  const explicitSessionSlug = canonicalizeSessionSlug(
    sourceObj.sessionSlug ?? defaultsObj.sessionSlug ?? sourceObj.slug ?? defaultsObj.slug,
  );
  const activeSessionSlug = canonicalizeSessionSlug(sourceObj.activeSessionSlug ?? defaultsObj.activeSessionSlug);

  let sessionConfig =
    (isObj(sourceObj.sessionConfig) ? (sourceObj.sessionConfig as SessionConfigLike) : null) ||
    (isObj(defaultsObj.sessionConfig) ? (defaultsObj.sessionConfig as SessionConfigLike) : null);
  let sessionConfigSource = isObj(sourceObj.sessionConfig)
    ? 'provided'
    : isObj(defaultsObj.sessionConfig)
      ? 'default'
      : 'missing';

  const requestedSlug = hasExplicitSessionSlug ? explicitSessionSlug : activeSessionSlug;
  if (!sessionConfig && typeof resolveBySlug === 'function') {
    const resolved = resolveBySlug(requestedSlug);
    if (isObj(resolved)) {
      sessionConfig = resolved as SessionConfigLike;
      sessionConfigSource = 'resolved';
    }
  }

  if (!sessionConfig && isObj(fallbackConfig)) {
    sessionConfig = fallbackConfig as SessionConfigLike;
    sessionConfigSource = 'fallback';
  }

  const configSessionSlug = canonicalizeSessionSlug(sessionConfig?.slug || '');
  const sessionSlug = hasExplicitSessionSlug
    ? explicitSessionSlug
    : canonicalizeSessionSlug(requestedSlug || configSessionSlug);
  const warnings = [];

  if (hasExplicitSessionSlug && configSessionSlug && explicitSessionSlug !== configSessionSlug) {
    warnings.push(`session config slug mismatch: requested "${explicitSessionSlug}" resolved "${configSessionSlug}"`);
  }

  const sessionConfigWithSlug =
    (isObj(sessionConfig) && !configSessionSlug && sessionSlug
      ? { ...sessionConfig, slug: sessionSlug }
      : sessionConfig) || null;

  return {
    hasExplicitSessionSlug,
    activeSessionSlug,
    requestedSessionSlug: explicitSessionSlug,
    sessionSlug,
    sessionConfig: sessionConfigWithSlug,
    sessionConfigSource,
    warnings,
    ok: !!sessionConfigWithSlug || sessionSlug === '',
    error: !sessionConfigWithSlug && sessionSlug ? `Session config not found for "${sessionSlug}".` : '',
    provenance: {
      sessionSlug: hasExplicitSessionSlug
        ? 'explicit'
        : configSessionSlug
          ? 'config'
          : activeSessionSlug
            ? 'active'
            : 'default',
      sessionConfig: sessionConfigSource,
    },
  };
};

export const resolveCanonicalSessionContext = ({
  requestedSlug,
  routeContext,
  registrySession,
  validatedWorkerCanonicalSource,
  metadata,
  workerConfig,
  localOverrides,
  demoSession,
  mode,
}: ResolveCanonicalSessionContextOptions = {}): CanonicalSessionContextResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const normalizedMode = typeof mode === 'string' ? mode : '';
  const hasExplicitWorkerCanonicalSource =
    validatedWorkerCanonicalSource !== undefined && validatedWorkerCanonicalSource !== null;
  const workerCanonicalConfig = resolveValidatedWorkerCanonicalConfig(validatedWorkerCanonicalSource);
  const workerCanonicalAuthorityActive = !!workerCanonicalConfig;
  const authorityMode = workerCanonicalAuthorityActive ? 'worker_canonical' : '';
  if (hasExplicitWorkerCanonicalSource && !workerCanonicalConfig) {
    errors.push('Invalid validated worker-canonical source.');
  }

  const routeIdentity = parseSessionIdentity(buildRouteIdentityInput(requestedSlug, routeContext));
  const registryIdentity = parseSessionIdentity(buildRegistryIdentityInput(registrySession));
  const workerCanonicalIdentity = workerCanonicalAuthorityActive
    ? parseSessionIdentity(buildWorkerCanonicalIdentityInput(workerCanonicalConfig))
    : EMPTY_IDENTITY;
  const demoIdentityAllowed = !workerCanonicalAuthorityActive && isDemoSourceAllowed('identity', normalizedMode);
  const demoIdentity = demoIdentityAllowed
    ? parseSessionIdentity(buildDemoIdentityInput(requestedSlug, demoSession))
    : EMPTY_IDENTITY;

  collectPrefixedErrors(errors, 'route identity', routeIdentity.errors);
  collectPrefixedErrors(errors, 'registry identity', registryIdentity.errors);
  if (workerCanonicalAuthorityActive) {
    collectPrefixedErrors(errors, 'worker-canonical identity', workerCanonicalIdentity.errors);
  }
  if (demoIdentityAllowed) {
    collectPrefixedErrors(errors, 'demo identity', demoIdentity.errors);
  }
  const authoritativeIdentityRequired = normalizedMode !== 'demo' && normalizedMode !== 'off-chain';
  const identityAuthority = resolveSessionAuthorityGroup('identity', authorityMode) || AUTHORITY_MATRIX.identity;

  let effectiveIdentity = cloneValue(routeIdentity);
  let identityProvenance = 'route';
  if (workerCanonicalAuthorityActive) {
    effectiveIdentity = cloneValue(workerCanonicalIdentity);
    identityProvenance = AUTHORITY_SOURCES.WORKER_KV;
  } else if (hasIdentityValue(registryIdentity)) {
    effectiveIdentity = cloneValue(registryIdentity);
    identityProvenance = AUTHORITY_SOURCES.REGISTRY;
  } else if (demoIdentityAllowed && hasIdentityValue(demoIdentity)) {
    effectiveIdentity = cloneValue(demoIdentity);
    identityProvenance = AUTHORITY_SOURCES.DEMO;
  } else if (!hasIdentityValue(routeIdentity)) {
    effectiveIdentity = {
      slug: '',
      sessionId: '',
      metadataURI: '',
      chainId: null,
      errors: [],
      ok: true,
    } as ParsedSessionIdentity;
  }

  const hasRequiredAuthoritativeIdentity = workerCanonicalAuthorityActive
    ? hasWorkerCanonicalIdentityValue(workerCanonicalIdentity)
    : hasIdentityValue(registryIdentity);
  if (authoritativeIdentityRequired && !hasRequiredAuthoritativeIdentity) {
    errors.push('Missing authoritative session identity source.');
  } else if (!hasIdentityValue(effectiveIdentity)) {
    errors.push('Missing authoritative session identity source.');
  } else if (identityProvenance !== identityAuthority.authoritativeSource) {
    warnings.push(
      `Using ${identityProvenance} session identity fallback; ${identityAuthority.authoritativeSource} is authoritative.`,
    );
  }

  if (routeIdentity.slug && effectiveIdentity.slug && routeIdentity.slug !== effectiveIdentity.slug) {
    warnings.push(
      `session identity slug mismatch: requested "${routeIdentity.slug}" resolved "${effectiveIdentity.slug}"`,
    );
  }

  const metadataProvided = !workerCanonicalAuthorityActive && metadata !== undefined && metadata !== null;
  const metadataIsCache = isObj(metadata) && !!metadata.__fromCache;
  const metadataParsed: ParsedSessionMetadata = metadataProvided
    ? parseSessionMetadata(metadata)
    : { ok: true, metadata: {}, errors: [] };
  const workerCanonicalMetadataParsed: ParsedSessionMetadata = workerCanonicalAuthorityActive
    ? parseSessionMetadata(workerCanonicalConfig)
    : { ok: true, metadata: {}, errors: [] };
  const demoMetadataAllowed = !workerCanonicalAuthorityActive && isDemoSourceAllowed('textMetadata', normalizedMode);
  const demoMetadataParsed: ParsedSessionMetadata =
    demoMetadataAllowed && demoSession !== undefined && demoSession !== null
      ? parseSessionMetadata(demoSession)
      : { ok: true, metadata: {}, errors: [] };

  if (metadataProvided) {
    collectPrefixedErrors(errors, 'session metadata', metadataParsed.errors);
  }
  if (workerCanonicalAuthorityActive) {
    collectPrefixedErrors(errors, 'worker-canonical config', workerCanonicalMetadataParsed.errors);
  }
  if (demoMetadataAllowed && demoSession !== undefined && demoSession !== null) {
    collectPrefixedErrors(errors, 'demo metadata', demoMetadataParsed.errors);
  }

  let effectiveMetadata: SessionMetadataRecord = {};
  let metadataProvenance = 'cache';
  if (workerCanonicalAuthorityActive) {
    effectiveMetadata = restoreWorkerCanonicalGateFields(workerCanonicalMetadataParsed.metadata, workerCanonicalConfig);
    metadataProvenance = AUTHORITY_SOURCES.WORKER_KV;
  } else if (metadataProvided && !metadataIsCache && isObj(metadata)) {
    effectiveMetadata = cloneValue(metadataParsed.metadata);
    metadataProvenance = AUTHORITY_SOURCES.ARWEAVE;
  } else {
    if (metadataProvided && !metadataIsCache && !isObj(metadata)) {
      warnings.push('Quarantined corrupt session metadata (not an object); falling back to alternate sources.');
    }
    if (demoMetadataAllowed && hasOwnKeys(demoMetadataParsed.metadata)) {
      effectiveMetadata = cloneValue(demoMetadataParsed.metadata);
      metadataProvenance = AUTHORITY_SOURCES.DEMO;
    } else if (hasOwnKeys(metadataParsed.metadata)) {
      effectiveMetadata = cloneValue(metadataParsed.metadata);
      metadataProvenance = 'cache';
    }
  }

  const metadataAuthority =
    resolveSessionAuthorityGroup('textMetadata', authorityMode) || AUTHORITY_MATRIX.textMetadata;
  if (metadataProvenance === AUTHORITY_SOURCES.DEMO) {
    warnings.push(
      `Using ${AUTHORITY_SOURCES.DEMO} session metadata fallback; ${metadataAuthority.authoritativeSource} is authoritative.`,
    );
  } else if (metadataProvenance === 'cache' && hasOwnKeys(effectiveMetadata)) {
    warnings.push(
      `Using cached session metadata replica; ${metadataAuthority.authoritativeSource} metadata is authoritative.`,
    );
  } else if (!hasOwnKeys(effectiveMetadata)) {
    warnings.push('Session metadata unavailable from authoritative sources.');
  }

  if (effectiveMetadata.slug && effectiveIdentity.slug && effectiveMetadata.slug !== effectiveIdentity.slug) {
    warnings.push(
      `session metadata slug mismatch: metadata "${effectiveMetadata.slug}" ignored in favor of "${effectiveIdentity.slug}"`,
    );
  }

  const workerConfigInput = workerCanonicalAuthorityActive ? workerCanonicalConfig : workerConfig;
  const workerProvided = workerConfigInput !== undefined && workerConfigInput !== null;
  const workerParsed: ParsedWorkerConfig = workerProvided
    ? parseWorkerConfig(workerConfigInput)
    : { ok: true, config: buildEmptyWorkerConfig(), errors: [] };
  if (workerProvided) {
    collectPrefixedErrors(errors, 'worker config', workerParsed.errors);
  }
  const workerProvenance = workerProvided ? AUTHORITY_SOURCES.WORKER_KV : 'missing';
  if (workerProvenance === 'missing') {
    warnings.push('Worker config unavailable from authoritative sources.');
  }

  const localProvided = localOverrides !== undefined && localOverrides !== null;
  const localParsed: ParsedLocalResourceOverrides = localProvided
    ? parseLocalResourceOverrides(localOverrides)
    : { ok: true, overrides: buildEmptyLocalOverrides(), errors: [] };
  if (localProvided) {
    collectPrefixedErrors(errors, 'local overrides', localParsed.errors);
  }
  const localProvenance = localProvided ? AUTHORITY_SOURCES.BROWSER : 'missing';

  const identityValue = {
    slug: effectiveIdentity.slug || '',
    sessionId: effectiveIdentity.sessionId || '',
    metadataURI: effectiveIdentity.metadataURI || '',
    chainId: effectiveIdentity.chainId || null,
  };
  const metadataValue = cloneValue(effectiveMetadata);
  const workerValue = cloneValue(workerParsed.config);
  const localValue = cloneValue(localParsed.overrides);
  const workerCanonicalGateValue = workerCanonicalAuthorityActive
    ? pickAuthorityFields(
        workerCanonicalConfig,
        (resolveSessionAuthorityGroup('gates', authorityMode) || AUTHORITY_MATRIX.gates).fields,
      )
    : {};
  const effectiveIdentityValue = workerCanonicalAuthorityActive
    ? {
        slug: identityValue.slug,
        sessionId: identityValue.sessionId,
      }
    : identityValue;
  const effective = {
    ...stripEffectiveMetadataOverrides(metadataValue),
    ...workerCanonicalGateValue,
    ...cloneValue(workerValue),
    ...cloneValue(effectiveIdentityValue),
    localPreferences: cloneValue(localValue),
  };

  return {
    ok: errors.length === 0,
    context: {
      identity: cloneValue(identityValue),
      metadata: metadataValue,
      worker: workerValue,
      local: localValue,
      effective,
    },
    provenance: {
      identity: identityProvenance,
      metadata: metadataProvenance,
      worker: workerProvenance,
      local: localProvenance,
    },
    warnings,
    errors,
  };
};
