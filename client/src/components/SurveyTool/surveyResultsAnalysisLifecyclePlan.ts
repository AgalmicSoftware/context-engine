import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

export type SurveyResultsAnalysisLifecyclePlanArgs = {
  allSections?: readonly SessionResultsAnalysisSectionKey[];
  cachedArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  currentArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  inputSignature?: unknown;
  requestedSections?: readonly SessionResultsAnalysisSectionKey[];
};

export type SurveyResultsAnalysisLifecycleBlockedReason = '' | 'missing-analysis-sections';
export type SurveyResultsAnalysisLifecycleStatus = 'ready-artifact' | 'generate-missing-sections' | 'blocked';

export type SurveyResultsAnalysisLifecyclePayloadDescriptor = {
  artifactInputSignature: string;
  artifactPresent: boolean;
  artifactSource: 'current' | 'cache' | 'none';
  availableSections: SessionResultsAnalysisSectionKey[];
  inputSignature: string;
  missingSections: SessionResultsAnalysisSectionKey[];
  requestedSections: SessionResultsAnalysisSectionKey[];
  sectionsToGenerate: SessionResultsAnalysisSectionKey[];
};

export type SurveyResultsAnalysisLifecycleFailureRecovery = {
  canRetry: boolean;
  statePatch: Record<string, unknown>;
  status: 'retryable';
};

export type SurveyResultsAnalysisLifecyclePlan = {
  artifact: SessionResultsGeneratedAnalysisArtifact | null;
  blockedReason: SurveyResultsAnalysisLifecycleBlockedReason;
  failureRecovery: SurveyResultsAnalysisLifecycleFailureRecovery;
  missingSections: SessionResultsAnalysisSectionKey[];
  payloadDescriptor: SurveyResultsAnalysisLifecyclePayloadDescriptor;
  sectionsToGenerate: SessionResultsAnalysisSectionKey[];
  shouldGenerate: boolean;
  statePatch: Record<string, unknown>;
  status: SurveyResultsAnalysisLifecycleStatus;
  target: {
    artifactInputSignature: string;
    inputSignature: string;
    source: 'current' | 'cache' | 'none';
  };
};

const normalizeSections = (
  sections: readonly SessionResultsAnalysisSectionKey[] | undefined
): SessionResultsAnalysisSectionKey[] => (
  Array.isArray(sections) ? sections.filter(Boolean) : []
);

const artifactCoversSections = (
  artifact: SessionResultsGeneratedAnalysisArtifact | null,
  sections: readonly SessionResultsAnalysisSectionKey[]
): boolean => (
  !!artifact &&
  sections.every((section) => !!artifact.sections?.[section]?.available)
);

const getAvailableSections = (
  artifact: SessionResultsGeneratedAnalysisArtifact | null,
  sections: readonly SessionResultsAnalysisSectionKey[]
): SessionResultsAnalysisSectionKey[] => (
  artifact
    ? sections.filter((section) => !!artifact.sections?.[section]?.available)
    : []
);

const buildFailureRecovery = (): SurveyResultsAnalysisLifecycleFailureRecovery => ({
  canRetry: true,
  statePatch: {
    htmlReportAnalysisGenerating: false,
    htmlReportAnalysisError: 'Unable to generate analysis views right now. Check AI settings and try again.',
    htmlReportAnalysisProgress: '',
  },
  status: 'retryable',
});

export const buildSurveyResultsAnalysisLifecyclePlan = ({
  allSections = [],
  cachedArtifact = null,
  currentArtifact = null,
  inputSignature = '',
  requestedSections = [],
}: SurveyResultsAnalysisLifecyclePlanArgs = {}): SurveyResultsAnalysisLifecyclePlan => {
  const normalizedInputSignature = String(inputSignature || '');
  const all = normalizeSections(allSections);
  const requested = normalizeSections(requestedSections);
  const sectionsToGenerate = requested.length > 0
    ? requested
    : all;
  const currentMatches = currentArtifact?.inputSignature === normalizedInputSignature
    ? currentArtifact
    : null;
  const cachedMatches = cachedArtifact?.inputSignature === normalizedInputSignature
    ? cachedArtifact
    : null;
  const artifact = currentMatches || cachedMatches || null;
  const source: SurveyResultsAnalysisLifecyclePlan['target']['source'] =
    currentMatches ? 'current' : cachedMatches ? 'cache' : 'none';
  const target = {
    artifactInputSignature: String(artifact?.inputSignature || ''),
    inputSignature: normalizedInputSignature,
    source,
  };
  const blockedReason: SurveyResultsAnalysisLifecycleBlockedReason = sectionsToGenerate.length > 0
    ? ''
    : 'missing-analysis-sections';
  const failureRecovery = buildFailureRecovery();

  if (blockedReason) {
    const missingSections: SessionResultsAnalysisSectionKey[] = [];
    return {
      artifact,
      blockedReason,
      failureRecovery,
      missingSections,
      payloadDescriptor: {
        artifactInputSignature: target.artifactInputSignature,
        artifactPresent: !!artifact,
        artifactSource: source,
        availableSections: getAvailableSections(artifact, all),
        inputSignature: normalizedInputSignature,
        missingSections,
        requestedSections: requested,
        sectionsToGenerate,
      },
      sectionsToGenerate,
      shouldGenerate: false,
      statePatch: {
        htmlReportAnalysisGenerating: false,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: normalizedInputSignature,
        htmlReportAnalysisProgress: '',
      },
      status: 'blocked',
      target,
    };
  }

  if (artifactCoversSections(artifact, sectionsToGenerate)) {
    const missingSections: SessionResultsAnalysisSectionKey[] = [];
    return {
      artifact,
      blockedReason,
      failureRecovery,
      missingSections,
      payloadDescriptor: {
        artifactInputSignature: target.artifactInputSignature,
        artifactPresent: !!artifact,
        artifactSource: source,
        availableSections: getAvailableSections(artifact, all),
        inputSignature: normalizedInputSignature,
        missingSections,
        requestedSections: requested,
        sectionsToGenerate,
      },
      sectionsToGenerate,
      shouldGenerate: false,
      statePatch: {
        htmlReportAnalysisArtifact: artifact,
        htmlReportAnalysisGenerating: false,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: normalizedInputSignature,
        htmlReportAnalysisProgress: '',
      },
      status: 'ready-artifact',
      target,
    };
  }

  const missingSections = sectionsToGenerate.filter((section) => !artifact?.sections?.[section]?.available);
  return {
    artifact,
    blockedReason,
    failureRecovery,
    missingSections,
    payloadDescriptor: {
      artifactInputSignature: target.artifactInputSignature,
      artifactPresent: !!artifact,
      artifactSource: source,
      availableSections: getAvailableSections(artifact, all),
      inputSignature: normalizedInputSignature,
      missingSections,
      requestedSections: requested,
      sectionsToGenerate,
    },
    sectionsToGenerate,
    shouldGenerate: true,
    statePatch: {
      htmlReportAnalysisGenerating: true,
      htmlReportAnalysisError: '',
      htmlReportAnalysisInputSignature: normalizedInputSignature,
      htmlReportAnalysisProgress: '',
    },
    status: 'generate-missing-sections',
    target,
  };
};
