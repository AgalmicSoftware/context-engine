export type GroupSlugLookupRecord = Record<string, unknown>;

export interface GroupSlugLookupDeps {
  getCurrentSlug: () => string;
  getQueryHintSlug: () => string | null;
  isCacheManagerReady: boolean;
  getSessionCfg: (slug: string) => GroupSlugLookupRecord | null | undefined;
  dgRead: (collection: string, slug: string) => GroupSlugLookupRecord | null | undefined;
  resolveMetadataSessionSlug: (metadata: unknown, fallbackSlug: string) => string;
  getAllSessionSlugs: () => string[];
  normalizeSessionSlug: (s: string) => string;
  getReferrerSlug?: () => string | null;
  warn?: (error: unknown) => void;
}

export interface QuestionGroupSlugLookupDeps extends GroupSlugLookupDeps {
  isKnownOrGeneralSessionSlug: (slug: string) => boolean;
}

export interface SbtSlugResolveDeps {
  fallbackSlug: string;
  isValidAddress: (addr: string) => boolean;
  getSessionScanScope: () => string;
  getScopedSessionSlugs: (scope: string) => string[];
  getAllSessionSlugs: () => string[];
  dgRead: (collection: string, slug: string) => GroupSlugLookupRecord | null | undefined;
  getSbtMetadata: (
    provider: string,
    address: string,
    slug: string,
  ) => Promise<GroupSlugLookupRecord | null | undefined>;
  getSbtCreationBlockByAddress: (provider: string, address: string, slug: string) => Promise<number | null>;
  normalizeSessionSlug: (s: string) => string;
  getSessionSlugByName: (name: unknown) => string | null;
  getSessionConfigBySlugOrDefault: (slug: string) => GroupSlugLookupRecord | null | undefined;
  resolveMetadataSessionSlug: (metadata: unknown, fallbackSlug: string) => string;
  warn?: (error: unknown) => void;
}

type WarnableDeps = {
  warn?: (error: unknown) => void;
};

const emitWarn = (deps: WarnableDeps, error: unknown): void => {
  if (typeof deps.warn === 'function') deps.warn(error);
};

const isLookupRecord = (value: unknown): value is GroupSlugLookupRecord => value !== null && typeof value === 'object';

const asLookupRecord = (value: unknown): GroupSlugLookupRecord | null => (isLookupRecord(value) ? value : null);

