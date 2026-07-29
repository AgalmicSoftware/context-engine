import { ethers } from 'ethers';
import { updateCacheAtomic } from '../../utilities/cache/cacheScripts.js';
import {
  workerCanonicalCacheIdentityMatches,
  withWorkerCanonicalCacheIdentity,
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
} from '../../utilities/survey/workerCanonicalCacheIdentity.js';
import {
  ensureQuestionsNet,
  ensureSurveysNet,
  isIncomingResponseMetaNewer,
  mergeSurveyResponsePayloads,
  stampResponsePayloadWithMeta,
  toResponseRecencyMeta,
  type QuestionsCacheByNetwork,
  type SurveysCacheByNetwork,
} from './surveyToolCacheState.js';
import { normalizeQuestionIdKey } from './surveyToolSignatures.js';
import { normalizeSessionSlugValue } from './surveyToolScope.js';
import type { UnknownRecord } from './surveyToolTypes.js';
import { resolveSurveyToolWorkerTargetSignature } from './surveyToolWorkerCacheIsolation.js';

type ResponseMetaBoundary = UnknownRecord & {
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
};

type SubmittedQuestionResponse = UnknownRecord & {
  questionID?: unknown;
  questionId?: unknown;
  type?: unknown;
  prompt?: unknown;
  sessionName?: unknown;
};

type SubmittedSurveyResponse = UnknownRecord & {
  surveyID?: unknown;
  surveyId?: unknown;
  surveyTitle?: unknown;
  sessionName?: unknown;
  responses?: unknown[];
};

type SubmittedCacheWriteContext = {
  networkIdStr: string;
  sessionConfig?: unknown;
  sessionSlug?: string | null;
};

export interface PostSubmitCacheDeps {
  account: string;
  effectiveDraftSlug: string;
  singleQuestionMode: boolean;
  isStandalone: boolean;
  deepClone: <T>(obj: T) => T;
  resolveSubmittedCacheWriteContext: (slug: string, current?: boolean) => SubmittedCacheWriteContext;
}

export interface PostSubmitCacheParams {
  receipt?: ResponseMetaBoundary | null;
  questionResponses?: SubmittedQuestionResponse[] | null;
  surveyResponse?: SubmittedSurveyResponse | null;
  surveyId?: string | null;
  submissionSlug?: string | null;
}

export interface PostSubmitCacheResult {
  questionCacheWritten: boolean;
  surveyCacheWritten: boolean;
}

