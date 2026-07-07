import {
  areSurveySpecificQuestionsLoaded,
  buildQuestionsDashboardFilterLoadingPatch,
  buildQuestionsDashboardFilteredQuestionsPatch,
  buildQuestionsDashboardNoNetworkPatch,
  buildSurveySelectorCopySuccessPatch,
  buildSurveySelectorEmptySurveyListPatch,
  buildSurveySelectorFilterActivePatch,
  buildSurveySelectorFilterStatePatch,
  buildSurveySelectorLoadedSurveysPatch,
  buildSurveySelectorLoadingPatch,
  buildSurveySelectorPendingSubmitStatsPatch,
  buildSurveySelectorPubKeyPatch,
  buildSurveySelectorQuestionCountPatch,
  buildSurveySelectorSelectSurveyPatch,
  buildSurveySelectorSelectedTypesPatch,
  buildSurveySelectorShowLongLoadingPatch,
  buildSurveySelectorShowResultsPatch,
  buildSurveySelectorSubmittedSurveyList,
  buildSurveySelectorViewModePatch,
  getDefaultSurveySelectorPendingSubmitStats,
  getSurveyDocumentLinkTitle,
  getSurveyDocumentUrls,
  resolveSelectedSurveyIndex,
  resolveSurveyIdToCopy,
} from './surveySelectorHelpers.js';

describe('surveySelectorHelpers document URLs', () => {
  it('trims string document URLs and drops blanks or non-strings', () => {
    expect(
      getSurveyDocumentUrls({
        documentURLs: [' https://example.com/one ', '', '   ', 12, 'ar://abc123'],
      }),
    ).toEqual(['https://example.com/one', 'ar://abc123']);
  });

  it('returns an empty list when no document URL array exists', () => {
    expect(getSurveyDocumentUrls({ documentURLs: 'https://example.com' })).toEqual([]);
    expect(getSurveyDocumentUrls(null)).toEqual([]);
  });

  it('uses the only document URL as the title for single-document surveys', () => {
    expect(
      getSurveyDocumentLinkTitle({
        documentURLs: [' https://example.com/one '],
      }),
    ).toBe('https://example.com/one');
  });

  it('summarizes multiple document URLs for link titles', () => {
    expect(
      getSurveyDocumentLinkTitle({
        documentURLs: ['https://example.com/one', 'https://example.com/two'],
      }),
    ).toBe('2 documents');
  });
});

describe('surveySelectorHelpers copy survey id resolution', () => {
  it('prefers explicit survey IDs over URL and selected survey fallbacks', () => {
    expect(
      resolveSurveyIdToCopy({
        surveyID: 'explicit-id',
        search: '?surveyID=url-id',
        surveys: [{ id: 'selected-id' }],
        selectedSurveyIndex: 0,
      }),
    ).toBe('explicit-id');
  });

  it('uses URL surveyID before selected survey fallback', () => {
    expect(
      resolveSurveyIdToCopy({
        search: '?surveyID=url-id',
        surveys: [{ id: 'selected-id' }],
        selectedSurveyIndex: 0,
      }),
    ).toBe('url-id');
  });

  it('falls back to the selected survey id', () => {
    expect(
      resolveSurveyIdToCopy({
        search: '?unrelated=true',
        surveys: [{ id: 'first-id' }, { id: 'selected-id' }],
        selectedSurveyIndex: 1,
      }),
    ).toBe('selected-id');
  });

  it('returns null when no survey id source exists', () => {
    expect(
      resolveSurveyIdToCopy({
        search: '?unrelated=true',
        surveys: [],
        selectedSurveyIndex: null,
      }),
    ).toBeNull();
  });
});

describe('surveySelectorHelpers pending submit stats', () => {
  it('returns a fresh default pending-submit stats object', () => {
    const first = getDefaultSurveySelectorPendingSubmitStats();
    const second = getDefaultSurveySelectorPendingSubmitStats();

    expect(first).toEqual({
      total: 0,
      encrypted: 0,
      submittedSinceLastEdit: false,
      isSubmitting: false,
    });
    expect(first).not.toBe(second);
  });

  it('builds normalized pending-submit stats state patches', () => {
    expect(
      buildSurveySelectorPendingSubmitStatsPatch({
        total: '3' as any,
        encrypted: 1,
        submittedSinceLastEdit: 'yes' as any,
        isSubmitting: 0 as any,
      }),
    ).toEqual({
      pendingSubmitStats: {
        total: 3,
        encrypted: 1,
        submittedSinceLastEdit: true,
        isSubmitting: false,
      },
    });
    expect(buildSurveySelectorPendingSubmitStatsPatch(null)).toEqual({
      pendingSubmitStats: getDefaultSurveySelectorPendingSubmitStats(),
    });
  });
});

