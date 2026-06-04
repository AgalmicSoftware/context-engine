import type {
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsAnalysisArtifactCacheNamespace = 'analysisCache';

export type SurveyResultsAnalysisArtifactCacheReadOptions = {
  clone: false;
};

export type SurveyResultsAnalysisArtifactCacheReadPort = (
  namespace: SurveyResultsAnalysisArtifactCacheNamespace,
  slug: string,
  options: SurveyResultsAnalysisArtifactCacheReadOptions
) => unknown;

export type SurveyResultsAnalysisArtifactCacheWritePort = (
  namespace: SurveyResultsAnalysisArtifactCacheNamespace,
  slug: string,
  payload: SurveyResultsRecord
) => Promise<unknown> | unknown;

export type SurveyResultsAnalysisArtifactCacheTarget = {
  namespace: SurveyResultsAnalysisArtifactCacheNamespace;
  slug: string;
  cacheKey: string;
  inputSignature: string;
};

export type SurveyResultsAnalysisArtifactCacheReadRequest = {
  namespace: SurveyResultsAnalysisArtifactCacheNamespace;
  slug: string;
  options: SurveyResultsAnalysisArtifactCacheReadOptions;
};

export type SurveyResultsAnalysisArtifactCacheReadRequestPlan = {
  readRequest: SurveyResultsAnalysisArtifactCacheReadRequest | null;
  shouldRead: boolean;
  skipReason: '' | 'missing-cache-key';
  target: SurveyResultsAnalysisArtifactCacheTarget;
};

export type SurveyResultsAnalysisArtifactCacheKeyArgs = {
  chainId?: unknown;
  inputSignature?: unknown;
  networkLabel?: unknown;
};

export type SurveyResultsAnalysisArtifactCacheReadRequestPlanArgs = {
  cacheKey?: unknown;
  inputSignature?: unknown;
  slug?: unknown;
};

export type SurveyResultsAnalysisArtifactSelectionArgs = {
  cacheValue?: unknown;
  target?: Partial<SurveyResultsAnalysisArtifactCacheTarget> | null;
};

const toRecord = (value: unknown): SurveyResultsRecord => (
  value && typeof value === 'object' ? value as SurveyResultsRecord : {}
);

export const buildSurveyResultsAnalysisArtifactCacheKey = ({
  chainId = '',
  inputSignature = '',
  networkLabel = '',
}: SurveyResultsAnalysisArtifactCacheKeyArgs = {}): string => (
  `sessionResultsAnalysis:v1:${String(networkLabel || chainId || 'unknown')}:${String(inputSignature || '')}`
);

export const buildSurveyResultsAnalysisArtifactCacheReadRequestPlan = ({
  cacheKey = '',
  inputSignature = '',
  slug = '',
}: SurveyResultsAnalysisArtifactCacheReadRequestPlanArgs = {}): SurveyResultsAnalysisArtifactCacheReadRequestPlan => {
  const target: SurveyResultsAnalysisArtifactCacheTarget = {
    namespace: 'analysisCache',
    slug: String(slug || ''),
    cacheKey: String(cacheKey || ''),
    inputSignature: String(inputSignature || ''),
  };

  if (!target.cacheKey) {
    return {
      readRequest: null,
      shouldRead: false,
      skipReason: 'missing-cache-key',
      target,
    };
  }

  return {
    readRequest: {
      namespace: target.namespace,
      slug: target.slug,
      options: { clone: false },
    },
    shouldRead: true,
    skipReason: '',
    target,
  };
};

export const selectSurveyResultsAnalysisArtifactFromCache = ({
  cacheValue = {},
  target = null,
}: SurveyResultsAnalysisArtifactSelectionArgs = {}): SessionResultsGeneratedAnalysisArtifact | null => {
  const cacheKey = String(target?.cacheKey || '');
  const inputSignature = String(target?.inputSignature || '');
  if (!cacheKey) return null;

  const bucket = toRecord(cacheValue);
  const artifacts = toRecord(bucket.sessionResultsAnalysis);
  const artifact = artifacts[cacheKey];
  if (!artifact || typeof artifact !== 'object') return null;
  const selected = artifact as SessionResultsGeneratedAnalysisArtifact;
  return selected.inputSignature === inputSignature ? selected : null;
};
