import { normalizeSessionSlug } from './sessionNaming.js';
import { toStr } from '../shared/primitives.js';
import { CE_SESSION_SCAN_SCOPE, CE_SESSION_SCAN_SLUGS } from '../../variables/appConfig.js';

type GlobalSessionScope = 'all' | 'active' | 'general' | 'list';
type GlobalSessionSelectionInput = Record<string, unknown>;
type GlobalSessionSelection = {
  primarySessionSlug: string;
  primarySessionExplicit: boolean;
  activeSessionSlug: string;
  selectedSessionScope: GlobalSessionScope;
  selectedSessionSlugs: string[];
};

export const GLOBAL_SESSION_PRIMARY_STORAGE_KEY = 'ce:primarySessionSlug';
export const GLOBAL_SESSION_PRIMARY_EXPLICIT_STORAGE_KEY = 'ce:primarySessionSlugExplicit';
export const GLOBAL_SESSION_SCOPE_STORAGE_KEY = 'ce:selectedSessionScope';
export const GLOBAL_SESSION_SLUGS_STORAGE_KEY = 'ce:selectedSessionSlugs';
export const GLOBAL_SESSION_SELECTION_UPDATED_EVENT = 'ce:global-session-selection-updated';

const LEGACY_SCOPE_STORAGE_KEY = 'ce:sessionScanScope';
const LEGACY_SLUGS_STORAGE_KEY = 'ce:sessionScanSlugs';
const VALID_SCOPE_MODES = new Set<GlobalSessionScope>(['all', 'active', 'general', 'list']);
const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const isRecord = (value: unknown): value is GlobalSessionSelectionInput => !!value && typeof value === 'object';
export const DEFAULT_GLOBAL_SESSION_SCOPE: GlobalSessionScope = VALID_SCOPE_MODES.has(
  toStr(CE_SESSION_SCAN_SCOPE).trim().toLowerCase() as GlobalSessionScope,
)
  ? (toStr(CE_SESSION_SCAN_SCOPE).trim().toLowerCase() as GlobalSessionScope)
  : 'active';

const safeWindow = (): Window | null =>
  typeof window !== 'undefined' && window && typeof window.addEventListener === 'function' ? window : null;

const readLocalStorage = (key: string): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const writeLocalStorage = (key: string, value: string): void => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch (_) {}
};

export const normalizeGlobalSessionScope = (value: unknown): GlobalSessionScope => {
  const normalized = toStr(value).trim().toLowerCase();
  if (VALID_SCOPE_MODES.has(normalized as GlobalSessionScope)) return normalized as GlobalSessionScope;
  return DEFAULT_GLOBAL_SESSION_SCOPE;
};

export const normalizeGlobalSessionSlugs = (value: unknown): string[] => {
  const source = Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : [entry]))
    : toStr(value).split(',');
  const seen = new Set<string>();
  const out: string[] = [];
  source.forEach((entry) => {
    const slug = normalizeSessionSlug(entry);
    if (slug == null) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

export const normalizeGlobalPrimarySessionSlug = (value: unknown): string => normalizeSessionSlug(value);

export const derivePrimarySessionSlugFromList = (slugs: unknown[] = []): string => {
  const normalizedSlugs = normalizeGlobalSessionSlugs(slugs);
  const firstConcreteSlug = normalizedSlugs.find((slug) => slug !== '');
  if (firstConcreteSlug) return firstConcreteSlug;
  return normalizedSlugs[0] || '';
};

const parseStoredSlugList = (raw: unknown): string[] => {
  const value = toStr(raw).trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      return normalizeGlobalSessionSlugs(JSON.parse(value));
    } catch (_) {}
  }
  return normalizeGlobalSessionSlugs(value);
};

const readStoredPrimarySessionExplicit = (): boolean => {
  const raw = readLocalStorage(GLOBAL_SESSION_PRIMARY_EXPLICIT_STORAGE_KEY);
  if (raw == null) return false;
  try {
    return JSON.parse(raw) === true;
  } catch (_) {
    return raw === 'true';
  }
};

