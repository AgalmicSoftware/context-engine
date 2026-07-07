import React from 'react';

import { buildSurveyQuestionsFullQuestionContentSections } from './SurveyQuestionsFullQuestionContentSections';

type SurveyQuestionsFullQuestionRecord = {
  id: string;
};

type SurveyQuestionsFullQuestionDisplayState = {
  activeSliderValue?: unknown;
  additional?: unknown;
  allowDecryptAdditional?: boolean;
  allowDecryptAnswer?: boolean;
  answer?: unknown;
  convictionValue?: unknown;
  decryptTooltip?: string;
  glowAdditional?: boolean;
  glowAnswer?: boolean;
  hasAdditionalContent?: boolean;
  hasConvictionImportanceValue?: boolean;
  importanceValue?: unknown;
  isAdditionalDecrypting?: boolean;
  isAnswerDecrypting?: boolean;
  maskedAdditional?: boolean;
  maskedAnswer?: boolean;
  sliderMode?: string;
};

type RenderFullQuestionFooterIcons = (args: {
  answer: unknown;
  commentsOpen: boolean;
  glowAnswer: boolean;
  hasAdditionalContent: boolean;
  maskedAnswer: boolean;
  onToggleComments: () => void;
  question: SurveyQuestionsFullQuestionRecord;
  surveyIndex: number;
}) => React.ReactNode;

type RenderFullQuestionSliderSection = (args: {
  activeSliderValue: unknown;
  convictionValue: unknown;
  hasConvictionImportanceValue: boolean;
  importanceValue: unknown;
  questionId: string;
  sliderMode: string;
  sliderOpen: boolean;
  surveyIndex: number;
}) => React.ReactNode;

type RenderResponseInput = (args: {
  answer: unknown;
  glowAnswer: boolean;
  qIndex: number;
  question: SurveyQuestionsFullQuestionRecord;
  surveyIndex: number;
}) => React.ReactNode;

type RenderAnswerDecryptControl = (args: {
  actionLabel: string;
  allowDecrypt: boolean;
  busy: boolean;
  decryptTooltip: string;
  fieldKey: 'answer';
  questionId: string;
}) => React.ReactNode;

type RenderAdditionalInput = (args: {
  additional: unknown;
  glowAdditional: boolean;
  qIndex: number;
  questionId: string;
  surveyIndex: number;
}) => React.ReactNode;

type RenderAdditionalLockControl = (args: {
  additional: unknown;
  glowAdditional: boolean;
  questionId: string;
  surveyIndex: number;
}) => React.ReactNode;

type RenderAdditionalDecryptControl = (args: {
  actionLabel: string;
  allowDecrypt: boolean;
  busy: boolean;
  decryptTooltip: string;
  fieldKey: 'additional';
  questionId: string;
}) => React.ReactNode;

type RenderFullQuestionCardShell = (args: {
  cardIcons: React.ReactNode;
  cardKey: React.Key;
  commentsSection: React.ReactNode;
  footerIcons: React.ReactNode;
  mainContent: React.ReactNode;
  question: SurveyQuestionsFullQuestionRecord;
  sliderSection: React.ReactNode;
}) => React.ReactNode;

type RenderSurveyQuestionsFullQuestionDisplayArgs = {
  cardIcons: React.ReactNode;
  cardKey: React.Key;
  commentsOpen?: boolean;
  displayState: SurveyQuestionsFullQuestionDisplayState;
  onToggleComments: (questionId: string, defaultOpen: boolean) => void;
  qIndex: number;
  question: SurveyQuestionsFullQuestionRecord;
  renderAdditionalDecryptControl: RenderAdditionalDecryptControl;
  renderAdditionalInput: RenderAdditionalInput;
  renderAdditionalLockControl: RenderAdditionalLockControl;
  renderAnswerDecryptControl: RenderAnswerDecryptControl;
  renderFullQuestionCardShell: RenderFullQuestionCardShell;
  renderFullQuestionFooterIcons: RenderFullQuestionFooterIcons;
  renderFullQuestionSliderSection: RenderFullQuestionSliderSection;
  renderResponseInput: RenderResponseInput;
  sliderOpen?: boolean;
  surveyIndex: number;
};

export const renderSurveyQuestionsFullQuestionDisplay = ({
  cardIcons,
  cardKey,
  commentsOpen = false,
  displayState,
  onToggleComments,
  qIndex,
  question,
  renderAdditionalDecryptControl,
  renderAdditionalInput,
  renderAdditionalLockControl,
  renderAnswerDecryptControl,
  renderFullQuestionCardShell,
  renderFullQuestionFooterIcons,
  renderFullQuestionSliderSection,
  renderResponseInput,
  sliderOpen = false,
  surveyIndex,
}: RenderSurveyQuestionsFullQuestionDisplayArgs): React.ReactNode => {
  const questionId = question.id;
  const {
    activeSliderValue = null,
    additional = null,
    allowDecryptAdditional = false,
    allowDecryptAnswer = false,
    answer = null,
    convictionValue = null,
    decryptTooltip = 'Login to decrypt this encrypted field.',
    glowAdditional = false,
    glowAnswer = false,
    hasAdditionalContent = false,
    hasConvictionImportanceValue = false,
    importanceValue = null,
    isAdditionalDecrypting = false,
    isAnswerDecrypting = false,
    maskedAdditional = false,
    maskedAnswer = false,
    sliderMode = 'conviction',
  } = displayState;
  const handleToggleComments = () => onToggleComments(questionId, hasAdditionalContent);
  const footerIcons = renderFullQuestionFooterIcons({
    surveyIndex,
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
    commentsOpen,
    onToggleComments: handleToggleComments,
  });
  const sliderSection = renderFullQuestionSliderSection({
    surveyIndex,
    questionId,
    sliderMode,
    activeSliderValue,
    convictionValue,
    importanceValue,
    hasConvictionImportanceValue,
    sliderOpen,
  });
  const contentSections = buildSurveyQuestionsFullQuestionContentSections({
    commentsOpen,
    maskedAnswer,
    maskedAdditional,
    renderResponseInput: () =>
      renderResponseInput({
        question,
        qIndex,
        surveyIndex,
        answer,
        glowAnswer,
      }),
    renderAnswerDecryptControl: () =>
      renderAnswerDecryptControl({
        questionId,
        fieldKey: 'answer',
        allowDecrypt: allowDecryptAnswer,
        decryptTooltip,
        actionLabel: 'Decrypt Answer',
        busy: isAnswerDecrypting,
      }),
    renderAdditionalInput: () =>
      renderAdditionalInput({
        qIndex,
        surveyIndex,
        questionId,
        additional,
        glowAdditional,
      }),
    renderAdditionalLockControl: () =>
      renderAdditionalLockControl({
        surveyIndex,
        questionId,
        additional,
        glowAdditional,
      }),
    renderAdditionalDecryptControl: () =>
      renderAdditionalDecryptControl({
        questionId,
        fieldKey: 'additional',
        allowDecrypt: allowDecryptAdditional,
        decryptTooltip,
        actionLabel: 'Decrypt Comments',
        busy: isAdditionalDecrypting,
      }),
  });

  return renderFullQuestionCardShell({
    cardKey,
    question,
    cardIcons,
    mainContent: contentSections.mainContent,
    footerIcons,
    sliderSection,
    commentsSection: contentSections.commentsSection,
  });
};
