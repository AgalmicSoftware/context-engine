import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';
import {
  SURVEY_RESULTS_ANALYSIS_FAILURE_MESSAGE,
  type SurveyResultsAnalysisLifecycleStatePatch,
} from './surveyResultsAnalysisLifecyclePlan';

export type SurveyResultsAnalysisGeneratedArtifactCompletionPlanArgs = {
  artifact?: SessionResultsGeneratedAnalysisArtifact | null;
  cacheKey?: unknown;
  failureStatePatch?: SurveyResultsAnalysisLifecycleStatePatch | null;
  inputSignature?: unknown;
  requestedSections?: readonly SessionResultsAnalysisSectionKey[];
  slug?: unknown;
};

export type SurveyResultsAnalysisGeneratedArtifactCompletionBlockedReason =
  | ''
  | 'missing-artifact'
  | 'stale-input-signature';

export type SurveyResultsAnalysisGeneratedArtifactCompletionCacheBlockedReason =
  | ''
  | 'missing-cache-key'
  | 'missing-slug';

export type SurveyResultsAnalysisGeneratedArtifactCompletionCacheWriteDescriptor = {
  payload: SessionResultsGeneratedAnalysisArtifact;
  target: {
    namespace: 'analysisCache';
    slug: string;
    cacheKey: string;
  };
};

export type SurveyResultsAnalysisGeneratedArtifactCompletionPayloadDescriptor = {
  artifactInputSignature: string;
  artifactPresent: boolean;
  availableSections: SessionResultsAnalysisSectionKey[];
  inputSignature: string;
  missingSections: SessionResultsAnalysisSectionKey[];
  requestedSections: SessionResultsAnalysisSectionKey[];
};

export type SurveyResultsAnalysisGeneratedArtifactCompletionPlan = {
  blockedReason: SurveyResultsAnalysisGeneratedArtifactCompletionBlockedReason;
  cacheWriteBlockedReason: SurveyResultsAnalysisGeneratedArtifactCompletionCacheBlockedReason;
  cacheWriteDescriptor: SurveyResultsAnalysisGeneratedArtifactCompletionCacheWriteDescriptor | null;
  failurePatchDescriptor: SurveyResultsAnalysisLifecycleStatePatch | null;
  lifecyclePatchDescriptor: SurveyResultsAnalysisLifecycleStatePatch | null;
  payloadDescriptor: SurveyResultsAnalysisGeneratedArtifactCompletionPayloadDescriptor;
  shouldWriteCache: boolean;
  status: 'usable' | 'skipped';
  target: {
    namespace: 'analysisCache';
    slug: string;
    cacheKey: string;
    inputSignature: string;
    artifactInputSignature: string;
  };
  usable: boolean;
};

const buildFailurePatchDescriptor = (
  override: SurveyResultsAnalysisLifecycleStatePatch | null | undefined
): SurveyResultsAnalysisLifecycleStatePatch => (
  override || {
    htmlReportAnalysisGenerating: false,
    htmlReportAnalysisError: SURVEY_RESULTS_ANALYSIS_FAILURE_MESSAGE,
    htmlReportAnalysisProgress: '',
  }
);

const normalizeSections = (
  sections: readonly SessionResultsAnalysisSectionKey[] | undefined
): SessionResultsAnalysisSectionKey[] => (
  Array.isArray(sections) ? sections.filter(Boolean) : []
);

const getAvailableSections = (
  artifact: SessionResultsGeneratedAnalysisArtifact | null,
  requestedSections: readonly SessionResultsAnalysisSectionKey[]
): SessionResultsAnalysisSectionKey[] => (
  artifact
    ? requestedSections.filter((section) => !!artifact.sections?.[section]?.available)
    : []
);

export const buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan = ({
  artifact = null,
  cacheKey = '',
  failureStatePatch = null,
  inputSignature = '',
  requestedSections = [],
  slug = '',
}: SurveyResultsAnalysisGeneratedArtifactCompletionPlanArgs = {}): SurveyResultsAnalysisGeneratedArtifactCompletionPlan => {
  const normalizedInputSignature = String(inputSignature || '');
  const normalizedArtifact = artifact && artifact.kind === 'ce_session_results_analysis_artifact'
    ? artifact
    : null;
  const artifactInputSignature = String(normalizedArtifact?.inputSignature || '');
  const target = {
    namespace: 'analysisCache' as const,
    slug: String(slug || ''),
    cacheKey: String(cacheKey || ''),
    inputSignature: normalizedInputSignature,
    artifactInputSignature,
  };
  const requested = normalizeSections(requestedSections);
  const availableSections = getAvailableSections(normalizedArtifact, requested);
  const payloadDescriptor = {
    artifactInputSignature,
    artifactPresent: !!normalizedArtifact,
    availableSections,
    inputSignature: normalizedInputSignature,
    missingSections: requested.filter((section) => !availableSections.includes(section)),
    requestedSections: requested,
  };
  const failurePatchDescriptor = buildFailurePatchDescriptor(failureStatePatch);

  const blockedReason: SurveyResultsAnalysisGeneratedArtifactCompletionBlockedReason = !normalizedArtifact
    ? 'missing-artifact'
    : artifactInputSignature !== normalizedInputSignature
      ? 'stale-input-signature'
      : '';

  if (blockedReason) {
    return {
      blockedReason,
      cacheWriteBlockedReason: '',
      cacheWriteDescriptor: null,
      failurePatchDescriptor,
      lifecyclePatchDescriptor: null,
      payloadDescriptor,
      shouldWriteCache: false,
      status: 'skipped',
      target,
      usable: false,
    };
  }

  const completedArtifact = normalizedArtifact as SessionResultsGeneratedAnalysisArtifact;
  const cacheWriteBlockedReason: SurveyResultsAnalysisGeneratedArtifactCompletionCacheBlockedReason = !target.slug
    ? 'missing-slug'
    : !target.cacheKey
      ? 'missing-cache-key'
      : '';

  return {
    blockedReason,
    cacheWriteBlockedReason,
    cacheWriteDescriptor: cacheWriteBlockedReason
      ? null
      : {
        payload: completedArtifact,
        target: {
          namespace: target.namespace,
          slug: target.slug,
          cacheKey: target.cacheKey,
        },
      },
    failurePatchDescriptor: null,
    lifecyclePatchDescriptor: {
      htmlReportAnalysisArtifact: completedArtifact,
      htmlReportAnalysisGenerating: false,
      htmlReportAnalysisError: '',
      htmlReportAnalysisProgress: '',
    },
    payloadDescriptor,
    shouldWriteCache: !cacheWriteBlockedReason,
    status: 'usable',
    target,
    usable: true,
  };
};
