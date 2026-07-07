import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsRouteBodySection from './SurveyQuestionsRouteBodySection';

describe('SurveyQuestionsRouteBodySection', () => {
  it('renders the response route when viewing answers', () => {
    const renderSurveyAnswers = jest.fn(() => <div data-testid="survey-answers">Survey answers</div>);

    render(
      <SurveyQuestionsRouteBodySection
        viewingAnswers
        responseViewProps={{
          questionPoolReady: true,
          renderSurveyAnswers,
          userAnswers: { responses: [{ questionID: 'q1', answer: 'Yes' }] },
        }}
        routeViewDisplayState={{ isOwnResponse: true }}
      />,
    );

    expect(screen.getByTestId('survey-answers')).toBeInTheDocument();
    expect(renderSurveyAnswers).toHaveBeenCalledWith([{ questionID: 'q1', answer: 'Yes' }], true);
  });

  it('renders the authoring route when not viewing answers', () => {
    render(
      <SurveyQuestionsRouteBodySection
        authoringPanelProps={{
          renderedEditableQuestions: <div data-testid="editable-question">Question</div>,
        }}
      />,
    );

    expect(screen.getByTestId('editable-question')).toBeInTheDocument();
    expect(screen.queryByText('Survey answers')).not.toBeInTheDocument();
  });
});
