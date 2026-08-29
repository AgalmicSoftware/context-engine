import type { ChangedFieldsDiffCache, PendingEditStatsCache } from './surveyToolChangedFieldsController';
import type { ResponseSlice as SurveyToolResponseSlice, UnknownRecord } from './surveyToolTypes';
import type { SurveyQuestionsProps, SurveyQuestionsState } from './surveyQuestionsTypes';
import type { SurveyQuestionsStateUpdate } from './surveyQuestionsState';
import type { SurveyAudioWorkerPropsMemo } from './surveyToolRuntimeSupport';

declare global {
  interface Window {
    __CE_SINGLE_Q_DEBUG__?: Record<string, unknown>;
  }
}

export type SurveyQuestionsRecord = Record<string, unknown>;
export type SurveyQuestionsCacheQuestion = Record<string, unknown> & { id: string };
export type SurveyQuestionsSetStateCallback = () => unknown;
export type SurveyQuestionsSetState = (
  update: SurveyQuestionsStateUpdate,
  callback?: SurveyQuestionsSetStateCallback,
) => void;
export type SurveyQuestionsTimer = ReturnType<typeof setTimeout>;
export type SurveyQuestionsTimerRef = SurveyQuestionsTimer | null;
type SurveyQuestionsRuntimeRecord = Record<string, unknown>;
export type SurveyQuestionsDraftParseCache = {
  key?: unknown;
  raw?: unknown;
  parsed?: unknown;
} | null;
export type SurveyQuestionsDraftTrackingState = {
  draftParseCache?: SurveyQuestionsDraftParseCache;
  lastDraftKey?: unknown;
  lastDraftJSON?: unknown;
  lastDraftSemanticSignature?: unknown;
};
type SurveyQuestionsPolicyCache = {
  key: string;
  cfgSignature: string;
  cfg: unknown;
  value: unknown;
  ts: number;
};
type SurveyQuestionsLookupCache = {
  stateQuestionPool: unknown[] | null;
  statePileQuestions: unknown[] | null;
  propsQuestionPool: unknown[] | null;
  value: Map<string, unknown> | null;
};
type SurveyQuestionsCurrentRenderedIdsCache = string[] | null;
type SurveyQuestionsMemoValue<T = unknown> = {
  key: string;
  value: T | null;
  hasValue?: boolean;
  source?: unknown;
  poolRef?: unknown;
  poolVersion?: number;
};
type SurveyQuestionsLockedGateDetailsMemo = {
  key: string;
  poolRef: unknown;
  poolVersion: number;
  value: unknown[];
};
type SurveyQuestionsCanDecryptRun = Promise<boolean> | null;
type SurveyQuestionsBusyTokenMap = Record<string, unknown>;
type SurveyQuestionsPendingStatsSnapshot = {
  total: number;
  encrypted: number;
  submittedSinceLastEdit: boolean;
  isSubmitting: boolean;
};
export type SurveyQuestionsPendingStatsInput =
  Partial<Pick<SurveyQuestionsPendingStatsSnapshot, 'total' | 'encrypted'>> | null | undefined;
