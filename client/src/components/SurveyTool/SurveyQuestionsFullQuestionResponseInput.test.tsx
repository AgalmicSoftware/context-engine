import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import { buildSurveyQuestionsFullQuestionResponseInputDescriptor } from './surveyQuestionsFullQuestionResponseInputState';

describe('SurveyQuestionsFullQuestionResponseInput', () => {
  it('builds pure response input descriptors for supported question types', () => {
    expect(
      buildSurveyQuestionsFullQuestionResponseInputDescriptor({
        question: { id: 'q1', type: 'multichoice', options: ['A', 'B'] },
        answer: { value: ['A'] },
        isSubmitting: true,
      }),
    ).toEqual({
      kind: 'multichoice',
      questionId: 'q1',
      options: ['A', 'B'],
      selectedValues: ['A'],
      isSingleSelect: false,
      disabled: true,
    });

    expect(
      buildSurveyQuestionsFullQuestionResponseInputDescriptor({
        question: { id: 'q2', type: 'rating' },
        answer: { value: '7' },
        singleQuestionMode: true,
      }),
    ).toEqual({
      kind: 'rating',
      ratingValue: 7,
      disabled: false,
      useDeferredRating: true,
    });

    expect(
      buildSurveyQuestionsFullQuestionResponseInputDescriptor({
        question: { id: ' Q3 ', type: 'freeform' },
        qIndex: 4,
        answer: { value: { ignored: true }, encrypted: true },
        glowAnswer: true,
      }),
    ).toEqual({
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
      />,
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
      />,
    );

    fireEvent.click(screen.getByLabelText('Agree'));

    expect(onAnswerChange).toHaveBeenCalledWith('Agree');
  });

  it('buffers full-question rating drag ticks locally and commits the final value once', () => {
    const onDeferredRatingCommit = jest.fn();
    const onRatingChange = jest.fn();
    const onRatingChangeComplete = jest.fn();
    render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: 'q1',
          type: 'rating',
        }}
        qIndex={0}
        answer={{ value: '5' }}
        onDeferredRatingCommit={onDeferredRatingCommit}
        onRatingChange={onRatingChange}
        onRatingChangeComplete={onRatingChangeComplete}
      />,
    );

    const slider = screen.getByRole('slider');
    expect(screen.getByText('5')).toBeInTheDocument();

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '6' } });
    fireEvent.change(slider, { target: { value: '7' } });
    fireEvent.change(slider, { target: { value: '8' } });

    expect(screen.getByText('8')).toBeInTheDocument();
    expect(onDeferredRatingCommit).not.toHaveBeenCalled();
    expect(onRatingChange).not.toHaveBeenCalled();
    expect(onRatingChangeComplete).not.toHaveBeenCalled();

    fireEvent.mouseUp(slider, { currentTarget: { value: '8' } });

    expect(onDeferredRatingCommit).toHaveBeenCalledTimes(1);
    expect(onDeferredRatingCommit).toHaveBeenCalledWith(8);
    expect(onRatingChange).not.toHaveBeenCalled();
    expect(onRatingChangeComplete).not.toHaveBeenCalled();
  });

  it('routes single-question rating changes through deferred commits', () => {
    const onDeferredRatingCommit = jest.fn();
    const onRatingChange = jest.fn();
    const onRatingChangeComplete = jest.fn();
    render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: 'q1',
          type: 'rating',
        }}
        qIndex={0}
        answer={{ value: 4 }}
        singleQuestionMode
        onDeferredRatingCommit={onDeferredRatingCommit}
        onRatingChange={onRatingChange}
        onRatingChangeComplete={onRatingChangeComplete}
      />,
    );

    const slider = screen.getByRole('slider');

    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: '7' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '7' } });

    expect(onDeferredRatingCommit).toHaveBeenCalledWith(7);
    expect(onRatingChange).not.toHaveBeenCalled();
    expect(onRatingChangeComplete).not.toHaveBeenCalled();
  });

  it('renders default answer input props and preserves handler wiring', () => {
    const onAnswerChange = jest.fn();
    const onToggleAnswerEncryption = jest.fn();
    const { rerender } = render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: ' Q Freeform ',
          type: 'freeform',
        }}
        qIndex={2}
        answer={{ value: { unexpected: true }, encrypted: true }}
        glowAnswer
        onAnswerChange={onAnswerChange}
        onToggleAnswerEncryption={onToggleAnswerEncryption}
      />,
    );

    const input = screen.getByTestId('mock-survey-audio-field-input');
    expect(input).toHaveAttribute('data-ce-question-id', 'q freeform');
    expect(input).toHaveAttribute('data-disabled', 'false');
    expect(input).toHaveAttribute('data-encrypted', 'true');
    expect(input).toHaveAttribute('data-force-glow', 'true');
    expect(input).toHaveAttribute('data-input-testid', E2E_TESTIDS.SURVEY_ANSWER_INPUT);
    expect(input).toHaveAttribute('data-value', '');

    fireEvent.click(screen.getByRole('button', { name: 'update answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle encryption' }));

    expect(onAnswerChange).toHaveBeenCalledWith('next answer');
    expect(onToggleAnswerEncryption).toHaveBeenCalledWith(true);

    rerender(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: ' Q Freeform ',
          type: 'freeform',
        }}
        qIndex={2}
        answer={{ value: 'ready', encrypted: false }}
        isSubmitting
        onAnswerChange={onAnswerChange}
        onToggleAnswerEncryption={onToggleAnswerEncryption}
      />,
    );

    expect(screen.getByTestId('mock-survey-audio-field-input')).toHaveAttribute('data-disabled', 'true');
  });

  it('preserves audio worker identity through default answer input rendering', () => {
    const sessionConfig = { worker: 'config' };
    const context = { chainId: 84532 };
    render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: 'q-audio',
          type: 'freeform',
        }}
        qIndex={1}
        answer={{ value: 'ready', encrypted: false }}
        audioInputWorkerProps={{
          sessionSlug: 'edge',
          sessionConfig,
          context,
          workerUrl: 'https://worker.example/audio',
        }}
      />,
    );

    const input = screen.getByTestId('mock-survey-audio-field-input');
    expect(input).toHaveAttribute('data-session-slug', 'edge');
    expect(input).toHaveAttribute('data-worker-url', 'https://worker.example/audio');

    const props = mockSurveyAudioFieldInputProps[mockSurveyAudioFieldInputProps.length - 1];
    expect(props.sessionConfig).toBe(sessionConfig);
    expect(props.context).toBe(context);
  });

  it('keeps submitting default answer actions inert even if a child emits', () => {
    const onAnswerChange = jest.fn();
    const onToggleAnswerEncryption = jest.fn();
    render(
      <SurveyQuestionsFullQuestionResponseInput
        question={{
          id: 'q-audio',
          type: 'freeform',
        }}
        qIndex={1}
        answer={{ value: 'ready', encrypted: false }}
        isSubmitting
        onAnswerChange={onAnswerChange}
        onToggleAnswerEncryption={onToggleAnswerEncryption}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'update answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle encryption' }));

    expect(onAnswerChange).not.toHaveBeenCalled();
    expect(onToggleAnswerEncryption).not.toHaveBeenCalled();
  });
});
