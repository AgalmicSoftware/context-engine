import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsRouteSurface from './SurveyQuestionsRouteSurface';
import { buildSurveyQuestionsFullLoadingProgressState } from './surveyQuestionsTypes.js';

const loadingProgressState = buildSurveyQuestionsFullLoadingProgressState();

const baseRenderReadiness = {
  shouldShowLoadingState: false,
  hiddenMaskedQuestionIds: [],
  hasHiddenMaskedQuestions: false,
};

const baseLayoutDisplayState = {
  activeTagModalTag: '',
  responseViewClassName: 'response-view',
  surveyPageClassName: 'survey-page',
  topSectionClassName: 'top-strip',
  useTagModal: false,
};

const baseRouteViewDisplayState = {
  viewedAddressRaw: '',
  viewedAddressLower: '',
  shortenedViewAddress: '',
  isOwnResponse: true,
  isSingleQuestionView: false,
  showViewAnswersButton: false,
  viewAnswersButtonText: '',
};

const baseSubmitDisplayState = {
  submittedStateActive: false,
  submittedIndicatorActive: false,
  singleQuestionSubmittedIndicatorActive: false,
  showSubmitAux: false,
  uploadStatusText: '',
  submitDisabled: false,
  canEditQuestions: true,
  hasPendingEdits: true,
  genericShowInlineSubmit: true,
  showInlineSubmit: true,
  showTopInlineSubmit: false,
};

const renderSurface = (overrides = {}) => {
  const onPrimarySubmitClick = jest.fn();
  const onToggleSurveyJson = jest.fn();
  const onCopySurveyJson = jest.fn();
  const onToggleDisplayAnswerMode = jest.fn();
  const renderJsonTree = jest.fn((json) => <pre data-testid="json-tree">{JSON.stringify(json)}</pre>);
  const renderSurveyAnswers = jest.fn(() => <div data-testid="survey-answers">Survey answers</div>);

  const result = render(
    <SurveyQuestionsRouteSurface
      renderReadiness={baseRenderReadiness}
      loadingProgressState={loadingProgressState}
      layoutDisplayState={baseLayoutDisplayState}
      routeViewDisplayState={baseRouteViewDisplayState}
      submitDisplayState={baseSubmitDisplayState}
      topStripProps={{ onToggleDisplayAnswerMode }}
      responseViewProps={{
        questionPoolReady: true,
        renderQuestionAnswer: jest.fn(() => null),
        renderSurveyAnswers,
        singleQuestionMode: false,
        userAnswers: { responses: [{ questionID: 'q1', answer: 'Yes' }] },
      }}
      authoringPanelProps={{
        displayState: { showJsonControl: true },
        renderedEditableQuestions: <div data-testid="editable-question">Question</div>,
      }}
      submittedResponseViewProps={{
        isOwnResponse: true,
        isVisible: false,
        questionPoolReady: true,
        renderQuestionAnswer: jest.fn(() => null),
        renderSurveyAnswers,
        singleQuestionMode: false,
        userAnswers: { responses: [] },
      }}
      submitFooterProps={{
        onPrimarySubmitClick,
        onRevertPendingChanges: jest.fn(),
        pendingEditCount: 1,
        submitButtonText: 'Submit Response',
      }}
      jsonControlsProps={{
        jsonPanelDisplayState: {
          showFullSurveyJsonControls: true,
          showSurveyJson: true,
          showSurveyJsonPanel: true,
        },
        onCopyQuestionsJson: jest.fn(),
        onCopyResponseJson: jest.fn(),
        onCopySurveyJson,
        onToggleQuestionsJson: jest.fn(),
        onToggleResponseJson: jest.fn(),
        onToggleSurveyJson,
        renderJsonTree,
        surveyJson: { id: 'survey-1' },
      }}
      {...overrides}
    />,
  );

  return {
    ...result,
    onCopySurveyJson,
    onPrimarySubmitClick,
    onToggleDisplayAnswerMode,
    onToggleSurveyJson,
    renderJsonTree,
    renderSurveyAnswers,
  };
};

describe('SurveyQuestionsRouteSurface', () => {
  it('renders only the loading state while render readiness is loading', () => {
    renderSurface({
      renderReadiness: {
        ...baseRenderReadiness,
        shouldShowLoadingState: true,
      },
    });

    expect(screen.getByText('Loading questions...')).toBeInTheDocument();
    expect(screen.queryByTestId('editable-question')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Response' })).not.toBeInTheDocument();
  });

  it('renders the authoring route with submit and JSON callbacks wired through', () => {
    const { onCopySurveyJson, onPrimarySubmitClick, onToggleSurveyJson, renderJsonTree } = renderSurface();

    expect(screen.getByTestId('editable-question')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Survey .json' }));
    fireEvent.click(screen.getByTitle('Copy Survey Definition JSON'));

    expect(onPrimarySubmitClick).toHaveBeenCalledTimes(1);
    expect(onToggleSurveyJson).toHaveBeenCalledTimes(1);
    expect(onCopySurveyJson).toHaveBeenCalledTimes(1);
    expect(renderJsonTree).toHaveBeenCalledWith({ id: 'survey-1' });
  });

  it('renders the viewed-answer route from parent-provided answer renderers', () => {
    const { renderSurveyAnswers } = renderSurface({
      viewingAnswers: true,
    });

    expect(screen.getByTestId('survey-answers')).toBeInTheDocument();
    expect(screen.queryByTestId('editable-question')).not.toBeInTheDocument();
    expect(renderSurveyAnswers).toHaveBeenCalledWith([{ questionID: 'q1', answer: 'Yes' }], true);
  });
});
