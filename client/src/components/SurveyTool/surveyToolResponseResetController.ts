import {
  buildExitEditingStatePatch,
  applyResetFormStateEffects,
  applyRevertPendingEffects,
  applyStartFreshEffects,
  buildResetFormStatePatch,
  buildRevertPendingStatePatch,
  buildRevertedResponseSlice,
  buildStartFreshSurveyState,
  resolveExitEditingBaselineSlice,
  resolveRevertPendingBaselineSlice,
  shouldHandleStartFresh,
} from './surveyToolHydrationFlow.js';
import type { UnknownRecord } from './surveyToolTypes';

type SurveyToolLikeProps = UnknownRecord & {
  account?: unknown;
  isStandalone?: boolean;
  loginComplete?: unknown;
  responderAddress?: unknown;
  singleQuestionMode?: boolean;
  surveyIndex?: number;
  viewAddress?: unknown;
};

type SurveyToolLikeState = UnknownRecord & {
  editBaseline?: unknown;
  isDirty?: unknown;
  parsedViewAddressAnswers?: unknown;
  submittedSinceLastEdit?: boolean;
  surveysResponseState?: unknown;
  userAnswers?: unknown;
  userHasResponse?: unknown;
};

type SetStateUpdate =
  Record<string, unknown> | null | ((prevState: SurveyToolLikeState) => Record<string, unknown> | null);
type SetState = (update: SetStateUpdate, callback?: () => void) => unknown;
type ResetArgs = UnknownRecord;

const resolveActiveSurveyIndex = (props: SurveyToolLikeProps = {}) =>
  props.isStandalone || props.singleQuestionMode ? 0 : props.surveyIndex || 0;

export const buildSurveyStartFreshStatePatch = ({
  cloneValue = (value: unknown) => value,
  emptySlice = null,
  nextSubmittedSinceLastEdit = false,
  nextSurveysResponseState = [],
}: {
  cloneValue?: (value: unknown) => unknown;
  emptySlice?: unknown;
  nextSubmittedSinceLastEdit?: unknown;
  nextSurveysResponseState?: unknown;
} = {}) => ({
  suppressPrefill: true,
  startFresh: true,
  surveysResponseState: nextSurveysResponseState,
  editBaseline: cloneValue(emptySlice),
  modifiedCount: 0,
  hasEncryptedChanges: false,
  isDirty: false,
  isLoadingResponse: false,
  submittedSinceLastEdit: nextSubmittedSinceLastEdit,
});

export const buildSurveyExitEditingFallbackPatch = ({
  nextSubmittedSinceLastEdit = false,
}: {
  nextSubmittedSinceLastEdit?: unknown;
} = {}) => ({
  isEditing: false,
  displayAnswerMode: true,
  submittedSinceLastEdit: nextSubmittedSinceLastEdit,
});

export const executeSurveyFormStateReset = ({
  props = {},
  state = {},
  persistDraft = () => {},
  clearPersistTimer = () => {},
  initializeSurveyResponseState = () => [],
  cloneValue = (value: unknown) => value,
  setState = () => {},
  callback = null,
  updateSubmittedSinceLastEdit = (_current: boolean | undefined, _action: string) => false,
  buildResetPatch = buildResetFormStatePatch,
  applyResetEffects = applyResetFormStateEffects,
  onPersistError = () => {},
  onCleanupError = () => {},
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  persistDraft?: () => void;
  clearPersistTimer?: () => void;
  initializeSurveyResponseState?: () => unknown[];
  cloneValue?: (value: unknown) => unknown;
  setState?: SetState;
  callback?: (() => void) | null;
  updateSubmittedSinceLastEdit?: (current: boolean | undefined, action: string) => boolean;
  buildResetPatch?: (args?: ResetArgs) => Record<string, unknown>;
  applyResetEffects?: (args?: ResetArgs) => void;
  onPersistError?: (error: unknown) => void;
  onCleanupError?: (error: unknown) => void;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};

  try {
    persistDraft();
  } catch (error) {
    onPersistError(error);
  }

  try {
    clearPersistTimer();
  } catch (error) {
    onCleanupError(error);
  }

  const initial = initializeSurveyResponseState();
  const nextResetState = buildResetPatch({
    initialSurveysResponseState: Array.isArray(initial) ? initial : [],
    baselineIndex: nextProps.surveyIndex || 0,
    nextSubmittedSinceLastEdit: updateSubmittedSinceLastEdit(nextState.submittedSinceLastEdit, 'reset'),
    cloneValue,
  });

  setState(nextResetState, () => applyResetEffects({ callback }));
  return {
    applied: true,
    reason: 'applied',
  };
};