describe('surveySelectorHelpers simple state patches', () => {
  it('preserves SurveySelector pub key payloads as provided', () => {
    expect(buildSurveySelectorPubKeyPatch('0xpub')).toEqual({ pubKey: '0xpub' });
    expect(buildSurveySelectorPubKeyPatch(null)).toEqual({ pubKey: null });
  });

  it('preserves selected type payloads as provided', () => {
    const selectedTypes = ['rating', 'freeform'];
    expect(buildSurveySelectorSelectedTypesPatch(selectedTypes)).toEqual({ selectedTypes });
    expect(buildSurveySelectorSelectedTypesPatch(undefined)).toEqual({ selectedTypes: undefined });
  });

  it('builds SurveySelector UI boolean state patches', () => {
    expect(buildSurveySelectorShowResultsPatch(1)).toEqual({ showResults: true });
    expect(buildSurveySelectorShowResultsPatch('')).toEqual({ showResults: false });
    expect(buildSurveySelectorFilterActivePatch('active')).toEqual({ isFilterActive: true });
    expect(buildSurveySelectorFilterActivePatch(0)).toEqual({ isFilterActive: false });
    expect(buildSurveySelectorCopySuccessPatch(true)).toEqual({ copySurveyIdSuccess: true });
    expect(buildSurveySelectorCopySuccessPatch(null)).toEqual({ copySurveyIdSuccess: false });
    expect(buildSurveySelectorShowLongLoadingPatch(1)).toEqual({ showLongLoading: true });
    expect(buildSurveySelectorShowLongLoadingPatch(0)).toEqual({ showLongLoading: false });
    expect(buildSurveySelectorLoadingPatch('yes')).toEqual({ loading: true });
    expect(buildSurveySelectorLoadingPatch('')).toEqual({ loading: false });
    expect(buildSurveySelectorQuestionCountPatch(4, 1)).toEqual({
      filteredQuestionCount: 4,
      encryptedQuestionCount: 1,
    });
  });

  it('preserves filter state payloads as provided', () => {
    const filterState = { questionTypes: ['rating'] };
    expect(buildSurveySelectorFilterStatePatch(filterState)).toEqual({ filterState });
    expect(buildSurveySelectorFilterStatePatch(null)).toEqual({ filterState: null });
    expect(buildQuestionsDashboardFilterLoadingPatch(true)).toEqual({ filterLoading: true });
    expect(buildQuestionsDashboardFilterLoadingPatch(null)).toEqual({ filterLoading: null });
  });

  it('builds the empty survey-list fallback state patch', () => {
    const surveys = [{ id: 'survey-a' }];

    expect(buildSurveySelectorEmptySurveyListPatch()).toEqual({
      surveys: [],
      loading: false,
    });
    expect(buildSurveySelectorEmptySurveyListPatch().surveys).not.toBe(
      buildSurveySelectorEmptySurveyListPatch().surveys,
    );
    expect(buildSurveySelectorLoadedSurveysPatch(surveys)).toEqual({
      surveys,
      loading: false,
    });
  });

  it('builds survey navigation state patches with fresh pending stats', () => {
    const selectPatch = buildSurveySelectorSelectSurveyPatch(2);
    const viewPatch = buildSurveySelectorViewModePatch('questions');

    expect(selectPatch).toEqual({
      selectedSurveyIndex: 2,
      viewMode: 'survey',
      showResults: false,
      pendingSubmitStats: getDefaultSurveySelectorPendingSubmitStats(),
    });
    expect(viewPatch).toEqual({
      viewMode: 'questions',
      pendingSubmitStats: getDefaultSurveySelectorPendingSubmitStats(),
    });
    expect(selectPatch.pendingSubmitStats).not.toBe(viewPatch.pendingSubmitStats);
  });

  it('builds the filtered question-list state patch', () => {
    const questions = [{ id: 'q1' }];

    expect(buildQuestionsDashboardFilteredQuestionsPatch(questions)).toEqual({
      filteredQuestions: questions,
    });
  });

  it('builds no-network question dashboard fallback patches', () => {
    expect(buildQuestionsDashboardNoNetworkPatch(true)).toEqual({
      questions: [],
      filteredQuestions: [],
      questionResponses: {},
    });
    expect(buildQuestionsDashboardNoNetworkPatch(false)).toEqual({
      questions: [],
      questionResponses: {},
    });
  });
});

