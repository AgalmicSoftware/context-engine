import {
  canonicalizeSessionSlug,
  resolveCanonicalSessionConfig,
} from '../../utilities/session/canonicalSessionContext.js';
import { parseQuestionSessionSlugFromSearch } from '../../utilities/survey/questionRouting.js';
import { resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { ResolveSessionConfigBySlug, SessionResolutionResult } from '../shellTypes';

type UnknownRecord = Record<string, unknown>;

type SurveyResultsExplicitSessionSource = {
  sessionSlug?: string;
  activeSessionSlug?: string;
};

type SurveyResultsSessionInput = {
  search?: unknown;
  sessionSlug?: unknown;
  activeSessionSlug?: unknown;
};

type SurveyResultsQuestionReadScopeInput = SurveyResultsSessionInput & {
  pathname?: unknown;
  questionReadSlugsOverride?: unknown;
  sessionSlugPinned?: unknown;
  viewMode?: unknown;
  readSessionScanScope?: () => unknown;
  readSessionScanSlugs?: () => unknown;
  getAllSessionSlugs?: () => unknown;
};

type ResolveSurveyResultsSessionContextInput = SurveyResultsSessionInput & {
  surveyId?: unknown;
  surveyCacheEntries?: unknown;
  resolveBySlug?: ResolveSessionConfigBySlug;
};

type ScanSurveyResultsSessionSlugFromCacheInput = {
  surveyId?: unknown;
  surveyCacheEntries?: unknown;
};

type SurveyResultsQuestionReadScope = {
  baseSlug: string;
  questionReadSlugs: string[];
  extraQuestionReadSlugs: string[];
  storageKeyPrefix: string;
};

type SurveyCacheBucket = UnknownRecord & {
  surveys?: UnknownRecord;
};

type SurveyCacheEntry = {
  slug?: unknown;
  value?: unknown;
};

const isObj = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object' && !Array.isArray(value);
const GENERAL_SCOPE_STORAGE_TOKEN = '__general__';
const MULTI_SCOPE_STORAGE_PREFIX = '__scope__:';

const readExplicitSessionSlug = (value: unknown): string | null => {
  const raw = toStr(value).trim();
  return raw ? canonicalizeSessionSlug(raw) : null;
};
const hasExplicitSessionQueryPin = (search: unknown = ''): boolean => {
  const raw = toStr(search).trim();
  if (!raw) return false;
  try {
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
    return (
      params.get('session') != null ||
      params.get('sessionSlug') != null ||
      params.get('s') != null ||
      params.get('sessionId') != null ||
      params.get('sessionID') != null ||
      params.get('sid') != null
    );
  } catch (_) {
    return false;
  }
};
const dedupeSessionSlugs = (values: unknown = []): string[] => {
  const source = Array.isArray(values) ? values : [values];
  const seen = new Set<string>();
  const out: string[] = [];
  source.forEach((value) => {
    const normalized = canonicalizeSessionSlug(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};
const encodeQuestionFilterScopeStorageToken = (slug: unknown = ''): string => {
  const normalized = canonicalizeSessionSlug(slug);
  return normalized === '' ? GENERAL_SCOPE_STORAGE_TOKEN : normalized;
};
const buildQuestionFilterStorageKeyPrefix = (questionReadSlugs: unknown = [], baseSlug: unknown = ''): string => {
  const normalizedBaseSlug = canonicalizeSessionSlug(baseSlug);
  const scopeSlugs = dedupeSessionSlugs([
    normalizedBaseSlug,
    ...(Array.isArray(questionReadSlugs) ? questionReadSlugs : []),
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

const buildSurveyResultsExplicitSessionSource = ({
  search = '',
  sessionSlug,
  activeSessionSlug,
}: SurveyResultsSessionInput = {}): SurveyResultsExplicitSessionSource | null => {
  const explicitQuerySessionSlug = parseQuestionSessionSlugFromSearch(toStr(search));
  if (explicitQuerySessionSlug !== null) {
    return { sessionSlug: explicitQuerySessionSlug };
  }

  const explicitSessionSlug = readExplicitSessionSlug(sessionSlug);
  if (explicitSessionSlug !== null) {
    return { sessionSlug: explicitSessionSlug };
  }

  const explicitActiveSessionSlug = readExplicitSessionSlug(activeSessionSlug);
  if (explicitActiveSessionSlug !== null) {
    return { activeSessionSlug: explicitActiveSessionSlug };
  }

  return null;
};

export const resolveSurveyResultsExplicitSessionSlug = (input: SurveyResultsSessionInput = {}): string | null => {
  const source = buildSurveyResultsExplicitSessionSource(input);
  if (!source) return null;
  return resolveCanonicalSessionConfig({ source }).sessionSlug || '';
};

export const resolveSurveyResultsQuestionReadScope = ({
  pathname = '',
  search = '',
  sessionSlug,
  sessionSlugPinned = false,
  activeSessionSlug,
  questionReadSlugsOverride = null,
  viewMode = 'questions',
  readSessionScanScope = () => 'active',
  readSessionScanSlugs = () => [],
  getAllSessionSlugs = () => [],
}: SurveyResultsQuestionReadScopeInput = {}): SurveyResultsQuestionReadScope => {
  const routeSlug = resolveSessionSlugFromPathname(pathname);
  const hasRouteSessionPin = routeSlug !== null;
  const baseSlug = canonicalizeSessionSlug(
    resolveSurveyResultsExplicitSessionSlug({
      search,
      sessionSlug,
      activeSessionSlug,
    }) ??
      routeSlug ??
      '',
  );
  const shouldFanOut =
    sessionSlugPinned !== true &&
    !hasRouteSessionPin &&
    !hasExplicitSessionQueryPin(search) &&
    String(viewMode || '')
      .trim()
      .toLowerCase() === 'questions';

  let extraQuestionReadSlugs: string[] = [];
  const normalizedOverrideSlugs = Array.isArray(questionReadSlugsOverride)
    ? dedupeSessionSlugs(questionReadSlugsOverride).filter((slug) => slug !== baseSlug)
    : null;
  if (normalizedOverrideSlugs) {
    extraQuestionReadSlugs = normalizedOverrideSlugs;
  } else if (shouldFanOut) {
    const scopeMode = String(readSessionScanScope() || '')
      .trim()
      .toLowerCase();
    if (scopeMode === 'list') {
      extraQuestionReadSlugs = dedupeSessionSlugs(readSessionScanSlugs()).filter((slug) => slug !== baseSlug);
    } else if (scopeMode === 'all') {
      extraQuestionReadSlugs = dedupeSessionSlugs(getAllSessionSlugs()).filter((slug) => slug !== baseSlug);
    }
  }

  const includeBuiltInDemoCanonicalSource =
    String(viewMode || '')
      .trim()
      .toLowerCase() === 'questions' && baseSlug === 'demo';
  const questionReadSlugs = dedupeSessionSlugs([
    baseSlug,
    ...(includeBuiltInDemoCanonicalSource ? [''] : []),
    ...extraQuestionReadSlugs,
  ]);

  return {
    baseSlug,
    questionReadSlugs,
    extraQuestionReadSlugs,
    storageKeyPrefix: buildQuestionFilterStorageKeyPrefix(questionReadSlugs, baseSlug),
  };
};

export const scanSurveyResultsSessionSlugFromCache = ({
  surveyId,
  surveyCacheEntries,
}: ScanSurveyResultsSessionSlugFromCacheInput = {}): string => {
  const sid = toStr(surveyId).trim().toLowerCase();
  if (!sid) return '';

  const entries = Array.isArray(surveyCacheEntries) ? (surveyCacheEntries as SurveyCacheEntry[]) : [];
  for (const entry of entries) {
    const slug = canonicalizeSessionSlug(entry?.slug || '');
    const cache = isObj(entry?.value) ? entry.value : {};
    for (const netKey in cache) {
      if (!Object.prototype.hasOwnProperty.call(cache, netKey)) continue;
      const bucket = isObj(cache[netKey]) ? (cache[netKey] as SurveyCacheBucket) : null;
      if (!bucket || !isObj(bucket.surveys)) continue;
      if (Object.prototype.hasOwnProperty.call(bucket.surveys, sid)) {
        return slug;
      }
    }
  }

  return '';
};

export const resolveSurveyResultsEffectiveSlug = ({
  sessionSlug,
  activeSessionSlug,
  surveyId,
  surveyCacheEntries,
}: {
  sessionSlug?: unknown;
  activeSessionSlug?: unknown;
  surveyId?: unknown;
  surveyCacheEntries?: unknown;
} = {}): string => {
  return (
    resolveSurveyResultsSessionContext({
      surveyId,
      surveyCacheEntries,
      sessionSlug,
      activeSessionSlug,
    }).sessionSlug || ''
  );
};

export const resolveSurveyResultsSessionContext = ({
  resolveBySlug,
  ...input
}: ResolveSurveyResultsSessionContextInput = {}): SessionResolutionResult => {
  const source = buildSurveyResultsExplicitSessionSource(input) || {
    sessionSlug: scanSurveyResultsSessionSlugFromCache({
      surveyId: input.surveyId,
      surveyCacheEntries: input.surveyCacheEntries,
    }),
  };

  return resolveCanonicalSessionConfig({
    source,
    resolveBySlug,
  }) as SessionResolutionResult;
};
