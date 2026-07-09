/**
 * @module sessionScanScope
 * @description Session scan window configuration — controls which session slugs are in scope for
 *              SBT scanning, block range resolution, and deep profile discovery.
 *
 * Key exports: readSessionScanScope, readSessionScanSlugs, writeSessionScanScope, isSessionSlugAllowedByScope, getAllowedSessionSlugs
 */
import { CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES } from '../../variables/appConfig.js';
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';
import { canonicalizeSessionSlug, resolveSessionSlugAliasFromDemoSessions } from './canonicalSessionContext.js';
import {
  dispatchGlobalSessionSelectionUpdatedEvent,
  normalizeGlobalSessionSelection,
  persistGlobalSessionSelection,
  readStoredGlobalSessionSelection,
} from './globalSessionState.js';
import { getDemoSessionMap } from './sessionDemoCompat.js';

type DemoSessionMap = Record<string, Record<string, unknown>>;
type SessionScanScope = 'active' | 'all' | 'general' | 'list';
type SessionScanSlugOptions = {
  allowEmpty?: boolean;
};
type SessionScanScopeOptions = {
  scope?: unknown;
  list?: unknown;
  activeSlug?: unknown;
  activeSlugFromRoute?: boolean;
};
type SessionBlockLimits = {
  start?: unknown;
  end?: unknown;
};
type ResolvedSessionWindow = {
  fromBlock?: unknown;
  toBlock?: unknown;
};
type ValidateSessionScanWindowOptions = {
  slug?: unknown;
  blockLimits?: SessionBlockLimits | null;
  resolvedWindow?: ResolvedSessionWindow | null;
  maxBlockRange?: unknown;
};
type ValidatedSessionScanWindowFailure = {
  ok: false;
  code: 'invalid_block_limits' | 'invalid_block_window';
  message: string;
};
type ValidatedSessionScanWindowSuccess = {
  ok: true;
  slug: string;
  fromBlock: number;
  toBlock: number;
  requestedToBlock: number;
  rangeBlocks: number;
  requestedRangeBlocks: number;
  wasCapped: boolean;
  maxBlockRange: number;
};
type ValidatedSessionScanWindowResult = ValidatedSessionScanWindowFailure | ValidatedSessionScanWindowSuccess;
type GlobalSessionSelection = Record<string, unknown> & {
  selectedSessionScope?: unknown;
  selectedSessionSlugs?: unknown;
};

const log = createLogger('sessionScanScope');
const DEMO_SESSION_MAP = getDemoSessionMap() as DemoSessionMap;

const URL_PARAM_KEY = 'ceSessionScanScope';
const URL_PARAM_SLUGS_KEY = 'ceSessionScanSlugs';
const LOCAL_STORAGE_KEY = 'ce:sessionScanScope';
const LOCAL_STORAGE_SLUGS_KEY = 'ce:sessionScanSlugs';
const GLOBAL_KEY = 'CE_SESSION_SCAN_SCOPE';
const GLOBAL_SLUGS_KEY = 'CE_SESSION_SCAN_SLUGS';
const GLOBAL_DEMO_ALIAS_KEY = 'CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES';
export const DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE = 10000;
const VALID_SESSION_SCAN_SCOPES = new Set<SessionScanScope>(['all', 'active', 'general', 'list']);
const FAIL_CLOSED_SESSION_SCAN_SCOPE: SessionScanScope = 'active';
const normalizeSessionScanSlugToken = (raw: unknown): string => canonicalizeSessionSlug(raw);

const normalizeMaxBlockRange = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.floor(n));
};

export const readSessionScanMaxBlockRange = (fallback: unknown = DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE): number => {
  const fallbackValue = normalizeMaxBlockRange(fallback) || DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE;
  try {
    if (typeof process !== 'undefined' && process?.env) {
      const envValue = normalizeMaxBlockRange(process.env.REACT_APP_SESSION_SCAN_MAX_BLOCK_RANGE);
      if (envValue != null) return envValue;
    }
  } catch (e) {
    void e; /* fallback: env override lookup. */
  }
  return fallbackValue;
};

const readResolveDemoAliasToggle = (): boolean => {
  try {
    if (typeof globalThis !== 'undefined') {
      const runtimeGlobals = globalThis as Record<string, unknown>;
      if (typeof runtimeGlobals[GLOBAL_DEMO_ALIAS_KEY] !== 'undefined') {
        return runtimeGlobals[GLOBAL_DEMO_ALIAS_KEY] === true;
      }
    }
  } catch (e) {
    void e; /* fallback: demo alias toggle lookup. */
  }
  return CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES === true;
};

