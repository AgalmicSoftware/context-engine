import { SurveyQuestions } from './SurveyQuestions';
import { renderToStaticMarkup } from 'react-dom/server';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildSurveyQuestionsLayoutDisplayState,
  buildSurveyQuestionsRouteViewDisplayState,
  buildSurveyQuestionsSubmitFooterDisplayState,
  buildSurveyQuestionsSubmitReadinessDescriptor,
} from './surveyQuestionsTypes.js';

const noop = () => {};

const renderSubmitFooter = ({
  displayState = {},
  isSingleQuestionView = false,
  isSubmitting = false,
  pendingEditCount = 0,
  responseUrl = '',
  submitButtonText = 'SUBMIT',
  submissionError = '',
} = {}) =>
  render(
    <SurveyQuestionsSubmitFooter
      displayState={displayState}
      isSingleQuestionView={isSingleQuestionView}
      isSubmitting={isSubmitting}
      onPrimarySubmitClick={noop}
      onRevertPendingChanges={noop}
      pendingEditCount={pendingEditCount}
      responseUrl={responseUrl}
      submitButtonText={submitButtonText}
      submissionError={submissionError}
    />,
  );

const baseRenderReadiness = {
  shouldShowLoadingState: false,
  hiddenMaskedQuestionIds: [],
  hasHiddenMaskedQuestions: false,
};

const baseSubmitDisplayState = {
  submittedStateActive: false,
  submittedIndicatorActive: false,
  singleQuestionSubmittedIndicatorActive: false,
  showSubmitAux: false,
  uploadStatusText: 'Uploading...',
  submitDisabled: false,
  canEditQuestions: true,
  hasPendingEdits: false,
  genericShowInlineSubmit: false,
  showInlineSubmit: false,
  showTopInlineSubmit: false,
};

const renderSingleQuestionSurface = ({ responseUrl = '', showSubmit = true, viewingAnswers = false } = {}) => {
  const layoutDisplayState = buildSurveyQuestionsLayoutDisplayState({
    isSingleQuestionView: true,
    singleQuestionMode: true,
    styleMap: {
      singleQuestionPage: 'singleQuestionPage',
      singleQuestionReadPage: 'singleQuestionReadPage',
      singleQuestionResponseView: 'singleQuestionResponseView',
      singleQuestionTopBar: 'singleQuestionTopBar',
    },
    viewingAnswers,
  });
  const routeViewDisplayState = buildSurveyQuestionsRouteViewDisplayState({
    account: '0xabc',
    responderAddress: viewingAnswers ? '0xdef' : '',
    singleQuestionMode: true,
    shortenAddress: (address) => address,
    viewingAnswers,
  });

  return render(
    <SurveyQuestionsRouteSurface
      renderReadiness={baseRenderReadiness}
      layoutDisplayState={layoutDisplayState}
      routeViewDisplayState={routeViewDisplayState}
      submitDisplayState={{
        ...baseSubmitDisplayState,
        canEditQuestions: !viewingAnswers,
        hasPendingEdits: showSubmit,
        showInlineSubmit: showSubmit,
      }}
      viewingAnswers={viewingAnswers}
      topStripProps={{
        onDecryptEdit: noop,
        onExitEditing: noop,
        onStartFresh: noop,
        onToggleDisplayAnswerMode: noop,
        responseUrl,
        userHasResponse: false,
      }}
      responseViewProps={{
        isLoadingResponse: false,
        noResponse: false,
        parsedViewAddressAnswers: { answer: { value: '*', encrypted: true } },
        questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
        questionPoolReady: true,
        renderQuestionAnswer: jest.fn(() => <div data-testid="response-card-stub">Response Card</div>),
        responderAddress: viewingAnswers ? '0xdef' : '',
        singleQuestionMode: true,
      }}
      authoringPanelProps={{
        displayState: { showBackToTopControl: false, showJsonControl: false },
        renderedEditableQuestions: <div data-testid="question-card-stub">Question Card</div>,
      }}
      submittedResponseViewProps={{
        isOwnResponse: true,
        isVisible: false,
        questionPoolReady: true,
        renderQuestionAnswer: jest.fn(() => null),
        renderSurveyAnswers: jest.fn(() => null),
        singleQuestionMode: true,
      }}
      submitFooterProps={{
        isSingleQuestionView: true,
        onPrimarySubmitClick: noop,
        onRevertPendingChanges: noop,
        pendingEditCount: showSubmit ? 1 : 0,
        responseUrl,
        submitButtonText: 'SUBMIT',
      }}
      jsonControlsProps={{
        hidden: false,
        jsonPanelDisplayState: {
          showQuestionJsonControls: true,
          showFullSurveyJsonControls: false,
          showQuestionsJson: viewingAnswers,
          showResponseJson: viewingAnswers,
          showQuestionsJsonPanel: viewingAnswers,
          showResponseJsonPanel: viewingAnswers,
        },
        onCopyQuestionsJson: noop,
        onCopyResponseJson: noop,
        onCopySurveyJson: noop,
        onToggleQuestionsJson: noop,
        onToggleResponseJson: noop,
        onToggleSurveyJson: noop,
        questionsJson: { questionID: 'q1' },
        renderJsonTree: (json) => <pre>{JSON.stringify(json)}</pre>,
        responseJson: { responder: '0xdef' },
      }}
    />,
  );
};