export const normalizeGlobalSessionSelection = (value: unknown = {}): GlobalSessionSelection => {
  const source = isRecord(value) ? value : {};
  const hasExplicitPrimarySessionSlug =
    Object.prototype.hasOwnProperty.call(source, 'primarySessionSlug') ||
    Object.prototype.hasOwnProperty.call(source, 'activeSessionSlug') ||
    Object.prototype.hasOwnProperty.call(source, 'sessionSlug');
  let primarySessionExplicit =
    source.primarySessionExplicit === true
      ? true
      : source.primarySessionExplicit === false
        ? false
        : hasExplicitPrimarySessionSlug;
  const selectedSessionScope = normalizeGlobalSessionScope(
    source.selectedSessionScope ?? source.sessionScanScope ?? source.scopeMode,
  );
  const selectedSessionSlugs = normalizeGlobalSessionSlugs(
    source.selectedSessionSlugs ?? source.sessionScanSlugs ?? source.scopeSlugs,
  );
  let primarySessionSlug = normalizeGlobalPrimarySessionSlug(
    source.primarySessionSlug ?? source.activeSessionSlug ?? source.sessionSlug,
  );
  const listIncludesGeneral = selectedSessionSlugs.includes('');

  // Preserve the primary/default layer while still keeping the full list authoritative.
  if (
    !primarySessionExplicit &&
    !primarySessionSlug &&
    selectedSessionScope === 'list' &&
    selectedSessionSlugs.length > 0
  ) {
    primarySessionSlug = derivePrimarySessionSlugFromList(selectedSessionSlugs);
  }
  // If list mode excludes the general session, keeping an explicit blank primary
  // makes the UI fall back to the default Context Engine config instead of the
  // first concrete listed session.
  if (
    primarySessionExplicit &&
    !primarySessionSlug &&
    selectedSessionScope === 'list' &&
    selectedSessionSlugs.length > 0 &&
    !listIncludesGeneral
  ) {
    primarySessionSlug = derivePrimarySessionSlugFromList(selectedSessionSlugs);
    primarySessionExplicit = false;
  }

  return {
    primarySessionSlug,
    primarySessionExplicit,
    activeSessionSlug: primarySessionSlug,
    selectedSessionScope,
    selectedSessionSlugs,
  };
};

export const readStoredGlobalSessionSelection = (): GlobalSessionSelection => {
  const primarySessionSlug = readLocalStorage(GLOBAL_SESSION_PRIMARY_STORAGE_KEY);
  const selectedSessionScope =
    readLocalStorage(GLOBAL_SESSION_SCOPE_STORAGE_KEY) ??
    readLocalStorage(LEGACY_SCOPE_STORAGE_KEY) ??
    CE_SESSION_SCAN_SCOPE;
  const selectedSessionSlugsRaw =
    readLocalStorage(GLOBAL_SESSION_SLUGS_STORAGE_KEY) ??
    readLocalStorage(LEGACY_SLUGS_STORAGE_KEY) ??
    CE_SESSION_SCAN_SLUGS;

  return normalizeGlobalSessionSelection({
    ...(primarySessionSlug != null ? { primarySessionSlug } : {}),
    primarySessionExplicit: readStoredPrimarySessionExplicit(),
    selectedSessionScope,
    selectedSessionSlugs: parseStoredSlugList(selectedSessionSlugsRaw),
  });
};

export const resolveScopedSessionSlugsFromSelection = (value: unknown = {}): string[] => {
  const selection = normalizeGlobalSessionSelection(value);
  if (selection.selectedSessionScope === 'general') return [''];
  if (selection.selectedSessionScope === 'active') return [selection.primarySessionSlug || ''];
  if (selection.selectedSessionScope === 'list') return selection.selectedSessionSlugs;
  return [];
};

