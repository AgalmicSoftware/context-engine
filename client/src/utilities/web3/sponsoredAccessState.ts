import { ethers } from 'ethers';
import { toStr } from '../shared/primitives.js';

type AnyRecord = Record<string, any>;
type SessionConfigLike = AnyRecord;

export type SponsoredGateState = 'restricted' | 'open' | 'unresolved' | 'unavailable';

export type SponsoredGate = {
  type?: 'sbt';
  label?: string | null;
  gateId?: string | null;
  sbtAddress?: string | null;
  sbtAddresses?: string[];
  chainId?: number | string | null;
  litChain?: string | null;
  mode?: 'any' | 'all' | string;
  fallback?: AnyRecord | null;
  perMemberLimit?: number | string | null;
  requireAll?: unknown;
  operator?: unknown;
  gateMode?: unknown;
  require?: unknown;
  [key: string]: any;
};

export type SponsoredResource = string | null | undefined;

type SponsoredAccessStatus =
  'no-gate' | 'unknown' | 'needs-wallet' | 'invalid-gate' | 'granted' | 'denied' | 'error' | 'unresolved' | 'timed-out';

export type SponsoredAccessResult = {
  status: SponsoredAccessStatus;
  gate: SponsoredGate | null;
  resourceKey: SponsoredResource;
  error?: string;
};

export type SponsoredGateResolution = {
  handled: boolean;
  resourceKey: string;
  status: SponsoredGateState;
  gate: SponsoredGate | null;
};

export type SponsoredAccessChangePayload = {
  sessionSlug: string;
  resourceKey: string;
  account: string;
  status: string;
  accessMode: string;
};

type SponsoredAccessChangeListener = (payload: SponsoredAccessChangePayload) => void;
type CheckSbtAccessFn = (params: {
  sbtAddress: string;
  account: string;
  sessionConfig?: SessionConfigLike | null;
  sessionSlug?: string;
  resourceKey?: SponsoredResource;
}) => Promise<boolean> | boolean;
type AccessCacheEntry = {
  ts: number;
  value: SponsoredAccessResult | null;
};
type AccessCacheParams = {
  account?: string;
  gate?: SponsoredGate | null;
  resourceKey?: SponsoredResource;
  maxAgeMs?: number;
};
type WriteCachedSponsoredAccessOptions = {
  cacheKey?: string;
  sessionSlug?: string;
  account?: string;
  resourceKey?: SponsoredResource;
  value?: SponsoredAccessResult | null;
  ts?: number;
};
type RunAccessCheckWithInflightOptions = {
  cacheKey?: string;
  runCheck?: (() => Promise<SponsoredAccessResult> | SponsoredAccessResult | null) | null;
  timeoutMs?: number;
  onResolve?: ((value: SponsoredAccessResult) => SponsoredAccessResult) | null;
  onReject?: ((err: unknown) => SponsoredAccessResult) | null;
  onTimeout?: (() => SponsoredAccessResult | null) | null;
};

/**
 * Canonical sponsored gate state constants.
 */
export const SPONSORED_GATE_STATES = Object.freeze({
  RESTRICTED: 'restricted',
  OPEN: 'open',
  UNRESOLVED: 'unresolved',
  UNAVAILABLE: 'unavailable',
} as const);

/**
 * Normalize a sponsored gate mode to `any` or `all`.
 */
export const normalizeGateMode = (gate: SponsoredGate | null | undefined = {}): 'any' | 'all' => {
  if (!gate) return 'any';

  const requireAll = gate.requireAll;
  if (requireAll === true || requireAll === 1 || toStr(requireAll).trim() === '1') {
    return 'all';
  }

  const raw = toStr(gate.mode || gate.operator || gate.gateMode || gate.require || '')
    .trim()
    .toLowerCase();
  if (raw === 'all' || raw === 'and' || raw === '1') return 'all';
  return 'any';
};

/**
 * Collect unique SBT addresses from a sponsored gate payload.
 */
export const getGateSbtAddresses = (gate: SponsoredGate | null | undefined = {}): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (addr: unknown): void => {
    if (!ethers.utils.isAddress(addr as string)) return;
    const lower = String(addr).toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(String(addr));
  };
  if (Array.isArray(gate?.sbtAddresses)) {
    gate.sbtAddresses.forEach(push);
  }
  if (gate?.sbtAddress) push(gate.sbtAddress);
  return out;
};

