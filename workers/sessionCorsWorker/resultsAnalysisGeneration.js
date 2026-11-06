import { resolveSessionAiModel } from './aiRequestPolicy.js';
import { toStr } from './stringCoercion.js';
import { normalizeResultsAnalysisSettings } from '../../shared/resultsAnalysisSettings.mjs';
import { buildResultsAnalysisPrompt } from '../../shared/resultsAnalysisPrompt.mjs';
import { applyResultsAnalysisExposurePolicy, normalizeResultsAnalysisArtifact } from './resultsAnalysisArtifactValidation.js';
import {
  sha256Hex,
  stableCanonicalSerialize,
} from '../shared/deployHelperCore.mjs';
import {
  resolveCanonicalWorkerSessionIdHex,
} from './sessionConfigMutation.js';
import { normalizeWorkerConfigRecord } from './sessionConfigNormalization.js';
import { getSessionSecrets as getStoredSessionSecrets } from './sessionConfigSecretsStore.js';
import {
  normalizeWorkerSessionSlug,
} from './sessionSlugResolution.js';
import {
  getStorageIndexBinding,
  listCloudflareMetadataRows,
  readStoredCloudflarePayloadBytes,
} from './storageRouteExecution.js';
import { listHiddenStorageResourceIds, selectCanonicalStorageVersions } from './storageResourceOwnership.js';
import { blockedQuestionIds } from './blockedQuestionIds.js';
import {
  isModelAllowed,
  normalizeAiRequestPayload,
} from './aiRequestNormalization.js';
import {
  proxyAnthropic as proxyAnthropicBoundary,
  proxyCustomRPC as proxyCustomRPCBoundary,
  proxyOpenAI as proxyOpenAIBoundary,
  proxyOpenRouter as proxyOpenRouterBoundary,
} from './aiProviderExecution.js';
import { json as jsonResponse } from './responseKvHelpers.js';
import { createOutboundUrlSafetyHelpersWithWorkerDeps } from './outboundUrlSafetyBinding.js';
import { metadataAccessMatchesPublishedAudience } from './storageAudience.js';
import { buildParticipantContextPrompt } from './contextSourceLoader.js';
import { formatValidAnalysisAnswer, readStoredRating } from './resultsAnalysisAnswerValidation.js';
import { DEFAULT_RATING_SCALE, normalizeRatingScale, ratingStepFor } from '../../shared/questions/ratingScale.mjs';
import { createResultsAnalysisScanBudget, isStorageReadLimitError, jsonByteLength } from './storageScanBudget.js';


const readCoordinatedResultsAnalysisStatusDefault = async (args = {}) => (
  (await import('./sessionWriteCoordinator.js')).readCoordinatedResultsAnalysisStatus(args)
);
const reserveCoordinatedResultsAnalysisDefault = async (args = {}) => (
  (await import('./sessionWriteCoordinator.js')).reserveCoordinatedResultsAnalysis(args)
);
const finalizeCoordinatedResultsAnalysisDefault = async (args = {}) => (
  (await import('./sessionWriteCoordinator.js')).finalizeCoordinatedResultsAnalysis(args)
);

const decoder = new TextDecoder();
const AI_RESPONSE_CAP = 420;
const AI_QUESTION_CAP = 80;
const AI_LIMITS = Object.freeze({
  maxOptionsPerQuestion: 12,
  maxQuestionPromptChars: 900,
  maxQuestions: AI_QUESTION_CAP,
  maxResponseAdditionalChars: 900,
  maxResponseAnswerChars: 1400,
  maxResponses: AI_RESPONSE_CAP,
  maxSegmentDimensions: 12,
  maxSegmentValuesPerDimension: 60,
  maxTagsPerQuestion: 16,
});
const ANALYSIS_ARTIFACT_VERSION = 1;
const SOURCE_VERSION = '1';
const RESULT_SECTION_ORDER = ['argumentMap', 'atlas', 'breakdown', 'riskMatrix'];
const DEFAULT_RESULTS_ANALYSIS_PROVIDER_TIMEOUT_MS = 8 * 60 * 1000;
const RESULTS_CONTEXT_CHARS = 12_000;

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const trim = (value) => toStr(value).trim();
const lower = (value) => trim(value).toLowerCase();
const getResultsAnalysisSettings = (config = {}) => normalizeResultsAnalysisSettings(
  config?.resultsAnalysis,
);
const getCanonicalSessionId = (config = {}) => normalizeSessionIdHex(resolveCanonicalWorkerSessionIdHex(config));
const publicDraft = (draft, config) => {
  if (!isObj(draft)) return null;
  const {
    participantWatermark,
    participantDigests,
    sourceSignature,
    viewSignature,
    reservationKey,
    attemptId,
    ...rest
  } = draft;
  return config ? { ...rest, artifact: applyCurrentArtifactPolicy(rest.artifact, config) } : rest;
};

const applyCurrentArtifactPolicy = (artifact, config) => applyResultsAnalysisExposurePolicy({
  artifact,
  exposure: normalizedResultsProfile(config)?.exposure,
  sections: normalizeRequestedSections([], getResultsAnalysisSettings(config)),
});

const normalizeSessionIdHex = (value) => {
  const raw = lower(value).replace(/^0x/, '').replace(/-/g, '');
  return /^[0-9a-f]{32}$/.test(raw) ? `0x${raw}` : '';
};

const parseJsonBytes = (bytes) => {
  try {
    return JSON.parse(decoder.decode(bytes || new Uint8Array()));
  } catch {
    return null;
  }
};

const ENCRYPTED_ENVELOPE_KEYS = new Set([
  'ciphertext',
  'cipherText',
  'encryptedContent',
  'encryptedKey',
  'encryptedPortion',
  'keyCipher',
  'payloadCiphertext',
  'wrappedKey',
]);

const encryptedEnvelopeValueHasContent = (value) => {
  if (value == null || value === false) return false;
  if (typeof value === 'string') return trim(value) !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (isObj(value)) return Object.keys(value).length > 0;
  return true;
};

const isBlankFieldValue = (value) => value == null ||
  (typeof value === 'string' && !trim(value)) ||
  (Array.isArray(value) && value.length === 0) ||
  (isObj(value) && Object.keys(value).length === 0);

// Clients up to 0.6.7 uploaded a cleared locked answer or comment as
// { value: '', encrypted: true, encryptedPortion: '' }. A locked field always
// keeps its envelope beside a '*' mask, so a blank one without any is cleared.
const isClearedFieldWithLockFlag = (value) => hasOwn(value, 'value') &&
  isBlankFieldValue(value.value) &&
  !['envelope', ...ENCRYPTED_ENVELOPE_KEYS].some((key) => encryptedEnvelopeValueHasContent(value[key]));

