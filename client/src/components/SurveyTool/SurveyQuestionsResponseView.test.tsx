import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsResponseView from './SurveyQuestionsResponseView';

describe('SurveyQuestionsResponseView', () => {
  const renderQuestionAnswer = jest.fn(() => <div data-testid="single-answer">single answer</div>);
  const renderSurveyAnswers = jest.fn(() => <div data-testid="survey-answers">survey answers</div>);

  beforeEach(() => {
    renderQuestionAnswer.mockClear();
    renderSurveyAnswers.mockClear();
  });

  it('renders the response loading state without rendering answers', () => {
    render(
      <SurveyQuestionsResponseView
        isLoadingResponse
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
      />,
    );

    expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument();
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('renders no-response warnings and fallback address text', () => {
    const { rerender } = render(
      <SurveyQuestionsResponseView
        noResponse
        responseLookupWarning="Lookup warning"
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
      />,
    );

    expect(screen.getByText('Lookup warning')).toBeInTheDocument();

    rerender(
      <SurveyQuestionsResponseView
        noResponse
        singleQuestionMode
        viewAddress="0xabc"
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
      />,
    );

    expect(
      screen.getAllByText((_, element) => element?.textContent === 'No response for this question from address: 0xabc'),
    ).not.toHaveLength(0);
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('renders single-question answers with the existing answer callback contract', () => {
    const question = { id: 'q1', prompt: 'Question?' };
    const parsedViewAddressAnswers = { q1: 'viewed answer' };

    render(
      <SurveyQuestionsResponseView
        parsedViewAddressAnswers={parsedViewAddressAnswers}
        questionPool={[question]}
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        shortenedViewAddress="0xabc...1234"
        singleQuestionMode
      />,
    );

    expect(screen.getByRole('link', { name: '0xabc...1234' })).toHaveAttribute('href', '/u/0xabc1234');
    expect(screen.getByText('Response:')).toBeInTheDocument();
    expect(screen.getByTestId('single-answer')).toBeInTheDocument();
    expect(renderQuestionAnswer).toHaveBeenCalledWith(question, parsedViewAddressAnswers, 0, undefined);
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });

  it('renders full-survey answers from own responses with the existing callback contract', () => {
    const responses = [{ questionID: 'q1', answer: 'yes' }];

    render(
      <SurveyQuestionsResponseView
        isOwnResponse
        questionPool={[{ id: 'q1' }]}
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        userAnswers={{ responses }}
      />,
    );

    expect(screen.getByTestId('survey-answers')).toBeInTheDocument();
    expect(renderSurveyAnswers).toHaveBeenCalledWith(responses, true);
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
  });

  it('preserves the answer-data loading fallback when response data is not ready', () => {
    render(
      <SurveyQuestionsResponseView
        questionPool={[{ id: 'q1' }]}
        questionPoolReady
        renderQuestionAnswer={renderQuestionAnswer}
        renderSurveyAnswers={renderSurveyAnswers}
        singleQuestionMode
      />,
    );

    expect(screen.getByText(/Loading answer data\.\.\./)).toBeInTheDocument();
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
    expect(renderSurveyAnswers).not.toHaveBeenCalled();
  });
});
