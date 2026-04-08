/** @file SurveyResults.tsx */

import React, { Component, Suspense } from 'react';
import { connect } from 'react-redux';
import {
  Button,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  FormGroup,
  Label,
  Input,
  Form,
  Card,
  CardHeader,
  CardBody,
  FormText,
  InputGroup,
  InputGroupText,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Collapse,
  Alert,
  Table,
  Progress
} from 'reactstrap';


import "../../assets/css/contextEngine.scss";
import styles from './SurveyResults.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookmark,
  faCaretUp,
  faCaretDown,
  faCheck,
  faTimes,
  faArrowLeft,
  faArrowRight,
  faQuestionCircle,
  faSpinner,
  faSearch,
  faExpand,
  faExternalLinkAlt,
  faFilter,
  faExclamationCircle,
  faSyncAlt,
  faComments,
  faLock
} from '@fortawesome/free-solid-svg-icons';

import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug,
} from '../../utilities/web3/contractScripts.js';
import { getShortenedAddress, getShortenedQuestionID, getShortenedSurveyID } from 'utilities/ui/displayHelpers.js';
import SBTFilter from '../SBTs/SBTFilter';
import QuestionFilter from './QuestionFilter';
import PolisReport from '../PolisReport/PolisReport';
import SingleQuestionResponse from './SingleQuestionResponse';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { createLogger } from 'utilities/logging.js';
import {
  buildQuestionRoutePath,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  subscribeCacheUpdates,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import LazyFallback from '../Shared/LazyFallback';
import {
  resolveSurveyResultsExplicitSessionSlug,
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
  scanSurveyResultsSessionSlugFromCache,
} from './surveyResultsSessionResolution.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';

const surveyLog = createLogger('surveys');
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const DebateMapAny: any = DebateMap;
const LATEST_BLOCK_POLL_THROTTLE_MS = 8000;
const RESPONSE_PARSE_MEMO_MAX_SIZE = 500;
const LOCAL_STORAGE_POLL_MIN_MS = 2000;
const LOCAL_STORAGE_POLL_MID_MS = 4000;
const LOCAL_STORAGE_POLL_MAX_MS = 12000;
const LOCAL_STORAGE_FORCE_RESCAN_EVERY = 6;
const EXPORT_TYPES = Object.freeze({
  CSV_QUESTIONS: 'csv-questions',
  CSV_QUESTIONS_AND_RESPONSES: 'csv-questions-and-responses',
  JSON_QUESTIONS: 'json-questions',
  JSON_QUESTIONS_AND_RESPONSES: 'json-questions-and-responses',
});
const EXPORT_TYPE_LABELS: Record<string, string> = Object.freeze({
  [EXPORT_TYPES.CSV_QUESTIONS]: 'CSV: Questions',
  [EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES]: 'CSV: Questions + Responses',
  [EXPORT_TYPES.JSON_QUESTIONS]: 'JSON: Questions',
  [EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES]: 'JSON: Questions + Responses',
});
const EXPORT_OPTIONS = Object.freeze([
  { value: EXPORT_TYPES.CSV_QUESTIONS, label: EXPORT_TYPE_LABELS[EXPORT_TYPES.CSV_QUESTIONS] },
  {
    value: EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
    label: EXPORT_TYPE_LABELS[EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES],
  },
  { value: EXPORT_TYPES.JSON_QUESTIONS, label: EXPORT_TYPE_LABELS[EXPORT_TYPES.JSON_QUESTIONS] },
  {
    value: EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES,
    label: EXPORT_TYPE_LABELS[EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES],
  },
]);

const getExportTypeLabel = (value: any = '') => (
  EXPORT_TYPE_LABELS[String(value || '').trim()] || String(value || '').trim()
);

const scheduleMicrotask = (cb: any) => {
  if (typeof cb !== 'function') return;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(cb);
    return;
  }
  Promise.resolve().then(cb);
};

const normalizeSignatureValue = (value: any, trail: any = new WeakSet()): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return `__bigint:${value.toString(10)}`;
  if (typeof value !== 'object') return value;
  if (trail.has(value)) return '__circular__';
  trail.add(value);
  if (Array.isArray(value)) {
    const arr: any[] = value.map((entry: any) => normalizeSignatureValue(entry, trail));
    trail.delete(value);
    return arr;
  }
  const out: Record<string, any> = {};
  Object.keys(value).sort().forEach((key: any) => {
    out[key] = normalizeSignatureValue(value[key], trail);
  });
  trail.delete(value);
  return out;
};

const stableSerializeSignatureValue = (value: any) => {
  try {
    return JSON.stringify(normalizeSignatureValue(value));
  } catch (_) {
    try {
      return String(value);
    } catch (_) {
      return '[[unserializable]]';
    }
  }
};

const mixSurveySignatureHash = (seed: any, text: any) => {
  let hash = Number(seed) >>> 0;
  const input = String(text || '');
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619) >>> 0;
  }
  return hash >>> 0;
};

const buildSurveyResponderPayloadSignature = (payload: any) => {
  if (typeof payload === 'string') return `s:${payload}`;
  return `o:${stableSerializeSignatureValue(payload)}`;
};

const buildSurveyRespondersSignature = (surveyResponsesByResponder: any = {}) => {
  const responders = Object.keys(surveyResponsesByResponder || {})
    .sort((a: any, b: any) => String(a).localeCompare(String(b)));
  let hash = 2166136261;
  responders.forEach((responder: any) => {
    const responderLower = String(responder || '').toLowerCase();
    hash = mixSurveySignatureHash(hash, responderLower);
    hash = mixSurveySignatureHash(
      hash,
      buildSurveyResponderPayloadSignature(surveyResponsesByResponder?.[responder])
    );
  });
  return `${responders.length}:${hash >>> 0}`;
};

const surveyResponderPayloadRefIds = new WeakMap();
let surveyResponderPayloadRefSeq = 1;

const getSurveyResponderPayloadRefId = (value: any) => {
  if (!value || typeof value !== 'object') {
    return `p:${typeof value}:${String(value)}`;
  }
  let refId = surveyResponderPayloadRefIds.get(value);
  if (!refId) {
    refId = surveyResponderPayloadRefSeq;
    surveyResponderPayloadRefSeq += 1;
    surveyResponderPayloadRefIds.set(value, refId);
  }
  return `o:${refId}`;
};

const buildSurveyRespondersPayloadRefSignature = (surveyResponsesByResponder: any = {}) => {
  const responders = Object.keys(surveyResponsesByResponder || {})
    .sort((a: any, b: any) => String(a).localeCompare(String(b)));
  let hash = 2166136261;
  responders.forEach((responder: any) => {
    const responderLower = String(responder || '').toLowerCase();
    hash = mixSurveySignatureHash(hash, responderLower);
    const payload = surveyResponsesByResponder?.[responder];
    if (typeof payload === 'string') {
      hash = mixSurveySignatureHash(hash, `s:${payload.length}:${payload}`);
      return;
    }
    hash = mixSurveySignatureHash(hash, getSurveyResponderPayloadRefId(payload));
    const payloadResponses = Array.isArray(payload?.responses) ? payload.responses : [];
    hash = mixSurveySignatureHash(hash, `r:${payloadResponses.length}`);
    payloadResponses.forEach((entry: any) => {
      hash = mixSurveySignatureHash(hash, getSurveyResponderPayloadRefId(entry));
    });
  });
  return `${responders.length}:${hash >>> 0}`;
};


/**
* Helper that merges aggregator keys in lowercase, ensuring zero-response question IDs are included.
*/
function unifyAggregatorWithAllQuestionIDs(baseAggregator: any, allKnownQuestionIds: any = []) {
  const loweredMap: Record<string, any> = {};
  for (const key of Object.keys(baseAggregator)) {
    const lowerKey = key.toLowerCase();
    if (!loweredMap[lowerKey]) {
      loweredMap[lowerKey] = baseAggregator[key];
    } else {
      loweredMap[lowerKey] = loweredMap[lowerKey].concat(baseAggregator[key]);
    }
  }
  for (const qId of allKnownQuestionIds) {
    const qLower = qId.toLowerCase();
    if (!loweredMap[qLower]) {
      loweredMap[qLower] = [];
    }
  }
  return loweredMap;
}

const INVALID_RESPONSE_TIMESTAMP = Number.NEGATIVE_INFINITY;

const normalizeResponseTimestampMs = (value: any) => {
  if (value === null || value === undefined || value === '') return INVALID_RESPONSE_TIMESTAMP;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return INVALID_RESPONSE_TIMESTAMP;
    return Math.abs(value) < 1e12 ? Math.floor(value * 1000) : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return INVALID_RESPONSE_TIMESTAMP;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return INVALID_RESPONSE_TIMESTAMP;
      return Math.abs(numeric) < 1e12 ? Math.floor(numeric * 1000) : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? INVALID_RESPONSE_TIMESTAMP : parsed;
  }
  return INVALID_RESPONSE_TIMESTAMP;
};

const getSurveyResponseQuestionId = (row: any = {}) => (
  String(row?.questionID || row?.questionId || '').trim().toLowerCase()
);

const getSurveyResponseEntryTimestampMs = (row: any = {}) => (
  normalizeResponseTimestampMs(row?.timestamp ?? row?.timeStamp)
);

const getSurveyResponsePayloadTimestampMs = (payload: any = {}) => (
  normalizeResponseTimestampMs(payload?.timestamp ?? payload?.timeStamp)
);

const getSurveyResponseAggregateTimestampMs = (row: any = {}, payload: any = {}) => {
  const entryTimestamp = getSurveyResponseEntryTimestampMs(row);
  const payloadTimestamp = getSurveyResponsePayloadTimestampMs(payload);
  // Regression guard: merged survey payloads can advance the top-level recency
  // without rewriting preserved per-question rows. Keep the newer of the two so
  // stale row timestamps do not pin an older answer ahead of a newer payload edit.
  if (
    entryTimestamp === INVALID_RESPONSE_TIMESTAMP &&
    payloadTimestamp === INVALID_RESPONSE_TIMESTAMP
  ) {
    return 0;
  }
  if (entryTimestamp === INVALID_RESPONSE_TIMESTAMP) return payloadTimestamp;
  if (payloadTimestamp === INVALID_RESPONSE_TIMESTAMP) return entryTimestamp;
  return Math.max(entryTimestamp, payloadTimestamp);
};

const isSurveyQuestionResponseNewer = (candidate: any, existing: any) => {
  // Regression guard: current client edits may advance only the payload timestamp.
  // Compare effective recency first, then payload recency, and let later array
  // order win within the same payload revision so stale per-answer timestamps do
  // not pin an older answer ahead of a newer payload-backed edit.
  if (candidate.aggregateTimestampMs !== existing.aggregateTimestampMs) {
    return candidate.aggregateTimestampMs > existing.aggregateTimestampMs;
  }
  if (candidate.payloadTimestampMs !== existing.payloadTimestampMs) {
    return candidate.payloadTimestampMs > existing.payloadTimestampMs;
  }
  if (
    candidate.payloadTimestampMs !== INVALID_RESPONSE_TIMESTAMP &&
    candidate.payloadTimestampMs === existing.payloadTimestampMs
  ) {
    return candidate.index >= existing.index;
  }
  if (candidate.entryTimestampMs !== existing.entryTimestampMs) {
    return candidate.entryTimestampMs > existing.entryTimestampMs;
  }
  return candidate.index >= existing.index;
};

const normalizeSurveyResponsePayloadByQuestionId = (payload: any) => {
  const source = (payload && typeof payload === 'object') ? payload : null;
  if (!source) return payload;
  if (!Array.isArray(source.responses)) return { ...source };

  const payloadTimestampMs = getSurveyResponsePayloadTimestampMs(source);
  const passthroughRows: any[] = [];
  const latestByQuestionId: any = new Map();

  source.responses.forEach((row: any, index: any) => {
    const clonedRow = (row && typeof row === 'object') ? { ...row } : row;
    const questionId = getSurveyResponseQuestionId(row);
    if (!questionId) {
      passthroughRows.push({
        index,
        orderIndex: index,
        row: clonedRow,
      });
      return;
    }

    const candidate = {
      index,
      orderIndex: index,
      row: clonedRow,
      entryTimestampMs: getSurveyResponseEntryTimestampMs(row),
      payloadTimestampMs,
      aggregateTimestampMs: getSurveyResponseAggregateTimestampMs(row, source),
    };
    const existing = latestByQuestionId.get(questionId);
    if (!existing || isSurveyQuestionResponseNewer(candidate, existing)) {
      latestByQuestionId.set(questionId, {
        ...candidate,
        // Keep the original slot while replacing only the row contents.
        orderIndex: existing?.orderIndex ?? index,
      });
    }
  });

  const normalizedResponses = [
    ...passthroughRows,
    ...Array.from(latestByQuestionId.values()),
  ]
    .sort((left: any, right: any) => left.orderIndex - right.orderIndex)
    .map((entry: any) => entry.row);

  return {
    ...source,
    responses: normalizedResponses,
  };
};

/** Prefix-preserver used by SurveySelector */
const readPathSearch = (path: any = '') => {
  const value = String(path || '');
  const queryIndex = value.indexOf('?');
  return queryIndex >= 0 ? value.slice(queryIndex) : '';
};

const hasExplicitSessionQueryPinInPath = (path: any = '') => {
  const search = readPathSearch(path);
  return (
    parseQuestionSessionSlugFromSearch(search) !== null ||
    parseQuestionSessionIdFromSearch(search) !== null
  );
};

function applyExistingGroupPrefix(newPath: any) {
  try {
    if (hasExplicitSessionQueryPinInPath(newPath)) return newPath;
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    const pathOnly = p.split('?')[0].split('#')[0];
    const segs = pathOnly.split('/').filter(Boolean);
    const RESERVED: any = new Set(['questions','question','survey','surveys']);
    if (segs.length >= 2 && !RESERVED.has(segs[0])) {
      const base = `/${segs[0]}/${segs[1]}`;
      if (!newPath.startsWith(base)) {
        return `${base}${newPath.startsWith('/') ? '' : '/'}${newPath}`;
      }
    }
  } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
  return newPath;
}

function resolveNetBucketReadOnly(cacheObj: any, netIdStr: any, fallbackValue: any) {
  const fallback = fallbackValue === undefined ? {} : fallbackValue;
  if (!cacheObj || typeof cacheObj !== 'object' || !netIdStr) return fallback;
  const bucket = cacheObj[netIdStr];
  return (bucket && typeof bucket === 'object') ? bucket : fallback;
}

const EMPTY_SCOPED_QUESTION_NETWORK_DATA = Object.freeze({
  questions: {},
  questionResponses: {},
  questionsLatestBlock: 0,
  questionResponsesLatestBlock: 0,
});

function mergeQuestionResponsesByQuestion(accumulator: any = {}, questionResponses: any = {}, options: any = {}) {
  const target = (accumulator && typeof accumulator === 'object') ? accumulator : {};
  const source = (questionResponses && typeof questionResponses === 'object') ? questionResponses : {};
  const allowedQuestionIds = options.allowedQuestionIds instanceof Set
    ? options.allowedQuestionIds
    : null;
  Object.keys(source).forEach((questionId: any) => {
    const lowerQuestionId = String(questionId || '').trim().toLowerCase();
    if (!lowerQuestionId) return;
    if (allowedQuestionIds && !allowedQuestionIds.has(lowerQuestionId)) return;
    const responderMap = source[questionId];
    if (!responderMap || typeof responderMap !== 'object') return;
    if (!target[lowerQuestionId] || typeof target[lowerQuestionId] !== 'object') {
      target[lowerQuestionId] = {};
    }
    Object.keys(responderMap).forEach((responder: any) => {
      target[lowerQuestionId][responder] = responderMap[responder];
    });
  });
  return target;
}

const hasAuthoritativeQuestionSessionSlug = (question: any = {}) => (
  hasOwn(question, 'sessionSlug') && question?.sessionSlugExplicit === true
);

const resolveScopedQuestionSessionSlug = (question: any = {}, bucketSlug: any = '') => {
  const normalizedBucketSlug = normalizeSessionSlug(bucketSlug || '');
  const normalizedQuestionSlug = normalizeSessionSlug(question?.sessionSlug || '');
  if (hasAuthoritativeQuestionSessionSlug(question)) return normalizedQuestionSlug;
  if (hasOwn(question, 'sessionSlug') && question?.sessionSlugExplicit === false) {
    return normalizedBucketSlug;
  }
  return normalizedQuestionSlug || normalizedBucketSlug;
};

const shouldKeepScopedQuestion = ({
  question = {},
  bucketSlug = '',
  allowedScopeSlugs = [],
  requireAuthoritativeBinding = false,
}: any = {}) => {
  const scopeSet = allowedScopeSlugs instanceof Set
    ? allowedScopeSlugs
    : new Set(
      (Array.isArray(allowedScopeSlugs) ? allowedScopeSlugs : [])
        .map((slug: any) => normalizeSessionSlug(slug || ''))
    );
  if (!scopeSet.size) return true;
  const normalizedQuestionSlug = normalizeSessionSlug(question?.sessionSlug || '');
  if (requireAuthoritativeBinding) {
    return hasAuthoritativeQuestionSessionSlug(question) && scopeSet.has(normalizedQuestionSlug);
  }
  return scopeSet.has(resolveScopedQuestionSessionSlug(question, bucketSlug));
};

function mergeScopedQuestionNetworkData(networkEntries: any = [], options: any = {}) {
  if (!Array.isArray(networkEntries) || networkEntries.length === 0) {
    return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
  }

  const mergedQuestions: Record<string, any> = {};
  const mergedQuestionResponses: Record<string, any> = {};
  const allowedScopeSlugs = options.allowedScopeSlugs instanceof Set
    ? options.allowedScopeSlugs
    : new Set(
      (Array.isArray(options.allowedScopeSlugs) ? options.allowedScopeSlugs : [])
        .map((slug: any) => normalizeSessionSlug(slug || ''))
    );
  const requireAuthoritativeBinding = options.requireAuthoritativeBinding === true;
  let questionsLatestBlock = 0;
  let questionResponsesLatestBlock = 0;

  networkEntries.forEach(({ slug = '', bucket = {} }: any) => {
    const questionBucket = (bucket && typeof bucket === 'object') ? bucket : {};
    const allowedQuestionIds: any = new Set();
    const questions = (
      questionBucket.questions && typeof questionBucket.questions === 'object'
        ? questionBucket.questions
        : {}
    );
    Object.keys(questions).forEach((questionId: any) => {
      const lowerQuestionId = String(questionId || '').trim().toLowerCase();
      if (!lowerQuestionId) return;
      const question = questions[questionId];
      if (!shouldKeepScopedQuestion({
        question,
        bucketSlug: slug,
        allowedScopeSlugs,
        requireAuthoritativeBinding,
      })) return;
      allowedQuestionIds.add(lowerQuestionId);
      if (Object.prototype.hasOwnProperty.call(mergedQuestions, lowerQuestionId)) return;
      mergedQuestions[lowerQuestionId] = {
        id: question?.id || questionId,
        ...(question || {}),
        sessionSlug: resolveScopedQuestionSessionSlug(question, slug),
      };
    });

    mergeQuestionResponsesByQuestion(
      mergedQuestionResponses,
      questionBucket.questionResponses || {},
      { allowedQuestionIds }
    );
    questionsLatestBlock = Math.max(questionsLatestBlock, Number(questionBucket.questionsLatestBlock || 0));
    questionResponsesLatestBlock = Math.max(
      questionResponsesLatestBlock,
      Number(questionBucket.questionResponsesLatestBlock || 0)
    );
  });

  return {
    questions: mergedQuestions,
    questionResponses: mergedQuestionResponses,
    questionsLatestBlock,
    questionResponsesLatestBlock,
  };
}

const normalizeNonceKey = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasOwn = (obj: any, key: any) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);

const normalizeGateSbtEntries = (gate: any = null) => {
  const out: any[] = [];
  const seen: any = new Set();
  const push = (address: any, label: any = '') => {
    const normalizedAddress = typeof address === 'string'
      ? address.trim()
      : address == null
        ? ''
        : String(address).trim();
    if (!normalizedAddress) return;
    const key = normalizedAddress.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      address: normalizedAddress,
      label: typeof label === 'string' ? label.trim() : '',
    });
  };

  if (Array.isArray(gate?.sbts)) {
    gate.sbts.forEach((entry: any) => {
      if (typeof entry === 'string') {
        push(entry);
        return;
      }
      push(
        entry?.address || entry?.sbtAddress || '',
        entry?.label || entry?.name || entry?.title || ''
      );
    });
  }

  if (Array.isArray(gate?.sbtAddresses)) {
    gate.sbtAddresses.forEach((address: any) => push(address));
  }
  if (gate?.sbtAddress) push(gate.sbtAddress);

  return out;
};

const hasEnvelopeShape = (value: any) => {
  if (!value || typeof value !== 'object') return false;
  return [
    'ciphertext',
    'encryptedString',
    'encryptedData',
    'dataToEncryptHash',
    'accessControlConditions',
    'chain',
    'iv',
    'salt',
  ].some((key: any) => hasOwn(value, key));
};

const extractEnvelopeCandidate = (field: any) => {
  if (!field || typeof field !== 'object') return null;

  const directEnvelope = field.encryptedPortion || field.envelope || field.encryptedEnvelope || null;
  if (typeof directEnvelope === 'string' && directEnvelope.trim()) return directEnvelope.trim();
  if (directEnvelope && typeof directEnvelope === 'object') return directEnvelope;

  if (field.payload && typeof field.payload === 'object' && hasEnvelopeShape(field.payload)) {
    return field.payload;
  }
  if (field.valueEnvelope && typeof field.valueEnvelope === 'object' && hasEnvelopeShape(field.valueEnvelope)) {
    return field.valueEnvelope;
  }

  if (hasEnvelopeShape(field)) return field;
  return null;
};

const hasVisibleFieldValue = (field: any) => {
  if (!field || typeof field !== 'object' || !hasOwn(field, 'value')) return false;
  if (field.value === '*') return false;
  if (field.value === null || field.value === undefined) return false;
  return true;
};

const isLockedEncryptedField = (field: any) => {
  if (!field || typeof field !== 'object') return false;
  const flaggedLocked = field.locked === true;
  const flaggedEncrypted = field.isEncrypted === true || field.encrypted === true;
  const envelope = extractEnvelopeCandidate(field);
  if (!flaggedLocked && !flaggedEncrypted && !envelope) return false;
  if (flaggedLocked) return true;
  return !hasVisibleFieldValue(field);
};

const getFieldEncryptionAudience = (field: any) => (
  typeof field === 'object' && field
    ? String(field.encryptionAudience || '').trim().toLowerCase()
    : ''
);

const isBannerEligibleLockedField = (field: any) => (
  isLockedEncryptedField(field) && getFieldEncryptionAudience(field) !== 'self'
);

const normalizeGateText = (value: any) => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (/^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};

const buildLockedResponseSignature = (response: any = {}) => stableSerializeSignatureValue({
  questionId: response?.questionID || response?.questionId || '',
  timestamp: response?.timeStamp || response?.timestamp || 0,
  answerHash: response?.answer?.hash || '',
  additionalHash: response?.additional?.hash || '',
  answerValue: response?.answer?.value,
  additionalValue: response?.additional?.value,
  answerEncrypted: response?.answer?.encrypted,
  additionalEncrypted: response?.additional?.encrypted,
  answerEnvelope: extractEnvelopeCandidate(response?.answer),
  additionalEnvelope: extractEnvelopeCandidate(response?.additional),
  importanceEncrypted: response?.importanceEncrypted || '',
  convictionEncrypted: response?.convictionEncrypted || '',
});

