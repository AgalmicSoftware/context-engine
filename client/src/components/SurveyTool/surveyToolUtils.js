/** @file surveyToolUtils.js */

import {
  getAllSessionSlugs,
  getSessionSlugByName,
} from '../../utilities/web3/contractScripts.js';
import { createLogger } from 'utilities/logging.js';
import {
  formatQuestionScanBlockCount,
  isSurveyToolFilterStateActive,
  serializeSurveyToolFilterState,
} from './surveyToolViewState.js';
import {
  resolveEffectiveSlug,
  resolveIdLookupContext,
} from './surveyToolScope.js';
import {
  readQuestionsCacheRef,
  readSurveysCacheRef,
} from './surveyToolCacheState.js';
import {
  normalizeQuestionIdKey,
} from './surveyToolSignatures.js';
export {
  buildRatingEnvelopeQidSetFromUserAnswers,
  clampSliderValue,
  getConvictionFromResponse,
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  getImportanceFromResponse,
  getImportanceFromSlice,
  getNormalizedUiRatingValue,
  isSingleSelectMultichoice,
  normalizeMultichoiceValue,
  toNumberOrNull,
} from './surveyToolResponseState.js';
export {
  areEnvelopesEquivalent,
  mergeDecryptedViewedResponse,
} from './surveyToolResponseMerge.js';
export {
  buildQuestionIdScopeSignature,
  buildRenderedIdsSignature,
  buildSliceToken,
  buildSurveyResponseSliceSignature,
  normalizeQuestionIdKey,
} from './surveyToolSignatures.js';
export {
  areQuestionPayloadsEquivalent,
  canUseRecentQuestionPayloadForAccount,
  ensureQuestionsNet,
  ensureSurveysNet,
  hasCacheHydratedFlag,
  isIncomingResponseMetaNewer,
  mergeQuestionResponses,
  mergeSurveyResponsePayloads,
  readQuestionsCache,
  readQuestionsCacheAsync,
  readQuestionsCacheRef,
  readRecentQuestionPayload,
  readSurveysCache,
  readSurveysCacheAsync,
  readSurveysCacheRef,
  stampResponsePayloadWithMeta,
  toResponseRecencyMeta,
  writeQuestionsCache,
  writeSurveysCache,
} from './surveyToolCacheState.js';
export {
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
  hasExplicitSessionQueryPinInPath,
  readPathSearch,
} from './surveyToolNavigation.js';
export {
  buildSurveyDraftSemanticSignature,
  computeSubmitLabel,
  getPendingStatsSnapshotFromState,
  hasConvictionOrImportanceValueForQuestion,
  hasMeaningfulFieldValue,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
  shouldShowSingleQuestionResponseLookupSpinner,
  updateSubmittedSinceLastEdit,
} from './surveyToolDraftState.js';
export {
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  normalizeQuestionProgressSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
} from './surveyToolViewState.js';
export {
  buildQuestionCountScopeContextKey,
  buildQuestionDashboardLoadContextSignature,
  buildQuestionFilterStorageKeyPrefix,
  dedupeQuestionReadSlugs,
  getActiveSessionSlugFromProps,
  getBlockedQuestionIdsSet,
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
  getSessionSlugHintFromProps,
  getSessionSlugPinnedFromProps,
  normalizeSessionSlugValue,
  resolveCurrentTagSessionSlug,
  resolveDecryptHydrationContext,
  resolveDraftSessionContext,
  resolveDraftStorageContext,
  resolveEffectiveSlug,
  resolveEnsureQuestionCachedContext,
  resolveExplicitSessionContext,
  resolveIdLookupContext,
  resolveLockAudienceSessionNameContext,
  resolvePileFilterContext,
  resolvePileLoadContext,
  resolvePileResponseReadContext,
  resolvePileWarmSeedContext,
  resolveQuestionBootstrapContext,
  resolveQuestionCountContext,
  resolveQuestionPayloadCacheWriteContext,
  resolveQuestionReadCacheContext,
  resolveQuestionsDashboardLoadContext,
  resolveResponseHydrationContext,
  resolveResponseJsonContext,
  resolveSubmittedCacheWriteContext,
  resolveSurveyReadContext,
  resolveUpdateCacheContext,
  shouldInheritResolvedTagSessionScope,
} from './surveyToolScope.js';

const surveyLog = createLogger('surveys');
const GATE_SBT_HYDRATION_RETRY_MS = 45 * 1000;
const SURVEY_TOOL_PERF_SCOPE = 'surveyTool';
// Keep this dormant toggle path for PRD 135 voice-only interview mode.
// The pile hologram avatar is intentionally hidden for now, but the render/state
// plumbing stays in place so future voice-mode work can re-enable it cleanly.
const SHOW_PILE_HOLOGRAM_TOGGLE = false;
const QUESTION_TAG_DROPDOWN_ROW_STYLE = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '12px',
};

const isSurveyPerfCountersEnabled = () => {
  try {
    return typeof globalThis !== 'undefined' && (
      globalThis.ENABLE_CE_UI_PERF_STATS === true ||
      globalThis.ENABLE_CE_DEBUG_COUNTERS === true ||
      globalThis.__CE_DEBUG_COUNTERS__ === true
    );
  } catch (_) {
    return false;
  }
};

