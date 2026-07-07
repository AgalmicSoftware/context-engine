/**
 * @module sessionConfigResolvers
 * @description Pure session config lookup helpers shared by contractScripts.
 */

import { USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import { getChainById } from '../../variables/chains.js';
import { canonicalizeSessionSlug, resolveSessionConfigFromSources } from '../session/canonicalSessionContext.js';
import { normalizeSessionNaming } from '../session/sessionMetadata.js';
import { resolveSessionConfigAliases } from '../session/sessionNaming.js';
import {
  getAllDemoSessionConfigs,
  getDefaultSessionConfig as getDemoDefaultSessionConfig,
  getDemoSessionConfigForDisplay,
} from '../session/sessionSourceResolver.js';
import { overlayCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';
import { extractChainId } from './chainIdResolution.js';
import { sessionRegistryStore } from './sessionRegistry.js';

type AnyRecord = Record<string, any>;
type SessionConfigLike = AnyRecord;
type SessionConfigEntry = [string, SessionConfigLike];
type ResolveSessionConfigEntryOptions = {
  preferRegistry?: boolean;
  allowDemoFallback?: boolean;
};
type NormalizeResolvedSessionConfigOptions = {
  normalizeRegistry?: boolean;
};
type ResolvedSessionConfigResult = {
  sessionSlug: string;
  sessionConfig?: SessionConfigLike | null;
  sessionConfigSource?: string;
  warnings?: unknown[];
  [key: string]: any;
};
type ResolvedSessionAlias = {
  sessionConfig?: SessionConfigLike | null;
  sessionSlug?: string;
  hasExplicitSessionSlug?: boolean;
  [key: string]: any;
};
type SessionLists = {
  featured_SBTs_LIST: unknown[];
  ignored_SBTs_LIST: unknown[];
  HIGHLIGHTED_QUESTION_IDS: unknown[];
  BLOCKED_QUESTION_IDS: unknown[];
  HIGHLIGHTED_SURVEY_IDS: unknown[];
  BLOCKED_SURVEY_IDS: unknown[];
};

const defaultStrictAllowDemoFallback = (): boolean => !USE_ONCHAIN_SESSION_REGISTRY;

export function resolveSessionConfigEntry(
  sessionSlug: unknown = '',
  opts: ResolveSessionConfigEntryOptions = {},
): ResolvedSessionConfigResult {
  const hasPreferRegistry = Object.prototype.hasOwnProperty.call(opts, 'preferRegistry');
  const hasAllowDemoFallback = Object.prototype.hasOwnProperty.call(opts, 'allowDemoFallback');
  const preferRegistry = hasPreferRegistry ? !!opts.preferRegistry : true;
  const allowDemoFallback = hasAllowDemoFallback ? !!opts.allowDemoFallback : defaultStrictAllowDemoFallback();
  const resolved = resolveSessionConfigFromSources({
    sessionSlug,
    getRegistrySessionConfig: (slug: unknown) => sessionRegistryStore.getSessionConfig(slug),
    preferRegistry,
    allowDemoFallback: false,
  }) as ResolvedSessionConfigResult;
  if (resolved.sessionConfig || !allowDemoFallback) return resolved;
  const demoConfig = getDemoSessionConfigForDisplay(resolved.sessionSlug) as SessionConfigLike | null;
  return {
    ...resolved,
    sessionConfig: demoConfig,
    sessionConfigSource: demoConfig ? 'demo' : 'missing',
    warnings: resolved.warnings || [],
  };
}

export function normalizeResolvedSessionConfig(
  resolved: ResolvedSessionConfigResult | null | undefined,
  opts: NormalizeResolvedSessionConfigOptions = {},
): SessionConfigLike | null {
  if (!resolved?.sessionConfig) return null;
  if (resolved.sessionConfigSource === 'registry' && opts.normalizeRegistry !== true) {
    return overlayCachedSessionWorkerConfig({
      slug: resolved.sessionSlug,
      sessionConfig: resolved.sessionConfig,
    }) as SessionConfigLike | null;
  }
  return overlayCachedSessionWorkerConfig({
    slug: resolved.sessionSlug,
    sessionConfig: normalizeSessionNaming(resolved.sessionConfig) as SessionConfigLike,
  }) as SessionConfigLike | null;
}

// Find a demo session by key or slug; accept object configs too.
// === UPDATED: resolveSession ― treat '' as canonical general slug; also accept 'general' ===
export function resolveSession(groupKeyOrCfg?: unknown): SessionConfigLike | null {
  let resolvedInput = groupKeyOrCfg;

  if (resolvedInput && typeof resolvedInput === 'object') {
    const aliasResolved = resolveSessionConfigAliases(resolvedInput as SessionConfigLike) as ResolvedSessionAlias;
    const aliasCfg = aliasResolved.sessionConfig || null;
    if (aliasCfg && typeof aliasCfg === 'object') {
      const merged: SessionConfigLike = { ...aliasCfg, ...(resolvedInput as SessionConfigLike) };
      delete merged.sessionConfig;
      delete merged.sessionSlug;
      delete merged.activeSessionSlug;
      delete merged.group;
      if (!merged.slug && aliasResolved.sessionSlug) merged.slug = aliasResolved.sessionSlug;
      return normalizeSessionNaming(merged) as SessionConfigLike;
    }
    if (aliasResolved.hasExplicitSessionSlug) {
      resolvedInput = aliasResolved.sessionSlug;
    }
  }

  if (resolvedInput === '' || resolvedInput == null) return getDefaultSessionConfig();
  if (typeof resolvedInput === 'string') {
    const normalizedInput = normalizeSessionSlug(resolvedInput);
    const resolved = getSessionConfigBySlug(normalizedInput);
    if (resolved) return normalizeSessionNaming(resolved) as SessionConfigLike;
    // Preserve unresolved non-general slug without silently falling back to general.
    return {
      slug: normalizedInput,
      contracts: {},
      __unresolved: true,
    };
  }
  if (typeof resolvedInput === 'object') return normalizeSessionNaming(resolvedInput) as SessionConfigLike;
  // Fallback to "general" only when strict demo-fallback policy allows it.
  if (!defaultStrictAllowDemoFallback()) return null;
  return getDemoDefaultSessionConfig() as SessionConfigLike | null;
}

// Resolve a demo session by a human-readable name without falling back to "general".
export function resolveSessionByName(rawName: unknown): SessionConfigLike | null {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const lowered = name.toLowerCase();
  for (const [key, g] of getAllSessionEntries()) {
    if (!g) continue;
    const normalized = normalizeSessionNaming(g) as SessionConfigLike;
    if (String(key || '').toLowerCase() === lowered) return normalized;
    if (String(normalized.slug || '').toLowerCase() === lowered) return normalized;
    if (String(normalized.sessionName || '').toLowerCase() === lowered) return normalized;
  }
  return null;
}

export function resolveDemoSessionBySlug(
  slugIn: unknown = '',
  opts: ResolveSessionConfigEntryOptions = {},
): SessionConfigLike | null {
  const hasAllowDemoFallback = Object.prototype.hasOwnProperty.call(opts, 'allowDemoFallback');
  // Compatibility/demo UI readers can opt in explicitly without weakening the strict default.
  return normalizeResolvedSessionConfig(
    resolveSessionConfigEntry(slugIn, {
      preferRegistry: false,
      allowDemoFallback: hasAllowDemoFallback ? !!opts.allowDemoFallback : defaultStrictAllowDemoFallback(),
    }),
    { normalizeRegistry: true },
  );
}

// --- Tiny helpers: session config & lists + chain label (additive) ---
export function normalizeSessionSlug(rawSlug: unknown): string {
  return canonicalizeSessionSlug(rawSlug);
}

// Session-first aliases (legacy group naming remains supported).
// Legacy alias removed — function is now normalizeSessionSlug directly.

export function getDefaultSessionConfig(): SessionConfigLike | null {
  return normalizeResolvedSessionConfig(resolveSessionConfigEntry(''), { normalizeRegistry: true });
}

// Legacy alias removed — function is now getDefaultSessionConfig directly.

export function getSessionConfigBySlug(slugOrEmpty: unknown): SessionConfigLike | null {
  const resolved = resolveSessionConfigEntry(slugOrEmpty === undefined ? '' : slugOrEmpty);
  if (!resolved.sessionConfig) {
    // Preserve historical contract of this helper:
    // unknown non-general slugs resolve to null so callers can trigger not-found paths.
    return null;
  }
  return normalizeResolvedSessionConfig(resolved);
}

// Legacy alias removed — function is now getSessionConfigBySlug directly.

export function getDemoSessionConfigBySlug(
  slugOrEmpty: unknown,
  opts: ResolveSessionConfigEntryOptions = {},
): SessionConfigLike | null {
  return resolveDemoSessionBySlug(slugOrEmpty === undefined ? '' : slugOrEmpty, opts);
}

export function getSessionConfigBySlugOrDefault(slugOrEmpty: unknown): SessionConfigLike | null {
  const normalized = normalizeSessionSlug(slugOrEmpty === undefined ? '' : slugOrEmpty);
  if (normalized === '') return getDefaultSessionConfig();
  const cfg = getSessionConfigBySlug(slugOrEmpty);
  if (cfg && !cfg.__unresolved) return cfg;
  // Stage-B: only fall back to default for the general/empty session, not non-general slugs.
  return null;
}

// Legacy alias removed — function is now getSessionConfigBySlugOrDefault directly.

export function getAllSessionEntries(): SessionConfigEntry[] {
  const cached = sessionRegistryStore.getAllSessionEntries();
  if (cached && cached.length) {
    return (cached as SessionConfigEntry[]).map(
      ([key, cfg]) => [key, normalizeSessionNaming(cfg) as SessionConfigLike] as SessionConfigEntry,
    );
  }
  // In on-chain mode, do not silently fall back to demo sessions.
  if (!defaultStrictAllowDemoFallback()) return [];
  return getAllDemoSessionConfigs() as SessionConfigEntry[];
}

// Legacy alias removed — function is now getAllSessionEntries directly.

export function getAllSessionSlugs(opts: { includeEmpty?: boolean } = {}): string[] {
  const includeEmpty = opts && Object.prototype.hasOwnProperty.call(opts, 'includeEmpty') ? !!opts.includeEmpty : true;
  const out: string[] = [];
  for (const [key, cfg] of getAllSessionEntries()) {
    let slug = (typeof cfg?.slug === 'string' ? cfg.slug : key) || '';
    if (slug === 'general') slug = '';
    if (!slug && !includeEmpty) continue;
    out.push(String(slug));
  }
  return Array.from(new Set(out));
}

export function getSessionConfigByName(name: unknown): SessionConfigLike | null {
  return resolveSessionByName(name);
}

export function getSessionSlugByName(name: unknown): string | null {
  const cfg = resolveSessionByName(name);
  if (!cfg) return null;
  const slug = typeof cfg.slug === 'string' ? cfg.slug : '';
  return slug === 'general' ? '' : slug;
}

export function getSessionLists(slugOrEmpty: unknown): SessionLists {
  const cfg = (getSessionConfigBySlug(slugOrEmpty) || {}) as SessionConfigLike;
  return {
    featured_SBTs_LIST: Array.isArray(cfg?.featured_SBTs_LIST) ? cfg.featured_SBTs_LIST : [],
    ignored_SBTs_LIST: Array.isArray(cfg?.ignored_SBTs_LIST) ? cfg.ignored_SBTs_LIST : [],
    HIGHLIGHTED_QUESTION_IDS: Array.isArray(cfg?.HIGHLIGHTED_QUESTION_IDS) ? cfg.HIGHLIGHTED_QUESTION_IDS : [],
    BLOCKED_QUESTION_IDS: Array.isArray(cfg?.BLOCKED_QUESTION_IDS) ? cfg.BLOCKED_QUESTION_IDS : [],
    HIGHLIGHTED_SURVEY_IDS: Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) ? cfg.HIGHLIGHTED_SURVEY_IDS : [],
    BLOCKED_SURVEY_IDS: Array.isArray(cfg?.BLOCKED_SURVEY_IDS) ? cfg.BLOCKED_SURVEY_IDS : [],
  };
}

export function getSessionChainId(sessionKeyOrCfg: unknown = null): number | null {
  const cfg = getSessionConfigBySlugOrDefault(sessionKeyOrCfg === undefined ? '' : sessionKeyOrCfg);
  const id = extractChainId(cfg, { strict: true });
  return id || null;
}

export function getSessionNetwork(sessionKeyOrCfg: unknown = null): AnyRecord | null {
  const id = getSessionChainId(sessionKeyOrCfg);
  const ch = getChainById(id);
  if (ch) return ch as AnyRecord;
  if (!id) return null;
  return {
    id,
    name: `Chain ${id}`,
    network: String(id),
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [] }, public: { http: [] } },
    blockExplorers: { default: { name: '', url: '' } },
    unsupported: false,
  };
}

export function getChainLabelById(chainId: unknown): string {
  const n = Number(chainId);
  const idForLabel = Number.isFinite(n) ? n : typeof chainId === 'string' ? chainId.trim() : String(chainId);
  const ch = Number.isFinite(n) ? getChainById(n) : null;
  const name = (ch as AnyRecord | null)?.name || `chain-${idForLabel}`;
  return `${name} (${idForLabel})`;
}