export const countQuestionModeResponses = (aggregatorByQuestion: any = {}, questionLookup: any = {}) => {
  let total = 0;
  Object.keys(aggregatorByQuestion || {}).forEach((questionId: any) => {
    const rows = Array.isArray(aggregatorByQuestion[questionId]) ? aggregatorByQuestion[questionId] : [];
    const questionType = String(
      questionLookup?.[String(questionId || '').toLowerCase()]?.type || ''
    ).toLowerCase();
    rows.forEach((row: any) => {
      const parsedResponse = row?.response;
      if (isFreeformBlankAnswer(questionType, parsedResponse)) return;
      total += 1;
    });
  });
  return total;
};

export const hasAnyCountableSurveyAnswer = (parsedSurveyResponse: any, questionLookup: any = {}) => {
  const answers = Array.isArray(parsedSurveyResponse?.responses)
    ? parsedSurveyResponse.responses
    : [];
  if (answers.length === 0) return false;
  for (let i = 0; i < answers.length; i += 1) {
    const answer = answers[i];
    const qid = String(answer?.questionID || answer?.questionId || '').toLowerCase();
    const questionType = String(questionLookup?.[qid]?.type || '').toLowerCase();
    if (isFreeformBlankAnswer(questionType, answer)) continue;
    return true;
  }
  return false;
};

const getFilterStateSignature = (filterState: any) => serializeFilterState(filterState) || '';
const areValuesEquivalentBySignature = (currentValue: any, nextValue: any) => {
  if (currentValue === nextValue) return true;
  if (currentValue == null || nextValue == null) return currentValue === nextValue;
  if (typeof currentValue !== 'object' && typeof nextValue !== 'object') {
    return currentValue === nextValue;
  }
  return stableSerializeSignatureValue(currentValue) === stableSerializeSignatureValue(nextValue);
};

const getConvictionValue = (obj: any) => {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.conviction !== undefined && obj.conviction !== null) return obj.conviction;
  if (obj.importance !== undefined && obj.importance !== null) return obj.importance;
  return '';
};

const getResponseQuestionId = (obj: any) => String(obj?.questionID || obj?.questionId || '').trim();

const getResponseQuestionPrompt = (obj: any, questionData: any = null) => (
  obj?.prompt || questionData?.prompt || ''
);

const getResponseQuestionType = (obj: any, questionData: any = null) => (
  obj?.type || questionData?.type || ''
);


/**
 * A single place to generate the DOM id used
 * by every question-card element.
 *  – always lower-cases the questionId
 *  – strips characters that are invalid in an HTML id
 */
const getQuestionCardDomId = (questionId: any = '') =>
  `questionCard-${questionId.toLowerCase()}`;

class SurveyResults extends Component<any, any> {
  [key: string]: any;

  constructor(props: any) {
    super(props);

    const initialSlug = resolveSurveyResultsExplicitSessionSlug(props) ?? '';
    let parsedCache;
    const defaultCache = { surveys: [], questions: [] };

    try {
      parsedCache = peekCacheSync('bookmarksCache', initialSlug, { clone: false });
      if (
        !parsedCache ||
        typeof parsedCache !== 'object' ||
        !Array.isArray(parsedCache.surveys) ||
        !Array.isArray(parsedCache.questions)
      ) {
        parsedCache = defaultCache;
      }
    } catch (error) {
      surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
      parsedCache = defaultCache;
    }

    this._syncLoadingStartedAt = null;
    this._scrollMutationObserver = null;
    this._scrollToQuestionRetryTimer = null;

    this.state = {
      responses: [],
      sbtFilteredResponses: [],
      csvData: '',
      exportType: EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES,
      alertMessage: '',
      loading: false,
      surveyTitle: '',
      surveyDocumentURLs: [],
      surveyId: '', // This will be set from props or determined logic
      activeQuestionToggles: {},
      questionResponses: {},
      sbtFilteredQuestionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      viewMode: this.props.viewMode, // 'survey' or 'questions'
      filterLoading: false,
      showQuestionFilter: false,
      filterState: this.props.filterState || {},
      syncDetailsOpen: false,
      bookmarkedQuestionIDs: Array.isArray(parsedCache.questions) ? [...parsedCache.questions] : [],
      bookmarkedSurveyIDs: Array.isArray(parsedCache.surveys) ? [...parsedCache.surveys] : [],
      questionIdSortBy: 'responses',
      questionIdSortAsc: true,
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredResponsesCount: 0,
      surveyViewMode: 'individuals', // aggregator vs. individuals
      exportAreaOpen: false,
      aggregateQuestionResponses: {},
      questionResultsHydrated: false,
      surveyResultsHydrated: false,

      // chunk-based progress placeholders (not fully used)
      questionPartialLoading: false,
      questionPartialProgress: 0,
      questionPartialTotal: 0,

      responsePartialLoading: false,
      responsePartialProgress: 0,
      responsePartialTotal: 0,
      networkLatestBlock: 0,

      // We track local blocks for question & survey data
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      surveyLocalBlock: 0,

      // track how many questions & responses are cached
      cachedQuestionsCount: 0,
      cachedSurveyResponsesCount: 0,

      // block targets for manual refresh
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      refreshTargetSurveyBlock: 0,

      activeToggles: {},
      filterBookmarkedFeedback: false,
      filteredQuestionsCount: this.props.filteredQuestionsCount === undefined ? null : this.props.filteredQuestionsCount,
      isFilterActive: false,
      lockedResponseDetailsOpen: false,
      lockedResponsesDecrypting: false,
      decryptedResponseOverrides: {},
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
    };

    this.questionIdTableRef = React.createRef();
    this.questionFilterRef = React.createRef();
    this._isMounted = false;
    this._questionFilterQuestionsMemo = {
      questionResponsesRef: null,
      networkQuestionsRef: null,
      questionResponsesNonceKey: null,
      questionsCacheNonceKey: null,
      result: [],
    };
    this._questionTableEntriesMemo = {
      questionMapRef: null,
      networkQuestionsRef: null,
      sortBy: '',
      sortAsc: true,
      result: [],
    };
    this._lockedResponsesModelMemo = {
      viewMode: '',
      surveyViewMode: '',
      responsesRef: null,
      aggregatorRef: null,
      questionLookupRef: null,
      overridesRef: null,
      slug: '',
      result: {
        lockedRows: [],
        lockedCount: 0,
        gateDetails: [],
        hasGenericGateMessage: false,
      },
    };
    this._fetchResponsesInFlight = false;
    this._fetchResponsesQueued = false;
    this._fetchResponsesRequestScheduled = false;
    this._localStoragePollingIntervalId = null;
    this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MIN_MS;
    this._localStoragePollingStableCycles = 0;
    this._lastLocalStoragePollCoarseSignature = '';
    this._lastLocalStoragePollDetailedSignature = '';
    this._lastPolledQuestionsRef = null;
    this._lastPolledSurveyResponsesRef = null;
    this._lastPolledQuestionRefVersion = 0;
    this._lastPolledSurveyResponsesRefVersion = 0;
    this._pollQuestionCountMemo = {
      questionsRef: null,
      count: 0,
    };
    this._scopedQuestionNetworkDataSyncMemo = {
      viewMode: '',
      netIdStr: '',
      slugsKey: '',
      bucketRefs: [],
      result: EMPTY_SCOPED_QUESTION_NETWORK_DATA,
    };
    this._pollSurveyResponsesCountMemo = {
      surveyId: '',
      responsesRef: null,
      count: 0,
    };
    this._nonceTickInFlight = false;
    this._nonceTickQueued = false;
    this._pollLatestBlockFetchInFlight = false;
    this._pollLatestBlockLastAttemptAt = 0;
    this._responseParseMemo = new Map();
    this._surveyModeSourceSignature = '';
    this._surveyModeSourceCoarseSignature = '';
    this._surveyModeSourcePayloadRefSignature = '';
    this._surveyModeSourceCacheNonce = 0;
    this._individualResponsesAggregatorMemo = {
      responsesRef: null,
      result: {},
    };
    this._viewableResponsesCountMemo = new WeakMap();
    this._resultsRefreshMicrotaskScheduled = false;
    this._resultsRefreshFrameRequestId = null;
    this._queuedResultsRefreshReasons = new Set();
    this._aggregatorEntriesMemo = {
      aggregatorRef: null,
      entries: [],
    };
    this._polisQuestionResponsesMemo = {
      selected: false,
      sourceRef: null,
      result: null,
    };
    this._effectiveSlugScanMemo = {
      surveyId: '',
      nonceKey: '',
      slug: '',
    };
    this._surveysCacheChangeNonce = 0;
    this._unsubscribeCacheUpdates = null;
    this._lastNotifiedFilterStateSignature = null;
    this._pendingFilterLoadingValue = null;
    this._bookmarkFeedbackTimer = null;
  }

  handleManagedCacheUpdate: any = (update: any = {}) => {
    if (!update || update.namespace !== 'surveysCache') return;
    this._surveysCacheChangeNonce += 1;
  };

  getIsSyncedForState: any = (stateSnapshot: any = this.state) => {
    const netBlock = Number(stateSnapshot?.networkLatestBlock || 0);
    const isSourceSynced = (localBlockValue: any, refreshTargetBlockValue: any) => {
      const localBlock = Number(localBlockValue || 0);
      const refreshTargetBlock = Number(refreshTargetBlockValue || 0);
      if (localBlock === 0 || netBlock === 0) return false;
      const clampedLocalBlock = Math.min(localBlock, netBlock);
      const clampedTargetBlock =
        refreshTargetBlock > 0 ? Math.min(refreshTargetBlock, netBlock) : 0;
      return clampedTargetBlock > 0
        ? clampedLocalBlock >= clampedTargetBlock
        : clampedLocalBlock >= netBlock;
    };

    if (stateSnapshot?.viewMode === 'questions') {
      return (
        isSourceSynced(
          stateSnapshot.questionLocalBlock,
          stateSnapshot.refreshTargetQuestionBlock
        ) &&
        isSourceSynced(
          stateSnapshot.responseLocalBlock,
          stateSnapshot.refreshTargetResponseBlock
        )
      );
    }

    return isSourceSynced(
      stateSnapshot?.surveyLocalBlock,
      stateSnapshot?.refreshTargetSurveyBlock
    );
  };

  /**
   * Resolve the effective session slug for cache + RPC calls.
   * Priority: explicit sessionSlug → Redux active slug → cache scan → general ('').
   */
  getEffectiveSlug() {
    const explicitSlug = resolveSurveyResultsExplicitSessionSlug({
      ...this.props,
      search: (typeof window !== 'undefined' && window.location?.search) || '',
    });
    if (explicitSlug !== null) return explicitSlug;

    // 2. Fallback: scan known sessions for the survey ID if we have one
    if (this.state.surveyId) {
      const sid = this.state.surveyId.toLowerCase();
      const nonceKey = [
        normalizeNonceKey(this.props.questionResponsesNonce),
        normalizeNonceKey(this.props.questionsCacheNonce),
        normalizeNonceKey(this._surveysCacheChangeNonce),
      ].join('|');
      if (
        this._effectiveSlugScanMemo &&
        this._effectiveSlugScanMemo.surveyId === sid &&
        this._effectiveSlugScanMemo.nonceKey === nonceKey
      ) {
        return this._effectiveSlugScanMemo.slug || '';
      }

      const slug = scanSurveyResultsSessionSlugFromCache({
        surveyId: sid,
        surveyCacheEntries: listNamespaceEntriesSync('surveysCache', { cloneValues: false }),
      });
      this._effectiveSlugScanMemo = {
        surveyId: sid,
        nonceKey,
        slug,
      };
      return slug;
    }

    return ''; // Default to general
  }

  getEffectiveSessionContext() {
    return resolveSurveyResultsSessionContext({
      sessionSlug: this.getEffectiveSlug(),
      resolveBySlug: getSessionConfigBySlug,
    });
  }