export const executeSurveyPendingRevert = ({
  props = {},
  state = {},
  buildSliceFromUserAnswers = null,
  buildSliceFromLocalCache = null,
  getRenderedQuestionIds = () => [],
  cloneFieldState = (value: unknown) => value,
  buildEmptyResponseFieldState = () => null,
  setState = () => {},
  clearDraft = () => {},
  recalculateEditStats = () => {},
  updateJsonPreview = () => {},
  resolveBaselineSlice = resolveRevertPendingBaselineSlice,
  buildRevertedSlice = buildRevertedResponseSlice,
  buildStatePatch = buildRevertPendingStatePatch,
  applyRevertEffects = applyRevertPendingEffects,
  onFailure = () => {},
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  buildSliceFromUserAnswers?: ((userAnswers: unknown) => unknown) | null;
  buildSliceFromLocalCache?: (() => unknown) | null;
  getRenderedQuestionIds?: () => unknown[];
  cloneFieldState?: (value: unknown) => unknown;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
  setState?: SetState;
  clearDraft?: () => void;
  recalculateEditStats?: () => void;
  updateJsonPreview?: () => void;
  resolveBaselineSlice?: (args?: ResetArgs) => unknown;
  buildRevertedSlice?: (args?: ResetArgs) => unknown;
  buildStatePatch?: (args?: ResetArgs) => Record<string, unknown>;
  applyRevertEffects?: (args?: ResetArgs) => void;
  onFailure?: (error: unknown) => void;
} = {}) => {
  try {
    const nextProps = props || {};
    const nextState = state || {};
    const surveyIndex = resolveActiveSurveyIndex(nextProps);
    const isLoggedIn = !!(nextProps.loginComplete && nextProps.account);
    const baselineSlice = resolveBaselineSlice({
      editBaseline: nextState.editBaseline,
      isLoggedIn,
      userAnswers: nextState.userAnswers,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    });

    const renderedQuestionIds = getRenderedQuestionIds();
    const nextSlice = buildRevertedSlice({
      baselineSlice,
      renderedQuestionIds,
      cloneFieldState,
      buildEmptyResponseFieldState,
    });

    setState(
      buildStatePatch({
        prevSurveysResponseState: nextState.surveysResponseState,
        surveyIndex,
        nextSlice,
        isLoggedIn,
      }),
      () =>
        applyRevertEffects({
          clearDraft,
          recalculateEditStats,
          updateJsonPreview,
        }),
    );

    return {
      applied: true,
      reason: 'applied',
      renderedQuestionIds,
    };
  } catch (error) {
    onFailure(error);
    return {
      applied: false,
      reason: 'error',
      renderedQuestionIds: [],
    };
  }
};

export const executeSurveyStartFresh = ({
  props = {},
  state = {},
  getRenderedQuestionIds = () => [],
  buildEmptyResponseFieldState = () => null,
  cloneValue = (value: unknown) => value,
  setState = () => {},
  clearDraftFor = () => {},
  recalculateEditStats = () => {},
  persistDraftSafely = () => {},
  updateSubmittedSinceLastEdit = (_current: boolean | undefined, _action: string) => false,
  buildStartFreshState = buildStartFreshSurveyState,
  applyStartFreshStateEffects = applyStartFreshEffects,
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  getRenderedQuestionIds?: () => unknown[];
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
  cloneValue?: (value: unknown) => unknown;
  setState?: SetState;
  clearDraftFor?: (questionId: string) => void;
  recalculateEditStats?: () => void;
  persistDraftSafely?: (delayMs?: number) => void;
  updateSubmittedSinceLastEdit?: (current: boolean | undefined, action: string) => boolean;
  buildStartFreshState?: (args?: ResetArgs) => { emptySlice?: unknown; nextSurveysResponseState?: unknown[] };
  applyStartFreshStateEffects?: (args?: ResetArgs) => void;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};
  const surveyIndex = resolveActiveSurveyIndex(nextProps);
  const renderedQuestionIds = getRenderedQuestionIds();
  const { emptySlice, nextSurveysResponseState } = buildStartFreshState({
    surveyIndex,
    renderedQuestionIds,
    prevSurveysResponseState: nextState.surveysResponseState,
    buildEmptyResponseFieldState,
  });

  setState(
    buildSurveyStartFreshStatePatch({
      cloneValue,
      emptySlice,
      nextSubmittedSinceLastEdit: updateSubmittedSinceLastEdit(nextState.submittedSinceLastEdit, 'reset'),
      nextSurveysResponseState,
    }),
    () => {
      applyStartFreshStateEffects({
        renderedQuestionIds,
        clearDraftFor,
        recalculateEditStats,
        persistDraftSafely,
      });
    },
  );

  return {
    applied: true,
    reason: 'applied',
    renderedQuestionIds,
  };
};

