import React from 'react';

import BinaryChoiceInput from './BinaryChoiceInput';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import MultichoiceQuestionInput from './MultichoiceQuestionInput';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import { buildSurveyQuestionsFullQuestionResponseInputDescriptor } from './surveyQuestionsFullQuestionResponseInputState';

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

  switch (inputDescriptor.kind) {
    case 'multichoice': {
      return (
        <MultichoiceQuestionInput
          questionId={inputDescriptor.questionId}
          options={inputDescriptor.options}
          selectedValues={inputDescriptor.selectedValues}
          isSingleSelect={inputDescriptor.isSingleSelect}
          disabled={inputDescriptor.disabled}
          onChange={(newAnswer) => onAnswerChange?.(newAnswer)}
        />
      );
    }
    case 'rating': {
      return inputDescriptor.useDeferredRating ? (
        <DeferredRatingSlider
          value={inputDescriptor.ratingValue}
          disabled={inputDescriptor.disabled}
          onCommit={onDeferredRatingCommit}
        />
      ) : (
        <FullQuestionRatingInput
          value={inputDescriptor.ratingValue}
          disabled={inputDescriptor.disabled}
          onChange={onRatingChange}
          onChangeComplete={onRatingChangeComplete}
        />
      );
    }
    case 'binary':
      return (
        <BinaryChoiceInput
          questionId={inputDescriptor.questionId}
          value={inputDescriptor.value}
          onChange={(option) => onAnswerChange?.(option)}
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
          updateFunction={(nextAnswerValue: unknown) => onAnswerChange?.(nextAnswerValue)}
          toggleEncryption={(nextEncryptedState: boolean) => onToggleAnswerEncryption?.(nextEncryptedState)}
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
