/** @file surveyToolUtils.js */

import {
  getAllSessionSlugs,
  getSessionSlugByName,
} from '../../utilities/web3/contractScripts.js';
import { createLogger } from 'utilities/logging.js';
import {
  normalizeRatingValue,
  RATING_MIN,
} from '../../utilities/survey/ratingValue.js';
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


export const areEnvelopesEquivalent = (envA, envB, isEncryptedA = false, isEncryptedB = false) => {
  const a = typeof envA === 'string' ? envA : '';
  const b = typeof envB === 'string' ? envB : '';
  if (a && b) return a === b;
  if (!a && !b) return !!isEncryptedA && !!isEncryptedB;
  return false;
};

function mergeDecryptedViewedResponseField(prevResp, latestResp, fieldKey) {
  const prev = (prevResp && typeof prevResp === 'object') ? prevResp : null;
  const next = (latestResp && typeof latestResp === 'object') ? latestResp : null;
  if (!prev || !next) return latestResp;

  const prevField = (prev[fieldKey] && typeof prev[fieldKey] === 'object') ? prev[fieldKey] : {};
  const nextField = (next[fieldKey] && typeof next[fieldKey] === 'object') ? next[fieldKey] : {};

  // Preserve decrypted display values if a later refresh reintroduces the masked '*' payload.
  // We only do this when the ciphertext/envelope matches, so we don't show stale decrypted data.
  const prevValue = prevField.value;
  const nextValue = nextField.value;
  const prevEnv = typeof prevField.encryptedPortion === 'string' ? prevField.encryptedPortion : '';
  const nextEnv = typeof nextField.encryptedPortion === 'string' ? nextField.encryptedPortion : '';
  const prevIsDecrypted = prevValue !== '*' && prevValue !== undefined && prevValue !== null;
  const nextIsMasked = nextValue === '*' && (!!nextField.encrypted || !!nextEnv);

  if (!prevIsDecrypted || !nextIsMasked) return latestResp;
  if (!areEnvelopesEquivalent(prevEnv, nextEnv, prevField.encrypted, nextField.encrypted)) return latestResp;

  return {
    ...latestResp,
    [fieldKey]: {
      ...nextField,
      value: prevValue,
    },
  };
}

function mergeDecryptedViewedResponseRating(prevResp, latestResp, ratingKey, envelopeKey) {
  const prev = (prevResp && typeof prevResp === 'object') ? prevResp : null;
  const next = (latestResp && typeof latestResp === 'object') ? latestResp : null;
  if (!prev || !next) return latestResp;

  const prevValue = prev[ratingKey];
  const nextValue = next[ratingKey];
  const prevEnv = typeof prev[envelopeKey] === 'string' ? prev[envelopeKey] : '';
  const nextEnv = typeof next[envelopeKey] === 'string' ? next[envelopeKey] : '';

  const prevIsDecrypted =
    prevValue !== '*' &&
    prevValue !== undefined &&
    prevValue !== null &&
    typeof prevValue !== 'object';
  const nextIsMasked =
    (nextValue === '*' || nextValue === undefined || nextValue === null) &&
    !!nextEnv;

  if (!prevIsDecrypted || !nextIsMasked) return latestResp;
  if (!prevEnv || !nextEnv || prevEnv !== nextEnv) return latestResp;

  return { ...latestResp, [ratingKey]: prevValue };
}

