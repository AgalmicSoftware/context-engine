import { getAllSessionSlugs, getSessionSlugByName } from '../../utilities/web3/contractScripts.js';
import { readQuestionsCacheRef, readSurveysCacheRef } from './surveyToolCacheState.js';
import { resolveEffectiveSlug, resolveIdLookupContext } from './surveyToolScope.js';

type UnknownRecord = Record<string, unknown>;

type ResolveSlugForIdsArgs = {
  sessionName?: unknown;
  questionId?: unknown;
  surveyId?: unknown;
  props?: UnknownRecord | null;
  network?: UnknownRecord | null;
};

/**
 * Cross-cache slug discovery for question/survey IDs.
 * Prefers explicit sessionName → slug; else scans per-group caches on current network; else falls back.
 */
export function resolveSlugForIds({
  sessionName,
  questionId,
  surveyId,
  props = {},
  network = null,
}: ResolveSlugForIdsArgs = {}): string {
  const sessionNameOrLegacy = sessionName;
  const byName = getSessionSlugByName(sessionNameOrLegacy as string | null | undefined);
  if (byName !== null && byName !== undefined) return byName;

  const qLower = questionId ? String(questionId).toLowerCase() : null;
  const sLower = surveyId ? String(surveyId).toLowerCase() : null;

  if (!qLower && !sLower) {
    return resolveEffectiveSlug(props || {});
  }

  const candidateSlugs = new Set(getAllSessionSlugs().map((slug) => String(slug).toLowerCase()));

  for (const slug of candidateSlugs) {
    const idLookupContext = resolveIdLookupContext({
      props: props || {},
      network,
      sessionSlug: slug,
    });
    const netIdStr = idLookupContext.networkIdStr || '';

    const questionCache = readQuestionsCacheRef(slug) || {};
    const networkQuestions = netIdStr ? questionCache?.[netIdStr] || null : null;
    if (qLower && networkQuestions && networkQuestions.questions && networkQuestions.questions[qLower]) {
      return slug;
    }

    const surveyCache = readSurveysCacheRef(slug) || {};
    const networkSurveys = netIdStr ? surveyCache?.[netIdStr] || null : null;
    if (networkSurveys && networkSurveys.surveys) {
      if (sLower && networkSurveys.surveys[sLower]) {
        const mapped = getSessionSlugByName(networkSurveys.surveys[sLower]?.sessionName);
        return mapped ?? slug;
      }
      if (!sLower && qLower) {
        for (const survey of Object.values(networkSurveys.surveys)) {
          const ids = Array.isArray((survey as UnknownRecord)?.questionIDs)
            ? ((survey as UnknownRecord).questionIDs as unknown[]).map((value) => String(value).toLowerCase())
            : [];
          if (ids.includes(qLower)) {
            const mapped = getSessionSlugByName((survey as UnknownRecord)?.sessionName);
            return mapped ?? slug;
          }
        }
      }
    }
  }

  return resolveEffectiveSlug(props || {});
}
