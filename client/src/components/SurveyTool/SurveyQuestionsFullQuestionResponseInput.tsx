import React from 'react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import BinaryChoiceInput from './BinaryChoiceInput';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import MultichoiceQuestionInput from './MultichoiceQuestionInput';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import {
  getNormalizedUiRatingValue,
  isSingleSelectMultichoice,
  normalizeMultichoiceValue,
} from './surveyToolUtils.js';

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
  switch (question.type) {
    case 'multichoice': {
      const options = Array.isArray(question.options) ? question.options : [];
      const isSingleSelect = isSingleSelectMultichoice(question);
      const selectedValues = normalizeMultichoiceValue(answer.value);
      return (
        <MultichoiceQuestionInput
          questionId={question.id}
          options={options}
          selectedValues={selectedValues}
          isSingleSelect={isSingleSelect}
          disabled={isSubmitting}
          onChange={(newAnswer) => onAnswerChange?.(newAnswer)}
        />
      );
    }
    case 'rating': {
      const ratingValue = getNormalizedUiRatingValue(answer.value);
      return singleQuestionMode ? (
        <DeferredRatingSlider
          value={ratingValue}
          disabled={isSubmitting}
          onCommit={onDeferredRatingCommit}
        />
      ) : (
        <FullQuestionRatingInput
          value={ratingValue}
          disabled={isSubmitting}
          onChange={onRatingChange}
          onChangeComplete={onRatingChangeComplete}
        />
      );
    }
    case 'binary':
      return (
        <BinaryChoiceInput
          questionId={question.id}
          value={String(answer.value || '')}
          onChange={(option) => onAnswerChange?.(option)}
          disabled={isSubmitting}
          showIcons
        />
      );
    default:
      return (
        <SurveyAudioFieldInput
          qIndex={qIndex}
          {...audioInputWorkerProps}
          placeholder="response (optional)"
          updateFunction={(answerValue: unknown) => onAnswerChange?.(answerValue)}
          toggleEncryption={onToggleAnswerEncryption}
          value={answer.value || ''}
          encrypted={answer.encrypted || false}
          dataTestId={E2E_TESTIDS.SURVEY_ANSWER_INPUT}
          dataCeQuestionId={String(question.id || '').trim().toLowerCase()}
          disabled={isSubmitting}
          forceGlow={glowAnswer}
          disableEncryption
        />
      );
  }
};

export default SurveyQuestionsFullQuestionResponseInput;