export const dispatchGlobalSessionSelectionUpdatedEvent = (value: unknown = {}): GlobalSessionSelection => {
  const target = safeWindow();
  if (!target || typeof target.dispatchEvent !== 'function') return normalizeGlobalSessionSelection(value);
  const selection = normalizeGlobalSessionSelection(value);
  try {
    target.dispatchEvent(
      new CustomEvent(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, {
        detail: selection,
      }),
    );
  } catch (_) {}
  return selection;
};

const writeLegacyRuntimeSessionGlobals = (selection: GlobalSessionSelection): void => {
  try {
    if (typeof globalThis === 'undefined' || !globalThis) return;
    const runtimeGlobals = globalThis as Record<string, unknown>;
    runtimeGlobals.CE_SESSION_SCAN_SCOPE = selection.selectedSessionScope;
    runtimeGlobals.CE_SESSION_SCAN_SLUGS = [...selection.selectedSessionSlugs];
  } catch (_) {}
};

export const persistGlobalSessionSelection = (value: unknown = {}): GlobalSessionSelection => {
  const source = isRecord(value) ? value : {};
  const storedSelection = readStoredGlobalSessionSelection();
  const hasPrimaryInput =
    hasOwn(source, 'primarySessionSlug') || hasOwn(source, 'activeSessionSlug') || hasOwn(source, 'sessionSlug');
  const hasPrimaryExplicitInput = hasOwn(source, 'primarySessionExplicit');
  const hasScopeInput =
    hasOwn(source, 'selectedSessionScope') || hasOwn(source, 'sessionScanScope') || hasOwn(source, 'scopeMode');
  const hasSlugInput =
    hasOwn(source, 'selectedSessionSlugs') || hasOwn(source, 'sessionScanSlugs') || hasOwn(source, 'scopeSlugs');
  const primarySessionExplicit = hasPrimaryExplicitInput
    ? source.primarySessionExplicit === true
    : hasPrimaryInput || storedSelection.primarySessionExplicit === true;
  // Regression guard: scope/list edits must preserve an explicit primary default,
  // but non-explicit primaries should be re-derived from the updated scope.
  const preserveStoredPrimarySessionSlug =
    !hasPrimaryInput &&
    ((hasPrimaryExplicitInput && source.primarySessionExplicit === true) ||
      (!hasPrimaryExplicitInput && storedSelection.primarySessionExplicit === true));
  const selection = normalizeGlobalSessionSelection({
    ...(hasScopeInput ? {} : { selectedSessionScope: storedSelection.selectedSessionScope }),
    ...(hasSlugInput ? {} : { selectedSessionSlugs: storedSelection.selectedSessionSlugs }),
    ...(preserveStoredPrimarySessionSlug ? { primarySessionSlug: storedSelection.primarySessionSlug } : {}),
    ...source,
    primarySessionExplicit,
  });
  writeLocalStorage(GLOBAL_SESSION_PRIMARY_STORAGE_KEY, selection.primarySessionSlug);
  writeLocalStorage(GLOBAL_SESSION_PRIMARY_EXPLICIT_STORAGE_KEY, JSON.stringify(selection.primarySessionExplicit));
  writeLocalStorage(GLOBAL_SESSION_SCOPE_STORAGE_KEY, selection.selectedSessionScope);
  writeLocalStorage(GLOBAL_SESSION_SLUGS_STORAGE_KEY, JSON.stringify(selection.selectedSessionSlugs));

  // Keep existing scan-scope helpers and consumers working while the canonical
  // selection model becomes first-class across the app.
  writeLocalStorage(LEGACY_SCOPE_STORAGE_KEY, selection.selectedSessionScope);
  writeLocalStorage(LEGACY_SLUGS_STORAGE_KEY, JSON.stringify(selection.selectedSessionSlugs));
  writeLegacyRuntimeSessionGlobals(selection);
  return selection;
};

export const writeGlobalSessionSelection = (value: unknown = {}): GlobalSessionSelection => {
  const selection = persistGlobalSessionSelection(value);
  dispatchGlobalSessionSelectionUpdatedEvent(selection);
  return selection;
};
