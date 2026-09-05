import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import {
  normalizeSurveyResultsBlockNumber,
  readSurveyResultsLatestBlock,
  type SurveyResultsLatestBlockMap,
} from './surveyResultsBlockNumbers.js';
import {
  buildSurveyResultsLocalStoragePollPatch,
  buildSurveyResultsNetworkLatestBlockPatch,
} from './surveyResultsHelpers.js';
import {
  buildSurveyResultsLocalStoragePollCountPlan,
  buildSurveyResultsLocalStoragePollPatchPlan,
} from './surveyResultsLocalStoragePollDecision';
import { resolveNetBucketReadOnly } from './surveyResultsRuntimeHelpers';
import type { SurveyResultsProps, SurveyResultsState } from './SurveyResults';
import type {
  SurveyResultsQuestionBucketRecord,
  SurveyResultsScopedQuestionNetworkData,
} from './surveyResultsQuestionNetworkReadController';

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsPollQuestionCountMemo = {
  count: number;
  questionsRef: unknown;
};

type SurveyResultsPollSurveyResponsesCountMemo = {
  count: number;
  responsesRef: unknown;
  surveyId: string;
};

type SurveyResultsSurveyBucketRecord = SurveyResultsRecord & {
  surveyResponses?: Record<string, SurveyResultsRecord>;
  surveyResponsesLatestBlock?: SurveyResultsLatestBlockMap;
  surveys?: Record<string, SurveyResultsRecord>;
  surveysLatestBlock?: unknown;
};

export type SurveyResultsLocalStoragePollInstance = {
  _isMounted: boolean;
  _lastLocalStoragePollCoarseSignature: string;
  _lastLocalStoragePollDetailedSignature: string;
  _lastPolledQuestionRefVersion: number;
  _lastPolledQuestionsRef: unknown;
  _lastPolledSurveyResponsesRef: unknown;
  _lastPolledSurveyResponsesRefVersion: number;
  _pollLatestBlockFetchInFlight: boolean;
  _pollLatestBlockLastAttemptAt: number;
  _pollQuestionCountMemo: SurveyResultsPollQuestionCountMemo;
  _pollSurveyResponsesCountMemo: SurveyResultsPollSurveyResponsesCountMemo;
};

export type SurveyResultsLocalStoragePollPorts = {
  applyStatePatch: (patch: unknown, afterApply?: () => void) => void;
  getCacheScope?: () => string;
  getEffectiveSlug: () => string;
  getFetchRuntimeSnapshot: () => { inFlight?: unknown };
  getProps: () => SurveyResultsProps;
  getScopedQuestionNetworkDataSync: (viewMode?: unknown) => SurveyResultsScopedQuestionNetworkData;
  getStableCycles: () => number;
  getState: () => SurveyResultsState;
  logWarn: (...args: unknown[]) => void;
  queueResultsRefresh: (reason: string) => void;
  readLatestBlock: (provider: string | undefined, slug: string) => Promise<unknown>;
  readQuestionCacheSync: (slug: string) => unknown;
  readSurveyCacheSync: (slug: string) => unknown;
  shouldReadLatestBlock?: () => boolean;
};

export type SurveyResultsLocalStoragePollConfig = {
  forceRescanEvery: number;
  latestBlockPollThrottleMs: number;
};

export type SurveyResultsLocalStoragePollRuntimeArgs = {
  config: SurveyResultsLocalStoragePollConfig;
  instance: SurveyResultsLocalStoragePollInstance;
  ports: SurveyResultsLocalStoragePollPorts;
};

export const maybeRefreshSurveyResultsNetworkLatestBlockFromPolling = ({
  config,
  instance,
  ports,
}: SurveyResultsLocalStoragePollRuntimeArgs): void => {
  const state = ports.getState();
  const props = ports.getProps();
  if (normalizeSurveyResultsBlockNumber(state.networkLatestBlock) > 0) return;
  if (ports.shouldReadLatestBlock?.() === false) return;
  if (instance._pollLatestBlockFetchInFlight) return;
  const now = Date.now();
  if (
    instance._pollLatestBlockLastAttemptAt > 0 &&
    now - instance._pollLatestBlockLastAttemptAt < config.latestBlockPollThrottleMs
  ) {
    return;
  }
  instance._pollLatestBlockLastAttemptAt = now;
  instance._pollLatestBlockFetchInFlight = true;
  const slug = ports.getEffectiveSlug();
  ports
    .readLatestBlock(props.provider as string | undefined, slug)
    .then((blk: unknown) => {
      if (!instance._isMounted) return;
      const parsed = normalizeSurveyResultsBlockNumber(blk);
      const currentLatestBlock = normalizeSurveyResultsBlockNumber(ports.getState().networkLatestBlock);
      if (parsed > 0 && parsed !== currentLatestBlock) {
        ports.applyStatePatch(buildSurveyResultsNetworkLatestBlockPatch(parsed));
      }
    })
    .catch((e: unknown) => {
      ports.logWarn('SurveyResults: fallback', e);
    })
    .finally(() => {
      instance._pollLatestBlockFetchInFlight = false;
    });
};

