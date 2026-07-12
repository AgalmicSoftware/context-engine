/**
 * @module mainSiteSessionScanPolicy
 * @description MainSite session scan policy helpers for SBT listener/scanner scope gating.
 */
import { createLogger } from 'utilities/logging.js';
import {
  getAllowedSessionSlugs,
  isSessionSlugAllowedByScope,
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { readSbtInstanceListenersMode } from '../../utilities/sbt/sbtInstanceListenersMode.js';
import { readSbtFullScanPolicy } from '../../utilities/sbt/sbtFullScanPolicy.js';
import { getAllSessionSlugs, normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';

declare global {
  interface Window {
    DISABLE_SBT_INSTANCE_LISTENERS?: boolean;
    SBT_INSTANCE_LISTENER_GROUPS?: string | string[];
    ENABLE_SBT_HISTORY_SCAN?: boolean;
    MAX_SBT_INSTANCE_LISTENERS?: number | string;
  }
}

export interface SessionScanPolicyHost {
  getActiveSessionSlug: () => string;
  getCurrentPath: () => string;
  getSessionSlugHintFromSearch: (search: string) => string | null;
  getSessionTokenFromPath: (path: string) => string | null;
  isSbtListRoutePath: (path: string) => boolean;
  isWorkerCanonicalSessionSlug: (slug: string) => boolean;
}

export interface SessionScanScopeContext {
  scope: string;
  list: string[];
  activeSlug: string;
  activeSlugFromRoute: boolean;
}

export interface SessionScanPolicy {
  isSbtInstanceListenerEnabledForGroup: (slugIn: string) => boolean;
  isSbtHistoryScanEnabled: () => boolean;
  getSessionScanScope: () => string;
  getSessionScanScopeContext: (scopeIn?: string) => SessionScanScopeContext;
  shouldAutoRunFullSbtScan: (opts?: { pathname?: string }) => boolean;
  shouldAttachSbtDetailInstanceListener: () => boolean;
  getScopedSessionSlugs: (scopeIn?: string) => string[];
  shouldSkipSessionScanForSlug: (
    slugIn: string,
    operation: string,
    scopeContextIn?: SessionScanScopeContext | null,
  ) => boolean;
  scanScopeNoop: (slugIn: string, operation: string, onSkipped?: () => void) => boolean;
  getScopeFilteredSlugs: (slugs?: string[], scopeIn?: string | null) => string[];
  isSessionSlugAllowedForScan: (slugIn: string, scopeContextIn?: SessionScanScopeContext | null) => boolean;
  logScopeSkipOnce: (operation: string, slugIn: string, scopeContextIn?: SessionScanScopeContext | null) => void;
  destroy: () => void;
}

const log = createLogger('sessionScanPolicy');

export const createSessionScanPolicy = (host: SessionScanPolicyHost): SessionScanPolicy => {
  let didLogSessionScanScope = false;
  let didLogSbtInstanceListenersSuppressed = false;
  const scopeSkipLogOnce = new Set<string>();

  const normalizeListenerGroupSlug = (slugIn: unknown): string => {
    const slug = String(slugIn ?? '')
      .trim()
      .toLowerCase();
    if (!slug || slug === 'general') return '';
    return slug;
  };

  const getSessionScanScope = (): string => {
    const scope = readSessionScanScope();
    if (scope !== 'all' && !didLogSessionScanScope) {
      didLogSessionScanScope = true;
      try {
        console.info(`[Context Engine] CE_SESSION_SCAN_SCOPE=${scope} (cross-session RPC scans clamped)`);
      } catch (e) {
        log.warn('MainSite: telemetry', e);
      }
    }
    return scope;
  };

  const getSessionScanScopeContext = (scopeIn?: string): SessionScanScopeContext => {
    const scope = typeof scopeIn === 'string' ? scopeIn : getSessionScanScope();
    const list = readSessionScanSlugs();
    const querySlug = (() => {
      try {
        if (typeof window === 'undefined') return null;
        return host.getSessionSlugHintFromSearch(window.location?.search || '');
      } catch (_) {
        return null;
      }
    })();
    const activeSlug = normalizeSessionSlug(querySlug !== null ? querySlug : host.getActiveSessionSlug() || '');
    const activeSlugFromRoute = (() => {
      if (querySlug !== null) return true;
      if (!activeSlug) return false;
      try {
        const path = host.getCurrentPath();
        const token = host.getSessionTokenFromPath(path);
        if (!token) return false;
        return String(token).toLowerCase() !== 'new';
      } catch (_) {
        return false;
      }
    })();
    return { scope, list, activeSlug, activeSlugFromRoute };
  };

  const isSessionSlugAllowedForScan = (
    slugIn: string,
    scopeContextIn: SessionScanScopeContext | null = null,
  ): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (host.isWorkerCanonicalSessionSlug(slug)) return false;
    const scopeContext = scopeContextIn || getSessionScanScopeContext();
    return isSessionSlugAllowedByScope(slug, scopeContext);
  };

  const logScopeSkipOnce = (
    operation: string,
    slugIn: string,
    scopeContextIn: SessionScanScopeContext | null = null,
  ): void => {
    const slug = normalizeSessionSlug(slugIn || '');
    const slugLabel = slug || 'general';
    const key = `${operation}:${slugLabel}`;
    if (scopeSkipLogOnce.has(key)) return;
    scopeSkipLogOnce.add(key);
    const scopeContext = scopeContextIn || getSessionScanScopeContext();
    const allowed = getAllowedSessionSlugs(scopeContext.scope, scopeContext.list, scopeContext.activeSlug);
    log.info('[SessionScanScope] skipped out-of-scope scan/listener', {
      operation,
      slug: slugLabel,
      scope: scopeContext.scope,
      allowedSlugs: allowed.map((s) => s || 'general'),
      activeSlug: scopeContext.activeSlug || 'general',
    });
  };

  const areSbtInstanceListenersSuppressedByMode = (): boolean => {
    const mode = readSbtInstanceListenersMode();
    if (mode === 'off') return true;
    if (mode === 'auto') {
      const scope = getSessionScanScope();
      if (scope !== 'all') {
        if (!didLogSbtInstanceListenersSuppressed) {
          didLogSbtInstanceListenersSuppressed = true;
          try {
            console.info(
              `[Context Engine] SBT instance listeners suppressed (auto) because CE_SESSION_SCAN_SCOPE=${scope}. ` +
                'Set CE_SBT_INSTANCE_LISTENERS_MODE=on to override.',
            );
          } catch (e) {
            log.warn('MainSite: telemetry', e);
          }
        }
        return true;
      }
    }
    return false;
  };

  const isSbtInstanceListenerEnabledForGroup = (slugIn: string): boolean => {
    if (typeof window === 'undefined') return false;
    if (host.isWorkerCanonicalSessionSlug(normalizeSessionSlug(slugIn))) return false;
    if (areSbtInstanceListenersSuppressedByMode()) return false;
    if (window.DISABLE_SBT_INSTANCE_LISTENERS === true) return false;
    const raw =
      typeof window.SBT_INSTANCE_LISTENER_GROUPS !== 'undefined' ? window.SBT_INSTANCE_LISTENER_GROUPS : ['general'];
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.length) return false;
    const normalized = new Set(list.map((s) => normalizeListenerGroupSlug(s)));
    if (normalized.has('*') || normalized.has('all')) return true;
    const slug = normalizeListenerGroupSlug(slugIn);
    return normalized.has(slug);
  };

  const isSbtHistoryScanEnabled = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.ENABLE_SBT_HISTORY_SCAN === true;
  };

  const shouldAutoRunFullSbtScan = ({ pathname }: { pathname?: string } = {}): boolean => {
    const policy = readSbtFullScanPolicy();
    if (policy === 'manual') return false;
    if (policy === 'sbts') {
      const raw = String(pathname || '') || host.getCurrentPath();
      const p = String(raw).split(/[?#]/)[0] || '';
      if (p.startsWith('/sbt/') || p.startsWith('/group/')) return true;
      return host.isSbtListRoutePath(p);
    }
    return true;
  };

  const shouldAttachSbtDetailInstanceListener = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (areSbtInstanceListenersSuppressedByMode()) return false;
    if (window.DISABLE_SBT_INSTANCE_LISTENERS === true) return false;
    const hasMaxOverride = typeof window.MAX_SBT_INSTANCE_LISTENERS !== 'undefined';
    if (hasMaxOverride) {
      const n = Number(window.MAX_SBT_INSTANCE_LISTENERS);
      if (Number.isFinite(n) && n <= 0) return false;
    }
    return true;
  };

  const getScopedSessionSlugs = (scopeIn?: string): string[] => {
    const scope = typeof scopeIn === 'string' ? scopeIn : getSessionScanScope();
    if (scope === 'all') return getAllSessionSlugs();
    const scopeContext = getSessionScanScopeContext(scope);
    const scoped = getAllowedSessionSlugs(scopeContext.scope, scopeContext.list, scopeContext.activeSlug);
    if (!scoped.length && scopeContext.scope === 'list') {
      logScopeSkipOnce('getScopedSessionSlugs:list-empty', '', scopeContext);
    }
    return scoped;
  };

  const shouldSkipSessionScanForSlug = (
    slugIn: string,
    operation: string,
    scopeContextIn: SessionScanScopeContext | null = null,
  ): boolean => {
    if (host.isWorkerCanonicalSessionSlug(normalizeSessionSlug(slugIn || ''))) {
      logScopeSkipOnce(operation, slugIn, scopeContextIn);
      return true;
    }
    const scopeContext = scopeContextIn || getSessionScanScopeContext();
    if (scopeContext.scope === 'all') return false;
    const allowed = isSessionSlugAllowedForScan(slugIn, scopeContext);
    if (!allowed) logScopeSkipOnce(operation, slugIn, scopeContext);
    return !allowed;
  };

  const scanScopeNoop = (slugIn: string, operation: string, onSkipped?: () => void): boolean => {
    const scopeContext = getSessionScanScopeContext();
    if (!shouldSkipSessionScanForSlug(slugIn, operation, scopeContext)) return false;
    try {
      if (typeof onSkipped === 'function') onSkipped();
    } catch (e) {
      log.warn('MainSite: fallback', e);
    }
    return true;
  };

  const getScopeFilteredSlugs = (slugs: string[] = [], scopeIn: string | null = null): string[] => {
    const scopeContext = getSessionScanScopeContext(scopeIn || undefined);
    const input = Array.isArray(slugs) ? slugs : [];
    if (scopeContext.scope === 'all') {
      return Array.from(new Set(input.map((s) => normalizeSessionSlug(s ?? ''))));
    }
    const seen = new Set<string>();
    const out: string[] = [];
    input.forEach((slug) => {
      const normalized = normalizeSessionSlug(slug ?? '');
      if (seen.has(normalized)) return;
      seen.add(normalized);
      if (isSessionSlugAllowedForScan(normalized, scopeContext)) out.push(normalized);
      else logScopeSkipOnce('getScopeFilteredSlugs', normalized, scopeContext);
    });
    return out;
  };

  const destroy = (): void => {
    scopeSkipLogOnce.clear();
  };

  return {
    isSbtInstanceListenerEnabledForGroup,
    isSbtHistoryScanEnabled,
    getSessionScanScope,
    getSessionScanScopeContext,
    shouldAutoRunFullSbtScan,
    shouldAttachSbtDetailInstanceListener,
    getScopedSessionSlugs,
    shouldSkipSessionScanForSlug,
    scanScopeNoop,
    getScopeFilteredSlugs,
    isSessionSlugAllowedForScan,
    logScopeSkipOnce,
    destroy,
  };
};
