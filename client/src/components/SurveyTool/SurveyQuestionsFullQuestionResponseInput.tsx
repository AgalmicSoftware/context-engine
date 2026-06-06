import React from 'react';

import BinaryChoiceInput from './BinaryChoiceInput';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import MultichoiceQuestionInput from './MultichoiceQuestionInput';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import {
  buildSurveyQuestionsFullQuestionResponseInputActionDescriptor,
  buildSurveyQuestionsFullQuestionResponseInputDescriptor,
  shouldDispatchSurveyQuestionsFullQuestionResponseInputAction,
} from './surveyQuestionsFullQuestionResponseInputState';

type SurveyQuestionRecord = {
  id: string;
  type: string;
  options?: unknown[];
};

type SurveyAnswerRecord = {
  value?: unknown;
  encrypted?: boolean;
};

type SurveyQuestionsFullQuestionResponseInputProps = {
  question: SurveyQuestionRecord;
  qIndex: number;
  answer: SurveyAnswerRecord;
  glowAnswer?: boolean;
  isSubmitting?: boolean;
  singleQuestionMode?: boolean;
  audioInputWorkerProps?: Record<string, unknown>;
  onAnswerChange?: (nextValue: unknown, event?: unknown) => void;
  onDeferredRatingCommit?: (nextValue: number) => void;
  onRatingChange?: (nextValue: number, event?: unknown) => void;
  onRatingChangeComplete?: (event?: unknown) => void;
  onToggleAnswerEncryption?: (nextEncryptedState: boolean) => void;
};

const SurveyQuestionsFullQuestionResponseInput = ({
  question,
  qIndex,
  answer,
  glowAnswer = false,
  isSubmitting = false,
  singleQuestionMode = false,
  audioInputWorkerProps = {},
  onAnswerChange,
  onDeferredRatingCommit,
  onRatingChange,
  onRatingChangeComplete,
  onToggleAnswerEncryption,
}: SurveyQuestionsFullQuestionResponseInputProps): React.ReactNode => {
  const inputDescriptor = buildSurveyQuestionsFullQuestionResponseInputDescriptor({
    question,
    qIndex,
    answer,
    glowAnswer,
    isSubmitting,
    singleQuestionMode,
  });

  const emitAnswerChange = (nextValue: unknown, event?: unknown) => {
    const action = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'answer-change',
      nextValue,
      event,
    });
    if (!shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(action)) return;
    if (action.kind !== 'answer-change') return;
    if (action.event === undefined) {
      onAnswerChange?.(action.nextValue);
    } else {
      onAnswerChange?.(action.nextValue, action.event);
    }
  };

  const emitRatingChange = (nextValue: number, event?: unknown) => {
    const action = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'rating-change',
      nextValue,
      event,
    });
    if (!shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(action)) return;
    if (action.kind !== 'rating-change') return;
    onRatingChange?.(action.nextValue, action.event);
  };

  const emitDeferredRatingCommit = (nextValue: number) => {
    const action = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'rating-commit',
      nextValue,
    });
    if (!shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(action)) return;
    if (action.kind !== 'rating-commit') return;
    onDeferredRatingCommit?.(action.nextValue);
  };

  const emitRatingChangeComplete = (event?: unknown) => {
    const action = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'rating-change-complete',
      event,
    });
    if (!shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(action)) return;
    if (action.kind !== 'rating-change-complete') return;
    if (action.event === undefined) {
      onRatingChangeComplete?.();
    } else {
      onRatingChangeComplete?.(action.event);
    }
  };

  const emitAnswerEncryptionToggle = (nextEncryptedState: boolean) => {
    const action = buildSurveyQuestionsFullQuestionResponseInputActionDescriptor({
      inputDescriptor,
      kind: 'answer-encryption-toggle',
      nextEncryptedState,
    });
    if (!shouldDispatchSurveyQuestionsFullQuestionResponseInputAction(action)) return;
    if (action.kind !== 'answer-encryption-toggle') return;
    onToggleAnswerEncryption?.(action.nextEncryptedState);
  };

  switch (inputDescriptor.kind) {
    case 'multichoice': {
      return (
        <MultichoiceQuestionInput
          questionId={inputDescriptor.questionId}
          options={inputDescriptor.options}
          selectedValues={inputDescriptor.selectedValues}
          isSingleSelect={inputDescriptor.isSingleSelect}
          disabled={inputDescriptor.disabled}
          onChange={emitAnswerChange}
        />
      );
    }
    case 'rating': {
      return inputDescriptor.useDeferredRating ? (
        <DeferredRatingSlider
          value={inputDescriptor.ratingValue}
          disabled={inputDescriptor.disabled}
          onCommit={emitDeferredRatingCommit}
        />
      ) : (
        <FullQuestionRatingInput
          value={inputDescriptor.ratingValue}
          disabled={inputDescriptor.disabled}
          onChange={emitRatingChange}
          onChangeComplete={emitRatingChangeComplete}
        />
      );
    }
    case 'binary':
      return (
        <BinaryChoiceInput
          questionId={inputDescriptor.questionId}
          value={inputDescriptor.value}
          onChange={emitAnswerChange}
          disabled={inputDescriptor.disabled}
          showIcons
        />
      );
    default:
      return (
        <SurveyAudioFieldInput
          qIndex={inputDescriptor.qIndex}
          {...audioInputWorkerProps}
          placeholder={inputDescriptor.placeholder}
          updateFunction={emitAnswerChange}
          toggleEncryption={emitAnswerEncryptionToggle}
          value={inputDescriptor.value}
          encrypted={inputDescriptor.encrypted}
          dataTestId={inputDescriptor.dataTestId}
          dataCeQuestionId={inputDescriptor.dataCeQuestionId}
          disabled={inputDescriptor.disabled}
          forceGlow={inputDescriptor.forceGlow}
          disableEncryption={inputDescriptor.disableEncryption}
        />
      );
  }
};

export default SurveyQuestionsFullQuestionResponseInput;
