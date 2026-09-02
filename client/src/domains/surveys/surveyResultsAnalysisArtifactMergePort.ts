import * as sessionResultsExport from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';
import type {
  SessionResultsAnalysisParticipant,
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';

export type SurveyResultsAnalysisArtifactNormalizeArgs = {
  generatedAt?: unknown;
  inputSignature?: unknown;
  model?: unknown;
  participants?: SessionResultsAnalysisParticipant[];
  rawOutput?: unknown;
};

export type SurveyResultsAnalysisArtifactMergeArgs = {
  base?: SessionResultsGeneratedAnalysisArtifact | null;
  next?: SessionResultsGeneratedAnalysisArtifact | null;
  sections?: readonly SessionResultsAnalysisSectionKey[];
};

export type SurveyResultsAnalysisArtifactMergePort = {
  mergeGeneratedArtifacts: (
    args?: SurveyResultsAnalysisArtifactMergeArgs,
  ) => SessionResultsGeneratedAnalysisArtifact | null;
  normalizeGeneratedArtifact: (
    args?: SurveyResultsAnalysisArtifactNormalizeArgs,
  ) => SessionResultsGeneratedAnalysisArtifact;
};

export const surveyResultsAnalysisArtifactMergePort: SurveyResultsAnalysisArtifactMergePort = {
  mergeGeneratedArtifacts: (args) =>
    args === undefined
      ? sessionResultsExport.mergeGeneratedSessionResultsAnalysisArtifacts()
      : sessionResultsExport.mergeGeneratedSessionResultsAnalysisArtifacts(args),
  normalizeGeneratedArtifact: (args) =>
    args === undefined
      ? sessionResultsExport.normalizeGeneratedSessionResultsAnalysisArtifact()
      : sessionResultsExport.normalizeGeneratedSessionResultsAnalysisArtifact(args),
};
