import { peekCacheSync, readCache, writeCacheOptimistic } from '../../utilities/cache/cacheScripts.js';
import { normalizeQuestionIdKey } from './surveyToolSignatures.js';
import type { UnknownRecord } from './surveyToolTypes.js';

type ResponseMetaSource = {
  blockNumber?: unknown;
  bn?: unknown;
  transactionIndex?: unknown;
  txIndex?: unknown;
  txi?: unknown;
  logIndex?: unknown;
  li?: unknown;
  timestamp?: unknown;
  ts?: unknown;
  transactionHash?: unknown;
  txHash?: unknown;
  hash?: unknown;
} & UnknownRecord;
export type ResponseRecencyMeta = {
  bn: number;
  txi: number;
  li: number;
  ts: number;
  transactionHash: string;
};
export type SurveyCacheItem = UnknownRecord & {
  id?: unknown;
  surveyID?: unknown;
  title?: unknown;
  questionIDs?: unknown[];
};
export type SurveyResponseCacheItem = UnknownRecord & {
  responses?: unknown[];
};
export type QuestionNetworkCache = UnknownRecord & {
  questionsLatestBlock?: unknown;
  questions: Record<string, UnknownRecord>;
  questionResponses: Record<string, Record<string, unknown>>;
  questionResponsesMeta: Record<string, Record<string, ResponseMetaSource>>;
  questionResponsesLatestBlock?: unknown;
};
export type SurveyNetworkCache = UnknownRecord & {
  surveysLatestBlock?: unknown;
  surveys: Record<string, SurveyCacheItem>;
  surveyResponses: Record<string, Record<string, SurveyResponseCacheItem>>;
  surveyResponsesLatestBlock?: UnknownRecord;
};
export type QuestionsCacheByNetwork = Record<string, QuestionNetworkCache>;
export type SurveysCacheByNetwork = Record<string, SurveyNetworkCache>;

const RECENT_QUESTION_PAYLOADS_KEY = 'dg:recentQuestionPayloads';
const RECENT_QUESTION_PAYLOADS_TTL_MS = 12 * 60 * 60 * 1000;
export function readQuestionsCache(slug: string): QuestionsCacheByNetwork {
  return peekCacheSync<QuestionsCacheByNetwork>('questionsCache', slug) || {};
}

export function readQuestionsCacheRef(slug: string): QuestionsCacheByNetwork {
  return peekCacheSync<QuestionsCacheByNetwork>('questionsCache', slug, { clone: false }) || {};
}

export async function readQuestionsCacheAsync(slug: string): Promise<QuestionsCacheByNetwork> {
  const value = await readCache<QuestionsCacheByNetwork>('questionsCache', slug);
  return value && typeof value === 'object' ? value : readQuestionsCache(slug) || {};
}

export function mergeQuestionResponses(target: UnknownRecord = {}, source: UnknownRecord = {}) {
  const nextTarget = target && typeof target === 'object' ? target : {};
  if (!source || typeof source !== 'object') return nextTarget;
  Object.keys(source).forEach((rawQuestionId) => {
    const normalizedQuestionId = normalizeQuestionIdKey(rawQuestionId);
    const responderMap = source[rawQuestionId];
    if (!normalizedQuestionId || !responderMap || typeof responderMap !== 'object') return;
    nextTarget[normalizedQuestionId] = nextTarget[normalizedQuestionId] || {};
    Object.keys(responderMap as UnknownRecord).forEach((rawResponderAddress) => {
      const responderAddress = String(rawResponderAddress || '')
        .trim()
        .toLowerCase();
      if (!responderAddress) return;
      (nextTarget[normalizedQuestionId] as UnknownRecord)[responderAddress] = (responderMap as UnknownRecord)[
        rawResponderAddress
      ];
    });
  });
  return nextTarget;
}

export function writeQuestionsCache(slug: string, obj: unknown) {
  return (writeCacheOptimistic as unknown as (namespace: string, slug: string, value: unknown) => unknown)(
    'questionsCache',
    slug,
    obj || {},
  );
}

export function readSurveysCache(slug: string): SurveysCacheByNetwork {
  return peekCacheSync<SurveysCacheByNetwork>('surveysCache', slug) || {};
}

export function readSurveysCacheRef(slug: string): SurveysCacheByNetwork {
  return peekCacheSync<SurveysCacheByNetwork>('surveysCache', slug, { clone: false }) || {};
}

export async function readSurveysCacheAsync(slug: string): Promise<SurveysCacheByNetwork> {
  const value = await readCache<SurveysCacheByNetwork>('surveysCache', slug);
  return value && typeof value === 'object' ? value : readSurveysCache(slug) || {};
}

export function writeSurveysCache(slug: string, obj: unknown) {
  return (writeCacheOptimistic as unknown as (namespace: string, slug: string, value: unknown) => unknown)(
    'surveysCache',
    slug,
    obj || {},
  );
}

export function readRecentQuestionPayload(questionId: unknown) {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid) return null;
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(RECENT_QUESTION_PAYLOADS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entry = (parsed as UnknownRecord)[qid];
    if (!entry || typeof entry !== 'object') return null;
    const ts = Number((entry as UnknownRecord).savedAtMs || 0);
    if (!ts || Date.now() - ts > RECENT_QUESTION_PAYLOADS_TTL_MS) return null;
    const payload = { ...(entry as UnknownRecord) };
    delete payload.savedAtMs;
    payload.id = qid;
    return payload;
  } catch (_) {
    return null;
  }
}

export function canUseRecentQuestionPayloadForAccount(payload: unknown, account: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const accountLower = String(account || '')
    .trim()
    .toLowerCase();
  const creatorLower = String((payload as UnknownRecord).creator || '')
    .trim()
    .toLowerCase();
  if (!accountLower || !creatorLower) return false;
  return creatorLower === accountLower;
}

