import { canonicalizeSessionSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug.js';
import { toAnalysisRecord } from './userPageCoreHelpers';

export type ResolveUserPageSurveyCreatedCardStateArgs = {
  survey?: unknown;
};

export type ResolveUserPageSurveyPreviewDisplayStateArgs = {
  actionsClassName?: unknown;
  baseClassName?: unknown;
  interactive?: unknown;
};

export type ResolveUserPageSurveyCountDisplayStateArgs = {
  count?: unknown;
  countOnlyClassName?: unknown;
  infoClassName?: unknown;
};

export type ResolveUserPageSurveyResponseCardStateArgs = {
  questionArray?: unknown;
  survey?: unknown;
};

export type ResolveUserPageSurveySectionDisplayStateArgs = {
  isDeepScanning?: unknown;
  surveyCreationInfo?: unknown;
  surveyResponseInfo?: unknown;
  surveyResponsesLoadingEmpty?: unknown;
  surveysCreatedLoadingEmpty?: unknown;
};

export type ResolveUserPageQuestionSectionDisplayStateArgs = {
  questionCreationInfo?: unknown;
  questionResponseInfo?: unknown;
  questionResponsesLoadingEmpty?: unknown;
  questionsCreatedLoadingEmpty?: unknown;
};

export type ResolveUserPageSbtDisplayStateArgs = {
  isSBTCacheReady?: unknown;
  loadingSBTs?: unknown;
  sbtList?: unknown;
  sbtSectionLoadingEmpty?: unknown;
};

export type UserPageSurveyCreatedCardState = {
  hasDocURLs: boolean;
  hasExpandContent: boolean;
  hasQuestionIDs: boolean;
  hasTags: boolean;
  questionPreviewEntries: unknown[];
  surveyLinkSlug: string;
};

export type UserPageSurveyPreviewDisplayState = {
  className: string;
  style: Record<string, string>;
};

export type UserPageSurveyCountDisplayState = {
  ariaLabel: string;
  className: string;
  title: string;
};

export type UserPageSurveyResponseCardState = {
  hasDocURLs: boolean;
  hasResponses: boolean;
  hasTags: boolean;
};

export type UserPageSurveySectionDisplayState = {
  hasCreatedSurveys: boolean;
  hasSurveyResponses: boolean;
  shouldRenderSurveyResponsesEmptyText: boolean;
  shouldRenderSurveysCreatedEmptyText: boolean;
};

export type UserPageQuestionSectionDisplayState = {
  hasCreatedQuestions: boolean;
  hasQuestionResponses: boolean;
  shouldRenderQuestionResponsesEmptyText: boolean;
  shouldRenderQuestionsCreatedEmptyText: boolean;
};

export type UserPageSbtDisplayState = {
  hasSbts: boolean;
  shouldRenderMainEmptyText: boolean;
  shouldRenderModalEmptyText: boolean;
  shouldRenderModalSpinner: boolean;
};

export const resolveUserPageQuestionPromptText = (questionData: unknown): string => {
  const record = toAnalysisRecord(questionData);
  if (!Object.keys(record).length) return '';
  const questionText = typeof record.question === 'string' ? record.question.trim() : '';
  if (questionText) return questionText;
  const promptText = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  if (promptText) return promptText;
  return '';
};

export const shortenUserPageQuestionId = (questionId: unknown): string => {
  const fullId = String(questionId || '');
  if (fullId.length <= 20) return fullId;
  return `${fullId.slice(0, 8)}...${fullId.slice(-6)}`;
};

export const resolveUserPageSurveyCreatedCardState = ({
  survey = null,
}: ResolveUserPageSurveyCreatedCardStateArgs = {}): UserPageSurveyCreatedCardState => {
  const record = toAnalysisRecord(survey);
  const hasTags = Array.isArray(record.tags) && record.tags.length > 0;
  const hasDocURLs = Array.isArray(record.documentURLs) && record.documentURLs.length > 0;
  const hasQuestionIDs = Array.isArray(record.questionIDs) && record.questionIDs.length > 0;
  const questionPreviewEntries =
    Array.isArray(record.questionPreviews) && record.questionPreviews.length > 0
      ? record.questionPreviews
      : ((record.questionIDs || []) as unknown[]).map((qid: unknown) => ({
          id: String(qid || ''),
          text: '',
        }));

  return {
    hasDocURLs,
    hasExpandContent: hasTags || hasDocURLs || hasQuestionIDs,
    hasQuestionIDs,
    hasTags,
    questionPreviewEntries,
    surveyLinkSlug: normalizeSessionSlug(record.slug || ''),
  };
};

export const resolveUserPageSurveyPreviewDisplayState = ({
  actionsClassName = '',
  baseClassName = '',
  interactive = false,
}: ResolveUserPageSurveyPreviewDisplayStateArgs = {}): UserPageSurveyPreviewDisplayState => ({
  className: [String(baseClassName || ''), String(actionsClassName || '')].filter(Boolean).join(' '),
  style: { cursor: interactive ? 'pointer' : 'default' },
});

export const resolveUserPageSurveyCountDisplayState = ({
  count = 0,
  countOnlyClassName = '',
  infoClassName = '',
}: ResolveUserPageSurveyCountDisplayStateArgs = {}): UserPageSurveyCountDisplayState => {
  const label = `${String(count || 0)} questions`;
  return {
    ariaLabel: label,
    className: [String(infoClassName || ''), String(countOnlyClassName || '')].filter(Boolean).join(' '),
    title: label,
  };
};

export const resolveUserPageSurveyResponseCardState = ({
  questionArray = [],
  survey = null,
}: ResolveUserPageSurveyResponseCardStateArgs = {}): UserPageSurveyResponseCardState => {
  const record = toAnalysisRecord(survey);
  const questionCount = Number((questionArray as { length?: unknown })?.length || 0);
  return {
    hasDocURLs: Array.isArray(record.documentURLs) && record.documentURLs.length > 0,
    hasResponses: questionCount > 0,
    hasTags: Array.isArray(record.tags) && record.tags.length > 0,
  };
};

export const resolveUserPageSurveySectionDisplayState = ({
  isDeepScanning = false,
  surveyCreationInfo = [],
  surveyResponseInfo = [],
  surveyResponsesLoadingEmpty = false,
  surveysCreatedLoadingEmpty = false,
}: ResolveUserPageSurveySectionDisplayStateArgs = {}): UserPageSurveySectionDisplayState => {
  const createdSurveyCount = Number((surveyCreationInfo as { length?: unknown })?.length || 0);
  const surveyResponseCount = Number((surveyResponseInfo as { length?: unknown })?.length || 0);
  const hasCreatedSurveys = createdSurveyCount > 0;
  const hasSurveyResponses = surveyResponseCount > 0;
  const suppressSurveysCreatedEmptyText = !!surveysCreatedLoadingEmpty || (!!isDeepScanning && !hasCreatedSurveys);
  return {
    hasCreatedSurveys,
    hasSurveyResponses,
    shouldRenderSurveyResponsesEmptyText: !hasSurveyResponses && !surveyResponsesLoadingEmpty,
    shouldRenderSurveysCreatedEmptyText: !hasCreatedSurveys && !suppressSurveysCreatedEmptyText,
  };
};

export const resolveUserPageQuestionSectionDisplayState = ({
  questionCreationInfo = [],
  questionResponseInfo = [],
  questionResponsesLoadingEmpty = false,
  questionsCreatedLoadingEmpty = false,
}: ResolveUserPageQuestionSectionDisplayStateArgs = {}): UserPageQuestionSectionDisplayState => {
  const createdQuestionCount = Number((questionCreationInfo as { length?: unknown })?.length || 0);
  const questionResponseCount = Number((questionResponseInfo as { length?: unknown })?.length || 0);
  const hasCreatedQuestions = createdQuestionCount > 0;
  const hasQuestionResponses = questionResponseCount > 0;
  return {
    hasCreatedQuestions,
    hasQuestionResponses,
    shouldRenderQuestionResponsesEmptyText: !hasQuestionResponses && !questionResponsesLoadingEmpty,
    shouldRenderQuestionsCreatedEmptyText: !hasCreatedQuestions && !questionsCreatedLoadingEmpty,
  };
};

export const resolveUserPageSbtDisplayState = ({
  isSBTCacheReady = false,
  loadingSBTs = false,
  sbtList = [],
  sbtSectionLoadingEmpty = false,
}: ResolveUserPageSbtDisplayStateArgs = {}): UserPageSbtDisplayState => {
  const sbtCount = Number((sbtList as { length?: unknown })?.length || 0);
  const hasSbts = sbtCount > 0;
  const shouldRenderModalSpinner = !!loadingSBTs || isSBTCacheReady !== true;
  return {
    hasSbts,
    shouldRenderMainEmptyText: !hasSbts && !sbtSectionLoadingEmpty,
    shouldRenderModalEmptyText: !shouldRenderModalSpinner && !hasSbts,
    shouldRenderModalSpinner,
  };
};