function parseReferrerSlug(deps: Pick<GroupSlugLookupDeps, 'normalizeSessionSlug' | 'warn'>): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null;
  try {
    const match = document.referrer.match(/\/session\/([^/?#]+)/);
    if (match && match[1]) return deps.normalizeSessionSlug(match[1].trim());
  } catch (error) {
    emitWarn(deps, error);
  }
  return null;
}

const readReferrerSlugCandidate = (deps: GroupSlugLookupDeps): string | null => {
  try {
    const getter = typeof deps.getReferrerSlug === 'function' ? deps.getReferrerSlug : () => parseReferrerSlug(deps);
    return getter();
  } catch (error) {
    emitWarn(deps, error);
    return null;
  }
};

const getCachedSurveySlug = (surveyIdLower: string, slug: string, deps: GroupSlugLookupDeps): string | null => {
  const cfg = asLookupRecord(deps.getSessionCfg(slug));
  const highlightedSurveyIds = cfg?.HIGHLIGHTED_SURVEY_IDS;
  if (
    Array.isArray(highlightedSurveyIds) &&
    highlightedSurveyIds.some((id) => String(id).toLowerCase() === surveyIdLower)
  ) {
    return slug;
  }

  const cache = asLookupRecord(deps.dgRead('surveysCache', slug));
  if (cache) {
    for (const netKey of Object.keys(cache)) {
      const networkCache = asLookupRecord(cache[netKey]);
      const surveys = asLookupRecord(networkCache?.surveys);
      const cachedSurvey = surveys?.[surveyIdLower];
      if (cachedSurvey) {
        return deps.resolveMetadataSessionSlug(cachedSurvey, slug);
      }
    }
  }

  return null;
};

const getCachedQuestionSlug = (questionIdLower: string, slug: string, deps: GroupSlugLookupDeps): string | null => {
  const questionsCache = asLookupRecord(deps.dgRead('questionsCache', slug));
  if (questionsCache) {
    for (const netKey of Object.keys(questionsCache)) {
      const networkCache = asLookupRecord(questionsCache[netKey]);
      const questions = asLookupRecord(networkCache?.questions);
      const cachedQuestion = questions?.[questionIdLower];
      if (cachedQuestion) {
        return deps.resolveMetadataSessionSlug(cachedQuestion, slug);
      }
    }
  }

  const surveysCache = asLookupRecord(deps.dgRead('surveysCache', slug));
  if (surveysCache) {
    for (const netKey of Object.keys(surveysCache)) {
      const networkCache = asLookupRecord(surveysCache[netKey]);
      const surveys = asLookupRecord(networkCache?.surveys);
      if (!surveys) continue;
      for (const surveyValue of Object.values(surveys)) {
        const survey = asLookupRecord(surveyValue);
        const questionIDs = survey?.questionIDs;
        if (!Array.isArray(questionIDs)) continue;
        for (let index = 0; index < questionIDs.length; index += 1) {
          if (String(questionIDs[index] || '').toLowerCase() === questionIdLower) {
            return deps.resolveMetadataSessionSlug(survey, slug);
          }
        }
      }
    }
  }

  return null;
};

export function findGroupSlugForSurvey(surveyID: string | null | undefined, deps: GroupSlugLookupDeps): string {
  if (!surveyID) return deps.getCurrentSlug();
  const surveyIdLower = String(surveyID).toLowerCase();

  const currentSlug = deps.getCurrentSlug();
  const queryHintSlug = deps.getQueryHintSlug();

  if (queryHintSlug !== null) {
    const hintedCachedSlug = getCachedSurveySlug(surveyIdLower, queryHintSlug, deps);
    if (hintedCachedSlug !== null) return hintedCachedSlug;
    const cfg = deps.getSessionCfg(queryHintSlug);
    const isKnown = !!(cfg && !cfg.__unresolved);
    if (isKnown || !deps.isCacheManagerReady) {
      return queryHintSlug;
    }
  }

  const currentCachedSlug = getCachedSurveySlug(surveyIdLower, currentSlug, deps);
  if (currentCachedSlug !== null) return currentCachedSlug;

  let refSlugCandidate: string | null = null;
  let refSlug: string | null = null;
  try {
    refSlugCandidate = readReferrerSlugCandidate(deps);
    refSlug = refSlugCandidate != null && deps.getSessionCfg(refSlugCandidate) ? refSlugCandidate : null;
  } catch (error) {
    emitWarn(deps, error);
  }
  if (refSlugCandidate != null) {
    const refCachedSlug = getCachedSurveySlug(surveyIdLower, refSlugCandidate, deps);
    if (refCachedSlug !== null) return refCachedSlug;
  }

  for (const slug of deps.getAllSessionSlugs()) {
    if (slug === currentSlug || slug === refSlugCandidate) continue;
    const cachedSlug = getCachedSurveySlug(surveyIdLower, slug, deps);
    if (cachedSlug !== null) return cachedSlug;
  }

  return refSlug !== null ? refSlug : currentSlug;
}

export function findGroupSlugForQuestion(
  questionID: string | null | undefined,
  deps: QuestionGroupSlugLookupDeps,
): string {
  if (!questionID) return deps.getCurrentSlug();
  const questionIdLower = String(questionID).toLowerCase();
  const currentSlug = deps.getCurrentSlug();
  const querySlug = deps.getQueryHintSlug();

  const querySlugKnown = querySlug !== null && deps.isKnownOrGeneralSessionSlug(querySlug);
  if (querySlug !== null) {
    const hintedCachedSlug = getCachedQuestionSlug(questionIdLower, querySlug, deps);
    if (hintedCachedSlug !== null) return hintedCachedSlug;
    if (querySlugKnown || !deps.isCacheManagerReady) return querySlug;
  }

  const currentCachedSlug = getCachedQuestionSlug(questionIdLower, currentSlug, deps);
  if (currentCachedSlug !== null) return currentCachedSlug;

  let refSlugCandidate: string | null = null;
  let refSlug: string | null = null;
  try {
    refSlugCandidate = readReferrerSlugCandidate(deps);
    refSlug = refSlugCandidate != null && deps.getSessionCfg(refSlugCandidate) ? refSlugCandidate : null;
  } catch (error) {
    emitWarn(deps, error);
  }
  if (refSlugCandidate != null) {
    const refCachedSlug = getCachedQuestionSlug(questionIdLower, refSlugCandidate, deps);
    if (refCachedSlug !== null) return refCachedSlug;
  }

  for (const slug of deps.getAllSessionSlugs()) {
    if (slug === currentSlug || slug === refSlugCandidate) continue;
    const cachedSlug = getCachedQuestionSlug(questionIdLower, slug, deps);
    if (cachedSlug !== null) return cachedSlug;
  }

  return refSlug !== null ? refSlug : currentSlug;
}

export async function resolveGroupSlugForSbtAddress(
  sbtAddress: string | null | undefined,
  deps: SbtSlugResolveDeps,
): Promise<string> {
  const fallbackSlug = typeof deps.fallbackSlug === 'string' ? deps.fallbackSlug : '';
  const requestedAddress = String(sbtAddress || '');
  if (!requestedAddress || !deps.isValidAddress(requestedAddress)) return fallbackSlug;

  const addrLower = requestedAddress.toLowerCase();
  const scanScope = deps.getSessionScanScope();
  const scopedSlugs = scanScope === 'all' ? deps.getAllSessionSlugs() : deps.getScopedSessionSlugs(scanScope);

  try {
    for (const slug of scopedSlugs) {
      const cache = asLookupRecord(deps.dgRead('sbtCache', slug));
      if (!cache) continue;
      for (const netKey of Object.keys(cache || {})) {
        const networkCache = asLookupRecord(cache[netKey]);
        const sbtList = asLookupRecord(networkCache?.sbtList);
        const entryValue = sbtList?.[addrLower];
        if (entryValue) {
          const entry = asLookupRecord(entryValue);
          return entry?.slug != null ? (entry.slug as string) : slug;
        }
      }
    }
  } catch (error) {
    emitWarn(deps, error);
  }

  try {
    const meta = asLookupRecord(await deps.getSbtMetadata('none', requestedAddress, fallbackSlug));
    const hasExplicitSessionSlug = !!(
      meta &&
      Object.prototype.hasOwnProperty.call(meta, 'sessionSlug') &&
      meta.sessionSlugExplicit === true
    );
    if (hasExplicitSessionSlug) {
      return deps.normalizeSessionSlug(String(meta.sessionSlug || ''));
    }
    const slugFromName = deps.getSessionSlugByName(meta?.sessionName);
    if (slugFromName != null) return slugFromName;
  } catch (error) {
    emitWarn(deps, error);
  }

  if (scanScope !== 'all') {
    const scoped = scopedSlugs;
    if (!Array.isArray(scoped) || !scoped.length) return fallbackSlug;
    if (scanScope !== 'list') return scoped[0];

    for (const scopedSlug of scoped) {
      try {
        const creationBlock = await deps.getSbtCreationBlockByAddress('none', requestedAddress, scopedSlug);
        if (Number.isFinite(creationBlock)) return scopedSlug;
      } catch (error) {
        emitWarn(deps, error);
      }
    }
    return scoped[0];
  }

  try {
    const sorted = deps
      .getAllSessionSlugs()
      .map((slug) => {
        const cfg = asLookupRecord(deps.getSessionConfigBySlugOrDefault(slug));
        const blockLimits = asLookupRecord(cfg?.blockLimits);
        const startRaw = Number(blockLimits?.start);
        const start = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : -1;
        return { slug, start };
      })
      .sort((a, b) => (Number(b.start) || 0) - (Number(a.start) || 0));

    for (const { slug } of sorted) {
      const creationBlock = await deps.getSbtCreationBlockByAddress('none', requestedAddress, slug);
      if (Number.isFinite(creationBlock)) return slug;
    }
  } catch (error) {
    emitWarn(deps, error);
  }

  return fallbackSlug;
}
