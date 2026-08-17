import { isResponseRecencyNewer, toResponseRecencyPair, type ResponseRecencyPair } from './responseRecency.js';

type CacheRecord = Record<string, unknown>;
type SurveyResponsesByResponder = Record<string, unknown>;

export interface SurveyResponseItem {
  responder: string;
  response: unknown;
  blockNumber?: number | string | null;
  transactionIndex?: number | string | null;
  txIndex?: number | string | null;
  txi?: number | string | null;
  logIndex?: number | string | null;
  timestamp?: number | string | null;
}

export interface NormalizedSurveyResponseBatchResult {
  responses: SurveyResponseItem[];
  hadPartialFailure: boolean;
  lowestFailedBlock: number | null;
}

interface ResolveSurveyResponseWatermarkArgs {
  startBlock: number;
  latestBlock: number;
  hadPartialFailure: boolean;
  lowestFailedBlock: number | null;
}

interface MergeSurveyResponseDeltaArgs {
  preFetchResponses: SurveyResponsesByResponder;
  freshResponses: SurveyResponsesByResponder;
  fetchedResponses: SurveyResponseItem[];
  freshWatermark: number;
  safeResponseWatermark: number;
}

interface MergeSurveyResponseCacheSnapshotArgs<TCache> {
  currentCache: TCache;
  networkId: string;
  surveyId: string;
  initialWatermark: number;
  preFetchResponses: SurveyResponsesByResponder;
  fetchedResponses: SurveyResponseItem[];
  safeResponseWatermark: number;
}

interface SurveyResponsePreFetchState {
  present: boolean;
  fingerprint: string | null;
}

interface SurveyResponseDeltaEntry {
  response: unknown;
  recency: ResponseRecencyPair;
}

const fingerprintSurveyResponseValue = (value: unknown): string | null => {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'undefined' : `json:${serialized}`;
  } catch (_) {
    return null;
  }
};

const isRecord = (value: unknown): value is CacheRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const RESPONSE_RECENCY_KEYS = new Set(['blockNumber', 'transactionIndex', 'logIndex', 'timestamp', 'transactionHash']);

const toSurveyResponseDomainValue = (value: unknown): unknown =>
  isRecord(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !RESPONSE_RECENCY_KEYS.has(key)))
    : value;

const stampSurveyResponseWithRecency = (response: unknown, recency: ResponseRecencyPair): unknown => {
  if (!isRecord(response) || recency.bn <= 0) return response;
  return {
    ...response,
    blockNumber: recency.bn,
    transactionIndex: recency.txi,
    logIndex: recency.li,
    ...(recency.ts > 0 ? { timestamp: recency.ts } : {}),
  };
};

export const normalizeSurveyResponseBatchResult = (batchResult: unknown): NormalizedSurveyResponseBatchResult => {
  if (Array.isArray(batchResult)) {
    return {
      responses: batchResult as SurveyResponseItem[],
      hadPartialFailure: false,
      lowestFailedBlock: null,
    };
  }
  const batchRecord = (batchResult && typeof batchResult === 'object' ? batchResult : {}) as CacheRecord;
  const responses = Array.isArray(batchRecord.responses) ? (batchRecord.responses as SurveyResponseItem[]) : [];
  const lowestFailedBlock = Number(batchRecord.lowestFailedBlock);
  return {
    responses,
    hadPartialFailure: !!batchRecord.hadPartialFailure,
    lowestFailedBlock: Number.isFinite(lowestFailedBlock) ? lowestFailedBlock : null,
  };
};

export const resolveSurveyResponseWatermark = ({
  startBlock,
  latestBlock,
  hadPartialFailure,
  lowestFailedBlock,
}: ResolveSurveyResponseWatermarkArgs): number => {
  if (!hadPartialFailure) return latestBlock;
  const failedBlock = Number(lowestFailedBlock);
  if (!Number.isFinite(failedBlock)) return latestBlock;
  return Math.max(Math.max(0, Number(startBlock) - 1), Math.min(Number(latestBlock) || 0, failedBlock - 1));
};

