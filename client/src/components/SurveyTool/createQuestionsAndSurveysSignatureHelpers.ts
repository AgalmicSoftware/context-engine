import { sanitizeDocumentUrls } from './createQuestionsAndSurveysDocumentUrlHelpers';

export type CreateSurveyHashDigest = (value: string) => string;

export const buildCreateSurveyHashValue = ({
  author = '',
  digest,
  documentURLs = [],
  isStandaloneQuestion = false,
  title = '',
}: {
  author?: unknown;
  digest: CreateSurveyHashDigest;
  documentURLs?: unknown;
  isStandaloneQuestion?: unknown;
  title?: unknown;
}): string => {
  if (isStandaloneQuestion) return '';
  const urlsForHash = sanitizeDocumentUrls(Array.isArray(documentURLs) ? documentURLs : []);
  // New surveys also hash their author, so two authors with the same title and
  // documents get different ids (Session Workers let only an id's first author
  // reuse it). The same author re-publishing keeps one id. Without an author,
  // the original title-and-documents id is unchanged.
  const normalizedAuthor = typeof author === 'string' ? author.trim().toLowerCase() : '';
  const surveyData = normalizedAuthor
    ? { title, documentURLs: urlsForHash, author: normalizedAuthor }
    : { title, documentURLs: urlsForHash };
  return `0x${digest(JSON.stringify(surveyData))}`;
};