// Also decides which committed responses the session coordinator marks locked.
export const valueLooksEncrypted = (value, depth = 0) => {
  if (depth > 5) return false;
  if (!isObj(value)) return false;
  if (value.locked === true || value.payloadEncrypted === true) return true;
  if (value.encrypted === true && !isClearedFieldWithLockFlag(value)) return true;
  if (Object.entries(value).some(([key, entry]) => ENCRYPTED_ENVELOPE_KEYS.has(key) && encryptedEnvelopeValueHasContent(entry))) return true;
  return Object.values(value).some((entry) => valueLooksEncrypted(entry, depth + 1));
};

const valueFromAnswerLike = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return trim(value);
  if (Array.isArray(value)) return value.map(valueFromAnswerLike).filter((entry) => entry !== '').join('; ');
  if (isObj(value) && hasOwn(value, 'value')) return valueFromAnswerLike(value.value);
  return '';
};

// Only encryption flags and envelopes lock a field. The client's masks ('*',
// '[encrypted]') always carry encrypted:true, so public text that looks like a
// marker ("Locked", "***") is an answer. A mask without the flag is still a
// placeholder rather than an answer: it reads as blank, as in the client report.
const FIELD_MASKS = new Set(['*', '[encrypted]']);
const withoutFieldMask = (value) => {
  const raw = isObj(value) && hasOwn(value, 'value') ? value.value : value;
  return typeof raw === 'string' && FIELD_MASKS.has(raw.trim()) ? '' : value;
};

const rowLooksLocked = (row) => {
  if (!isObj(row)) return true;
  if (row.encrypted === true || row.payloadEncrypted === true || row.locked === true) return true;
  return valueLooksEncrypted(hasOwn(row, 'answer') ? row.answer : hasOwn(row, 'value') ? row.value : row.response);
};

const VALIDATED_QUESTION_TYPES = new Set(['binary', 'rating', 'multichoice', 'quadratic', 'freeform']);
const normalizeQuestionId = (value) => trim(value).slice(0, 128);
const normalizeQuestionPrompt = (value) => trim(value).replace(/\s+/g, ' ').slice(0, 1200);
const normalizeQuestionType = (value) => trim(value).slice(0, 64) || 'text';
// The shared rating scale and step, with labels clipped for the prompt.
const normalizeAnalysisRatingScale = (question = {}) => {
  const scale = normalizeRatingScale(question) || DEFAULT_RATING_SCALE;
  const clipLabel = (label) => normalizeQuestionPrompt(label).slice(0, 120);
  return { ...scale, minLabel: clipLabel(scale.minLabel), maxLabel: clipLabel(scale.maxLabel), step: ratingStepFor(question) };
};

const normalizeSubmittedAt = (value) => {
  const text = trim(value);
  if (!text) return '';
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
};

const enabledSectionsFromSettings = (settings) => new Set([
  ...(settings?.views?.circles ? ['argumentMap', 'atlas'] : []),
  ...(settings?.views?.breakdown ? ['breakdown'] : []),
  ...(settings?.views?.riskMatrix ? ['riskMatrix'] : []),
]);

const normalizeRequestedSections = (sections, settings) => {
  const requested = Array.isArray(sections) && sections.length
    ? sections.map((entry) => trim(entry)).filter(Boolean)
    : [
        ...(settings?.views?.circles ? ['circles'] : []),
        ...(settings?.views?.breakdown ? ['breakdown'] : []),
        ...(settings?.views?.riskMatrix ? ['riskMatrix'] : []),
      ];
  const enabled = enabledSectionsFromSettings(settings);
  const out = new Set();
  requested.forEach((section) => {
    if (section === 'circles') {
      out.add('argumentMap');
      out.add('atlas');
    } else if (section === 'argumentMap' || section === 'atlas' || section === 'breakdown' || section === 'riskMatrix') {
      out.add(section);
    }
  });
  return RESULT_SECTION_ORDER.filter((section) => out.has(section) && enabled.has(section));
};

export const resolveResultsAnalysisCapability = ({ config } = {}) => {
  const normalizedConfig = normalizeWorkerConfigRecord(config || {}, { slug: normalizeWorkerSessionSlug(config?.slug) });
  const authorityMode = lower(normalizedConfig?.sessionModeProfile?.authority?.mode);
  const storageBackend = lower(normalizedConfig?.sessionModeProfile?.storage?.backend || normalizedConfig?.storageProfile?.backend);
  const workerCanonicalCloudflare = authorityMode === 'worker_canonical' && storageBackend === 'cloudflare';
  if (config?.scopes?.ai === false) {
    return {
      manual: { supported: false, sourceKinds: [], reason: 'ai_scope_disabled' },
      automatic: { supported: false, sourceKinds: [], reason: 'ai_scope_disabled' },
      reason: 'ai_scope_disabled',
    };
  }
  return {
    manual: {
      supported: true,
      sourceKinds: workerCanonicalCloudflare ? ['worker-canonical', 'admin-snapshot'] : ['admin-snapshot'],
    },
    automatic: workerCanonicalCloudflare
      ? { supported: true, sourceKinds: ['worker-canonical'] }
      : {
          supported: false,
          sourceKinds: [],
          reason: 'background_requires_worker_canonical_cloudflare',
        },
    reason: workerCanonicalCloudflare ? '' : 'background_requires_worker_canonical_cloudflare',
  };
};

const compareIdentity = ({ slug, config, suppliedSlug, suppliedSessionId, allowInherited = false }) => {
  const expectedSlug = normalizeWorkerSessionSlug(slug || config?.slug);
  const actualSlug = normalizeWorkerSessionSlug(suppliedSlug);
  if (!allowInherited && expectedSlug && !actualSlug) return false;
  if (expectedSlug && actualSlug && expectedSlug !== actualSlug) return false;
  const expectedSessionId = normalizeSessionIdHex(resolveCanonicalWorkerSessionIdHex(config));
  const actualSessionId = normalizeSessionIdHex(suppliedSessionId);
  if (!allowInherited && expectedSessionId && !actualSessionId) return false;
  if (expectedSessionId && actualSessionId && expectedSessionId !== actualSessionId) return false;
  return true;
};


const participantDigest = async (sourceKey) => sha256Hex(`participant:${trim(sourceKey).toLowerCase()}`);