const mergeSurveyResponseDeltaWithRecency = ({
  preFetchResponses,
  freshResponses,
  fetchedResponses,
  freshWatermark,
  safeResponseWatermark,
}: MergeSurveyResponseDeltaArgs): { responses: SurveyResponsesByResponder; watermark: number } => {
  const currentWatermark = Number.isFinite(Number(freshWatermark)) ? Math.max(0, Number(freshWatermark)) : 0;
  const safeWatermark = Number.isFinite(Number(safeResponseWatermark))
    ? Math.max(0, Number(safeResponseWatermark))
    : currentWatermark;
  const mergedResponses = { ...freshResponses };

  // A newer committed frontier already includes this scan range, so its payloads win wholesale.
  if (currentWatermark > safeWatermark) {
    return { responses: mergedResponses, watermark: currentWatermark };
  }

  const responseDelta: Record<string, SurveyResponseDeltaEntry> = {};
  const preFetchState: Record<string, SurveyResponsePreFetchState> = {};
  fetchedResponses.forEach((item) => {
    const responder = String(item.responder || '').toLowerCase();
    if (!responder) return;
    responseDelta[responder] = {
      response: item.response,
      recency: toResponseRecencyPair(item, item.response),
    };
    const wasPresent = Object.prototype.hasOwnProperty.call(preFetchResponses, responder);
    preFetchState[responder] = {
      present: wasPresent,
      fingerprint: wasPresent ? fingerprintSurveyResponseValue(preFetchResponses[responder]) : null,
    };
  });

  let hasUnorderableConflict = false;
  Object.entries(responseDelta).forEach(([responder, incoming]) => {
    const before = preFetchState[responder];
    const isPresent = Object.prototype.hasOwnProperty.call(freshResponses, responder);
    const isUnchanged =
      before.present === isPresent &&
      (!isPresent ||
        (before.fingerprint !== null &&
          before.fingerprint === fingerprintSurveyResponseValue(freshResponses[responder])));
    const existingResponse = freshResponses[responder];
    const existingRecency = toResponseRecencyPair(existingResponse);
    const incomingIsTrusted = incoming.recency.bn > 0;
    const existingIsTrusted = existingRecency.bn > 0;

    if (incomingIsTrusted && existingIsTrusted) {
      if (isResponseRecencyNewer(incoming.recency, existingRecency)) {
        mergedResponses[responder] = stampSurveyResponseWithRecency(incoming.response, incoming.recency);
      }
      return;
    }

    if (existingIsTrusted && !incomingIsTrusted) {
      const incomingFingerprint = fingerprintSurveyResponseValue(toSurveyResponseDomainValue(incoming.response));
      const existingFingerprint = fingerprintSurveyResponseValue(toSurveyResponseDomainValue(existingResponse));
      const valuesMatch =
        incomingFingerprint !== null && existingFingerprint !== null && incomingFingerprint === existingFingerprint;
      if (!valuesMatch) hasUnorderableConflict = true;
      return;
    }

    if (isUnchanged) {
      mergedResponses[responder] = stampSurveyResponseWithRecency(incoming.response, incoming.recency);
      return;
    }
    hasUnorderableConflict = true;
  });

  return {
    responses: mergedResponses,
    watermark: hasUnorderableConflict ? currentWatermark : Math.max(currentWatermark, safeWatermark),
  };
};

export const mergeSurveyResponseCacheSnapshot = <TCache extends Record<string, CacheRecord>>({
  currentCache,
  networkId,
  surveyId,
  initialWatermark,
  preFetchResponses,
  fetchedResponses,
  safeResponseWatermark,
}: MergeSurveyResponseCacheSnapshotArgs<TCache>): TCache => {
  const freshNetwork = currentCache[networkId] || {};
  const freshResponses = isRecord(freshNetwork.surveyResponses)
    ? (freshNetwork.surveyResponses as Record<string, SurveyResponsesByResponder>)
    : {};
  const freshSurveyResponses = isRecord(freshResponses[surveyId]) ? freshResponses[surveyId] : {};
  const freshWatermarks = isRecord(freshNetwork.surveyResponsesLatestBlock)
    ? freshNetwork.surveyResponsesLatestBlock
    : {};
  const freshWatermark = Number(freshWatermarks[surveyId]);
  const merged = mergeSurveyResponseDeltaWithRecency({
    preFetchResponses,
    freshResponses: freshSurveyResponses,
    fetchedResponses,
    freshWatermark: Number.isFinite(freshWatermark) ? freshWatermark : initialWatermark,
    safeResponseWatermark,
  });

  return {
    ...currentCache,
    [networkId]: {
      surveysLatestBlock: initialWatermark,
      surveys: {},
      pendingSurveyMetadata: {},
      ...freshNetwork,
      surveyResponses: {
        ...freshResponses,
        [surveyId]: merged.responses,
      },
      surveyResponsesLatestBlock: {
        ...freshWatermarks,
        [surveyId]: merged.watermark,
      },
    },
  } as TCache;
};