const resolveOnChainGateForResource = (
  cfg: SessionConfigLike = {},
  resourceKey: SponsoredResource = '',
): SponsoredGateResolution => {
  const registry = cfg?.__registry && typeof cfg.__registry === 'object' ? cfg.__registry : {};
  const gateAuthority = toStr(registry.gateAuthority).trim().toLowerCase();
  const gatesByResource =
    registry.gatesByResource && typeof registry.gatesByResource === 'object' ? registry.gatesByResource : null;
  const key = toStr(resourceKey).trim() || 'default';
  if (gateAuthority !== 'onchain') {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.UNAVAILABLE,
      gate: null,
    };
  }
  if (!gatesByResource) {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.UNAVAILABLE,
      gate: null,
    };
  }

  const requestedGateSnapshot = gatesByResource[key] || null;
  const defaultGateSnapshot = key !== 'default' ? gatesByResource.default || null : null;
  const requestedLookupStatus = toStr(requestedGateSnapshot?.lookupStatus).trim().toLowerCase();
  const defaultLookupStatus = toStr(defaultGateSnapshot?.lookupStatus).trim().toLowerCase();
  const requestedSbtAddresses = getGateSbtAddresses({
    sbtAddresses: requestedGateSnapshot?.sbtAddresses,
    sbtAddress: requestedGateSnapshot?.sbtAddress,
  });
  const defaultSbtAddresses = getGateSbtAddresses({
    sbtAddresses: defaultGateSnapshot?.sbtAddresses,
    sbtAddress: defaultGateSnapshot?.sbtAddress,
  });
  const shouldUseDefaultGate =
    key === 'rpc' &&
    defaultLookupStatus === 'ok' &&
    (requestedLookupStatus !== 'ok' || (!requestedSbtAddresses.length && defaultSbtAddresses.length));
  const gateSnapshot = shouldUseDefaultGate ? defaultGateSnapshot : requestedGateSnapshot;
  const lookupStatus = toStr(gateSnapshot?.lookupStatus).trim().toLowerCase();
  if (lookupStatus !== 'ok') {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.UNRESOLVED,
      gate: null,
    };
  }
  const sbtAddresses = getGateSbtAddresses({
    sbtAddresses: gateSnapshot?.sbtAddresses,
    sbtAddress: gateSnapshot?.sbtAddress,
  });
  if (!sbtAddresses.length) {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.OPEN,
      gate: null,
    };
  }
  return {
    handled: true,
    resourceKey: key,
    status: SPONSORED_GATE_STATES.RESTRICTED,
    gate: {
      type: 'sbt',
      label:
        toStr(gateSnapshot?.label || gateSnapshot?.name || gateSnapshot?.title).trim() ||
        `Registry ${shouldUseDefaultGate ? 'default' : key} gate`,
      gateId: toStr(gateSnapshot?.gateId || gateSnapshot?.id).trim() || null,
      sbtAddress: sbtAddresses[0],
      sbtAddresses,
      chainId: gateSnapshot?.chainId || cfg.networkChainId || null,
      litChain: gateSnapshot?.litChain || gateSnapshot?.chain || null,
      mode: gateSnapshot?.mode || 'any',
      perMemberLimit: gateSnapshot?.perMemberLimit || null,
    },
  };
};

/**
 * Resolve the default sponsored gate from a session config.
 */
export const getDefaultSponsoredGate = (cfg: SessionConfigLike = {}): SponsoredGate | null => {
  return resolveOnChainGateForResource(cfg, 'default').gate;
};

/**
 * Resolve the sponsored gate state for a resource key.
 */
export const resolveSponsoredGateStateForResource = (
  cfg: SessionConfigLike = {},
  resourceKey: SponsoredResource = '',
): SponsoredGateResolution => {
  return resolveOnChainGateForResource(cfg, resourceKey || 'default');
};

/**
 * Resolve the sponsored gate payload for a resource key.
 */
export const resolveSponsoredGateForResource = (
  cfg: SessionConfigLike = {},
  resourceKey: SponsoredResource = '',
): SponsoredGate | null => {
  return resolveSponsoredGateStateForResource(cfg, resourceKey || 'default').gate;
};

const accessCache = new Map<string, AccessCacheEntry>();
const accessInflight = new Map<string, Promise<SponsoredAccessResult | null>>();
const SPONSORED_ACCESS_INFLIGHT_TIMEOUT_MS = 30 * 1000;

/**
 * Cache hit TTL for repeated sponsored access reads.
 */