type SurveyQuestionsAutoDecryptQueueItem = {
  qid: string;
  field: string;
  maskedSig?: string;
};
type SurveyQuestionsAutoDecryptSweepCache = SurveyQuestionsRuntimeRecord | null;
export type SurveyQuestionsResponseFieldState = UnknownRecord & {
  value?: unknown;
  encryptedPortion?: unknown;
};
type SurveyQuestionsHydrationSlice = SurveyToolResponseSlice;
export type SurveyQuestionsHydrationPatch = {
  answerState?: SurveyQuestionsResponseFieldState;
  additionalState?: SurveyQuestionsResponseFieldState;
  importanceChanged?: boolean;
  importanceValue?: unknown;
  convictionChanged?: boolean;
  convictionValue?: unknown;
  interviewProvenanceState?: SurveyQuestionsRecord;
  changed?: unknown;
};
type SurveyQuestionsParseValue = (value: unknown) => unknown;
export type SurveyQuestionsQuestionIdResolver = (response: unknown) => string | null | undefined;
export type SurveyQuestionsDraftHydrationEntryArgs = {
  targetSlice?: SurveyQuestionsHydrationSlice | null;
  questionId?: string;
  draftEntry?: unknown;
  allowOverwrite?: boolean;
};
export type SurveyQuestionsResponseHydrationEntryArgs = {
  targetSlice?: SurveyQuestionsHydrationSlice | null;
  currentSlice?: SurveyQuestionsHydrationSlice | null;
  questionId?: string;
  response?: unknown;
  allowOverwrite?: boolean;
  parseValue?: SurveyQuestionsParseValue | null;
};
export type SurveyQuestionsResponseHydrationListArgs = SurveyQuestionsResponseHydrationEntryArgs & {
  responses?: unknown[] | unknown;
  questionIdResolver?: SurveyQuestionsQuestionIdResolver | null;
};
export type SurveyQuestionsCachedResponseEntryArgs = {
  targetSlice?: SurveyQuestionsHydrationSlice | null;
  questionId?: string;
  response?: unknown;
  parseValue?: SurveyQuestionsParseValue | null;
};
export type SurveyQuestionsLocalCacheHydrationEntryArgs = {
  targetSlice?: SurveyQuestionsHydrationSlice | null;
  questionId?: string;
  cachedAnswer?: SurveyQuestionsResponseFieldState | null;
  cachedAdditional?: SurveyQuestionsResponseFieldState | null;
  cachedImportance?: unknown;
  cachedConviction?: unknown;
  allowMaskedAnswerDraftEmpty?: boolean;
  allowMaskedAdditionalDraftEmpty?: boolean;
  debugLabel?: string;
};
type SurveyQuestionsDraftHydrationEntryApplier = (args?: SurveyQuestionsDraftHydrationEntryArgs) => boolean;
type SurveyQuestionsResponseHydrationEntryApplier = (args?: SurveyQuestionsResponseHydrationEntryArgs) => boolean;
type SurveyQuestionsResponseHydrationListApplier = (args?: SurveyQuestionsResponseHydrationListArgs) => boolean;
type SurveyQuestionsCachedResponseEntryApplier = (args?: SurveyQuestionsCachedResponseEntryArgs) => boolean;
type SurveyQuestionsLocalCacheHydrationEntryApplier = (args?: SurveyQuestionsLocalCacheHydrationEntryArgs) => boolean;
export type SurveyQuestionsTimeoutCallback = () => void;
export type SurveyQuestionsBootstrapRetryArgs = {
  questionId?: unknown;
  attempt?: unknown;
  reason?: unknown;
};

export interface SurveyQuestions {
  setState: SurveyQuestionsSetState;
  _emptySubmitTimer: SurveyQuestionsTimerRef;
}

