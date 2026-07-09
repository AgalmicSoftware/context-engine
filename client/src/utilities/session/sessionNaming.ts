/**
 * @module sessionNaming
 * @description Session slug normalization, resolution, and display formatting.
 *              Provides canonical slug resolution, config alias mapping, and contract reference helpers.
 *
 * Key exports: normalizeSessionSlug, resolveActiveSessionSlug, resolveSessionConfigAliases, resolveSessionContractRef, mergeSessionContractMaps
 */
import { toStr } from '../shared/primitives.js';
import { readPublicUrlBasePath } from '../ui/publicUrl.js';
import { DEFAULT_SESSION_SLUG_ALIAS } from '../../variables/appConfig.js';
import {
  canonicalizeSessionSlug,
  isReservedSessionSlugKey,
  resolveCanonicalSessionConfig,
} from './canonicalSessionContext.js';
import type { SessionConfig, SessionContractRef as BoundarySessionContractRef, UnknownRecord } from './sessionTypes.js';

type SessionContractRef = {
  address?: string;
  chainId?: number;
};
type SessionContractMap = Record<string, SessionContractRef>;

type ResolveSessionConfigAliasesOptions = {
  defaults?: UnknownRecord;
  resolveBySlug?: ((slug: string) => unknown) | null;
  fallbackConfig?: unknown;
};

type ResolvedSessionConfigAliases = {
  hasExplicitSessionSlug: boolean;
  sessionSlug: string;
  sessionConfig: SessionConfig | null;
  sessionConfigSource: string;
  warnings: string[];
  provenance: {
    sessionSlug: string;
    sessionConfig: string;
  };
};

const isObj = (val: unknown): val is UnknownRecord => !!val && typeof val === 'object' && !Array.isArray(val);
const REGISTRY_SESSION_SLUG_RE = /^[a-z0-9_-]+$/;
const MAX_REGISTRY_SESSION_SLUG_LENGTH = 128;

const toPositiveNumber = (val: unknown): number | undefined => {
  const num = Number(val || 0);
  return Number.isFinite(num) && num > 0 ? num : undefined;
};

const CONTRACT_KEY_ALIASES = Object.freeze({
  surveys: ['surveys', 'survey', 'surveysContract', 'surveyContract'],
  sbtFactory: ['sbtFactory', 'sbt_factory', 'sbtfactory', 'sbtFactoryContract', 'factory'],
} as const);

const CONTRACT_ADDRESS_ALIASES = Object.freeze({
  surveys: ['surveysAddress', 'surveyAddress', 'surveysContractAddress', 'surveyContractAddress'],
  sbtFactory: ['sbtFactoryAddress', 'factoryAddress', 'sbtFactoryContractAddress'],
} as const);

const CONTRACT_CHAINID_ALIASES = Object.freeze({
  surveys: ['surveysChainId', 'surveyChainId'],
  sbtFactory: ['sbtFactoryChainId', 'factoryChainId'],
} as const);

export const normalizeSessionSlug = (rawSlug: unknown): string => {
  return canonicalizeSessionSlug(rawSlug);
};

export const normalizeRegistrySessionSlugForWrite = (rawSlug: unknown): string => {
  const normalized = toStr(rawSlug).trim().toLowerCase();
  const defaultAlias =
    toStr(DEFAULT_SESSION_SLUG_ALIAS || 'general')
      .trim()
      .toLowerCase() || 'general';
  if (!normalized || normalized === defaultAlias) return defaultAlias;
  return normalized;
};