export const SPONSORED_ACCESS_CACHE_HIT_TTL_MS = 30 * 1000;
const ACCESS_CACHE_STALE_TTL_MS = 15 * 60 * 1000;
const ACCESS_CACHE_MAX = 500;
const SPONSORED_ACCESS_STATES = Object.freeze({
  TIMED_OUT: 'timed-out',
} as const);
const sponsoredAccessChangeListeners = new Set<SponsoredAccessChangeListener>();

const pruneAccessCache = (nowIn = Date.now()): void => {
  const now = Number(nowIn || Date.now());
  const staleBefore = now - ACCESS_CACHE_STALE_TTL_MS;
  accessCache.forEach((entry, key) => {
    const ts = Number(entry?.ts || 0);
    if (!Number.isFinite(ts) || ts <= 0 || ts <= staleBefore) {
      accessCache.delete(key);
    }
  });
  while (accessCache.size > ACCESS_CACHE_MAX) {
    const oldest = accessCache.keys().next().value;
    if (!oldest) break;
    accessCache.delete(oldest);
  }
};

const buildAccessCacheKey = ({
  account,
  gate,
  resourceKey,
}: {
  account?: string;
  gate?: SponsoredGate | null;
  resourceKey?: SponsoredResource;
} = {}): string => {
  const normalizedAccount = toStr(account).trim().toLowerCase();
  if (!normalizedAccount || !ethers.utils.isAddress(normalizedAccount)) return '';
  const sbtAddresses = getGateSbtAddresses(gate);
  if (!sbtAddresses.length) return '';
  const mode = normalizeGateMode(gate);
  const addressKey = sbtAddresses
    .map((addr) => addr.toLowerCase())
    .sort()
    .join('|');
  return `${normalizedAccount}:${addressKey}:${gate?.chainId || ''}:${mode}:${toStr(resourceKey).trim() || 'default'}`;
};

const normalizeAccessChangeStatus = (status: unknown): string => toStr(status).trim().toLowerCase();

const normalizeAccessChangeAccount = (account: unknown): string => {
  const normalized = toStr(account).trim().toLowerCase();
  return ethers.utils.isAddress(normalized) ? normalized : '';
};

const emitSponsoredAccessChange = (payload: SponsoredAccessChangePayload): void => {
  sponsoredAccessChangeListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {}
  });
};

const shouldEmitSponsoredAccessChange = (previousStatus: unknown, nextStatus: unknown): boolean => {
  const prev = normalizeAccessChangeStatus(previousStatus) || 'unknown';
  const next = normalizeAccessChangeStatus(nextStatus);
  if (next !== 'granted' && next !== 'denied') return false;
  if (prev === next) return false;
  return prev === 'checking' || prev === 'unknown';
};

/**
 * Subscribe to sponsored access state transitions for cached gate checks.
 */
export const addSponsoredAccessChangeListener = (listener: SponsoredAccessChangeListener | unknown): (() => void) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  const typedListener = listener as SponsoredAccessChangeListener;
  sponsoredAccessChangeListeners.add(typedListener);
  return () => {
    sponsoredAccessChangeListeners.delete(typedListener);
  };
};

const writeCachedSponsoredAccess = ({
  cacheKey,
  sessionSlug,
  account,
  resourceKey,
  value,
  ts = Date.now(),
}: WriteCachedSponsoredAccessOptions = {}): SponsoredAccessResult | null => {
  if (!cacheKey || !value) return value || null;
  const previousStatus = accessCache.get(cacheKey)?.value?.status || 'unknown';
  const writeTs = Number(ts || Date.now()) || Date.now();
  accessCache.set(cacheKey, { ts: writeTs, value });
  pruneAccessCache(writeTs);
  if (shouldEmitSponsoredAccessChange(previousStatus, value?.status)) {
    emitSponsoredAccessChange({
      sessionSlug: toStr(sessionSlug).trim(),
      resourceKey: toStr(resourceKey).trim() || 'default',
      account: normalizeAccessChangeAccount(account),
      status: normalizeAccessChangeStatus(value?.status),
      accessMode: 'sponsored-restricted',
    });
  }
  return value;
};

const readAccessCacheEntry = ({
  account,
  gate,
  resourceKey,
  maxAgeMs = ACCESS_CACHE_STALE_TTL_MS,
}: AccessCacheParams = {}): AccessCacheEntry | null => {
  const cacheKey = buildAccessCacheKey({ account, gate, resourceKey });
  if (!cacheKey) return null;
  const now = Date.now();
  pruneAccessCache(now);
  const cached = accessCache.get(cacheKey);
  if (!cached) return null;
  const ageMs = now - Number(cached.ts || 0);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > Number(maxAgeMs || 0)) {
    accessCache.delete(cacheKey);
    return null;
  }
  return cached;
};

