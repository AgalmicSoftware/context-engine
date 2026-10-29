type DraftContentState = {
  title: string;
  questions: Array<Record<string, unknown>>;
  documentURLs: string[];
  docURLInput: string;
  isStandaloneQuestion: boolean;
  associatedSurveyId: string;
  surveyLockGateIds: string[];
};

export const createSurveyDraftContentKey = (state: DraftContentState): string =>
  JSON.stringify({
    title: state.title,
    questions: state.questions.map(({ uiKey, aiGeneratedTagsFromSource, isGeneratingTags, ...question }) => question),
    documentURLs: state.documentURLs,
    docURLInput: state.docURLInput,
    isStandaloneQuestion: state.isStandaloneQuestion,
    associatedSurveyId: state.associatedSurveyId,
    surveyLockGateIds: state.surveyLockGateIds,
  });
