import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { buildMetadataSessionCacheEnvelope } from './metadataSessionBinding.js';

type MetadataEntry = Record<string, any>;

export type PrepareSurveyMetadataCacheEntryArgs = {
  surveyId: string;
  surveyData: unknown;
  slug: string;
  creationBlock?: number | string | null;
  enforceScopedIsolation?: boolean;
};

export type PrepareQuestionMetadataCacheEntryArgs = {
  questionId: string;
  questionData: unknown;
  slug: string;
  enforceScopedIsolation?: boolean;
};

const isMetadataEntry = (value: unknown): value is MetadataEntry => (
  value !== null && typeof value === 'object'
);

export const prepareSurveyMetadataCacheEntry = ({
  surveyId,
  surveyData,
  slug,
  creationBlock,
  enforceScopedIsolation,
}: PrepareSurveyMetadataCacheEntryArgs): Record<string, any> => {
  const sid = String(surveyId || '').toLowerCase();
  const scoped = enforceScopedIsolation === true;
  const source = isMetadataEntry(surveyData) ? surveyData : null;

  let normalizedSurveyData: MetadataEntry = {
    ...(source || {}),
    surveyID: sid,
    id: sid,
    questionIDs: Array.isArray(source?.questionIDs) ? source.questionIDs : [],
    creator: source?.creator || '',
  };
  const sessionEnvelope = buildMetadataSessionCacheEnvelope(normalizedSurveyData, slug, {
    scoped,
    includeSlugField: false,
  });
  normalizedSurveyData = {
    ...normalizedSurveyData,
    ...sessionEnvelope.metadata,
  };
  if (!Object.prototype.hasOwnProperty.call(normalizedSurveyData, 'slug') || normalizedSurveyData.slug == null || String(normalizedSurveyData.slug).trim() === '') {
    normalizedSurveyData.slug = normalizeSessionSlug(
      normalizedSurveyData.sessionSlug ||
      (scoped ? '' : slug)
    );
  }
  if (Number.isFinite(Number(creationBlock))) {
    normalizedSurveyData.creationBlock = Number(creationBlock);
  }
  return normalizedSurveyData;
};

export const prepareQuestionMetadataCacheEntry = ({
  questionId,
  questionData,
  slug,
  enforceScopedIsolation,
}: PrepareQuestionMetadataCacheEntryArgs): Record<string, any> => {
  const qid = String(questionId || '').toLowerCase();
  const source = isMetadataEntry(questionData) ? questionData : null;

  const normalizedQuestionData: MetadataEntry = {
    ...(source || {}),
    id: qid,
  };
  const sessionEnvelope = buildMetadataSessionCacheEnvelope(normalizedQuestionData, slug, {
    scoped: enforceScopedIsolation === true,
    includeSlugField: false,
  });
  return {
    ...normalizedQuestionData,
    ...sessionEnvelope.metadata,
  };
};
