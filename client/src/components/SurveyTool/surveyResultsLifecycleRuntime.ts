import type {
  SurveyResultsProps,
  SurveyResultsState,
} from './SurveyResults';
import {
  buildSurveyResultsQuestionScopeResetPatch,
  buildSurveyResultsSurveyIdPropChangePatch,
  buildSurveyResultsSurveyIdStateChangePatch,
  buildSurveyResultsViewModeResetPatch,
} from './surveyResultsHelpers.js';
import { isSurveyResultsStateSynced } from './surveyResultsSyncHelpers.js';
import { getFilterStateSignature, applyExistingGroupPrefix } from './surveyResultsRuntimeHelpers';
import { runSurveyResultsQueuedRefreshController } from './surveyResultsQueuedRefreshController';

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsResponseParseMemo = {
  clear?: () => unknown;
};

export type SurveyResultsLifecycleInstance = {
  _lastNotifiedFilterStateSignature: string | null;
  _responseParseMemo?: SurveyResultsResponseParseMemo | null;
  _surveyModeSourceSignature: string;
  _syncLoadingStartedAt: number | null;
};

export type SurveyResultsLifecyclePorts = {
  appendSessionHintToSurveyPath: (path: string) => string;
  applyStatePatch: (patch: SurveyResultsRecord, afterApply?: () => void) => void;
  buildQuestionReadScopeSignature: (args: {
    props: SurveyResultsProps;
    state: SurveyResultsState;
    viewMode: unknown;
  }) => string;
  handleNonceTick: () => unknown;
  queueResultsRefresh: (reason: string) => unknown;
  resetLocalStoragePollingBackoff: (reason: string) => unknown;
  stopLocalStoragePolling: () => unknown;
  updateLocalStoragePollingState: () => unknown;
  updateParentWithCurrentFiltersForUrl: () => unknown;
};

export type SurveyResultsComponentDidUpdateArgs = {
  instance: SurveyResultsLifecycleInstance;
  ports: SurveyResultsLifecyclePorts;
  prevProps: SurveyResultsProps;
  prevState: SurveyResultsState;
  props: SurveyResultsProps;
  state: SurveyResultsState;
};

const clearResponseParseMemo = (instance: SurveyResultsLifecycleInstance): void => {
  if (instance._responseParseMemo && typeof instance._responseParseMemo.clear === 'function') {
    instance._responseParseMemo.clear();
  }
};

const queueStatePatchValue = ({
  hasPendingStatePatch,
  key,
  pendingStatePatch,
  state,
  value,
}: {
  hasPendingStatePatch: { value: boolean };
  key: string;
  pendingStatePatch: SurveyResultsRecord;
  state: SurveyResultsState;
  value: unknown;
}): void => {
  if (state[key] === value) return;
  pendingStatePatch[key] = value;
  hasPendingStatePatch.value = true;
};

const pushResultsPath = (path: string): void => {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', applyExistingGroupPrefix(path));
};

