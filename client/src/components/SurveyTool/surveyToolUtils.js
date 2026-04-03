/** @file surveyToolUtils.js */

import {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
  getSessionSlugByName,
} from '../../utilities/web3/contractScripts.js';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { createLogger } from 'utilities/logging.js';
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
import {
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import {
  peekCacheSync,
  readCache,
  writeCacheOptimistic,
} from '../../utilities/cache/cacheScripts.js';
import {
  normalizeRatingValue,
  RATING_MIN,
} from '../../utilities/survey/ratingValue.js';

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

const readPathSearch = (path = '') => {
  const value = String(path || '');
  const queryIndex = value.indexOf('?');
  return queryIndex >= 0 ? value.slice(queryIndex) : '';
};

const hasExplicitSessionQueryPinInPath = (path = '') => {
  const search = readPathSearch(path);
  return (
    parseQuestionSessionSlugFromSearch(search) !== null ||
    parseQuestionSessionIdFromSearch(search) !== null
  );
};

const appendExplicitSessionHintToPath = (pathIn = '', sessionSlugIn = '') => {
  const path = String(pathIn || '');
  const sessionSlug = normalizeSessionSlug(sessionSlugIn);
  if (!path || !sessionSlug || hasExplicitSessionQueryPinInPath(path)) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}session=${encodeURIComponent(sessionSlug)}`;
};





// Preserve an existing group prefix like "/<prefix>/<slug>" (e.g., "/session/edge")
// for any new app-relative path we want to push/replace into history.
function applyExistingGroupPrefix(newPath) {
  try {
    if (hasExplicitSessionQueryPinInPath(newPath)) return newPath;
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    const pathOnly = p.split('?')[0].split('#')[0];
    const segs = pathOnly.split('/').filter(Boolean);
    // Do not treat base app routes as group prefixes.
    const RESERVED = new Set(['questions','question','survey','surveys']);
    if (segs.length >= 2 && !RESERVED.has(segs[0])) {
      const base = `/${segs[0]}/${segs[1]}`;
      if (!newPath.startsWith(base)) {
        return `${base}${newPath.startsWith('/') ? '' : '/'}${newPath}`;
      }
    }
  } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  return newPath;
}

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

export const hasMeaningfulFieldValue = (field = {}) => {
  if (!field || typeof field !== 'object') return false;
  const val = field.value;
  if (val === '*') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (val && typeof val === 'object') return Object.keys(val).length > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  return false;
};

const buildStableDraftValueSignature = (value) => {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'string') return `s:${value}`;
  if (typeof value === 'number') return `d:${Number.isNaN(value) ? 'NaN' : String(value)}`;
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0';
  if (Array.isArray(value)) {
    return `a:[${value.map((item) => buildStableDraftValueSignature(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `o:{${keys.map((key) => `${key}:${buildStableDraftValueSignature(value[key])}`).join('|')}}`;
  }
  return `${typeof value}:${String(value)}`;
};

export const buildSurveyDraftSemanticSignature = (payload = {}) => {
  const meta = (payload && typeof payload === 'object' && payload.meta && typeof payload.meta === 'object')
    ? payload.meta
    : {};
  const answers = (payload && typeof payload === 'object' && payload.answers && typeof payload.answers === 'object')
    ? payload.answers
    : {};
  const baseline = (payload && typeof payload === 'object' && payload.baseline && typeof payload.baseline === 'object')
    ? payload.baseline
    : {};
  const questionIds = Object.keys(answers)
    .map((qid) => String(qid || ''))
    .filter(Boolean)
    .sort();
  // Regression guard: baseline-only changes must alter draft signature too.
  // If we hash only answers, decrypt-only refresh can remask baseline and show false pending edits.
  const baselineIds = Object.keys(baseline)
    .map((qid) => String(qid || ''))
    .filter(Boolean)
    .sort();
  const parts = [
    `network:${meta.networkId == null ? '' : String(meta.networkId)}`,
    `survey:${meta.surveyId == null ? '' : String(meta.surveyId)}`,
    `count:${questionIds.length}`,
    `bcount:${baselineIds.length}`,
  ];
  questionIds.forEach((qid) => {
    const answerEntry = (answers[qid] && typeof answers[qid] === 'object') ? answers[qid] : {};
    parts.push(`qid:${qid}`);
    parts.push(`value:${buildStableDraftValueSignature(answerEntry.value)}`);
    parts.push(`answerEncrypted:${buildStableDraftValueSignature(answerEntry.answerEncrypted)}`);
    parts.push(`answerAudience:${buildStableDraftValueSignature(answerEntry.answerEncryptionAudience)}`);
    parts.push(`answerGateId:${buildStableDraftValueSignature(answerEntry.answerEncryptionGateId)}`);
    parts.push(`answerAudienceMode:${buildStableDraftValueSignature(answerEntry.answerAudienceMode)}`);
    parts.push(`answerEncryptedPortion:${buildStableDraftValueSignature(answerEntry.answerEncryptedPortion)}`);
    parts.push(`additional:${buildStableDraftValueSignature(answerEntry.additional)}`);
    parts.push(`additionalEncrypted:${buildStableDraftValueSignature(answerEntry.additionalEncrypted)}`);
    parts.push(`additionalAudience:${buildStableDraftValueSignature(answerEntry.additionalEncryptionAudience)}`);
    parts.push(`additionalGateId:${buildStableDraftValueSignature(answerEntry.additionalEncryptionGateId)}`);
    parts.push(`additionalAudienceMode:${buildStableDraftValueSignature(answerEntry.additionalAudienceMode)}`);
    parts.push(`additionalEncryptedPortion:${buildStableDraftValueSignature(answerEntry.additionalEncryptedPortion)}`);
    parts.push(`importance:${buildStableDraftValueSignature(answerEntry.importance)}`);
    parts.push(`conviction:${buildStableDraftValueSignature(answerEntry.conviction)}`);
  });
  baselineIds.forEach((qid) => {
    const baselineEntry = (baseline[qid] && typeof baseline[qid] === 'object') ? baseline[qid] : {};
    parts.push(`bqid:${qid}`);
    parts.push(`bvalue:${buildStableDraftValueSignature(baselineEntry.value)}`);
    parts.push(`banswerEncryptedPortion:${buildStableDraftValueSignature(baselineEntry.answerEncryptedPortion)}`);
    parts.push(`badditional:${buildStableDraftValueSignature(baselineEntry.additional)}`);
    parts.push(`badditionalEncryptedPortion:${buildStableDraftValueSignature(baselineEntry.additionalEncryptedPortion)}`);
  });
  return parts.join('||');
};

export const shouldForceOverwriteDraftValues = ({
  forceOverwrite = false,
  isDirty = false,
  pendingTotal = 0,
  submittedStateActive = false,
} = {}) => (
  !!forceOverwrite && (
    !!isDirty ||
    Number(pendingTotal || 0) > 0 ||
    !submittedStateActive
  )
);

export const updateSubmittedSinceLastEdit = (prevValue = false, transition = '') => {
  const mode = String(transition || '').trim().toLowerCase();
  if (mode === 'submit_success') return true;
  if (mode === 'user_edit' || mode === 'reset' || mode === 'submit_error') return false;
  return !!prevValue;
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

export const hasConvictionOrImportanceValueForQuestion = (slice = {}, questionId = '') => (
  hasQuestionMapValue(slice?.conviction || {}, questionId) ||
  hasQuestionMapValue(slice?.importance || {}, questionId)
);

export const shouldAutoEncryptAdditionalOnAudienceChange = (field = {}) => (
  hasMeaningfulFieldValue(field)
);

export const shouldEncryptResponseFieldForSubmit = (field = {}) => (
  !!field &&
  field.encrypted === true &&
  field.value !== '*' &&
  hasMeaningfulFieldValue(field)
);


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



const normalizeSessionSlugValue = (rawSlug) => normalizeSessionSlug(rawSlug);

const getSessionSlugHintFromProps = (props = {}) => (
  resolveSessionAliases(props).sessionSlug
);

const getActiveSessionSlugFromProps = (props = {}) => (
  resolveSessionAliases(props).activeSessionSlug
);

const getSessionSlugPinnedFromProps = (props = {}) => (
  resolveSessionAliases(props).sessionSlugPinned
);

const shouldInheritResolvedTagSessionScope = (props = {}) => {
  if (getSessionSlugPinnedFromProps(props)) return true;

  const pathname = (
    typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string'
      ? window.location.pathname
      : ''
  );
  if (resolveSessionSlugFromPathname(pathname) !== null) return true;
  if (props.singleQuestionMode) return false;

  return String(props.surveyID || props.surveyId || '').trim() !== '';
};

const resolveCurrentTagSessionSlug = ({ props = {}, state = {}, getEffectiveDraftSlug = null } = {}) => {
  if (getSessionSlugPinnedFromProps(props)) {
    return normalizeSessionSlugValue(props.sessionSlug || '');
  }
  if (state?.localSessionOverrideTouched) {
    return normalizeSessionSlugValue(state.localSessionOverrideSlug);
  }
  const explicitQuerySessionSlug = (
    typeof window !== 'undefined'
      ? parseQuestionSessionSlugFromSearch(window.location?.search || '')
      : null
  );
  if (explicitQuerySessionSlug !== null) {
    return normalizeSessionSlugValue(explicitQuerySessionSlug);
  }
  // Keep survey/session-resolved pages local, but avoid pinning generic
  // /questions views just because they inherited the global primary session.
  if (!shouldInheritResolvedTagSessionScope(props)) return '';

  return normalizeSessionSlugValue(
    resolveEffectiveSlug(props) ||
    (typeof getEffectiveDraftSlug === 'function' ? getEffectiveDraftSlug() : '') ||
    ''
  );
};

/** Resolve effective session slug:
 * Priority: URL /session/:slug → props.sessionSlug (falling back to activeSessionSlug) → '' (general)
 */
export function resolveEffectiveSlug(props = {}) {
  return resolveSurveyToolEffectiveSlug({
    pathname: (typeof window !== 'undefined' && window.location && window.location.pathname) || '',
    activeSessionSlug: props.activeSessionSlug,
    sessionSlug: props.sessionSlug,
  });
}

const resolveDraftSessionContext = (props = {}, effectiveDraftSlug = '') => (
  resolveSurveyToolDraftSessionContext({
    pathname: (typeof window !== 'undefined' && window.location && window.location.pathname) || '',
    activeSessionSlug: props.activeSessionSlug,
    sessionSlug: props.sessionSlug,
    effectiveDraftSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveExplicitSessionContext = (sessionSlug = '') => (
  resolveSurveyToolExplicitSessionContext({
    sessionSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveDraftStorageContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolDraftStorageContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveResponseHydrationContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolResponseHydrationContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveQuestionBootstrapContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolQuestionBootstrapContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveDecryptHydrationContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolDecryptHydrationContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveResponseJsonContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolResponseJsonContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveQuestionReadCacheContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolQuestionReadCacheContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveQuestionsDashboardLoadContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolQuestionsDashboardLoadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
    fallbackSessionSlugs: getExtraQuestionReadSlugs(props, sessionSlug),
  })
);

const resolveQuestionPayloadCacheWriteContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolQuestionPayloadCacheWriteContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveEnsureQuestionCachedContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolEnsureQuestionCachedContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveQuestionCountContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolQuestionCountContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
    fallbackSessionSlugs: getExtraQuestionReadSlugs(props, sessionSlug),
  })
);

const resolveIdLookupContext = ({
  props = {},
  network = null,
  sessionSlug = '',
} = {}) => (
  resolveSurveyToolIdLookupContext({
    sessionSlug,
    network: (
      (network?.id != null || props?.network?.id != null)
        ? { id: network?.id ?? props?.network?.id }
        : null
    ),
    networkChainId: props?.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveSurveyReadContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolSurveyReadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveUpdateCacheContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolUpdateCacheContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveSubmittedCacheWriteContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolSubmittedCacheWriteContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolvePileWarmSeedContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolPileWarmSeedContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolvePileLoadContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolPileLoadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolvePileResponseReadContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolPileResponseReadContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolvePileFilterContext = (props = {}, sessionSlug = '') => (
  resolveSurveyToolPileFilterContext({
    sessionSlug,
    network: props.network,
    networkChainId: props.networkChainId,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const dedupeQuestionReadSlugs = (values = []) => {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = normalizeSessionSlugValue(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const hasExplicitQuestionReadLocationPin = () => {
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
      return (
        parseQuestionSessionSlugFromSearch(search) !== null ||
        parseQuestionSessionIdFromSearch(search) != null
      );
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

const getExtraQuestionReadSlugs = (props = {}, baseSlug = '') => {
  const normalizedBaseSlug = normalizeSessionSlugValue(baseSlug);
  if (
    getSessionSlugPinnedFromProps(props) ||
    hasExplicitQuestionReadLocationPin()
  ) {
    return [];
  }

  const scopeMode = readSessionScanScope();
  if (scopeMode === 'list') {
    return dedupeQuestionReadSlugs(
      readSessionScanSlugs().filter((slug) => normalizeSessionSlugValue(slug) !== normalizedBaseSlug)
    );
  }
  if (scopeMode === 'all') {
    return dedupeQuestionReadSlugs(
      getAllSessionSlugs().filter((slug) => normalizeSessionSlugValue(slug) !== normalizedBaseSlug)
    );
  }
  return [];
};

const GENERAL_SCOPE_STORAGE_TOKEN = '__general__';
const MULTI_SCOPE_STORAGE_PREFIX = '__scope__:';

const encodeQuestionFilterScopeStorageToken = (slug = '') => {
  const normalized = normalizeSessionSlugValue(slug);
  return normalized === '' ? GENERAL_SCOPE_STORAGE_TOKEN : normalized;
};

const buildQuestionCountScopeContextKey = (slugs = [], networkID = '') => {
  const scopeKey = dedupeQuestionReadSlugs(slugs)
    .map((slug) => encodeQuestionFilterScopeStorageToken(slug))
    .sort()
    .join('|');
  return `${scopeKey}|${String(networkID || '')}`;
};

const buildQuestionDashboardLoadContextSignature = ({
  effectiveSlug = '',
  scopedSessionSlugs = [],
  networkID = '',
} = {}) => {
  const readSlugs = dedupeQuestionReadSlugs(
    Array.isArray(scopedSessionSlugs) && scopedSessionSlugs.length > 0
      ? scopedSessionSlugs
      : [effectiveSlug]
  );
  return `${normalizeSessionSlugValue(effectiveSlug)}|${buildQuestionCountScopeContextKey(readSlugs, networkID)}`;
};

const buildQuestionFilterStorageKeyPrefix = (props = {}, baseSlug = '') => {
  const normalizedBaseSlug = normalizeSessionSlugValue(baseSlug || resolveEffectiveSlug(props));
  const scopeSlugs = dedupeQuestionReadSlugs([
    normalizedBaseSlug,
    ...getExtraQuestionReadSlugs(props, normalizedBaseSlug),
  ]);
  const storageSlug = scopeSlugs.length <= 1
    ? normalizedBaseSlug
    : `${MULTI_SCOPE_STORAGE_PREFIX}${scopeSlugs
      .map((slug) => encodeQuestionFilterScopeStorageToken(slug))
      .sort()
      .join('|')}`;
  return `dg:filters:${storageSlug}`;
};




/** Cache keys (per-group) */
const qKey = (slug) => `dg:questionsCache:${slug || ''}`;
const sKey = (slug) => `dg:surveysCache:${slug || ''}`;
const RECENT_QUESTION_PAYLOADS_KEY = 'dg:recentQuestionPayloads';
const RECENT_QUESTION_PAYLOADS_TTL_MS = 12 * 60 * 60 * 1000;

/** LocalStorage helpers (per-group) */
function readQuestionsCache(slug) {
  return peekCacheSync('questionsCache', slug) || {};
}
function readQuestionsCacheRef(slug) {
  return peekCacheSync('questionsCache', slug, { clone: false }) || {};
}
async function readQuestionsCacheAsync(slug) {
  const value = await readCache('questionsCache', slug);
  return (value && typeof value === 'object') ? value : (readQuestionsCache(slug) || {});
}
function mergeQuestionResponses(target = {}, source = {}) {
  const nextTarget = (target && typeof target === 'object') ? target : {};
  if (!source || typeof source !== 'object') return nextTarget;
  Object.keys(source).forEach((rawQuestionId) => {
    const normalizedQuestionId = normalizeQuestionIdKey(rawQuestionId);
    const responderMap = source[rawQuestionId];
    if (!normalizedQuestionId || !responderMap || typeof responderMap !== 'object') return;
    nextTarget[normalizedQuestionId] = nextTarget[normalizedQuestionId] || {};
    Object.keys(responderMap).forEach((rawResponderAddress) => {
      const responderAddress = String(rawResponderAddress || '').trim().toLowerCase();
      if (!responderAddress) return;
      nextTarget[normalizedQuestionId][responderAddress] = responderMap[rawResponderAddress];
    });
  });
  return nextTarget;
}
function writeQuestionsCache(slug, obj) {
  return writeCacheOptimistic('questionsCache', slug, obj || {});
}
function readSurveysCache(slug) {
  return peekCacheSync('surveysCache', slug) || {};
}
function readSurveysCacheRef(slug) {
  return peekCacheSync('surveysCache', slug, { clone: false }) || {};
}
async function readSurveysCacheAsync(slug) {
  const value = await readCache('surveysCache', slug);
  return (value && typeof value === 'object') ? value : (readSurveysCache(slug) || {});
}
function writeSurveysCache(slug, obj) {
  return writeCacheOptimistic('surveysCache', slug, obj || {});
}

function readRecentQuestionPayload(questionId) {
  const qid = String(questionId || '').trim().toLowerCase();
  if (!qid) return null;
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(RECENT_QUESTION_PAYLOADS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entry = parsed[qid];
    if (!entry || typeof entry !== 'object') return null;
    const ts = Number(entry.savedAtMs || 0);
    if (!ts || (Date.now() - ts) > RECENT_QUESTION_PAYLOADS_TTL_MS) return null;
    const payload = { ...entry };
    delete payload.savedAtMs;
    payload.id = qid;
    return payload;
  } catch (_) {
    return null;
  }
}

function canUseRecentQuestionPayloadForAccount(payload, account) {
  if (!payload || typeof payload !== 'object') return false;
  const accountLower = String(account || '').trim().toLowerCase();
  const creatorLower = String(payload.creator || '').trim().toLowerCase();
  if (!accountLower || !creatorLower) return false;
  return creatorLower === accountLower;
}

function hasCacheHydratedFlag(props) {
  return !!props?.cacheHasLoaded;
}

export const normalizeQuestionProgressSlug = (rawSlug = '') => {
  const normalized = String(rawSlug || '').trim().toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

export const doesQuestionProgressMatchSlug = (progressSlug = '', currentSlug = '') => (
  normalizeQuestionProgressSlug(progressSlug) === normalizeQuestionProgressSlug(currentSlug)
);

const formatQuestionScanBlockCount = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Math.max(0, Math.floor(numericValue)).toLocaleString();
};

export const buildQuestionScanProgressDisplay = (questionScanProgress = null) => {
  const totalBlocks = Math.max(0, Number(questionScanProgress?.totalBlocks || 0));
  const requestedTotalBlocks = Math.max(
    totalBlocks,
    Number(questionScanProgress?.requestedTotalBlocks || totalBlocks || 0)
  );
  const wasCapped = questionScanProgress?.wasCapped === true && requestedTotalBlocks > totalBlocks;
  const progressTotalBlocks = wasCapped ? requestedTotalBlocks : totalBlocks;
  const remainingBlocksRaw = Number(questionScanProgress?.remainingBlocks);
  const scannedBlocksFallback = progressTotalBlocks > 0
    ? Math.max(0, progressTotalBlocks - Math.max(0, Number.isFinite(remainingBlocksRaw) ? remainingBlocksRaw : progressTotalBlocks))
    : 0;
  const scannedBlocks = progressTotalBlocks > 0
    ? Math.max(
      0,
      Math.min(
        progressTotalBlocks,
        Number.isFinite(Number(questionScanProgress?.scannedBlocks))
          ? Number(questionScanProgress?.scannedBlocks)
          : scannedBlocksFallback
      )
    )
    : 0;
  const remainingBlocks = progressTotalBlocks > 0
    ? Math.max(
      0,
      Math.min(
        progressTotalBlocks,
        Number.isFinite(remainingBlocksRaw)
          ? remainingBlocksRaw
          : (progressTotalBlocks - scannedBlocks)
      )
    )
    : 0;
  const percentComplete = progressTotalBlocks > 0
    ? Math.max(0, Math.min(100, Math.round((scannedBlocks / progressTotalBlocks) * 100)))
    : 0;

  return {
    totalBlocks,
    requestedTotalBlocks,
    wasCapped,
    scannedBlocks,
    remainingBlocks,
    percentComplete,
    metaLeftText: `${formatQuestionScanBlockCount(remainingBlocks)} blocks left`,
    metaRightText: `${formatQuestionScanBlockCount(scannedBlocks)} / ${formatQuestionScanBlockCount(progressTotalBlocks)}`,
  };
};

export const shouldShowPileFullLoadingState = ({
  loading = false,
  hasVisibleQuestions = false,
  firstBoot = false,
  isQuestionCacheReady = false,
  recentRateLimit = false,
  hasScanOrHydrationWork = false,
  allowUnreadyEmptySettlement = false,
  allowFilteredEmptySettlement = false,
  hasTerminalScanError = false,
} = {}) => {
  if (hasVisibleQuestions) return false;
  if (hasTerminalScanError) return false;
  if (allowUnreadyEmptySettlement) return false;
  if (allowFilteredEmptySettlement) return false;
  if (loading) return true;
  if (hasScanOrHydrationWork) return true;
  return !!(firstBoot || !isQuestionCacheReady || recentRateLimit);
};

const isPlainObject = (value) => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const normalizeSbtFilterState = (rawSbtFilter) => {
  if (!isPlainObject(rawSbtFilter)) return null;
  const normalized = {};
  Object.keys(rawSbtFilter).forEach((key) => {
    const value = rawSbtFilter[key];
    if (Array.isArray(value)) {
      const compacted = value.filter((entry) => entry != null && String(entry).trim() !== '');
      if (compacted.length > 0) normalized[key] = compacted;
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) normalized[key] = trimmed;
      return;
    }
    if (typeof value === 'boolean') {
      if (value) normalized[key] = true;
      return;
    }
    if (value != null) {
      normalized[key] = value;
    }
  });
  return Object.keys(normalized).length > 0 ? normalized : null;
};

const buildCanonicalSurveyToolFilterState = (rawFilterState) => {
  const state = isPlainObject(rawFilterState) ? rawFilterState : {};
  const topQuestions = Object.prototype.hasOwnProperty.call(state, 'topQuestions')
    ? state.topQuestions
    : null;
  const questionTypes = Array.isArray(state.questionTypes)
    ? [...state.questionTypes]
    : (Array.isArray(state.types) ? [...state.types] : []);
  const selectedTags = Array.isArray(state.selectedTags)
    ? [...state.selectedTags]
    : (Array.isArray(state.tags) ? [...state.tags] : []);
  const legacyTopLevelSbt = (
    Array.isArray(state.includedSBTs) ||
    Array.isArray(state.excludedSBTs) ||
    state.onlyVerifiedHumans === true
  )
    ? {
        includedSBTs: Array.isArray(state.includedSBTs) ? [...state.includedSBTs] : [],
        excludedSBTs: Array.isArray(state.excludedSBTs) ? [...state.excludedSBTs] : [],
        onlyVerifiedHumans: state.onlyVerifiedHumans === true,
      }
    : null;
  const sbtFilter = normalizeSbtFilterState(state.sbtFilter || legacyTopLevelSbt);
  const aiFilter = (typeof state.aiFilter === 'string')
    ? (state.aiFilter.trim() || null)
    : (state.aiFilter ?? null);
  const aiTopNRaw = Object.prototype.hasOwnProperty.call(state, 'aiTopN') ? state.aiTopN : null;
  const aiTopN = aiFilter == null
    ? null
    : (() => {
      const parsed = Number.parseInt(String(aiTopNRaw ?? ''), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    })();
  const aiCombine = aiFilter == null
    ? false
    : state.aiCombine === true;

  const rawResponseStatus = state.responseStatus || null;
  const responded = rawResponseStatus?.responded === true;
  const notResponded = rawResponseStatus?.notResponded === true;
  const responseStatus = (responded || notResponded) && !(responded && notResponded)
    ? { responded, notResponded }
    : null;

  return {
    topQuestions,
    questionTypes,
    sbtFilter,
    aiFilter,
    aiTopN,
    aiCombine,
    selectedTags,
    responseStatus,
  };
};

export const normalizeSurveyToolFilterState = (rawFilterState) => {
  const canonical = buildCanonicalSurveyToolFilterState(rawFilterState);
  return serializeFilterState(canonical) ? canonical : {};
};

const serializeSurveyToolFilterState = (filterState) => (
  serializeFilterState(buildCanonicalSurveyToolFilterState(filterState))
);

const isSurveyToolFilterStateActive = (filterState) => (
  !!serializeSurveyToolFilterState(filterState)
);

function areQuestionPayloadsEquivalent(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a || null) === JSON.stringify(b || null);
  } catch (_) {
    return false;
  }
}

function ensureQuestionsNet(cache, netIdStr) {
  if (!cache || typeof cache !== 'object') cache = {};
  if (!cache[netIdStr]) {
    cache[netIdStr] = {
      questionsLatestBlock: 0,
      questions: {},
      questionResponses: {},
      questionResponsesLatestBlock: 0
    };
  }
  return cache;
}
function ensureSurveysNet(cache, netIdStr) {
  if (!cache || typeof cache !== 'object') cache = {};
  if (!cache[netIdStr]) {
    cache[netIdStr] = {
      surveysLatestBlock: 0,
      surveys: {},
      surveyResponses: {},
      surveyResponsesLatestBlock: {}
    };
  }
  return cache;
}

const toResponseRecencyMeta = (source = null) => {
  const row = (source && typeof source === 'object') ? source : {};
  const nowTs = Math.floor(Date.now() / 1000);
  return {
    bn: Math.max(0, Number(row.blockNumber ?? row.bn ?? 0) || 0),
    txi: Math.max(0, Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0) || 0),
    li: Math.max(0, Number(row.logIndex ?? row.li ?? 0) || 0),
    ts: Math.max(0, Number(row.timestamp ?? row.ts ?? 0) || nowTs),
    transactionHash: String(row.transactionHash || row.txHash || row.hash || '').trim(),
  };
};

const isIncomingResponseMetaNewer = (incoming = null, existing = null) => {
  const next = toResponseRecencyMeta(incoming);
  const prev = toResponseRecencyMeta(existing);
  return (
    next.bn > prev.bn ||
    (
      next.bn === prev.bn &&
      (
        next.txi > prev.txi ||
        (
          next.txi === prev.txi &&
          (
            next.li > prev.li ||
            (
              next.li === prev.li &&
              next.ts >= prev.ts
            )
          )
        )
      )
    )
  );
};

const stampResponsePayloadWithMeta = (payload, meta = null) => {
  if (!payload || typeof payload !== 'object') return payload;
  const recency = toResponseRecencyMeta(meta);
  return {
    ...payload,
    ...(recency.bn > 0 ? { blockNumber: recency.bn } : {}),
    transactionIndex: recency.txi,
    logIndex: recency.li,
    ...(recency.ts > 0 ? { timestamp: recency.ts } : {}),
    ...(recency.transactionHash ? { transactionHash: recency.transactionHash } : {}),
  };
};

const mergeSurveyResponsePayloads = (existingPayload, incomingPayload) => {
  const existing = (existingPayload && typeof existingPayload === 'object') ? existingPayload : null;
  const incoming = (incomingPayload && typeof incomingPayload === 'object') ? incomingPayload : null;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const merged = { ...existing, ...incoming };
  const existingResponses = Array.isArray(existing.responses) ? existing.responses : [];
  const incomingResponses = Array.isArray(incoming.responses) ? incoming.responses : [];

  if (existingResponses.length > 0 || incomingResponses.length > 0) {
    const responsesByQuestionId = new Map();
    existingResponses.forEach((row) => {
      const qid = normalizeQuestionIdKey(row?.questionID || row?.questionId);
      if (!qid) return;
      responsesByQuestionId.set(qid, row);
    });
    incomingResponses.forEach((row) => {
      const qid = normalizeQuestionIdKey(row?.questionID || row?.questionId);
      if (!qid) return;
      responsesByQuestionId.set(qid, row);
    });
    merged.responses = Array.from(responsesByQuestionId.values());
  }

  return merged;
};

/** Per-group list helpers (return LOWERCASED Sets; treat missing as []) */
const resolveQuestionConfigContext = (sessionSlug = '') => (
  resolveSurveyToolQuestionConfigContext({
    sessionSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

const resolveLockAudienceSessionNameContext = (sessionSlug = '') => (
  resolveSurveyToolLockAudienceSessionNameContext({
    sessionSlug,
    resolveBySlug: getStrictSessionConfigBySlug,
  })
);

function getBlockedQuestionIdsSet(slug) {
  return new Set(resolveQuestionConfigContext(slug).blockedQuestionIds || []);
}
function getHighlightedQuestionIdsSet(slug) {
  return new Set(resolveQuestionConfigContext(slug).highlightedQuestionIds || []);
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
export function getPendingStatsSnapshotFromState(state = {}) {
  return {
    total: Number((state && state.modifiedCount) || 0),
    encrypted: Number((state && state.encryptedModifiedCount) || 0),
  };
}

export function computeSubmitLabel(ctx = {}, opts = {}) {
  const providedStats = (
    opts &&
    typeof opts === 'object' &&
    opts.pendingStats &&
    typeof opts.pendingStats === 'object'
  ) ? opts.pendingStats : null;
  const stats =
    providedStats ||
    (typeof ctx.getPendingEditStats === 'function' && ctx.getPendingEditStats()) ||
    getPendingStatsSnapshotFromState(ctx.state);

  const pendingCount = Number(stats.total || 0);
  const pendingEncrypted = Number(stats.encrypted || 0);

  const base = 'Submit';
  const suffix = opts.suffix ? ` ${opts.suffix}` : '';
  const baseWithSuffix = `${base}${suffix}`;

  return pendingCount > 0 ? `${baseWithSuffix} (${pendingCount})` : baseWithSuffix;
}

export function shouldShowSingleQuestionResponseLookupSpinner({
  singleQuestionMode = false,
  isLoadingResponse = false,
  account = '',
  viewAddress = '',
  responderAddress = '',
} = {}) {
  if (!singleQuestionMode || !isLoadingResponse) return false;
  const probeAddress = String(responderAddress || viewAddress || account || '').trim();
  return !!probeAddress;
}

export function shouldRenderSubmittedIndicator({
  submittedStateActive = false,
  isLoadingResponse = false,
} = {}) {
  return !!submittedStateActive && !isLoadingResponse;
}

export function shouldRenderInlineSubmitButton({
  useHeaderSubmit = false,
  canEditQuestions = false,
  hasPendingEdits = false,
  submittedStateActive = false,
  isLoadingResponse = false,
} = {}) {
  if (useHeaderSubmit) return false;
  const submittedIndicatorActive = shouldRenderSubmittedIndicator({
    submittedStateActive,
    isLoadingResponse,
  });
  if (canEditQuestions) return !!hasPendingEdits || submittedIndicatorActive;
  return submittedIndicatorActive;
}





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
  readPathSearch,
  hasExplicitSessionQueryPinInPath,
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
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
  normalizeSessionSlugValue,
  getSessionSlugHintFromProps,
  getActiveSessionSlugFromProps,
  getSessionSlugPinnedFromProps,
  shouldInheritResolvedTagSessionScope,
  resolveCurrentTagSessionSlug,
  resolveDraftSessionContext,
  resolveExplicitSessionContext,
  resolveDraftStorageContext,
  resolveResponseHydrationContext,
  resolveQuestionBootstrapContext,
  resolveDecryptHydrationContext,
  resolveResponseJsonContext,
  resolveQuestionReadCacheContext,
  resolveQuestionsDashboardLoadContext,
  resolveQuestionPayloadCacheWriteContext,
  resolveEnsureQuestionCachedContext,
  resolveQuestionCountContext,
  resolveIdLookupContext,
  resolveSurveyReadContext,
  resolveUpdateCacheContext,
  resolveSubmittedCacheWriteContext,
  resolvePileWarmSeedContext,
  resolvePileLoadContext,
  resolvePileResponseReadContext,
  resolvePileFilterContext,
  dedupeQuestionReadSlugs,
  getExtraQuestionReadSlugs,
  buildQuestionCountScopeContextKey,
  buildQuestionDashboardLoadContextSignature,
  buildQuestionFilterStorageKeyPrefix,
  readQuestionsCache,
  readQuestionsCacheRef,
  readQuestionsCacheAsync,
  mergeQuestionResponses,
  writeQuestionsCache,
  readSurveysCache,
  readSurveysCacheRef,
  readSurveysCacheAsync,
  writeSurveysCache,
  readRecentQuestionPayload,
  canUseRecentQuestionPayloadForAccount,
  hasCacheHydratedFlag,
  formatQuestionScanBlockCount,
  serializeSurveyToolFilterState,
  isSurveyToolFilterStateActive,
  areQuestionPayloadsEquivalent,
  ensureQuestionsNet,
  ensureSurveysNet,
  toResponseRecencyMeta,
  isIncomingResponseMetaNewer,
  stampResponsePayloadWithMeta,
  mergeSurveyResponsePayloads,
  resolveLockAudienceSessionNameContext,
  getBlockedQuestionIdsSet,
  getHighlightedQuestionIdsSet,
  DEBUG_PREFILL,
  EMPTY_QUESTION_POOL,
  buildRenderedIdsSignature,
  buildQuestionIdScopeSignature,
};