  resolveBaseQuestionReadScopeContextFor({
    props = this.props,
    state = this.state,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: any = {}) {
    return resolveSurveyResultsQuestionReadScope({
      pathname: (typeof window !== 'undefined' && window.location?.pathname) || '',
      search: (typeof window !== 'undefined' && window.location?.search) || '',
      sessionSlug: props.sessionSlug,
      activeSessionSlug: props.activeSessionSlug,
      viewMode,
      readSessionScanScope: readSessionScanScope as any,
      readSessionScanSlugs: readSessionScanSlugs as any,
      getAllSessionSlugs: getAllSessionSlugs as any,
    } as any);
  }

  resolveQuestionReadScopeContextFor({
    props = this.props,
    state = this.state,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: any = {}) {
    return this.resolveBaseQuestionReadScopeContextFor({
      props,
      state,
      viewMode,
    });
  }

  getQuestionReadScopeContext(viewMode: any = this.state.viewMode || this.props.viewMode || 'questions') {
    return this.resolveQuestionReadScopeContextFor({ viewMode });
  }

  getQuestionReadSlugs(viewMode: any = this.state.viewMode || this.props.viewMode || 'questions') {
    const scopeContext = this.getQuestionReadScopeContext(viewMode);
    const scopedSlugs = Array.isArray(scopeContext?.questionReadSlugs)
      ? scopeContext.questionReadSlugs
      : [];
    return scopedSlugs.length > 0 ? scopedSlugs : [this.getEffectiveSlug()];
  }

  getQuestionFilterStorageKeyPrefix(viewMode: any = this.state.viewMode || this.props.viewMode || 'questions') {
    return this.getQuestionReadScopeContext(viewMode).storageKeyPrefix;
  }

  shouldRequireAuthoritativeQuestionScope(viewMode: any = this.state.viewMode || this.props.viewMode || 'questions') {
    if (String(viewMode || '').trim().toLowerCase() !== 'questions') return false;
    if (typeof window === 'undefined') return false;
    // Embedded one-page session results already pass an explicit pinned session slug.
    // Requiring authoritative metadata here hides legacy cache-backed questions that
    // pile view and the inline Polis report are already rendering from the same bucket.
    if (this.props.preventUrlChange && this.props.sessionSlugPinned) return false;
    return hasExplicitSessionQueryPinInPath(`${window.location.pathname || ''}${window.location.search || ''}`);
  }

  buildQuestionResultsScopeResetPatch() {
    return {
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredResponsesCount: 0,
      filteredQuestionsCount: 0,
      questionResultsHydrated: false,
    };
  }

  buildQuestionReadScopeSignature({
    props = this.props,
    state = this.state,
    viewMode = state?.viewMode || props?.viewMode || 'questions',
  }: any = {}) {
    const scopeContext = this.resolveQuestionReadScopeContextFor({ props, state, viewMode });
    return [
      String(scopeContext?.baseSlug || ''),
      Array.isArray(scopeContext?.questionReadSlugs) ? scopeContext.questionReadSlugs.join('|') : '',
      String(scopeContext?.storageKeyPrefix || ''),
      String(viewMode || ''),
    ].join('::');
  }

  getScopedQuestionNetworkDataSync(viewMode: any = this.state.viewMode || this.props.viewMode || 'questions') {
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    if (!netIdStr) return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
    const questionReadSlugs = this.getQuestionReadSlugs(viewMode);
    const slugsKey = questionReadSlugs.join('|');
    const requireAuthoritativeBinding = this.shouldRequireAuthoritativeQuestionScope(viewMode);
    const entries = questionReadSlugs.map((slug: any) => ({
      slug,
      bucket: resolveNetBucketReadOnly(
        peekCacheSync('questionsCache', slug, { clone: false }) || {},
        netIdStr,
        {
          questionsLatestBlock: 0,
          questions: {},
          questionResponses: {},
          questionResponsesLatestBlock: 0,
        }
      ),
    }));
    const memo = this._scopedQuestionNetworkDataSyncMemo || {};
    const bucketRefs = entries.map((entry: any) => entry.bucket);
    const memoMatches = (
      memo.viewMode === viewMode &&
      memo.netIdStr === netIdStr &&
      memo.slugsKey === slugsKey &&
      memo.requireAuthoritativeBinding === requireAuthoritativeBinding &&
      Array.isArray(memo.bucketRefs) &&
      memo.bucketRefs.length === bucketRefs.length &&
      memo.bucketRefs.every((bucket: any, index: any) => bucket === bucketRefs[index])
    );
    if (memoMatches) return memo.result || EMPTY_SCOPED_QUESTION_NETWORK_DATA;

    const result = mergeScopedQuestionNetworkData(entries, {
      allowedScopeSlugs: questionReadSlugs,
      // Regression guard: explicit ?session= pins must ignore legacy bucket leaks
      // until question metadata is rehydrated with an authoritative session binding.
      requireAuthoritativeBinding,
    });
    this._scopedQuestionNetworkDataSyncMemo = {
      viewMode,
      netIdStr,
      slugsKey,
      requireAuthoritativeBinding,
      bucketRefs,
      result,
    };
    return result;
  }

  async getScopedQuestionNetworkData(viewMode: any = this.state.viewMode || this.props.viewMode || 'questions') {
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    if (!netIdStr) return EMPTY_SCOPED_QUESTION_NETWORK_DATA;
    const questionReadSlugs = this.getQuestionReadSlugs(viewMode);
    const requireAuthoritativeBinding = this.shouldRequireAuthoritativeQuestionScope(viewMode);
    const entries = await Promise.all(questionReadSlugs.map(async (slug: any) => {
      let questionsCache = peekCacheSync('questionsCache', slug, { clone: false }) || {};
      if (!questionsCache || Object.keys(questionsCache).length === 0) {
        questionsCache = (await readCache('questionsCache', slug)) || {};
      }
      return {
        slug,
        bucket: resolveNetBucketReadOnly(questionsCache, netIdStr, {
          questionsLatestBlock: 0,
          questions: {},
          questionResponses: {},
          questionResponsesLatestBlock: 0,
        }),
      };
    }));
    return mergeScopedQuestionNetworkData(entries, {
      allowedScopeSlugs: questionReadSlugs,
      requireAuthoritativeBinding,
    });
  }

  appendSessionHintToSurveyPath: any = (pathIn: any = '') => {
    const path = String(pathIn || '');
    if (!path || hasExplicitSessionQueryPinInPath(path)) return path;
    const pathOnly = path.split('?')[0];
    const isSessionAwarePath = (
      pathOnly.includes('/survey/') ||
      pathOnly.startsWith('/questions') ||
      pathOnly.startsWith('/question/')
    );
    if (!isSessionAwarePath) return path;
    const slug = this.getEffectiveSlug();
    if (!slug) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}session=${encodeURIComponent(slug)}`;
  };

  getMemoizedQuestionFilterQuestions(networkQuestionsById: any = {}) {
    const questionResponsesRef = this.state.questionResponses;
    const networkQuestionsRef = networkQuestionsById;
    const questionResponsesNonceKey = normalizeNonceKey(this.props.questionResponsesNonce);
    const questionsCacheNonceKey = normalizeNonceKey(this.props.questionsCacheNonce);
    const memo = this._questionFilterQuestionsMemo;

    if (
      memo.questionResponsesRef === questionResponsesRef &&
      memo.networkQuestionsRef === networkQuestionsRef &&
      memo.questionResponsesNonceKey === questionResponsesNonceKey &&
      memo.questionsCacheNonceKey === questionsCacheNonceKey
    ) {
      return memo.result;
    }

    const next = Object.keys(questionResponsesRef || {}).map((qId: any) => {
      const lower = (qId || '').toLowerCase();
      const qData = networkQuestionsById[lower];
      return qData || { id: lower || qId, creator: '', type: '', prompt: '' };
    });

    this._questionFilterQuestionsMemo = {
      questionResponsesRef,
      networkQuestionsRef,
      questionResponsesNonceKey,
      questionsCacheNonceKey,
      result: next,
    };
    return next;
  }

  notifyFilterStateCommitted(nextFilterState: any) {
    const nextSignature = getFilterStateSignature(nextFilterState);
    if (this._lastNotifiedFilterStateSignature === nextSignature) return;
    this._lastNotifiedFilterStateSignature = nextSignature;
    if (this.props.onFilterStateChangeForUrlUpdate) {
      this.props.onFilterStateChangeForUrlUpdate(nextFilterState);
    }
    if (this.props.onFilterChange) {
      this.props.onFilterChange(nextFilterState);
    }
  }

  commitResultsFilterState(statePatch: any, nextFilterState: any) {
    const patch = (statePatch && typeof statePatch === 'object') ? statePatch : {};
    const normalizedFilterState =
      nextFilterState && typeof nextFilterState === 'object'
        ? nextFilterState
        : (this.state.filterState || {});
    const filterStateChanged = !areValuesEquivalentBySignature(
      this.state.filterState,
      normalizedFilterState
    );
    const patchChanged = Object.keys(patch).some((key: any) => (
      !areValuesEquivalentBySignature(this.state[key], patch[key])
    ));
    if (!filterStateChanged && !patchChanged) return;
    this.setState(
      {
        ...patch,
        filterState: normalizedFilterState,
      },
      () => this.notifyFilterStateCommitted(this.state.filterState)
    );
  }

  requestFetchResponses: any = () => {
    if (!this._isMounted) return;
    if (this._fetchResponsesRequestScheduled) return;
    this._fetchResponsesRequestScheduled = true;
    Promise.resolve().then(() => {
      this._fetchResponsesRequestScheduled = false;
      if (!this._isMounted) return;
      if (this._fetchResponsesInFlight) {
        this._fetchResponsesQueued = true;
        return;
      }
      void this.flushFetchResponsesRequest();
    });
  };

  flushFetchResponsesRequest: any = async () => {
    if (!this._isMounted || this._fetchResponsesInFlight) return;
    this._fetchResponsesInFlight = true;
    try {
      await this.fetchResponses();
    } finally {
      this._fetchResponsesInFlight = false;
      if (this._fetchResponsesQueued) {
        this._fetchResponsesQueued = false;
        if (this._isMounted) {
          void this.flushFetchResponsesRequest();
        }
      }
    }
  };

  shouldUseAnimationFrameForRefreshCoalescing: any = () => {
    if (typeof window === 'undefined') return false;
    if (typeof window.requestAnimationFrame !== 'function') return false;
    if (this.isDocumentHidden()) return false;
    const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/jsdom/i.test(ua)) return false;
    return true;
  };

  queueResultsRefresh: any = (reason: any = 'unknown') => {
    if (!this._isMounted) return;
    if (reason) {
      this._queuedResultsRefreshReasons.add(String(reason));
    }
    if (this._resultsRefreshMicrotaskScheduled) return;
    this._resultsRefreshMicrotaskScheduled = true;

    scheduleMicrotask(() => {
      this._resultsRefreshMicrotaskScheduled = false;
      if (!this._isMounted) return;
      if (this._resultsRefreshFrameRequestId != null) return;

      const flush = () => {
        this._resultsRefreshFrameRequestId = null;
        this.flushQueuedResultsRefresh();
      };

      if (this.shouldUseAnimationFrameForRefreshCoalescing()) {
        this._resultsRefreshFrameRequestId = window.requestAnimationFrame(flush);
        return;
      }

      flush();
    });
  };

  flushQueuedResultsRefresh: any = () => {
    if (!this._isMounted) return;
    if (this._queuedResultsRefreshReasons.size === 0) return;
    if (!this.props.isOpen) {
      this._queuedResultsRefreshReasons.clear();
      return;
    }
    this._queuedResultsRefreshReasons.clear();
    measureSync('ce.surveyResults.flushQueuedResultsRefresh', () => {
      this.requestFetchResponses();
    });
  };

  updateParentWithCurrentFiltersForUrl: any = () => {
    this.notifyFilterStateCommitted(this.state.filterState);
  }

  componentDidMount() {
    this._isMounted = true;
    this._unsubscribeCacheUpdates = subscribeCacheUpdates(this.handleManagedCacheUpdate);
    window.addEventListener('popstate', this.handleUrlChange);
    document.addEventListener('visibilitychange', this.handleDocumentVisibilityChange);

    // Determine initial viewMode and surveyId for state
    let initialViewMode = this.props.viewMode || 'questions';
    let initialSurveyId = this.props.surveyId || '';

    if (initialSurveyId) {
      initialViewMode = 'survey';
    }

    this.setState({
      viewMode: initialViewMode,
      surveyId: initialSurveyId
    }, () => {
      this.handleUrlBasedView();

      if (this.props.isOpen) {
        if (this.state.viewMode === 'questions') {
          if (this.props.refreshQuestionMetadata && this.props.refreshQuestionResponses) {
            this.props.refreshQuestionMetadata();
            this.props.refreshQuestionResponses();
          }
        } else if (this.state.viewMode === 'survey' && this.state.surveyId) {
          if (this.props.refreshSurveyResponsesByID) {
            this.props.refreshSurveyResponsesByID(this.state.surveyId.toLowerCase());
          }
        }

        const ensureResultsUrl = () => {
          if (this.props.preventUrlChange) return;
          if (!window.location.pathname.endsWith('/results')) {
            let path =
              this.state.viewMode === 'questions'
                ? '/questions/results'
                : (this.state.surveyId ? `/survey/${this.state.surveyId}/results` : '/questions/results');

            // Apply prefix
            path = applyExistingGroupPrefix(path);

            // Preserve existing query params (specifically filter) if present
            const search = window.location.search;
            if (search) {
              path += search;
            } else {
              path = this.appendSessionHintToSurveyPath(path);
            }

            window.history.pushState({}, '', path);
          }
        };

        this.updateLocalStoragePollingState();
        this.handleManualRefresh();
        this.queueResultsRefresh('mount-open');
        ensureResultsUrl();
        this.updateParentWithCurrentFiltersForUrl();
      }
    });
  }


  componentWillUnmount() {
    this._isMounted = false;
    this._fetchResponsesQueued = false;
    this._fetchResponsesInFlight = false;
    this._fetchResponsesRequestScheduled = false;
    this._nonceTickInFlight = false;
    this._nonceTickQueued = false;
    this._pollLatestBlockFetchInFlight = false;
    this._resultsRefreshMicrotaskScheduled = false;
    this._queuedResultsRefreshReasons.clear();
    if (this._responseParseMemo && typeof this._responseParseMemo.clear === 'function') {
      this._responseParseMemo.clear();
    }
    if (this._resultsRefreshFrameRequestId != null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this._resultsRefreshFrameRequestId);
    }
    this._resultsRefreshFrameRequestId = null;
    if (typeof this._unsubscribeCacheUpdates === 'function') {
      this._unsubscribeCacheUpdates();
    }
    this._unsubscribeCacheUpdates = null;
    if (this._scrollToQuestionRetryTimer) {
      clearTimeout(this._scrollToQuestionRetryTimer);
      this._scrollToQuestionRetryTimer = null;
    }
    if (this._scrollMutationObserver) {
      this._scrollMutationObserver.disconnect();
      this._scrollMutationObserver = null;
    }
    if (this._bookmarkFeedbackTimer) {
      clearTimeout(this._bookmarkFeedbackTimer);
      this._bookmarkFeedbackTimer = null;
    }
    window.removeEventListener('popstate', this.handleUrlChange);
    document.removeEventListener('visibilitychange', this.handleDocumentVisibilityChange);
    this.stopLocalStoragePolling();

    // If unmounting while still open, remove "/results" from the URL
    if (this.props.isOpen) {
      const currentPath = window.location.pathname;
      if (currentPath.includes('/results')) {
        let newPath = currentPath.replace('/results', '').replace(/\/+$/, '');
        // If that leaves nothing, fall back to whichever path logic you want:
        if (!newPath) {
          newPath =
            this.state.viewMode === 'questions'
              ? '/questions'
              : this.state.surveyId // Use state.surveyId
                ? `/survey/${this.state.surveyId}`
                : '/questions';
        }
        newPath = this.appendSessionHintToSurveyPath(newPath);
        window.history.pushState({}, '', newPath);
      }
    }
  }



  componentDidUpdate(prevProps: any, prevState: any) {
    const refreshReasons: any = new Set();
    const pendingStatePatch: Record<string, any> = {};
    let hasPendingStatePatch = false;
    let runPostPatchTasks: any = null;
    const clearResponseParseMemo = () => {
      if (this._responseParseMemo && typeof this._responseParseMemo.clear === 'function') {
        this._responseParseMemo.clear();
      }
    };
    const queueStatePatch = (key: any, value: any) => {
      if (this.state[key] === value) return;
      pendingStatePatch[key] = value;
      hasPendingStatePatch = true;
    };
    const wasSynced = this.getIsSyncedForState(prevState);
    const isSyncedNow = this.getIsSyncedForState(this.state);
    if (!wasSynced && isSyncedNow) {
      this._syncLoadingStartedAt = null;
    } else if (!isSyncedNow && this._syncLoadingStartedAt === null) {
      this._syncLoadingStartedAt = Date.now();
    }

    // Sync local filteredQuestionsCount from props
    if (
      this.props.filteredQuestionsCount !== prevProps.filteredQuestionsCount &&
      this.props.filteredQuestionsCount !== this.state.filteredQuestionsCount
    ) {
      queueStatePatch('filteredQuestionsCount', this.props.filteredQuestionsCount);
    }

    // If the modal just closed, revert the URL and stop polling
    if (prevProps.isOpen && !this.props.isOpen) {
      clearResponseParseMemo();
      queueStatePatch('questionResultsHydrated', false);
      queueStatePatch('surveyResultsHydrated', false);
      queueStatePatch('demoResultsViewMode', 'raw');
      queueStatePatch('demoResultsAtlasNodeId', null);
      if (!this.props.preventUrlChange) {
        let basePath;
        if (this.state.viewMode === 'questions') {
          basePath = '/questions';
        } else if (this.state.surveyId) {
          basePath = `/survey/${this.state.surveyId}`;
        } else {
          basePath = '/questions';
        }
        basePath = this.appendSessionHintToSurveyPath(basePath);
        window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
      }
      this.stopLocalStoragePolling();
      this.resetLocalStoragePollingBackoff('modal-closed');
      this._syncLoadingStartedAt = null;
    }

    // If the modal just opened
    if (!prevProps.isOpen && this.props.isOpen) {
      this.resetLocalStoragePollingBackoff('modal-open');
      if (String(this.state.viewMode || '').trim().toLowerCase() === 'questions') {
        queueStatePatch('questionResultsHydrated', false);
      } else {
        queueStatePatch('surveyResultsHydrated', false);
      }
      queueStatePatch('demoResultsViewMode', 'raw');
      queueStatePatch('demoResultsAtlasNodeId', null);
      // Reset then re-seed sync timer if currently loading
      const isSyncedOnOpen = this.getIsSyncedForState(this.state);
      this._syncLoadingStartedAt = isSyncedOnOpen ? null : Date.now();
      this.updateLocalStoragePollingState();
      // Re-open should re-emit current filter state so URL/query filter sync is restored.
      this._lastNotifiedFilterStateSignature = null;
      refreshReasons.add('modal-open');

      const filterStatePropChanged =
        getFilterStateSignature(this.props.filterState) !==
        getFilterStateSignature(prevProps.filterState);

      const updateTasks = () => {
        this.updateParentWithCurrentFiltersForUrl();

        if (!this.props.preventUrlChange && !window.location.pathname.endsWith('/results')) {
          const path =
            this.state.viewMode === 'questions'
              ? '/questions/results'
              : (this.state.surveyId ? `/survey/${this.state.surveyId}/results` : '/questions/results');
          window.history.pushState({}, '', applyExistingGroupPrefix(this.appendSessionHintToSurveyPath(path)));
        }
      };

      if (filterStatePropChanged) {
        queueStatePatch('filterState', this.props.filterState || {});
        runPostPatchTasks = updateTasks;
      } else {
        updateTasks();
      }
    }

    // If the modal is open and a cache just became ready, refresh
    const cacheJustBecameReady =
      (this.state.viewMode === 'questions' &&
        !prevProps.isQuestionCacheReady &&
        this.props.isQuestionCacheReady) ||
      (this.state.viewMode === 'survey' &&
        !prevProps.isSurveyCacheReady &&
        this.props.isSurveyCacheReady);

    if (this.props.isOpen && cacheJustBecameReady) {
      refreshReasons.add('cache-ready');
    }

    // If responses cache flips ready while open, refresh
    if (
      this.props.isOpen &&
      prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
      this.props.isResponsesCacheReady
    ) {
      refreshReasons.add('responses-cache-ready');
    }

    // View mode changed (questions <-> survey)
    if (prevState.viewMode !== this.state.viewMode) {
      // Invalidate survey-mode source memo so returning to the same survey rebuilds state.
      this._surveyModeSourceSignature = '';
      clearResponseParseMemo();
      this.setState(
        {
          questionLocalBlock: 0,
          responseLocalBlock: 0,
          surveyLocalBlock: 0,
          refreshTargetQuestionBlock: 0,
          refreshTargetResponseBlock: 0,
          refreshTargetSurveyBlock: 0,
          questionResultsHydrated:
            this.state.viewMode === 'questions' ? false : this.state.questionResultsHydrated,
          surveyResultsHydrated:
            this.state.viewMode === 'survey' ? false : this.state.surveyResultsHydrated,
          demoResultsViewMode: 'raw',
          demoResultsAtlasNodeId: null,
          // If switching to questions, clear surveyId
          surveyId: this.state.viewMode === 'questions' ? '' : this.state.surveyId,
        },
        () => {
          this.resetLocalStoragePollingBackoff('view-mode-change');
          this.queueResultsRefresh('view-mode-change');
        }
      );
    }

    // Survey identity changed (prop or internal)
    if ((this.props.surveyId !== prevProps.surveyId) || (prevState.surveyId !== this.state.surveyId)) {
      clearResponseParseMemo();
      if (this.props.surveyId && this.props.surveyId !== this.state.surveyId) {
        this.setState(
          {
            surveyId: this.props.surveyId,
            viewMode: 'survey',
            surveyLocalBlock: 0,
            refreshTargetSurveyBlock: 0,
            surveyResultsHydrated: false,
            demoResultsViewMode: 'raw',
            demoResultsAtlasNodeId: null,
          },
          () => {
            this.resetLocalStoragePollingBackoff('survey-id-prop-change');
            this.queueResultsRefresh('survey-id-prop-change');
          }
        );
      } else if (prevState.surveyId !== this.state.surveyId && this.state.viewMode === 'survey') {
        this.setState(
          {
            surveyLocalBlock: 0,
            refreshTargetSurveyBlock: 0,
            surveyResultsHydrated: false,
            demoResultsViewMode: 'raw',
            demoResultsAtlasNodeId: null,
          },
          () => {
            this.resetLocalStoragePollingBackoff('survey-id-state-change');
            this.queueResultsRefresh('survey-id-state-change');
          }
        );
      }
    }

    // Upstream "responses changed" signal
    if (prevProps.questionResponsesNonce !== this.props.questionResponsesNonce) {
      this.handleNonceTick();
    }

    if (prevProps.isOpen !== this.props.isOpen) {
      if (this.props.isOpen) {
        this.resetLocalStoragePollingBackoff('modal-open-state-change');
      }
      this.updateLocalStoragePollingState();
    }

    const prevQuestionScopeSignature = this.buildQuestionReadScopeSignature({
      props: prevProps,
      state: prevState,
      viewMode: prevState.viewMode || prevProps.viewMode || 'questions',
    });
    const nextQuestionScopeSignature = this.buildQuestionReadScopeSignature({
      props: this.props,
      state: this.state,
      viewMode: this.state.viewMode || this.props.viewMode || 'questions',
    });
    if (
      this.props.isOpen &&
      String(this.state.viewMode || '').trim().toLowerCase() === 'questions' &&
      prevQuestionScopeSignature !== nextQuestionScopeSignature
    ) {
      clearResponseParseMemo();
      const questionScopeResetPatch: any = this.buildQuestionResultsScopeResetPatch();
      Object.keys(questionScopeResetPatch).forEach((key: any) => {
        queueStatePatch(key, questionScopeResetPatch[key]);
      });
      refreshReasons.add('question-scope-change');
    }

    if (hasPendingStatePatch) {
      this.setState(pendingStatePatch, () => {
        if (typeof runPostPatchTasks === 'function') runPostPatchTasks();
      });
    } else if (typeof runPostPatchTasks === 'function') {
      runPostPatchTasks();
    }

    if (refreshReasons.size > 0) {
      this.queueResultsRefresh(Array.from(refreshReasons).join('|'));
    }
  }


  // Force-refresh handler to keep UI reactivity and progress bars current on cache updates
  runNonceTickRefresh: any = async () => {
    try {
      const slug = this.getEffectiveSlug();
      const latest = await contractScripts.getLatestBlockNumber(this.props.provider, slug);
      if (!this._isMounted) return;
      this.setState(
        {
          networkLatestBlock: latest,
          refreshTargetQuestionBlock: latest,
          refreshTargetResponseBlock: latest,
          refreshTargetSurveyBlock: latest
        },
        () => {
          // Re-read localStorage derived counters and repaint from cache immediately
          this.pollLocalStorageForUpdates();
          this.resetLocalStoragePollingBackoff('nonce-tick');
          this.queueResultsRefresh('nonce-tick');
        }
      );
    } catch (e) {
      // Fall back to a soft refresh if block lookup fails
      if (this._isMounted) {
        this.resetLocalStoragePollingBackoff('nonce-tick-fallback');
        this.queueResultsRefresh('nonce-tick-fallback');
      }
    }
  };

  handleNonceTick: any = async () => {
    if (this._nonceTickInFlight) {
      this._nonceTickQueued = true;
      return;
    }
    this._nonceTickInFlight = true;
    try {
      do {
        this._nonceTickQueued = false;
        await this.runNonceTickRefresh();
      } while (this._nonceTickQueued && this._isMounted);
    } finally {
      this._nonceTickInFlight = false;
    }
  };



  handleFilterActivityChange: any = (isActive: any) => {
    if (this.state.isFilterActive === isActive) return;
    this.setState({ isFilterActive: isActive });
  };

  getIsDemoQuestionResultsContext: any = () => (
    String(this.state.viewMode || '').trim().toLowerCase() === 'questions' &&
    normalizeSessionSlug(this.getEffectiveSlug()) === 'demo'
  );

  handleDemoResultsViewSelect: any = (nextView: any = 'report') => {
    const allowedViews = new Set(['report', 'breakdown', 'atlas', 'riskMatrix']);
    const normalizedView = allowedViews.has(nextView) ? nextView : 'report';
    this.setState((prevState: any) => ({
      demoResultsViewMode:
        prevState.demoResultsViewMode === normalizedView ? 'raw' : normalizedView,
      demoResultsAtlasNodeId:
        normalizedView === 'atlas' ? prevState.demoResultsAtlasNodeId : null,
    }));
  };

  handleDemoAtlasOpen: any = (nodeId: any = '') => {
    const normalizedNodeId = String(nodeId || '').trim();
    this.setState({
      demoResultsViewMode: 'atlas',
      demoResultsAtlasNodeId: normalizedNodeId || null,
    });
  };

  handleDemoAtlasModalClose: any = () => {
    if (!this.state.demoResultsAtlasNodeId) return;
    this.setState({ demoResultsAtlasNodeId: null });
  };

  renderDemoResultsSurface: any = (viewKey: any = 'report') => {
    const activeSlug = this.getEffectiveSlug();
    if (viewKey === 'report') {
      return (
        <div id="polisReportSection">
          <PolisReport
            questionResponses={this.getMemoizedPolisQuestionResponses(
              true,
              this.state.viewMode === 'survey' && this.state.surveyViewMode === 'individuals'
                ? this.getMemoizedIndividualsAggregator(this.state.sbtFilteredResponses)
                : (this.state.sbtFilteredAggregatorQuestionResponses || {})
            )}
            network={this.props.network}
            networkChainId={this.props.networkChainId}
            disclaimersActive={true}
            filterState={this.props.filterState || this.state.filterState}
            defaultTags={this.props.defaultTags}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            questionScanProgress={this.props.questionScanProgress}
            questionResponsesNonce={this.props.questionResponsesNonce}
            slug={activeSlug}
          />
        </div>
      );
    }

    if (viewKey === 'breakdown') {
      return (
        <Suspense fallback={<LazyFallback label="Loading Breakdown..." minHeight="30vh" />}>
          <DemoAnalysisWorkspace />
        </Suspense>
      );
    }

    if (viewKey === 'atlas') {
      return (
        <Suspense fallback={<LazyFallback label="Loading Atlas..." minHeight="30vh" />}>
          <div className={styles.demoResultsAtlasSurface}>
            <DebateMapAny
              activeSessionSlug={activeSlug}
              demoMode={true}
              embedded={true}
              requestedModalNodeId={this.state.demoResultsAtlasNodeId}
              onModalClose={this.state.demoResultsAtlasNodeId ? this.handleDemoAtlasModalClose : null}
            />
          </div>
        </Suspense>
      );
    }

    if (viewKey === 'riskMatrix') {
      return (
        <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
          <div className={styles.demoResultsRiskMatrixSurface}>
            <RiskMatrix embedded={true} onOpenAtlasNode={this.handleDemoAtlasOpen} />
          </div>
        </Suspense>
      );
    }

    return null;
  };

  handleClearFiltersFromParent: any = (e: any) => {
    e.stopPropagation();
    if (this.questionFilterRef.current) {
      this.questionFilterRef.current.handleClearFilters();
    }
  };

  closeModal: any = () => {
    const oldPath = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    let base = oldPath.split('/results')[0];

    if (base === oldPath || base === '') {
      if (this.state.viewMode === 'questions') {
        base = '/questions';
      } else if (this.state.surveyId) {
        base = `/survey/${this.state.surveyId}`;
      } else {
        base = '/questions';
      }
    }
    base = this.appendSessionHintToSurveyPath(base);

    if (!this.props.preventUrlChange) {
      window.history.pushState({}, '', applyExistingGroupPrefix(base));
    }

    if (this.props.onClose) {
      this.props.onClose();
    }
  };


  handleUrlChange: any = () => {
    this.handleUrlBasedView();
  };

  handleUrlBasedView: any = () => {
    const path = window.location.pathname;
    let newViewMode = this.state.viewMode; // Default to current
    let newSurveyId = this.state.surveyId;  // Default to current

    const surveyResultsRegex = /^\/survey\/([0-9a-fA-FxX]{66})\/results/;
    let surveyMatch = path.match(surveyResultsRegex);

    const questionResultsRegex = /^\/questions\/results/;
    let questionMatch = path.match(questionResultsRegex);

    if (surveyMatch) {
        newViewMode = "survey";
        newSurveyId = surveyMatch[1]; // surveyID from URL
    } else if (questionMatch) {
        newViewMode = "questions";
        newSurveyId = ''; // No surveyId for questions view
    }
    // If neither matches, it might be a base path like /survey/ID or /questions
    // In that case, we don't necessarily change the mode here, as componentDidMount/Update handles props.

    if (this.state.viewMode !== newViewMode || this.state.surveyId !== newSurveyId) {
      this.setState({ viewMode: newViewMode, surveyId: newSurveyId }, () => {
        this.queueResultsRefresh('url-view-change');
      });
    }
  };


  // -----------------------------------------
  // LOCAL STORAGE POLLING
  // -----------------------------------------
  isDocumentHidden: any = () => {
    try {
      return typeof document !== 'undefined' && document.hidden;
    } catch (_) {
      return false;
    }
  };

  updateLocalStoragePollingState: any = () => {
    if (this.props.isOpen && !this.isDocumentHidden()) {
      this.resetLocalStoragePollingBackoff('polling-state-open');
      this.startLocalStoragePolling();
    } else {
      this.stopLocalStoragePolling();
    }
  };

  handleDocumentVisibilityChange: any = () => {
    this.updateLocalStoragePollingState();
  };

  resetLocalStoragePollingBackoff: any = (reason: any = '') => {
    this._localStoragePollingStableCycles = 0;
    this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MIN_MS;
    if (reason) {
      this._lastLocalStoragePollCoarseSignature = '';
      this._lastLocalStoragePollDetailedSignature = '';
    }
  };

  updateLocalStoragePollingBackoff: any = (didObserveChange: any) => {
    if (didObserveChange) {
      this.resetLocalStoragePollingBackoff();
      return;
    }
    this._localStoragePollingStableCycles += 1;
    if (this._localStoragePollingStableCycles <= 0) {
      this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MIN_MS;
      return;
    }
    if (this._localStoragePollingStableCycles === 1) {
      this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MID_MS;
      return;
    }
    this._localStoragePollingDelayMs = LOCAL_STORAGE_POLL_MAX_MS;
  };

  startLocalStoragePolling() {
    if (!this.props.isOpen) return;
    if (this.isDocumentHidden()) return;
    if (this._localStoragePollingIntervalId) return;
    const waitMs = Number(this._localStoragePollingDelayMs || LOCAL_STORAGE_POLL_MIN_MS);
    this._localStoragePollingIntervalId = setTimeout(() => {
      this._localStoragePollingIntervalId = null;
      if (!this._isMounted) return;
      if (this.isDocumentHidden()) return;
      const didObserveChange = this.pollLocalStorageForUpdates();
      this.updateLocalStoragePollingBackoff(!!didObserveChange);
      this.startLocalStoragePolling();
    }, waitMs);
  }

  stopLocalStoragePolling() {
    if (!this._localStoragePollingIntervalId) return;
    clearTimeout(this._localStoragePollingIntervalId);
    this._localStoragePollingIntervalId = null;
  }

  maybeRefreshNetworkLatestBlockFromPolling: any = () => {
    if ((this.state.networkLatestBlock || 0) > 0) return;
    if (this._pollLatestBlockFetchInFlight) return;
    const now = Date.now();
    if (
      this._pollLatestBlockLastAttemptAt > 0 &&
      (now - this._pollLatestBlockLastAttemptAt) < LATEST_BLOCK_POLL_THROTTLE_MS
    ) {
      return;
    }
    this._pollLatestBlockLastAttemptAt = now;
    this._pollLatestBlockFetchInFlight = true;
    const slug = this.getEffectiveSlug();
    contractScripts
      .getLatestBlockNumber(this.props.provider, slug)
      .then((blk: any) => {
        if (!this._isMounted) return;
        const parsed = Number(blk || 0);
        if (parsed > 0 && parsed !== Number(this.state.networkLatestBlock || 0)) {
          this.setState({ networkLatestBlock: parsed });
        }
      })
      .catch((e: any) => { surveyLog.warn('SurveyResults: fallback', e); })
      .finally(() => {
        this._pollLatestBlockFetchInFlight = false;
      });
  };

  getMemoizedQuestionsCountForPolling: any = (questionsById: any, options: any = {}) => {
    const ref = questionsById && typeof questionsById === 'object' ? questionsById : {};
    const forceScan = options && options.forceScan === true;
    const memo = this._pollQuestionCountMemo;
    if (!forceScan && memo.questionsRef === ref) return memo.count;
    const nextCount = measureSync(
      forceScan
        ? 'ce.surveyResults.poll.questionsCountForcedScan'
        : 'ce.surveyResults.poll.questionsCountScan',
      () => Object.keys(ref).length
    );
    this._pollQuestionCountMemo = {
      questionsRef: ref,
      count: nextCount,
    };
    return nextCount;
  };

  getMemoizedSurveyResponsesCountForPolling: any = (surveyResponsesById: any, surveyId: any, options: any = {}) => {
    const sid = String(surveyId || '').toLowerCase();
    if (!sid) {
      this._pollSurveyResponsesCountMemo = {
        surveyId: '',
        responsesRef: null,
        count: 0,
      };
      return 0;
    }

    const byId = surveyResponsesById && typeof surveyResponsesById === 'object'
      ? surveyResponsesById
      : {};
    const responsesRef = byId[sid] && typeof byId[sid] === 'object'
      ? byId[sid]
      : null;
    const memo = this._pollSurveyResponsesCountMemo;
    const forceScan = options && options.forceScan === true;
    if (!forceScan && memo.surveyId === sid && memo.responsesRef === responsesRef) {
      return memo.count;
    }
    const nextCount = measureSync(
      forceScan
        ? 'ce.surveyResults.poll.surveyResponsesCountForcedScan'
        : 'ce.surveyResults.poll.surveyResponsesCountScan',
      () => Object.keys(responsesRef || {}).length
    );
    this._pollSurveyResponsesCountMemo = {
      surveyId: sid,
      responsesRef,
      count: nextCount,
    };
    return nextCount;
  };

pollLocalStorageForUpdates() {
  return measureSync('ce.surveyResults.pollLocalStorageForUpdates', () => {
    if (!this.props.network || !this.props.network.id) return false;
    const slug = this.getEffectiveSlug();
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    if (!netIdStr) return false;
    const currentSurveyId = this.state.viewMode === 'survey'
      ? String(this.state.surveyId || '').toLowerCase()
      : '';

    const questionNetCache = this.state.viewMode === 'questions'
      ? this.getScopedQuestionNetworkDataSync('questions')
      : resolveNetBucketReadOnly(
          peekCacheSync('questionsCache', slug, { clone: false }) || {},
          netIdStr,
          {
            questionsLatestBlock: 0,
            questions: {},
            questionResponses: {},
            questionResponsesLatestBlock: 0,
          }
        );

    const questionsById = questionNetCache.questions || {};
    let surveyNetCache: any = null;
    let surveyResponsesById: Record<string, any> = {};
    if (currentSurveyId) {
      const surveysCache = peekCacheSync('surveysCache', slug, { clone: false }) || {};
      surveyNetCache = resolveNetBucketReadOnly(surveysCache, netIdStr, {
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
        surveysLatestBlock: 0,
      });
      surveyResponsesById = surveyNetCache.surveyResponses || {};
    }
    if (this._lastPolledQuestionsRef !== questionsById) {
      this._lastPolledQuestionsRef = questionsById;
      this._lastPolledQuestionRefVersion += 1;
    }
    if (this._lastPolledSurveyResponsesRef !== surveyResponsesById) {
      this._lastPolledSurveyResponsesRef = surveyResponsesById;
      this._lastPolledSurveyResponsesRefVersion += 1;
    }

    // Keep retrying latest-block fetches even when local cache signatures are stable.
    let netLatest = Number(this.state.networkLatestBlock || 0);
    if (!netLatest) {
      this.maybeRefreshNetworkLatestBlockFromPolling();
      netLatest = 0;
    }

    const localQBlock = Number(questionNetCache.questionsLatestBlock || 0);
    const localRespBlock = Number(questionNetCache.questionResponsesLatestBlock || 0);
    const localSBlock = currentSurveyId
      ? Number((surveyNetCache.surveyResponsesLatestBlock || {})[currentSurveyId] || 0)
      : 0;

    const coarseSignature = [
      String(this.state.viewMode || ''),
      currentSurveyId,
      localQBlock,
      localRespBlock,
      localSBlock,
      this._lastPolledQuestionRefVersion,
      currentSurveyId ? this._lastPolledSurveyResponsesRefVersion : 0,
    ].join('|');
    const coarseSignatureUnchanged = coarseSignature === this._lastLocalStoragePollCoarseSignature;
    const blockOrRespChanged =
      localQBlock !== this.state.questionLocalBlock ||
      localRespBlock !== this.state.responseLocalBlock ||
      localSBlock !== this.state.surveyLocalBlock;

    if (this._fetchResponsesInFlight && !blockOrRespChanged) {
      return false;
    }

    const stableCycles = Math.max(0, Number(this._localStoragePollingStableCycles || 0));
    const forceRescanOnStableCycle =
      stableCycles > 0 &&
      (stableCycles % LOCAL_STORAGE_FORCE_RESCAN_EVERY) === 0;
    const shouldForceCountRescan =
      !this._fetchResponsesInFlight &&
      (!coarseSignatureUnchanged || forceRescanOnStableCycle);

    const newQuestionsCount = this._fetchResponsesInFlight
      ? Number(this.state.cachedQuestionsCount || 0)
      : this.getMemoizedQuestionsCountForPolling(questionsById, {
          forceScan: shouldForceCountRescan,
        });
    const localSurveyResponsesCount = currentSurveyId
      ? (
          this._fetchResponsesInFlight
            ? Number(this.state.cachedSurveyResponsesCount || 0)
            : this.getMemoizedSurveyResponsesCountForPolling(surveyResponsesById, currentSurveyId, {
                forceScan: shouldForceCountRescan,
              })
        )
      : 0;
    const detailedSignature = [
      coarseSignature,
      newQuestionsCount,
      localSurveyResponsesCount,
      netLatest,
    ].join('|');
    if (detailedSignature === this._lastLocalStoragePollDetailedSignature) {
      return false;
    }
    this._lastLocalStoragePollCoarseSignature = coarseSignature;
    this._lastLocalStoragePollDetailedSignature = detailedSignature;

    const questionCountChanged = newQuestionsCount !== this.state.cachedQuestionsCount;
    const surveyResponseCountChanged =
      localSurveyResponsesCount !== this.state.cachedSurveyResponsesCount;

    if (blockOrRespChanged || questionCountChanged || surveyResponseCountChanged) {
      this.setState(
        {
          questionLocalBlock: localQBlock,
          responseLocalBlock: localRespBlock,
          surveyLocalBlock: localSBlock,
          cachedQuestionsCount: newQuestionsCount,
          cachedSurveyResponsesCount: localSurveyResponsesCount,
          networkLatestBlock: netLatest
        },
        () => {
          this.queueResultsRefresh('poll-local-storage-change');
        }
      );
      return true;
    }

    return false;
  });
}

parseResponse: any = (responseData: any) => {
if (typeof responseData !== 'string') return responseData;
const memo = this._responseParseMemo;
if (memo.has(responseData)) {
  return memo.get(responseData);
}
try {
  const parsed = JSON.parse(responseData);
  memo.set(responseData, parsed);
  if (memo.size > RESPONSE_PARSE_MEMO_MAX_SIZE) {
    const oldestKey = memo.keys().next().value;
    if (oldestKey !== undefined) memo.delete(oldestKey);
  }
  return parsed;
} catch (error) {
  surveyLog.error('Error parsing response data:', error);
  memo.set(responseData, null);
  if (memo.size > RESPONSE_PARSE_MEMO_MAX_SIZE) {
    const oldestKey = memo.keys().next().value;
    if (oldestKey !== undefined) memo.delete(oldestKey);
  }
  return null;
}
};

getNetworkQuestionsForCurrentContext: any = () => {
  return this.getScopedQuestionNetworkDataSync(
    this.state.viewMode || this.props.viewMode || 'questions'
  ).questions;
};

fetchResponses: any = async () => {
if (!this.props.network || !this.props.network.id) {
  surveyLog.error('Network ID is undefined in fetchResponses. Cannot proceed.');
  return;
}

  // Cache-first results should not wait on RPC freshness. Kick the latest-block
  // lookup into the background so the modal can render cached questions/responses
  // immediately, then let the sync badge catch up when the block call resolves.
  if (!Number(this.state.networkLatestBlock || 0)) {
    this.maybeRefreshNetworkLatestBlockFromPolling();
  }

if (this.state.viewMode === 'survey') {
  await this.fetchSurveyModeResponses();
} else {
  await this.fetchQuestionModeResponses();
}
};

  async fetchSurveyModeResponses() {
    const currentSurveyID = this.state.surveyId ? this.state.surveyId.toLowerCase() : null;

    // Use the robust slug resolver to ensure we read the correct cache
    const slug = this.getEffectiveSlug();
    const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');

    // Read the specific group's cache
    let surveysCache = peekCacheSync('surveysCache', slug, { clone: false }) || {};
    if (!surveysCache || Object.keys(surveysCache).length === 0) {
      surveysCache = (await readCache('surveysCache', slug)) || {};
    }
    const hasSurveyNetCache = !!(
      surveysCache &&
      typeof surveysCache === 'object' &&
      surveysCache[netIdStr] != null
    );
    const surveyNetCache = resolveNetBucketReadOnly(surveysCache, netIdStr, null);

    // If cache missing for this network, abort
    if (!hasSurveyNetCache || !surveyNetCache) {
      return;
    }

    if (!currentSurveyID) {
      const emptySignature = `${slug}|${netIdStr}|__none__`;
      if (this._surveyModeSourceSignature === emptySignature) {
        return;
      }
      this._surveyModeSourceSignature = emptySignature;
      this._surveyModeSourceCoarseSignature = emptySignature;
      this._surveyModeSourcePayloadRefSignature = '';
      this._surveyModeSourceCacheNonce = Number(this._surveysCacheChangeNonce || 0);
      this.setState({
        responses: [],
        sbtFilteredResponses: [],
        aggregateQuestionResponses: {},
        sbtFilteredAggregatorQuestionResponses: {},
        surveyTitle: '',
        surveyDocumentURLs: [],
        totalQuestionsCount: 0,
        totalResponsesCount: 0,
        filteredResponsesCount: 0,
        surveyResultsHydrated: true,
      });
      return;
    }

    // In survey mode, show questions strictly belonging to this survey.
    const srMap = surveyNetCache.surveyResponses?.[currentSurveyID] || {};
    const allResponders = Object.keys(srMap);
    const networkQuestions = this.getNetworkQuestionsForCurrentContext();
    const questionIDsInSurvey = Array.isArray(surveyNetCache?.surveys?.[currentSurveyID]?.questionIDs)
      ? surveyNetCache.surveys[currentSurveyID].questionIDs
      : [];
    const questionIdsSignature = questionIDsInSurvey
      .map((qid: any) => String(qid || '').toLowerCase())
      .join('|');
    const surveyResponsesLatestBlock = Number(
      surveyNetCache?.surveyResponsesLatestBlock?.[currentSurveyID] || 0
    );
    const surveyDefinitionLatestBlock = Number(surveyNetCache?.surveysLatestBlock || 0);
    const surveyCacheChangeNonce = Number(this._surveysCacheChangeNonce || 0);
    const questionCacheReadySignal = this.props.isQuestionCacheReady ? 1 : 0;
    const payloadRefSignature = buildSurveyRespondersPayloadRefSignature(srMap);
    const coarseSourceSignature = [
      slug,
      netIdStr,
      currentSurveyID,
      questionCacheReadySignal,
      surveyResponsesLatestBlock,
      surveyDefinitionLatestBlock,
      allResponders.length,
      questionIdsSignature,
    ].join('::');
    const respondersSignature = buildSurveyRespondersSignature(srMap);
    const sourceSignature = [
      coarseSourceSignature,
      respondersSignature,
    ].join('::');
    if (this._surveyModeSourceSignature === sourceSignature) {
      this._surveyModeSourceCoarseSignature = coarseSourceSignature;
      this._surveyModeSourcePayloadRefSignature = payloadRefSignature;
      this._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
      return;
    }
    this._surveyModeSourceCoarseSignature = coarseSourceSignature;
    this._surveyModeSourcePayloadRefSignature = payloadRefSignature;
    this._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
    this._surveyModeSourceSignature = sourceSignature;

    const aggregatorMap: Record<string, any> = {};
    const rawResponses: any[] = [];
    allResponders.forEach((responder: any) => {
      const responderLower = String(responder || '').toLowerCase();
      const rawResp = normalizeSurveyResponsePayloadByQuestionId(
        this.parseResponse(srMap[responder])
      );
      if (!hasAnyCountableSurveyAnswer(rawResp, networkQuestions)) return;
      rawResponses.push({
        responder: responderLower,
        surveyId: currentSurveyID,
        response: rawResp,
      });
      if (!rawResp || !Array.isArray(rawResp.responses)) return;
      rawResp.responses.forEach((ans: any) => {
        const qIdL = getSurveyResponseQuestionId(ans);
        if (!qIdL) return;
        if (!aggregatorMap[qIdL]) aggregatorMap[qIdL] = [];
        aggregatorMap[qIdL].push({
          responder: responderLower,
          questionId: qIdL,
          response: ans,
          timestamp: getSurveyResponseAggregateTimestampMs(ans, rawResp),
        });
      });
    });
    const totalRespondersCount = rawResponses.length;

    const finalAggregator = unifyAggregatorWithAllQuestionIDs(
      aggregatorMap,
      questionIDsInSurvey
    );

    const totalQCount = Object.keys(finalAggregator).length;

    // Retrieve title from the correct group cache
    let foundTitle = '';
    let foundDocURLs: any[] = [];
    if (surveyNetCache?.surveys?.[currentSurveyID]) {
      foundTitle = surveyNetCache.surveys[currentSurveyID].title || '';
      foundDocURLs = Array.isArray(surveyNetCache.surveys[currentSurveyID].documentURLs)
        ? surveyNetCache.surveys[currentSurveyID].documentURLs
        : [];
    }

    // Initialize master and filtered views so UI renders immediately
    this.setState({
      aggregateQuestionResponses: finalAggregator,
      sbtFilteredAggregatorQuestionResponses: finalAggregator,
      sbtFilteredResponses: rawResponses,
      surveyTitle: foundTitle,
      surveyDocumentURLs: foundDocURLs,
      totalQuestionsCount: totalQCount,
      totalResponsesCount: totalRespondersCount,
      responses: rawResponses,
      filteredResponsesCount: rawResponses.length,
      surveyResultsHydrated: true,
    });
  }



async fetchQuestionModeResponses() {
const netIdStr = String(this.props.network?.id ?? this.props.networkChainId ?? '');
if (!netIdStr) return;
const questionNetCache = await this.getScopedQuestionNetworkData('questions');
		const allQuestions = questionNetCache?.questions || {};

		const partialQR: any = questionNetCache?.questionResponses || {};
	const aggregatorMap: Record<string, any> = {};

	Object.keys(partialQR).forEach((qId: any) => {
	  const lowerQ = qId.toLowerCase();
	  aggregatorMap[lowerQ] = aggregatorMap[lowerQ] || {};
		  const respondersMap: any = partialQR[qId] || {};

  Object.keys(respondersMap).forEach((rAddr: any) => {
    const rData = respondersMap[rAddr];
    const parsed = this.parseResponse(rData);
    if (parsed) {
      // store as array downstream; collect as array here
      if (!Array.isArray(aggregatorMap[lowerQ])) {
        aggregatorMap[lowerQ] = [];
      }
      aggregatorMap[lowerQ].push({
        responder: rAddr.toLowerCase(),
        questionId: lowerQ,
        response: parsed,
        timestamp: parsed.timeStamp || 0
      });
    }
	  });
	});

	const knownQIDs = Object.keys(allQuestions);
	const finalAggregator = unifyAggregatorWithAllQuestionIDs(aggregatorMap, knownQIDs);
	const totalQ = Object.keys(finalAggregator).length;
  const totalResponseCount = countQuestionModeResponses(finalAggregator, allQuestions);

// Compute a baseline "filtered" count (used when no filters are active)
const initialFilteredCount = totalResponseCount;

// 🛡️ Preserve currently-applied filters across refresh if a filter is active
if (this.state.isFilterActive) {
  this.setState(
    {
      aggregatorQuestionResponses: finalAggregator,
      // keep whatever filtered view is currently shown
      sbtFilteredAggregatorQuestionResponses:
        this.state.sbtFilteredAggregatorQuestionResponses || finalAggregator,
      questionResponses: partialQR,
      totalQuestionsCount: totalQ,
      totalResponsesCount: totalResponseCount,
      filteredQuestionsCount:
        typeof this.state.filteredQuestionsCount === 'number'
          ? Math.min(this.state.filteredQuestionsCount, totalQ)
          : totalQ,
      // keep the previous filtered count so the header doesn't jump
      filteredResponsesCount:
        typeof this.state.filteredResponsesCount === 'number'
          ? this.state.filteredResponsesCount
          : initialFilteredCount,
      questionResultsHydrated: true
    },
    () => {
      // ask the QuestionFilter to re-apply its pipeline on the fresh data
      if (this.questionFilterRef && this.questionFilterRef.current) {
        try {
          this.questionFilterRef.current.handleApplyFilters(true);
        } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
      }
    }
  );
} else {
  // no active filters – reset filtered view to the full aggregator
  this.setState({
    aggregatorQuestionResponses: finalAggregator,
    sbtFilteredAggregatorQuestionResponses: finalAggregator,
    questionResponses: partialQR,
    totalQuestionsCount: totalQ,
    totalResponsesCount: totalResponseCount,
    filteredQuestionsCount: totalQ,
    filteredResponsesCount: initialFilteredCount,
    questionResultsHydrated: true
  });
}
}


generateResponsesCSV: any = () => {
const { viewMode, surveyViewMode, sbtFilteredResponses, sbtFilteredAggregatorQuestionResponses } = this.state;
let csvContent = '';
let header = '';
const csvRows: any[] = [];

if (!this.props.network || !this.props.network.id) {
  this.setState({ alertMessage: 'Network not available for fetching question data.' });
  return '';
}
const networkQuestions = this.getNetworkQuestionsForCurrentContext();

const formatCell = (value: any) => {
  if (Array.isArray(value)) value = value.join(', ');
  const stringValue = String(value !== undefined && value !== null ? value : '');
  return `"${stringValue.replace(/"/g, '""')}"`;
};