export const runSurveyResultsComponentDidUpdate = ({
  instance,
  ports,
  prevProps,
  prevState,
  props,
  state,
}: SurveyResultsComponentDidUpdateArgs): void => {
  const refreshReasons: Set<string> = new Set();
  const pendingStatePatch: SurveyResultsRecord = {};
  const hasPendingStatePatch = { value: false };
  let runPostPatchTasks: (() => void) | null = null;
  const wasSynced = isSurveyResultsStateSynced(prevState);
  const isSyncedNow = isSurveyResultsStateSynced(state);
  if (!wasSynced && isSyncedNow) {
    instance._syncLoadingStartedAt = null;
  } else if (!isSyncedNow && instance._syncLoadingStartedAt === null) {
    instance._syncLoadingStartedAt = Date.now();
  }

  if (
    props.filteredQuestionsCount !== prevProps.filteredQuestionsCount &&
    props.filteredQuestionsCount !== state.filteredQuestionsCount
  ) {
    queueStatePatchValue({
      hasPendingStatePatch,
      key: 'filteredQuestionsCount',
      pendingStatePatch,
      state,
      value: props.filteredQuestionsCount,
    });
  }

  if (prevProps.isOpen && !props.isOpen) {
    clearResponseParseMemo(instance);
    queueStatePatchValue({ hasPendingStatePatch, key: 'questionResultsHydrated', pendingStatePatch, state, value: false });
    queueStatePatchValue({ hasPendingStatePatch, key: 'surveyResultsHydrated', pendingStatePatch, state, value: false });
    queueStatePatchValue({ hasPendingStatePatch, key: 'demoResultsViewMode', pendingStatePatch, state, value: 'raw' });
    queueStatePatchValue({ hasPendingStatePatch, key: 'demoResultsAtlasNodeId', pendingStatePatch, state, value: null });
    if (!props.preventUrlChange && typeof window !== 'undefined') {
      let basePath: string;
      if (state.viewMode === 'questions') {
        basePath = '/questions';
      } else if (state.surveyId) {
        basePath = `/survey/${state.surveyId}`;
      } else {
        basePath = '/questions';
      }
      pushResultsPath(ports.appendSessionHintToSurveyPath(basePath));
    }
    ports.stopLocalStoragePolling();
    ports.resetLocalStoragePollingBackoff('modal-closed');
    instance._syncLoadingStartedAt = null;
  }

  if (!prevProps.isOpen && props.isOpen) {
    ports.resetLocalStoragePollingBackoff('modal-open');
    if (String(state.viewMode || '').trim().toLowerCase() === 'questions') {
      queueStatePatchValue({ hasPendingStatePatch, key: 'questionResultsHydrated', pendingStatePatch, state, value: false });
    } else {
      queueStatePatchValue({ hasPendingStatePatch, key: 'surveyResultsHydrated', pendingStatePatch, state, value: false });
    }
    queueStatePatchValue({ hasPendingStatePatch, key: 'demoResultsViewMode', pendingStatePatch, state, value: 'raw' });
    queueStatePatchValue({ hasPendingStatePatch, key: 'demoResultsAtlasNodeId', pendingStatePatch, state, value: null });
    const isSyncedOnOpen = isSurveyResultsStateSynced(state);
    instance._syncLoadingStartedAt = isSyncedOnOpen ? null : Date.now();
    ports.updateLocalStoragePollingState();
    instance._lastNotifiedFilterStateSignature = null;
    refreshReasons.add('modal-open');

    const filterStatePropChanged =
      getFilterStateSignature(props.filterState) !==
      getFilterStateSignature(prevProps.filterState);

    const updateTasks = (): void => {
      ports.updateParentWithCurrentFiltersForUrl();

      if (
        !props.preventUrlChange &&
        typeof window !== 'undefined' &&
        !window.location.pathname.endsWith('/results')
      ) {
        const path =
          state.viewMode === 'questions'
            ? '/questions/results'
            : (state.surveyId ? `/survey/${state.surveyId}/results` : '/questions/results');
        pushResultsPath(ports.appendSessionHintToSurveyPath(path));
      }
    };

    if (filterStatePropChanged) {
      queueStatePatchValue({
        hasPendingStatePatch,
        key: 'filterState',
        pendingStatePatch,
        state,
        value: props.filterState || {},
      });
      runPostPatchTasks = updateTasks;
    } else {
      updateTasks();
    }
  }

  const cacheJustBecameReady =
    (state.viewMode === 'questions' &&
      !prevProps.isQuestionCacheReady &&
      props.isQuestionCacheReady) ||
    (state.viewMode === 'survey' &&
      !prevProps.isSurveyCacheReady &&
      props.isSurveyCacheReady);

  if (props.isOpen && cacheJustBecameReady) {
    refreshReasons.add('cache-ready');
  }

  if (
    props.isOpen &&
    prevProps.isResponsesCacheReady !== props.isResponsesCacheReady &&
    props.isResponsesCacheReady
  ) {
    refreshReasons.add('responses-cache-ready');
  }

  if (prevState.viewMode !== state.viewMode) {
    instance._surveyModeSourceSignature = '';
    clearResponseParseMemo(instance);
    ports.applyStatePatch(
      buildSurveyResultsViewModeResetPatch({
        questionResultsHydrated: state.questionResultsHydrated,
        surveyId: state.surveyId,
        surveyResultsHydrated: state.surveyResultsHydrated,
        viewMode: state.viewMode,
      }),
      () => {
        ports.resetLocalStoragePollingBackoff('view-mode-change');
        ports.queueResultsRefresh('view-mode-change');
      }
    );
  }

  if ((props.surveyId !== prevProps.surveyId) || (prevState.surveyId !== state.surveyId)) {
    clearResponseParseMemo(instance);
    if (props.surveyId && props.surveyId !== state.surveyId) {
      ports.applyStatePatch(
        buildSurveyResultsSurveyIdPropChangePatch(props.surveyId),
        () => {
          ports.resetLocalStoragePollingBackoff('survey-id-prop-change');
          ports.queueResultsRefresh('survey-id-prop-change');
        }
      );
    } else if (prevState.surveyId !== state.surveyId && state.viewMode === 'survey') {
      ports.applyStatePatch(
        buildSurveyResultsSurveyIdStateChangePatch(),
        () => {
          ports.resetLocalStoragePollingBackoff('survey-id-state-change');
          ports.queueResultsRefresh('survey-id-state-change');
        }
      );
    }
  }

  if (prevProps.questionResponsesNonce !== props.questionResponsesNonce) {
    ports.handleNonceTick();
  }

  if (prevProps.isOpen !== props.isOpen) {
    if (props.isOpen) {
      ports.resetLocalStoragePollingBackoff('modal-open-state-change');
    }
    ports.updateLocalStoragePollingState();
  }

  const prevQuestionScopeSignature = ports.buildQuestionReadScopeSignature({
    props: prevProps,
    state: prevState,
    viewMode: prevState.viewMode || prevProps.viewMode || 'questions',
  });
  const nextQuestionScopeSignature = ports.buildQuestionReadScopeSignature({
    props,
    state,
    viewMode: state.viewMode || props.viewMode || 'questions',
  });
  if (
    props.isOpen &&
    String(state.viewMode || '').trim().toLowerCase() === 'questions' &&
    prevQuestionScopeSignature !== nextQuestionScopeSignature
  ) {
    clearResponseParseMemo(instance);
    const questionScopeResetPatch: SurveyResultsRecord = buildSurveyResultsQuestionScopeResetPatch();
    Object.keys(questionScopeResetPatch).forEach((key) => {
      queueStatePatchValue({
        hasPendingStatePatch,
        key,
        pendingStatePatch,
        state,
        value: questionScopeResetPatch[key],
      });
    });
    refreshReasons.add('question-scope-change');
  }

  if (hasPendingStatePatch.value) {
    ports.applyStatePatch(pendingStatePatch, () => {
      if (typeof runPostPatchTasks === 'function') runPostPatchTasks();
    });
  } else if (typeof runPostPatchTasks === 'function') {
    runPostPatchTasks();
  }

  runSurveyResultsQueuedRefreshController({
    ports: {
      queueResultsRefresh: ports.queueResultsRefresh,
    },
    reasons: refreshReasons,
  });
};
