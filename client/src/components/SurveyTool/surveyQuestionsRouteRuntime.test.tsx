import { createSurveyQuestionsRouteRuntime } from './surveyQuestionsRouteRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const QUESTION_POOL = [
  {
    id: 'q1',
    prompt: 'Question 1',
    type: 'text',
  },
];

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  EMPTY_QUESTION_POOL: [],
  SurveyQuestionsRouteSurface: () => null,
  bottomRef: { current: null },
  buildSurveyQuestionsAuthoringPanelDisplayState: jest.fn(() => ({ canEditQuestions: true })),
  buildSurveyQuestionsAuthoringRouteReadinessDescriptor: jest.fn(() => ({
    shouldRenderEditableQuestions: true,
  })),
  buildSurveyQuestionsFullLoadingProgressState: jest.fn(() => ({ percent: 50 })),
  buildSurveyQuestionsJsonForDisplayState: jest.fn(() => ({ jsonForDisplay: { response: true } })),
  buildSurveyQuestionsJsonPanelDisplayState: jest.fn(() => ({
    showQuestionsJsonPanel: true,
    showResponseJsonPanel: true,
    showSurveyJsonPanel: true,
  })),
  buildSurveyQuestionsJsonPreviewDisplayState: jest.fn(() => ({ jsonPreview: { preview: true } })),
  buildSurveyQuestionsLayoutDisplayState: jest.fn(() => ({ layout: 'default' })),
  buildSurveyQuestionsMaskedQuestionVisibility: jest.fn(({ questionPool, singleQuestionMode }) => ({
    fullQuestionPool: questionPool,
    hasHiddenMaskedQuestions: false,
    hiddenMaskedQuestionIds: [],
    singleQuestionMode,
    visibleQuestionPool: questionPool,
  })),
  buildSurveyQuestionsRenderReadinessDescriptor: jest.fn(() => ({
    currentSurveyResponseState: { answers: { q1: { value: 'Yes' } } },
    fullQuestionPool: QUESTION_POOL,
    gatedEmptyStateReady: false,
    hasHiddenMaskedQuestions: false,
    hiddenMaskedQuestionIds: [],
    questionPoolReady: true,
    shouldShowLoadingState: false,
    surveyIndex: 0,
    visibleQuestionPool: QUESTION_POOL,
  })),
  buildSurveyQuestionsRouteJsonControlsProps: jest.fn((props) => ({ ...props, built: true })),
  buildSurveyQuestionsRouteViewDisplayState: jest.fn(() => ({
    isOwnResponse: true,
    isSingleQuestionView: false,
  })),
  buildSurveyQuestionsSubmitFooterDisplayState: jest.fn(() => ({
    canEditQuestions: true,
  })),
  buildSurveyQuestionsSubmitReadinessDescriptor: jest.fn(() => ({
    hasEncryptedAnswers: false,
    hasMaskedCurrentQuestionPayload: false,
    pendingEditCount: 2,
  })),
  bumpSurveyPerfCounter: jest.fn(),
  closeQuestionTagModal: jest.fn(),
  computeSubmitLabel: jest.fn(() => 'Submit 2 Responses'),
  copyJsonToClipboard: jest.fn(),
  engine: { id: 'engine' },
  getMemoizedLockedQuestionGateDetails: jest.fn(() => [{ id: 'gate' }]),
  getPendingStatsSnapshot: jest.fn(() => ({ total: 2 })),
  getQuestionsJson: jest.fn(() => ({ questions: true })),
  getResponseJson: jest.fn(() => ({ response: true })),
  getShortenedAddress: jest.fn((address) => `short:${address}`),
  getSurveyJson: jest.fn(() => ({ survey: true })),
  handleDecryptEdit: jest.fn(),
  handleExitEditing: jest.fn(),
  handlePrimarySubmitClick: jest.fn(),
  handleRevertPendingChanges: jest.fn(),
  handleScrollToTop: jest.fn(),
  handleShowJsonAtBottom: jest.fn(),
  handleStartFresh: jest.fn(),
  hasMaskedCurrentQuestionPayload: jest.fn(() => false),
  inst: {
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _maskedQuestionVisibilityMemoByPool: new WeakMap(),
  },
  isMaskedPromptText: jest.fn(() => false),
  jsonTreeDisplay: jest.fn(() => 'json-tree'),
  propsRef: {
    current: {
      account: '0xabc',
      computeSubmitLabel: null,
      hideEmbeddedDebugUi: false,
      isQuestionCacheReady: true,
      isStandalone: false,
      questionScanProgress: { complete: 1, total: 2 },
      responderAddress: '',
      singleQuestionMode: false,
      surveyIndex: 0,
      useHeaderSubmit: false,
      viewAddress: '',
    },
  },
  renderLockedQuestionsPanel: jest.fn(() => 'locked-panel'),
  renderQuestion: jest.fn(() => 'editable-question'),
  renderQuestionAnswer: jest.fn(() => 'question-answer'),
  renderSurveyAnswers: jest.fn(() => 'survey-answers'),
  resolveEffectiveSlug: jest.fn(() => 'fallback-edge'),
  stateRef: {
    current: {
      activeTagModalTag: null,
      copiedQuestionsJson: false,
      copiedResponseJson: false,
      copiedSurveyJson: false,
      currentStep: 2,
      displayAnswerMode: false,
      isDecrypting: false,
      isDirty: true,
      isEditing: false,
      isLoadingResponse: false,
      isSubmitting: false,
      jsonPreview: { existing: true },
      noResponse: false,
      parsedViewAddressAnswers: null,
      questionPool: QUESTION_POOL,
      responseLookupWarning: '',
      responseUrl: '/response/1',
      showQuestionsJson: true,
      showResponseJson: true,
      showSurveyJson: true,
      startFresh: false,
      submissionComplete: false,
      submissionError: '',
      submittedSinceLastEdit: false,
      surveysResponseState: [{ answers: { q1: { value: 'Yes' } } }],
      userAnswers: { q1: { value: 'Yes' } },
      userHasResponse: true,
      userResponseEncrypted: false,
    },
  },
  styles: {
    route: 'route',
  },
  surveyLog: {
    warn: jest.fn(),
  },
  toggleDisplayAnswerMode: jest.fn(),
  toggleShowQuestionsJson: jest.fn(),
  toggleShowResponseJson: jest.fn(),
  toggleShowSurveyJson: jest.fn(),
  topRef: { current: null },
  ...overrides,
});

