import * as sessionResultsExport from '../../utilities/sessionResultsExport';
import type {
  SessionResultsAnalysisParticipant,
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

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

export type SurveyResultsAnalysisArtifactMergeRuntime = {
  mergeGeneratedSessionResultsAnalysisArtifacts: (
    args?: SurveyResultsAnalysisArtifactMergeArgs
  ) => SessionResultsGeneratedAnalysisArtifact | null;
  normalizeGeneratedSessionResultsAnalysisArtifact: (
    args?: SurveyResultsAnalysisArtifactNormalizeArgs
  ) => SessionResultsGeneratedAnalysisArtifact;
};

export type SurveyResultsAnalysisArtifactMergePort = {
  mergeGeneratedArtifacts: (
    args?: SurveyResultsAnalysisArtifactMergeArgs
  ) => SessionResultsGeneratedAnalysisArtifact | null;
  normalizeGeneratedArtifact: (
    args?: SurveyResultsAnalysisArtifactNormalizeArgs
  ) => SessionResultsGeneratedAnalysisArtifact;
};

export type BindSurveyResultsAnalysisArtifactMergePortArgs = {
  runtime: () => SurveyResultsAnalysisArtifactMergeRuntime;
};

export const bindSurveyResultsAnalysisArtifactMergePort = ({
  runtime: readRuntime,
}: BindSurveyResultsAnalysisArtifactMergePortArgs): SurveyResultsAnalysisArtifactMergePort => ({
  mergeGeneratedArtifacts: (args) => (
    args === undefined
      ? readRuntime().mergeGeneratedSessionResultsAnalysisArtifacts()
      : readRuntime().mergeGeneratedSessionResultsAnalysisArtifacts(args)
  ),
  normalizeGeneratedArtifact: (args) => (
    args === undefined
      ? readRuntime().normalizeGeneratedSessionResultsAnalysisArtifact()
      : readRuntime().normalizeGeneratedSessionResultsAnalysisArtifact(args)
  ),
});

export const surveyResultsAnalysisArtifactMergePort = bindSurveyResultsAnalysisArtifactMergePort({
  runtime: () => sessionResultsExport,
});