export async function writeSubmittedResponsesToLocalCaches(
  {
    receipt = null,
    questionResponses = [],
    surveyResponse = null,
    surveyId = null,
    submissionSlug = null,
  }: PostSubmitCacheParams = {},
  {
    account,
    effectiveDraftSlug,
    singleQuestionMode,
    isStandalone,
    deepClone,
    resolveSubmittedCacheWriteContext,
  }: PostSubmitCacheDeps,
): Promise<PostSubmitCacheResult> {
  const responderLower = String(account || '')
    .trim()
    .toLowerCase();
  if (!responderLower) {
    return { questionCacheWritten: false, surveyCacheWritten: false };
  }

  const slug = normalizeSessionSlugValue(submissionSlug != null ? submissionSlug : effectiveDraftSlug);
  const cacheWriteContext = resolveSubmittedCacheWriteContext(slug);
  const netIdStr = cacheWriteContext.networkIdStr || '';
  if (!netIdStr) {
    return { questionCacheWritten: false, surveyCacheWritten: false };
  }
  const expectedWorkerTarget = resolveSurveyToolWorkerTargetSignature({
    sessionConfig: cacheWriteContext.sessionConfig,
    sessionSlug: cacheWriteContext.sessionSlug || slug,
  });
  if (
    netIdStr === WORKER_CANONICAL_CACHE_SCOPE_KEY &&
    (!expectedWorkerTarget.valid || !expectedWorkerTarget.identity)
  ) {
    return { questionCacheWritten: false, surveyCacheWritten: false };
  }
  const isWorkerTargetCurrent = (): boolean => {
    if (netIdStr !== WORKER_CANONICAL_CACHE_SCOPE_KEY) return true;
    try {
      const currentContext = resolveSubmittedCacheWriteContext(slug, true);
      if (currentContext.networkIdStr !== WORKER_CANONICAL_CACHE_SCOPE_KEY) return false;
      const currentWorkerTarget = resolveSurveyToolWorkerTargetSignature({
        sessionConfig: currentContext.sessionConfig,
        sessionSlug: currentContext.sessionSlug || slug,
      });
      return (
        currentWorkerTarget.valid &&
        !!currentWorkerTarget.identity &&
        currentWorkerTarget.key === expectedWorkerTarget.key
      );
    } catch {
      return false;
    }
  };

  const recencyMeta = toResponseRecencyMeta(receipt);
  let questionCacheWritten = false;
  let surveyCacheWritten = false;

  const submittedQuestionResponses = Array.isArray(questionResponses) ? questionResponses : [];
  if (submittedQuestionResponses.length > 0) {
    await updateCacheAtomic<QuestionsCacheByNetwork>('questionsCache', slug, (current) => {
      if (!isWorkerTargetCurrent()) return current || {};
      let cacheSeed = current || {};
      if (
        expectedWorkerTarget.identity &&
        !workerCanonicalCacheIdentityMatches(cacheSeed[netIdStr], expectedWorkerTarget.identity)
      ) {
        cacheSeed = { ...cacheSeed };
        delete cacheSeed[netIdStr];
      }
      const nextCache = ensureQuestionsNet(cacheSeed, netIdStr);
      const net = nextCache[netIdStr];
      if (!net.questions || typeof net.questions !== 'object') net.questions = {};
      if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
      if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
      let didWrite = false;

      submittedQuestionResponses.forEach((rawResponse) => {
        const questionId = normalizeQuestionIdKey(rawResponse?.questionID || rawResponse?.questionId);
        if (!questionId) return;
        if (!net.questionResponses[questionId] || typeof net.questionResponses[questionId] !== 'object') {
          net.questionResponses[questionId] = {};
        }
        if (!net.questionResponsesMeta[questionId] || typeof net.questionResponsesMeta[questionId] !== 'object') {
          net.questionResponsesMeta[questionId] = {};
        }
        if (!isIncomingResponseMetaNewer(recencyMeta, net.questionResponsesMeta[questionId][responderLower])) {
          return;
        }

        const nextResponse = stampResponsePayloadWithMeta(deepClone(rawResponse || {}), recencyMeta);
        net.questionResponses[questionId][responderLower] = nextResponse;
        net.questionResponsesMeta[questionId][responderLower] = {
          bn: recencyMeta.bn,
          txi: recencyMeta.txi,
          li: recencyMeta.li,
          ts: recencyMeta.ts,
        };

        const prevQuestion =
          net.questions[questionId] && typeof net.questions[questionId] === 'object' ? net.questions[questionId] : {};
        net.questions[questionId] = {
          ...prevQuestion,
          id: questionId,
          ...(rawResponse?.type ? { type: rawResponse.type } : {}),
          ...(typeof rawResponse?.prompt === 'string' ? { prompt: rawResponse.prompt } : {}),
          ...(typeof rawResponse?.sessionName === 'string' && rawResponse.sessionName.trim()
            ? { sessionName: rawResponse.sessionName }
            : {}),
        };
        didWrite = true;
      });

      if (didWrite) questionCacheWritten = true;
      if (expectedWorkerTarget.identity) {
        nextCache[netIdStr] = withWorkerCanonicalCacheIdentity(
          nextCache[netIdStr],
          expectedWorkerTarget.identity,
        ) as QuestionsCacheByNetwork[string];
      }
      return nextCache;
    });
  }

  const surveyIdLower = normalizeQuestionIdKey(surveyId || surveyResponse?.surveyID || surveyResponse?.surveyId);
  const shouldWriteSurveyCache =
    !singleQuestionMode &&
    !isStandalone &&
    surveyResponse &&
    surveyIdLower &&
    surveyIdLower !== normalizeQuestionIdKey(ethers.constants.HashZero);

  if (shouldWriteSurveyCache) {
    await updateCacheAtomic<SurveysCacheByNetwork>('surveysCache', slug, (current) => {
      if (!isWorkerTargetCurrent()) return current || {};
      let cacheSeed = current || {};
      if (
        expectedWorkerTarget.identity &&
        !workerCanonicalCacheIdentityMatches(cacheSeed[netIdStr], expectedWorkerTarget.identity)
      ) {
        cacheSeed = { ...cacheSeed };
        delete cacheSeed[netIdStr];
      }
      const nextCache = ensureSurveysNet(cacheSeed, netIdStr);
      const net = nextCache[netIdStr];
      if (!net.surveys || typeof net.surveys !== 'object') net.surveys = {};
      if (!net.surveyResponses || typeof net.surveyResponses !== 'object') net.surveyResponses = {};
      if (!net.surveyResponses[surveyIdLower] || typeof net.surveyResponses[surveyIdLower] !== 'object') {
        net.surveyResponses[surveyIdLower] = {};
      }
      const existingResponse = net.surveyResponses[surveyIdLower][responderLower] || null;
      if (!isIncomingResponseMetaNewer(recencyMeta, existingResponse)) {
        return nextCache;
      }

      const mergedResponse = mergeSurveyResponsePayloads(existingResponse, deepClone(surveyResponse));
      net.surveyResponses[surveyIdLower][responderLower] = stampResponsePayloadWithMeta(mergedResponse, recencyMeta);

      const prevSurvey =
        net.surveys[surveyIdLower] && typeof net.surveys[surveyIdLower] === 'object' ? net.surveys[surveyIdLower] : {};
      const mergedResponses = Array.isArray(net.surveyResponses[surveyIdLower][responderLower]?.responses)
        ? net.surveyResponses[surveyIdLower][responderLower].responses
        : [];
      const mergedQuestionIds = mergedResponses
        .map((row: unknown) => {
          const rowRecord = row && typeof row === 'object' ? (row as UnknownRecord) : {};
          return normalizeQuestionIdKey(rowRecord.questionID || rowRecord.questionId);
        })
        .filter(Boolean);
      net.surveys[surveyIdLower] = {
        ...prevSurvey,
        id: surveyIdLower,
        surveyID: surveyIdLower,
        ...(typeof surveyResponse?.surveyTitle === 'string' && surveyResponse.surveyTitle.trim()
          ? { title: surveyResponse.surveyTitle }
          : {}),
        ...(typeof surveyResponse?.sessionName === 'string' && surveyResponse.sessionName.trim()
          ? { sessionName: surveyResponse.sessionName }
          : {}),
        ...(mergedQuestionIds.length > 0 ? { questionIDs: mergedQuestionIds } : {}),
      };
      surveyCacheWritten = true;
      if (expectedWorkerTarget.identity) {
        nextCache[netIdStr] = withWorkerCanonicalCacheIdentity(
          nextCache[netIdStr],
          expectedWorkerTarget.identity,
        ) as SurveysCacheByNetwork[string];
      }
      return nextCache;
    });
  }

  return { questionCacheWritten, surveyCacheWritten };
}