const extractSlugFromWorkerHost = (raw: unknown = ''): string => {
  const readHostSlug = (hostRaw: unknown = ''): string => {
    const host = toStr(hostRaw).trim().toLowerCase();
    if (!host || !host.endsWith('.workers.dev')) return '';
    const subdomain = host.split('.')[0] || '';
    if (!subdomain) return '';
    const match = subdomain.match(/^(.+)-worker-[a-z0-9-]+$/);
    if (!match || !match[1]) return '';
    return match[1];
  };

  const value = toStr(raw).trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const fromUrl = readHostSlug(parsed.hostname);
    if (fromUrl) return fromUrl;
  } catch (e) {
    void e; /* fallback: worker host parsing. */
  }

  const hostCandidate = value.split(/[/?#]/)[0] || '';
  return readHostSlug(hostCandidate);
};

export const normalizeSessionScanScope = (raw: unknown): SessionScanScope => {
  const val = toStr(raw).trim().toLowerCase();
  if (VALID_SESSION_SCAN_SCOPES.has(val as SessionScanScope)) return val as SessionScanScope;
  log.warn('[sessionScanScope] Invalid ceSessionScanScope value; using fail-closed fallback', {
    raw,
    fallback: FAIL_CLOSED_SESSION_SCAN_SCOPE,
  });
  // Fail closed: invalid scope defaults to narrow scope, not all.
  return FAIL_CLOSED_SESSION_SCAN_SCOPE;
};

export const normalizeSessionScanSlug = (
  raw: unknown,
  { allowEmpty = true }: SessionScanSlugOptions = {},
): string | null => {
  if (raw == null) return allowEmpty ? '' : null;
  const value = toStr(raw);
  const trimmed = value.trim();
  if (!trimmed) {
    if (!allowEmpty) return null;
    return value === '' ? '' : null;
  }
  const workerSlug = extractSlugFromWorkerHost(trimmed);
  return normalizeSessionScanSlugToken(workerSlug || trimmed);
};

const normalizeFiniteBlockNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
};

const buildSessionLabel = (slugIn: unknown): string => {
  const normalized = normalizeSessionScanSlug(slugIn, { allowEmpty: true });
  if (normalized == null || normalized === '') return 'general';
  return normalized;
};

export const resolveValidatedSessionScanWindow = ({
  slug = '',
  blockLimits = null,
  resolvedWindow = null,
  maxBlockRange = readSessionScanMaxBlockRange(DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE),
}: ValidateSessionScanWindowOptions = {}): ValidatedSessionScanWindowResult => {
  const slugLabel = buildSessionLabel(slug);
  const resolvedFromRaw = normalizeFiniteBlockNumber(resolvedWindow?.fromBlock);
  const resolvedToRaw = normalizeFiniteBlockNumber(resolvedWindow?.toBlock);
  const startFromLimits = normalizeFiniteBlockNumber(blockLimits?.start);
  const end = normalizeFiniteBlockNumber(blockLimits?.end);
  const start = startFromLimits == null ? resolvedFromRaw : startFromLimits;
  if (start == null) {
    return {
      ok: false,
      code: 'invalid_block_limits',
      message: `Missing or invalid blockLimits.start/resolvedWindow.fromBlock for session "${slugLabel}".`,
    };
  }
  if (end != null && end < start) {
    return {
      ok: false,
      code: 'invalid_block_limits',
      message: `Invalid blockLimits for session "${slugLabel}" (end < start).`,
    };
  }

  const fromBlock = resolvedFromRaw == null ? start : Math.max(start, resolvedFromRaw);
  const requestedToBlock = end == null ? resolvedToRaw : resolvedToRaw == null ? end : Math.min(end, resolvedToRaw);
  if (requestedToBlock == null) {
    return {
      ok: false,
      code: 'invalid_block_window',
      message: `Invalid scan window for session "${slugLabel}" (missing toBlock).`,
    };
  }
  if (requestedToBlock < fromBlock) {
    return {
      ok: false,
      code: 'invalid_block_window',
      message: `Invalid scan window for session "${slugLabel}" (toBlock < fromBlock).`,
    };
  }

  const normalizedMaxRange = Math.max(
    1,
    Math.floor(
      Number(
        normalizeMaxBlockRange(maxBlockRange) || readSessionScanMaxBlockRange(DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE),
      ),
    ),
  );
  let toBlock = requestedToBlock;
  let wasCapped = false;
  const requestedRangeBlocks = Math.max(0, requestedToBlock - fromBlock + 1);
  if (requestedRangeBlocks > normalizedMaxRange) {
    toBlock = fromBlock + normalizedMaxRange - 1;
    wasCapped = true;
  }

  return {
    ok: true,
    slug: slugLabel,
    fromBlock,
    toBlock,
    requestedToBlock,
    rangeBlocks: Math.max(0, toBlock - fromBlock + 1),
    requestedRangeBlocks,
    wasCapped,
    maxBlockRange: normalizedMaxRange,
  };
};