function mergeDecryptedViewedResponse(prevViewed, latestViewed) {
  const prev = (prevViewed && typeof prevViewed === 'object') ? prevViewed : null;
  const next = (latestViewed && typeof latestViewed === 'object') ? latestViewed : null;
  if (!prev || !next) return latestViewed;

  // Survey responses: merge per-question entries.
  if (Array.isArray(next.responses) && Array.isArray(prev.responses)) {
    const prevByQid = new Map();
    prev.responses.forEach((r) => {
      const id = String(r?.questionID || r?.questionId || '').trim().toLowerCase();
      if (id) prevByQid.set(id, r);
    });
    const mergedResponses = next.responses.map((r) => {
      const id = String(r?.questionID || r?.questionId || '').trim().toLowerCase();
      const prevResp = id ? prevByQid.get(id) : null;
      let merged = mergeDecryptedViewedResponseField(prevResp, r, 'answer');
      merged = mergeDecryptedViewedResponseField(prevResp, merged, 'additional');
      merged = mergeDecryptedViewedResponseRating(prevResp, merged, 'importance', 'importanceEncrypted');
      merged = mergeDecryptedViewedResponseRating(prevResp, merged, 'conviction', 'convictionEncrypted');
      return merged;
    });
    return { ...next, responses: mergedResponses };
  }

  // Single question response object.
  let merged = mergeDecryptedViewedResponseField(prev, next, 'answer');
  merged = mergeDecryptedViewedResponseField(prev, merged, 'additional');
  merged = mergeDecryptedViewedResponseRating(prev, merged, 'importance', 'importanceEncrypted');
  merged = mergeDecryptedViewedResponseRating(prev, merged, 'conviction', 'convictionEncrypted');
  return merged;
}

const toNumberOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const getNormalizedUiRatingValue = (value) => {
  const normalizedValue = normalizeRatingValue(value, RATING_MIN);
  return normalizedValue == null ? RATING_MIN : normalizedValue;
};

const clampSliderValue = (value, min, max) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return min;
  return Math.min(max, Math.max(min, numericValue));
};

const getConvictionFromResponse = (resp) => {
  if (!resp || typeof resp !== 'object') return null;
  if (resp.conviction !== undefined && resp.conviction !== null) {
    return toNumberOrNull(resp.conviction);
  }
  if (resp.importance !== undefined && resp.importance !== null) {
    return toNumberOrNull(resp.importance);
  }
  return null;
};

const getImportanceFromResponse = (resp) => {
  if (!resp || typeof resp !== 'object') return null;
  if (resp.importance !== undefined && resp.importance !== null) {
    return toNumberOrNull(resp.importance);
  }
  return null;
};

// Build a set of qids whose on-chain payload already stores rating fields in envelopes.
// This is needed so UI "encrypted change" stats match submit behavior, which preserves
// and re-encrypts rating envelopes even when answer/additional are plaintext.
const buildRatingEnvelopeQidSetFromUserAnswers = (userAnswers) => {
  const out = new Set();
  try {
    const src = (userAnswers && typeof userAnswers === 'object') ? userAnswers : null;
    const list = src
      ? (Array.isArray(src.responses) ? src.responses : [src])
      : [];
    list.forEach((r) => {
      const id = String(r?.questionID || r?.questionId || r?.questionIDHash || '').trim().toLowerCase();
      if (!id) return;
      const impEnv = (typeof r?.importanceEncrypted === 'string') ? r.importanceEncrypted : '';
      const convEnv = (typeof r?.convictionEncrypted === 'string') ? r.convictionEncrypted : '';
      if (impEnv || convEnv) out.add(id);
    });
  } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  return out;
};

const getConvictionFromSlice = (slice, qid) => {
  if (!slice || !qid) return null;
  if (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid)) {
    return toNumberOrNull(slice.conviction[qid]);
  }
  if (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid)) {
    return toNumberOrNull(slice.importance[qid]);
  }
  return null;
};

const getConvictionFromSliceStrict = (slice, qid) => {
  if (!slice || !qid) return null;
  if (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid)) {
    return toNumberOrNull(slice.conviction[qid]);
  }
  return null;
};

const getImportanceFromSlice = (slice, qid) => {
  if (!slice || !qid) return null;
  if (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid)) {
    return toNumberOrNull(slice.importance[qid]);
  }
  return null;
};

// Multichoice answers may be stored as a string or array; normalize for UI logic.
const normalizeMultichoiceValue = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

