import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsAuthoringRouteSection from './SurveyQuestionsAuthoringRouteSection';

describe('SurveyQuestionsAuthoringRouteSection', () => {
  it('renders editable questions and forwards submit/footer callbacks', () => {
    const onPrimarySubmitClick = jest.fn();
    const onRevertPendingChanges = jest.fn();

    render(
      <SurveyQuestionsAuthoringRouteSection
        authoringPanelProps={{
          renderedEditableQuestions: <div data-testid="editable-question">Question</div>,
        }}
        submitDisplayState={{
          showInlineSubmit: true,
          showSubmitAux: true,
        }}
        submitFooterProps={{
          onPrimarySubmitClick,
          onRevertPendingChanges,
          pendingEditCount: 1,
          submitButtonText: 'Submit Response',
        }}
      />,
    );

    expect(screen.getByTestId('editable-question')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT));
    fireEvent.click(screen.getByRole('button', { name: 'Clear pending changes' }));

    expect(onPrimarySubmitClick).toHaveBeenCalledTimes(1);
    expect(onRevertPendingChanges).toHaveBeenCalledTimes(1);
  });

  it('renders the submitted response slot from parent-provided answer renderers', () => {
    const renderSurveyAnswers = jest.fn(() => <div data-testid="submitted-answers">Submitted answers</div>);

    render(
      <SurveyQuestionsAuthoringRouteSection
        submittedResponseViewProps={{
          isOwnResponse: true,
          isVisible: true,
          questionPoolReady: true,
          renderSurveyAnswers,
          userAnswers: { responses: [{ questionID: 'q1', answer: 'Yes' }] },
        }}
      />,
    );

    expect(screen.getByTestId('submitted-answers')).toBeInTheDocument();
    expect(renderSurveyAnswers).toHaveBeenCalledWith([{ questionID: 'q1', answer: 'Yes' }], true);
  });
});
