import { createLogger } from 'utilities/logging.js';
import {
  getAllowedSessionSlugs,
  isSessionSlugAllowedByScope,
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { readSbtInstanceListenersMode } from '../../utilities/sbt/sbtInstanceListenersMode.js';
import { readSbtFullScanPolicy } from '../../utilities/sbt/sbtFullScanPolicy.js';
import { getAllSessionSlugs, normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';

const log = createLogger('sessionScanPolicy');

export const createSessionScanPolicy = (host) => {
  let didLogSessionScanScope = false;
  let didLogSbtInstanceListenersSuppressed = false;
  const scopeSkipLogOnce = new Set();

  const normalizeListenerGroupSlug = (slugIn) => {
    const slug = (slugIn ?? '').toString().trim().toLowerCase();
    if (!slug || slug === 'general') return '';
    return slug;
  };

  const getSessionScanScope = () => {
    const scope = readSessionScanScope();
    if (scope !== 'all' && !didLogSessionScanScope) {
      didLogSessionScanScope = true;
      try {
        console.info(`[Context Engine] CE_SESSION_SCAN_SCOPE=${scope} (cross-session RPC scans clamped)`);
      } catch (e) { log.warn('MainSite: telemetry', e); }
    }
    return scope;
  };

  const getSessionScanScopeContext = (scopeIn) => {
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
    const activeSlug = normalizeSessionSlug(
      querySlug !== null ? querySlug : (host.getActiveSessionSlug() || '')
    );
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

  const isSessionSlugAllowedForScan = (slugIn, scopeContextIn = null) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const scopeContext = scopeContextIn || getSessionScanScopeContext();
    return isSessionSlugAllowedByScope(slug, scopeContext);
  };

  const logScopeSkipOnce = (operation, slugIn, scopeContextIn = null) => {
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
      activeSlug: (scopeContext.activeSlug || 'general'),
    });
  };

  const areSbtInstanceListenersSuppressedByMode = () => {
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
              `Set CE_SBT_INSTANCE_LISTENERS_MODE=on to override.`
            );
          } catch (e) { log.warn('MainSite: telemetry', e); }
        }
        return true;
      }
    }
    return false;
  };

  const isSbtInstanceListenerEnabledForGroup = (slugIn) => {
    if (typeof window === 'undefined') return false;
    if (areSbtInstanceListenersSuppressedByMode()) return false;
    if (window.DISABLE_SBT_INSTANCE_LISTENERS === true) return false;
    const raw =
      typeof window.SBT_INSTANCE_LISTENER_GROUPS !== 'undefined'
        ? window.SBT_INSTANCE_LISTENER_GROUPS
        : ['general'];
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.length) return false;
    const normalized = new Set(list.map((s) => normalizeListenerGroupSlug(s)));
    if (normalized.has('*') || normalized.has('all')) return true;
    const slug = normalizeListenerGroupSlug(slugIn);
    return normalized.has(slug);
  };

  const isSbtHistoryScanEnabled = () => {
    if (typeof window === 'undefined') return false;
    return window.ENABLE_SBT_HISTORY_SCAN === true;
  };

  const shouldAutoRunFullSbtScan = ({ pathname } = {}) => {
    const policy = readSbtFullScanPolicy();
    if (policy === 'manual') return false;
    if (policy === 'sbts') {
      const raw =
        String(pathname || '') ||
        host.getCurrentPath();
      const p = String(raw).split(/[?#]/)[0] || '';
      if (p.startsWith('/sbt/') || p.startsWith('/group/')) return true;
      return host.isSbtListRoutePath(p);
    }
    return true;
  };

  const shouldAttachSbtDetailInstanceListener = () => {
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

  const getScopedSessionSlugs = (scopeIn) => {
    const scope = typeof scopeIn === 'string' ? scopeIn : getSessionScanScope();
    if (scope === 'all') return getAllSessionSlugs();
    const scopeContext = getSessionScanScopeContext(scope);
    const scoped = getAllowedSessionSlugs(scopeContext.scope, scopeContext.list, scopeContext.activeSlug);
    if (!scoped.length && scopeContext.scope === 'list') {
      logScopeSkipOnce('getScopedSessionSlugs:list-empty', '', scopeContext);
    }
    return scoped;
  };

  const shouldSkipSessionScanForSlug = (slugIn, operation, scopeContextIn = null) => {
    const scopeContext = scopeContextIn || getSessionScanScopeContext();
    if (scopeContext.scope === 'all') return false;
    const allowed = isSessionSlugAllowedForScan(slugIn, scopeContext);
    if (!allowed) logScopeSkipOnce(operation, slugIn, scopeContext);
    return !allowed;
  };

  const scanScopeNoop = (slugIn, operation, onSkipped) => {
    const scopeContext = getSessionScanScopeContext();
    if (!shouldSkipSessionScanForSlug(slugIn, operation, scopeContext)) return false;
    try {
      if (typeof onSkipped === 'function') onSkipped();
    } catch (e) { log.warn('MainSite: fallback', e); }
    return true;
  };

  const getScopeFilteredSlugs = (slugs = [], scopeIn = null) => {
    const scopeContext = getSessionScanScopeContext(scopeIn || undefined);
    if (scopeContext.scope === 'all') {
      return Array.from(new Set((Array.isArray(slugs) ? slugs : []).map((s) => normalizeSessionSlug(s ?? ''))));
    }
    const seen = new Set();
    const out = [];
    (Array.isArray(slugs) ? slugs : []).forEach((slug) => {
      const normalized = normalizeSessionSlug(slug ?? '');
      if (seen.has(normalized)) return;
      seen.add(normalized);
      if (isSessionSlugAllowedForScan(normalized, scopeContext)) out.push(normalized);
      else logScopeSkipOnce('getScopeFilteredSlugs', normalized, scopeContext);
    });
    return out;
  };

  const destroy = () => {
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