export type SurveyQuestionsInstanceFields = {
  _emptySubmitTimer: SurveyQuestionsTimerRef;
  _persistTimer: SurveyQuestionsTimerRef;
  _draftParseCache: SurveyQuestionsDraftParseCache;
  _lastDraftKey: string;
  _lastDraftJSON: unknown;
  _lastDraftSemanticSignature: unknown;
  _responseGatePolicyCache: SurveyQuestionsPolicyCache;
  _changedQidsAndFieldsCache: ChangedFieldsDiffCache | null;
  _pendingEditStatsCache: PendingEditStatsCache | null;
  _normalizedQuestionEntryKeyCache: WeakMap<object, unknown>;
  _questionByIdLookupCache: SurveyQuestionsLookupCache;
  _currentRenderedQuestionIdsCache: SurveyQuestionsCurrentRenderedIdsCache;
  _currentRenderedQuestionIdsCacheQuestionPool: unknown[] | null;
  _currentRenderedQuestionIdsCacheQuestionPoolLength: number;
  _currentRenderedQuestionIdsCachePileQuestions: unknown[] | null;
  _currentRenderedQuestionIdsCachePileQuestionsLength: number;
  _currentRenderedQuestionIdsCacheSingleQuestionMode: boolean;
  _currentRenderedQuestionIdsCacheQuestionId: string;
  _localCacheSliceMemo: SurveyQuestionsMemoValue;
  _rehydrateLocalCacheLastSig: string;
  _autoDecryptVisibleSweepCache: SurveyQuestionsAutoDecryptSweepCache;
  _userAnswersSliceCache: { source: unknown; value: unknown };
  _jsonPreviewTimer: SurveyQuestionsTimerRef;
  _surveyJsonMetaCache: SurveyQuestionsMemoValue;
  _lockedQuestionGateDetailsMemo: SurveyQuestionsLockedGateDetailsMemo;
  _maskedQuestionVisibilityMemoByPool: WeakMap<object, unknown>;
  // These property names survive minification in the SurveyQuestions chunk.
  _a: SurveyQuestionsRuntimeRecord | null;
  _audioInputWorkerPropsMemo: SurveyAudioWorkerPropsMemo | null;
  _q: Map<string, SurveyQuestionsRuntimeRecord>;
  _canDecryptOtherResponsesKey: string;
  _canDecryptOtherResponsesInFlight: SurveyQuestionsCanDecryptRun;
  _canDecryptOtherResponsesSig: string;
  _canDecryptOtherResponsesRunId: number;
  _fetchSurveyResponseRunId: number;
  _fetchSingleQuestionRunId: number;
  _questionPoolHydrationRunId: number;
  _localCacheRehydrateRunId: number;
  _responseHydrationStateUpdateDepth: number;
  _surveyDecryptAttemptSeq: number;
  _activeSurveyDecryptAttemptSeq: number;
  _submitAttemptSeq: number;
  _activeSubmitAttemptSeq: number;
  _questionDecryptBusyTokenSeq: number;
  _questionDecryptBusyTokens: SurveyQuestionsBusyTokenMap;
  _singleQuestionBootstrapRetryTimer: SurveyQuestionsTimerRef;
  _singleQuestionBootstrapRetrySig: string;
  _isMounted: boolean;
  _hasMounted: boolean;
  _autoDecProcessTimer: SurveyQuestionsTimerRef;
  _autoDecryptSweepMicrotaskScheduled: boolean;
  _autoDecryptSweepFrameRequestId: number | null;
  _queuedAutoDecryptSweepReasons: Set<string>;
  _gateSbtHydrationSig: string;
  _gateSbtHydrationRetryTimer: SurveyQuestionsTimerRef;
  _draftDirtyQids: Set<string>;
  _submitGuard: boolean;
  _lastPendingStats: SurveyQuestionsPendingStatsSnapshot | null;
  _priorResponseBackfillAttempted: Set<string>;
  _priorResponseBackfillInFlight: Promise<boolean> | null;
  _priorResponseHydrationContextSig: string;
  _autoDecQueue: SurveyQuestionsAutoDecryptQueueItem[];
  _autoDecProcessing: boolean;
  _autoDecryptMaskedAttemptSignature: Record<string, string>;
  _decryptFieldTaskInFlight: Map<string, Promise<unknown>>;
  _transientTimeouts: Set<SurveyQuestionsTimer>;
  _applyDraftTrackingState: (tracking?: SurveyQuestionsDraftTrackingState) => void;
  _applyDraftHydrationEntryToSlice: SurveyQuestionsDraftHydrationEntryApplier;
  _applyResponseHydrationEntryToSlice: SurveyQuestionsResponseHydrationEntryApplier;
  _applyResponseHydrationListToSlice: SurveyQuestionsResponseHydrationListApplier;
  _applyCachedResponseEntryToSlice: SurveyQuestionsCachedResponseEntryApplier;
  _applyLocalCacheHydrationEntryToSlice: SurveyQuestionsLocalCacheHydrationEntryApplier;
  _getDraftScope: () => string;
  _getEffectiveDraftSlug: () => string;
  [key: string]: unknown;
};