export const validateRegistrySessionSlugForWrite = (rawSlug: unknown, { allowDefault = true } = {}) => {
  const input = toStr(rawSlug).trim();
  const slug = normalizeRegistrySessionSlugForWrite(rawSlug);
  const defaultAlias =
    toStr(DEFAULT_SESSION_SLUG_ALIAS || 'general')
      .trim()
      .toLowerCase() || 'general';

  if (!allowDefault && slug === defaultAlias && (!input || input.toLowerCase() === defaultAlias)) {
    return {
      ok: false,
      slug,
      changed: slug !== input,
      reason: 'default-disallowed',
      error: 'A non-default session slug is required.',
    };
  }

  if (isReservedSessionSlugKey(slug)) {
    return {
      ok: false,
      slug,
      changed: slug !== input,
      reason: 'reserved',
      error: 'This session slug is reserved.',
    };
  }

  if (slug.length > MAX_REGISTRY_SESSION_SLUG_LENGTH) {
    return {
      ok: false,
      slug,
      changed: slug !== input,
      reason: 'too-long',
      error: `Session slugs must be ${MAX_REGISTRY_SESSION_SLUG_LENGTH} characters or fewer.`,
    };
  }

  if (!REGISTRY_SESSION_SLUG_RE.test(slug)) {
    return {
      ok: false,
      slug,
      changed: slug !== input,
      reason: 'invalid-format',
      error: 'Session slugs must use lowercase letters, numbers, "_" or "-".',
    };
  }

  return {
    ok: true,
    slug,
    changed: slug !== input,
    reason: '',
    error: '',
  };
};

const stripConfiguredPublicBasePath = (pathname: unknown = ''): string => {
  const path = toStr(pathname).trim();
  const basePath = readPublicUrlBasePath();
  if (!path || !basePath || basePath === '/') return path;
  if (path === basePath || path === `${basePath}/`) return '/';
  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || '/';
  }
  return path;
};

export const resolveSessionSlugFromPathname = (pathname: unknown = ''): string | null => {
  const path = stripConfiguredPublicBasePath(pathname);
  if (!path) return null;
  const match = path.match(/^\/session(?:\/([^/?#]+))?(?:[/?#]|$)/i);
  if (!match) return null;
  try {
    return normalizeSessionSlug(decodeURIComponent(toStr(match[1] || '')));
  } catch {
    return normalizeSessionSlug(match[1] || '');
  }
};

export const resolveActiveSessionSlug = (input: UnknownRecord = {}): string =>
  normalizeSessionSlug(input.activeSessionSlug ?? input.sessionSlug ?? input.slug);

export const resolveSessionSlug = (input: UnknownRecord = {}): string =>
  normalizeSessionSlug(input.sessionSlug ?? input.activeSessionSlug ?? input.slug);

export const resolveSessionSlugPinned = (input: UnknownRecord = {}): boolean => !!input.sessionSlugPinned;

export const resolveSessionName = (input: UnknownRecord = {}): string => toStr(input.sessionName ?? '').trim();

export const resolveSessionAliases = (input: UnknownRecord = {}) => {
  const activeSessionSlug = resolveActiveSessionSlug(input);
  const sessionSlug = normalizeSessionSlug(input.sessionSlug ?? activeSessionSlug);
  const sessionSlugPinned = resolveSessionSlugPinned(input);
  const sessionName = resolveSessionName(input);
  return {
    activeSessionSlug,
    sessionSlug,
    sessionSlugPinned,
    sessionName,
  };
};

const normalizeContractRef = (value: unknown): SessionContractRef | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const address = toStr(value).trim();
    return address ? { address } : null;
  }
  if (!isObj(value)) return null;
  const source = value as BoundarySessionContractRef;
  const address = toStr(
    source.address ?? source.contractAddress ?? source.addr ?? source.target ?? source.value ?? '',
  ).trim();
  const chainId = toPositiveNumber(source.chainId ?? source.chainID ?? source.networkChainId ?? source.chain);
  if (!address && !chainId) return null;
  return {
    ...(address ? { address } : {}),
    ...(chainId ? { chainId } : {}),
  };
};

const pickContractRefFromMap = (contracts: unknown, keys: ReadonlyArray<string> = []): SessionContractRef | null => {
  if (!isObj(contracts)) return null;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(contracts, key)) continue;
    const ref = normalizeContractRef(contracts[key]);
    if (ref && (ref.address || ref.chainId)) return ref;
  }
  return null;
};

