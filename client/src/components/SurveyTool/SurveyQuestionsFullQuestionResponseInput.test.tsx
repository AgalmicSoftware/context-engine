import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';

describe('SurveyQuestionsFullQuestionResponseInput', () => {
  it('renders multichoice input and forwards selected values', () => {
    const onAnswerChange = jest.fn();
    render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: 'q1',
          type: 'multichoice',
          options: ['Alpha', 'Beta'],
        }}
        qIndex={0}
        answer={{ value: ['Alpha'] }}
        onAnswerChange={onAnswerChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Beta'));

    expect(onAnswerChange).toHaveBeenCalledWith(['Alpha', 'Beta']);
  });

  it('renders binary input and forwards the selected option', () => {
    const onAnswerChange = jest.fn();
    render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: 'q1',
          type: 'binary',
        }}
        qIndex={0}
        answer={{ value: 'Unsure' }}
        onAnswerChange={onAnswerChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Agree'));

    expect(onAnswerChange).toHaveBeenCalledWith('Agree');
  });
});
