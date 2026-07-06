import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { isResponseAllowedForSessionSlug } from '../../utilities/session/responseSessionScope.js';
import { readSurveyResultsLatestBlock, normalizeSurveyResultsBlockNumber } from './surveyResultsBlockNumbers.js';
import {
  buildSurveyResultsEmptySurveyModePatch,
  buildSurveyResultsFilteredQuestionModeHydratedPatch,
  buildSurveyResultsSurveyModeHydratedPatch,
  buildSurveyResultsUnfilteredQuestionModeHydratedPatch,
  buildSurveyRespondersPayloadRefSignature,
  buildSurveyRespondersSignature,
  countQuestionModeResponses,
  getSurveyResponseAggregateTimestampMs,
  getSurveyResponseQuestionId,
  hasAnyCountableSurveyAnswer,
  normalizeSurveyResponsePayloadByQuestionId,
  type SurveyResultsAggregateRow,
  type SurveyResultsSurveyResponsePayload,
} from './surveyResultsHelpers.js';
import {
  normalizeSurveyResultsQuestionModeCache,
} from './surveyResultsQuestionModeCacheNormalizationController';
import {
  resolveNetBucketReadOnly,
  unifyAggregatorWithAllQuestionIDs,
} from './surveyResultsRuntimeHelpers';
import type {
  SurveyResultsProps,
  SurveyResultsState,
} from './SurveyResults';
import type {
  SurveyResultsQuestionResponsesByQuestion,
  SurveyResultsQuestionResponsesByResponder,
  SurveyResultsScopedQuestionNetworkData,
} from './surveyResultsQuestionNetworkReadController';

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsSurveyBucketRecord = SurveyResultsRecord & {
  surveyResponses?: Record<string, SurveyResultsRecord>;
  surveyResponsesLatestBlock?: unknown;
  surveys?: Record<string, SurveyResultsRecord & {
    documentURLs?: unknown;
    questionIDs?: unknown;
    title?: string;
  }>;
  surveysLatestBlock?: unknown;
};

type SurveyResultsResponseListEntry = SurveyResultsRecord & {
  response?: (SurveyResultsRecord & { responses?: SurveyResultsRecord[] }) | null;
  responder: string;
  surveyId?: unknown;
};

export type SurveyResultsHydrationInstance = {
  _surveyModeSourceCacheNonce: number;
  _surveyModeSourceCoarseSignature: string;
  _surveyModeSourcePayloadRefSignature: string;
  _surveyModeSourceSignature: string;
  _surveysCacheChangeNonce: number;
};

export type SurveyResultsHydrationPorts = {
  applyStatePatch: (patch: unknown, afterApply?: () => void) => void;
  getEffectiveSlug: () => string;
  getNetworkQuestionsForCurrentContext: () => Record<string, SurveyResultsRecord>;
  getProps: () => SurveyResultsProps;
  getScopedQuestionNetworkData: (viewMode?: unknown) => Promise<SurveyResultsScopedQuestionNetworkData>;
  getState: () => SurveyResultsState;
  logWarn: (...args: unknown[]) => void;
  parseResponse: <T>(responseData: T) => T | SurveyResultsRecord | null;
  readSurveyCache: (slug: string) => Promise<unknown>;
  readSurveyCacheSync: (slug: string) => unknown;
  reapplyQuestionFilters: () => void;
};

export type SurveyResultsHydrationRuntimeArgs = {
  instance: SurveyResultsHydrationInstance;
  ports: SurveyResultsHydrationPorts;
};