export const createSurveyQuestionsInstanceFields = (): SurveyQuestionsInstanceFields => ({
  _emptySubmitTimer: null,
  _persistTimer: null,
  _draftParseCache: null,
  _lastDraftKey: '',
  _lastDraftJSON: null,
  _lastDraftSemanticSignature: null,
  _responseGatePolicyCache: { key: '', cfgSignature: '', cfg: null, value: null, ts: 0 },
  _changedQidsAndFieldsCache: null,
  _pendingEditStatsCache: null,
  _normalizedQuestionEntryKeyCache: new WeakMap(),
  _questionByIdLookupCache: {
    stateQuestionPool: null,
    statePileQuestions: null,
    propsQuestionPool: null,
    value: null,
  },
  _currentRenderedQuestionIdsCache: null,
  _currentRenderedQuestionIdsCacheQuestionPool: null,
  _currentRenderedQuestionIdsCacheQuestionPoolLength: 0,
  _currentRenderedQuestionIdsCachePileQuestions: null,
  _currentRenderedQuestionIdsCachePileQuestionsLength: 0,
  _currentRenderedQuestionIdsCacheSingleQuestionMode: false,
  _currentRenderedQuestionIdsCacheQuestionId: '',
  _localCacheSliceMemo: { key: '', value: null, hasValue: false },
  _rehydrateLocalCacheLastSig: '',
  _autoDecryptVisibleSweepCache: null,
  _userAnswersSliceCache: { source: null, value: null },
  _jsonPreviewTimer: null,
  _surveyJsonMetaCache: { key: '', source: null, value: null },
  _lockedQuestionGateDetailsMemo: { key: '', poolRef: null, poolVersion: 0, value: [] },
  _maskedQuestionVisibilityMemoByPool: new WeakMap(),
  _a: null,
  _audioInputWorkerPropsMemo: null,
  _q: new Map(),
  _canDecryptOtherResponsesKey: '',
  _canDecryptOtherResponsesInFlight: null,
  _canDecryptOtherResponsesSig: '',
  _canDecryptOtherResponsesRunId: 0,
  _fetchSurveyResponseRunId: 0,
  _fetchSingleQuestionRunId: 0,
  _questionPoolHydrationRunId: 0,
  _localCacheRehydrateRunId: 0,
  _responseHydrationStateUpdateDepth: 0,
  _surveyDecryptAttemptSeq: 0,
  _activeSurveyDecryptAttemptSeq: 0,
  _submitAttemptSeq: 0,
  _activeSubmitAttemptSeq: 0,
  _questionDecryptBusyTokenSeq: 0,
  _questionDecryptBusyTokens: {},
  _singleQuestionBootstrapRetryTimer: null,
  _singleQuestionBootstrapRetrySig: '',
  _isMounted: false,
  _hasMounted: false,
  _autoDecProcessTimer: null,
  _autoDecryptSweepMicrotaskScheduled: false,
  _autoDecryptSweepFrameRequestId: null,
  _queuedAutoDecryptSweepReasons: new Set(),
  _gateSbtHydrationSig: '',
  _gateSbtHydrationRetryTimer: null,
  _draftDirtyQids: new Set(),
  _submitGuard: false,
  _lastPendingStats: null,
  _priorResponseBackfillAttempted: new Set(),
  _priorResponseBackfillInFlight: null,
  _priorResponseHydrationContextSig: '',
  _autoDecQueue: [],
  _autoDecProcessing: false,
  _autoDecryptMaskedAttemptSignature: {},
  _decryptFieldTaskInFlight: new Map(),
  _transientTimeouts: new Set(),
  _applyDraftTrackingState: () => {},
  _applyDraftHydrationEntryToSlice: () => false,
  _applyResponseHydrationEntryToSlice: () => false,
  _applyResponseHydrationListToSlice: () => false,
  _applyCachedResponseEntryToSlice: () => false,
  _applyLocalCacheHydrationEntryToSlice: () => false,
  _getDraftScope: () => '',
  _getEffectiveDraftSlug: () => '',
});