// singleSelect enforces one option even though the UI uses checkboxes for consistency.
const isSingleSelectMultichoice = (question) => {
  if (!question || question.type !== 'multichoice') return false;
  return !!(question.singleSelect || question.oneSelectionOnly || question.singleChoice);
};

const normalizeQuestionIdKey = (value) => String(value || '').trim().toLowerCase();

const mixFnvHashText = (hash, input) => {
  let next = hash >>> 0;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
};

const SLICE_TOKEN_HASH_SEED_PRIMARY = 2166136261;
const SLICE_TOKEN_HASH_SEED_SECONDARY = 2246822519;
const SLICE_TOKEN_MAX_DEPTH = 24;

const buildTextHashToken = (prefix, value) => {
  const text = String(value || '');
  const primary = mixFnvHashText(SLICE_TOKEN_HASH_SEED_PRIMARY, text);
  const secondary = mixFnvHashText(
    SLICE_TOKEN_HASH_SEED_SECONDARY,
    `${text.length}|${text}`
  );
  return `${prefix}:${text.length}:${primary >>> 0}:${secondary >>> 0}`;
};

const buildSliceTokenInternal = (value, depth, traversal) => {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'string') {
    return buildTextHashToken('s', value);
  }
  if (typeof value === 'number') return `d:${Number.isNaN(value) ? 'NaN' : String(value)}`;
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0';
  if (typeof value === 'bigint') return `bi:${String(value)}`;
  if (value instanceof Date) return `dt:${Number(value.getTime() || 0)}`;
  if (Array.isArray(value)) {
    if (depth >= SLICE_TOKEN_MAX_DEPTH) {
      return `a:${value.length}:max-depth`;
    }
    let primary = SLICE_TOKEN_HASH_SEED_PRIMARY;
    let secondary = SLICE_TOKEN_HASH_SEED_SECONDARY;
    for (let i = 0; i < value.length; i += 1) {
      const entryToken = buildSliceTokenInternal(value[i], depth + 1, traversal);
      primary = mixFnvHashText(primary, `i:${i}`);
      primary = mixFnvHashText(primary, entryToken);
      secondary = mixFnvHashText(secondary, entryToken);
      secondary = mixFnvHashText(secondary, `i:${i}:${entryToken.length}`);
    }
    return `a:${value.length}:${primary >>> 0}:${secondary >>> 0}`;
  }
  if (typeof value === 'object') {
    if (traversal.seen.has(value)) return 'c';
    if (depth >= SLICE_TOKEN_MAX_DEPTH) {
      const keysAtDepth = Object.keys(value).sort();
      return buildTextHashToken('o-depth', keysAtDepth.join('|'));
    }
    traversal.seen.add(value);
    try {
      const keys = Object.keys(value).sort();
      let primary = SLICE_TOKEN_HASH_SEED_PRIMARY;
      let secondary = SLICE_TOKEN_HASH_SEED_SECONDARY;
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const entryToken = buildSliceTokenInternal(value[key], depth + 1, traversal);
        primary = mixFnvHashText(primary, `k:${key}`);
        primary = mixFnvHashText(primary, entryToken);
        secondary = mixFnvHashText(secondary, `${key}:${entryToken.length}`);
        secondary = mixFnvHashText(secondary, entryToken);
      }
      return `o:${keys.length}:${primary >>> 0}:${secondary >>> 0}`;
    } finally {
      traversal.seen.delete(value);
    }
  }
  return `${typeof value}:${String(value)}`;
};

const buildSliceToken = (value) => (
  buildSliceTokenInternal(value, 0, { seen: new WeakSet() })
);