// -------- timestamp helpers --------
const normalizeTsToMs = (val: any) => {
  if (val == null) return NaN;
  if (typeof val === 'number') return val < 1e12 ? Math.floor(val * 1000) : val; // sec -> ms
  if (typeof val === 'string') {
    if (/^\d+$/.test(val)) {
      const n = parseInt(val, 10);
      return n < 1e12 ? n * 1000 : n;
    }
    const d = Date.parse(val);
    return Number.isNaN(d) ? NaN : d;
  }
  return NaN;
};
const pickTimestampMs = (primary: any, fallback1: any, fallback2: any) => {
  const candidates = [
    primary && (primary.timestamp ?? primary.timeStamp),
    primary && primary.answer && (primary.answer.timestamp ?? primary.answer.timeStamp),
    fallback1 && (fallback1.timestamp ?? fallback1.timeStamp),
    fallback2 && (fallback2.timestamp ?? fallback2.timeStamp),
  ].filter((x: any) => x !== undefined && x !== null);
  for (const c of candidates) {
    const ms = normalizeTsToMs(c);
    if (!Number.isNaN(ms)) return ms;
  }
  return -Infinity; // unknown => oldest
};
const formatTsForCsv = (ms: any) => (ms > 0 && Number.isFinite(ms) ? new Date(ms).toISOString() : '');

// -------- filename (prefix by mode) --------
const tsName = new Date().toISOString().replace(/[:.]/g, '_');
try {
  const isSurveyIndividuals = (viewMode === 'survey' && surveyViewMode === 'individuals');
  const prefix = isSurveyIndividuals ? 'contextEngine_surveyResponses' : 'contextEngine_questionResponses';

  let cleanSession = '';
  const sessionName = this.props.sessionName;
  try {
    if (typeof sessionName === 'string' && sessionName.trim().length > 0) {
      cleanSession = sessionName.replace(/[^A-Za-z0-9_-]+/g, '');
    } else if (sessionName !== undefined) {
      surveyLog.error('[SurveyResults.generateResponsesCSV] sessionName provided but not a non-empty string:', sessionName);
    }
  } catch (orgErr) {
    surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to sanitize sessionName:', orgErr);
  }

  const suggested = `${prefix}_${tsName}${cleanSession ? '_' + cleanSession : ''}.csv`;
  this.csvFileName = suggested;
  if (typeof this.setState === 'function') {
    this.setState({ csvFileName: suggested });
  }
} catch (err) {
  surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set CSV filename:', err);
  const fallback = `contextEngine_questionResponses_${tsName}.csv`;
  this.csvFileName = fallback;
  try {
    if (typeof this.setState === 'function') {
      this.setState({ csvFileName: fallback });
    }
  } catch (innerErr) {
    surveyLog.error('[SurveyResults.generateResponsesCSV] Failed to set fallback CSV filename:', innerErr);
  }
}

