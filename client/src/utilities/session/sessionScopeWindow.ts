/**
 * @module sessionScopeWindow
 * @description Session scope window helpers extracted from contractScripts.
 *              Centralizes active-session detection and out-of-scope skip logging.
 *
 * Key exports: readActiveSessionSlugForScope, getScopeDecisionForSlug, logScopeWindowSkipOnce, shouldBypassSessionScopeWindow
 */

import store from '../../store';
import { createLogger } from '../logging.js';
import { stripPublicUrlBasePath } from '../ui/publicUrl.js';
import { normalizeSessionSlug } from '../web3/sessionConfigResolvers.js';
import { isSessionSlugAllowedByScope, readSessionScanScope, readSessionScanSlugs } from './sessionScanScope.js';

type ScopeWindowDecision = {
  slug: string;
  scope: string;
  list: string[];
  activeSlug: string;
  activeSlugFromRoute: boolean;
  allowed: boolean;
};

type ScopeWindowBypassConfig = {
  __ignoreSessionScanScope?: boolean;
};

const contractsLog = createLogger('contracts');

export const SESSION_SCOPE_WINDOW_SKIP_LOGGED = new Set<string>();

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const readActiveSessionSlugForScope = () => {
  let fromStore = '';
  try {
    const state = (store as { getState?: () => unknown })?.getState?.() || {};
    const sessionState = isRecord(state) && isRecord(state.sessionState) ? state.sessionState : {};
    const raw = sessionState.activeSessionSlug || '';
    fromStore = normalizeSessionSlug(raw || '');
  } catch (_) {
    fromStore = '';
  }
  try {
    if (typeof window !== 'undefined') {
      const path = stripPublicUrlBasePath(String(window.location?.pathname || '').trim());
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === 'session' && parts[1] && String(parts[1]).toLowerCase() !== 'new') {
        const fromPath = normalizeSessionSlug(parts[1]);
        if (fromPath) return { activeSlug: fromPath, activeSlugFromRoute: true };
      }
      const params = new URLSearchParams(String(window.location?.search || ''));
      const rawHint = params.get('session') ?? params.get('sessionSlug') ?? params.get('s');
      if (rawHint != null) {
        return {
          activeSlug: normalizeSessionSlug(rawHint),
          activeSlugFromRoute: true,
        };
      }
    }
  } catch (_) {}
  return { activeSlug: fromStore, activeSlugFromRoute: false };
};

export const getScopeDecisionForSlug = (slugIn: unknown): ScopeWindowDecision => {
  const slug = normalizeSessionSlug(slugIn || '');
  const scope = String(readSessionScanScope() || '');
  const scopeActive = readActiveSessionSlugForScope();
  const activeSlug = scopeActive?.activeSlug || '';
  const activeSlugFromRoute = scopeActive?.activeSlugFromRoute === true;
  if (scope === 'all') {
    return { slug, scope, list: [], activeSlug, activeSlugFromRoute, allowed: true };
  }
  const list = (Array.isArray(readSessionScanSlugs()) ? readSessionScanSlugs() : []) as string[];
  const allowed = isSessionSlugAllowedByScope(slug, {
    scope,
    list,
    activeSlug,
    activeSlugFromRoute,
  });
  return { slug, scope, list, activeSlug, activeSlugFromRoute, allowed };
};

export const logScopeWindowSkipOnce = ({
  slug,
  scope,
  list,
  activeSlug,
}: {
  slug?: unknown;
  scope?: unknown;
  list?: unknown;
  activeSlug?: unknown;
}): void => {
  const slugLabel = String(slug || 'general');
  if (SESSION_SCOPE_WINDOW_SKIP_LOGGED.has(slugLabel)) return;
  SESSION_SCOPE_WINDOW_SKIP_LOGGED.add(slugLabel);
  contractsLog.info('[SessionScanScope] getRelevantBlockWindowForFilter skipped out-of-scope slug', {
    slug: slugLabel,
    scope,
    activeSlug: String(activeSlug || 'general'),
    list: (Array.isArray(list) ? list : []).map((s) => normalizeSessionSlug(s || '') || 'general'),
  });
};

export const shouldBypassSessionScopeWindow = (groupKeyOrCfg: unknown, resolvedCfg: unknown = null): boolean => {
  const groupConfig =
    groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && !Array.isArray(groupKeyOrCfg)
      ? (groupKeyOrCfg as ScopeWindowBypassConfig)
      : null;
  const resolvedConfig =
    resolvedCfg && typeof resolvedCfg === 'object' && !Array.isArray(resolvedCfg)
      ? (resolvedCfg as ScopeWindowBypassConfig)
      : null;
  const fromArg = groupConfig && groupConfig.__ignoreSessionScanScope === true;
  const fromResolved = resolvedConfig && resolvedConfig.__ignoreSessionScanScope === true;
  return !!(fromArg || fromResolved);
};
