import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsSurveyAnswersView from './SurveyQuestionsSurveyAnswersView';

describe('SurveyQuestionsSurveyAnswersView', () => {
  const onWarning = jest.fn();
  const renderQuestionAnswer = jest.fn((question) => (
    <div key={question.id} data-testid={`answer-${question.id}`}>
      {question.prompt}
    </div>
  ));

  beforeEach(() => {
    onWarning.mockClear();
    renderQuestionAnswer.mockClear();
  });

  it('renders the loading fallback when questions or responses are not ready', () => {
    render(<SurveyQuestionsSurveyAnswersView onWarning={onWarning} renderQuestionAnswer={renderQuestionAnswer} />);

    expect(screen.getByText('Loading answers...')).toBeInTheDocument();
    expect(onWarning).toHaveBeenCalledWith(
      'renderSurveyAnswers: questionPool or responses not ready.',
      undefined,
      undefined,
    );
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
  });

  it('renders matched responses through the existing question-answer callback contract', () => {
    const question = { id: 'q1', prompt: 'Question one' };
    const response = { questionID: 'q1', answer: 'yes' };

    render(
      <SurveyQuestionsSurveyAnswersView
        isOwnResponse
        onWarning={onWarning}
        questionPool={[question]}
        renderQuestionAnswer={renderQuestionAnswer}
        responses={[response]}
      />,
    );

    expect(screen.getByTestId('answer-q1')).toHaveTextContent('Question one');
    expect(renderQuestionAnswer).toHaveBeenCalledWith(question, response, 0, true);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('preserves invalid question, invalid response, and missing question warnings', () => {
    render(
      <SurveyQuestionsSurveyAnswersView
        onWarning={onWarning}
        questionPool={[null, { id: 'q1', prompt: 'Question one' }]}
        renderQuestionAnswer={renderQuestionAnswer}
        responses={[
          null,
          { questionID: '', answer: 'empty id' },
          { questionID: 'missing', answer: 'missing question' },
        ]}
      />,
    );

    expect(onWarning).toHaveBeenCalledWith('Invalid question object found in questionPool:', null);
    expect(onWarning).toHaveBeenCalledWith('Invalid response object at index:', 0, null);
    expect(onWarning).toHaveBeenCalledWith('Invalid response object at index:', 1, {
      questionID: '',
      answer: 'empty id',
    });
    expect(onWarning).toHaveBeenCalledWith('Question not found in pool for response ID: missing');
    expect(renderQuestionAnswer).not.toHaveBeenCalled();
  });
});
