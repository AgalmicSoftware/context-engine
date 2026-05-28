import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import { buildSurveyQuestionsFullQuestionResponseInputDescriptor } from './surveyQuestionsFullQuestionResponseInputState';

describe('SurveyQuestionsFullQuestionResponseInput', () => {
  it('builds pure response input descriptors for supported question types', () => {
    expect(buildSurveyQuestionsFullQuestionResponseInputDescriptor({
      question: { id: 'q1', type: 'multichoice', options: ['A', 'B'] },
      answer: { value: ['A'] },
      isSubmitting: true,
    })).toEqual({
      kind: 'multichoice',
      questionId: 'q1',
      options: ['A', 'B'],
      selectedValues: ['A'],
      isSingleSelect: false,
      disabled: true,
    });

    expect(buildSurveyQuestionsFullQuestionResponseInputDescriptor({
      question: { id: 'q2', type: 'rating' },
      answer: { value: '7' },
      singleQuestionMode: true,
    })).toEqual({
      kind: 'rating',
      ratingValue: 7,
      disabled: false,
      useDeferredRating: true,
    });

    expect(buildSurveyQuestionsFullQuestionResponseInputDescriptor({
      question: { id: ' Q3 ', type: 'freeform' },
      qIndex: 4,
      answer: { value: { ignored: true }, encrypted: true },
      glowAnswer: true,
    })).toEqual({
      kind: 'audio',
      qIndex: 4,
      value: '',
      encrypted: true,
      dataTestId: E2E_TESTIDS.SURVEY_ANSWER_INPUT,
      dataCeQuestionId: 'q3',
      disabled: false,
      forceGlow: true,
      placeholder: 'response (optional)',
      disableEncryption: true,
    });
  });

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
