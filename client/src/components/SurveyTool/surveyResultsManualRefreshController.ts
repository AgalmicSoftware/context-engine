export type SurveyResultsManualRefreshDispatchControllerPorts = {
  onQuestionMetadataRefreshAvailable?: () => unknown;
  refreshQuestionMetadata?: () => unknown | Promise<unknown>;
  refreshQuestionResponses?: () => unknown | Promise<unknown>;
  refreshSurveyResponsesByID?: (surveyId: string) => unknown | Promise<unknown>;
};

export type SurveyResultsManualRefreshDispatchControllerArgs = {
  ports?: SurveyResultsManualRefreshDispatchControllerPorts;
  surveyId?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsManualRefreshDispatchControllerResult = {
  dispatched: string[];
  status: 'inert' | 'questions' | 'survey';
  surveyId: string;
};

export const runSurveyResultsManualRefreshDispatchController = async ({
  ports = {},
  surveyId = '',
  viewMode = '',
}: SurveyResultsManualRefreshDispatchControllerArgs = {}): Promise<SurveyResultsManualRefreshDispatchControllerResult> => {
  const normalizedViewMode = String(viewMode || '');
  const normalizedSurveyId = String(surveyId || '').toLowerCase();
  const dispatched: string[] = [];

  if (normalizedViewMode === 'questions') {
    if (typeof ports.refreshQuestionMetadata === 'function') {
      if (typeof ports.onQuestionMetadataRefreshAvailable === 'function') {
        ports.onQuestionMetadataRefreshAvailable();
      }
      await ports.refreshQuestionMetadata();
      dispatched.push('questionMetadata');
    }
    if (typeof ports.refreshQuestionResponses === 'function') {
      await ports.refreshQuestionResponses();
      dispatched.push('questionResponses');
    }
    return {
      dispatched,
      status: dispatched.length > 0 ? 'questions' : 'inert',
      surveyId: '',
    };
  }

  if (normalizedViewMode === 'survey' && normalizedSurveyId && typeof ports.refreshSurveyResponsesByID === 'function') {
    await ports.refreshSurveyResponsesByID(normalizedSurveyId);
    dispatched.push('surveyResponses');
    return {
      dispatched,
      status: 'survey',
      surveyId: normalizedSurveyId,
    };
  }

  return {
    dispatched,
    status: 'inert',
    surveyId: normalizedSurveyId,
  };
};