const normalizeSessionScanListSlug = (
  raw: unknown,
  { allowEmpty = true }: SessionScanSlugOptions = {},
): string | null => {
  const slug = normalizeSessionScanSlug(raw, { allowEmpty });
  if (slug == null) return null;
  if (!readResolveDemoAliasToggle()) return slug;
  return resolveSessionSlugAliasFromDemoSessions({
    sessionSlug: slug,
    demoSessions: DEMO_SESSION_MAP,
    allowSessionName: true,
  }).sessionSlug;
};

export const normalizeSessionScanSlugs = (raw: unknown): string[] => {
  const isArray = Array.isArray(raw);
  const list: unknown[] = Array.isArray(raw)
    ? raw.flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    : toStr(raw).split(',');
  const seen = new Set<string>();
  const out: string[] = [];
  list.forEach((item) => {
    const slug = normalizeSessionScanListSlug(item, { allowEmpty: isArray });
    if (slug == null) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

const parseStoredSlugs = (raw: unknown): string[] => {
  const str = toStr(raw).trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str);
      return normalizeSessionScanSlugs(arr);
    } catch (e) {
      void e; /* fallback: stored slug parsing. */
    }
  }
  return normalizeSessionScanSlugs(str);
};

const dedupeSlugs = (slugs: ReadonlyArray<unknown> = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  slugs.forEach((item) => {
    // Keep explicit general/default entries ("general" => "") when list mode is used.
    const slug = normalizeSessionScanListSlug(item, { allowEmpty: true });
    if (slug == null) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

export const getAllowedSessionSlugs = (scopeIn: unknown, listIn: unknown, activeSlugIn: unknown): string[] => {
  const scope = normalizeSessionScanScope(typeof scopeIn === 'undefined' ? readSessionScanScope() : scopeIn);
  const list = normalizeSessionScanSlugs(typeof listIn === 'undefined' ? readSessionScanSlugs() : listIn);
  const activeSlug = normalizeSessionScanSlug(activeSlugIn, { allowEmpty: true });

  if (scope === 'general') return [''];
  if (scope === 'active') return [activeSlug == null ? '' : activeSlug];
  if (scope === 'list') return dedupeSlugs(list);
  return [];
};

export const isSessionSlugAllowedByScope = (slugIn: unknown, opts: SessionScanScopeOptions = {}): boolean => {
  const hasActiveSlug = !!(opts && Object.prototype.hasOwnProperty.call(opts, 'activeSlug'));
  const hasActiveSlugFromRoute = !!(opts && Object.prototype.hasOwnProperty.call(opts, 'activeSlugFromRoute'));
  const activeSlugRaw = hasActiveSlug ? opts.activeSlug : undefined;
  const activeSlugFromRoute = hasActiveSlugFromRoute ? opts.activeSlugFromRoute === true : false;
  const normalizedScope = normalizeSessionScanScope(
    typeof opts.scope === 'undefined' ? readSessionScanScope() : opts.scope,
  );
  if (normalizedScope === 'all') return true;
  const slug = normalizeSessionScanSlug(slugIn, { allowEmpty: true });
  if (slug == null) return false;

  // In restricted modes, explicitly loaded session pages should still be allowed.
  // For "general", only allow this override when the active slug came from an
  // explicit /session/<slug> route (not stale store state).
  if ((normalizedScope === 'list' || (normalizedScope === 'general' && activeSlugFromRoute)) && hasActiveSlug) {
    const activeSlug = normalizeSessionScanSlug(activeSlugRaw, { allowEmpty: true });
    if (activeSlug != null && activeSlug !== '' && slug === activeSlug) return true;
  }

  const allowed = getAllowedSessionSlugs(normalizedScope, opts.list, activeSlugRaw);
  return allowed.includes(slug);
};

export const readSessionScanScope = (): SessionScanScope => {
  // Precedence:
  // 1) URL param `?ceSessionScanScope=active|general|list|all`
  // 2) localStorage `ce:sessionScanScope`
  // 3) globalThis.CE_SESSION_SCAN_SCOPE
  // 4) default "active"

  try {
    if (typeof window !== 'undefined') {
      const search = window.location?.search || '';
      const params = new URLSearchParams(search);
      if (params.has(URL_PARAM_KEY)) {
        return normalizeSessionScanScope(params.get(URL_PARAM_KEY));
      }
    }
  } catch (e) {
    void e; /* fallback: scope lookup. */
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored != null) return normalizeSessionScanScope(stored);
    }
  } catch (e) {
    void e; /* fallback: scope lookup. */
  }

  try {
    if (typeof globalThis !== 'undefined') {
      const runtimeGlobals = globalThis as Record<string, unknown>;
      if (typeof runtimeGlobals[GLOBAL_KEY] !== 'undefined') {
        return normalizeSessionScanScope(runtimeGlobals[GLOBAL_KEY]);
      }
    }
  } catch (e) {
    void e; /* fallback: scope lookup. */
  }

  try {
    const selection = readStoredGlobalSessionSelection() as GlobalSessionSelection | null;
    if (selection?.selectedSessionScope) {
      return normalizeSessionScanScope(selection.selectedSessionScope);
    }
  } catch (e) {
    void e; /* fallback: scope lookup. */
  }

  return FAIL_CLOSED_SESSION_SCAN_SCOPE;
};

export const readSessionScanSlugs = (): string[] => {
  // Precedence:
  // 1) URL param `?ceSessionScanSlugs=general,edge,test`
  // 2) localStorage `ce:sessionScanSlugs` (CSV or JSON array)
  // 3) globalThis.CE_SESSION_SCAN_SLUGS (array or CSV string)
  // 4) default []

  try {
    if (typeof window !== 'undefined') {
      const search = window.location?.search || '';
      const params = new URLSearchParams(search);
      if (params.has(URL_PARAM_SLUGS_KEY)) {
        return normalizeSessionScanSlugs(params.get(URL_PARAM_SLUGS_KEY));
      }
    }
  } catch (e) {
    void e; /* fallback: slug scope lookup. */
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_SLUGS_KEY);
      if (stored != null) return parseStoredSlugs(stored);
    }
  } catch (e) {
    void e; /* fallback: slug scope lookup. */
  }

  try {
    if (typeof globalThis !== 'undefined') {
      const runtimeGlobals = globalThis as Record<string, unknown>;
      if (typeof runtimeGlobals[GLOBAL_SLUGS_KEY] !== 'undefined') {
        return normalizeSessionScanSlugs(runtimeGlobals[GLOBAL_SLUGS_KEY]);
      }
    }
  } catch (e) {
    void e; /* fallback: slug scope lookup. */
  }

  try {
    const selection = readStoredGlobalSessionSelection() as GlobalSessionSelection | null;
    if (Array.isArray(selection?.selectedSessionSlugs)) {
      return normalizeSessionScanSlugs(selection.selectedSessionSlugs);
    }
  } catch (e) {
    void e; /* fallback: slug scope lookup. */
  }

  return [];
};

