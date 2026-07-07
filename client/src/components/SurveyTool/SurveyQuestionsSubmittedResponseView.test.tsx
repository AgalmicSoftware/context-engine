import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsSubmittedResponseView from './SurveyQuestionsSubmittedResponseView';

describe('SurveyQuestionsSubmittedResponseView', () => {
  const renderQuestionAnswer = jest.fn(() => <div data-testid="single-submitted">single submitted</div>);
  const renderSurveyAnswers = jest.fn(() => <div data-testid="survey-submitted">survey submitted</div>);

  beforeEach(() => {
    renderQuestionAnswer.mockClear();
    renderSurveyAnswers.mockClear();
  });

  it('renders nothing while hidden', () => {
    const { container } = render(
      <SurveyQuestionsSubmittedResponseView
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('renders the submitted-response loading fallback until answers are ready', () => {
    render(
      <SurveyQuestionsSubmittedResponseView
        isVisible
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
      />,
    );

    expect(screen.getByText(/Loading submitted response\.\.\./)).toBeInTheDocument();
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('renders a single submitted question through the existing answer callback contract', () => {
    const question = { id: 'q1', prompt: 'Question?' };
    const userAnswers = { value: 'yes' };

    render(
      <SurveyQuestionsSubmittedResponseView
        isOwnResponse
        isVisible
        questionPool={[question]}
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        singleQuestionMode
        userAnswers={userAnswers}
      />,
    );

    expect(screen.getByTestId('single-submitted')).toBeInTheDocument();
    expect(renderQuestionAnswer).toHaveBeenCalledWith(question, userAnswers, 0, true);
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('preserves single-question and survey answer loading fallbacks', () => {
    const { rerender } = render(
      <SurveyQuestionsSubmittedResponseView
        isVisible
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        singleQuestionMode
        userAnswers={{ value: 'yes' }}
      />,
    );

    expect(screen.getByText('Loading question...')).toBeInTheDocument();

    rerender(
      <SurveyQuestionsSubmittedResponseView
        isVisible
        questionPool={[{ id: 'q1' }]}
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        userAnswers={{}}
      />,
    );

    expect(screen.getByText('Loading answers...')).toBeInTheDocument();
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('renders submitted survey answers through the existing answer callback contract', () => {
    const responses = [{ questionID: 'q1', answer: 'yes' }];

    render(
      <SurveyQuestionsSubmittedResponseView
        isVisible
        questionPool={[{ id: 'q1' }]}
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        userAnswers={{ responses }}
      />,
    );

    expect(screen.getByTestId('survey-submitted')).toBeInTheDocument();
    expect(renderSurveyAnswers).toHaveBeenCalledWith(responses, undefined);
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
  });
});