const normalizeQuestionRecord = (question) => {
  if (!isObj(question)) return null;
  const questionId = normalizeQuestionId(question.questionId || question.questionID || question.id);
  if (!questionId) return null;
  const type = normalizeQuestionType(question.type || question.questionType);
  const scale = type === 'rating' ? normalizeAnalysisRatingScale(question) : null;
  return {
    questionId,
    id: questionId,
    prompt: normalizeQuestionPrompt(question.prompt || question.questionPrompt || question.questionText || question.text || question.title),
    type,
    options: Array.isArray(question.options)
      ? question.options.filter((option) => typeof option === 'string').map((option) => option.trim()).filter(Boolean)
      : [],
    tags: Array.isArray(question.tags)
      ? question.tags.slice(0, AI_LIMITS.maxTagsPerQuestion).map((tag) => normalizeQuestionPrompt(tag).slice(0, 120)).filter(Boolean)
      : [],
    ...(scale ? { scale } : {}),
    ...(type === 'multichoice' ? { singleSelect: Boolean(question.singleSelect || question.oneSelectionOnly || question.singleChoice), ...(Number.isSafeInteger(question.maxSelections) && question.maxSelections > 0 ? { maxSelections: question.maxSelections } : {}) } : {}),
    ...(type === 'quadratic' ? { voiceCredits: question.voiceCredits === undefined ? 99 : question.voiceCredits } : {}),
  };
};

const selectRoundRobinResponses = ({ responseRows, questionIds, limit }) => {
  const buckets = new Map(questionIds.map((questionId) => [questionId, []]));
  responseRows.forEach((row) => {
    const bucket = buckets.get(row.questionId);
    if (bucket) bucket.push(row);
  });
  const out = [];
  for (let offset = 0; out.length < limit; offset += 1) {
    let added = false;
    for (let questionIndex = 0; questionIndex < questionIds.length; questionIndex += 1) {
      const questionId = questionIds[questionIndex];
      const bucket = buckets.get(questionId) || [];
      const row = offset < bucket.length ? bucket[(offset + questionIndex) % bucket.length] : null;
      if (!row) continue;
      out.push(row);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out;
};

// Worker time orders a participant's answers. Equal times have no order, so
// the immutable storage id breaks the tie, as the client does
// (client/src/utilities/survey/workerResponseRecency.ts).
const isNewerResponseRow = (candidate, current) => (
  candidate.rowTime > current.rowTime ||
  (candidate.rowTime === current.rowTime && candidate.storageRefId > current.storageRefId)
);

const normalizeSanitizedRows = async ({ rows, questions, slug, config, strictLocked, requireKnownQuestion = false }) => {
  const expectedSlug = normalizeWorkerSessionSlug(slug || config?.slug);
  const expectedSessionId = normalizeSessionIdHex(resolveCanonicalWorkerSessionIdHex(config));
  const blocked = new Set(blockedQuestionIds(config));
  const questionMap = new Map();
  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const normalized = normalizeQuestionRecord(question);
    if (normalized && !blocked.has(lower(normalized.questionId))) questionMap.set(normalized.questionId, normalized);
  });

  // Each participant's latest row per question wins before any filter, so a
  // newer locked, cleared or invalid answer withdraws an older public one.
  // Superseded rows are not counted as excluded or locked.
  const latestByQuestionParticipant = new Map();
  let excludedCount = 0;
  let lockedCount = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isObj(row)) {
      excludedCount += 1;
      continue;
    }
    if (!compareIdentity({ slug: expectedSlug, config: { ...config, sessionIdHex: expectedSessionId }, suppliedSlug: row.sessionSlug, suppliedSessionId: row.sessionId || row.sessionIdHex, allowInherited: strictLocked === true })) {
      excludedCount += 1;
      continue;
    }
    if (strictLocked && rowLooksLocked(row)) {
      return { ok: false, status: 400, error: 'Encrypted or locked response rows cannot be used for admin snapshot generation.' };
    }
    const questionId = normalizeQuestionId(row.questionId || row.questionID || row.id);
    if (!questionId || blocked.has(lower(questionId)) || (requireKnownQuestion && !questionMap.has(questionId))) {
      excludedCount += 1;
      continue;
    }
    const participantSource = trim(row.__trustedParticipantId || row.participantId || row.responder || row.address || row.account || '');
    if (!participantSource) {
      excludedCount += 1;
      continue;
    }
    const candidate = {
      row,
      questionId,
      participantKey: await participantDigest(participantSource),
      rowTime: Date.parse(row.submittedAt || row.createdAt || row.timestamp || '') || 0,
      storageRefId: trim(row.__storageRefId),
    };
    const dedupeKey = `${questionId}:${candidate.participantKey}`;
    const existing = latestByQuestionParticipant.get(dedupeKey);
    if (!existing || isNewerResponseRow(candidate, existing)) latestByQuestionParticipant.set(dedupeKey, candidate);
  }

  const includedRows = [];
  const participantDigests = new Set();
  for (const { row, questionId, participantKey } of latestByQuestionParticipant.values()) {
    if (row.__withheld === true) {
      excludedCount += 1;
      continue;
    }
    if (rowLooksLocked(row)) {
      excludedCount += 1;
      lockedCount += 1;
      continue;
    }
    if (!questionMap.has(questionId)) {
      const inferred = normalizeQuestionRecord({
        questionId,
        prompt: row.prompt || row.questionPrompt || row.questionText || row.question || row.text,
        type: row.type || row.questionType,
      });
      if (inferred) questionMap.set(questionId, inferred);
    }
    const answerValue = withoutFieldMask(hasOwn(row, 'answer') ? row.answer : (hasOwn(row, 'value') ? row.value : row.response));
    const additionalValue = hasOwn(row, 'additional') ? row.additional : (hasOwn(row, 'additionalComments') ? row.additionalComments : (hasOwn(row, 'comments') ? row.comments : row.comment));
    const knownQuestion = questionMap.get(questionId) || {};
    // Answers to the current question types are validated against the question
    // in both sources: invalid answers are not evidence, and quadratic
    // allocations reach the AI with option labels. Admin snapshots keep the
    // legacy shapes of other types (such as "poll") as text, as before.
    const validatedAnswer = requireKnownQuestion || VALIDATED_QUESTION_TYPES.has(knownQuestion.type)
      ? formatValidAnalysisAnswer(answerValue, knownQuestion)
      : valueFromAnswerLike(answerValue);
    if (validatedAnswer === null) {
      excludedCount += 1;
      continue;
    }
    const answer = Array.isArray(validatedAnswer) ? validatedAnswer : validatedAnswer.slice(0, 4000);
    const additionalLocked = valueLooksEncrypted(additionalValue);
    const additionalComments = additionalLocked ? '' : valueFromAnswerLike(withoutFieldMask(additionalValue)).slice(0, 2000);
    if (!answer.length && !additionalComments) {
      excludedCount += 1;
      if (additionalLocked) lockedCount += 1;
      continue;
    }
    participantDigests.add(participantKey);
    includedRows.push({
      questionId,
      participantKey,
      answer,
      additionalComments,
      importance: encryptedEnvelopeValueHasContent(row.importanceEncrypted) ? null : readStoredRating(row.importance),
      conviction: encryptedEnvelopeValueHasContent(row.convictionEncrypted) ? null : readStoredRating(row.conviction),
      submittedAt: normalizeSubmittedAt(row.submittedAt || row.createdAt || row.timestamp),
      questionPrompt: knownQuestion.prompt || '',
      questionType: knownQuestion.type || 'text',
    });
  }
  const sortedParticipantDigests = [...participantDigests].sort();
  const participantLabels = new Map(sortedParticipantDigests.map((digest, index) => [digest, `participant_${String(index + 1).padStart(3, '0')}`]));
  const participants = sortedParticipantDigests.map((digest) => ({ syntheticId: participantLabels.get(digest) }));
  const responseRows = includedRows
    .sort((a, b) => a.questionId.localeCompare(b.questionId) || (participantLabels.get(a.participantKey) || '').localeCompare(participantLabels.get(b.participantKey) || ''));
  const sanitizedResponses = responseRows.map((row, index) => ({
    responseId: `r${index + 1}`,
    questionId: row.questionId,
    participantId: participantLabels.get(row.participantKey) || 'participant_000',
    answer: row.answer,
    ...(row.additionalComments ? { additional: row.additionalComments } : {}),
    ...(row.importance !== null ? { importance: row.importance } : {}),
    ...(row.conviction !== null ? { conviction: row.conviction } : {}),
    ...(row.submittedAt ? { submittedAt: row.submittedAt } : {}),
  }));
  const answeredQuestionIds = new Set(responseRows.map((row) => row.questionId));
  const sanitizedQuestions = [...questionMap.values()]
    .filter((question) => question.questionId)
    .sort((a, b) => {
      const aAnswered = answeredQuestionIds.has(a.questionId) ? 0 : 1;
      const bAnswered = answeredQuestionIds.has(b.questionId) ? 0 : 1;
      return aAnswered - bAnswered || a.questionId.localeCompare(b.questionId);
    });
  const cappedQuestions = sanitizedQuestions.slice(0, AI_QUESTION_CAP);
  const cappedQuestionIds = new Set(cappedQuestions.map((question) => question.questionId));
  const aiResponseRows = selectRoundRobinResponses({
    responseRows: responseRows.filter((row) => cappedQuestionIds.has(row.questionId)),
    questionIds: cappedQuestions.map((question) => question.questionId),
    limit: AI_RESPONSE_CAP,
  });
  const aiResponses = aiResponseRows
    .map((row) => ({
      ...(row.additionalComments ? { additional: row.additionalComments.slice(0, AI_LIMITS.maxResponseAdditionalChars) } : {}),
      answer: (Array.isArray(row.answer) ? row.answer.join('; ') : row.answer).slice(0, AI_LIMITS.maxResponseAnswerChars),
      participantId: participantLabels.get(row.participantKey) || 'participant_000',
      questionId: row.questionId,
      questionPrompt: row.questionPrompt,
      questionType: row.questionType,
    }));
  const aiParticipantIds = new Set(aiResponses.map((row) => row.participantId).filter(Boolean));
  const aiQuestions = cappedQuestions.map((question) => ({
    id: question.questionId,
    prompt: question.prompt.slice(0, AI_LIMITS.maxQuestionPromptChars),
    type: question.type,
    options: question.options.slice(0, AI_LIMITS.maxOptionsPerQuestion).map((option) => option.slice(0, 140)),
    tags: question.tags,
    ...(question.scale ? { scale: question.scale } : {}),
    ...(question.type === 'multichoice' ? { singleSelect: question.singleSelect, ...(question.maxSelections ? { maxSelections: question.maxSelections } : {}) } : {}),
    ...(question.type === 'quadratic' ? { voiceCredits: question.voiceCredits ?? 99 } : {}),
  }));
  const aiSnapshot = {
    counts: {
      participants: aiParticipantIds.size,
      questions: aiQuestions.length,
      responses: aiResponses.length,
    },
    inputLimits: AI_LIMITS,
    questions: aiQuestions,
    responses: aiResponses,
    segmentDimensions: [],
    session: { name: trim(config?.sessionName), slug: expectedSlug },
  };
  return {
    ok: true,
    snapshot: {
      sessionSlug: expectedSlug,
      sessionId: expectedSessionId,
      questions: sanitizedQuestions.map(({ questionId, ...question }) => ({ ...question, id: question.id || questionId })),
      responses: sanitizedResponses,
    },
    aiSnapshot,
    counts: {
      responseCount: sanitizedResponses.length,
      participantCount: participants.length,
      aiInputParticipantCount: aiParticipantIds.size,
      excludedCount,
      lockedCount,
      aiInputResponseCount: aiResponses.length,
      aiInputQuestionCount: aiQuestions.length,
      totalQuestionCount: sanitizedQuestions.length,
    },
    participants,
    participantDigests: sortedParticipantDigests,
  };
};