if (viewMode === 'survey' && surveyViewMode === 'individuals') {
  header = 'responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp\n';

  // De-dupe latest per (responder|questionID)
  const latest: any = new Map();
  const passthroughRows: any[] = [];

  (sbtFilteredResponses || []).forEach((response: any) => {
    const parsedResponse = this.parseResponse(response.response);
    if (parsedResponse && parsedResponse.responses) {
      parsedResponse.responses.forEach((answer: any) => {
        const qid = getResponseQuestionId(answer);
        const responderAddress =
          typeof response.responder === 'string'
            ? response.responder
            : (response.responder && response.responder.address) || response.responder || '';

        const questionData = networkQuestions[qid?.toLowerCase?.() ?? qid];
        let optionsString = '';
        if (questionData && questionData.type === 'multichoice' && Array.isArray(questionData.options)) {
          optionsString = questionData.options.join(';');
        }

        const ms = pickTimestampMs(answer, parsedResponse, response);
        const tsOut = formatTsForCsv(ms);

        const row = [
          responderAddress,
          qid,
          getResponseQuestionPrompt(answer, questionData),
          getResponseQuestionType(answer, questionData),
          optionsString,
          getConvictionValue(answer),
          answer.answer?.value,
          answer.answer?.hash,
          answer.additional?.value,
          answer.answer?.encrypted,
          answer.additional?.encrypted,
          answer.additional?.hash,
          tsOut
        ].map(formatCell).join(',');

        if (!responderAddress || !qid) {
          passthroughRows.push(row);
          return;
        }

        const key = `${String(responderAddress).toLowerCase()}|${String(qid).toLowerCase()}`;
        const prev = latest.get(key);
        if (!prev || ms > prev.ms) {
          latest.set(key, { ms, row });
        }
      });
    }
  });

  csvRows.push(...passthroughRows, ...Array.from(latest.values()).map((v: any) => v.row));
} else {
  // 'questions' mode or 'survey' -> 'aggregate' mode (question-centric)
  header = 'questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp\n';

  const dataToExport = sbtFilteredAggregatorQuestionResponses || {};
  const latest: any = new Map();
  const passthroughRows: any[] = [];

  Object.values(dataToExport).forEach((responsesArray: any) => {
    (responsesArray || []).forEach((respObj: any) => {
      const parsed = this.parseResponse(respObj.response);
      if (!parsed) return;

      let responderAddress = '';
      if (typeof respObj.responder === 'string') {
        responderAddress = respObj.responder;
      } else if (respObj.responder && typeof respObj.responder.address === 'string') {
        responderAddress = respObj.responder.address;
      }

      const qid = getResponseQuestionId(parsed);
      const questionData = networkQuestions[qid?.toLowerCase?.() ?? qid];
      let optionsString = '';
      if (questionData && questionData.type === 'multichoice' && Array.isArray(questionData.options)) {
        optionsString = questionData.options.join(';');
      }

      const ms = pickTimestampMs(parsed, null, respObj);
      const tsOut = formatTsForCsv(ms);

      const row = [
        qid,
        getResponseQuestionPrompt(parsed, questionData),
        getResponseQuestionType(parsed, questionData),
        optionsString,
        responderAddress,
        getConvictionValue(parsed),
        parsed.answer?.value,
        parsed.answer?.hash,
        parsed.additional?.value,
        parsed.answer?.encrypted,
        parsed.additional?.encrypted,
        parsed.additional?.hash,
        tsOut
      ].map(formatCell).join(',');

      if (!responderAddress || !qid) {
        passthroughRows.push(row);
        return;
      }

      const key = `${String(responderAddress).toLowerCase()}|${String(qid).toLowerCase()}`;
      const prev = latest.get(key);
      if (!prev || ms > prev.ms) {
        latest.set(key, { ms, row });
      }
    });
  });

  csvRows.push(...passthroughRows, ...Array.from(latest.values()).map((v: any) => v.row));
}

csvContent = header + csvRows.join('\n');
return csvContent;
}

generateResultsJSON: any = () => {
const {
  viewMode,
  surveyViewMode,
  surveyId,
  surveyTitle,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount,
  filteredResponsesCount,
  filterState,
  sbtFilteredResponses,
  sbtFilteredAggregatorQuestionResponses,
} = this.state;

const filteredQuestions = this.getFilteredQuestionsForExport();

return JSON.stringify(
  {
    exportedAt: new Date().toISOString(),
    sessionSlug: this.getEffectiveSlug() || '',
    viewMode,
    surveyViewMode,
    surveyId: surveyId || null,
    surveyTitle: surveyTitle || '',
    counts: {
      totalQuestions: totalQuestionsCount,
      filteredQuestions: filteredQuestionsCount,
      totalResponses: totalResponsesCount,
      filteredResponses: filteredResponsesCount,
    },
    filterState: filterState || {},
    filteredQuestions,
    filteredQuestionResponses: sbtFilteredAggregatorQuestionResponses || {},
    filteredResponses: sbtFilteredResponses || [],
  },
  null,
  2
);
}

getFilteredQuestionIdsForExport: any = () => {
const questionIds: any = new Set();

Object.keys(this.state.sbtFilteredAggregatorQuestionResponses || {}).forEach((qId: any) => {
  const normalized = String(qId || '').trim().toLowerCase();
  if (normalized) questionIds.add(normalized);
});

(this.state.sbtFilteredResponses || []).forEach((response: any) => {
  const parsedResponse = this.parseResponse(response?.response);
  const responseRows = Array.isArray(parsedResponse?.responses) ? parsedResponse.responses : [];
  responseRows.forEach((answer: any) => {
    const normalized = getResponseQuestionId(answer);
    if (normalized) questionIds.add(String(normalized).toLowerCase());
  });
});

return Array.from(questionIds);
}

getFilteredQuestionsForExport: any = () => {
const networkQuestions = this.getNetworkQuestionsForCurrentContext();
return this.getFilteredQuestionIdsForExport().map((qId: any) => {
  const normalizedQuestionId = typeof qId === 'string' ? qId.toLowerCase() : qId;
  const questionData = networkQuestions[normalizedQuestionId] || networkQuestions[qId] || {};

  return {
    id: questionData.id || qId,
    prompt: questionData.prompt || '',
    type: questionData.type || '',
    tags: Array.isArray(questionData.tags) ? [...questionData.tags] : [],
    options: Array.isArray(questionData.options) ? [...questionData.options] : [],
  };
});
}

generateQuestionsJSON: any = () => {
const {
  viewMode,
  surveyViewMode,
  surveyId,
  surveyTitle,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount,
  filteredResponsesCount,
  filterState,
} = this.state;

return JSON.stringify(
  {
    exportedAt: new Date().toISOString(),
    sessionSlug: this.getEffectiveSlug() || '',
    viewMode,
    surveyViewMode,
    surveyId: surveyId || null,
    surveyTitle: surveyTitle || '',
    counts: {
      totalQuestions: totalQuestionsCount,
      filteredQuestions: filteredQuestionsCount,
      totalResponses: totalResponsesCount,
      filteredResponses: filteredResponsesCount,
    },
    filterState: filterState || {},
    filteredQuestions: this.getFilteredQuestionsForExport(),
  },
  null,
  2
);
}

generateQuestionsCSV: any = () => {
if (!this.props.network || !this.props.network.id) {
  this.setState({ alertMessage: 'Network not available for fetching question data.' });
  return '';
}

const filteredQuestions = this.getFilteredQuestionsForExport();
if (!filteredQuestions.length) {
  this.setState({ alertMessage: 'No filtered questions to export.' });
  return '';
}

const header = '"questionID","prompt","type","tags","options"\n';
const csvRows = filteredQuestions.map((question: any) => {
  const tags = Array.isArray(question?.tags) ? question.tags.join(';') : '';
  const options = Array.isArray(question?.options) ? question.options.join(';') : '';
  return [
    `"${String(question?.id || '').replace(/"/g, '""')}"`,
    `"${String(question?.prompt || '').replace(/"/g, '""')}"`,
    `"${String(question?.type || '').replace(/"/g, '""')}"`,
    `"${String(tags).replace(/"/g, '""')}"`,
    `"${String(options).replace(/"/g, '""')}"`,
  ].join(',');
});

return header + csvRows.join('\n');
}

getExportBaseFileName: any = (exportType: any = this.state.exportType) => {
const { viewMode, surveyId } = this.state;
const questionsOnly =
  exportType === EXPORT_TYPES.CSV_QUESTIONS ||
  exportType === EXPORT_TYPES.JSON_QUESTIONS;

if (viewMode === 'survey') {
  const surveyIdShort = surveyId
    ? getShortenedSurveyID(surveyId, false, null, true)
    : 'all';
  return questionsOnly
    ? `contextEngine_surveyQuestions_${surveyIdShort}`
    : `contextEngine_surveyResults_${surveyIdShort}`;
}

return questionsOnly ? 'contextEngine_filteredQuestions' : 'contextEngine_questionResults';
}

downloadCSV: any = () => {
const { exportType } = this.state;
const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
let fileContent = '';
let filename = '';
let mimeType = 'text/plain;charset=utf-8;';
const baseFileName = this.getExportBaseFileName(exportType);

switch (exportType) {
  case EXPORT_TYPES.CSV_QUESTIONS:
    fileContent = this.generateQuestionsCSV();
    filename = `${baseFileName}_${timestamp}.csv`;
    mimeType = 'text/csv;charset=utf-8;';
    break;
  case EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES:
    fileContent = this.generateResponsesCSV();
    filename = `${baseFileName}_${timestamp}.csv`;
    mimeType = 'text/csv;charset=utf-8;';
    break;
  case EXPORT_TYPES.JSON_QUESTIONS:
    fileContent = this.generateQuestionsJSON();
    filename = `${baseFileName}_${timestamp}.json`;
    mimeType = 'application/json;charset=utf-8;';
    break;
  case EXPORT_TYPES.JSON_QUESTIONS_AND_RESPONSES:
    fileContent = this.generateResultsJSON();
    filename = `${baseFileName}_${timestamp}.json`;
    mimeType = 'application/json;charset=utf-8;';
    break;
  default:
    this.setState({ alertMessage: 'Invalid export type selected.' });
    return;
}

if (!csvContent || !csvContent.trim() || csvContent.split('\n').length < 2) {
  if (!this.state.alertMessage) {
    this.setState({ alertMessage: 'No data available to download for this export type.' });
  }
  return;
}

if (
  (exportType === EXPORT_TYPES.CSV_QUESTIONS || exportType === EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES) &&
  fileContent.split('\n').length < 2
) {
  if (!this.state.alertMessage) {
    this.setState({ alertMessage: 'No data available to download for this export type.' });
  }
  return;
}

const blob = new Blob([fileContent], { type: mimeType });
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.setAttribute('hidden', '');
a.setAttribute('href', url);
a.setAttribute('download', filename);
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
};

handleExportTypeChange: any = (type: any) => {
this.setState({ exportType: type, alertMessage: '' });
};

handleQuestionFilter: any = (filteredQuestionsOrCombined: any, newFilterState: any) => {
  // ⛑️ Gate: don't clobber counts or bubble anything until the question cache is ready
  if (!this.props.isQuestionCacheReady) return;

  const isSurveyMode = this.state.viewMode === 'survey';
  const isSurveyAggregate = isSurveyMode && this.state.surveyViewMode === 'aggregate';
  const isSurveyIndividuals = isSurveyMode && this.state.surveyViewMode === 'individuals';

  let filteredQuestions: any[] = [];
  let filteredResponsesByQuestion: any = null;
  if (Array.isArray(filteredQuestionsOrCombined)) {
    filteredQuestions = filteredQuestionsOrCombined;
  } else if (
    filteredQuestionsOrCombined &&
    Array.isArray(filteredQuestionsOrCombined.filteredQuestions)
  ) {
    filteredQuestions = filteredQuestionsOrCombined.filteredQuestions;
    filteredResponsesByQuestion =
      filteredQuestionsOrCombined.filteredResponsesByQuestion || {};
  } else {
    return;
  }

  const finalFilteredQCount = filteredQuestions.length;
  if (this.props.onCountUpdate) {
    this.props.onCountUpdate(finalFilteredQCount);
  }

  const statePatch: any = {
    filteredQuestionsCount: finalFilteredQCount,
  };

  if (!isSurveyIndividuals) {
    const sourceMap = isSurveyAggregate
      ? (this.state.aggregateQuestionResponses || {})
      : (this.state.aggregatorQuestionResponses || {});
    const allowedIds: any = new Set(
      filteredQuestions.map((q: any) => String(q?.id || '').toLowerCase())
    );
    const nextFilteredAggregator: Record<string, any> = {};

    Object.keys(sourceMap).forEach((qId: any) => {
      if (!allowedIds.has(String(qId || '').toLowerCase())) return;
      if (
        filteredResponsesByQuestion &&
        Object.prototype.hasOwnProperty.call(filteredResponsesByQuestion, qId)
      ) {
        const arr = filteredResponsesByQuestion[qId] || [];
        if (Array.isArray(arr) && arr.length > 0) {
          nextFilteredAggregator[qId] = arr;
        }
        return;
      }
      nextFilteredAggregator[qId] = sourceMap[qId];
    });

    statePatch.sbtFilteredAggregatorQuestionResponses = nextFilteredAggregator;
    if (isSurveyAggregate) {
      const responders: any = new Set();
      Object.values(nextFilteredAggregator).forEach((rows: any) => {
        if (Array.isArray(rows)) rows.forEach((r: any) => { if (r?.responder) responders.add(r.responder.toLowerCase()); });
      });
      statePatch.filteredResponsesCount = Math.min(responders.size, this.state.totalResponsesCount);
    } else {
      const networkQuestions = this.getNetworkQuestionsForCurrentContext();
      const totalR = countQuestionModeResponses(nextFilteredAggregator, networkQuestions);
      statePatch.filteredResponsesCount = Math.min(totalR, this.state.totalResponsesCount);
    }
  }

  this.commitResultsFilterState(statePatch, newFilterState);
};





  setFilterLoading: any = (loading: any) => {
    const nextLoading = !!loading;
    const baseline = this._pendingFilterLoadingValue != null
      ? this._pendingFilterLoadingValue
      : !!this.state.filterLoading;

    if (baseline !== nextLoading) {
      this._pendingFilterLoadingValue = nextLoading;
      this.setState((prev: any) => (
        prev.filterLoading === nextLoading ? null : { filterLoading: nextLoading }
      ), () => {
        if (this.state.filterLoading === this._pendingFilterLoadingValue) {
          this._pendingFilterLoadingValue = null;
        }
      });
    }

    if (this.props.setFilterLoading) {
      this.props.setFilterLoading(nextLoading);
    }
  };

handleQuestionFilterCountUpdate: any = (count: any) => {
  // ⛑️ Gate: ignore transient zero while responses/aggregators are still hydrating.
  if (!this.props.isQuestionCacheReady) return;

  const baseMap =
    (this.state.viewMode === 'survey' && this.state.surveyViewMode === 'aggregate')
      ? (this.state.aggregateQuestionResponses || {})
      : (this.state.aggregatorQuestionResponses || {});
  const baseQuestions = Object.keys(baseMap).length;

  const hasAnyResponses =
    baseQuestions > 0 ||
    Object.keys(this.state.questionResponses || {}).length > 0 ||
    Object.keys(this.state.sbtFilteredAggregatorQuestionResponses || {}).length > 0;

  if (
    count === 0 &&
    (!hasAnyResponses || this.state.filterLoading || !this.props.isResponsesCacheReady)
  ) {
    return;
  }

  if (count === this.state.filteredQuestionsCount) return;
  this.setState({ filteredQuestionsCount: count });
  if (this.props.onCountUpdate) this.props.onCountUpdate(count);
};

// SurveyResults.handleFilteredResponses(...)
handleFilteredResponses: any = (filteredResponses: any, newSbtFilterLocalState: any) => {
  // ⛑️ Gate: avoid overwriting filtered maps during waiting/aborted states
  if (!this.props.isQuestionCacheReady) return;
  const nextFilterState =
    typeof newSbtFilterLocalState !== 'undefined'
      ? { ...(this.state.filterState || {}), sbtFilter: newSbtFilterLocalState }
      : (this.state.filterState || {});

  if (this.state.viewMode === 'survey') {
    if (this.state.surveyViewMode === 'individuals') {
      if (Array.isArray(filteredResponses)) {
        this.commitResultsFilterState(
          {
            sbtFilteredResponses: filteredResponses,
            filteredResponsesCount: filteredResponses.length,
          },
          nextFilterState
        );
      } else {
        surveyLog.error('Expected an array in survey mode (individuals), got:', filteredResponses);
        this.commitResultsFilterState(
          { sbtFilteredResponses: [], filteredResponsesCount: 0 },
          nextFilterState
        );
      }
    } else {
      // survey aggregate
      if (filteredResponses && typeof filteredResponses === 'object') {
        // 🔒 prune zero-response questions to avoid reintroducing empty keys
        const pruned: Record<string, any> = {};
        Object.entries(filteredResponses).forEach(([k, arr]: any) => {
          if (Array.isArray(arr) && arr.length > 0) pruned[k] = arr;
        });

        const responders: any = new Set();
        Object.values(pruned).forEach((rows: any) => {
          if (Array.isArray(rows)) rows.forEach((r: any) => { if (r?.responder) responders.add(r.responder.toLowerCase()); });
        });
        const finalRCount = Math.min(responders.size, this.state.totalResponsesCount);

        this.commitResultsFilterState(
          {
            sbtFilteredAggregatorQuestionResponses: pruned,
            filteredResponsesCount: finalRCount,
          },
          nextFilterState
        );
      } else {
        surveyLog.error('Expected aggregator object in aggregator mode, got:', filteredResponses);
      }
    }
  } else {
    // questions mode
    if (filteredResponses && typeof filteredResponses === 'object') {
      // 🔒 prune zero-response questions here as well
      const pruned: Record<string, any> = {};
      Object.entries(filteredResponses).forEach(([k, arr]: any) => {
        if (Array.isArray(arr) && arr.length > 0) pruned[k] = arr;
      });

      const networkQuestions = this.getNetworkQuestionsForCurrentContext();
      const totalR = countQuestionModeResponses(pruned, networkQuestions);
      const finalRCount = totalR > this.state.totalResponsesCount ? this.state.totalResponsesCount : totalR;

      this.commitResultsFilterState(
        {
          sbtFilteredAggregatorQuestionResponses: pruned,
          filteredResponsesCount: finalRCount,
        },
        nextFilterState
      );
    } else {
      surveyLog.error('Expected aggregator object for question mode, got:', filteredResponses);
    }
  }
};




toggleQuestionSummary: any = (questionId: any) => {
this.setState((prevState: any) => ({
  activeQuestionToggles: {
    ...prevState.activeQuestionToggles,
    [questionId]: !prevState.activeQuestionToggles[questionId]
  }
}));
};

toggleResponse: any = (index: any) => {
this.setState((prevState: any) => ({
  activeToggles: {
    ...prevState.activeToggles,
    [index]: !prevState.activeToggles[index]
  }
}));
};

toggleSurveyBookmark: any = (surveyId: any) => {
const slug = this.getEffectiveSlug();
let bookmarksCache;
const defaultCache = { surveys: [], questions: [] };

try {
  const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
  bookmarksCache = (parsed && typeof parsed === 'object')
    ? {
        ...parsed,
        surveys: Array.isArray(parsed.surveys) ? [...parsed.surveys] : [],
        questions: Array.isArray(parsed.questions) ? [...parsed.questions] : [],
      }
    : defaultCache;
  if (
    typeof bookmarksCache !== 'object' ||
    bookmarksCache === null ||
    !Array.isArray(bookmarksCache.surveys) ||
    !Array.isArray(bookmarksCache.questions)
  ) {
    bookmarksCache = defaultCache;
  }
} catch (error) {
  surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
  bookmarksCache = defaultCache;
}

const surveyIndex = bookmarksCache.surveys.indexOf(surveyId);
if (surveyIndex > -1) {
  bookmarksCache.surveys.splice(surveyIndex, 1);
} else {
  bookmarksCache.surveys.push(surveyId);
}

void writeCache('bookmarksCache', slug, bookmarksCache).catch((error: any) => {
  surveyLog.error('[SurveyResults] Error saving bookmarksCache:', error);
});
this.setState({ bookmarkedSurveyIDs: [...bookmarksCache.surveys] });
};

toggleQuestionBookmark: any = (questionId: any) => {
const slug = this.getEffectiveSlug();
let bookmarksCache;
const defaultCache = { surveys: [], questions: [] };

try {
  const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
  bookmarksCache = (parsed && typeof parsed === 'object')
    ? {
        ...parsed,
        surveys: Array.isArray(parsed.surveys) ? [...parsed.surveys] : [],
        questions: Array.isArray(parsed.questions) ? [...parsed.questions] : [],
      }
    : defaultCache;
  if (
    typeof bookmarksCache !== 'object' ||
    bookmarksCache === null ||
    !Array.isArray(bookmarksCache.surveys) ||
    !Array.isArray(bookmarksCache.questions)
  ) {
    bookmarksCache = defaultCache;
  }
} catch (error) {
  surveyLog.error('[SurveyResults] Error reading bookmarksCache:', error);
  bookmarksCache = defaultCache;
}

const questionIndex = bookmarksCache.questions.indexOf(questionId);
if (questionIndex > -1) {
  bookmarksCache.questions.splice(questionIndex, 1);
} else {
  bookmarksCache.questions.push(questionId);
}

void writeCache('bookmarksCache', slug, bookmarksCache).catch((error: any) => {
  surveyLog.error('[SurveyResults] Error saving bookmarksCache:', error);
});
this.setState({ bookmarkedQuestionIDs: [...bookmarksCache.questions] });
};

transformIndividualResponsesToAggregator: any = (individualResponses: any) => {
  if (!individualResponses || individualResponses.length === 0) {
    return {};
  }

  const aggregator: Record<string, any> = {};

  individualResponses.forEach((response: any) => {
    const parsedResponse = normalizeSurveyResponsePayloadByQuestionId(response.response); // Already an object
    if (parsedResponse && Array.isArray(parsedResponse.responses)) {
      parsedResponse.responses.forEach((answerItem: any) => {
        const qIdLower = getSurveyResponseQuestionId(answerItem);
        if (!qIdLower) return;

        if (!aggregator[qIdLower]) {
          aggregator[qIdLower] = [];
        }

        aggregator[qIdLower].push({
          responder: String(response.responder || '').toLowerCase(), // normalize storage
          questionId: qIdLower,
          response: answerItem,
          timestamp: getSurveyResponseAggregateTimestampMs(answerItem, parsedResponse),
        });
      });
    }
  });

  return aggregator;
}

getMemoizedIndividualsAggregator: any = (individualResponses: any) => {
  const responsesRef = Array.isArray(individualResponses) ? individualResponses : [];
  const memo = this._individualResponsesAggregatorMemo;
  if (memo.responsesRef === responsesRef) {
    return memo.result;
  }
  const next = this.transformIndividualResponsesToAggregator(responsesRef);
  this._individualResponsesAggregatorMemo = {
    responsesRef,
    result: next,
  };
  return next;
};

getMemoizedViewableResponsesCount: any = (responses: any, questionType: any = '') => {
  const list = Array.isArray(responses) ? responses : [];
  const normalizedQuestionType = String(questionType || '').toLowerCase();
  const memo = this._viewableResponsesCountMemo;
  const cached = memo.get(list);
  if (cached && cached.questionType === normalizedQuestionType) {
    return cached.count;
  }
  const count = this.getLatestResponsesByResponder(list).reduce((acc: any, row: any) => {
    const parsedResponse = row?.response;
    if (!parsedResponse || !parsedResponse.answer) {
      return acc;
    }
    if (isFreeformBlankAnswer(normalizedQuestionType, parsedResponse)) {
      return acc;
    }
    const isEncryptedPlaceholder =
      parsedResponse.answer.encrypted === true &&
      parsedResponse.answer.value === '*';
    return isEncryptedPlaceholder ? acc : (acc + 1);
  }, 0);
  memo.set(list, {
    questionType: normalizedQuestionType,
    count,
  });
  return count;
};

getMemoizedAggregatorEntries: any = (aggregator: any) => {
  const ref = (aggregator && typeof aggregator === 'object') ? aggregator : {};
  const memo = this._aggregatorEntriesMemo;
  if (memo.aggregatorRef === ref) {
    return memo.entries;
  }
  const entries = measureSync('ce.surveyResults.render.aggregatorEntries', () =>
    Object.entries(ref)
  );
  this._aggregatorEntriesMemo = {
    aggregatorRef: ref,
    entries,
  };
  return entries;
};

getMemoizedPolisQuestionResponses: any = (polisSelected: any, sourceAggregator: any) => {
  if (!polisSelected) {
    this._polisQuestionResponsesMemo = {
      selected: false,
      sourceRef: null,
      result: null,
    };
    return null;
  }
  const sourceRef = (sourceAggregator && typeof sourceAggregator === 'object')
    ? sourceAggregator
    : {};
  const memo = this._polisQuestionResponsesMemo;
  if (memo.selected && memo.sourceRef === sourceRef) {
    return memo.result;
  }
  const result = measureSync('ce.surveyResults.render.polisPayload', () =>
    this.stringifyAggregatorResponses(sourceRef)
  );
  this._polisQuestionResponsesMemo = {
    selected: true,
    sourceRef,
    result,
  };
  return result;
};

