import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
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

export type SurveyQuestionsFullQuestionResponseInputDescriptor =
  | {
    kind: 'multichoice';
    questionId: string;
    options: unknown[];
    selectedValues: unknown[];
    isSingleSelect: boolean;
    disabled: boolean;
  }
  | {
    kind: 'rating';
    ratingValue: number;
    disabled: boolean;
    useDeferredRating: boolean;
  }
  | {
    kind: 'binary';
    questionId: string;
    value: string;
    disabled: boolean;
  }
  | {
    kind: 'audio';
    qIndex: number;
    value: string | number;
    encrypted: boolean;
    dataTestId: string;
    dataCeQuestionId: string;
    disabled: boolean;
    forceGlow: boolean;
    placeholder: string;
    disableEncryption: boolean;
  };

export const buildSurveyQuestionsFullQuestionResponseInputDescriptor = ({
  question,
  qIndex = 0,
  answer,
  glowAnswer = false,
  isSubmitting = false,
  singleQuestionMode = false,
}: {
  question: SurveyQuestionRecord;
  qIndex?: number;
  answer: SurveyAnswerRecord;
  glowAnswer?: boolean;
  isSubmitting?: boolean;
  singleQuestionMode?: boolean;
}): SurveyQuestionsFullQuestionResponseInputDescriptor => {
  const disabled = !!isSubmitting;

  switch (question.type) {
    case 'multichoice':
      return {
        kind: 'multichoice',
        questionId: question.id,
        options: Array.isArray(question.options) ? question.options : [],
        selectedValues: normalizeMultichoiceValue(answer.value),
        isSingleSelect: isSingleSelectMultichoice(question),
        disabled,
      };
    case 'rating':
      return {
        kind: 'rating',
        ratingValue: getNormalizedUiRatingValue(answer.value),
        disabled,
        useDeferredRating: !!singleQuestionMode,
      };
    case 'binary':
      return {
        kind: 'binary',
        questionId: question.id,
        value: String(answer.value || ''),
        disabled,
      };
    default: {
      const answerValue = answer.value;
      const audioInputValue = (
        typeof answerValue === 'string' ||
        typeof answerValue === 'number' ||
        answerValue == null
      ) ? answerValue || '' : '';

      return {
        kind: 'audio',
        qIndex,
        value: audioInputValue,
        encrypted: answer.encrypted || false,
        dataTestId: E2E_TESTIDS.SURVEY_ANSWER_INPUT,
        dataCeQuestionId: String(question.id || '').trim().toLowerCase(),
        disabled,
        forceGlow: !!glowAnswer,
        placeholder: 'response (optional)',
        disableEncryption: true,
      };
    }
  }
};