export const fetchSurveyResultsSurveyModeResponses = async ({
  instance,
  ports,
}: SurveyResultsHydrationRuntimeArgs): Promise<void> => {
  const state = ports.getState();
  const props = ports.getProps();
  const currentSurveyID = state.surveyId ? state.surveyId.toLowerCase() : null;
  const slug = ports.getEffectiveSlug();
  const netIdStr = String(props.network?.id ?? props.networkChainId ?? '');

  let surveysCache = (ports.readSurveyCacheSync(slug) || {}) as SurveyResultsRecord;
  if (!surveysCache || Object.keys(surveysCache).length === 0) {
    surveysCache = ((await ports.readSurveyCache(slug)) || {}) as SurveyResultsRecord;
  }
  const hasSurveyNetCache = !!(
    surveysCache &&
    typeof surveysCache === 'object' &&
    surveysCache[netIdStr] != null
  );
  const surveyNetCache = resolveNetBucketReadOnly(
    surveysCache,
    netIdStr,
    null
  ) as SurveyResultsSurveyBucketRecord | null;

  if (!hasSurveyNetCache || !surveyNetCache) {
    return;
  }

  if (!currentSurveyID) {
    const emptySignature = `${slug}|${netIdStr}|__none__`;
    if (instance._surveyModeSourceSignature === emptySignature) {
      return;
    }
    instance._surveyModeSourceSignature = emptySignature;
    instance._surveyModeSourceCoarseSignature = emptySignature;
    instance._surveyModeSourcePayloadRefSignature = '';
    instance._surveyModeSourceCacheNonce = Number(instance._surveysCacheChangeNonce || 0);
    ports.applyStatePatch(buildSurveyResultsEmptySurveyModePatch());
    return;
  }

  const srMap = surveyNetCache.surveyResponses?.[currentSurveyID] || {};
  const allResponders = Object.keys(srMap);
  const networkQuestions = ports.getNetworkQuestionsForCurrentContext();
  const questionIDsInSurvey: string[] = Array.isArray(surveyNetCache?.surveys?.[currentSurveyID]?.questionIDs)
    ? surveyNetCache.surveys[currentSurveyID].questionIDs as string[]
    : [];
  const questionIdsSignature = questionIDsInSurvey
    .map((qid) => String(qid || '').toLowerCase())
    .join('|');
  const surveyResponsesLatestBlock = readSurveyResultsLatestBlock(
    surveyNetCache?.surveyResponsesLatestBlock,
    currentSurveyID
  );
  const surveyDefinitionLatestBlock = normalizeSurveyResultsBlockNumber(surveyNetCache?.surveysLatestBlock);
  const surveyCacheChangeNonce = Number(instance._surveysCacheChangeNonce || 0);
  const latestProps = ports.getProps();
  const questionCacheReadySignal = latestProps.isQuestionCacheReady ? 1 : 0;
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
  if (instance._surveyModeSourceSignature === sourceSignature) {
    instance._surveyModeSourceCoarseSignature = coarseSourceSignature;
    instance._surveyModeSourcePayloadRefSignature = payloadRefSignature;
    instance._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
    return;
  }
  instance._surveyModeSourceCoarseSignature = coarseSourceSignature;
  instance._surveyModeSourcePayloadRefSignature = payloadRefSignature;
  instance._surveyModeSourceCacheNonce = surveyCacheChangeNonce;
  instance._surveyModeSourceSignature = sourceSignature;

  const aggregatorMap: Record<string, SurveyResultsAggregateRow[]> = {};
  const rawResponses: SurveyResultsResponseListEntry[] = [];
  allResponders.forEach((responder) => {
    const responderLower = String(responder || '').toLowerCase();
    const rawResp = normalizeSurveyResponsePayloadByQuestionId(
      ports.parseResponse(srMap[responder])
    ) as SurveyResultsSurveyResponsePayload | null;
    if (!hasAnyCountableSurveyAnswer(rawResp, networkQuestions)) return;
    rawResponses.push({
      responder: responderLower,
      surveyId: currentSurveyID,
      response: rawResp as SurveyResultsResponseListEntry['response'],
    });
    if (!rawResp || !Array.isArray(rawResp.responses)) return;
    rawResp.responses.forEach((ans: SurveyResultsRecord) => {
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

  let foundTitle = '';
  let foundDocURLs: string[] = [];
  if (surveyNetCache?.surveys?.[currentSurveyID]) {
    foundTitle = surveyNetCache.surveys[currentSurveyID].title || '';
    foundDocURLs = Array.isArray(surveyNetCache.surveys[currentSurveyID].documentURLs)
      ? surveyNetCache.surveys[currentSurveyID].documentURLs as string[]
      : [];
  }

  ports.applyStatePatch(buildSurveyResultsSurveyModeHydratedPatch({
    aggregateQuestionResponses: finalAggregator,
    filteredResponsesCount: rawResponses.length,
    responses: rawResponses,
    sbtFilteredAggregatorQuestionResponses: finalAggregator,
    sbtFilteredResponses: rawResponses,
    surveyDocumentURLs: foundDocURLs,
    surveyTitle: foundTitle,
    totalQuestionsCount: totalQCount,
    totalResponsesCount: totalRespondersCount,
  }));
};

export const fetchSurveyResultsQuestionModeResponses = async ({
  ports,
}: SurveyResultsHydrationRuntimeArgs): Promise<void> => {
  const props = ports.getProps();
  const netIdStr = String(props.network?.id ?? props.networkChainId ?? '');
  if (!netIdStr) return;
  const questionNetCache = await ports.getScopedQuestionNetworkData('questions');
  const effectiveSlug = ports.getEffectiveSlug();
  const strictQuestionResponseSlug = isDemoSessionSlug(effectiveSlug) ? effectiveSlug : '';
  const normalizedQuestionModeCache = normalizeSurveyResultsQuestionModeCache({
    ports: {
      isDemoPolisFixtureResponse: (responseData) => (
        !!responseData &&
        typeof responseData === 'object' &&
        (responseData as SurveyResultsRecord).source === 'demo-polis-data'
      ),
      isResponseAllowedForSessionSlug,
      parseResponse: ports.parseResponse,
    },
    questionResponses: questionNetCache?.questionResponses || {},
    questions: questionNetCache?.questions || {},
    requiredSessionSlug: normalizeSessionSlug(strictQuestionResponseSlug),
  });
  const partialQR: SurveyResultsQuestionResponsesByQuestion = normalizedQuestionModeCache.questionResponses;
  const allQuestions = normalizedQuestionModeCache.questions;
  const aggregatorMap: Record<string, unknown> = {};

  Object.keys(partialQR).forEach((qId) => {
    const lowerQ = qId.toLowerCase();
    aggregatorMap[lowerQ] = aggregatorMap[lowerQ] || {};
    const respondersMap: SurveyResultsQuestionResponsesByResponder = partialQR[qId] || {};

    Object.keys(respondersMap).forEach((rAddr) => {
      const rData = respondersMap[rAddr];
      const parsed = ports.parseResponse(rData) as SurveyResultsRecord | null;
      if (parsed && parsed.source === 'demo-polis-data') return;
      if (parsed) {
        if (!Array.isArray(aggregatorMap[lowerQ])) {
          aggregatorMap[lowerQ] = [];
        }
        (aggregatorMap[lowerQ] as SurveyResultsAggregateRow[]).push({
          responder: rAddr.toLowerCase(),
          questionId: lowerQ,
          response: parsed,
          timestamp: parsed.timeStamp || 0,
        });
      }
    });
  });

  const knownQIDs = Object.keys(allQuestions);
  const finalAggregator = unifyAggregatorWithAllQuestionIDs(
    aggregatorMap as Record<string, unknown[]>,
    knownQIDs
  );
  const totalQ = Object.keys(finalAggregator).length;
  const totalResponseCount = countQuestionModeResponses(finalAggregator, allQuestions);
  const initialFilteredCount = totalResponseCount;
  const state = ports.getState();

  if (state.isFilterActive) {
    ports.applyStatePatch(
      buildSurveyResultsFilteredQuestionModeHydratedPatch({
        aggregatorQuestionResponses: finalAggregator,
        currentFilteredQuestionsCount: state.filteredQuestionsCount,
        currentFilteredResponsesCount: state.filteredResponsesCount,
        initialFilteredCount,
        questionResponses: partialQR,
        sbtFilteredAggregatorQuestionResponses: state.sbtFilteredAggregatorQuestionResponses,
        totalQuestionsCount: totalQ,
        totalResponsesCount: totalResponseCount,
      }),
      () => {
        try {
          ports.reapplyQuestionFilters();
        } catch (e) {
          ports.logWarn('SurveyResults: fallback', e);
        }
      }
    );
  } else {
    ports.applyStatePatch(buildSurveyResultsUnfilteredQuestionModeHydratedPatch({
      aggregatorQuestionResponses: finalAggregator,
      filteredResponsesCount: initialFilteredCount,
      questionResponses: partialQR,
      totalQuestionsCount: totalQ,
      totalResponsesCount: totalResponseCount,
    }));
  }
};