// Readable or not, every version of an answer reaches the choice of latest, so a
// newer restricted answer withdraws an older public one and then stays out itself.
const toResponseRow = (metadata, payload, config) => ({
  ...payload,
  __trustedParticipantId: metadata.responder,
  __storageRefId: metadata.id,
  __withheld: !metadataAccessMatchesPublishedAudience(metadata, config),
  responder: metadata.responder,
  createdAt: metadata.createdAt,
  submittedAt: metadata.createdAt,
  timestamp: metadata.createdAt,
  encrypted: metadata.encrypted === true || metadata.payloadEncrypted === true || payload.encrypted === true || payload.payloadEncrypted === true,
});

const readWorkerCanonicalResultsAnalysisSource = async ({ env, slug, config, committedResponses = [], budget }) => {
  const index = getStorageIndexBinding(env);
  if (!index || typeof index.list !== 'function' || typeof index.get !== 'function') {
    return { ok: false, status: 501, error: 'Cloudflare storage index binding not configured.' };
  }
  const questionRows = await listCloudflareMetadataRows({ index, slug, resource: 'questions', budget, strict: true });
  const hiddenQuestionIds = await listHiddenStorageResourceIds({ index, slug, resource: 'questions', budget });
  const candidates = [];
  for (const row of questionRows) {
    const metadata = row?.metadata;
    if (!isObj(metadata) || metadata.hidden === true) continue;
    const version = {
      createdAtMs: Date.parse(trim(metadata.createdAt)) || 0,
      storageRefId: trim(metadata.id),
      uploader: trim(metadata.uploader),
      uploadAuthority: metadata.uploadAuthority,
    };
    const trustedId = lower(metadata.resourceId);
    // A version this audience cannot read can still be the current one, so it
    // competes too, and an older public version is not promoted in its place.
    if (metadata.encrypted === true || metadata.payloadEncrypted === true || !metadataAccessMatchesPublishedAudience(metadata, config)) {
      if (trustedId) candidates.push({ ...version, resourceId: trustedId, withheld: true });
      continue;
    }
    const payload = parseJsonBytes(await readStoredCloudflarePayloadBytes({ env, index, slug, metadata, budget }));
    if (!isObj(payload)) continue;
    if (!compareIdentity({ slug, config, suppliedSlug: payload.sessionSlug, suppliedSessionId: payload.sessionId || payload.sessionIdHex })) continue;
    // Key on the id the upload route checked for ownership (stored lower case).
    // Legacy rows without it read the payload id in the same order, id first,
    // so a second id field in the payload cannot claim another question.
    const payloadId = trim(payload.id || payload.questionId || payload.questionID);
    const normalized = normalizeQuestionRecord({
      ...payload,
      questionId: trustedId && lower(payloadId) !== trustedId ? trustedId : payloadId,
    });
    if (!normalized || hiddenQuestionIds.has(lower(normalized.questionId))) continue;
    candidates.push({ ...version, resourceId: normalized.questionId, question: normalized });
  }
  // Only an upload-time admin stamp can replace the earliest ordinary version.
  const questions = selectCanonicalStorageVersions(candidates)
    .filter((candidate) => !candidate.withheld)
    .map((candidate) => candidate.question);

  const rows = await listCloudflareMetadataRows({ index, slug, resource: 'responses', budget, strict: true });
  const responseRows = [];
  let excludedCount = 0;
  let lockedCount = 0;
  for (const row of rows) {
    const metadata = row?.metadata;
    if (!isObj(metadata) || !trim(metadata.responder)) {
      excludedCount += 1;
      continue;
    }
    // Encrypted bytes do not say which question they answer, so these rows
    // cannot be matched to an older answer.
    if (metadata.encrypted === true || metadata.payloadEncrypted === true) {
      excludedCount += 1;
      if (metadataAccessMatchesPublishedAudience(metadata, config)) lockedCount += 1;
      continue;
    }
    const bytes = await readStoredCloudflarePayloadBytes({ env, index, slug, metadata, budget });
    const payload = parseJsonBytes(bytes);
    if (!isObj(payload)) {
      excludedCount += 1;
      continue;
    }
    responseRows.push(toResponseRow(metadata, payload, config));
  }
  // After the stored rows: the queue holds a shortened copy, and on an exact tie
  // the first row stays. A queued row matters only until the listing shows it.
  for (const committed of Array.isArray(committedResponses) ? committedResponses : []) {
    budget.rows();
    budget.payload(jsonByteLength(committed));
    const metadata = committed?.metadata;
    const payload = committed?.payload;
    if (!isObj(metadata) || !isObj(payload) || !trim(metadata.responder)) {
      excludedCount += 1;
      continue;
    }
    responseRows.push(toResponseRow(metadata, payload, config));
  }
  const normalized = await normalizeSanitizedRows({ rows: responseRows, questions, slug, config, strictLocked: false, requireKnownQuestion: true });
  if (!normalized.ok) return normalized;
  return {
    ...normalized,
    counts: {
      ...normalized.counts,
      excludedCount: normalized.counts.excludedCount + excludedCount,
      lockedCount: normalized.counts.lockedCount + lockedCount,
    },
  };
};

