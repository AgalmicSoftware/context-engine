import {
  canonicalizeSessionSlug,
  resolveCanonicalSessionConfig,
} from '../../utilities/session/canonicalSessionContext.js';
import { parseQuestionSessionSlugFromSearch } from '../../utilities/survey/questionRouting.js';
import { resolveSessionSlugFromPathname } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const GENERAL_SCOPE_STORAGE_TOKEN = '__general__';
const MULTI_SCOPE_STORAGE_PREFIX = '__scope__:';

const readExplicitSessionSlug = (value) => {
  const raw = toStr(value).trim();
  return raw ? canonicalizeSessionSlug(raw) : null;
};
const hasExplicitSessionQueryPin = (search = '') => {
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
const dedupeSessionSlugs = (values = []) => {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const normalized = canonicalizeSessionSlug(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};
const encodeQuestionFilterScopeStorageToken = (slug = '') => {
  const normalized = canonicalizeSessionSlug(slug);
  return normalized === '' ? GENERAL_SCOPE_STORAGE_TOKEN : normalized;
};
const buildQuestionFilterStorageKeyPrefix = (questionReadSlugs = [], baseSlug = '') => {
  const normalizedBaseSlug = canonicalizeSessionSlug(baseSlug);
  const scopeSlugs = dedupeSessionSlugs([
    normalizedBaseSlug,
    ...(Array.isArray(questionReadSlugs) ? questionReadSlugs : []),
  ]);
  const storageSlug = scopeSlugs.length <= 1
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
} = {}) => {
  const explicitQuerySessionSlug = parseQuestionSessionSlugFromSearch(search);
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

export const resolveSurveyResultsExplicitSessionSlug = (input = {}) => {
  const source = buildSurveyResultsExplicitSessionSource(input);
  if (!source) return null;
  return resolveCanonicalSessionConfig({ source }).sessionSlug || '';
};

export const resolveSurveyResultsQuestionReadScope = ({
  pathname = '',
  search = '',
  sessionSlug,
  activeSessionSlug,
  questionReadSlugsOverride = null,
  viewMode = 'questions',
  readSessionScanScope = () => 'active',
  readSessionScanSlugs = () => [],
  getAllSessionSlugs = () => [],
} = {}) => {
  const routeSlug = resolveSessionSlugFromPathname(pathname);
  const baseSlug = canonicalizeSessionSlug(
    resolveSurveyResultsExplicitSessionSlug({
      search,
      sessionSlug,
      activeSessionSlug,
    }) ??
    routeSlug ??
    ''
  );
  const shouldFanOut = (
    !hasExplicitSessionQueryPin(search) &&
    String(viewMode || '').trim().toLowerCase() === 'questions'
  );

  let extraQuestionReadSlugs = [];
  const normalizedOverrideSlugs = Array.isArray(questionReadSlugsOverride)
    ? dedupeSessionSlugs(questionReadSlugsOverride).filter((slug) => slug !== baseSlug)
    : null;
  if (normalizedOverrideSlugs) {
    extraQuestionReadSlugs = normalizedOverrideSlugs;
  } else if (shouldFanOut) {
    const scopeMode = String(readSessionScanScope() || '').trim().toLowerCase();
    if (scopeMode === 'list') {
      extraQuestionReadSlugs = dedupeSessionSlugs(readSessionScanSlugs())
        .filter((slug) => slug !== baseSlug);
    } else if (scopeMode === 'all') {
      extraQuestionReadSlugs = dedupeSessionSlugs(getAllSessionSlugs())
        .filter((slug) => slug !== baseSlug);
    }
  }

  const questionReadSlugs = dedupeSessionSlugs([baseSlug, ...extraQuestionReadSlugs]);

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
} = {}) => {
  const sid = toStr(surveyId).trim().toLowerCase();
  if (!sid) return '';

  const entries = Array.isArray(surveyCacheEntries) ? surveyCacheEntries : [];
  for (const entry of entries) {
    const slug = canonicalizeSessionSlug(entry?.slug || '');
    const cache = isObj(entry?.value) ? entry.value : {};
    for (const netKey in cache) {
      if (!Object.prototype.hasOwnProperty.call(cache, netKey)) continue;
      const bucket = isObj(cache[netKey]) ? cache[netKey] : null;
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
} = {}) => {
  return resolveSurveyResultsSessionContext({
    surveyId,
    surveyCacheEntries,
    sessionSlug,
    activeSessionSlug,
  }).sessionSlug || '';
};

export const resolveSurveyResultsSessionContext = ({
  resolveBySlug,
  ...input
} = {}) => {
  const source = (
    buildSurveyResultsExplicitSessionSource(input) ||
    {
      sessionSlug: scanSurveyResultsSessionSlugFromCache({
        surveyId: input.surveyId,
        surveyCacheEntries: input.surveyCacheEntries,
      }),
    }
  );

  return resolveCanonicalSessionConfig({
    source,
    resolveBySlug,
  });
};
