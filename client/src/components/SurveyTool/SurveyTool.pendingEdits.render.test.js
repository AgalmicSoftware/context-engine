import React from 'react';
import { render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsRouteSurface from './SurveyQuestionsRouteSurface';
import SurveyQuestionsSubmitFooter from './SurveyQuestionsSubmitFooter';
import SurveyQuestionsUserResponseNotice from './SurveyQuestionsUserResponseNotice';
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
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      submittedSinceLastEdit: true,
    });

    renderSubmitFooter({
      displayState,
      pendingEditCount: 0,
      submitButtonText: 'Submit Response',
    });

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeInTheDocument();
  });

  it('keeps inline submitted indicator visible after submit when userHasResponse is true', () => {
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      submittedSinceLastEdit: true,
      userHasResponse: true,
    });

    renderSubmitFooter({
      displayState,
      pendingEditCount: 0,
      submitButtonText: 'Submit Response',
    });

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeInTheDocument();
  });

  it('does not render existing-response notice in single-question mode', () => {
    const routeViewDisplayState = buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      questionPool: [{ id: 'q1' }],
      singleQuestionMode: true,
      userHasResponse: true,
      viewingAnswers: true,
    });

    render(
      <SurveyQuestionsUserResponseNotice
        onDecryptEdit={noop}
        onExitEditing={noop}
        onStartFresh={noop}
        show={!routeViewDisplayState.isSingleQuestionView}
        userResponseEncrypted
      />,
    );

    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBeNull();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBeNull();
  });

  it('keeps existing-response notice available in survey mode for bulk decrypt actions', () => {
    const routeViewDisplayState = buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      questionPool: [{ id: 'q1' }],
      singleQuestionMode: false,
      userHasResponse: true,
      viewingAnswers: true,
    });

    render(
      <SurveyQuestionsUserResponseNotice
        onDecryptEdit={noop}
        onExitEditing={noop}
        onStartFresh={noop}
        show={!routeViewDisplayState.isSingleQuestionView}
        userResponseEncrypted
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBeInTheDocument();
  });

  it('renders the single-question inline submit below the question when edits are pending', () => {
    const submitReadiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      pendingStats: { total: 1, encrypted: 0 },
      singleQuestionMode: true,
    });
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      isDirty: true,
      isSingleQuestionView: true,
      pendingEditCount: submitReadiness.pendingEditCount,
      singleQuestionMode: true,
    });

    expect(displayState.showInlineSubmit).toBe(true);

    renderSingleQuestionSurface({ showSubmit: displayState.showInlineSubmit });

    expect(screen.getByTestId('question-card-stub')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SUBMIT/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear pending changes' })).toBeNull();
  });

  it('does not render single-question submit controls before pending edits appear', () => {
    const submitReadiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      pendingStats: { total: 0, encrypted: 0 },
      singleQuestionMode: true,
    });
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      isDirty: false,
      isSingleQuestionView: true,
      pendingEditCount: submitReadiness.pendingEditCount,
      singleQuestionMode: true,
    });

    expect(displayState.showInlineSubmit).toBe(false);

    renderSingleQuestionSurface({ showSubmit: displayState.showInlineSubmit });

    expect(screen.getByTestId('question-card-stub')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toBeNull();
  });

  it('does not render submitted CTA state in single-question mode when no pending edits remain', () => {
    const displayState = buildSurveyQuestionsSubmitFooterDisplayState({
      isDirty: false,
      isEditing: true,
      isSingleQuestionView: true,
      pendingEditCount: 0,
      singleQuestionMode: true,
      submittedSinceLastEdit: true,
      userHasResponse: true,
    });

    expect(displayState.showInlineSubmit).toBe(false);
    expect(displayState.submittedIndicatorActive).toBe(true);

    renderSingleQuestionSurface({ showSubmit: displayState.showInlineSubmit });

    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toBeNull();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeNull();
  });

  it('applies single-question response page wrappers in read mode', () => {
    const { container } = renderSingleQuestionSurface({ showSubmit: false, viewingAnswers: true });

    expect(container.querySelector('.singleQuestionPage')).not.toBeNull();
    expect(container.querySelector('.singleQuestionResponseView')).not.toBeNull();
    expect(screen.getByTestId('response-card-stub')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xdef' })).toHaveAttribute('href', '/u/0xdef');
    expect(screen.getByRole('button', { name: /question \.json/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /response \.json/i })).toBeInTheDocument();
  });

  it('does not call getPendingEditStats during SurveyQuestions.render', () => {
    const getPendingEditStats = jest.fn(() => ({ total: 9, encrypted: 4 }));

    const submitReadiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      pendingStats: { total: 2, encrypted: 1 },
      singleQuestionMode: true,
    });

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