export const loadWorkerCanonicalResultsAnalysisSource = async (args = {}) => {
  try {
    return await readWorkerCanonicalResultsAnalysisSource({ ...args, budget: createResultsAnalysisScanBudget() });
  } catch (error) {
    if (!isStorageReadLimitError(error)) return {
      ok: false, status: 503, reason: 'results_analysis_snapshot_unavailable',
      error: 'The complete results snapshot could not be read. No report was generated; the last successful report is unchanged. Retry after storage is available.',
    };
    // Retrying cannot shrink the session, so automatic runs pause instead.
    return {
      ok: false, status: 503, reason: 'results_analysis_snapshot_limit', retryable: false,
      error: 'The complete results snapshot exceeds the synchronous analysis limit. No report was generated; the last successful report is unchanged. A bounded background snapshot is required for this session.',
    };
  }
};

export const loadAdminSnapshotResultsAnalysisSource = async ({ body, slug, config } = {}) => {
  const snapshot = body?.source?.snapshot;
  if (!isObj(snapshot)) return { ok: false, status: 400, error: 'Missing admin results-analysis snapshot.' };
  if (!compareIdentity({ slug, config, suppliedSlug: snapshot.sessionSlug, suppliedSessionId: snapshot.sessionId || snapshot.sessionIdHex })) {
    return { ok: false, status: 400, error: 'Snapshot session identity does not match the target session.' };
  }
  return normalizeSanitizedRows({
    rows: snapshot.responses,
    questions: snapshot.questions,
    slug,
    config,
    strictLocked: true,
  });
};

const sourceKindFromBody = (body) => {
  const kind = trim(body?.source?.kind || body?.sourceKind || 'worker-canonical');
  return kind === 'admin-snapshot' ? 'admin-snapshot' : 'worker-canonical';
};

export const resolveResultsAnalysisSource = async ({ env, slug, config, body, trigger } = {}) => {
  const kind = sourceKindFromBody(body);
  if (trigger === 'automatic' && kind !== 'worker-canonical') {
    return { ok: false, status: 400, error: 'Automatic results analysis requires worker-canonical source.' };
  }
  if (kind === 'admin-snapshot') return loadAdminSnapshotResultsAnalysisSource({ body, slug, config });
  return loadWorkerCanonicalResultsAnalysisSource({ env, slug, config, committedResponses: body?.committedResponses });
};

const normalizeProviderResponse = async (response, now = Date.now()) => {
  const data = await response?.json?.().catch?.(() => ({}));
  if (!response?.ok) {
    const retryAfter = trim(response?.headers?.get?.('retry-after'));
    const seconds = Number(retryAfter);
    const retryAfterMs = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
    return { ok: false, status: response?.status || 502, error: data?.error || 'AI provider request failed.',
      ...(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? { retryAfterMs } : {}),
    };
  }
  const raw = trim(data?.completion || data?.text || data?.content || '');
  // A model without a JSON mode may wrap the object in a Markdown fence or a line of prose.
  for (const candidate of [raw, raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)]) {
    try {
      const value = JSON.parse(candidate);
      if (isObj(value)) return { ok: true, value };
    } catch {
      // Try the outermost braces next.
    }
  }
  return { ok: false, status: 502, retryable: false, error: 'AI provider returned invalid JSON.' };
};

export const resolveAnalysisAiPayload = ({ config, prompt }) => {
  const ai = isObj(config?.ai) ? config.ai : {};
  const providers = isObj(ai.providers) ? ai.providers : {};
  const { provider, model } = resolveSessionAiModel(config, { taskType: 'analysis', modelType: 'thinking' });
  const reasoningEffort = trim(
    ai?.taskReasoningEffort?.analysis || ai?.taskReasoningEffort?.generate || ai.reasoningEffort || ai.reasoning_effort || 'low',
  );
  const providerEntry = isObj(providers[provider]) ? providers[provider] : {};
  return {
    provider,
    model,
    taskType: 'analysis',
    prompt,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 6000,
    max_output_tokens: 6000,
    reasoning_effort: reasoningEffort,
    thinking: true,
    ...(provider === 'custom' && trim(providerEntry.functions) ? { functions: providerEntry.functions } : {}),
    ...(provider === 'custom' && trim(providerEntry.rpcUrl) ? { rpcUrl: trim(providerEntry.rpcUrl) } : {}),
  };
};