const pickFirstStringFromConfig = (cfg: unknown, keys: ReadonlyArray<string> = []): string => {
  if (!isObj(cfg)) return '';
  for (const key of keys) {
    const value = toStr(cfg[key]).trim();
    if (value) return value;
  }
  return '';
};

const pickFirstChainIdFromConfig = (cfg: unknown, keys: ReadonlyArray<string> = []): number | undefined => {
  if (!isObj(cfg)) return undefined;
  for (const key of keys) {
    const value = toPositiveNumber(cfg[key]);
    if (value) return value;
  }
  return undefined;
};

export const mergeSessionContractMaps = (...maps: unknown[]): SessionContractMap => {
  const out: SessionContractMap = {};
  maps.forEach((map) => {
    if (!isObj(map)) return;
    Object.entries(map).forEach(([key, value]) => {
      const next = normalizeContractRef(value);
      if (!next) return;
      out[key] = {
        ...(isObj(out[key]) ? out[key] : {}),
        ...(next.address ? { address: next.address } : {}),
        ...(next.chainId ? { chainId: next.chainId } : {}),
      };
    });
  });
  return out;
};

export const resolveSessionConfigAliases = (
  input: UnknownRecord = {},
  opts: ResolveSessionConfigAliasesOptions = {},
): ResolvedSessionConfigAliases => {
  const source = isObj(input) ? input : {};
  const defaults = isObj(opts.defaults) ? opts.defaults : {};
  const resolveBySlug = typeof opts.resolveBySlug === 'function' ? opts.resolveBySlug : null;
  const resolved = resolveCanonicalSessionConfig({
    source,
    defaults,
    resolveBySlug,
    fallbackConfig: opts.fallbackConfig,
  });

  return {
    hasExplicitSessionSlug: resolved.hasExplicitSessionSlug,
    sessionSlug: resolved.sessionSlug,
    sessionConfig: resolved.sessionConfig,
    sessionConfigSource: resolved.sessionConfigSource,
    warnings: resolved.warnings,
    provenance: resolved.provenance,
  };
};

export const resolveSessionContractRef = (input: UnknownRecord = {}) => {
  const aliases = resolveSessionConfigAliases(input, {
    defaults: isObj(input.defaults) ? input.defaults : undefined,
    resolveBySlug:
      typeof input.resolveBySlug === 'function' ? (input.resolveBySlug as (slug: string) => unknown) : null,
    fallbackConfig: input.fallbackConfig,
  });
  const cfg = isObj(aliases.sessionConfig) ? aliases.sessionConfig : null;
  const contracts = mergeSessionContractMaps(
    isObj(cfg?.contracts) ? cfg.contracts : null,
    isObj(input.contracts) ? input.contracts : null,
  );
  const contractKey = toStr(input.contractKey || '').trim();
  if (!contractKey) {
    return {
      ...aliases,
      contractKey: '',
      address: '',
      chainId: undefined,
    };
  }
  const keyAliases = (CONTRACT_KEY_ALIASES as Record<string, readonly string[]>)[contractKey];
  if (!keyAliases) {
    return {
      ...aliases,
      contractKey,
      address: '',
      chainId: undefined,
    };
  }
  const refFromMap = pickContractRefFromMap(contracts, keyAliases) || {};

  const addressFallbackAliases = (CONTRACT_ADDRESS_ALIASES as Record<string, readonly string[]>)[contractKey] || [];
  const chainIdFallbackAliases = (CONTRACT_CHAINID_ALIASES as Record<string, readonly string[]>)[contractKey] || [];

  const address = toStr(refFromMap.address).trim() || pickFirstStringFromConfig(cfg, addressFallbackAliases);
  const chainId =
    toPositiveNumber(refFromMap.chainId) ||
    pickFirstChainIdFromConfig(cfg, chainIdFallbackAliases) ||
    toPositiveNumber(cfg?.networkChainId);

  return {
    ...aliases,
    contractKey,
    address,
    chainId,
  };
};
