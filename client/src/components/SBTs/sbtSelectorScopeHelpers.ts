import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';

export type SbtSelectorDiscoverySlugOptions = {
  allowEmpty?: boolean;
};

export type ResolveSbtSelectorEffectiveSessionSlugArgs = {
  groupOverride?: unknown;
  props?: unknown;
  sourceSessionSlug?: unknown;
};

export type ResolveDirectSbtSelectorTargetSlugsArgs = {
  explicitOverride?: unknown;
  getAllSessionSlugs?: ((options?: { includeEmpty?: boolean }) => unknown) | null;
  normalizeDiscoverySlugs?: ((slugs: unknown, options?: SbtSelectorDiscoverySlugOptions) => string[]) | null;
  propSessionSlug?: unknown;
  readSessionScanScope?: (() => unknown) | null;
  readSessionScanSlugs?: (() => unknown) | null;
};

export type ResolveSbtSelectorTargetSlugsArgs = {
  directlyInvokedTargetSlugs?: unknown;
  groupOverride?: unknown;
  normalizeDiscoverySlugs?: ((slugs: unknown, options?: SbtSelectorDiscoverySlugOptions) => string[]) | null;
  slugOverride?: unknown;
  sourceSessionSlug?: unknown;
};

export type ShouldWarmSbtSelectorRegistryCacheArgs = {
  shouldUsePropsSessionConfigForSlug?: ((slug: string) => unknown) | null;
  targetSlugs?: unknown;
};

export type ShouldUsePropsSbtSelectorSessionConfigArgs = {
  effectiveSessionSlug?: unknown;
  sessionConfig?: unknown;
  slugIn?: unknown;
};

export type ResolveSbtSelectorDisplayLookupSessionConfigArgs = {
  allowDemoSessionFallback?: unknown;
  getDemoSessionConfigBySlug?: ((slug: unknown, options?: { allowDemoFallback?: boolean }) => unknown) | null;
  getSessionConfigBySlugOrDefault?: ((slug: unknown) => unknown) | null;
  isUnresolvedSessionConfig?: ((config: unknown) => boolean) | null;
  sessionSlug?: unknown;
};

export type ResolveSbtSelectorScopeModeArgs = {
  discoveryOverride?: unknown;
  groupOverride?: unknown;
  readSessionScanScope?: (() => unknown) | null;
};

export type SbtSelectorGroupOption = {
  label: string;
  value: string;
};

export type BuildSbtSelectorGroupOptionsArgs = {
  getSessionLabel?: ((slug: unknown) => string) | null;
  slugs?: unknown;
};

export type BuildSbtSelectorAutoSearchSessionOptionsArgs = {
  autoSearchOtherSessions?: unknown;
  directlyInvokedTargetSlugs?: unknown;
  enableGroupSelect?: unknown;
  groupOptions?: unknown;
  groupOverride?: unknown;
  sourceSessionSlug?: unknown;
};

const isSbtSelectorScopeRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (value: unknown, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(Object(value), key);

const pickNormalizedSessionSlug = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

const isUnresolvedSessionConfig = (config: unknown): boolean =>
  isSbtSelectorScopeRecord(config) && config.__unresolved === true;

export const resolvePropSessionSlug = (props: unknown = {}): string => {
  const record = isSbtSelectorScopeRecord(props) ? props : {};
  const hasExplicitSessionSlug = hasOwn(record, 'sessionSlug');
  return pickNormalizedSessionSlug(hasExplicitSessionSlug ? record.sessionSlug : undefined, record.activeSessionSlug);
};

export const resolveSbtSelectorEffectiveSessionSlug = ({
  groupOverride = false,
  props = {},
  sourceSessionSlug = '',
}: ResolveSbtSelectorEffectiveSessionSlugArgs = {}): string =>
  groupOverride ? String(sourceSessionSlug ?? '') : resolvePropSessionSlug(props);

export const normalizeDiscoverySlugs = (
  slugs: unknown,
  { allowEmpty = true }: SbtSelectorDiscoverySlugOptions = {},
): string[] => {
  const values = Array.isArray(slugs) ? slugs : [slugs];
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value: unknown) => {
    const normalized = normalizeSessionSlug(value || '');
    if (!allowEmpty && !normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

export const buildSbtSelectorListScopeTargetSlugSet = ({
  fallbackSlug = '',
  scopeMode = 'active',
  targetSlugs = [],
}: {
  fallbackSlug?: unknown;
  scopeMode?: unknown;
  targetSlugs?: unknown;
} = {}): Set<string> | null => {
  if (scopeMode !== 'list') return null;
  const sourceSlugs = Array.isArray(targetSlugs) && targetSlugs.length > 0 ? targetSlugs : [fallbackSlug];
  return new Set<string>(normalizeDiscoverySlugs(sourceSlugs, { allowEmpty: true }));
};

export const resolveDirectSbtSelectorTargetSlugs = ({
  explicitOverride = [],
  getAllSessionSlugs: getAllSessionSlugsFn = null,
  normalizeDiscoverySlugs: normalizeDiscoverySlugsFn = normalizeDiscoverySlugs,
  propSessionSlug = '',
  readSessionScanScope: readSessionScanScopeFn = null,
  readSessionScanSlugs: readSessionScanSlugsFn = null,
}: ResolveDirectSbtSelectorTargetSlugsArgs = {}): string[] => {
  const normalizeSlugs =
    typeof normalizeDiscoverySlugsFn === 'function' ? normalizeDiscoverySlugsFn : normalizeDiscoverySlugs;
  const explicitSlugs = normalizeSlugs(explicitOverride, { allowEmpty: true });
  if (explicitSlugs.length > 0) return explicitSlugs;

  const effectiveSlug = normalizeSessionSlug(propSessionSlug || '');
  const scopeMode = typeof readSessionScanScopeFn === 'function' ? readSessionScanScopeFn() : '';
  if (scopeMode === 'general') return [''];
  if (scopeMode === 'list') {
    const scanSlugs = typeof readSessionScanSlugsFn === 'function' ? readSessionScanSlugsFn() : [];
    return normalizeSlugs(scanSlugs, { allowEmpty: true });
  }
  if (scopeMode === 'all') {
    const allSlugs = typeof getAllSessionSlugsFn === 'function' ? getAllSessionSlugsFn({ includeEmpty: true }) : [];
    return normalizeSlugs(allSlugs, { allowEmpty: true });
  }
  return normalizeSlugs([effectiveSlug], { allowEmpty: true });
};

export const resolveSbtSelectorTargetSlugs = (args: ResolveSbtSelectorTargetSlugsArgs = {}): string[] => {
  const normalizeSlugs =
    typeof args.normalizeDiscoverySlugs === 'function' ? args.normalizeDiscoverySlugs : normalizeDiscoverySlugs;
  if (hasOwn(args, 'slugOverride')) {
    return normalizeSlugs([args.slugOverride], { allowEmpty: true });
  }
  if (args.groupOverride) {
    return normalizeSlugs([args.sourceSessionSlug], { allowEmpty: true });
  }
  return Array.isArray(args.directlyInvokedTargetSlugs)
    ? args.directlyInvokedTargetSlugs
    : normalizeSlugs(args.directlyInvokedTargetSlugs, { allowEmpty: true });
};

export const shouldWarmSbtSelectorRegistryCacheForTargets = ({
  shouldUsePropsSessionConfigForSlug = null,
  targetSlugs = [],
}: ShouldWarmSbtSelectorRegistryCacheArgs = {}): boolean => {
  const targets = Array.isArray(targetSlugs) ? targetSlugs : [];
  if (!targets.length) return true;
  return targets.some(
    (targetSlug: string) =>
      !(typeof shouldUsePropsSessionConfigForSlug === 'function'
        ? shouldUsePropsSessionConfigForSlug(targetSlug)
        : false),
  );
};

export const shouldUsePropsSbtSelectorSessionConfigForSlug = ({
  effectiveSessionSlug = '',
  sessionConfig = null,
  slugIn,
}: ShouldUsePropsSbtSelectorSessionConfigArgs = {}): boolean => {
  if (!sessionConfig || typeof sessionConfig !== 'object') return false;
  const configRecord = sessionConfig as Record<string, unknown>;
  const effectiveSlug = normalizeSessionSlug(effectiveSessionSlug || '');
  const requestedSlug = normalizeSessionSlug(slugIn !== undefined ? slugIn : effectiveSlug);
  const propsSlug = pickNormalizedSessionSlug(configRecord.slug, effectiveSlug);
  return requestedSlug === propsSlug || requestedSlug === effectiveSlug;
};

export const resolveSbtSelectorDisplayLookupSessionConfig = ({
  allowDemoSessionFallback = false,
  getDemoSessionConfigBySlug: getDemoSessionConfigBySlugFn = null,
  getSessionConfigBySlugOrDefault: getSessionConfigBySlugOrDefaultFn = null,
  isUnresolvedSessionConfig: isUnresolvedSessionConfigFn = isUnresolvedSessionConfig,
  sessionSlug = '',
}: ResolveSbtSelectorDisplayLookupSessionConfigArgs = {}): unknown | null => {
  const strictLookupConfig =
    typeof getSessionConfigBySlugOrDefaultFn === 'function' ? getSessionConfigBySlugOrDefaultFn(sessionSlug) : null;
  const isUnresolved =
    typeof isUnresolvedSessionConfigFn === 'function' ? isUnresolvedSessionConfigFn : isUnresolvedSessionConfig;
  if (strictLookupConfig && !isUnresolved(strictLookupConfig)) {
    return strictLookupConfig;
  }
  if (!allowDemoSessionFallback) {
    return strictLookupConfig || null;
  }
  const demoLookupConfig =
    typeof getDemoSessionConfigBySlugFn === 'function'
      ? getDemoSessionConfigBySlugFn(sessionSlug, { allowDemoFallback: true })
      : null;
  return demoLookupConfig || strictLookupConfig || null;
};

export const getNormalizedDiscoveryOverride = (props: unknown = {}): string[] => {
  const record = isSbtSelectorScopeRecord(props) ? props : {};
  if (!Array.isArray(record.discoverySessionSlugs) || record.discoverySessionSlugs.length === 0) {
    return [];
  }
  return normalizeDiscoverySlugs(record.discoverySessionSlugs, { allowEmpty: true });
};

export const resolveSbtSelectorScopeMode = ({
  discoveryOverride = [],
  groupOverride = false,
  readSessionScanScope: readSessionScanScopeFn = null,
}: ResolveSbtSelectorScopeModeArgs = {}): string => {
  if (groupOverride) return 'override';
  if (Array.isArray(discoveryOverride) && discoveryOverride.length > 0) return 'explicit';
  return String(typeof readSessionScanScopeFn === 'function' ? readSessionScanScopeFn() : '');
};

export const buildSbtSelectorGroupOptions = ({
  getSessionLabel = null,
  slugs = [],
}: BuildSbtSelectorGroupOptionsArgs = {}): SbtSelectorGroupOption[] =>
  (Array.isArray(slugs) ? slugs : []).map((slug: unknown) => ({
    value: String(slug || ''),
    label: typeof getSessionLabel === 'function' ? getSessionLabel(slug) : String(slug || ''),
  }));

export const buildSbtSelectorAutoSearchSessionOptions = ({
  autoSearchOtherSessions = false,
  directlyInvokedTargetSlugs = [],
  enableGroupSelect = false,
  groupOptions = [],
  groupOverride = false,
  sourceSessionSlug = '',
}: BuildSbtSelectorAutoSearchSessionOptionsArgs = {}): SbtSelectorGroupOption[] => {
  if (!enableGroupSelect) return [];
  if (!autoSearchOtherSessions) return [];
  const hiddenSlugSet = new Set<string>(normalizeDiscoverySlugs(directlyInvokedTargetSlugs, { allowEmpty: true }));
  if (groupOverride) {
    hiddenSlugSet.add(normalizeSessionSlug(sourceSessionSlug));
  }
  return (Array.isArray(groupOptions) ? groupOptions : [])
    .map((option: unknown) => {
      const record = isSbtSelectorScopeRecord(option) ? (option as SbtSelectorGroupOption) : { value: '', label: '' };
      return {
        ...record,
        label: String(record.label || ''),
        value: normalizeSessionSlug(record.value || ''),
      };
    })
    .filter((option: SbtSelectorGroupOption) => !hiddenSlugSet.has(option.value));
};
