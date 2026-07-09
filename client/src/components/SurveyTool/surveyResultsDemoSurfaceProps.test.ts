import {
  buildSurveyResultsDemoSurfaceProps,
  createSurveyResultsDemoSurfaceParentProps,
  selectSurveyResultsDemoSurfaceQuestionSource,
} from './surveyResultsDemoSurfaceProps';

describe('surveyResultsDemoSurfaceProps', () => {
  it('returns null when alternate demo results are not selected', () => {
    expect(
      buildSurveyResultsDemoSurfaceProps({
        activeSlug: 'session-a',
        getIndividualsAggregator: jest.fn(),
        getPolisQuestionResponses: jest.fn(),
        isDemoAlternateResultsView: false,
        onAtlasModalClose: jest.fn(),
        onAtlasNodeOpen: jest.fn(),
        parentProps: {},
        state: {},
        viewKey: 'report',
      }),
    ).toBeNull();
  });

  it('builds report props from aggregate question responses', () => {
    const aggregateQuestionResponses = { q1: [{ responder: '0x1' }] };
    const questionResponses = { q1: [{ responder: '0x1', response: 'yes' }] };
    const getIndividualsAggregator = jest.fn();
    const getPolisQuestionResponses = jest.fn(() => questionResponses);
    const onAtlasModalClose = jest.fn();
    const onAtlasNodeOpen = jest.fn();

    const props = buildSurveyResultsDemoSurfaceProps({
      activeSlug: 'demo-session',
      getIndividualsAggregator,
      getPolisQuestionResponses,
      isDemoAlternateResultsView: true,
      onAtlasModalClose,
      onAtlasNodeOpen,
      parentProps: {
        defaultTags: ['policy'],
        filterState: { selectedTags: ['policy'] },
        isQuestionCacheReady: true,
        isResponsesCacheReady: false,
        network: { id: 11155420 },
        networkChainId: 11155420,
        questionResponsesNonce: 7,
        questionScanProgress: { scanned: 2 },
      },
      state: {
        demoResultsAtlasNodeId: 'node-1',
        filterState: { selectedTags: ['fallback'] },
        sbtFilteredAggregatorQuestionResponses: aggregateQuestionResponses,
        surveyViewMode: 'aggregate',
        viewMode: 'survey',
      },
      viewKey: 'report',
    });

    expect(getIndividualsAggregator).not.toHaveBeenCalled();
    expect(getPolisQuestionResponses).toHaveBeenCalledWith(true, aggregateQuestionResponses);
    expect(props).toEqual({
      activeSlug: 'demo-session',
      atlasNodeId: 'node-1',
      defaultTags: ['policy'],
      filterState: { selectedTags: ['policy'] },
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      network: { id: 11155420 },
      networkChainId: 11155420,
      onAtlasModalClose,
      onAtlasNodeOpen,
      questionResponses,
      questionResponsesNonce: 7,
      questionScanProgress: { scanned: 2 },
      viewKey: 'report',
    });
  });

  it('uses individual aggregation for survey individual mode and falls back to state filters', () => {
    const filteredResponses = [{ responder: '0x2' }];
    const individualAggregator = { q2: [{ responder: '0x2' }] };
    const questionResponses = { q2: [{ responder: '0x2', response: 'no' }] };
    const getIndividualsAggregator = jest.fn(() => individualAggregator);
    const getPolisQuestionResponses = jest.fn(() => questionResponses);

    const props = buildSurveyResultsDemoSurfaceProps({
      activeSlug: 'demo-session',
      getIndividualsAggregator,
      getPolisQuestionResponses,
      isDemoAlternateResultsView: true,
      onAtlasModalClose: jest.fn(),
      onAtlasNodeOpen: jest.fn(),
      parentProps: {
        filterState: null,
      },
      state: {
        filterState: { selectedTags: ['fallback'] },
        sbtFilteredAggregatorQuestionResponses: { q1: [] },
        sbtFilteredResponses: filteredResponses,
        surveyViewMode: 'individuals',
        viewMode: 'survey',
      },
      viewKey: 'report',
    });

    expect(getIndividualsAggregator).toHaveBeenCalledWith(filteredResponses);
    expect(getPolisQuestionResponses).toHaveBeenCalledWith(true, individualAggregator);
    expect(props?.filterState).toEqual({ selectedTags: ['fallback'] });
    expect(props?.questionResponses).toBe(questionResponses);
  });

  it('defaults aggregate question source to an empty object when missing', () => {
    const source = selectSurveyResultsDemoSurfaceQuestionSource({
      getIndividualsAggregator: jest.fn(),
      state: {
        sbtFilteredAggregatorQuestionResponses: null,
        surveyViewMode: 'aggregate',
        viewMode: 'survey',
      },
    });

    expect(source).toEqual({});
  });

  it('projects parent props used by the demo surface', () => {
    expect(
      createSurveyResultsDemoSurfaceParentProps({
        defaultTags: ['tag'],
        filterState: { selectedTags: ['tag'] },
        ignored: true,
        isQuestionCacheReady: true,
        isResponsesCacheReady: false,
        network: { id: 11155420 },
        networkChainId: 11155420,
        questionResponsesNonce: 3,
        questionScanProgress: { done: 1 },
      }),
    ).toEqual({
      defaultTags: ['tag'],
      filterState: { selectedTags: ['tag'] },
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      network: { id: 11155420 },
      networkChainId: 11155420,
      questionResponsesNonce: 3,
      questionScanProgress: { done: 1 },
    });
  });
});