export const writeSessionScanScope = (scopeIn: unknown): SessionScanScope => {
  const scope = normalizeSessionScanScope(scopeIn);

  try {
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>)[GLOBAL_KEY] = scope;
    }
  } catch (e) {
    log.warn('sessionScanScope: fallback', e);
  }

  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY, scope);
  } catch (e) {
    log.warn('sessionScanScope: fallback', e);
  }

  try {
    const selection = normalizeGlobalSessionSelection({
      ...(readStoredGlobalSessionSelection() as GlobalSessionSelection | null),
      selectedSessionScope: scope,
    });
    persistGlobalSessionSelection(selection);
    dispatchGlobalSessionSelectionUpdatedEvent(selection);
  } catch (e) {
    log.warn('sessionScanScope: fallback', e);
  }

  return scope;
};

export const writeSessionScanSlugs = (slugsIn: unknown): string[] => {
  const slugs = normalizeSessionScanSlugs(slugsIn);

  try {
    if (typeof globalThis !== 'undefined') {
      (globalThis as Record<string, unknown>)[GLOBAL_SLUGS_KEY] = slugs;
    }
  } catch (e) {
    log.warn('sessionScanScope: fallback', e);
  }

  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_STORAGE_SLUGS_KEY, JSON.stringify(slugs));
  } catch (e) {
    log.warn('sessionScanScope: fallback', e);
  }

  try {
    const selection = normalizeGlobalSessionSelection({
      ...(readStoredGlobalSessionSelection() as GlobalSessionSelection | null),
      selectedSessionSlugs: slugs,
    });
    persistGlobalSessionSelection(selection);
    dispatchGlobalSessionSelectionUpdatedEvent(selection);
  } catch (e) {
    log.warn('sessionScanScope: fallback', e);
  }

  return slugs;
};
