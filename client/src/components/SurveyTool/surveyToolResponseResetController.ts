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

type SurveyToolLikeProps = Record<string, any>;
type SurveyToolLikeState = Record<string, any>;
type SetStateUpdate = Record<string, unknown> | null | ((prevState: any) => Record<string, unknown> | null);
type SetState = (update: SetStateUpdate, callback?: () => void) => unknown;

const resolveActiveSurveyIndex = (props: SurveyToolLikeProps = {}) => (
  props.isStandalone || props.singleQuestionMode ? 0 : (props.surveyIndex || 0)
);

export const executeSurveyFormStateReset = ({
  props = {},
  state = {},
  persistDraft = () => {},
  clearPersistTimer = () => {},
  initializeSurveyResponseState = () => [],
  cloneValue = (value: unknown) => value,
  setState = () => {},
  callback = null,
  updateSubmittedSinceLastEdit = (_current: boolean, _action: string) => false,
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
  updateSubmittedSinceLastEdit?: (current: boolean, action: string) => boolean;
  buildResetPatch?: (args?: any) => Record<string, unknown>;
  applyResetEffects?: (args?: any) => void;
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
  resolveBaselineSlice?: (args?: any) => unknown;
  buildRevertedSlice?: (args?: any) => unknown;
  buildStatePatch?: (args?: any) => Record<string, unknown>;
  applyRevertEffects?: (args?: any) => void;
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
      () => applyRevertEffects({
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
  updateSubmittedSinceLastEdit = (_current: boolean, _action: string) => false,
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
  updateSubmittedSinceLastEdit?: (current: boolean, action: string) => boolean;
  buildStartFreshState?: (args?: any) => { emptySlice?: unknown; nextSurveysResponseState?: unknown[] };
  applyStartFreshStateEffects?: (args?: any) => void;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};
  const surveyIndex = resolveActiveSurveyIndex(nextProps);
  const renderedQuestionIds = getRenderedQuestionIds();
  const {
    emptySlice,
    nextSurveysResponseState,
  } = buildStartFreshState({
    surveyIndex,
    renderedQuestionIds,
    prevSurveysResponseState: nextState.surveysResponseState,
    buildEmptyResponseFieldState,
  });

  setState({
    suppressPrefill: true,
    startFresh: true,
    surveysResponseState: nextSurveysResponseState,
    editBaseline: cloneValue(emptySlice),
    modifiedCount: 0,
    hasEncryptedChanges: false,
    isDirty: false,
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(nextState.submittedSinceLastEdit, 'reset'),
  }, () => {
    applyStartFreshStateEffects({
      renderedQuestionIds,
      clearDraftFor,
      recalculateEditStats,
      persistDraftSafely,
    });
  });

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
  shouldStartFresh?: (args?: any) => boolean;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};
  const surveyIndex = resolveActiveSurveyIndex(nextProps);
  const surveysResponseState = Array.isArray(nextState.surveysResponseState)
    ? nextState.surveysResponseState
    : [];
  const currentSlice = (
    surveysResponseState[surveyIndex]
    && typeof surveysResponseState[surveyIndex] === 'object'
  ) ? surveysResponseState[surveyIndex] : {
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
  updateSubmittedSinceLastEdit = (_current: boolean, _action: string) => false,
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
  updateSubmittedSinceLastEdit?: (current: boolean, action: string) => boolean;
  resolveBaselineSlice?: (args?: any) => unknown;
  buildStatePatch?: (args?: any) => Record<string, unknown>;
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
    setState({
      isEditing: false,
      displayAnswerMode: true,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit((state || {}).submittedSinceLastEdit, 'reset'),
    }, () => {
      recalculateEditStats();
    });
    return {
      applied: false,
      reason: 'fallback',
    };
  }
};
