import {
  buildSurveyResultsAnalysisArtifactCacheTarget,
  type SurveyResultsAnalysisArtifactCacheTarget,
} from './surveyResultsAnalysisArtifactCachePorts';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsBookmarkWriteKind = 'survey' | 'question';

export type SurveyResultsAnalysisArtifactWritePlanArgs = {
  artifact?: unknown;
  cacheKey?: unknown;
  currentCache?: unknown;
  inputSignature?: unknown;
  slug?: unknown;
};

export type SurveyResultsAnalysisArtifactWriteReadinessPlanArgs = Omit<
  SurveyResultsAnalysisArtifactWritePlanArgs,
  'currentCache'
>;

export type SurveyResultsAnalysisArtifactWriteReadinessPlan = {
  blockedReason: '' | 'missing-artifact' | 'missing-cache-key';
  shouldReadCache: boolean;
  shouldWrite: boolean;
  target: SurveyResultsAnalysisArtifactCacheTarget;
};

export type SurveyResultsAnalysisArtifactWritePlan = {
  blockedReason: '' | 'missing-artifact' | 'missing-cache-key';
  payload: SurveyResultsRecord | null;
  shouldWrite: boolean;
  target: SurveyResultsAnalysisArtifactCacheTarget;
};

export type SurveyResultsSurveyQuestionBookmarkWritePlanArgs = {
  bookmarkId?: unknown;
  bookmarkType?: unknown;
  bookmarksCache?: unknown;
  slug?: unknown;
};

export type SurveyResultsSurveyQuestionBookmarkWritePlan = {
  blockedReason: '' | 'invalid-bookmark-type';
  payload: SurveyResultsRecord | null;
  shouldWrite: boolean;
  statePatch: {
    key: 'bookmarkedSurveyIDs' | 'bookmarkedQuestionIDs';
    value: unknown[];
  } | null;
  target: {
    namespace: 'bookmarksCache';
    slug: string;
  };
  toggled: {
    action: 'add' | 'remove';
    bookmarkType: SurveyResultsBookmarkWriteKind;
    id: unknown;
  } | null;
};

const toRecord = (value: unknown): SurveyResultsRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsRecord) : {};

export const buildSurveyResultsAnalysisArtifactWriteReadinessPlan = ({
  artifact = null,
  cacheKey = '',
  inputSignature = '',
  slug = '',
}: SurveyResultsAnalysisArtifactWriteReadinessPlanArgs = {}): SurveyResultsAnalysisArtifactWriteReadinessPlan => {
  const cacheTarget = buildSurveyResultsAnalysisArtifactCacheTarget({
    cacheKey,
    inputSignature,
    slug,
  });
  const target = cacheTarget;

  if (!artifact || typeof artifact !== 'object') {
    return {
      blockedReason: 'missing-artifact',
      shouldReadCache: false,
      shouldWrite: false,
      target,
    };
  }

  if (!target.cacheKey) {
    return {
      blockedReason: 'missing-cache-key',
      shouldReadCache: false,
      shouldWrite: false,
      target,
    };
  }

  return {
    blockedReason: '',
    shouldReadCache: true,
    shouldWrite: true,
    target,
  };
};

export const buildSurveyResultsAnalysisArtifactWritePlan = ({
  artifact = null,
  cacheKey = '',
  currentCache = {},
  inputSignature = '',
  slug = '',
}: SurveyResultsAnalysisArtifactWritePlanArgs = {}): SurveyResultsAnalysisArtifactWritePlan => {
  const readinessPlan = buildSurveyResultsAnalysisArtifactWriteReadinessPlan({
    artifact,
    cacheKey,
    inputSignature,
    slug,
  });

  if (!readinessPlan.shouldReadCache) {
    return {
      blockedReason: readinessPlan.blockedReason,
      payload: null,
      shouldWrite: false,
      target: readinessPlan.target,
    };
  }

  const currentCacheRecord = toRecord(currentCache);
  const artifacts = toRecord(currentCacheRecord.sessionResultsAnalysis);

  return {
    blockedReason: '',
    payload: {
      ...currentCacheRecord,
      sessionResultsAnalysis: {
        ...artifacts,
        [readinessPlan.target.cacheKey]: artifact,
      },
    },
    shouldWrite: true,
    target: readinessPlan.target,
  };
};

export const buildSurveyResultsSurveyQuestionBookmarkWritePlan = ({
  bookmarkId,
  bookmarkType,
  bookmarksCache = {},
  slug = '',
}: SurveyResultsSurveyQuestionBookmarkWritePlanArgs = {}): SurveyResultsSurveyQuestionBookmarkWritePlan => {
  const target = {
    namespace: 'bookmarksCache' as const,
    slug: String(slug || ''),
  };

  if (bookmarkType !== 'survey' && bookmarkType !== 'question') {
    return {
      blockedReason: 'invalid-bookmark-type',
      payload: null,
      shouldWrite: false,
      statePatch: null,
      target,
      toggled: null,
    };
  }

  const bookmarksCacheRecord = toRecord(bookmarksCache);
  const surveys = Array.isArray(bookmarksCacheRecord.surveys) ? [...bookmarksCacheRecord.surveys] : [];
  const questions = Array.isArray(bookmarksCacheRecord.questions) ? [...bookmarksCacheRecord.questions] : [];
  const targetList = bookmarkType === 'survey' ? surveys : questions;
  const bookmarkIndex = targetList.indexOf(bookmarkId);
  const action = bookmarkIndex > -1 ? 'remove' : 'add';

  if (bookmarkIndex > -1) {
    targetList.splice(bookmarkIndex, 1);
  } else {
    targetList.push(bookmarkId);
  }

  const nextSurveys = bookmarkType === 'survey' ? targetList : surveys;
  const nextQuestions = bookmarkType === 'question' ? targetList : questions;

  return {
    blockedReason: '',
    payload: {
      ...bookmarksCacheRecord,
      surveys: nextSurveys,
      questions: nextQuestions,
    },
    shouldWrite: true,
    statePatch: {
      key: bookmarkType === 'survey' ? 'bookmarkedSurveyIDs' : 'bookmarkedQuestionIDs',
      value: bookmarkType === 'survey' ? nextSurveys : nextQuestions,
    },
    target,
    toggled: {
      action,
      bookmarkType,
      id: bookmarkId,
    },
  };
};