resolveSummaryQuestionType: any = (question: any = null, responses: any = []) => {
  const resolvedType = String(question?.type || '').trim().toLowerCase();
  const isFreeform = resolvedType === 'freeform' || resolvedType === 'text';
  if (isFreeform) return 'freeform';
  if (resolvedType) return resolvedType;
  const responseRows = Array.isArray(responses) ? responses : [];
  for (let index = 0; index < responseRows.length; index += 1) {
    const inferredType = String(
      responseRows[index]?.response?.type ||
      responseRows[index]?.response?.questionType ||
      responseRows[index]?.response?.answer?.type ||
      ''
    ).trim().toLowerCase();
    const inferredIsFreeform = inferredType === 'freeform' || inferredType === 'text';
    if (inferredIsFreeform) return 'freeform';
    if (inferredType) return inferredType;
  }
  return '';
};

getLatestResponsesByResponder: any = (responses: any = []) => {
  const responseRows = Array.isArray(responses) ? responses : [];
  const latestByResponder: any = new Map();
  responseRows.forEach((row: any, index: any) => {
    const responderKey = String(row?.responder || `__row_${index}`).trim().toLowerCase();
    const timestamp = getSurveyResponseAggregateTimestampMs(row?.response, row);
    const existing = latestByResponder.get(responderKey);
    const existingTimestamp = getSurveyResponseAggregateTimestampMs(existing?.response, existing);
    if (!existing || timestamp >= existingTimestamp) {
      latestByResponder.set(responderKey, row);
    }
  });
  return Array.from(latestByResponder.values());
};

buildFreeformSummaryModel: any = (responses: any = []) => {
  const latestRows = this.getLatestResponsesByResponder(responses);

  let encryptedCount = 0;
  let blankCount = 0;
  const displayedResponses: any[] = [];

  latestRows.forEach((row: any) => {
    const parsedResponse = row?.response;
    if (!parsedResponse || !parsedResponse.answer) {
      blankCount += 1;
      return;
    }

    if (isFreeformBlankAnswer('freeform', parsedResponse)) {
      blankCount += 1;
      return;
    }

    const isEncryptedPlaceholder =
      parsedResponse.answer.encrypted === true &&
      parsedResponse.answer.value === '*';
    if (isEncryptedPlaceholder) {
      encryptedCount += 1;
      return;
    }

    const additionalEncrypted = parsedResponse.additional?.encrypted === true;
    const rawAdditional = additionalEncrypted ? '' : (parsedResponse.additional?.value || '');
    const safeAdditional = typeof rawAdditional === 'string' ? rawAdditional : JSON.stringify(rawAdditional);

    displayedResponses.push({
      responder: row?.responder || '',
      value: parsedResponse.answer.value,
      additional: safeAdditional,
    });
  });

  const totalResponses = Math.max(latestRows.length - blankCount, 0);
  return {
    totalResponses,
    encryptedCount,
    blankCount,
    displayedResponses,
  };
};