const withTimeout = async (promise, timeoutMs, message) => {
  const ms = Math.max(1_000, Number(timeoutMs || 0) || DEFAULT_RESULTS_ANALYSIS_PROVIDER_TIMEOUT_MS);
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const callResultsAnalysisProvider = async ({ env, slug, config, prompt, headers, deps } = {}) => {
  const payload = resolveAnalysisAiPayload({ config, prompt });
  const aiRequest = (deps?.normalizeAiRequestPayload || normalizeAiRequestPayload)({ payload });
  const provider = aiRequest.provider;
  const model = trim(payload.model);
  if (model && !isModelAllowed(model, provider)) {
    return { ok: false, status: 400, error: 'Model not allowed for provider' };
  }
  const secrets = await (deps?.getSessionSecrets ? deps.getSessionSecrets(env, slug) : getStoredSessionSecrets(env, slug)) || {};
  const proxyArgs = { payload, secrets, config, baseHeaders: headers };
  let response;
  const fetchImpl = deps?.fetch || globalThis.fetch?.bind(globalThis);
  const { safeFetch } = createOutboundUrlSafetyHelpersWithWorkerDeps({ deps: { fetch: fetchImpl } });
  const proxyDeps = { fetch: fetchImpl, safeFetch, json: deps?.json || jsonResponse };
  const runProvider = async () => {
    if (provider === 'anthropic') return (deps?.proxyAnthropic || ((args) => proxyAnthropicBoundary({ ...args, deps: proxyDeps })))(proxyArgs);
    if (provider === 'openrouter') return (deps?.proxyOpenRouter || ((args) => proxyOpenRouterBoundary({ ...args, deps: proxyDeps })))(proxyArgs);
    if (provider === 'custom') return (deps?.proxyCustomRPC || ((args) => proxyCustomRPCBoundary({ ...args, deps: proxyDeps })))({ ...proxyArgs, auth: { scopes: { ai: true, custom_rpc: true } } });
    return (deps?.proxyOpenAI || ((args) => proxyOpenAIBoundary({ ...args, deps: proxyDeps })))(proxyArgs);
  };
  response = await withTimeout(runProvider(), deps?.resultsAnalysisProviderTimeoutMs, 'AI results analysis generation timed out.');
  return normalizeProviderResponse(response, Number(deps?.now?.() ?? Date.now()));
};

export const normalizeGeneratedArtifact = ({ value, source, sections, generatedAt, model = '' }) => {
  const validationSource = {
    aiSnapshot: source?.aiSnapshot,
    participants: source?.participants,
    signature: source?.signature,
  };
  return normalizeResultsAnalysisArtifact({ value, source: validationSource, sections, generatedAt, model });
};

const buildSourceDescriptor = async ({ kind, source }) => {
  const canonical = {
    version: Number(SOURCE_VERSION),
    kind,
    snapshot: source.snapshot,
    counts: source.counts,
    aiSnapshot: source.aiSnapshot,
  };
  const signature = `sha256:${await sha256Hex(stableCanonicalSerialize(canonical))}`;
  return {
    ...canonical,
    signature,
    participants: source.participants || [],
    participantDigests: source.participantDigests,
    aiSnapshot: source.aiSnapshot,
  };
};

const buildReservationKey = async ({ sourceSignature, viewSignature }) => (
  `sha256:${await sha256Hex(stableCanonicalSerialize({ sourceSignature, viewSignature, version: ANALYSIS_ARTIFACT_VERSION }))}`
);

const filterDraftForStatus = (draft, includeDraft, config) => {
  const safe = publicDraft(draft, config);
  if (includeDraft) return safe;
  if (!isObj(safe)) return null;
  const { artifact, snapshot, ...rest } = safe;
  return rest;
};

const summarizeReservation = (reservation, requestId = '') => {
  if (!isObj(reservation)) return null;
  return {
    kind: trim(reservation.kind),
    ...(requestId ? { requestId } : {}),
  };
};

const analysisEligibility = (source) => {
  const counts = source?.counts || {};
  const reasons = [];
  if (Number(counts.aiInputParticipantCount || 0) < 2) reasons.push('Needs at least 2 participants in the AI input window.');
  if (Number(counts.aiInputQuestionCount || 0) < 1) reasons.push('Needs at least 1 answered question in the AI input window.');
  if (Number(counts.aiInputResponseCount || 0) < 3) reasons.push('Needs at least 3 submitted responses in the AI input window.');
  return { eligible: reasons.length === 0, reasons };
};

const summarizeActiveState = (active) => {
  if (!isObj(active)) return null;
  return {
    ...(trim(active.requestId) ? { requestId: trim(active.requestId) } : {}),
    ...(trim(active.trigger) ? { trigger: trim(active.trigger) } : {}),
    ...(Number.isFinite(Number(active.startedAtMs)) ? { startedAtMs: Number(active.startedAtMs) } : {}),
  };
};

const summarizeFailureState = (failure) => {
  if (!isObj(failure)) return null;
  return {
    ok: false,
    error: trim(failure.error) || 'Results analysis generation failed.',
    status: Number(failure.status || 0) || 502,
    ...(trim(failure.requestId) ? { requestId: trim(failure.requestId) } : {}),
    ...(trim(failure.trigger) ? { trigger: trim(failure.trigger) } : {}),
    ...(Number.isFinite(Number(failure.failedAtMs)) ? { failedAtMs: Number(failure.failedAtMs) } : {}),
    ...(Number(failure.retryAttempt) > 0 ? { retryAttempt: Number(failure.retryAttempt) } : {}),
    ...(Number(failure.nextAttemptAtMs) > 0 ? { nextAttemptAtMs: Number(failure.nextAttemptAtMs) } : {}),
    ...(failure.retriesExhausted === true ? { retriesExhausted: true } : {}),
  };
};

export const buildResultsAnalysisStatusBody = ({ slug, config, coordinatorState, includeDraft = true } = {}) => {
  const settings = getResultsAnalysisSettings(config);
  const capability = resolveResultsAnalysisCapability({ config });
  const state = coordinatorState?.state || {};
  return {
    ok: true,
    sessionSlug: normalizeWorkerSessionSlug(slug || config?.slug),
    sessionId: getCanonicalSessionId(config),
    settings,
    capability,
    state: {
      jobState: state.jobState || 'idle',
      active: summarizeActiveState(state.active),
      lastFailure: summarizeFailureState(state.lastFailure),
      lastGood: filterDraftForStatus(state.lastGood, includeDraft, config),
    },
  };
};

export const readResultsAnalysisAdminStatus = async ({ env, slug, config, includeDraft = true, deps } = {}) => {
  const readStatus = deps?.readCoordinatedResultsAnalysisStatus || readCoordinatedResultsAnalysisStatusDefault;
  const coordinatorState = await readStatus({ env, slug });
  return buildResultsAnalysisStatusBody({ slug, config, coordinatorState, includeDraft });
};

export const generateResultsAnalysisDraft = async ({ env, slug, config, body = {}, headers, trigger = 'manual', loadedSource, deps } = {}) => {
  const settings = getResultsAnalysisSettings(config);
  const capability = resolveResultsAnalysisCapability({ config });
  const sourceKind = sourceKindFromBody(body);
  if (trigger === 'automatic' && !['automatic', 'both'].includes(settings.generationMode)) {
    return { ok: false, status: 409, jobState: 'unsupported', error: 'Automatic results analysis is disabled for this session.', capability };
  }
  let coordinatorStateForRetry = null;
  if (trigger === 'manual' && !['manual', 'both'].includes(settings.generationMode)) {
    if (settings.generationMode === 'automatic') {
      const readStatusForRetry = deps?.readCoordinatedResultsAnalysisStatus || readCoordinatedResultsAnalysisStatusDefault;
      coordinatorStateForRetry = await readStatusForRetry({ env, slug });
    }
    const hasPriorFailure = !!coordinatorStateForRetry?.state?.lastFailure;
    if (!hasPriorFailure) {
      return { ok: false, status: 409, jobState: 'unsupported', error: 'Manual results analysis is disabled for this session.', capability };
    }
  }
  if (config?.scopes?.ai === false) {
    return { ok: false, status: 403, jobState: 'unsupported', error: 'AI scope is disabled for this session.', capability };
  }
  if (sourceKind === 'worker-canonical' && trigger === 'automatic' && !capability.automatic.supported) {
    return { ok: false, status: 409, jobState: 'unsupported', error: capability.automatic.reason, capability };
  }
  // An automatic trigger already loaded the complete bounded snapshot to check
  // its participant watermark. Reuse it so generation cannot scan a second,
  // different snapshot under a fresh budget. This is never read from the body.
  const source = loadedSource || await resolveResultsAnalysisSource({ env, slug, config, body, trigger });
  if (!source.ok) return { ok: false, status: source.status || 400, jobState: 'failed', error: source.error, capability };
  const eligibility = analysisEligibility(source);
  if (!eligibility.eligible) return { ok: false, status: 422, jobState: 'failed', error: 'Results analysis input is not eligible.', reasons: eligibility.reasons, capability };
  const sections = normalizeRequestedSections(body.sections, settings);
  if (!sections.length) return { ok: false, status: 400, jobState: 'failed', error: 'No supported results-analysis sections requested.', capability };
  const sourceDescriptor = await buildSourceDescriptor({ kind: sourceKind, source });
  const exposure = normalizedResultsProfile(config)?.exposure;
  const viewSignature = `sha256:${await sha256Hex(stableCanonicalSerialize({ sections, exposure, version: ANALYSIS_ARTIFACT_VERSION }))}`;
  const reservationKey = await buildReservationKey({ sourceSignature: sourceDescriptor.signature, viewSignature });
  const requestId = trim(body.requestId || body.id || '');
  const reserve = deps?.reserveCoordinatedResultsAnalysis || reserveCoordinatedResultsAnalysisDefault;
  const finalize = deps?.finalizeCoordinatedResultsAnalysis || finalizeCoordinatedResultsAnalysisDefault;
  const reservation = await reserve({
    env,
    slug,
    reservation: {
      requestId,
      reservationKey,
      sourceSignature: sourceDescriptor.signature,
      sourceVersion: SOURCE_VERSION,
      viewSignature,
      refresh: body.refresh === true,
      trigger,
    },
  });
  if (reservation?.kind === 'terminal') {
    return { ok: true, status: 200, jobState: 'succeeded', reservation: summarizeReservation(reservation, requestId), capability, draft: publicDraft(reservation.draft || reservation.receipt?.draft, config) };
  }
  if (reservation?.kind === 'pending') {
    return { ok: true, status: 202, jobState: 'running', reservation: summarizeReservation(reservation, requestId), capability };
  }
  if (reservation?.kind !== 'execute') {
    return { ok: false, status: reservation?.status || 503, jobState: 'failed', reservation: summarizeReservation(reservation, requestId), capability, error: reservation?.error || 'Results analysis generation is already pending.' };
  }

  const generatedAt = new Date(Number(deps?.now?.() || Date.now())).toISOString();
  const aiProvenance = resolveAnalysisAiPayload({ config, prompt: '' });
  let providerResult;
  try {
    providerResult = deps?.generateAnalysisArtifact
      ? await deps.generateAnalysisArtifact({ source, sections, generatedAt })
      : await callResultsAnalysisProvider({
          env,
          slug,
          config,
          // Results are shown to participants, so only context they may read is used.
          // It is outside the source signature: context edits never mark a report stale.
          prompt: buildResultsAnalysisPrompt({
            sections,
            input: source.aiSnapshot,
            exposure,
            contextText: await buildParticipantContextPrompt({ env, slug, config, deps, totalChars: RESULTS_CONTEXT_CHARS }),
          }),
          headers,
          deps,
        });
  } catch (error) {
    providerResult = { ok: false, status: 502, error: error?.message || 'AI results analysis generation failed.' };
  }
  if (!providerResult?.ok) {
    const failure = {
      ok: false,
      error: providerResult?.error || 'AI results analysis generation failed.',
      status: providerResult?.status || 502,
      ...(providerResult?.retryable === false ? { retryable: false } : {}),
      ...(Number.isFinite(providerResult?.retryAfterMs) && providerResult.retryAfterMs > 0 ? { retryAfterMs: providerResult.retryAfterMs } : {}),
      failedAt: generatedAt,
    };
    await finalize({
      env,
      slug,
      finalization: {
        requestId,
        reservationKey,
        attemptId: reservation.attemptId,
        success: false,
        receipt: failure,
      },
    });
    return { ...failure, jobState: 'failed', reservation: summarizeReservation(reservation, requestId), capability };
  }
  let artifact;
  try {
    artifact = normalizeGeneratedArtifact({
      value: providerResult.value || providerResult.artifact || providerResult,
      source: sourceDescriptor,
      sections,
      generatedAt,
      model: aiProvenance.model,
    });
    artifact = applyCurrentArtifactPolicy(artifact, config);
  } catch (error) {
    const failure = { ok: false, error: error?.message || 'AI results analysis output failed validation.', status: 502, retryable: false, failedAt: generatedAt };
    await finalize({ env, slug, finalization: { requestId, reservationKey, attemptId: reservation.attemptId, success: false, receipt: failure } });
    return { ...failure, jobState: 'failed', reservation: summarizeReservation(reservation, requestId), capability };
  }
  const draftId = `sha256:${await sha256Hex(stableCanonicalSerialize({ artifact, source: sourceDescriptor.snapshot, sections }))}`;
  const draft = {
    draftId,
    generatedAt,
    requestId,
    trigger,
    source: {
      kind: sourceKind,
      version: Number(SOURCE_VERSION),
      signature: sourceDescriptor.signature,
      ...source.counts,
    },
    sourceSignature: sourceDescriptor.signature,
    sourceVersion: SOURCE_VERSION,
    viewSignature,
    sections,
    artifact,
    snapshot: source.snapshot,
    participantWatermark: sourceDescriptor.participantDigests,
  };
  const finalization = await finalize({
    env,
    slug,
    finalization: {
      requestId,
      reservationKey,
      attemptId: reservation.attemptId,
      success: true,
      receipt: { ok: true, draft },
    },
  });
  if (!finalization?.ok) {
    return { ok: false, status: finalization?.status || 503, jobState: 'failed', reservation: summarizeReservation(reservation, requestId), capability, error: finalization?.error || 'Results analysis finalization failed.' };
  }
  return { ok: true, status: 200, jobState: 'succeeded', reservation: summarizeReservation(reservation, requestId), capability, draft: publicDraft(draft, config) };
};

export const maybeTriggerAutomaticResultsAnalysis = async ({ env, slug, config, committedResponses = [], requestId = '', deps } = {}) => {
  const settings = getResultsAnalysisSettings(config);
  if (!['automatic', 'both'].includes(settings.generationMode)) return { ok: true, skipped: true, reason: 'automatic_disabled' };
  const capability = resolveResultsAnalysisCapability({ config });
  if (!capability.automatic.supported) return { ok: true, skipped: true, reason: capability.automatic.reason };
  const readStatus = deps?.readCoordinatedResultsAnalysisStatus || readCoordinatedResultsAnalysisStatusDefault;
  const status = await readStatus({ env, slug });
  if (!status?.ok) return { ok: false, status: status?.status || 503, jobState: 'failed', error: status?.error || 'Results analysis status is unavailable; retry.' };
  // A failed automatic run pauses these runs, except for the retry the queue scheduled.
  const failure = status?.state?.lastFailure;
  if (failure?.trigger === 'automatic' && !(Number(failure.nextAttemptAtMs) <= Number(deps?.now?.() ?? Date.now()))) {
    return { ok: true, skipped: true, reason: 'automatic_paused_after_failure' };
  }
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug, config, committedResponses });
  if (!source.ok) return source;
  const watermark = new Set(Array.isArray(status?.state?.lastGood?.participantWatermark) ? status.state.lastGood.participantWatermark : []);
  const newDistinctCount = source.participantDigests.filter((digest) => !watermark.has(digest)).length;
  if (newDistinctCount < settings.autoAfter.threshold) {
    return { ok: true, skipped: true, reason: 'threshold_not_met', newDistinctCount, threshold: settings.autoAfter.threshold };
  }
  return generateResultsAnalysisDraft({
    env,
    slug,
    config,
    body: {
      requestId: trim(requestId) || `auto:${source.participantDigests.length}:${Date.now()}`,
      refresh: true,
      sections: normalizeRequestedSections([], settings),
      source: { kind: 'worker-canonical' },
      committedResponses,
    },
    trigger: 'automatic',
    loadedSource: source,
    deps,
  });
};


