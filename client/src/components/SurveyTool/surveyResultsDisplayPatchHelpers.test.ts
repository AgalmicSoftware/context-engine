import {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCsvFileNamePatch,
  buildSurveyResultsDemoAtlasOpenPatch,
  buildSurveyResultsDemoAtlasNodePatch,
  buildSurveyResultsDemoViewSelectPatch,
  buildSurveyResultsExportTypePatch,
  buildSurveyResultsFilterActivePatch,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsViewStatePatch,
} from './surveyResultsDisplayPatchHelpers';

describe('surveyResultsDisplayPatchHelpers', () => {
  it('builds alert, CSV filename, export, and filter patches', () => {
    expect(buildSurveyResultsAlertMessagePatch('No data')).toEqual({
      alertMessage: 'No data',
    });
    expect(buildSurveyResultsAlertMessagePatch(null)).toEqual({
      alertMessage: '',
    });
    expect(buildSurveyResultsCsvFileNamePatch('answers.csv')).toEqual({
      csvFileName: 'answers.csv',
    });
    expect(buildSurveyResultsExportTypePatch('csv-questions')).toEqual({
      exportType: 'csv-questions',
      alertMessage: '',
    });
    expect(buildSurveyResultsFilterActivePatch('active')).toEqual({
      isFilterActive: 'active',
    });
  });

  it('builds demo view and view-mode patches', () => {
    expect(buildSurveyResultsDemoAtlasNodePatch()).toEqual({
      demoResultsAtlasNodeId: null,
    });
    expect(buildSurveyResultsDemoAtlasOpenPatch(' node-a ')).toEqual({
      demoResultsViewMode: 'atlas',
      demoResultsAtlasNodeId: 'node-a',
    });
    expect(buildSurveyResultsDemoAtlasOpenPatch('')).toEqual({
      demoResultsViewMode: 'atlas',
      demoResultsAtlasNodeId: null,
    });
    expect(
      buildSurveyResultsDemoViewSelectPatch({
        nextView: 'breakdown',
        prevState: { demoResultsViewMode: 'breakdown', demoResultsAtlasNodeId: 'node-a' },
      }),
    ).toEqual({
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
    });
    expect(
      buildSurveyResultsDemoViewSelectPatch({
        nextView: 'atlas',
        prevState: { demoResultsViewMode: 'report', demoResultsAtlasNodeId: 'node-a' },
      }),
    ).toEqual({
      demoResultsViewMode: 'atlas',
      demoResultsAtlasNodeId: 'node-a',
    });
    expect(
      buildSurveyResultsDemoViewSelectPatch({
        nextView: 'unknown',
        prevState: { demoResultsViewMode: 'atlas', demoResultsAtlasNodeId: 'node-a' },
      }),
    ).toEqual({
      demoResultsViewMode: 'report',
      demoResultsAtlasNodeId: null,
    });
    expect(buildSurveyResultsViewStatePatch('survey', '0x1')).toEqual({
      viewMode: 'survey',
      surveyId: '0x1',
    });
    expect(buildSurveyResultsSurveyViewModePatch('aggregate')).toEqual({
      surveyViewMode: 'aggregate',
    });
  });

  it('builds generic toggle and sort patches', () => {
    expect(
      buildSurveyResultsBooleanTogglePatch({
        prevState: { showQuestionFilter: false },
        stateKey: 'showQuestionFilter',
      }),
    ).toEqual({ showQuestionFilter: true });
    expect(
      buildSurveyResultsBooleanTogglePatch({
        prevState: { exportAreaOpen: true },
        stateKey: 'exportAreaOpen',
      }),
    ).toEqual({ exportAreaOpen: false });
    expect(buildSurveyResultsBooleanTogglePatch()).toEqual({});
    expect(
      buildSurveyResultsKeyedTogglePatch({
        itemKey: 'q1',
        mapKey: 'activeQuestionToggles',
        prevState: { activeQuestionToggles: { q1: false, q2: true } },
      }),
    ).toEqual({
      activeQuestionToggles: { q1: true, q2: true },
    });
    expect(
      buildSurveyResultsKeyedTogglePatch({
        forceValue: true,
        itemKey: 'q1',
        mapKey: 'activeQuestionToggles',
        prevState: { activeQuestionToggles: { q1: false } },
      }),
    ).toEqual({
      activeQuestionToggles: { q1: true },
    });
    expect(buildSurveyResultsKeyedTogglePatch()).toEqual({});
    expect(
      buildSurveyResultsQuestionIdSortPatch({
        column: 'questionId',
        prevState: { questionIdSortBy: 'questionId', questionIdSortAsc: true },
      }),
    ).toEqual({
      questionIdSortBy: 'questionId',
      questionIdSortAsc: false,
    });
    expect(
      buildSurveyResultsQuestionIdSortPatch({
        column: 'responses',
        prevState: { questionIdSortBy: 'questionId', questionIdSortAsc: false },
      }),
    ).toEqual({
      questionIdSortBy: 'responses',
      questionIdSortAsc: true,
    });
  });

  it('builds bookmark display patches without mutating caller arrays', () => {
    const surveyIds = ['s1'];
    const questionIds = ['q1'];

    expect(buildSurveyResultsBookmarkedSurveyIdsPatch(surveyIds)).toEqual({
      bookmarkedSurveyIDs: ['s1'],
    });
    expect(buildSurveyResultsBookmarkedSurveyIdsPatch(surveyIds).bookmarkedSurveyIDs).not.toBe(surveyIds);
    expect(buildSurveyResultsBookmarkedQuestionIdsPatch(questionIds)).toEqual({
      bookmarkedQuestionIDs: ['q1'],
    });
    expect(buildSurveyResultsBookmarkedQuestionIdsPatch(null)).toEqual({
      bookmarkedQuestionIDs: [],
    });
  });
});