export const shouldSurveyAutoStartFresh = ({
  props = {},
  state = {},
  getRenderedQuestionIds = () => [],
  shouldStartFresh = shouldHandleStartFresh,
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  getRenderedQuestionIds?: () => unknown[];
  shouldStartFresh?: (args?: ResetArgs) => boolean;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};
  const surveyIndex = resolveActiveSurveyIndex(nextProps);
  const surveysResponseState = Array.isArray(nextState.surveysResponseState) ? nextState.surveysResponseState : [];
  const currentSlice =
    surveysResponseState[surveyIndex] && typeof surveysResponseState[surveyIndex] === 'object'
      ? surveysResponseState[surveyIndex]
      : {
          answers: {},
          additionalComments: {},
          importance: {},
          conviction: {},
        };

  return shouldStartFresh({
    viewAddress: nextProps.viewAddress,
    userHasResponse: nextState.userHasResponse,
    editBaseline: nextState.editBaseline,
    isDirty: nextState.isDirty,
    currentSlice,
    renderedQuestionIds: getRenderedQuestionIds(),
  });
};

export const executeSurveyExitEditing = ({
  props = {},
  state = {},
  buildSliceFromUserAnswers = null,
  buildSliceFromLocalCache = null,
  getRenderedQuestionIds = () => [],
  buildEmptyResponseFieldState = () => null,
  cloneValue = (value: unknown) => value,
  setState = () => {},
  recalculateEditStats = () => {},
  persistDraftSafely = () => {},
  updateJsonPreview = () => {},
  clearDraft = () => {},
  updateSubmittedSinceLastEdit = (_current: boolean | undefined, _action: string) => false,
  resolveBaselineSlice = resolveExitEditingBaselineSlice,
  buildStatePatch = buildExitEditingStatePatch,
  onFailure = () => {},
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  buildSliceFromUserAnswers?: ((sourceAnswers: unknown) => unknown) | null;
  buildSliceFromLocalCache?: (() => unknown) | null;
  getRenderedQuestionIds?: () => unknown[];
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
  cloneValue?: (value: unknown) => unknown;
  setState?: SetState;
  recalculateEditStats?: () => void;
  persistDraftSafely?: (delayMs?: number) => void;
  updateJsonPreview?: () => void;
  clearDraft?: () => void;
  updateSubmittedSinceLastEdit?: (current: boolean | undefined, action: string) => boolean;
  resolveBaselineSlice?: (args?: ResetArgs) => unknown;
  buildStatePatch?: (args?: ResetArgs) => Record<string, unknown>;
  onFailure?: (error: unknown) => void;
} = {}) => {
  try {
    const nextProps = props || {};
    const nextState = state || {};
    const surveyIndex = resolveActiveSurveyIndex(nextProps);
    const baselineSlice = resolveBaselineSlice({
      responderAddress: nextProps.responderAddress,
      parsedViewAddressAnswers: nextState.parsedViewAddressAnswers,
      userAnswers: nextState.userAnswers,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    });

    setState(
      buildStatePatch({
        prevSurveysResponseState: nextState.surveysResponseState,
        surveyIndex,
        baselineSlice,
        renderedQuestionIds: getRenderedQuestionIds(),
        buildEmptyResponseFieldState,
        cloneValue,
        nextSubmittedSinceLastEdit: updateSubmittedSinceLastEdit(nextState.submittedSinceLastEdit, 'reset'),
      }),
      () => {
        recalculateEditStats();
        persistDraftSafely();
        updateJsonPreview();
      },
    );

    clearDraft();
    return {
      applied: true,
      reason: 'applied',
    };
  } catch (error) {
    onFailure(error);
    setState(
      buildSurveyExitEditingFallbackPatch({
        nextSubmittedSinceLastEdit: updateSubmittedSinceLastEdit((state || {}).submittedSinceLastEdit, 'reset'),
      }),
      () => {
        recalculateEditStats();
      },
    );
    return {
      applied: false,
      reason: 'fallback',
    };
  }
};