const toPublicSponsoredAccessValue = (value: SponsoredAccessResult | null): SponsoredAccessResult | null => {
  if (!value || typeof value !== 'object') return value || null;
  const status = toStr(value?.status).trim().toLowerCase();
  if (status !== SPONSORED_ACCESS_STATES.TIMED_OUT) {
    return value;
  }
  // Keep timeout state internal so downstream consumers continue to treat it
  // as a retryable unresolved check instead of a terminal denial.
  return {
    ...value,
    status: SPONSORED_GATE_STATES.UNRESOLVED,
  };
};

const runAccessCheckWithInflight = ({
  cacheKey,
  runCheck,
  timeoutMs = SPONSORED_ACCESS_INFLIGHT_TIMEOUT_MS,
  onResolve,
  onReject,
  onTimeout,
}: RunAccessCheckWithInflightOptions = {}): Promise<SponsoredAccessResult | null> => {
  if (!cacheKey) {
    try {
      return Promise.resolve(runCheck?.())
        .then((value) =>
          typeof onResolve === 'function'
            ? onResolve(value as SponsoredAccessResult)
            : (value as SponsoredAccessResult | null),
        )
        .catch((err) => {
          if (typeof onReject === 'function') {
            return onReject(err);
          }
          throw err;
        });
    } catch (err) {
      if (typeof onReject === 'function') {
        return Promise.resolve(onReject(err));
      }
      return Promise.reject(err);
    }
  }
  if (accessInflight.has(cacheKey)) {
    return accessInflight.get(cacheKey) as Promise<SponsoredAccessResult | null>;
  }
  let inflight: Promise<SponsoredAccessResult | null> | null = null;
  inflight = new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = (handler: (value: any) => void, value: any): void => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (accessInflight.get(cacheKey) === inflight) {
        accessInflight.delete(cacheKey);
      }
      handler(value);
    };

    timeoutId = setTimeout(
      () => {
        try {
          finish(resolve, typeof onTimeout === 'function' ? onTimeout() : null);
        } catch (err) {
          finish(reject, err);
        }
      },
      Math.max(0, Number(timeoutMs || 0)),
    );

    let runPromise: Promise<SponsoredAccessResult | null | undefined> | null = null;
    try {
      runPromise = Promise.resolve(runCheck?.());
    } catch (err) {
      if (typeof onReject === 'function') {
        try {
          finish(resolve, onReject(err));
        } catch (nextErr) {
          finish(reject, nextErr);
        }
        return;
      }
      finish(reject, err);
      return;
    }

    runPromise
      .then((value) => {
        if (settled) return undefined;
        return typeof onResolve === 'function'
          ? onResolve(value as SponsoredAccessResult)
          : (value as SponsoredAccessResult | null);
      })
      .catch((err) => {
        if (settled) return undefined;
        if (typeof onReject === 'function') {
          return onReject(err);
        }
        throw err;
      })
      .then((value) => {
        if (settled) return;
        finish(resolve, value);
      })
      .catch((err) => {
        if (settled) return;
        finish(reject, err);
      });
  });
  accessInflight.set(cacheKey, inflight);
  return inflight;
};

/**
 * Read a recent sponsored access result from the in-memory cache.
 */
export const readCachedSponsoredAccess = ({
  sessionConfig,
  account,
  resourceKey,
  maxAgeMs = ACCESS_CACHE_STALE_TTL_MS,
}: {
  sessionConfig?: SessionConfigLike | null;
  account?: string;
  resourceKey?: SponsoredResource;
  maxAgeMs?: number;
} = {}): SponsoredAccessResult | null => {
  const gateState = resolveSponsoredGateStateForResource(sessionConfig || {}, resourceKey);
  const gate = gateState?.gate || null;
  if (!gate || gate.type !== 'sbt') return null;
  const cached = readAccessCacheEntry({
    account,
    gate,
    resourceKey,
    maxAgeMs,
  });
  return cached?.value ? toPublicSponsoredAccessValue(cached.value) : null;
};

/**
 * Evaluate sponsored access for a resource using an injected SBT checker.
 */
