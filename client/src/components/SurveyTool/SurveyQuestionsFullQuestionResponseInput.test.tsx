import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import {
  buildSurveyQuestionsFullQuestionResponseInputActionDescriptor,
  buildSurveyQuestionsFullQuestionResponseInputDescriptor,
  shouldDispatchSurveyQuestionsFullQuestionResponseInputAction,
} from './surveyQuestionsFullQuestionResponseInputState';

const mockSurveyAudioFieldInputProps: any[] = [];

jest.mock('./SurveyAudioFieldInput', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: (props: any) => {
      mockSurveyAudioFieldInputProps.push(props);
      return (
        <div
          data-testid="mock-survey-audio-field-input"
          data-ce-question-id={props.dataCeQuestionId || ''}
          data-disabled={String(!!props.disabled)}
          data-encrypted={String(!!props.encrypted)}
          data-force-glow={String(!!props.forceGlow)}
          data-input-testid={props.dataTestId || ''}
          data-session-slug={props.sessionSlug || ''}
          data-value={String(props.value)}
          data-worker-url={props.workerUrl || ''}
        >
          <button type="button" onClick={() => props.updateFunction('next answer')}>
            update answer
          </button>
          <button type="button" onClick={() => props.toggleEncryption(true)}>
            toggle encryption
          </button>
        </div>
      );
    },
  };
});

describe('SurveyQuestionsFullQuestionResponseInput', () => {
  beforeEach(() => {
    mockSurveyAudioFieldInputProps.length = 0;
  });

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
      questionId: 'q2',
      ratingValue: 7,
      disabled: false,
      useDeferredRating: true,
    });

    expect(
      buildSurveyQuestionsFullQuestionResponseInputDescriptor({
        question: { id: ' Q3 ', type: 'freeform' },
        answer: { value: { ignored: true }, encrypted: true },
        glowAnswer: true,
      }),
    ).toEqual({
      kind: 'audio',
      questionId: ' Q3 ',
      value: '',
      encrypted: true,
      dataTestId: E2E_TESTIDS.SURVEY_ANSWER_INPUT,
      dataCeQuestionId: 'q3',
      disabled: false,
      forceGlow: true,
      placeholder: 'response (optional)',
    });
  });

  it('describes response input actions with question identity and dispatch readiness', () => {
    const inputDescriptor = buildSurveyQuestionsFullQuestionResponseInputDescriptor({
      question: { id: 'q-rating', type: 'rating' },
      answer: { value: '5' },
    });
    const event = { type: 'keydown' };

    const ratingChange = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'rating-change',
      nextValue: 8,
      event,
    });
    expect(ratingChange).toMatchObject({
      kind: 'rating-change',
      questionId: 'q-rating',
      responseKey: 'answer',
      disabled: false,
      nextValue: 8,
      persistStrategy: 'event-sensitive',
    });
    expect(ratingChange.event).toBe(event);
    expect(shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(ratingChange)).toBe(true);

    const ratingCommit = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'rating-commit',
      nextValue: '9',
    });
    expect(ratingCommit).toEqual({
      kind: 'rating-commit',
      questionId: 'q-rating',
      responseKey: 'answer',
      disabled: false,
      nextValue: 9,
      persistDraft: false,
      flushAfterUpdate: true,
    });

    const encryptionToggle = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'answer-encryption-toggle',
      nextEncryptedState: true,
    });
    expect(encryptionToggle).toEqual({
      kind: 'answer-encryption-toggle',
      questionId: 'q-rating',
      responseKey: 'answer',
      disabled: false,
      nextEncryptedState: true,
    });

    const disabledDescriptor = buildSurveyQuestionsFullQuestionResponseInputDescriptor({
      question: { id: 'q-disabled', type: 'binary' },
      answer: { value: 'Agree' },
      isSubmitting: true,
    });
    const disabledAction = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor: disabledDescriptor,
      kind: 'answer-change',
      nextValue: 'Disagree',
    });
    expect(shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(disabledAction)).toBe(false);
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

  it('routes full-question rating changes through immediate slider handlers', () => {
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
    fireEvent.change(slider, { target: { value: '8' } });
    fireEvent.mouseUp(slider, { currentTarget: { value: '8' } });

    expect(onRatingChange).toHaveBeenCalledWith(8, expect.anything());
    expect(onRatingChangeComplete).toHaveBeenCalled();
    expect(onDeferredRatingCommit).not.toHaveBeenCalled();
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

  it('skips non-edited answer inputs when stable parent props are reused', () => {
    const audioInputWorkerProps = { sessionSlug: 'edge' };
    const onAnswerChange = jest.fn();
    const onToggleAnswerEncryption = jest.fn();
    const firstQuestion = { id: 'q-one', type: 'freeform' };
    const secondQuestion = { id: 'q-two', type: 'freeform' };
    const firstAnswer = { value: 'first', encrypted: false };
    const secondAnswer = { value: 'second', encrypted: false };
    const secondAnswerUpdated = { value: 'second edited', encrypted: false };
    const renderInputs = (nextSecondAnswer = secondAnswer) => (
      <>
        <SurveyQuestionsFullQuestionResponseInput
          question={firstQuestion}
          answer={firstAnswer}
          audioInputWorkerProps={audioInputWorkerProps}
          onAnswerChange={onAnswerChange}
          onToggleAnswerEncryption={onToggleAnswerEncryption}
        />
        <SurveyQuestionsFullQuestionResponseInput
          question={secondQuestion}
          answer={nextSecondAnswer}
          audioInputWorkerProps={audioInputWorkerProps}
          onAnswerChange={onAnswerChange}
          onToggleAnswerEncryption={onToggleAnswerEncryption}
        />
      </>
    );
    const { rerender } = render(renderInputs());

    expect(mockSurveyAudioFieldInputProps.map((props) => props.dataCeQuestionId)).toEqual(['q-one', 'q-two']);

    rerender(renderInputs(secondAnswerUpdated));

    expect(mockSurveyAudioFieldInputProps.map((props) => props.dataCeQuestionId)).toEqual(['q-one', 'q-two', 'q-two']);
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
