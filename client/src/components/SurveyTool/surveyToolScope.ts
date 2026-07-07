import {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
} from '../../utilities/web3/chainGateway.js';
import {
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import {
  normalizeSessionSlug,
  resolveSessionAliases,
  resolveSessionSlugFromPathname,
} from '../../utilities/session/sessionNaming.js';
import {
  resolveSurveyToolDecryptHydrationContext,
  resolveSurveyToolDraftSessionContext,
  resolveSurveyToolDraftStorageContext,
  resolveSurveyToolEffectiveSlug,
  resolveSurveyToolEnsureQuestionCachedContext,
  resolveSurveyToolExplicitSessionContext,
  resolveSurveyToolIdLookupContext,
  resolveSurveyToolLockAudienceSessionNameContext,
  resolveSurveyToolQuestionConfigContext,
  resolveSurveyToolQuestionCountContext,
  resolveSurveyToolQuestionPayloadCacheWriteContext,
  resolveSurveyToolQuestionsDashboardLoadContext,
  resolveSurveyToolPileFilterContext,
  resolveSurveyToolPileLoadContext,
  resolveSurveyToolPileWarmSeedContext,
  resolveSurveyToolPileResponseReadContext,
  resolveSurveyToolQuestionReadCacheContext,
  resolveSurveyToolQuestionBootstrapContext,
  resolveSurveyToolResponseJsonContext,
  resolveSurveyToolResponseHydrationContext,
  resolveSurveyToolSubmittedCacheWriteContext,
  resolveSurveyToolSurveyReadContext,
  resolveSurveyToolUpdateCacheContext,
} from './surveyToolSessionResolution.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';

type UnknownRecord = Record<string, unknown>;

type SurveyToolScopeProps = {
  activeSessionSlug?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  sessionSlugPinned?: boolean;
  singleQuestionMode?: boolean;
  surveyID?: unknown;
  surveyId?: unknown;
  network?: UnknownRecord | null;
  networkChainId?: unknown;
} & UnknownRecord;

type SurveyToolScopeState = {
  localSessionOverrideTouched?: boolean;
  localSessionOverrideSlug?: unknown;
} & UnknownRecord;

type ResolveCurrentTagSessionSlugArgs = {
  props?: SurveyToolScopeProps | null;
  state?: SurveyToolScopeState | null;
  getEffectiveDraftSlug?: (() => unknown) | null;
};

type ResolveIdLookupContextArgs = {
  props?: SurveyToolScopeProps | null;
  network?: UnknownRecord | null;
  sessionSlug?: unknown;
};

type QuestionDashboardLoadContextSignatureArgs = {
  effectiveSlug?: unknown;
  scopedSessionSlugs?: unknown;
  networkID?: unknown;
};

const GENERAL_SCOPE_STORAGE_TOKEN = '__general__';
const MULTI_SCOPE_STORAGE_PREFIX = '__scope__:';

const isScopeRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const resolveSessionConfigBySlugForProps =
  (props: SurveyToolScopeProps = {}) =>
  (slugIn: string): UnknownRecord | null => {
    const slug = normalizeSessionSlugValue(slugIn);
    const providedConfig = isScopeRecord(props.sessionConfig) ? props.sessionConfig : null;
    if (
      providedConfig &&
      Object.prototype.hasOwnProperty.call(providedConfig, 'slug') &&
      normalizeSessionSlugValue(providedConfig.slug) === slug
    ) {
      return providedConfig;
    }
    return (getStrictSessionConfigBySlug(slug) as UnknownRecord | null) || null;
  };

export const normalizeSessionSlugValue = (rawSlug: unknown): string => normalizeSessionSlug(rawSlug);

export const getSessionSlugHintFromProps = (props: SurveyToolScopeProps = {}): string =>
  resolveSessionAliases(props).sessionSlug;

export const getActiveSessionSlugFromProps = (props: SurveyToolScopeProps = {}): string =>
  resolveSessionAliases(props).activeSessionSlug;

export const getSessionSlugPinnedFromProps = (props: SurveyToolScopeProps = {}): boolean =>
  resolveSessionAliases(props).sessionSlugPinned;

export const shouldInheritResolvedTagSessionScope = (props: SurveyToolScopeProps = {}): boolean => {
  if (getSessionSlugPinnedFromProps(props)) return true;

  const pathname =
    typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string'
      ? window.location.pathname
      : '';
  if (resolveSessionSlugFromPathname(pathname) !== null) return true;
  if (props.singleQuestionMode) return false;

  return String(props.surveyID || props.surveyId || '').trim() !== '';
};

export const resolveEffectiveSlug = (props: SurveyToolScopeProps = {}): string =>
  resolveSurveyToolEffectiveSlug({
    pathname: (typeof window !== 'undefined' && window.location && window.location.pathname) || '',
    activeSessionSlug: props.activeSessionSlug as string | null | undefined,
    sessionSlug: props.sessionSlug as string | null | undefined,
    sessionSlugPinned: props.sessionSlugPinned === true,
  });

export const resolveCurrentTagSessionSlug = ({
  props = {},
  state = {},
  getEffectiveDraftSlug = null,
}: ResolveCurrentTagSessionSlugArgs = {}): string => {
  if (getSessionSlugPinnedFromProps(props || {})) {
    return normalizeSessionSlugValue(props?.sessionSlug || '');
  }
  if (state?.localSessionOverrideTouched) {
    return normalizeSessionSlugValue(state.localSessionOverrideSlug);
  }
  const explicitQuerySessionSlug =
    typeof window !== 'undefined' ? parseQuestionSessionSlugFromSearch(window.location?.search || '') : null;
  if (explicitQuerySessionSlug !== null) {
    return normalizeSessionSlugValue(explicitQuerySessionSlug);
  }
  if (!shouldInheritResolvedTagSessionScope(props || {})) return '';

  return normalizeSessionSlugValue(
    resolveEffectiveSlug(props || {}) ||
      (typeof getEffectiveDraftSlug === 'function' ? getEffectiveDraftSlug() : '') ||
      '',
  );
};

export const resolveDraftSessionContext = (props: SurveyToolScopeProps = {}, effectiveDraftSlug = '') =>
  resolveSurveyToolDraftSessionContext({
    pathname: (typeof window !== 'undefined' && window.location && window.location.pathname) || '',
    activeSessionSlug: props.activeSessionSlug as string | null | undefined,
    sessionSlug: props.sessionSlug as string | null | undefined,
    effectiveDraftSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveExplicitSessionContext = (sessionSlug = '') =>
  resolveSurveyToolExplicitSessionContext({
    sessionSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveDraftStorageContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolDraftStorageContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveResponseHydrationContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolResponseHydrationContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveQuestionBootstrapContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolQuestionBootstrapContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveDecryptHydrationContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolDecryptHydrationContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveResponseJsonContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolResponseJsonContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveQuestionReadCacheContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolQuestionReadCacheContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const dedupeQuestionReadSlugs = (values: unknown[] = []): string[] => {
  const out: string[] = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = normalizeSessionSlugValue(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const hasExplicitQuestionReadLocationPin = (): boolean => {
  const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
  const lowerPath = String(pathname || '').toLowerCase();
  const fromPath = resolveSessionSlugFromPathname(pathname);
  if (fromPath !== null) return true;
  if (!lowerPath.includes('/question/') && !lowerPath.includes('/survey/')) {
    return false;
  }

  try {
    const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
    if (lowerPath.includes('/question/')) {
      return parseQuestionSessionSlugFromSearch(search) !== null || parseQuestionSessionIdFromSearch(search) != null;
    }
    const params = new URLSearchParams(search);
    return (
      params.get('session') != null ||
      params.get('sessionSlug') != null ||
      params.get('s') != null ||
      params.get('sessionId') != null ||
      params.get('sessionID') != null
    );
  } catch (_) {
    return false;
  }
};

export const getExtraQuestionReadSlugs = (props: SurveyToolScopeProps = {}, baseSlug = ''): string[] => {
  const normalizedBaseSlug = normalizeSessionSlugValue(baseSlug);
  if (getSessionSlugPinnedFromProps(props) || hasExplicitQuestionReadLocationPin()) {
    return [];
  }

  const scopeMode = readSessionScanScope();
  if (scopeMode === 'list') {
    return dedupeQuestionReadSlugs(
      readSessionScanSlugs().filter((slug) => normalizeSessionSlugValue(slug) !== normalizedBaseSlug),
    );
  }
  if (scopeMode === 'all') {
    return dedupeQuestionReadSlugs(
      getAllSessionSlugs().filter((slug) => normalizeSessionSlugValue(slug) !== normalizedBaseSlug),
    );
  }
  return [];
};

export const resolveQuestionsDashboardLoadContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolQuestionsDashboardLoadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: resolveSessionConfigBySlugForProps(props),
    fallbackSessionSlugs: getExtraQuestionReadSlugs(props, sessionSlug),
  });

export const resolveQuestionPayloadCacheWriteContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolQuestionPayloadCacheWriteContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveEnsureQuestionCachedContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolEnsureQuestionCachedContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveQuestionCountContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolQuestionCountContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: resolveSessionConfigBySlugForProps(props),
    fallbackSessionSlugs: getExtraQuestionReadSlugs(props, sessionSlug),
  });

export const resolveIdLookupContext = ({
  props = {},
  network = null,
  sessionSlug = '',
}: ResolveIdLookupContextArgs = {}) =>
  (() => {
    const effectiveNetworkId =
      (network as UnknownRecord | null)?.id ?? (props?.network as UnknownRecord | null)?.id ?? null;
    return resolveSurveyToolIdLookupContext({
      sessionSlug: String(sessionSlug || ''),
      network: effectiveNetworkId == null ? null : { id: effectiveNetworkId as string | number },
      networkChainId: props?.networkChainId as string | number | null | undefined,
      resolveBySlug: resolveSessionConfigBySlugForProps(props || {}),
    });
  })();

export const resolveSurveyReadContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolSurveyReadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveUpdateCacheContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolUpdateCacheContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveSubmittedCacheWriteContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolSubmittedCacheWriteContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolvePileWarmSeedContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolPileWarmSeedContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolvePileLoadContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolPileLoadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolvePileResponseReadContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolPileResponseReadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolvePileFilterContext = (props: SurveyToolScopeProps = {}, sessionSlug = '') =>
  resolveSurveyToolPileFilterContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId as string | number | null | undefined,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

const encodeQuestionFilterScopeStorageToken = (slug = ''): string => {
  const normalized = normalizeSessionSlugValue(slug);
  return normalized === '' ? GENERAL_SCOPE_STORAGE_TOKEN : normalized;
};

export const buildQuestionCountScopeContextKey = (slugs: unknown[] = [], networkID: unknown = ''): string => {
  const scopeKey = dedupeQuestionReadSlugs(slugs)
    .map((slug) => encodeQuestionFilterScopeStorageToken(slug))
    .sort()
    .join('|');
  return `${scopeKey}|${String(networkID || '')}`;
};

export const buildQuestionDashboardLoadContextSignature = ({
  effectiveSlug = '',
  scopedSessionSlugs = [],
  networkID = '',
}: QuestionDashboardLoadContextSignatureArgs = {}): string => {
  const readSlugs = dedupeQuestionReadSlugs(
    Array.isArray(scopedSessionSlugs) && scopedSessionSlugs.length > 0 ? scopedSessionSlugs : [effectiveSlug],
  );
  return `${normalizeSessionSlugValue(effectiveSlug)}|${buildQuestionCountScopeContextKey(readSlugs, networkID)}`;
};

export const buildQuestionFilterStorageKeyPrefix = (props: SurveyToolScopeProps = {}, baseSlug = ''): string => {
  const normalizedBaseSlug = normalizeSessionSlugValue(baseSlug || resolveEffectiveSlug(props));
  const scopeSlugs = dedupeQuestionReadSlugs([
    normalizedBaseSlug,
    ...getExtraQuestionReadSlugs(props, normalizedBaseSlug),
  ]);
  const storageSlug =
    scopeSlugs.length <= 1
      ? normalizedBaseSlug
      : `${MULTI_SCOPE_STORAGE_PREFIX}${scopeSlugs
          .map((slug) => encodeQuestionFilterScopeStorageToken(slug))
          .sort()
          .join('|')}`;
  return `dg:filters:${storageSlug}`;
};

const resolveQuestionConfigContext = (sessionSlug = '') =>
  resolveSurveyToolQuestionConfigContext({
    sessionSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export const resolveLockAudienceSessionNameContext = (sessionSlug = '') =>
  resolveSurveyToolLockAudienceSessionNameContext({
    sessionSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  });

export function getBlockedQuestionIdsSet(slug: string): Set<string> {
  return new Set(resolveQuestionConfigContext(slug).blockedQuestionIds || []);
}

export function getHighlightedQuestionIdsSet(slug: string): Set<string> {
  return new Set(resolveQuestionConfigContext(slug).highlightedQuestionIds || []);
}
