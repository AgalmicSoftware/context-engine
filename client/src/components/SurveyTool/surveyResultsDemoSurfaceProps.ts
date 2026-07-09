import type { SurveyResultsDemoSurfaceProps } from './SurveyResultsDemoSurface';

type SurveyResultsDemoSurfaceRecord = Record<string, unknown>;

export type SurveyResultsDemoSurfaceParentProps = {
  defaultTags?: SurveyResultsDemoSurfaceProps['defaultTags'];
  filterState?: SurveyResultsDemoSurfaceProps['filterState'] | null;
  isQuestionCacheReady?: SurveyResultsDemoSurfaceProps['isQuestionCacheReady'];
  isResponsesCacheReady?: SurveyResultsDemoSurfaceProps['isResponsesCacheReady'];
  network?: SurveyResultsDemoSurfaceProps['network'];
  networkChainId?: SurveyResultsDemoSurfaceProps['networkChainId'];
  questionResponsesNonce?: SurveyResultsDemoSurfaceProps['questionResponsesNonce'];
  questionScanProgress?: SurveyResultsDemoSurfaceProps['questionScanProgress'];
};

export type SurveyResultsDemoSurfaceState = {
  demoResultsAtlasNodeId?: unknown;
  filterState?: SurveyResultsDemoSurfaceProps['filterState'] | null;
  sbtFilteredAggregatorQuestionResponses?: unknown;
  sbtFilteredResponses?: unknown;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsDemoSurfaceQuestionResponsePort = (
  selected: true,
  sourceAggregator: unknown,
) => SurveyResultsDemoSurfaceProps['questionResponses'];

export type SurveyResultsDemoSurfacePropsInput = {
  activeSlug: string;
  getIndividualsAggregator: (individualResponses: unknown) => unknown;
  getPolisQuestionResponses: SurveyResultsDemoSurfaceQuestionResponsePort;
  isDemoAlternateResultsView: boolean;
  onAtlasModalClose: SurveyResultsDemoSurfaceProps['onAtlasModalClose'];
  onAtlasNodeOpen: SurveyResultsDemoSurfaceProps['onAtlasNodeOpen'];
  parentProps: SurveyResultsDemoSurfaceParentProps;
  state: SurveyResultsDemoSurfaceState;
  viewKey: SurveyResultsDemoSurfaceProps['viewKey'];
};

export const selectSurveyResultsDemoSurfaceQuestionSource = ({
  getIndividualsAggregator,
  state,
}: {
  getIndividualsAggregator: (individualResponses: unknown) => unknown;
  state: SurveyResultsDemoSurfaceState;
}): unknown => {
  if (state.viewMode === 'survey' && state.surveyViewMode === 'individuals') {
    return getIndividualsAggregator(state.sbtFilteredResponses);
  }
  return state.sbtFilteredAggregatorQuestionResponses || {};
};

export const buildSurveyResultsDemoSurfaceProps = ({
  activeSlug,
  getIndividualsAggregator,
  getPolisQuestionResponses,
  isDemoAlternateResultsView,
  onAtlasModalClose,
  onAtlasNodeOpen,
  parentProps,
  state,
  viewKey,
}: SurveyResultsDemoSurfacePropsInput): SurveyResultsDemoSurfaceProps | null => {
  if (!isDemoAlternateResultsView) {
    return null;
  }

  const questionSource = selectSurveyResultsDemoSurfaceQuestionSource({
    getIndividualsAggregator,
    state,
  });

  return {
    activeSlug,
    atlasNodeId: state.demoResultsAtlasNodeId,
    defaultTags: parentProps.defaultTags,
    filterState: parentProps.filterState || state.filterState,
    isQuestionCacheReady: parentProps.isQuestionCacheReady,
    isResponsesCacheReady: parentProps.isResponsesCacheReady,
    network: parentProps.network,
    networkChainId: parentProps.networkChainId,
    onAtlasModalClose,
    onAtlasNodeOpen,
    questionResponses: getPolisQuestionResponses(true, questionSource),
    questionResponsesNonce: parentProps.questionResponsesNonce,
    questionScanProgress: parentProps.questionScanProgress,
    viewKey,
  };
};

export const createSurveyResultsDemoSurfaceParentProps = (
  parentProps: SurveyResultsDemoSurfaceRecord,
): SurveyResultsDemoSurfaceParentProps => ({
  defaultTags: parentProps.defaultTags as SurveyResultsDemoSurfaceParentProps['defaultTags'],
  filterState: parentProps.filterState as SurveyResultsDemoSurfaceParentProps['filterState'],
  isQuestionCacheReady: parentProps.isQuestionCacheReady as SurveyResultsDemoSurfaceParentProps['isQuestionCacheReady'],
  isResponsesCacheReady:
    parentProps.isResponsesCacheReady as SurveyResultsDemoSurfaceParentProps['isResponsesCacheReady'],
  network: parentProps.network as SurveyResultsDemoSurfaceParentProps['network'],
  networkChainId: parentProps.networkChainId as SurveyResultsDemoSurfaceParentProps['networkChainId'],
  questionResponsesNonce:
    parentProps.questionResponsesNonce as SurveyResultsDemoSurfaceParentProps['questionResponsesNonce'],
  questionScanProgress: parentProps.questionScanProgress as SurveyResultsDemoSurfaceParentProps['questionScanProgress'],
});
