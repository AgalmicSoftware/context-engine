/**
 * @module sessionConfigResolvers
 * @description Pure session config lookup helpers shared by contractScripts.
 */

import {
  USE_ONCHAIN_SESSION_REGISTRY,
} from '../../variables/appConfig.js';
import { getChainById } from '../../variables/chains.js';
import {
  canonicalizeSessionSlug,
  resolveSessionConfigFromSources,
} from '../session/canonicalSessionContext.js';
import { normalizeSessionNaming } from '../session/sessionMetadata.js';
import { resolveSessionConfigAliases } from '../session/sessionNaming.js';
import {
  getAllDemoSessionConfigs,
  getDefaultSessionConfig as getDemoDefaultSessionConfig,
  getDemoSessionConfigForDisplay,
} from '../session/sessionSourceResolver.js';
import { overlayCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';
import { sessionRegistryStore } from './sessionRegistry.js';

const defaultStrictAllowDemoFallback = () => (
  !USE_ONCHAIN_SESSION_REGISTRY
);

export function resolveSessionConfigEntry(sessionSlug = '', opts = {}) {
  const hasPreferRegistry = Object.prototype.hasOwnProperty.call(opts, 'preferRegistry');
  const hasAllowDemoFallback = Object.prototype.hasOwnProperty.call(opts, 'allowDemoFallback');
  const preferRegistry = hasPreferRegistry ? !!opts.preferRegistry : true;
  const allowDemoFallback = hasAllowDemoFallback ? !!opts.allowDemoFallback : defaultStrictAllowDemoFallback();
  const resolved = resolveSessionConfigFromSources({
    sessionSlug,
    getRegistrySessionConfig: (slug) => sessionRegistryStore.getSessionConfig(slug),
    preferRegistry,
    allowDemoFallback: false,
  });
  if (resolved.sessionConfig || !allowDemoFallback) return resolved;
  const demoConfig = getDemoSessionConfigForDisplay(resolved.sessionSlug);
  return {
    ...resolved,
    sessionConfig: demoConfig,
    sessionConfigSource: demoConfig ? 'demo' : 'missing',
    warnings: resolved.warnings || [],
  };
}

export function normalizeResolvedSessionConfig(resolved, opts = {}) {
  if (!resolved?.sessionConfig) return null;
  if (resolved.sessionConfigSource === 'registry' && opts.normalizeRegistry !== true) {
    return overlayCachedSessionWorkerConfig({
      slug: resolved.sessionSlug,
      sessionConfig: resolved.sessionConfig,
    });
  }
  return overlayCachedSessionWorkerConfig({
    slug: resolved.sessionSlug,
    sessionConfig: normalizeSessionNaming(resolved.sessionConfig),
  });
}

/**
 * Find a demo session by key or slug; accept object configs too.
 * @param {string|object|undefined} groupKeyOrCfg — session key, slug, or config object
 * @returns {object|null}
 */
// === UPDATED: resolveSession ― treat '' as canonical general slug; also accept 'general' ===
export function resolveSession(groupKeyOrCfg) {
  if (groupKeyOrCfg && typeof groupKeyOrCfg === 'object') {
    const aliasResolved = resolveSessionConfigAliases(groupKeyOrCfg);
    const aliasCfg = aliasResolved.sessionConfig || null;
    if (aliasCfg && typeof aliasCfg === 'object') {
      const merged = { ...(aliasCfg || {}), ...(groupKeyOrCfg || {}) };
      delete merged.sessionConfig;
      delete merged.sessionSlug;
      delete merged.activeSessionSlug;
      delete merged.group;
      if (!merged.slug && aliasResolved.sessionSlug) merged.slug = aliasResolved.sessionSlug;
      return normalizeSessionNaming(merged);
    }
    if (aliasResolved.hasExplicitSessionSlug) {
      groupKeyOrCfg = aliasResolved.sessionSlug;
    }
  }

  if (groupKeyOrCfg === '' || groupKeyOrCfg == null) return getDefaultSessionConfig();
  if (typeof groupKeyOrCfg === 'string') {
    const normalizedInput = normalizeSessionSlug(groupKeyOrCfg);
    const resolved = getSessionConfigBySlug(normalizedInput);
    if (resolved) return normalizeSessionNaming(resolved);
    // Preserve unresolved non-general slug without silently falling back to general.
    return {
      slug: normalizedInput,
      contracts: {},
      __unresolved: true,
    };
  }
  if (typeof groupKeyOrCfg === 'object') return normalizeSessionNaming(groupKeyOrCfg);
  // Fallback to "general" — gated behind strict demo-fallback policy (PRD 238 Stage-C).
  if (!defaultStrictAllowDemoFallback()) return null;
  return getDemoDefaultSessionConfig();
}

// Resolve a demo session by a human-readable name without falling back to "general".
export function resolveSessionByName(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const lowered = name.toLowerCase();
  for (const [key, g] of getAllSessionEntries()) {
    if (!g) continue;
    const normalized = normalizeSessionNaming(g);
    if (String(key || '').toLowerCase() === lowered) return normalized;
    if (String(normalized.slug || '').toLowerCase() === lowered) return normalized;
    if (String(normalized.sessionName || '').toLowerCase() === lowered) return normalized;
  }
  return null;
}

export function resolveDemoSessionBySlug(slugIn = '', opts = {}) {
  const hasAllowDemoFallback = Object.prototype.hasOwnProperty.call(opts, 'allowDemoFallback');
  // Compatibility/demo UI readers can opt in explicitly without weakening the strict default.
  return normalizeResolvedSessionConfig(
    resolveSessionConfigEntry(slugIn, {
      preferRegistry: false,
      allowDemoFallback: hasAllowDemoFallback ? !!opts.allowDemoFallback : defaultStrictAllowDemoFallback(),
    }),
    { normalizeRegistry: true }
  );
}

// --- Tiny helpers: session config & lists + chain label (additive) ---
export function normalizeSessionSlug(rawSlug) {
  return canonicalizeSessionSlug(rawSlug);
}

// Session-first aliases (legacy group naming remains supported).
// Legacy alias removed — function is now normalizeSessionSlug directly.

export function getDefaultSessionConfig() {
  return normalizeResolvedSessionConfig(
    resolveSessionConfigEntry(''),
    { normalizeRegistry: true }
  );
}

// Legacy alias removed — function is now getDefaultSessionConfig directly.

export function getSessionConfigBySlug(slugOrEmpty) {
  const resolved = resolveSessionConfigEntry(slugOrEmpty === undefined ? '' : slugOrEmpty);
  if (!resolved.sessionConfig) {
    // Preserve historical contract of this helper:
    // unknown non-general slugs resolve to null so callers can trigger not-found paths.
    return null;
  }
  return normalizeResolvedSessionConfig(resolved);
}

// Legacy alias removed — function is now getSessionConfigBySlug directly.

export function getDemoSessionConfigBySlug(slugOrEmpty, opts = {}) {
  return resolveDemoSessionBySlug(slugOrEmpty === undefined ? '' : slugOrEmpty, opts);
}

export function getSessionConfigBySlugOrDefault(slugOrEmpty) {
  const normalized = normalizeSessionSlug(slugOrEmpty === undefined ? '' : slugOrEmpty);
  if (normalized === '') return getDefaultSessionConfig();
  const cfg = getSessionConfigBySlug(slugOrEmpty);
  if (cfg && !cfg.__unresolved) return cfg;
  // Stage-B: only fall back to default for the general/empty session, not non-general slugs.
  return null;
}

// Legacy alias removed — function is now getSessionConfigBySlugOrDefault directly.

export function getAllSessionEntries() {
  const cached = sessionRegistryStore.getAllSessionEntries();
  if (cached && cached.length) {
    return cached.map(([key, cfg]) => [key, normalizeSessionNaming(cfg)]);
  }
  // In on-chain mode, do not silently fall back to demo sessions (PRD 238 Stage-C).
  if (!defaultStrictAllowDemoFallback()) return [];
  return getAllDemoSessionConfigs();
}

// Legacy alias removed — function is now getAllSessionEntries directly.

export function getAllSessionSlugs(opts = {}) {
  const includeEmpty = opts && Object.prototype.hasOwnProperty.call(opts, 'includeEmpty')
    ? !!opts.includeEmpty
    : true;
  const out = [];
  for (const [key, cfg] of getAllSessionEntries()) {
    let slug = (typeof cfg?.slug === 'string' ? cfg.slug : key) || '';
    if (slug === 'general') slug = '';
    if (!slug && !includeEmpty) continue;
    out.push(String(slug));
  }
  return Array.from(new Set(out));
}

export function getSessionConfigByName(name) {
  return resolveSessionByName(name);
}

export function getSessionSlugByName(name) {
  const cfg = resolveSessionByName(name);
  if (!cfg) return null;
  const slug = typeof cfg.slug === 'string' ? cfg.slug : '';
  return slug === 'general' ? '' : slug;
}

export function getSessionLists(slugOrEmpty) {
  const cfg = getSessionConfigBySlug(slugOrEmpty) || {};
  return {
    featured_SBTs_LIST: Array.isArray(cfg?.featured_SBTs_LIST) ? cfg.featured_SBTs_LIST : [],
    ignored_SBTs_LIST: Array.isArray(cfg?.ignored_SBTs_LIST) ? cfg.ignored_SBTs_LIST : [],
    HIGHLIGHTED_QUESTION_IDS: Array.isArray(cfg?.HIGHLIGHTED_QUESTION_IDS) ? cfg.HIGHLIGHTED_QUESTION_IDS : [],
    BLOCKED_QUESTION_IDS: Array.isArray(cfg?.BLOCKED_QUESTION_IDS) ? cfg.BLOCKED_QUESTION_IDS : [],
    HIGHLIGHTED_SURVEY_IDS: Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) ? cfg.HIGHLIGHTED_SURVEY_IDS : [],
    BLOCKED_SURVEY_IDS: Array.isArray(cfg?.BLOCKED_SURVEY_IDS) ? cfg.BLOCKED_SURVEY_IDS : [],
  };
}

export function getSessionChainId(sessionKeyOrCfg = null) {
  const cfg = getSessionConfigBySlugOrDefault(sessionKeyOrCfg === undefined ? '' : sessionKeyOrCfg);
  const id = Number(
    cfg?.networkChainId ||
    cfg?.contracts?.surveys?.chainId ||
    cfg?.contracts?.sbtFactory?.chainId ||
    0
  );
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function getSessionNetwork(sessionKeyOrCfg = null) {
  const id = getSessionChainId(sessionKeyOrCfg);
  const ch = getChainById(id);
  if (ch) return ch;
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

export function getChainLabelById(chainId) {
  const n = Number(chainId);
  const idForLabel = Number.isFinite(n) ? n : (typeof chainId === 'string' ? chainId.trim() : String(chainId));
  const ch = Number.isFinite(n) ? getChainById(n) : null;
  const name = ch?.name || `chain-${idForLabel}`;
  return `${name} (${idForLabel})`;
}
