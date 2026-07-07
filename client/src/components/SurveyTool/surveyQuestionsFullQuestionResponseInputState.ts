import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getNormalizedUiRatingValue, isSingleSelectMultichoice, normalizeMultichoiceValue } from './surveyToolUtils';

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
      questionId: string;
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
      questionId: string;
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

export type SurveyQuestionsFullQuestionResponseInputActionDescriptor =
  | {
      kind: 'answer-change';
      questionId: string;
      responseKey: 'answer';
      disabled: boolean;
      nextValue: unknown;
      event?: unknown;
    }
  | {
      kind: 'rating-change';
      questionId: string;
      responseKey: 'answer';
      disabled: boolean;
      nextValue: number;
      event?: unknown;
      persistStrategy: 'event-sensitive';
    }
  | {
      kind: 'rating-commit';
      questionId: string;
      responseKey: 'answer';
      disabled: boolean;
      nextValue: number;
      persistDraft: false;
      flushAfterUpdate: true;
    }
  | {
      kind: 'rating-change-complete';
      questionId: string;
      responseKey: 'answer';
      disabled: boolean;
      event?: unknown;
    }
  | {
      kind: 'answer-encryption-toggle';
      questionId: string;
      responseKey: 'answer';
      disabled: boolean;
      nextEncryptedState: boolean;
    };

type BuildResponseInputActionDescriptorArgs = {
  inputDescriptor: SurveyQuestionsFullQuestionResponseInputDescriptor;
  kind: SurveyQuestionsFullQuestionResponseInputActionDescriptor['kind'];
  nextValue?: unknown;
  event?: unknown;
  nextEncryptedState?: boolean;
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
        questionId: question.id,
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
      const audioInputValue =
        typeof answerValue === 'string' || typeof answerValue === 'number' || answerValue == null
          ? answerValue || ''
          : '';

      return {
        kind: 'audio',
        questionId: question.id,
        qIndex,
        value: audioInputValue,
        encrypted: answer.encrypted || false,
        dataTestId: E2E_TESTIDS.SURVEY_ANSWER_INPUT,
        dataCeQuestionId: String(question.id || '')
          .trim()
          .toLowerCase(),
        disabled,
        forceGlow: !!glowAnswer,
        placeholder: 'response (optional)',
        disableEncryption: true,
      };
    }
  }
};

export const buildSurveyQuestionsFullQuestionResponseInputActionDescriptor = ({
  inputDescriptor,
  kind,
  nextValue,
  event,
  nextEncryptedState = false,
}: BuildResponseInputActionDescriptorArgs): SurveyQuestionsFullQuestionResponseInputActionDescriptor => {
  const base = {
    questionId: inputDescriptor.questionId,
    responseKey: 'answer' as const,
    disabled: inputDescriptor.disabled,
  };

  switch (kind) {
    case 'rating-change':
      return {
        ...base,
        kind,
        nextValue: Number(nextValue),
        event,
        persistStrategy: 'event-sensitive',
      };
    case 'rating-commit':
      return {
        ...base,
        kind,
        nextValue: Number(nextValue),
        persistDraft: false,
        flushAfterUpdate: true,
      };
    case 'rating-change-complete':
      return {
        ...base,
        kind,
        event,
      };
    case 'answer-encryption-toggle':
      return {
        ...base,
        kind,
        nextEncryptedState: !!nextEncryptedState,
      };
    default:
      return {
        ...base,
        kind: 'answer-change',
        nextValue,
        event,
      };
  }
};

export const shouldDispatchSurveyQuestionsFullQuestionResponseInputAction = (
  action: SurveyQuestionsFullQuestionResponseInputActionDescriptor,
): boolean => !action.disabled && String(action.questionId || '').trim().length > 0;