const bumpSurveyPerfCounter = (key, inc = 1) => {
  if (!isSurveyPerfCountersEnabled()) return;
  try {
    if (!globalThis.__CE_PERF_COUNTERS__ || typeof globalThis.__CE_PERF_COUNTERS__ !== 'object') {
      globalThis.__CE_PERF_COUNTERS__ = {};
    }
    if (
      !globalThis.__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE] ||
      typeof globalThis.__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE] !== 'object'
    ) {
      globalThis.__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE] = {};
    }
    const scope = globalThis.__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE];
    scope[key] = Number(scope[key] || 0) + Number(inc || 0);
  } catch (e) { void e; /* fallback: perf counter update. */ }
};

const scheduleMicrotask = (cb) => {
  if (typeof cb !== 'function') return;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(cb);
    return;
  }
  Promise.resolve().then(cb);
};


const hasQuestionMapValue = (map = {}, questionId = '') => {
  if (!map || typeof map !== 'object') return false;
  const rawKey = String(questionId || '');
  const normalizedKey = normalizeQuestionIdKey(questionId);
  const candidates = rawKey && normalizedKey && rawKey !== normalizedKey
    ? [rawKey, normalizedKey]
    : [rawKey || normalizedKey];
  for (const key of candidates) {
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
    const value = map[key];
    if (value === undefined || value === null) continue;
    return true;
  }
  return false;
};

/**
 * Cross-cache slug discovery for question/survey IDs.
 * Prefers explicit sessionName → slug; else scans per-group caches on current network; else falls back.
 *
 * @param {{ sessionName?: string|null, questionId?: string|null, surveyId?: string|null,
 *           props?: any, network?: any }} args
 * @returns {string} slug ('' = general)
 */
export function resolveSlugForIds({ sessionName, questionId, surveyId, props, network }) {
  const sessionNameOrLegacy = sessionName;
  // 1) Explicit group name mapping
  const byName = getSessionSlugByName(sessionNameOrLegacy);
  if (byName !== null && byName !== undefined) return byName;

  const qLower = questionId ? String(questionId).toLowerCase() : null;
  const sLower = surveyId ? String(surveyId).toLowerCase() : null;

  // Fast path: if no explicit IDs were provided, trust current route/session context.
  if (!qLower && !sLower) {
    return resolveEffectiveSlug(props);
  }

  // Candidate slugs: every group entry's .slug (or key), plus '' (general)
  const candSet = new Set(getAllSessionSlugs().map((s) => String(s).toLowerCase()));

  for (const slug of candSet) {
    const idLookupContext = resolveIdLookupContext({ props, network, sessionSlug: slug });
    const netIdStr = idLookupContext.networkIdStr || '';

    // Questions cache lookup
    const qc = readQuestionsCacheRef(slug) || {};
    const netQ = netIdStr ? (qc?.[netIdStr] || null) : null;
    if (qLower && netQ && netQ.questions && netQ.questions[qLower]) {
      return slug;
    }

    // Surveys cache lookup
    const sc = readSurveysCacheRef(slug) || {};
    const netS = netIdStr ? (sc?.[netIdStr] || null) : null;
    if (netS && netS.surveys) {
      // exact survey
      if (sLower && netS.surveys[sLower]) {
        const mapped = getSessionSlugByName(netS.surveys[sLower]?.sessionName);
        return (mapped ?? slug);
      }
      // any survey referencing the question
      if (!sLower && qLower) {
        for (const sv of Object.values(netS.surveys)) {
          const ids = Array.isArray(sv?.questionIDs)
            ? sv.questionIDs.map((x) => String(x).toLowerCase())
            : [];
          if (ids.includes(qLower)) {
            const mapped = getSessionSlugByName(sv?.sessionName);
            return (mapped ?? slug);
          }
        }
      }
    }
  }

  // Fallback to effective context slug (URL/Redux/prop)
  return resolveEffectiveSlug(props);
}









/**
 * Compute the submit button label in a baseline-aware way.
 * - Base label is always "Submit" (no "Encrypt /" prefix on mobile).
 * - Adds " (N)" only when N > 0.
 * - Accepts an optional suffix (e.g., "Response" / "Responses") which is appended to the base label.
 *
 * @param {{ getPendingEditStats?: Function, state?: { modifiedCount?: number, hasEncryptedChanges?: boolean } }} ctx
 * @param {{ suffix?: string }} opts
 * @returns {string} label
 */





const DEBUG_PREFILL = false; // set true to enable verbose local-cache prefill logs
const EMPTY_QUESTION_POOL = [];

export {
  surveyLog,
  GATE_SBT_HYDRATION_RETRY_MS,
  SHOW_PILE_HOLOGRAM_TOGGLE,
  QUESTION_TAG_DROPDOWN_ROW_STYLE,
  isSurveyPerfCountersEnabled,
  bumpSurveyPerfCounter,
  scheduleMicrotask,
  formatQuestionScanBlockCount,
  serializeSurveyToolFilterState,
  isSurveyToolFilterStateActive,
  DEBUG_PREFILL,
  EMPTY_QUESTION_POOL,
};