const getMemoizedQuestionsCountForPolling = (
  instance: SurveyResultsLocalStoragePollInstance,
  questionsById: unknown,
  options: { forceScan?: boolean } = {},
): number => {
  const ref: SurveyResultsRecord =
    questionsById && typeof questionsById === 'object' ? (questionsById as SurveyResultsRecord) : {};
  const forceScan = options && options.forceScan === true;
  const memo = instance._pollQuestionCountMemo;
  if (!forceScan && memo.questionsRef === ref) return memo.count;
  const nextCount = measureSync(
    forceScan ? 'ce.surveyResults.poll.questionsCountForcedScan' : 'ce.surveyResults.poll.questionsCountScan',
    () => Object.keys(ref).length,
  ) as number;
  instance._pollQuestionCountMemo = {
    questionsRef: ref,
    count: nextCount,
  };
  return nextCount;
};

const getMemoizedSurveyResponsesCountForPolling = (
  instance: SurveyResultsLocalStoragePollInstance,
  surveyResponsesById: unknown,
  surveyId: unknown,
  options: { forceScan?: boolean } = {},
): number => {
  const sid = String(surveyId || '').toLowerCase();
  if (!sid) {
    instance._pollSurveyResponsesCountMemo = {
      surveyId: '',
      responsesRef: null,
      count: 0,
    };
    return 0;
  }

  const byId: SurveyResultsRecord =
    surveyResponsesById && typeof surveyResponsesById === 'object' ? (surveyResponsesById as SurveyResultsRecord) : {};
  const responsesRef = byId[sid] && typeof byId[sid] === 'object' ? (byId[sid] as SurveyResultsRecord) : null;
  const memo = instance._pollSurveyResponsesCountMemo;
  const forceScan = options && options.forceScan === true;
  if (!forceScan && memo.surveyId === sid && memo.responsesRef === responsesRef) {
    return memo.count;
  }
  const nextCount = measureSync(
    forceScan
      ? 'ce.surveyResults.poll.surveyResponsesCountForcedScan'
      : 'ce.surveyResults.poll.surveyResponsesCountScan',
    () => Object.keys(responsesRef || {}).length,
  ) as number;
  instance._pollSurveyResponsesCountMemo = {
    surveyId: sid,
    responsesRef,
    count: nextCount,
  };
  return nextCount;
};