export const checkSponsoredAccessWithChecker = async ({
  sessionConfig,
  sessionSlug,
  account,
  resourceKey,
  checkSbtAccess,
}: {
  sessionConfig?: SessionConfigLike | null;
  sessionSlug?: string;
  account?: string;
  resourceKey?: SponsoredResource;
  checkSbtAccess?: CheckSbtAccessFn;
} = {}): Promise<SponsoredAccessResult> => {
  const cfg = sessionConfig || null;
  const gateState = resolveSponsoredGateStateForResource(cfg || {}, resourceKey);
  const gate = gateState?.gate || null;
  if (!gate || gate.type !== 'sbt') {
    if (gateState?.status === SPONSORED_GATE_STATES.OPEN) {
      return { status: 'no-gate', gate: null, resourceKey };
    }
    if (
      gateState?.status === SPONSORED_GATE_STATES.UNAVAILABLE ||
      gateState?.status === SPONSORED_GATE_STATES.UNRESOLVED
    ) {
      return { status: 'unknown', gate: null, resourceKey };
    }
    return { status: 'no-gate', gate: gate || null, resourceKey };
  }
  if (!account || !ethers.utils.isAddress(account)) {
    return { status: 'needs-wallet', gate, resourceKey };
  }
  const sbtAddresses = getGateSbtAddresses(gate);
  if (!sbtAddresses.length) {
    return { status: 'invalid-gate', gate, resourceKey };
  }

  const now = Date.now();
  pruneAccessCache(now);
  const key = buildAccessCacheKey({ account, gate, resourceKey });
  const cached = key ? accessCache.get(key) : null;
  if (cached && now - Number(cached.ts || 0) < SPONSORED_ACCESS_CACHE_HIT_TTL_MS) {
    return toPublicSponsoredAccessValue(cached.value) as SponsoredAccessResult;
  }
  if (cached) accessCache.delete(key);

  const persistAccessResult = (value: SponsoredAccessResult): SponsoredAccessResult => {
    const status = toStr(value?.status).trim().toLowerCase();
    if (status !== 'granted' && status !== 'denied' && status !== SPONSORED_ACCESS_STATES.TIMED_OUT) {
      return value;
    }
    return writeCachedSponsoredAccess({
      cacheKey: key,
      sessionSlug,
      account,
      resourceKey,
      value,
      ts: Date.now(),
    }) as SponsoredAccessResult;
  };

  return Promise.resolve(
    runAccessCheckWithInflight({
      cacheKey: key,
      runCheck: async () => {
        const checks = await Promise.all(
          sbtAddresses.map((addr) =>
            Promise.resolve(
              checkSbtAccess?.({
                sbtAddress: addr,
                account,
                sessionConfig: cfg,
                sessionSlug,
                resourceKey,
              }),
            ),
          ),
        );
        const has = normalizeGateMode(gate) === 'all' ? checks.every(Boolean) : checks.some(Boolean);
        return { status: has ? 'granted' : 'denied', gate, resourceKey };
      },
      onResolve: persistAccessResult,
      onReject: (err) => ({ status: 'error', error: (err as Error | null)?.message || 'unknown', gate, resourceKey }),
      onTimeout: () =>
        persistAccessResult({
          status: SPONSORED_ACCESS_STATES.TIMED_OUT,
          gate,
          resourceKey,
        }),
    }),
  ).then((value) => toPublicSponsoredAccessValue(value) as SponsoredAccessResult);
};

/**
 * Warm the sponsored access cache for a gated resource when possible.
 */
export const primeSponsoredAccessCheckWithChecker = ({
  sessionConfig,
  sessionSlug,
  account,
  resourceKey,
  checkSbtAccess,
}: {
  sessionConfig?: SessionConfigLike | null;
  sessionSlug?: string;
  account?: string;
  resourceKey?: SponsoredResource;
  checkSbtAccess?: CheckSbtAccessFn;
} = {}): Promise<SponsoredAccessResult | null> => {
  const gateState = resolveSponsoredGateStateForResource(sessionConfig || {}, resourceKey);
  const gate = gateState?.gate || null;
  if (!gate || gate.type !== 'sbt') {
    return Promise.resolve(null);
  }
  const cacheKey = buildAccessCacheKey({ account, gate, resourceKey });
  if (!cacheKey) {
    return Promise.resolve(null);
  }
  const cached = readAccessCacheEntry({
    account,
    gate,
    resourceKey,
    maxAgeMs: SPONSORED_ACCESS_CACHE_HIT_TTL_MS,
  });
  if (cached?.value) {
    return Promise.resolve(toPublicSponsoredAccessValue(cached.value));
  }
  return checkSponsoredAccessWithChecker({
    sessionConfig,
    sessionSlug,
    account,
    resourceKey,
    checkSbtAccess,
  });
};