// Queued work is admitted against the coordinator's authoritative config, the
// policy HTTP routes enforce; the KV projection can lag a disabled AI scope.
export const runQueuedAutomaticResultsAnalysisJob = async ({ env, slug, job = {}, deps } = {}) => {
  const targetSlug = normalizeWorkerSessionSlug(slug || job.slug);
  let config;
  try {
    if (typeof deps?.getSessionConfig !== 'function') throw new Error('missing authority');
    config = await deps.getSessionConfig(env, targetSlug);
  } catch {
    return { ok: false, status: 503, jobState: 'failed', error: 'Session config authority is unavailable; retry.' };
  }
  if (!config) return { ok: false, status: 404, jobState: 'failed', error: 'Session config not found.' };
  return maybeTriggerAutomaticResultsAnalysis({
    env,
    slug: targetSlug,
    config,
    committedResponses: Array.isArray(job.committedResponses) ? job.committedResponses : [],
    requestId: job.requestId,
    deps,
  });
};


const normalizedResultsProfile = (config = {}) => {
  const normalizedConfig = normalizeWorkerConfigRecord(config || {}, { slug: normalizeWorkerSessionSlug(config?.slug) });
  return isObj(normalizedConfig?.sessionModeProfile?.results) ? normalizedConfig.sessionModeProfile.results : {};
};

