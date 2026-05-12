import { sanitizeDocumentUrls } from './createQuestionsAndSurveysDocumentUrlHelpers';

export type CreateSurveyHashDigest = (value: unknown) => {
  toString: () => string;
};

export const buildCreateSurveyHashValue = ({
  digest,
  documentURLs = [],
  isStandaloneQuestion = false,
  title = '',
}: {
  digest: CreateSurveyHashDigest;
  documentURLs?: unknown;
  isStandaloneQuestion?: unknown;
  title?: unknown;
}): string => {
  if (isStandaloneQuestion) return '';
  const urlsForHash = sanitizeDocumentUrls(Array.isArray(documentURLs) ? documentURLs : []);
  const surveyData = { title, documentURLs: urlsForHash };
  return `0x${digest(JSON.stringify(surveyData)).toString()}`;
};