describe('surveyQuestionsRouteRuntime', () => {
  it('memoizes masked visibility per pool and route mode while preserving counters', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRouteRuntime(context);

    const multi = runtime.getMemoizedMaskedQuestionVisibility(QUESTION_POOL, false);
    const multiAgain = runtime.getMemoizedMaskedQuestionVisibility(QUESTION_POOL, false);
    const single = runtime.getMemoizedMaskedQuestionVisibility(QUESTION_POOL, true);

    expect(multi).toBe(multiAgain);
    expect(single).not.toBe(multi);
    expect(context.buildSurveyQuestionsMaskedQuestionVisibility).toHaveBeenCalledTimes(2);
    expect(context.buildSurveyQuestionsMaskedQuestionVisibility).toHaveBeenCalledWith({
      isMaskedPromptText: context.isMaskedPromptText,
      questionPool: QUESTION_POOL,
      singleQuestionMode: false,
    });
    expect(context.bumpSurveyPerfCounter).toHaveBeenCalledWith('maskedVisibilityMemoHitCount');
    expect(context.bumpSurveyPerfCounter).toHaveBeenCalledWith('maskedVisibilityMemoMissCount');
    expect(context.bumpSurveyPerfCounter).toHaveBeenCalledWith('maskedVisibilityVisibleCountOnMiss', 1);
  });

  it('renders the loading route with readiness and progress props only', () => {
    const context = createContext({
      buildSurveyQuestionsRenderReadinessDescriptor: jest.fn(() => ({
        currentSurveyResponseState: null,
        fullQuestionPool: [],
        gatedEmptyStateReady: false,
        hasHiddenMaskedQuestions: false,
        hiddenMaskedQuestionIds: [],
        questionPoolReady: false,
        shouldShowLoadingState: true,
        surveyIndex: 0,
        visibleQuestionPool: [],
      })),
    });
    const runtime = createSurveyQuestionsRouteRuntime(context);

    const element = runtime.renderDefaultSurveyQuestionsRoute();

    expect(element.props.renderReadiness.shouldShowLoadingState).toBe(true);
    expect(element.props.loadingProgressState).toEqual({ percent: 50 });
    expect(context.renderQuestion).not.toHaveBeenCalled();
    expect(context.buildSurveyQuestionsRouteJsonControlsProps).not.toHaveBeenCalled();
  });

  it('assembles editable route props with display descriptors and handlers intact', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRouteRuntime(context);

    const element = runtime.renderDefaultSurveyQuestionsRoute();

    expect(context.bumpSurveyPerfCounter).toHaveBeenCalledWith('renderCount');
    expect(context.buildSurveyQuestionsRenderReadinessDescriptor).toHaveBeenCalledWith(
      expect.objectContaining({
        questionPool: QUESTION_POOL,
        visibleQuestionPool: QUESTION_POOL,
      }),
    );
    expect(context.renderQuestion).toHaveBeenCalledWith(QUESTION_POOL[0], 0, {
      answers: { q1: { value: 'Yes' } },
    });
    expect(context.renderLockedQuestionsPanel).toHaveBeenCalledWith({
      hiddenMaskedQuestionIds: [],
      lockedGateDetails: [{ id: 'gate' }],
    });
    expect(element.props.topStripProps).toEqual(
      expect.objectContaining({
        onDecryptEdit: context.handleDecryptEdit,
        onExitEditing: context.handleExitEditing,
        onStartFresh: context.handleStartFresh,
        onToggleDisplayAnswerMode: context.toggleDisplayAnswerMode,
      }),
    );
    expect(element.props.submitFooterProps).toEqual(
      expect.objectContaining({
        onPrimarySubmitClick: context.handlePrimarySubmitClick,
        onRevertPendingChanges: context.handleRevertPendingChanges,
        pendingEditCount: 2,
        submitButtonText: 'Submit 2 Responses',
      }),
    );
    expect(element.props.authoringPanelProps).toEqual(
      expect.objectContaining({
        lockedQuestionsBanner: 'locked-panel',
        onScrollToTop: context.handleScrollToTop,
        onShowJsonAtBottom: context.handleShowJsonAtBottom,
        renderedEditableQuestions: ['editable-question'],
      }),
    );
    expect(context.buildSurveyQuestionsRouteJsonControlsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        copyJsonToClipboard: context.copyJsonToClipboard,
        onToggleQuestionsJson: context.toggleShowQuestionsJson,
        onToggleResponseJson: context.toggleShowResponseJson,
        onToggleSurveyJson: context.toggleShowSurveyJson,
        questionsJson: { questions: true },
        responseJson: { response: true },
        surveyJson: { survey: true },
      }),
    );
    expect(element.props.jsonControlsProps).toEqual(expect.objectContaining({ built: true }));
    expect(element.props.tagModalProps.onClose).toBe(context.closeQuestionTagModal);
  });
});
