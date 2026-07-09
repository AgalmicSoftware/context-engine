type UnknownRecord = Record<string, unknown>;

export type BuildSurveyResultsBooleanTogglePatchArgs = {
  prevState?: unknown;
  stateKey?: unknown;
};

export type BuildSurveyResultsKeyedTogglePatchArgs = {
  forceValue?: unknown;
  itemKey?: unknown;
  mapKey?: unknown;
  prevState?: unknown;
};

export type BuildSurveyResultsQuestionIdSortPatchArgs = {
  column?: unknown;
  prevState?: unknown;
};

export type BuildSurveyResultsDemoViewSelectPatchArgs = {
  nextView?: unknown;
  prevState?: unknown;
};

export const buildSurveyResultsAlertMessagePatch = (alertMessage: unknown) => ({
  alertMessage: String(alertMessage ?? ''),
});

export const buildSurveyResultsCsvFileNamePatch = (csvFileName: unknown) => ({
  csvFileName,
});

export const buildSurveyResultsExportTypePatch = (exportType: unknown) => ({
  exportType,
  alertMessage: '',
});

export const buildSurveyResultsFilterActivePatch = (isFilterActive: unknown) => ({
  isFilterActive,
});

export const buildSurveyResultsBooleanTogglePatch = ({
  prevState = {},
  stateKey = '',
}: BuildSurveyResultsBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  if (!key) return {};
  const stateRecord = prevState && typeof prevState === 'object' ? (prevState as UnknownRecord) : {};
  return { [key]: !stateRecord[key] };
};

export const buildSurveyResultsKeyedTogglePatch = ({
  forceValue,
  itemKey,
  mapKey = '',
  prevState = {},
}: BuildSurveyResultsKeyedTogglePatchArgs = {}): Record<string, UnknownRecord> => {
  const mapName = String(mapKey || '');
  if (!mapName) return {};
  const stateRecord = prevState && typeof prevState === 'object' ? (prevState as UnknownRecord) : {};
  const currentMap =
    stateRecord[mapName] && typeof stateRecord[mapName] === 'object' ? (stateRecord[mapName] as UnknownRecord) : {};
  const key = String(itemKey);
  const nextValue = typeof forceValue === 'boolean' ? forceValue : !currentMap[key];
  return {
    [mapName]: {
      ...currentMap,
      [key]: nextValue,
    },
  };
};

export const buildSurveyResultsQuestionIdSortPatch = ({
  column = '',
  prevState = {},
}: BuildSurveyResultsQuestionIdSortPatchArgs = {}): {
  questionIdSortAsc: boolean;
  questionIdSortBy: unknown;
} => {
  const stateRecord = prevState && typeof prevState === 'object' ? (prevState as UnknownRecord) : {};
  const nextAsc = stateRecord.questionIdSortBy === column ? !stateRecord.questionIdSortAsc : true;
  return {
    questionIdSortBy: column,
    questionIdSortAsc: nextAsc,
  };
};

export const buildSurveyResultsDemoAtlasNodePatch = (demoResultsAtlasNodeId: unknown = null) => ({
  demoResultsAtlasNodeId,
});

export const buildSurveyResultsDemoAtlasOpenPatch = (nodeId: unknown = '') => {
  const normalizedNodeId = String(nodeId || '').trim();
  return {
    demoResultsViewMode: 'atlas',
    demoResultsAtlasNodeId: normalizedNodeId || null,
  };
};

export const buildSurveyResultsDemoViewSelectPatch = ({
  nextView = 'report',
  prevState = {},
}: BuildSurveyResultsDemoViewSelectPatchArgs = {}) => {
  const allowedViews = new Set(['report', 'breakdown', 'atlas', 'riskMatrix']);
  const normalizedView = allowedViews.has(String(nextView)) ? String(nextView) : 'report';
  const stateRecord = prevState && typeof prevState === 'object' ? (prevState as UnknownRecord) : {};
  return {
    demoResultsViewMode: stateRecord.demoResultsViewMode === normalizedView ? 'raw' : normalizedView,
    demoResultsAtlasNodeId: normalizedView === 'atlas' ? stateRecord.demoResultsAtlasNodeId : null,
  };
};

export const buildSurveyResultsViewStatePatch = (viewMode: unknown, surveyId: unknown) => ({
  viewMode,
  surveyId,
});

export const buildSurveyResultsSurveyViewModePatch = (surveyViewMode: unknown) => ({
  surveyViewMode,
});

export const buildSurveyResultsBookmarkFeedbackPatch = (filterBookmarkedFeedback: unknown) => ({
  filterBookmarkedFeedback: !!filterBookmarkedFeedback,
});

export const buildSurveyResultsBookmarkedSurveyIdsPatch = (bookmarkedSurveyIDs: unknown = []) => ({
  bookmarkedSurveyIDs: Array.isArray(bookmarkedSurveyIDs) ? [...bookmarkedSurveyIDs] : [],
});

export const buildSurveyResultsBookmarkedQuestionIdsPatch = (bookmarkedQuestionIDs: unknown = []) => ({
  bookmarkedQuestionIDs: Array.isArray(bookmarkedQuestionIDs) ? [...bookmarkedQuestionIDs] : [],
});
