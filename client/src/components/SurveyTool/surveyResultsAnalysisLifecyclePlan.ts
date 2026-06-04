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

export type SurveyResultsAnalysisLifecyclePlan = {
  artifact: SessionResultsGeneratedAnalysisArtifact | null;
  missingSections: SessionResultsAnalysisSectionKey[];
  sectionsToGenerate: SessionResultsAnalysisSectionKey[];
  shouldGenerate: boolean;
  statePatch: Record<string, unknown>;
  status: 'ready-artifact' | 'generate-missing-sections';
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

export const buildSurveyResultsAnalysisLifecyclePlan = ({
  allSections = [],
  cachedArtifact = null,
  currentArtifact = null,
  inputSignature = '',
  requestedSections = [],
}: SurveyResultsAnalysisLifecyclePlanArgs = {}): SurveyResultsAnalysisLifecyclePlan => {
  const normalizedInputSignature = String(inputSignature || '');
  const requested = normalizeSections(requestedSections);
  const sectionsToGenerate = requested.length > 0
    ? requested
    : normalizeSections(allSections);
  const currentMatches = currentArtifact?.inputSignature === normalizedInputSignature
    ? currentArtifact
    : null;
  const artifact = currentMatches || cachedArtifact || null;
  const source: SurveyResultsAnalysisLifecyclePlan['target']['source'] =
    currentMatches ? 'current' : cachedArtifact ? 'cache' : 'none';
  const target = {
    artifactInputSignature: String(artifact?.inputSignature || ''),
    inputSignature: normalizedInputSignature,
    source,
  };

  if (artifactCoversSections(artifact, sectionsToGenerate)) {
    return {
      artifact,
      missingSections: [],
      sectionsToGenerate,
      shouldGenerate: false,
      statePatch: {
        htmlReportAnalysisArtifact: artifact,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: normalizedInputSignature,
        htmlReportAnalysisProgress: '',
      },
      status: 'ready-artifact',
      target,
    };
  }

  return {
    artifact,
    missingSections: sectionsToGenerate.filter((section) => !artifact?.sections?.[section]?.available),
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