export const pollSurveyResultsLocalStorageForUpdates = ({
  config,
  instance,
  ports,
}: SurveyResultsLocalStoragePollRuntimeArgs): boolean =>
  measureSync('ce.surveyResults.pollLocalStorageForUpdates', () => {
    const props = ports.getProps();
    const state = ports.getState();
    const netIdStr = ports.getCacheScope?.() || String(props.network?.id ?? props.networkChainId ?? '');
    if (!netIdStr) return false;
    const slug = ports.getEffectiveSlug();
    const currentSurveyId = state.viewMode === 'survey' ? String(state.surveyId || '').toLowerCase() : '';

    const questionNetCache: SurveyResultsQuestionBucketRecord = (
      state.viewMode === 'questions'
        ? ports.getScopedQuestionNetworkDataSync('questions')
        : resolveNetBucketReadOnly(ports.readQuestionCacheSync(slug) || {}, netIdStr, {
            questionsLatestBlock: 0,
            questions: {},
            questionResponses: {},
            questionResponsesLatestBlock: 0,
          })
    ) as SurveyResultsQuestionBucketRecord;

    const questionsById = questionNetCache.questions || {};
    let surveyNetCache: SurveyResultsSurveyBucketRecord | null = null;
    let surveyResponsesById: unknown = {};
    if (currentSurveyId) {
      surveyNetCache = resolveNetBucketReadOnly(ports.readSurveyCacheSync(slug) || {}, netIdStr, {
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
        surveysLatestBlock: 0,
      }) as SurveyResultsSurveyBucketRecord;
      surveyResponsesById = surveyNetCache.surveyResponses || {};
    }
    if (instance._lastPolledQuestionsRef !== questionsById) {
      instance._lastPolledQuestionsRef = questionsById;
      instance._lastPolledQuestionRefVersion += 1;
    }
    if (instance._lastPolledSurveyResponsesRef !== surveyResponsesById) {
      instance._lastPolledSurveyResponsesRef = surveyResponsesById;
      instance._lastPolledSurveyResponsesRefVersion += 1;
    }

    let netLatest = normalizeSurveyResultsBlockNumber(state.networkLatestBlock);
    if (!netLatest) {
      maybeRefreshSurveyResultsNetworkLatestBlockFromPolling({
        config,
        instance,
        ports,
      });
      netLatest = 0;
    }

    const localQBlock = normalizeSurveyResultsBlockNumber(questionNetCache.questionsLatestBlock);
    const localRespBlock = normalizeSurveyResultsBlockNumber(questionNetCache.questionResponsesLatestBlock);
    const localSBlock = currentSurveyId
      ? readSurveyResultsLatestBlock(surveyNetCache?.surveyResponsesLatestBlock, currentSurveyId)
      : 0;

    const fetchRuntimeSnapshot = ports.getFetchRuntimeSnapshot();
    const countPlan = buildSurveyResultsLocalStoragePollCountPlan({
      currentSurveyId,
      fetchInFlight: fetchRuntimeSnapshot.inFlight,
      forceRescanEvery: config.forceRescanEvery,
      localQBlock,
      localRespBlock,
      localSBlock,
      netLatest,
      previousCoarseSignature: instance._lastLocalStoragePollCoarseSignature,
      questionLocalBlock: state.questionLocalBlock,
      questionRefVersion: instance._lastPolledQuestionRefVersion,
      responseLocalBlock: state.responseLocalBlock,
      stableCycles: ports.getStableCycles(),
      surveyLocalBlock: state.surveyLocalBlock,
      surveyResponsesRefVersion: instance._lastPolledSurveyResponsesRefVersion,
      viewMode: state.viewMode,
    });
    if (countPlan.shouldReturnFalseForInFlight) {
      return false;
    }

    const newQuestionsCount = countPlan.useCachedCounts
      ? Number(state.cachedQuestionsCount || 0)
      : getMemoizedQuestionsCountForPolling(instance, questionsById, {
          forceScan: countPlan.shouldForceCountRescan,
        });
    const localSurveyResponsesCount = currentSurveyId
      ? countPlan.useCachedCounts
        ? Number(state.cachedSurveyResponsesCount || 0)
        : getMemoizedSurveyResponsesCountForPolling(instance, surveyResponsesById, currentSurveyId, {
            forceScan: countPlan.shouldForceCountRescan,
          })
      : 0;
    const patchPlan = buildSurveyResultsLocalStoragePollPatchPlan({
      blockOrRespChanged: countPlan.blockOrRespChanged,
      cachedQuestionsCount: state.cachedQuestionsCount,
      cachedSurveyResponsesCount: state.cachedSurveyResponsesCount,
      coarseSignature: countPlan.coarseSignature,
      localQBlock,
      localRespBlock,
      localSBlock,
      localSurveyResponsesCount,
      netLatest: countPlan.netLatest,
      newQuestionsCount,
      previousDetailedSignature: instance._lastLocalStoragePollDetailedSignature,
    });
    if (patchPlan.shouldReturnFalseForUnchangedSignature) {
      return false;
    }
    instance._lastLocalStoragePollCoarseSignature = countPlan.coarseSignature;
    instance._lastLocalStoragePollDetailedSignature = patchPlan.detailedSignature;

    if (patchPlan.shouldApplyPatch && patchPlan.patch) {
      ports.applyStatePatch(buildSurveyResultsLocalStoragePollPatch(patchPlan.patch), () => {
        ports.queueResultsRefresh('poll-local-storage-change');
      });
      return true;
    }

    return false;
  }) as boolean;