buildMultichoiceSummaryModel: any = (responses: any = [], question: any = null) => {
  const latestRows = this.getLatestResponsesByResponder(responses);
  const normalizeChoiceLabel = (choice: any) => {
    if (typeof choice === 'string') return choice;
    if (!choice || typeof choice !== 'object') return '';
    return choice.label ?? choice.text ?? choice.name ?? choice.value ?? '';
  };

  const displayByKey: any = new Map();
  const addOption = (option: any) => {
    const label = String(normalizeChoiceLabel(option) || '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (!displayByKey.has(key)) {
      displayByKey.set(key, label);
    }
  };

  (Array.isArray(question?.options) ? question.options : []).forEach(addOption);

  if (displayByKey.size === 0) {
    latestRows.forEach((row: any) => {
      const value = row?.response?.answer?.value;
      const items = Array.isArray(value) ? value : (value == null ? [] : [value]);
      items.forEach(addOption);
    });
  }

  const countsByKey: any = new Map();
  Array.from(displayByKey.keys()).forEach((key: any) => countsByKey.set(key, 0));

  let totalResponders = 0;
  latestRows.forEach((row: any) => {
    const parsedResponse = row?.response;
    if (!parsedResponse?.answer || parsedResponse.answer.encrypted === true) return;
    const value = parsedResponse.answer.value;
    const items = Array.isArray(value) ? value : (value == null ? [] : [value]);
    const picks: any = new Set();
    items.forEach((choice: any) => {
      const label = String(normalizeChoiceLabel(choice) || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (displayByKey.has(key)) {
        picks.add(key);
      }
    });
    if (picks.size === 0) return;
    totalResponders += 1;
    picks.forEach((key: any) => {
      countsByKey.set(key, (countsByKey.get(key) || 0) + 1);
    });
  });

  return {
    totalResponders,
    options: Array.from(displayByKey.entries()).map(([key, label]: any) => ({
      key,
      label,
      count: countsByKey.get(key) || 0,
    })),
  };
};

renderFreeformAggregatorSummary: any = (responses: any = []) => {
  const summary = this.buildFreeformSummaryModel(responses);
  const panelClassName = `${styles.surveyResultsAggregatorPanel} ${styles.surveyResultsAggregatorText}`;
  if (summary.totalResponses === 0 && summary.encryptedCount === 0 && summary.blankCount === 0) {
    return (
      <div className={panelClassName}>
        <p className={styles.surveyResultsAggregatorParagraph}>No freeform responses available.</p>
      </div>
    );
  }

  const parts = [`${summary.totalResponses} total responses.`];
  if (summary.encryptedCount > 0) {
    parts.push(`${summary.encryptedCount} encrypted responses not shown.`);
  }
  if (summary.blankCount > 0) {
    parts.push(`${summary.blankCount} blank not shown.`);
  }

  return (
    <div className={panelClassName}>
      <p className={styles.surveyResultsAggregatorParagraph}>{parts.join(' ')}</p>
      {summary.displayedResponses.map((item: any, index: any) => (
        <div
          key={`freeform-${item.responder || ''}-${index}`}
          className={styles.surveyResultsFreeformAnswer}
        >
          {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
          {item.additional && (
            <div className={styles.surveyResultsFreeformAdditionalComment}>
              <em>Comment:</em> {item.additional}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

renderMultichoiceAggregatorSummary: any = (responses: any = [], question: any = null) => {
  const summary = this.buildMultichoiceSummaryModel(responses, question);
  const panelClassName = `${styles.surveyResultsAggregatorPanel} ${styles.surveyResultsAggregatorText}`;
  if (summary.options.length === 0) {
    return (
      <div className={panelClassName}>
        <p className={styles.surveyResultsAggregatorParagraph}>
          No multichoice options are defined for this question.
        </p>
      </div>
    );
  }

  if (summary.totalResponders === 0) {
    return (
      <div className={panelClassName}>
        <p className={styles.surveyResultsAggregatorParagraph}>No multichoice responses available.</p>
      </div>
    );
  }

  return (
    <div className={panelClassName}>
      <p className={styles.surveyResultsAggregatorParagraph}>
        {summary.totalResponders} total responders to this multichoice question.
      </p>
      {summary.options.map((option: any) => {
        const percent = ((option.count / summary.totalResponders) * 100).toFixed(2);
        return (
          <div
            key={option.key}
            className={`${styles.surveyResultsFreeformAnswer} ${styles.surveyResultsMultichoiceOption}`}
          >
            <span className={styles.surveyResultsMultichoiceOptionLabel}>{option.label}</span>
            <span className={styles.surveyResultsMultichoiceOptionStats}>
              {option.count} ({percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};

getSurveyResultsResponseCardProps: any = () => ({
  containerClassName: styles.surveyResultsResponseCard,
  bodyClassName: styles.surveyResultsResponseCardBody,
  linksContainerClassName: styles.surveyResultsResponseCardLinks,
  iconButtonClassName: styles.surveyResultsResponseCardLinkButton,
  aggregatorContainerClassName: styles.surveyResultsAggregatorPanel,
  aggregatorTextClassName: styles.surveyResultsAggregatorText,
  aggregatorParagraphClassName: styles.surveyResultsAggregatorParagraph,
  aggregatorFreeformAnswerClassName: styles.surveyResultsFreeformAnswer,
});

	getDecryptLitHooks: any = () => {
	  if (this.props.lit && typeof this.props.lit === 'object') return this.props.lit;
	  if (this.props.litHooks && typeof this.props.litHooks === 'object') return this.props.litHooks;
	  if (typeof window === 'undefined') return null;
	  const windowWithLitHooks = window as any;
	  return windowWithLitHooks.__litHooks || windowWithLitHooks.litHooks || null;
	};

getQuestionEncryptionGates: any = (question: any = null) => {
  const encryption = question?.encryption;
  if (!encryption || typeof encryption !== 'object' || encryption.enabled === false) return [];
  const list = Array.isArray(encryption.gates)
    ? encryption.gates
    : (encryption.gate && typeof encryption.gate === 'object' ? [encryption.gate] : []);
  return list.filter((gate: any) => gate && typeof gate === 'object');
};

getLockedResponseKey: any = ({ responder = '', questionId = '', surveyId = '', response = null }: any = {}) => {
  const responderLower = String(responder || '').trim().toLowerCase();
  const qidLower = String(questionId || response?.questionID || response?.questionId || '').trim().toLowerCase();
  const surveyKey = String(surveyId || '').trim().toLowerCase();
  return [
    surveyKey,
    responderLower,
    qidLower,
    buildLockedResponseSignature(response || {}),
  ].join('|');
};

getDecryptedResponseOverride: any = (key: any = '') => {
  if (!key) return null;
  const overrides = this.state.decryptedResponseOverrides || {};
  return overrides[key] || null;
};

applyDecryptedOverrideToResponse: any = ({ response = null, key = '' }: any = {}) => {
  if (!response || typeof response !== 'object' || !key) return response;
  const override = this.getDecryptedResponseOverride(key);
  if (!override || typeof override !== 'object') return response;

  let changed = false;
  const next = { ...response };

  if (hasOwn(override, 'answerValue') && next.answer && typeof next.answer === 'object') {
    next.answer = { ...next.answer, value: override.answerValue };
    changed = true;
  }
  if (hasOwn(override, 'additionalValue') && next.additional && typeof next.additional === 'object') {
    next.additional = { ...next.additional, value: override.additionalValue };
    changed = true;
  }
  if (hasOwn(override, 'importance')) {
    next.importance = override.importance;
    changed = true;
  }
  if (hasOwn(override, 'conviction')) {
    next.conviction = override.conviction;
    changed = true;
  }

  return changed ? next : response;
};

buildLockedGateDetails: any = (lockedRows: any = [], questionLookup: any = {}) => {
  const rows = Array.isArray(lockedRows) ? lockedRows : [];
  if (rows.length === 0) {
    return { gateDetails: [], hasGenericGateMessage: false };
  }

  const resolvedSession = this.getEffectiveSessionContext();
  const baseSlug = resolvedSession.sessionSlug || '';
  const baseSessionConfig = resolvedSession.sessionConfig || {};
  const baseFallbackChainId = Number(
    this.props.network?.id ||
    this.props.networkChainId ||
    baseSessionConfig?.networkChainId ||
    baseSessionConfig?.__registry?.chainId ||
    0
  ) || null;
  const sessionContextMemo: any = new Map();
  const readSessionGateContext = (questionSlug: any = '') => {
    const requestedSlug = String(questionSlug || '').trim() || baseSlug;
    if (sessionContextMemo.has(requestedSlug)) {
      return sessionContextMemo.get(requestedSlug);
    }
    const nextResolvedSession = resolveSurveyResultsSessionContext({
      sessionSlug: requestedSlug,
      resolveBySlug: getSessionConfigBySlug,
    });
    const nextSlug = nextResolvedSession.sessionSlug || requestedSlug || baseSlug;
    const nextSessionConfig = nextResolvedSession.sessionConfig || {};
    const nextFallbackChainId = Number(
      this.props.network?.id ||
      this.props.networkChainId ||
      nextSessionConfig?.networkChainId ||
      nextSessionConfig?.__registry?.chainId ||
      baseFallbackChainId ||
      0
    ) || null;
    const nextContext = {
      slug: nextSlug,
      fallbackChainId: nextFallbackChainId,
      defaultPolicy: buildResponseGatePolicy({
        cfg: nextSessionConfig,
        isQuestionResponseFlow: this.state.viewMode === 'questions',
        fallbackChainId: nextFallbackChainId,
      }),
      configuredGateMap: (
        nextSessionConfig?.sponsored &&
        typeof nextSessionConfig.sponsored === 'object' &&
        nextSessionConfig.sponsored.gates &&
        typeof nextSessionConfig.sponsored.gates === 'object'
      ) ? nextSessionConfig.sponsored.gates : {},
    };
    sessionContextMemo.set(requestedSlug, nextContext);
    return nextContext;
  };

  const detailsByAddress: any = new Map();
  let hasGenericGateMessage = false;

  const addGate = (gate: any = {}, gateContext: any = readSessionGateContext()) => {
    const configuredGate = gateContext.configuredGateMap[
      normalizeGateText(gate?.gateId || gate?.id)
    ] || null;
    const gateEntries = [
      ...normalizeGateSbtEntries(configuredGate),
      ...normalizeGateSbtEntries(gate),
    ];
    if (!gateEntries.length) {
      hasGenericGateMessage = true;
      return;
    }
    gateEntries.forEach(({ address, label }: any) => {
      const key = String(address || '').toLowerCase();
      if (!key) return;
      if (detailsByAddress.has(key)) return;
      const displayLabel = resolveSbtDisplayLabel({
        address,
        preferredSlug: gateContext.slug,
        chainId: gateContext.fallbackChainId,
        fallback: 'short',
      });
      detailsByAddress.set(key, {
        address,
        label: displayLabel || label || getShortenedAddress(address, true),
        href: buildSbtDetailPath(address, gateContext.slug),
      });
    });
  };

  rows.forEach((row: any) => {
    const qid = String(row?.questionId || '').trim().toLowerCase();
    const question = questionLookup?.[qid] || null;
    const gateContext = readSessionGateContext(question?.sessionSlug || baseSlug);
    const questionGates = this.getQuestionEncryptionGates(question);
    if (questionGates.length > 0) {
      const beforeSize = detailsByAddress.size;
      questionGates.forEach((gate: any) => addGate(gate, gateContext));
      if (detailsByAddress.size > beforeSize) return;
    }
    if (Array.isArray(gateContext.defaultPolicy?.gates) && gateContext.defaultPolicy.gates.length > 0) {
      const beforeSize = detailsByAddress.size;
      gateContext.defaultPolicy.gates.forEach((gate: any) => addGate(gate, gateContext));
      if (detailsByAddress.size > beforeSize) return;
    }
    hasGenericGateMessage = true;
  });

  return {
    gateDetails: Array.from(detailsByAddress.values()),
    hasGenericGateMessage,
  };
};

getMemoizedLockedResponsesModel: any = (questionLookup: any = {}) => {
  const {
    viewMode,
    surveyViewMode,
    sbtFilteredResponses,
    sbtFilteredAggregatorQuestionResponses,
    decryptedResponseOverrides,
  } = this.state;
  const slug = this.getEffectiveSlug();
  const memo = this._lockedResponsesModelMemo || {};
  if (
    memo.viewMode === viewMode &&
    memo.surveyViewMode === surveyViewMode &&
    memo.responsesRef === sbtFilteredResponses &&
    memo.aggregatorRef === sbtFilteredAggregatorQuestionResponses &&
    memo.questionLookupRef === questionLookup &&
    memo.overridesRef === decryptedResponseOverrides &&
    memo.slug === slug
  ) {
    return memo.result;
  }

  const lockedRows: any[] = [];

  if (viewMode === 'survey' && surveyViewMode === 'individuals') {
    (Array.isArray(sbtFilteredResponses) ? sbtFilteredResponses : []).forEach((surveyResponse: any) => {
      const responder = String(surveyResponse?.responder || '').trim().toLowerCase();
      const surveyId = String(surveyResponse?.surveyId || this.state.surveyId || '').trim().toLowerCase();
      const answers = Array.isArray(surveyResponse?.response?.responses)
        ? surveyResponse.response.responses
        : [];
      answers.forEach((answerItem: any) => {
        const questionId = String(answerItem?.questionID || answerItem?.questionId || '').trim().toLowerCase();
        if (!questionId) return;
        const key = this.getLockedResponseKey({
          responder,
          questionId,
          surveyId,
          response: answerItem,
        });
        const mergedResponse = this.applyDecryptedOverrideToResponse({
          response: answerItem,
          key,
        });
        if (
          !isBannerEligibleLockedField(mergedResponse?.answer) &&
          !isBannerEligibleLockedField(mergedResponse?.additional)
        ) {
          return;
        }
        lockedRows.push({
          key,
          responder,
          surveyId,
          questionId,
          response: answerItem,
          mergedResponse,
        });
      });
    });
  } else {
    Object.entries(sbtFilteredAggregatorQuestionResponses || {}).forEach(([questionId, rows]: any) => {
      (Array.isArray(rows) ? rows : []).forEach((row: any) => {
        const responder = String(row?.responder || '').trim().toLowerCase();
        const key = this.getLockedResponseKey({
          responder,
          questionId,
          surveyId: this.state.surveyId,
          response: row?.response,
        });
        const mergedResponse = this.applyDecryptedOverrideToResponse({
          response: row?.response,
          key,
        });
        if (
          !isBannerEligibleLockedField(mergedResponse?.answer) &&
          !isBannerEligibleLockedField(mergedResponse?.additional)
        ) {
          return;
        }
        lockedRows.push({
          key,
          responder,
          surveyId: this.state.surveyId,
          questionId: String(questionId || '').trim().toLowerCase(),
          response: row?.response,
          mergedResponse,
        });
      });
    });
  }

  const { gateDetails, hasGenericGateMessage } = this.buildLockedGateDetails(lockedRows, questionLookup);
  const result = {
    lockedRows,
    lockedCount: lockedRows.length,
    gateDetails,
    hasGenericGateMessage,
  };
  this._lockedResponsesModelMemo = {
    viewMode,
    surveyViewMode,
    responsesRef: sbtFilteredResponses,
    aggregatorRef: sbtFilteredAggregatorQuestionResponses,
    questionLookupRef: questionLookup,
    overridesRef: decryptedResponseOverrides,
    slug,
    result,
  };
  return result;
};

decryptFieldValue: any = async (field: any = null) => {
  if (!field || typeof field !== 'object') return { ok: false };
  const envelope = extractEnvelopeCandidate(field);
  if (!envelope) return { ok: false };

  const litHooks = this.getDecryptLitHooks();
  const litOpts = litHooks && typeof litHooks.getKey === 'function'
    ? { getKey: litHooks.getKey }
    : undefined;

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelope, {
      account: this.props.account,
      chainId: this.props.network?.id || this.props.networkChainId || null,
      providerLike: this.props.provider,
      ...(litOpts ? { litOpts } : {}),
    });
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
};

handleDecryptLockedResponses: any = async () => {
  if (this.state.lockedResponsesDecrypting) return;
  if (!this.props.loginComplete || !this.props.account) {
    this.setState({ alertMessage: 'Login required to decrypt locked responses.' });
    return;
  }

  const questionLookup = this.getNetworkQuestionsForCurrentContext();
  const model = this.getMemoizedLockedResponsesModel(questionLookup);
  const lockedRows = Array.isArray(model?.lockedRows) ? model.lockedRows : [];
  if (lockedRows.length === 0) return;

  this.setState({ lockedResponsesDecrypting: true, alertMessage: '' });

  let anyDecrypted = false;
  const nextOverrides = { ...(this.state.decryptedResponseOverrides || {}) };

  for (const row of lockedRows) {
    const response = row?.response || {};
    const override = { ...(nextOverrides[row.key] || {}) };

    if (isLockedEncryptedField(row?.mergedResponse?.answer)) {
      const answerResult = await this.decryptFieldValue(response.answer);
      if (answerResult.ok) {
        override.answerValue = answerResult.value;
        anyDecrypted = true;
      }
    }

    if (isLockedEncryptedField(row?.mergedResponse?.additional)) {
      const additionalResult = await this.decryptFieldValue(response.additional);
      if (additionalResult.ok) {
        override.additionalValue = additionalResult.value;
        anyDecrypted = true;
      }
    }

    if (
      typeof response?.importanceEncrypted === 'string' &&
      response.importanceEncrypted.trim() &&
      !hasOwn(override, 'importance')
    ) {
      try {
        const importance = await cryptoUtils.decryptEnvelopeValue(response.importanceEncrypted, {
          account: this.props.account,
          chainId: this.props.network?.id || this.props.networkChainId || null,
          providerLike: this.props.provider,
          ...(this.getDecryptLitHooks()?.getKey ? { litOpts: { getKey: this.getDecryptLitHooks().getKey } } : {}),
        });
        override.importance = Number.isNaN(Number(importance)) ? importance : Number(importance);
        anyDecrypted = true;
      } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
    }

    if (
      typeof response?.convictionEncrypted === 'string' &&
      response.convictionEncrypted.trim() &&
      !hasOwn(override, 'conviction')
    ) {
      try {
        const conviction = await cryptoUtils.decryptEnvelopeValue(response.convictionEncrypted, {
          account: this.props.account,
          chainId: this.props.network?.id || this.props.networkChainId || null,
          providerLike: this.props.provider,
          ...(this.getDecryptLitHooks()?.getKey ? { litOpts: { getKey: this.getDecryptLitHooks().getKey } } : {}),
        });
        override.conviction = Number.isNaN(Number(conviction)) ? conviction : Number(conviction);
        anyDecrypted = true;
      } catch (e) { surveyLog.warn('SurveyResults: fallback', e); }
    }

    if (Object.keys(override).length > 0) {
      nextOverrides[row.key] = override;
    }
  }

  this.setState({
    lockedResponsesDecrypting: false,
    decryptedResponseOverrides: nextOverrides,
    ...(anyDecrypted
      ? {}
      : { alertMessage: `Unable to decrypt locked responses with the connected ${t('walletLower')}.` }),
  });
};

toggleLockedResponseDetails: any = () => {
  this.setState((prev: any) => ({
    lockedResponseDetailsOpen: !prev.lockedResponseDetailsOpen,
  }));
};

renderLockedResponsesToggle: any = (lockedModel: any = null) => {
  const lockedCount = Number(lockedModel?.lockedCount || 0);
  if (lockedCount <= 0) return null;

  const isOpen = !!this.state.lockedResponseDetailsOpen;
  const lockedLabel = `${lockedCount} locked response${lockedCount === 1 ? '' : 's'}`;

  return (
    <button
      type="button"
      className={[
        styles.lockedSummaryToggle,
        isOpen ? styles.lockedSummaryToggleOpen : '',
      ].filter(Boolean).join(' ')}
      onClick={this.toggleLockedResponseDetails}
      aria-expanded={isOpen}
      aria-controls="ce-results-locked-details"
      aria-label={`${isOpen ? 'Hide' : 'Show'} ${lockedLabel}`}
      title={lockedLabel}
      data-testid="ce-results-locked-toggle"
    >
      <span className={styles.lockedSummaryCount}>{lockedCount}</span>
      <FontAwesomeIcon icon={faLock} className={styles.lockedSummaryIcon} />
    </button>
  );
};

renderLockedResponsesBanner: any = (lockedModel: any = null) => {
  const lockedCount = Number(lockedModel?.lockedCount || 0);
  if (lockedCount <= 0) return null;

  const gateDetails = Array.isArray(lockedModel?.gateDetails) ? lockedModel.gateDetails : [];
  const isOpen = !!this.state.lockedResponseDetailsOpen;
  if (!isOpen) return null;

  return (
    <div
      id="ce-results-locked-details"
      className={styles.lockedBanner}
      data-testid="ce-results-locked-banner"
    >
      <div className={styles.lockedBannerTop}>
        <div className={styles.lockedBannerCopy}>
          <div className={styles.lockedBannerTitleRow}>
            <FontAwesomeIcon icon={faLock} className={styles.lockedBannerIcon} />
            <h3 className={styles.lockedBannerHeadline}>
              {lockedCount} Locked Responses
            </h3>
          </div>
          <p className={styles.lockedBannerSubtext}>
            Encrypted responses are present in this result set.
          </p>
        </div>
        <Button
          type="button"
          className={styles.lockedBannerDecryptButton}
          onClick={this.handleDecryptLockedResponses}
          data-testid="ce-results-decrypt-btn"
          disabled={this.state.lockedResponsesDecrypting}
        >
          {this.state.lockedResponsesDecrypting && (
            <FontAwesomeIcon icon={faSpinner} spin className={styles.lockedBannerButtonSpinner} />
          )}
          Decrypt
        </Button>
      </div>

      <div className={styles.lockedBannerDetails}>
        {gateDetails.length > 0 && (
          <>
            <p className={styles.lockedBannerGateIntro}>
              {`Required ${gateDetails.length === 1 ? t('sbt') : t('sbts')} for decryption`}
            </p>
            <div className={styles.lockedBannerGateList}>
              {gateDetails.map((detail: any) => (
                <a
                  key={detail.address}
                  href={detail.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.lockedBannerGateLink}
                >
                  {detail.label}
                </a>
              ))}
            </div>
          </>
        )}
        {lockedModel?.hasGenericGateMessage && gateDetails.length === 0 && (
          <p className={styles.lockedBannerGenericMessage}>
            {`Locked responses require an eligible ${t('sbtLower')}. Connect an eligible ${t('walletLower')} to decrypt.`}
          </p>
        )}
      </div>
    </div>
  );
};


renderQuestionSummary: any = (questionId: any, responses: any, preNetworkQuestions: any) => {
  const domId = getQuestionCardDomId(questionId);
  const lowerQId = questionId.toLowerCase();

  // Prefer preloaded per-render cache to avoid repeated localStorage hits.
  let networkQuestions = preNetworkQuestions;
  if (!networkQuestions) {
    networkQuestions = this.getNetworkQuestionsForCurrentContext();
  }
  const question = networkQuestions[lowerQId];
  const questionPrompt = question?.prompt || `Unknown question: ${questionId}`;
  const displayResponses = (Array.isArray(responses) ? responses : []).map((row: any) => {
    const key = this.getLockedResponseKey({
      responder: row?.responder,
      questionId,
      surveyId: this.state.surveyId,
      response: row?.response,
    });
    return {
      ...row,
      response: this.applyDecryptedOverrideToResponse({
        response: row?.response,
        key,
      }),
    };
  });
  const resolvedQuestionType = this.resolveSummaryQuestionType(question, displayResponses);
  const isFreeform = resolvedQuestionType === 'freeform' || resolvedQuestionType === 'text';
  const viewableResponsesCount = this.getMemoizedViewableResponsesCount(displayResponses, resolvedQuestionType);

const isActive = this.state.activeQuestionToggles[questionId];
return (
  <Card
    key={questionId}
    id={domId}
    className={styles.aggregatorSummaryCard}
  >
    <CardHeader
      onClick={() => this.toggleQuestionSummary(questionId)}
      className={styles.questionSummaryHeader}
    >
      <div className={styles.headerLeft}>
        <div className={styles.responseCountContainer}>
          <FontAwesomeIcon icon={faComments} id={styles.responseCountIcon} />
          <span id={styles.responseCountNumber}>{viewableResponsesCount}</span>
        </div>
        <span className={styles.questionTitle}>
          {questionPrompt}
        </span>
      </div>
      <div id={styles.questionSummaryHeaderIcons}>
        <FontAwesomeIcon
          icon={faBookmark}
          className={styles.biggerIcon}
          onClick={(e: any) => {
            e.stopPropagation();
            this.toggleQuestionBookmark(questionId);
          }}
          color={this.state.bookmarkedQuestionIDs.includes(questionId) ? 'gold' : 'white'}
          style={{ cursor: 'pointer' }}
        />
        <FontAwesomeIcon
          icon={isActive ? faCaretUp : faCaretDown}
          className={styles.biggerIcon}
        />
      </div>
    </CardHeader>
    <Collapse
      isOpen={this.state.activeQuestionToggles[questionId]}
      id={styles.surveyResultsCollapse}
    >
      <CardBody className={styles.aggregatorDarkCardBody}>
        {!question && (
          <p style={{ fontStyle: 'italic', color: '#bbb', padding: '1rem' }}>
            No metadata found for this question in local cache.
          </p>
        )}
        <div className={styles.surveyResultsOverride}>
          {isFreeform ? (
            this.renderFreeformAggregatorSummary(displayResponses)
          ) : resolvedQuestionType === 'multichoice' ? (
            this.renderMultichoiceAggregatorSummary(displayResponses, question)
          ) : (
            <SingleQuestionResponse
              aggregatorResponseMode={true}
              question={question || this.getStableFallbackQuestion(questionId, 'summary')}
              allResponses={displayResponses}
              network={this.props.network}
              activeSessionSlug={question?.sessionSlug || this.getEffectiveSlug()}
              questionResponsesNonce={this.props.questionResponsesNonce}
              questionsCacheNonce={this.props.questionsCacheNonce}
              sbtCacheRevision={this.props.sbtCacheRevision}
              {...this.getSurveyResultsResponseCardProps()}
            />
          )}
        </div>
      </CardBody>
    </Collapse>
  </Card>
);
};

getStableFallbackQuestion: any = (questionId: any, mode: any = 'summary') => {
const cacheKey = String(questionId || '');
if (!this._stableFallbackQuestions || typeof this._stableFallbackQuestions !== 'object') {
  this._stableFallbackQuestions = {
    summary: new Map(),
    individual: new Map(),
  };
}
const bucket = mode === 'individual'
  ? this._stableFallbackQuestions.individual
  : this._stableFallbackQuestions.summary;
if (bucket.has(cacheKey)) return bucket.get(cacheKey);
const fallback = mode === 'individual'
  ? {
    id: questionId,
    creator: '',
    type: '',
    prompt: '',
  }
  : {
    id: questionId,
    prompt: 'Unknown question',
  };
bucket.set(cacheKey, fallback);
return fallback;
};

getMemoizedQuestionTableEntries: any = (questionMap: any = {}, networkQuestions: any = {}) => {
const { questionIdSortBy, questionIdSortAsc } = this.state;
const memo = this._questionTableEntriesMemo;
if (
  memo.questionMapRef === questionMap &&
  memo.networkQuestionsRef === networkQuestions &&
  memo.sortBy === questionIdSortBy &&
  memo.sortAsc === questionIdSortAsc
) {
  return memo.result;
}

const entries = Object.keys(questionMap || {}).map((qId: any) => {
  const responses = questionMap[qId] || [];
  const lowerQ = qId.toLowerCase();
  const qData = networkQuestions[lowerQ] || {};
  return {
    questionId: qId,
    responsesCount: this.getLatestResponsesByResponder(responses).length,
    type: qData.type || '',
    prompt: qData.prompt || '',
    sessionSlug: qData.sessionSlug || '',
  };
});

entries.sort((a: any, b: any) => {
  let cmp = 0;
  if (questionIdSortBy === 'responses') {
    cmp = a.responsesCount - b.responsesCount;
  } else if (questionIdSortBy === 'type') {
    cmp = a.type.localeCompare(b.type);
  } else if (questionIdSortBy === 'prompt') {
    cmp = a.prompt.localeCompare(b.prompt);
  }
  return questionIdSortAsc ? cmp : -cmp;
});

this._questionTableEntriesMemo = {
  questionMapRef: questionMap,
  networkQuestionsRef: networkQuestions,
  sortBy: questionIdSortBy,
  sortAsc: questionIdSortAsc,
  result: entries,
};
return entries;
};

renderQuestionIDsTable: any = (questionMap: any, preNetworkQuestions: any) => {
if (!this.props.network || !this.props.network.id) return null;
const networkQuestions = preNetworkQuestions || this.getNetworkQuestionsForCurrentContext();
const questionEntries = this.getMemoizedQuestionTableEntries(questionMap, networkQuestions);
const { questionIdSortBy, questionIdSortAsc } = this.state;

return (
  <div className={styles.questionIdTableWrapper}>
    <Table striped bordered hover size="sm" className={styles.questionIdTable}>
      <thead>
        <tr>
          <th style={{ textAlign: 'center' }}>Question ID</th>
          <th
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => this.changeQuestionIdSort('prompt')}
          >
            Prompt {questionIdSortBy === 'prompt' ? (questionIdSortAsc ? '▲' : '▼') : '▲▼'}
          </th>
          <th
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => this.changeQuestionIdSort('type')}
          >
            Type {questionIdSortBy === 'type' ? (questionIdSortAsc ? '▲' : '▼') : '▲▼'}
          </th>
          <th
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => this.changeQuestionIdSort('responses')}
          >
            Responses{' '}
            {questionIdSortBy === 'responses' ? (questionIdSortAsc ? '▲' : '▼') : '▲▼'}
          </th>
          <th style={{ textAlign: 'center' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {questionEntries.map((entry: any) => {
          const shortened = getShortenedQuestionID(entry.questionId, false);
          const bookmarked = this.state.bookmarkedQuestionIDs.includes(entry.questionId);
          return (
            <tr key={entry.questionId}>
              <td style={{ textAlign: 'center' }}>
                <FontAwesomeIcon
                  icon={faBookmark}
                  style={{ marginRight: '6px', cursor: 'pointer' }}
                  color={bookmarked ? 'gold' : 'white'}
                  onClick={() => this.toggleQuestionBookmark(entry.questionId)}
                />
                <a
                  href={buildQuestionRoutePath(entry.questionId, {
                    sessionSlug: entry.sessionSlug || this.getEffectiveSlug(),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.clickableQuestionId}
                >
                  {shortened}
                </a>
              </td>
              <td className={styles.promptColumn}>{entry.prompt || '(No prompt)'}</td>
              <td style={{ textAlign: 'center' }}>{entry.type}</td>
              <td style={{ textAlign: 'center' }}>{entry.responsesCount}</td>
              <td style={{ textAlign: 'center' }}>
                <Button
                  size="sm"
                  onClick={() => {
                    // Use setState with a callback to guarantee the scroll happens after the render.
                    // This ensures the card is expanded before we attempt to scroll to it.
                    this.setState((prevState: any) => ({
                      activeQuestionToggles: {
                        ...prevState.activeQuestionToggles,
                        [entry.questionId]: true
                      }
                    }), () => {
                      this.scrollToQuestion(entry.questionId);
                    });
                  }}
                  className={styles.tableActionButton}
                >
                  View
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  </div>
);
};

// Add this helper inside the SurveyResults class
stringifyAggregatorResponses: any = (aggregatorObj: any) => {
const out: Record<string, any> = {};
if (!aggregatorObj || typeof aggregatorObj !== 'object') return out;
Object.keys(aggregatorObj).forEach((qId: any) => {
  const arr = Array.isArray(aggregatorObj[qId]) ? aggregatorObj[qId] : [];
  out[qId] = arr.map((item: any) => ({
    ...item,
    response:
      typeof item.response === 'string'
        ? item.response
        : JSON.stringify(item.response),
  }));
});
return out;
};


scrollToQuestion: any = (questionId: any) => {
const domId = getQuestionCardDomId(questionId);
const cleanupScrollWatcher = () => {
  if (this._scrollToQuestionRetryTimer) {
    clearTimeout(this._scrollToQuestionRetryTimer);
    this._scrollToQuestionRetryTimer = null;
  }
  if (this._scrollMutationObserver) {
    this._scrollMutationObserver.disconnect();
    this._scrollMutationObserver = null;
  }
};

cleanupScrollWatcher();

const attemptScroll = () => {
  const el = document.getElementById(domId);
  if (!el || typeof el.scrollIntoView !== 'function') return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  cleanupScrollWatcher();
  return true;
};

if (attemptScroll()) return;

if (typeof MutationObserver === 'undefined') return;

const containerToWatch =
  (this.questionIdTableRef?.current &&
    this.questionIdTableRef.current.closest(`.${styles.modalBody}`)) ||
  document.querySelector(`.${styles.modalBody}`);

if (!containerToWatch) return;

this._scrollMutationObserver = new MutationObserver(() => {
  attemptScroll();
});

this._scrollMutationObserver.observe(containerToWatch, {
  childList: true,
  subtree: true,
});

this._scrollToQuestionRetryTimer = setTimeout(() => {
  cleanupScrollWatcher();
}, 2000);
};

changeQuestionIdSort: any = (column: any) => {
this.setState((prevState: any) => {
  let newAsc = true;
  if (prevState.questionIdSortBy === column) {
    newAsc = !prevState.questionIdSortAsc;
  }
  return {
    questionIdSortBy: column,
    questionIdSortAsc: newAsc
  };
});
};

  toggleQuestionFilter: any = () => {
this.setState((prevState: any) => ({ showQuestionFilter: !prevState.showQuestionFilter }));
};

toggleSurveyViewMode: any = (mode: any) => {
this.setState({ surveyViewMode: mode });
};

handleSurveyViewModeToggle: any = () => {
this.toggleSurveyViewMode(this.state.surveyViewMode === 'individuals' ? 'aggregate' : 'individuals');
};

handleSurveyViewModeKeyDown: any = (event: any) => {
if (event.key === 'Enter' || event.key === ' ') {
  event.preventDefault();
  this.handleSurveyViewModeToggle();
}
};

toggleExportArea: any = () => {
this.setState((prevState: any) => ({ exportAreaOpen: !prevState.exportAreaOpen }));
};

handleManualRefresh: any = async () => {
try {
  const slug = this.getEffectiveSlug();
  const latestOnChain = await contractScripts.getLatestBlockNumber(this.props.provider, slug);

  this.setState(
    {
      refreshTargetQuestionBlock: latestOnChain,
      refreshTargetResponseBlock: latestOnChain,
      refreshTargetSurveyBlock: latestOnChain
    },
    async () => {
      if (this.state.viewMode === 'questions') {
        if (this.props.refreshQuestionMetadata) {
          surveyLog.log("refreshQuestionMetadata present")
          await this.props.refreshQuestionMetadata();
        }
        if (this.props.refreshQuestionResponses) {
          await this.props.refreshQuestionResponses();
        }
      } else if (
        this.state.viewMode === 'survey' &&
        this.state.surveyId && // Use state.surveyId
        this.props.refreshSurveyResponsesByID
      ) {
        await this.props.refreshSurveyResponsesByID(this.state.surveyId.toLowerCase());
      }
      this.resetLocalStoragePollingBackoff('manual-refresh');
      this.pollLocalStorageForUpdates();
      this.queueResultsRefresh('manual-refresh');
    }
  );
} catch (error) {
  surveyLog.error('handleManualRefresh error:', error);
}
};

handleBookmarkFilter: any = async () => {
if (!this._isMounted) return;

const filterToBookmark = this.state.filterState;
const slug = this.getEffectiveSlug();

let filtersCache = peekCacheSync('filters', slug, { clone: false });
if (!filtersCache || typeof filtersCache !== 'object') {
  filtersCache = (await readCache('filters', slug)) || {};
} else {
  filtersCache = { ...filtersCache };
}
let bookmarks: any[] = [];
try {
  const parsed = filtersCache?.bookmarkedFilters;
  if (Array.isArray(parsed)) {
    bookmarks = [...parsed];
  } else if (parsed != null) {
    surveyLog.warn('Bookmarked filters cache was not an array. Initializing to empty array.');
  }
} catch (e) {
  surveyLog.error('Error parsing bookmarked filters cache:', e);
}

// Optional: Duplicate check (skipped for simplicity as per instructions)
bookmarks.push(filterToBookmark);

try {
  await writeCache('filters', slug, {
    ...(filtersCache && typeof filtersCache === 'object' ? filtersCache : {}),
    bookmarkedFilters: bookmarks,
  });
  this.setState({ filterBookmarkedFeedback: true });

  if (this._bookmarkFeedbackTimer) {
    clearTimeout(this._bookmarkFeedbackTimer);
    this._bookmarkFeedbackTimer = null;
  }
  this._bookmarkFeedbackTimer = setTimeout(() => {
    this._bookmarkFeedbackTimer = null;
    if (this._isMounted) {
      this.setState({ filterBookmarkedFeedback: false });
    }
  }, 2000);
} catch (e) {
  surveyLog.error('Error saving bookmarked filters cache:', e);
}
};

render() {
const isActuallyOpen = this.props.isOpen;

const {
  responses,
  sbtFilteredResponses,
  exportType,
  alertMessage,
  filterLoading,
  totalQuestionsCount,
  totalResponsesCount,
  filteredResponsesCount,
  surveyViewMode,
  exportAreaOpen,
  aggregatorQuestionResponses,
  sbtFilteredAggregatorQuestionResponses,
  surveyTitle,
  surveyDocumentURLs,
  viewMode,
  filteredQuestionsCount,
  isFilterActive,
} = this.state;

// Use this.state.surveyId for consistency
const currentSurveyId = this.state.surveyId;
// Preload scoped question metadata once per render so question-mode summaries stay in
// sync with the same list-scope aggregation used by fetchQuestionModeResponses().
const slug = this.getEffectiveSlug();
const preQuestionNetworkData = this.getScopedQuestionNetworkDataSync(viewMode);
const preNetworkQuestions = preQuestionNetworkData.questions || {};
const questionFilterQuestions = this.getMemoizedQuestionFilterQuestions(preNetworkQuestions);
const aggregatorEntries = this.getMemoizedAggregatorEntries(sbtFilteredAggregatorQuestionResponses);
const aggregatorEntriesCount = aggregatorEntries.length;
const lockedResponsesModel = this.getMemoizedLockedResponsesModel(preNetworkQuestions);
const surveyAggregateEntries =
  (viewMode === 'survey' && surveyViewMode === 'aggregate') ? aggregatorEntries : [];
const questionModeEntries = viewMode === 'questions' ? aggregatorEntries : [];

const netBlock = this.state.networkLatestBlock || 0;
const { questionLocalBlock, responseLocalBlock, surveyLocalBlock } = this.state;
const {
  refreshTargetQuestionBlock,
  refreshTargetResponseBlock,
  refreshTargetSurveyBlock
} = this.state;

const clampedQuestionLocalBlock = Math.min(questionLocalBlock, netBlock);
const clampedResponseLocalBlock = Math.min(responseLocalBlock, netBlock);
const clampedSurveyLocalBlock = Math.min(surveyLocalBlock, netBlock);

const clampedRefreshTargetQuestionBlock =
  refreshTargetQuestionBlock > 0 ? Math.min(refreshTargetQuestionBlock, netBlock) : 0;
const clampedRefreshTargetResponseBlock =
  refreshTargetResponseBlock > 0 ? Math.min(refreshTargetResponseBlock, netBlock) : 0;
const clampedRefreshTargetSurveyBlock =
  refreshTargetSurveyBlock > 0 ? Math.min(refreshTargetSurveyBlock, netBlock) : 0;

let questionDifference = 0;
let questionBarText: any = '';
let questionProgress = 0;
let showQuestionSpinner = false;

if (viewMode === 'questions') {
  if (clampedQuestionLocalBlock === 0 || netBlock === 0) {
    showQuestionSpinner = true;
  } else if (
    clampedRefreshTargetQuestionBlock > 0 &&
    clampedQuestionLocalBlock >= clampedRefreshTargetQuestionBlock
  ) {
    questionProgress = 100;
    questionBarText = `In Sync (Current: ${clampedQuestionLocalBlock} / Latest: ${clampedRefreshTargetQuestionBlock})`;
  } else {
    const denom =
      clampedRefreshTargetQuestionBlock > 0 ? clampedRefreshTargetQuestionBlock : netBlock;
    if (clampedRefreshTargetQuestionBlock === 0) {
      if (clampedQuestionLocalBlock >= netBlock) {
        questionProgress = 100;
        questionBarText = `In Sync (Current: ${clampedQuestionLocalBlock} / Latest: ${netBlock})`;
      } else {
        questionDifference = netBlock - clampedQuestionLocalBlock;
        questionBarText = `Remaining Blocks: ${questionDifference} (Current: ${clampedQuestionLocalBlock} / Latest: ${netBlock})`;
        questionProgress = Math.floor((clampedQuestionLocalBlock / netBlock) * 100);
      }
    } else {
      questionDifference = clampedRefreshTargetQuestionBlock - clampedQuestionLocalBlock;
      questionBarText = (
        <>
          Remaining Blocks: {questionDifference}{' '}
          <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: '6px' }} />
        </>
      );
      questionProgress = denom
        ? Math.floor((clampedQuestionLocalBlock / denom) * 100)
        : 0;
    }
  }
}

let showResponseSpinner = false;
let responseBarText: any = '';
let responseProgress = 0;
let difference = 0;

if (viewMode === 'survey') {
  if (clampedSurveyLocalBlock === 0 || netBlock === 0) {
    showResponseSpinner = true;
  } else if (
    clampedRefreshTargetSurveyBlock > 0 &&
    clampedSurveyLocalBlock >= clampedRefreshTargetSurveyBlock
  ) {
    responseProgress = 100;
    responseBarText = `In Sync (Current: ${clampedSurveyLocalBlock} / Latest: ${clampedRefreshTargetSurveyBlock})`;
  } else {
    const denom =
      clampedRefreshTargetSurveyBlock > 0 ? clampedRefreshTargetSurveyBlock : netBlock;
    if (clampedRefreshTargetSurveyBlock === 0) {
      if (clampedSurveyLocalBlock >= netBlock) {
        responseProgress = 100;
        responseBarText = `In Sync (Current: ${clampedSurveyLocalBlock} / Latest: ${netBlock})`;
      } else {
        difference = netBlock - clampedSurveyLocalBlock;
        responseBarText = `Remaining Blocks: ${difference} (Current: ${clampedSurveyLocalBlock} / Latest: ${netBlock})`;
        responseProgress = Math.floor((clampedSurveyLocalBlock / netBlock) * 100);
      }
    } else {
      difference = clampedRefreshTargetSurveyBlock - clampedSurveyLocalBlock;
      responseBarText = (
        <>
          Remaining Blocks: {difference}{' '}
          <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: '6px' }} />
        </>
      );
      responseProgress = denom
        ? Math.floor((clampedSurveyLocalBlock / denom) * 100)
        : 0;
    }
  }
} else {
  if (clampedResponseLocalBlock === 0 || netBlock === 0) {
    showResponseSpinner = true;
  } else if (
    clampedRefreshTargetResponseBlock > 0 &&
    clampedResponseLocalBlock >= clampedRefreshTargetResponseBlock
  ) {
    responseProgress = 100;
    responseBarText = `In Sync (Current: ${clampedResponseLocalBlock} / Latest: ${clampedRefreshTargetResponseBlock})`;
  } else {
    const denom =
      clampedRefreshTargetResponseBlock > 0 ? clampedRefreshTargetResponseBlock : netBlock;
    if (clampedRefreshTargetResponseBlock === 0) {
      if (clampedResponseLocalBlock >= netBlock) {
        responseProgress = 100;
        responseBarText = `In Sync (Current: ${clampedResponseLocalBlock} / Latest: ${netBlock})`;
      } else {
        difference = netBlock - clampedResponseLocalBlock;
        responseBarText = `Remaining Blocks: ${difference} (Current: ${clampedResponseLocalBlock} / Latest: ${netBlock})`;
        responseProgress = Math.floor((clampedResponseLocalBlock / netBlock) * 100);
      }
    } else {
      difference = clampedRefreshTargetResponseBlock - clampedResponseLocalBlock;
      responseBarText = (
        <>
          Remaining Blocks: {difference}{' '}
          <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: '6px' }} />
        </>
      );
      responseProgress = denom
        ? Math.floor((clampedResponseLocalBlock / denom) * 100)
        : 0;
    }
  }
}

const questionColor = questionProgress < 100 ? 'info' : 'success';
const responseColor = responseProgress < 100 ? 'info' : 'success';

const currentViewModeForFilter = this.state.viewMode;
const currentSurveyIdForFilter = this.state.viewMode === 'survey' ? this.state.surveyId : null;

const isSynced = (viewMode === 'questions' ? questionColor === 'success' && responseColor === 'success' : responseColor === 'success');

const surveyIdAbbreviation = currentSurveyId
  ? getShortenedSurveyID(currentSurveyId, false, null, false)
  : null;
const areSummaryCountsHydrated =
  viewMode === 'survey'
    ? !!this.state.surveyResultsHydrated
    : !!this.state.questionResultsHydrated;
const isDemoQuestionResults = this.getIsDemoQuestionResultsContext();
const demoResultsViewMode = isDemoQuestionResults
  ? this.state.demoResultsViewMode || 'raw'
  : 'raw';
const isDemoAlternateResultsView = isDemoQuestionResults && demoResultsViewMode !== 'raw';
const demoResultsViewOptions = isDemoQuestionResults
  ? [
      { key: 'report', label: 'Report' },
      { key: 'breakdown', label: 'Breakdown' },
      { key: 'atlas', label: 'Atlas' },
      { key: 'riskMatrix', label: 'Risk Matrix' },
    ]
  : [];

// Compute a context-aware filtered questions count for display
let displayedFilteredQuestionsCount;
if (viewMode === 'survey') {
  if (surveyViewMode === 'aggregate') {
    displayedFilteredQuestionsCount = aggregatorEntriesCount || totalQuestionsCount;
  } else {
    // Individuals view does not change which questions belong to the survey
    displayedFilteredQuestionsCount = totalQuestionsCount;
  }
} else {
  // Questions view – use live count from QuestionFilter if available; otherwise fallback to visible aggregator keys
  const fallbackLen = aggregatorEntriesCount;
  displayedFilteredQuestionsCount =
    (filteredQuestionsCount !== null && filteredQuestionsCount !== undefined)
      ? filteredQuestionsCount
      : fallbackLen;
}
const displayedTotalQuestionsCount = Math.max(0, Number(totalQuestionsCount) || 0);
const displayedTotalResponsesCount = Math.max(0, Number(totalResponsesCount) || 0);
const normalizedFilteredQuestionsCount = Math.min(
  displayedTotalQuestionsCount,
  Math.max(0, Number(displayedFilteredQuestionsCount) || 0)
);
const normalizedFilteredResponsesCount = Math.min(
  displayedTotalResponsesCount,
  Math.max(0, Number(filteredResponsesCount) || 0)
);

// Compact sync status display
let syncStatusText = '';
let syncStatusIcon = faSpinner;
let isSyncingOrLoading = true;

if (showQuestionSpinner || showResponseSpinner) {
  syncStatusText = 'Loading...';
} else if (isSynced) {
  syncStatusText = 'In Sync';
  isSyncingOrLoading = false;
} else {
  syncStatusText = 'Syncing...';
}
const showLongSyncNotice =
  isSyncingOrLoading &&
  this._syncLoadingStartedAt !== null &&
  Date.now() - this._syncLoadingStartedAt >= 15000;

return (
  <Modal
    isOpen={isActuallyOpen}
    toggle={this.closeModal}
    className={styles.resultsModal}
  >
    <ModalHeader toggle={this.closeModal} className={styles.modalHeader}>
      <div className={styles.modalHeaderContent}>
        <div className={styles.modalHeaderTitleBlock}>
          <h2 className={styles.modalTitle}>
            {viewMode === 'survey'
             ? `${surveyTitle ? `${surveyTitle}` : 'Survey Results'}`
              : 'Question Results'}
          </h2>
        </div>

        {viewMode === 'survey' && currentSurveyId && (
          <div className={styles.modalSubtitle}>
            <span className={styles.surveyIdMeta}>
              Survey ID:{' '}
              <a
                href={`/survey/${encodeURIComponent(currentSurveyId)}${this.getEffectiveSlug() ? `?session=${encodeURIComponent(this.getEffectiveSlug())}` : ''}`}
                className={styles.surveyIdLink}
              >
                {surveyIdAbbreviation || currentSurveyId}
              </a>
            </span>
            <FontAwesomeIcon
              icon={faBookmark}
              className={styles.biggerIcon}
              onClick={(e: any) => {
                e.stopPropagation();
                this.toggleSurveyBookmark(currentSurveyId);
              }}
              color={
                this.state.bookmarkedSurveyIDs.includes(currentSurveyId) ? 'gold' : 'grey'
              }
              style={{ marginLeft: '8px', cursor: 'pointer' }}
              title="Bookmark Survey ID"
            />
          </div>
        )}
        {viewMode === 'survey' && Array.isArray(surveyDocumentURLs) && surveyDocumentURLs.length > 0 && (
          <div className={styles.surveyDocUrls}>
            {surveyDocumentURLs.map((url: any, idx: any) => (
              <a
                key={idx}
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className={styles.surveyDocUrlLink}
                title={url}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} style={{ marginRight: 4 }} />
                {url.length > 50 ? `${url.slice(0, 47)}...` : url}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className={styles.modalHeaderControls}>
        {this.renderLockedResponsesToggle(lockedResponsesModel)}
        <div className={styles.syncStatusContainer}>
          <button
            type="button"
            className={styles.syncStatus__simple}
            onClick={() =>
              this.setState((prevState: any) => ({ syncDetailsOpen: !prevState.syncDetailsOpen }))
            }
            aria-expanded={!!this.state.syncDetailsOpen}
            aria-label="Toggle sync details"
          >
            {isSynced ? (
              <span className={styles.syncStatus__indicator_synced}></span>
            ) : (
              <FontAwesomeIcon icon={syncStatusIcon} spin={isSyncingOrLoading} />
            )}
            <span>
              {syncStatusText}
              {showLongSyncNotice}
            </span>
          </button>
          {!isSynced && (
            <button
              type="button"
              className={styles.syncStatus__quickRefresh}
              onClick={() => this.handleManualRefresh()}
              title="Refresh Now"
              aria-label="Refresh sync data"
            >
              <FontAwesomeIcon icon={faSyncAlt} />
            </button>
          )}
          <div
            className={styles.syncStatus__details}
            style={{ display: this.state.syncDetailsOpen ? 'block' : undefined }}
          >
            <div className={styles.miniBarContainer}>
              {viewMode === 'questions' && (
                <div className={styles.miniBarLine}>
                  <div className={styles.miniBarLabel}>Questions:</div>
                  {showQuestionSpinner ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '6px' }} />
                      <div className={styles.miniBarFraction}>Loading...</div>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={questionProgress}
                        color={questionColor}
                        style={{ minWidth: '100px' }}
                        className={styles.miniProgress}
                      />
                      <div className={styles.miniBarFraction}>{questionBarText}</div>
                    </>
                  )}
                </div>
              )}

              <div className={styles.miniBarLine}>
                <div className={styles.miniBarLabel}>Responses:</div>
                {showResponseSpinner ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '6px' }} />
                    <div className={styles.miniBarFraction}>Loading...</div>
                  </>
                ) : (
                  <>
                    <Progress
                      value={responseProgress}
                      color={responseColor}
                      style={{ minWidth: '100px' }}
                      className={styles.miniProgress}
                    />
                    <div className={styles.miniBarFraction}>{responseBarText}</div>
                  </>
                )}
              </div>
            </div>
            <div
              className={styles.syncStatus__refreshAction}
              onClick={() => this.handleManualRefresh()}
              title="Refresh Data from Cache/Chain"
            >
              <FontAwesomeIcon icon={faSyncAlt} />
              <span>Refresh Now</span>
            </div>
          </div>
        </div>
        {isDemoQuestionResults && (
          <div
            className={styles.demoResultsViewNav}
            aria-label="Demo results views"
            data-testid="ce-surveyresults-demo-view-nav"
          >
            {demoResultsViewOptions.map((option: any) => {
              const isActiveView = demoResultsViewMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={[
                    styles.demoResultsViewButton,
                    isActiveView ? styles.demoResultsViewButtonActive : '',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={isActiveView}
                  data-testid={`ce-surveyresults-demo-view-${option.key}`}
                  onClick={() => this.handleDemoResultsViewSelect(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ModalHeader>

    <ModalBody className={styles.modalBody}>
      {isDemoAlternateResultsView ? (
        <div
          className={styles.demoResultsSurface}
          data-testid={`ce-surveyresults-demo-surface-${demoResultsViewMode}`}
        >
          {this.renderDemoResultsSurface(demoResultsViewMode)}
        </div>
      ) : (
        <>
      {alertMessage && !filterLoading && (
        <Alert color="info" className={styles.alertMessage}>
          {alertMessage}
        </Alert>
      )}

      {filterLoading && (
        <div className={styles.loadingContainer}>
          <FontAwesomeIcon icon={faSpinner} spin size="2x" />
          <p>Applying filter...</p>
        </div>
      )}

      {viewMode === 'survey' && (
        <div className={styles.surveyViewModeToggle}>
          <Label className={styles.toggleLabel}>Individual</Label>
          <div
            className={styles.toggleSwitch}
            role="switch"
            aria-label="Toggle between individual and aggregate view"
            aria-checked={surveyViewMode === 'aggregate'}
            tabIndex={0}
            onClick={this.handleSurveyViewModeToggle}
            onKeyDown={this.handleSurveyViewModeKeyDown}
          >
            <div
              className={styles.toggleKnob}
              style={{
                left: surveyViewMode === 'aggregate' ? '31px' : '1px',
                backgroundColor: surveyViewMode === 'aggregate' ? '#4caf50' : '#fff',
              }}
            />
          </div>
          <Label className={styles.toggleLabel} style={{ marginLeft: '10px' }}>
            Aggregate
          </Label>
        </div>
      )}

      {this.renderLockedResponsesBanner(lockedResponsesModel)}

      {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
        <Card className={styles.questionListCard}>
          <CardHeader
            onClick={() => this.toggleQuestionSummary('__questionList__')}
            className={styles.questionSummaryHeader}
          >
            <span className={styles.questionTitle}> View & Sort Questions</span>
            <FontAwesomeIcon
              icon={
                this.state.activeQuestionToggles['__questionList__']
                  ? faCaretUp
                  : faCaretDown
              }
              className={styles.biggerIcon}
              style={{ marginLeft: '10px' }}
            />
          </CardHeader>
          <Collapse
            isOpen={this.state.activeQuestionToggles['__questionList__']}
            id={styles.surveyResultsCollapse}
          >
            <CardBody className={styles.aggregatorDarkCardBody}>
	              {aggregatorEntriesCount === 0 &&
	              !filterLoading ? (
	                <p>No questions found.</p>
	              ) : (
	                <div ref={this.questionIdTableRef}>
	                  {this.renderQuestionIDsTable(
	                    sbtFilteredAggregatorQuestionResponses,
	                    preNetworkQuestions
	                  )}
	                </div>
              )}
            </CardBody>
          </Collapse>
        </Card>
      )}

      {viewMode === 'questions' && (
        <Card className={styles.questionListCard}>
          <CardHeader
            onClick={() => this.toggleQuestionSummary('__questionList__')}
            className={styles.questionSummaryHeader}
          >
            <span className={styles.questionTitle}>View & Sort Questions</span>
            <FontAwesomeIcon
              icon={
                this.state.activeQuestionToggles['__questionList__']
                  ? faCaretUp
                  : faCaretDown
              }
              className={styles.biggerIcon}
              style={{ marginLeft: '10px' }}
            />
          </CardHeader>
          <Collapse
            isOpen={this.state.activeQuestionToggles['__questionList__']}
            id={styles.surveyResultsCollapse}
          >
            <CardBody className={styles.aggregatorDarkCardBody}>
	              {aggregatorEntriesCount === 0 &&
	              !filterLoading ? (
	                <p>No questions found.</p>
	              ) : (
	                <div>
	                  {this.renderQuestionIDsTable(
	                    sbtFilteredAggregatorQuestionResponses,
	                    preNetworkQuestions
	                  )}
	                </div>
              )}
            </CardBody>
          </Collapse>
        </Card>
      )}

      <div className={styles.filterSummaryBox}>
        <p className={styles.filterSummaryText}>
          Questions: <strong>{displayedTotalQuestionsCount}</strong> ‎  Filtered:{' '}
          <strong>
            {filterLoading || !areSummaryCountsHydrated ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              normalizedFilteredQuestionsCount
            )}
          </strong>
          <br />
          Responses: <strong>{displayedTotalResponsesCount}</strong> ‎  Filtered:{' '}
          <strong>
            {filterLoading || !areSummaryCountsHydrated ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              normalizedFilteredResponsesCount
            )}
          </strong>
        </p>
      </div>


      {/* The area with SBTFilter / QuestionFilter toggles previously (export + filter) */}
      <div className={styles.exportAndFilterContainer}>

        <div className={styles.filterBox}>
          {viewMode === 'survey' && surveyViewMode === 'individuals' && (
            <Label className={styles.filterBoxLabel}>
              {/* Filter (Survey Individuals): */}
            </Label>
          )}
          {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
            <Label className={styles.filterBoxLabel}>
              {/* Filter (Survey Aggregate): */}
            </Label>
          )}
          {viewMode === 'questions' && (
            <Label className={styles.filterBoxLabel}>
              {/* Filter Questions & Responses: */}
            </Label>
          )}



          {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
            <SBTFilter
              items={this.state.aggregateQuestionResponses}
              mode="responder"
              provider={this.props.provider}
              network={this.props.network}
              onFilter={this.handleFilteredResponses}
              setFilterLoading={this.setFilterLoading}
              autoExpand={false}
              buttonSurface="light"
              hideLoadingOverlay={true}
              externalSBTFilterState={this.state.filterState.sbtFilter}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isSBTCacheReady={this.props.isSBTCacheReady}
              sbtCacheRevision={this.props.sbtCacheRevision}
            />
          )}
          {viewMode === 'survey' && surveyViewMode === 'individuals' && (
            <SBTFilter
              items={this.state.responses}
              mode="responder"
              provider={this.props.provider}
              network={this.props.network}
              onFilter={this.handleFilteredResponses}
              setFilterLoading={this.setFilterLoading}
              autoExpand={false}
              buttonSurface="light"
              hideLoadingOverlay={true}
              externalSBTFilterState={this.state.filterState.sbtFilter}
              isQuestionCacheReady={this.props.isQuestionCacheReady}
              isSBTCacheReady={this.props.isSBTCacheReady}
              sbtCacheRevision={this.props.sbtCacheRevision}
            />
          )}
          {viewMode === 'questions' && (

            <>

         {/* The "Filter" button that toggles the QuestionFilter */}
        <Button id={styles.questionFilterButton} onClick={this.toggleQuestionFilter}>
          Filter

          <FontAwesomeIcon icon={faFilter} id={styles.questionFilterIcon} />

           {isFilterActive && (
            <span className={styles.clearFilterIcon} onClick={this.handleClearFiltersFromParent}>
              <FontAwesomeIcon icon={faTimes} />
            </span>
          )}
        </Button>

<QuestionFilter
  ref={this.questionFilterRef}
  onFilterActivityChange={this.handleFilterActivityChange}
  resultsMode={true}
  filterModalOpen={this.state.showQuestionFilter}
  toggleFilterModal={this.toggleQuestionFilter}
  questions={questionFilterQuestions}
  questionResponses={this.state.questionResponses}
	provider={this.props.provider}
	network={this.props.network}
	onFilter={this.handleQuestionFilter}
	onCountUpdate={this.handleQuestionFilterCountUpdate}
	filterState={this.state.filterState}
	setFilterLoading={this.setFilterLoading}
  creatorAndResponderMode={true}
  currentViewModeForUrl={currentViewModeForFilter}
  currentSurveyIdForUrl={currentSurveyIdForFilter}
  questionResponsesNonce={this.props.questionResponsesNonce}
  questionsCacheNonce={this.props.questionsCacheNonce}
  isQuestionCacheReady={this.props.isQuestionCacheReady}
  isSBTCacheReady={this.props.isSBTCacheReady}
  sbtCacheRevision={this.props.sbtCacheRevision}
  defaultTags={this.props.defaultTags}
  activeSessionSlug={this.getEffectiveSlug()}
  storageKeyPrefix={this.getQuestionFilterStorageKeyPrefix(currentViewModeForFilter)}
/>


</>
          )}
        </div>

        <div className={styles.exportDataBox}>
          {!exportAreaOpen ? (
            <Button
              onClick={this.toggleExportArea}
              className={styles.exportToggleButton}
              aria-expanded={this.state.exportAreaOpen}
              aria-controls="surveyResultsExportArea"
            >
              Export Data
            </Button>
          ) : (
            <div className={styles.exportAreaExpanded} id="surveyResultsExportArea">
              <div className={styles.exportAreaHeader}>
                <Label for="exportType" className={styles.exportLabel}>
                  Export Data:
                </Label>
                <Button
                  type="button"
                  color="link"
                  className={styles.exportCollapseButton}
                  onClick={this.toggleExportArea}
                  aria-label="Collapse export area"
                >
                  <FontAwesomeIcon icon={faCaretUp} />
                </Button>
              </div>
              <div id={styles.exportOptions}>
                <UncontrolledDropdown direction="down" className={styles.exportDropdownBox}>
                    <DropdownToggle caret className={styles.exportDropdown}>
                    {getExportTypeLabel(exportType)}
                  </DropdownToggle>
                  <DropdownMenu>
                    {EXPORT_OPTIONS.map((option: any) => (
                      <DropdownItem key={option.value} onClick={() => this.handleExportTypeChange(option.value)}>
                        {option.label}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </UncontrolledDropdown>
                <Button onClick={this.downloadCSV} className={styles.downloadButton}>
                  Download
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'survey' && surveyViewMode === 'individuals' && (
        <>
          <div className={styles.responseList}>
            {sbtFilteredResponses.length === 0 && !filterLoading ? (
              <p>No results yet.</p>
            ) : (
              sbtFilteredResponses.map((response: any, index: any) => {
                const parsedResponse = response.response; // Already an object
                const openToggle = !!this.state.activeToggles[index];
                return (
                  <Card key={index} className={styles.singleResponseCard}>
                    <CardHeader
                      onClick={() => this.toggleResponse(index)}
                      className={styles.responseHeader}
                    >
                      <span className={styles.responderAddress}>
                        <a
                          href={`/u/${encodeURIComponent(response.responder)}`}
                          className={styles.responderLink}
                          onClick={(e: any) => e.stopPropagation()}
                        >
                          {getShortenedAddress(response.responder, false)}
                        </a>
                        <a
                          href={`/survey/${encodeURIComponent(currentSurveyId)}/${encodeURIComponent(response.responder)}${this.getEffectiveSlug() ? `?session=${encodeURIComponent(this.getEffectiveSlug())}` : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.externalLink}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </a>
                      </span>
                      <FontAwesomeIcon
                        icon={openToggle ? faCaretUp : faCaretDown}
                        className={styles.biggerIcon}
                      />
                    </CardHeader>
                    <Collapse isOpen={openToggle} id={styles.surveyResultsCollapse}>
                      <CardBody className={styles.responseCard}>
                        {parsedResponse &&
                        parsedResponse.responses &&
                        parsedResponse.responses.length > 0 ? (
	                          parsedResponse.responses.map((answerItem: any, aIndex: any) => {
	                            const questionId = getSurveyResponseQuestionId(answerItem);
	                            const questionData = preNetworkQuestions[questionId] || this.getStableFallbackQuestion(questionId, 'individual');
                              const responseKey = this.getLockedResponseKey({
                                responder: response?.responder,
                                questionId,
                                surveyId: response?.surveyId || currentSurveyId,
                                response: answerItem,
                              });
                              const displayResponse = this.applyDecryptedOverrideToResponse({
                                response: answerItem,
                                key: responseKey,
                              });
	                            return (
	                              <div key={aIndex} className={styles.surveyResultsOverride}>
		                                <SingleQuestionResponse
                                  aggregatorResponseMode={false}
                                  question={questionData}
                                  response={displayResponse}
                                  mode="fullscreen"
                                  isOwnResponse={
                                    this.props.account?.toLowerCase() ===
                                    response.responder?.toLowerCase()
                                  }
                                  network={this.props.network}
                                  activeSessionSlug={questionData?.sessionSlug || this.getEffectiveSlug()}
                                  questionResponsesNonce={this.props.questionResponsesNonce}
                                  questionsCacheNonce={this.props.questionsCacheNonce}
                                  sbtCacheRevision={this.props.sbtCacheRevision}
                                  {...this.getSurveyResultsResponseCardProps()}
                                />
                              </div>
                            );
                          })
                        ) : (
                          <p>No question-level responses found for this user.</p>
                        )}
                      </CardBody>
                    </Collapse>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
        <>
	          <div className={styles.questionSummaries}>
	            {surveyAggregateEntries.map(([qId, arr]: any) => (
	              <div key={qId}>{this.renderQuestionSummary(qId, arr, preNetworkQuestions)}</div>
	            ))}
            {surveyAggregateEntries.length === 0 &&
              !filterLoading && <p>No results yet.</p>}
          </div>
        </>
      )}

	      {viewMode === 'questions' && (
	        <div className={styles.questionSummaries}>
	          {questionModeEntries.map(([qId, arr]: any) => (
	            <div key={qId}>{this.renderQuestionSummary(qId, arr, preNetworkQuestions)}</div>
	          ))}
          {questionModeEntries.length === 0 &&
            !filterLoading && <p>No results yet.</p>}
        </div>
      )}
        </>
      )}

    </ModalBody>

    <ModalFooter>
      {/* Additional footer actions if needed */}
    </ModalFooter>
  </Modal>
);
}
}

 const mapStateToProps = (state: any) => {
   const activeSessionSlug = state?.sessionState?.activeSessionSlug || '';
   return {
     activeSessionSlug,
     account: state?.profile?.account || '',
     loginComplete: !!state?.sessionState?.loginComplete,
   };
 };
 export default connect(mapStateToProps)(SurveyResults);