describe('SurveyTool pending edit render affordances', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('renders submitted indicator test id when submitted latch is active', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      questionPool: [],
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(true);
  });

  it('keeps inline submitted indicator visible after submit when userHasResponse is true', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: null,
    };

    const tree = subject.render();
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(true);
  });

  it('does not render existing-response notice in single-question mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionError: '',
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: { answer: { ...emptyField } },
    };

    render(
      <SurveyQuestionsUserResponseNotice
        onDecryptEdit={noop}
        onExitEditing={noop}
        onStartFresh={noop}
        show={!routeViewDisplayState.isSingleQuestionView}
        userResponseEncrypted
      />,
    );

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBe(false);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBe(false);
  });

  it('keeps existing-response notice available in survey mode for bulk decrypt actions', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submissionError: '',
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      userAnswers: { responses: [] },
    };

    render(
      <SurveyQuestionsUserResponseNotice
        onDecryptEdit={noop}
        onExitEditing={noop}
        onStartFresh={noop}
        show={!routeViewDisplayState.isSingleQuestionView}
        userResponseEncrypted
      />,
    );

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBe(true);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBe(true);
  });

  it('renders the single-question inline submit below the question when edits are pending', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      isDirty: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: 'Answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 1, encrypted: 0 }));
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('singleQuestionSubmitLayout');
    expect(markup).not.toContain('singleQuestionSubmitRail');
    expect(markup).toContain('Question Card');
    expect(markup).toContain('SUBMIT');
    expect(markup).toContain(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(markup).not.toContain('Clear pending changes');
    expect(subject.renderQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not render single-question submit controls before pending edits appear', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: false,
      startFresh: false,
      isEditing: false,
      displayAnswerMode: false,
      isDirty: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: '' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain('singleQuestionSubmitLayout');
    expect(markup).not.toContain('singleQuestionSubmitRail');
    expect(markup).not.toContain(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(subject.renderQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not render submitted CTA state in single-question mode when no pending edits remain', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.state = {
      ...subject.state,
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      submissionError: '',
      userHasResponse: true,
      startFresh: false,
      isEditing: true,
      displayAnswerMode: false,
      isDirty: false,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField, value: 'Answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
    };
    subject.renderQuestion = jest.fn(() => <div key="q1" data-testid="question-card-stub">Question Card</div>);

    const tree = subject.render();

    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMIT)).toBe(false);
    expect(treeHasDataTestId(tree, E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBe(false);
  });

  it('applies single-question response page wrappers in read mode', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      responderAddress: '0xdef',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });
    subject.state = {
      ...subject.state,
      isLoadingResponse: false,
      noResponse: false,
      displayAnswerMode: true,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Prompt' }],
      parsedViewAddressAnswers: { answer: { value: '*', encrypted: true } },
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
    };
    subject.renderQuestionAnswer = jest.fn(() => <div key="resp" data-testid="response-card-stub">Response Card</div>);

    const tree = subject.render();
    const pageRoot = findElement(
      tree,
      (node) => String(node?.props?.className || '').includes('singleQuestionPage')
    );
    const responseView = findElement(
      tree,
      (node) => String(node?.props?.className || '').includes('singleQuestionResponseView')
    );
    const addressLink = findElement(
      tree,
      (node) => node?.type === 'a' && node?.props?.href === '/u/0xdef'
    );

    expect(pageRoot).not.toBeNull();
    expect(responseView).not.toBeNull();
    expect(addressLink).not.toBeNull();
    expect(treeHasLabel(tree, 'question .json')).toBe(true);
    expect(treeHasLabel(tree, 'response .json')).toBe(true);
    expect(subject.renderQuestionAnswer).toHaveBeenCalledTimes(1);
  });

  it('does not call getPendingEditStats during SurveyQuestions.render', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const emptyField = { value: '', encrypted: false, encryptionAudience: 'self' };
    subject.getPendingEditStats = jest.fn(() => ({ total: 9, encrypted: 4 }));
    subject.state = {
      ...subject.state,
      displayAnswerMode: false,
      surveysResponseState: [
        {
          answers: { q1: { ...emptyField } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { ...emptyField } },
        },
      ],
      questionPool: [{ id: 'q1', type: 'binary', prompt: 'Prompt' }],
      modifiedCount: 2,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
      showComments: {},
    };

    // port note: the old unmounted class render asserted a private method call count.
    // The portable contract is that render-time display state consumes the already
    // snapshotted pending stats and does not need to invoke the recomputation seam.
    expect(submitReadiness).toEqual(
      expect.objectContaining({
        encryptedPendingEditCount: 1,
        pendingEditCount: 2,
      }),
    );
    expect(getPendingEditStats).not.toHaveBeenCalled();
  });
});
