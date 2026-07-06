import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';
import {
  SURVEY_RESULTS_ANALYSIS_FAILURE_MESSAGE,
  type SurveyResultsAnalysisLifecycleStatePatch,
} from './surveyResultsAnalysisLifecyclePlan';
import {
  buildSurveyResultsAnalysisArtifactCacheTarget,
  type SurveyResultsAnalysisArtifactCacheTarget,
} from './surveyResultsAnalysisArtifactCachePorts';

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
  target: SurveyResultsAnalysisArtifactCacheTarget;
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

export type SurveyResultsAnalysisGeneratedArtifactCompletionWritePort = (
  artifact: SessionResultsGeneratedAnalysisArtifact
) => Promise<unknown> | unknown;

export type SurveyResultsAnalysisGeneratedArtifactCompletionRunnerPorts = {
  writeArtifactToCache?: SurveyResultsAnalysisGeneratedArtifactCompletionWritePort;
};

export type SurveyResultsAnalysisGeneratedArtifactCompletionRunnerArgs = {
  plan?: SurveyResultsAnalysisGeneratedArtifactCompletionPlan | null;
  ports?: SurveyResultsAnalysisGeneratedArtifactCompletionRunnerPorts;
};

export type SurveyResultsAnalysisGeneratedArtifactCompletionRunnerResult = {
  cacheWriteAttempted: boolean;
  cacheWriteSucceeded: boolean;
  error: unknown | null;
  errorMessage: string;
  lifecyclePatchDescriptor: SurveyResultsAnalysisLifecycleStatePatch | null;
  ok: boolean;
  plan: SurveyResultsAnalysisGeneratedArtifactCompletionPlan | null;
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
  const cacheTarget = buildSurveyResultsAnalysisArtifactCacheTarget({
    cacheKey,
    inputSignature: normalizedInputSignature,
    slug,
  });
  const target = {
    ...cacheTarget,
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
          inputSignature: target.inputSignature,
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

export const runSurveyResultsAnalysisGeneratedArtifactCompletion = async ({
  plan = null,
  ports = {},
}: SurveyResultsAnalysisGeneratedArtifactCompletionRunnerArgs = {}): Promise<SurveyResultsAnalysisGeneratedArtifactCompletionRunnerResult> => {
  if (!plan?.usable) {
    const blockedReason = plan?.blockedReason || 'missing-artifact';
    return {
      cacheWriteAttempted: false,
      cacheWriteSucceeded: false,
      error: null,
      errorMessage: `Generated analysis artifact completion failed: ${blockedReason}`,
      lifecyclePatchDescriptor: null,
      ok: false,
      plan,
    };
  }

  if (plan.shouldWriteCache && plan.cacheWriteDescriptor) {
    if (typeof ports.writeArtifactToCache !== 'function') {
      return {
        cacheWriteAttempted: false,
        cacheWriteSucceeded: false,
        error: null,
        errorMessage: 'Generated analysis artifact completion cache write port is missing.',
        lifecyclePatchDescriptor: null,
        ok: false,
        plan,
      };
    }

    try {
      await ports.writeArtifactToCache(plan.cacheWriteDescriptor.payload);
    } catch (error) {
      return {
        cacheWriteAttempted: true,
        cacheWriteSucceeded: false,
        error,
        errorMessage: 'Generated analysis artifact completion cache write failed.',
        lifecyclePatchDescriptor: null,
        ok: false,
        plan,
      };
    }
  }

  if (!plan.lifecyclePatchDescriptor) {
    return {
      cacheWriteAttempted: false,
      cacheWriteSucceeded: false,
      error: null,
      errorMessage: 'Generated analysis artifact completion did not produce a lifecycle patch.',
      lifecyclePatchDescriptor: null,
      ok: false,
      plan,
    };
  }

  return {
    cacheWriteAttempted: plan.shouldWriteCache && !!plan.cacheWriteDescriptor,
    cacheWriteSucceeded: plan.shouldWriteCache && !!plan.cacheWriteDescriptor,
    error: null,
    errorMessage: '',
    lifecyclePatchDescriptor: plan.lifecyclePatchDescriptor,
    ok: true,
    plan,
  };
};
