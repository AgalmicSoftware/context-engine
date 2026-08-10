import type { CSSProperties } from 'react';

type CreateSurveyStyleMap = Record<string, string>;

export const CREATE_SURVEY_TYPE_PREVIEW_BOX_STYLE: CSSProperties = {
  border: '1px dashed var(--ce-border-light)',
  padding: 10,
  borderRadius: 'var(--ce-radius-6)',
  marginTop: 6,
  background: 'var(--ce-document-surface)',
};

export const CREATE_SURVEY_TYPE_PREVIEW_PILL_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '3px 8px',
  border: '1px solid var(--ce-document-border)',
  borderRadius: 'var(--ce-radius-12)',
  marginRight: 6,
  marginTop: 4,
};

export const CREATE_SURVEY_TYPE_PREVIEW_HEADING_STYLE: CSSProperties = {
  fontWeight: 600,
  marginBottom: 6,
};

export const CREATE_SURVEY_RATING_PREVIEW_TRACK_STYLE: CSSProperties = {
  height: 6,
  background: 'var(--ce-document-border)',
  borderRadius: 'var(--ce-radius-4)',
  width: 240,
};

export const CREATE_SURVEY_FREEFORM_PREVIEW_STYLE: CSSProperties = {
  height: 34,
  border: '1px solid var(--ce-document-border)',
  background: 'var(--ce-document-canvas)',
  borderRadius: 'var(--ce-radius-4)',
};

export const buildCreateSurveyTypePillClassName = (
  styleMap: CreateSurveyStyleMap,
  variant: 'agree' | 'unsure' | 'disagree',
): string => {
  const variantClassName =
    variant === 'agree' ? styleMap.pillAgree : variant === 'unsure' ? styleMap.pillUnsure : styleMap.pillDisagree;
  return `${styleMap.pill} ${variantClassName}`;
};

export const CREATE_SURVEY_SUBMIT_ICON_STYLE: CSSProperties = {
  marginRight: 8,
};

export const CREATE_SURVEY_UPLOADED_QUESTION_LINK_STYLE: CSSProperties = {
  marginLeft: '10px',
  marginRight: '5px',
  textDecoration: 'none',
  color: 'var(--ce-link)',
};

export const CREATE_SURVEY_SMALL_ICON_BUTTON_STYLE: CSSProperties = {
  padding: '0 5px',
};

export const CREATE_SURVEY_ACTION_ICON_STYLE: CSSProperties = {
  marginRight: '5px',
};

export const buildCreateSurveySubmitButtonClassName = (
  styleMap: CreateSurveyStyleMap,
  isSubmitting: unknown,
  submissionError: unknown,
): string =>
  `${styleMap.createSurveyButton} ${styleMap.submitSurveyBtn} ${isSubmitting ? styleMap.submittingButton : ''} ${submissionError ? styleMap.errorButton : ''}`;

export const resolveCreateSurveyProgressFillStyle = (progress: unknown): CSSProperties => ({
  width: `${Math.max(0, Math.min(100, Number(progress) || 0))}%`,
});

export const resolveCreateSurveyQuestionBookmarkStyle = (bookmarked: unknown): CSSProperties => ({
  color: bookmarked ? 'var(--ce-status-warning)' : undefined,
});

export const resolveCreateSurveyBookmarkSurveyStyle = (bookmarked: unknown): CSSProperties => ({
  color: bookmarked ? 'var(--ce-status-warning-text)' : undefined,
});

export const buildCreateSurveyActionLinkClassName = (styleMap: CreateSurveyStyleMap): string =>
  `${styleMap.actionBtn} ${styleMap.actionLink}`;

export const CREATE_SURVEY_TOGGLE_KNOB_QUESTION_STYLE: CSSProperties = {
  left: '31px',
  backgroundColor: 'var(--ce-status-success)',
};

export const CREATE_SURVEY_TOGGLE_KNOB_SURVEY_STYLE: CSSProperties = {
  left: '1px',
  backgroundColor: 'var(--ce-control-face)',
};

export const CREATE_SURVEY_TRAILING_TOGGLE_LABEL_STYLE: CSSProperties = {
  marginLeft: '10px',
};

export const CREATE_SURVEY_HEADER_ICON_STYLE: CSSProperties = {
  marginRight: '6px',
};

export const CREATE_SURVEY_CLEAR_FORM_BUTTON_STYLE: CSSProperties = {
  marginLeft: 'auto',
};

export const CREATE_SURVEY_AUTO_TOOL_PANEL_STYLE: CSSProperties = {
  marginTop: '20px',
};

export const buildCreateSurveyProgressStepClassName = (
  styleMap: CreateSurveyStyleMap,
  submitStep: number,
  step: number,
): string => (submitStep >= step ? styleMap.stepCompleted : styleMap.step);

export const buildCreateSurveyAiPromptCopyClassName = (styleMap: CreateSurveyStyleMap, copySuccess: unknown): string =>
  `${styleMap.aiPromptCopyCorner} ${copySuccess ? styleMap.aiPromptCopyCornerSuccess : ''}`;

export const buildCreateSurveyContainerClassName = (styleMap: CreateSurveyStyleMap, miniaturized: unknown): string =>
  `${styleMap.createSurveyContainer} ${miniaturized ? styleMap.miniaturized : ''}`;

export const resolveCreateSurveyToggleKnobStyle = (isStandaloneQuestion: unknown): CSSProperties =>
  isStandaloneQuestion ? CREATE_SURVEY_TOGGLE_KNOB_QUESTION_STYLE : CREATE_SURVEY_TOGGLE_KNOB_SURVEY_STYLE;