const resolveResultsVisibility = (config = {}) => lower(normalizedResultsProfile(config).visibility);

const aggregateResultsEnabled = (config = {}) => normalizedResultsProfile(config)?.exposure?.aggregateResultsEnabled === true;

export const evaluateResultsAnalysisViewerEligibility = ({ config } = {}) => {
  if (!aggregateResultsEnabled(config)) {
    return { ok: false, status: 403, reason: 'aggregate_results_disabled', error: 'Aggregate results are not enabled for this session.' };
  }
  const visibility = resolveResultsVisibility(config);
  if (visibility !== 'public_full_if_storage_public') {
    return {
      ok: false,
      status: 403,
      reason: visibility === 'private_admin' ? 'private_admin_requires_admin_status' : 'results_visibility_unsupported',
      error: 'Generated results analysis viewer access is only supported for public full results backed by storage gates.',
    };
  }
  return { ok: true, visibility };
};

export const readPublishedResultsAnalysisArtifact = async ({ env, slug, config, includeSnapshot = true, deps } = {}) => {
  const readStatus = deps?.readCoordinatedResultsAnalysisStatus || readCoordinatedResultsAnalysisStatusDefault;
  const coordinatorState = await readStatus({ env, slug });
  // Stored artifacts outlive their creation policy. Reapply current privacy and
  // visibility settings on every read, including artifacts created by older Workers.
  const lastGood = publicDraft(coordinatorState?.state?.lastGood, config);
  if (!lastGood?.artifact) {
    return {
      ok: false,
      status: 404,
      jobState: coordinatorState?.state?.jobState || 'idle',
      error: 'No generated results analysis artifact is available yet.',
    };
  }
  return {
    ok: true,
    status: 200,
    sessionSlug: normalizeWorkerSessionSlug(slug || config?.slug),
    sessionId: getCanonicalSessionId(config),
    jobState: coordinatorState?.state?.jobState || 'succeeded',
    generatedAt: lastGood.generatedAt,
    source: lastGood.source,
    artifact: lastGood.artifact,
    ...(includeSnapshot ? { snapshot: lastGood.snapshot } : {}),
  };
};
