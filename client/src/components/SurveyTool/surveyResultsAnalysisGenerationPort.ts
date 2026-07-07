import * as aiClientModule from '../../utilities/ai/aiClient.js';

export type SurveyResultsAnalysisGenerationCallOptions = {
  maxTokens: number;
  response_format: { type: 'json_object' };
  sessionSlug: string;
  taskType: 'analysis';
  thinking: true;
};

export type SurveyResultsAnalysisGenerationRequest = {
  maxTokens: number;
  prompt: string;
  sessionSlug: string;
};

export type SurveyResultsAnalysisGenerationPort = {
  generateSection: (request: SurveyResultsAnalysisGenerationRequest) => Promise<unknown>;
};

export type SurveyResultsAiScriptsModule = {
  callAI: (prompt: string, options: SurveyResultsAnalysisGenerationCallOptions) => Promise<unknown> | unknown;
};

export type BindSurveyResultsAnalysisGenerationPortArgs = {
  aiClient: () => SurveyResultsAiClientModule;
};

export const bindSurveyResultsAnalysisGenerationPort = ({
  aiClient,
}: BindSurveyResultsAnalysisGenerationPortArgs): SurveyResultsAnalysisGenerationPort => ({
  generateSection: async ({ maxTokens, prompt, sessionSlug }) =>
    aiScripts().callAI(prompt, {
      maxTokens,
      response_format: { type: 'json_object' },
      sessionSlug,
      taskType: 'analysis',
      thinking: true,
    }),
});

export const surveyResultsAnalysisGenerationPort = bindSurveyResultsAnalysisGenerationPort({
  aiClient: () => aiClientModule as SurveyResultsAiClientModule,
});