export function hasCacheHydratedFlag(props: UnknownRecord = {}): boolean {
  return !!props?.cacheHasLoaded;
}

export function areQuestionPayloadsEquivalent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a || null) === JSON.stringify(b || null);
  } catch (_) {
    return false;
  }
}

export function ensureQuestionsNet(cache: UnknownRecord = {}, netIdStr: string): Record<string, QuestionNetworkCache> {
  const nextCache = cache && typeof cache === 'object' ? cache : {};
  if (!nextCache[netIdStr]) {
    nextCache[netIdStr] = {
      questionsLatestBlock: 0,
      questions: {},
      questionResponses: {},
      questionResponsesLatestBlock: 0,
    };
  }
  return nextCache as Record<string, QuestionNetworkCache>;
}

export function ensureSurveysNet(cache: UnknownRecord = {}, netIdStr: string): Record<string, SurveyNetworkCache> {
  const nextCache = cache && typeof cache === 'object' ? cache : {};
  if (!nextCache[netIdStr]) {
    nextCache[netIdStr] = {
      surveysLatestBlock: 0,
      surveys: {},
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };
  }
  return nextCache as Record<string, SurveyNetworkCache>;
}

export function mergeSurveyToolCachePatchIntoSurveysCache(
  cache: UnknownRecord = {},
  netIdStr: string,
  patch: UnknownRecord = {},
): Record<string, SurveyNetworkCache> {
  if (!netIdStr) return cache && typeof cache === 'object' ? (cache as Record<string, SurveyNetworkCache>) : {};
  const global = ensureSurveysNet(cache, netIdStr);
  const net = global[netIdStr];
  if (!net) return global;

  if (patch.surveys && typeof patch.surveys === 'object') {
    net.surveys = { ...net.surveys, ...(patch.surveys as SurveyNetworkCache['surveys']) };
  }
  if (patch.surveyResponses && typeof patch.surveyResponses === 'object') {
    net.surveyResponses = {
      ...net.surveyResponses,
      ...(patch.surveyResponses as SurveyNetworkCache['surveyResponses']),
    };
  }
  if (patch.surveyResponsesLatestBlock && typeof patch.surveyResponsesLatestBlock === 'object') {
    net.surveyResponsesLatestBlock = {
      ...net.surveyResponsesLatestBlock,
      ...(patch.surveyResponsesLatestBlock as UnknownRecord),
    };
  }
  return global;
}

export const toResponseRecencyMeta = (source: ResponseMetaSource | null = null): ResponseRecencyMeta => {
  const row = source && typeof source === 'object' ? source : {};
  const nowTs = Math.floor(Date.now() / 1000);
  return {
    bn: Math.max(0, Number(row.blockNumber ?? row.bn ?? 0) || 0),
    txi: Math.max(0, Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0) || 0),
    li: Math.max(0, Number(row.logIndex ?? row.li ?? 0) || 0),
    ts: Math.max(0, Number(row.timestamp ?? row.ts ?? 0) || nowTs),
    transactionHash: String(row.transactionHash || row.txHash || row.hash || '').trim(),
  };
};

export const isIncomingResponseMetaNewer = (
  incoming: ResponseMetaSource | null = null,
  existing: ResponseMetaSource | null = null,
): boolean => {
  const next = toResponseRecencyMeta(incoming);
  const prev = toResponseRecencyMeta(existing);
  return (
    next.bn > prev.bn ||
    (next.bn === prev.bn &&
      (next.txi > prev.txi ||
        (next.txi === prev.txi && (next.li > prev.li || (next.li === prev.li && next.ts >= prev.ts)))))
  );
};

export const stampResponsePayloadWithMeta = (
  payload: unknown,
  meta: ResponseMetaSource | null = null,
): UnknownRecord => {
  if (!payload || typeof payload !== 'object') return payload as UnknownRecord;
  const recency = toResponseRecencyMeta(meta);
  return {
    ...(payload as UnknownRecord),
    ...(recency.bn > 0 ? { blockNumber: recency.bn } : {}),
    transactionIndex: recency.txi,
    logIndex: recency.li,
    ...(recency.ts > 0 ? { timestamp: recency.ts } : {}),
    ...(recency.transactionHash ? { transactionHash: recency.transactionHash } : {}),
  };
};

export const mergeSurveyResponsePayloads = (existingPayload: unknown, incomingPayload: unknown): UnknownRecord => {
  const existing = existingPayload && typeof existingPayload === 'object' ? (existingPayload as UnknownRecord) : null;
  const incoming = incomingPayload && typeof incomingPayload === 'object' ? (incomingPayload as UnknownRecord) : null;
  if (!existing) return incoming as UnknownRecord;
  if (!incoming) return existing;

  const merged: UnknownRecord = { ...existing, ...incoming };
  const existingResponses = Array.isArray(existing.responses) ? existing.responses : [];
  const incomingResponses = Array.isArray(incoming.responses) ? incoming.responses : [];

  if (existingResponses.length > 0 || incomingResponses.length > 0) {
    const responsesByQuestionId = new Map<string, unknown>();
    existingResponses.forEach((row) => {
      const qid = normalizeQuestionIdKey((row as UnknownRecord)?.questionID || (row as UnknownRecord)?.questionId);
      if (!qid) return;
      responsesByQuestionId.set(qid, row);
    });
    incomingResponses.forEach((row) => {
      const qid = normalizeQuestionIdKey((row as UnknownRecord)?.questionID || (row as UnknownRecord)?.questionId);
      if (!qid) return;
      responsesByQuestionId.set(qid, row);
    });
    merged.responses = Array.from(responsesByQuestionId.values());
  }

  return merged;
};