describe('surveySelectorHelpers selected survey resolution', () => {
  const surveyA = `0x${'a'.repeat(64)}`;
  const surveyB = `0x${'b'.repeat(64)}`;

  it('clears selection on the survey list route', () => {
    expect(
      resolveSelectedSurveyIndex({
        surveys: [{ id: surveyA }],
        path: '/surveys',
        surveyId: surveyA,
        previousSelectedSurveyIndex: 0,
      }),
    ).toBeNull();
  });

  it('prefers a valid survey route id over the prop id', () => {
    expect(
      resolveSelectedSurveyIndex({
        surveys: [{ id: surveyA }, { id: surveyB }],
        path: `/survey/0x${'B'.repeat(64)}`,
        surveyId: surveyA,
        previousSelectedSurveyIndex: null,
      }),
    ).toBe(1);
  });

  it('falls back to prop survey id and preserves previous selection when missing', () => {
    expect(
      resolveSelectedSurveyIndex({
        surveys: [{ id: surveyA }, { id: surveyB }],
        path: '/questions',
        surveyId: surveyA.toUpperCase(),
        previousSelectedSurveyIndex: null,
      }),
    ).toBe(0);
    expect(
      resolveSelectedSurveyIndex({
        surveys: [{ id: surveyA }],
        path: '/questions',
        surveyId: surveyB,
        previousSelectedSurveyIndex: 0,
      }),
    ).toBe(0);
  });
});

describe('surveySelectorHelpers submitted survey list building', () => {
  it('filters invalid cache entries, dedupes by survey id, and preserves cache entry objects', () => {
    const first: {
      id?: string;
      surveyID: string;
      title: string;
      questionIDs: string[];
    } = {
      surveyID: 'Survey-A',
      title: 'Survey A',
      questionIDs: ['Q1'],
    };
    const duplicate = {
      id: 'survey-a',
      title: 'Survey A duplicate',
      questionIDs: ['Q2'],
    };
    const blankQuestionId = {
      id: 'survey-b',
      title: 'Survey B',
      questionIDs: [''],
    };
    const surveyBag = {
      first,
      missingTitle: { id: 'missing-title', questionIDs: ['q3'] },
      missingQuestions: { id: 'missing-questions', title: 'Missing questions' },
      noQuestions: { id: 'no-questions', title: 'No questions', questionIDs: [] },
      duplicate,
      blankQuestionId,
    };

    const submittedSurveys = buildSurveySelectorSubmittedSurveyList(surveyBag);

    expect(submittedSurveys).toEqual([first, blankQuestionId]);
    expect(first.id).toBe('Survey-A');
  });

  it('returns an empty list for non-object survey bags', () => {
    expect(buildSurveySelectorSubmittedSurveyList(null)).toEqual([]);
    expect(buildSurveySelectorSubmittedSurveyList('bad')).toEqual([]);
  });
});

describe('surveySelectorHelpers survey question cache checks', () => {
  it('treats surveys without question IDs or network IDs as loaded', () => {
    expect(areSurveySpecificQuestionsLoaded(null, '84532', {})).toBe(true);
    expect(areSurveySpecificQuestionsLoaded({ questionIDs: [] }, '84532', {})).toBe(true);
    expect(areSurveySpecificQuestionsLoaded({ questionIDs: ['q1'] }, '', {})).toBe(true);
  });

  it('checks all survey question IDs against the network question cache', () => {
    const parsedQuestionsCache = {
      '84532': {
        questions: {
          q1: { id: 'q1' },
          q2: { id: 'q2' },
        },
      },
    };

    expect(areSurveySpecificQuestionsLoaded({ questionIDs: ['Q1', 'q2'] }, '84532', parsedQuestionsCache)).toBe(true);
    expect(areSurveySpecificQuestionsLoaded({ questionIDs: ['q1', 'q3'] }, '84532', parsedQuestionsCache)).toBe(false);
  });

  it('returns false when the requested network bucket is missing questions', () => {
    expect(areSurveySpecificQuestionsLoaded({ questionIDs: ['q1'] }, '84532', { '84532': {} })).toBe(false);
  });
});