const buildResponseFieldToken = (field) => {
  if (!field || typeof field !== 'object') {
    return `p:${buildSliceToken(field)}`;
  }
  return [
    `v:${buildSliceToken(field.value)}`,
    `e:${field.encrypted ? 1 : 0}`,
    `ep:${buildSliceToken(field.encryptedPortion)}`,
    `a:${buildSliceToken(field.encryptionAudience)}`,
    `g:${buildSliceToken(field.encryptionGateId)}`,
    `m:${buildSliceToken(field.audienceMode)}`,
  ].join('|');
};

const buildQuestionMapSignature = (map, { responseField = false, normalizedIdFilter = null } = {}) => {
  if (!map || typeof map !== 'object') return '0:0:0';
  const keys = Object.keys(map).sort();
  if (keys.length === 0) return '0:0:0';
  const filterSet = normalizedIdFilter instanceof Set ? normalizedIdFilter : null;
  let hash = 2166136261;
  let hashSecondary = 2246822519;
  let includedCount = 0;
  for (let i = 0; i < keys.length; i += 1) {
    const rawKey = keys[i];
    const normalizedKey = normalizeQuestionIdKey(rawKey);
    if (filterSet && (!normalizedKey || !filterSet.has(normalizedKey))) continue;
    includedCount += 1;
    hash = mixFnvHashText(hash, normalizedKey);
    hashSecondary = mixFnvHashText(hashSecondary, `${normalizedKey.length}:${normalizedKey}`);
    const value = map[rawKey];
    const token = responseField ? buildResponseFieldToken(value) : buildSliceToken(value);
    hash = mixFnvHashText(hash, token);
    hashSecondary = mixFnvHashText(hashSecondary, `${token.length}:${token}`);
  }
  if (includedCount === 0) return '0:0:0';
  return `${includedCount}:${hash >>> 0}:${hashSecondary >>> 0}`;
};

const buildSurveyResponseSliceSignature = (slice = {}, { normalizedIdFilter = null } = {}) => {
  const safeSlice = (slice && typeof slice === 'object') ? slice : {};
  return [
    buildQuestionMapSignature(safeSlice.answers, { responseField: true, normalizedIdFilter }),
    buildQuestionMapSignature(safeSlice.additionalComments, { responseField: true, normalizedIdFilter }),
    buildQuestionMapSignature(safeSlice.importance, { normalizedIdFilter }),
    buildQuestionMapSignature(safeSlice.conviction, { normalizedIdFilter }),
  ].join('|');
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

const buildRenderedIdsSignature = (ids = []) => (
  Array.isArray(ids)
    ? ids
      .map((id) => normalizeQuestionIdKey(id))
      .filter(Boolean)
      .join('|')
    : ''
);

const buildQuestionIdScopeSignature = (list = []) => (
  Array.isArray(list)
    ? Array.from(new Set(
      list
        .map((question) => String(question?.id || '').trim().toLowerCase())
        .filter(Boolean)
    )).sort().join('|')
    : ''
);

export {
  surveyLog,
  GATE_SBT_HYDRATION_RETRY_MS,
  SHOW_PILE_HOLOGRAM_TOGGLE,
  QUESTION_TAG_DROPDOWN_ROW_STYLE,
  isSurveyPerfCountersEnabled,
  bumpSurveyPerfCounter,
  scheduleMicrotask,
  mergeDecryptedViewedResponse,
  toNumberOrNull,
  getNormalizedUiRatingValue,
  clampSliderValue,
  getConvictionFromResponse,
  getImportanceFromResponse,
  buildRatingEnvelopeQidSetFromUserAnswers,
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  getImportanceFromSlice,
  normalizeMultichoiceValue,
  isSingleSelectMultichoice,
  normalizeQuestionIdKey,
  buildSliceToken,
  buildSurveyResponseSliceSignature,
  formatQuestionScanBlockCount,
  serializeSurveyToolFilterState,
  isSurveyToolFilterStateActive,
  DEBUG_PREFILL,
  EMPTY_QUESTION_POOL,
  buildRenderedIdsSignature,
  buildQuestionIdScopeSignature,
};
