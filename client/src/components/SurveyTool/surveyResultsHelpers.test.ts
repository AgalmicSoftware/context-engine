import {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsBookmarkFeedbackPatch,
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCsvFileNamePatch,
  buildSurveyResultsDemoAtlasOpenPatch,
  buildSurveyResultsDemoAtlasNodePatch,
  buildSurveyResultsDemoViewSelectPatch,
  buildSurveyResultsEmptySurveyModePatch,
  buildSurveyResultsExportTypePatch,
  buildSurveyResultsFilterActivePatch,
  buildSurveyResultsFilterLoadingStatePatch,
  buildSurveyResultsFilterLoadingUpdate,
  buildSurveyResultsFilteredQuestionModeHydratedPatch,
  buildSurveyResultsFilteredQuestionsCountPatch,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsLockedResponsesDecryptCompletePatch,
  buildSurveyResultsLockedResponsesDecryptingPatch,
  buildSurveyResultsNetworkLatestBlockPatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsQuestionFilterCountPatch,
  buildSurveyResultsRefreshTargetBlocksPatch,
  buildSurveyResultsRefreshStatusWritePlan,
  buildSurveyResultsSurveyModeHydratedPatch,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsUnfilteredQuestionModeHydratedPatch,
  buildSurveyResultsViewStatePatch,
  buildSurveyRespondersSignature,
  countQuestionModeResponses,
  formatTsForCsv,
  getSurveyResponseAggregateTimestampMs,
  hasAnyCountableSurveyAnswer,
  normalizeResponseTimestampMs,
  normalizeSurveyResponsePayloadByQuestionId,
  pickTimestampMs,
  stableSerializeSignatureValue,
  toggleSurveyResultsLockedResponseDetailsPatch,
} from './surveyResultsHelpers.js';

describe('surveyResultsHelpers state patches', () => {
  it('builds alert, CSV filename, and export type patches', () => {
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
  });

  it('builds display and bookmark feedback state patches', () => {
    expect(buildSurveyResultsFilterActivePatch('active')).toEqual({
      isFilterActive: 'active',
    });
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
    expect(buildSurveyResultsDemoViewSelectPatch({
      nextView: 'breakdown',
      prevState: { demoResultsViewMode: 'breakdown', demoResultsAtlasNodeId: 'node-a' },
    })).toEqual({
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
    });
    expect(buildSurveyResultsDemoViewSelectPatch({
      nextView: 'atlas',
      prevState: { demoResultsViewMode: 'report', demoResultsAtlasNodeId: 'node-a' },
    })).toEqual({
      demoResultsViewMode: 'atlas',
      demoResultsAtlasNodeId: 'node-a',
    });
    expect(buildSurveyResultsDemoViewSelectPatch({
      nextView: 'unknown',
      prevState: { demoResultsViewMode: 'atlas', demoResultsAtlasNodeId: 'node-a' },
    })).toEqual({
      demoResultsViewMode: 'report',
      demoResultsAtlasNodeId: null,
    });
    expect(buildSurveyResultsNetworkLatestBlockPatch('123')).toEqual({
      networkLatestBlock: 123,
    });
    expect(buildSurveyResultsRefreshTargetBlocksPatch(456)).toEqual({
      refreshTargetQuestionBlock: 456,
      refreshTargetResponseBlock: 456,
      refreshTargetSurveyBlock: 456,
    });
    expect(buildSurveyResultsRefreshStatusWritePlan({ latestBlock: 456 })).toEqual({
      blockedReason: '',
      shouldWrite: true,
      statePatch: {
        refreshTargetQuestionBlock: 456,
        refreshTargetResponseBlock: 456,
        refreshTargetSurveyBlock: 456,
      },
      target: {
        latestBlock: 456,
      },
    });
    expect(buildSurveyResultsRefreshStatusWritePlan({
      latestBlock: 789,
      writeNetworkLatestBlock: true,
    })).toEqual({
      blockedReason: '',
      shouldWrite: true,
      statePatch: {
        networkLatestBlock: 789,
        refreshTargetQuestionBlock: 789,
        refreshTargetResponseBlock: 789,
        refreshTargetSurveyBlock: 789,
      },
      target: {
        latestBlock: 789,
      },
    });
    expect(buildSurveyResultsRefreshStatusWritePlan({
      isMounted: false,
      latestBlock: 999,
      writeNetworkLatestBlock: true,
    })).toEqual({
      blockedReason: 'unmounted',
      shouldWrite: false,
      statePatch: null,
      target: {
        latestBlock: 999,
      },
    });
    expect(buildSurveyResultsRefreshStatusWritePlan({ latestBlock: undefined })).toEqual({
      blockedReason: '',
      shouldWrite: true,
      statePatch: {
        refreshTargetQuestionBlock: undefined,
        refreshTargetResponseBlock: undefined,
        refreshTargetSurveyBlock: undefined,
      },
      target: {
        latestBlock: undefined,
      },
    });
    expect(buildSurveyResultsFilteredQuestionsCountPatch(4)).toEqual({
      filteredQuestionsCount: 4,
    });
    expect(buildSurveyResultsQuestionFilterCountPatch({
      count: 2,
      props: { isQuestionCacheReady: false, isResponsesCacheReady: true },
      state: { filteredQuestionsCount: 1 },
    })).toBeNull();
    expect(buildSurveyResultsQuestionFilterCountPatch({
      count: 0,
      props: { isQuestionCacheReady: true, isResponsesCacheReady: false },
      state: { aggregatorQuestionResponses: {}, questionResponses: {}, filteredQuestionsCount: 3 },
    })).toBeNull();
    expect(buildSurveyResultsQuestionFilterCountPatch({
      count: 0,
      props: { isQuestionCacheReady: true, isResponsesCacheReady: true },
      state: {
        aggregatorQuestionResponses: { q1: [{ responder: '0x1' }] },
        filteredQuestionsCount: 3,
        filterLoading: false,
      },
    })).toEqual({
      filteredQuestionsCount: 0,
    });
    expect(buildSurveyResultsQuestionFilterCountPatch({
      count: 0,
      props: { isQuestionCacheReady: true, isResponsesCacheReady: true },
      state: {
        viewMode: 'survey',
        surveyViewMode: 'aggregate',
        aggregateQuestionResponses: { q1: [] },
        aggregatorQuestionResponses: {},
        filteredQuestionsCount: 3,
      },
    })).toEqual({
      filteredQuestionsCount: 0,
    });
    expect(buildSurveyResultsQuestionFilterCountPatch({
      count: 3,
      props: { isQuestionCacheReady: true, isResponsesCacheReady: true },
      state: { filteredQuestionsCount: 3 },
    })).toBeNull();
    expect(buildSurveyResultsSurveyViewModePatch('aggregate')).toEqual({
      surveyViewMode: 'aggregate',
    });
    expect(buildSurveyResultsBookmarkFeedbackPatch(1)).toEqual({
      filterBookmarkedFeedback: true,
    });
    expect(buildSurveyResultsBookmarkFeedbackPatch('')).toEqual({
      filterBookmarkedFeedback: false,
    });
    expect(buildSurveyResultsViewStatePatch('survey', '0x1')).toEqual({
      viewMode: 'survey',
      surveyId: '0x1',
    });
    expect(buildSurveyResultsFilterLoadingUpdate({
      loading: true,
      stateFilterLoading: true,
    })).toEqual({
      nextLoading: true,
      nextPendingValue: null,
      shouldQueueState: false,
    });
    expect(buildSurveyResultsFilterLoadingUpdate({
      loading: false,
      pendingValue: true,
      stateFilterLoading: false,
    })).toEqual({
      nextLoading: false,
      nextPendingValue: false,
      shouldQueueState: true,
    });
    expect(buildSurveyResultsFilterLoadingStatePatch({
      nextLoading: false,
      prevState: { filterLoading: true },
    })).toEqual({
      filterLoading: false,
    });
    expect(buildSurveyResultsFilterLoadingStatePatch({
      nextLoading: false,
      prevState: { filterLoading: false },
    })).toBeNull();
    expect(buildSurveyResultsBooleanTogglePatch({
      prevState: { showQuestionFilter: false },
      stateKey: 'showQuestionFilter',
    })).toEqual({ showQuestionFilter: true });
    expect(buildSurveyResultsBooleanTogglePatch({
      prevState: { exportAreaOpen: true },
      stateKey: 'exportAreaOpen',
    })).toEqual({ exportAreaOpen: false });
    expect(buildSurveyResultsBooleanTogglePatch()).toEqual({});
    expect(buildSurveyResultsKeyedTogglePatch({
      itemKey: 'q1',
      mapKey: 'activeQuestionToggles',
      prevState: { activeQuestionToggles: { q1: false, q2: true } },
    })).toEqual({
      activeQuestionToggles: { q1: true, q2: true },
    });
    expect(buildSurveyResultsKeyedTogglePatch({
      forceValue: true,
      itemKey: 'q1',
      mapKey: 'activeQuestionToggles',
      prevState: { activeQuestionToggles: { q1: false } },
    })).toEqual({
      activeQuestionToggles: { q1: true },
    });
    expect(buildSurveyResultsKeyedTogglePatch()).toEqual({});
    expect(buildSurveyResultsQuestionIdSortPatch({
      column: 'questionId',
      prevState: { questionIdSortBy: 'questionId', questionIdSortAsc: true },
    })).toEqual({
      questionIdSortBy: 'questionId',
      questionIdSortAsc: false,
    });
    expect(buildSurveyResultsQuestionIdSortPatch({
      column: 'responses',
      prevState: { questionIdSortBy: 'questionId', questionIdSortAsc: false },
    })).toEqual({
      questionIdSortBy: 'responses',
      questionIdSortAsc: true,
    });
  });

  it('builds bookmark-list and locked decrypt state patches', () => {
    const surveyIds = ['s1'];
    const questionIds = ['q1'];

    expect(buildSurveyResultsBookmarkedSurveyIdsPatch(surveyIds)).toEqual({
      bookmarkedSurveyIDs: ['s1'],
    });
    expect(buildSurveyResultsBookmarkedSurveyIdsPatch(surveyIds).bookmarkedSurveyIDs)
      .not.toBe(surveyIds);
    expect(buildSurveyResultsBookmarkedQuestionIdsPatch(questionIds)).toEqual({
      bookmarkedQuestionIDs: ['q1'],
    });
    expect(buildSurveyResultsBookmarkedQuestionIdsPatch(null)).toEqual({
      bookmarkedQuestionIDs: [],
    });
    expect(buildSurveyResultsLockedResponsesDecryptingPatch(true)).toEqual({
      lockedResponsesDecrypting: true,
      alertMessage: '',
    });
    const overrides = { row1: { answerValue: 'yes' } };
    expect(buildSurveyResultsLockedResponsesDecryptCompletePatch({
      anyDecrypted: true,
      decryptedResponseOverrides: overrides,
      walletLowerLabel: 'wallet',
    })).toEqual({
      lockedResponsesDecrypting: false,
      decryptedResponseOverrides: overrides,
    });
    expect(buildSurveyResultsLockedResponsesDecryptCompletePatch({
      anyDecrypted: false,
      decryptedResponseOverrides: overrides,
      walletLowerLabel: 'account',
    })).toEqual({
      lockedResponsesDecrypting: false,
      decryptedResponseOverrides: overrides,
      alertMessage: 'Unable to decrypt locked responses with the connected account.',
    });
    expect(toggleSurveyResultsLockedResponseDetailsPatch({
      lockedResponseDetailsOpen: false,
    })).toEqual({
      lockedResponseDetailsOpen: true,
    });
    expect(toggleSurveyResultsLockedResponseDetailsPatch({
      lockedResponseDetailsOpen: true,
    })).toEqual({
      lockedResponseDetailsOpen: false,
    });
  });

  it('builds survey-mode hydration patches', () => {
    const finalAggregator = { q1: [] };
    const rawResponses = [{ responder: '0x1' }];
    const docUrls = ['https://example.com/doc'];

    expect(buildSurveyResultsEmptySurveyModePatch()).toEqual({
      responses: [],
      sbtFilteredResponses: [],
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      surveyTitle: '',
      surveyDocumentURLs: [],
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredQuestionsCount: 0,
      filteredResponsesCount: 0,
      surveyResultsHydrated: true,
    });

    expect(buildSurveyResultsSurveyModeHydratedPatch({
      aggregateQuestionResponses: finalAggregator,
      filteredResponsesCount: rawResponses.length,
      responses: rawResponses,
      sbtFilteredAggregatorQuestionResponses: finalAggregator,
      sbtFilteredResponses: rawResponses,
      surveyDocumentURLs: docUrls,
      surveyTitle: 'Research survey',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
    })).toEqual({
      aggregateQuestionResponses: finalAggregator,
      sbtFilteredAggregatorQuestionResponses: finalAggregator,
      sbtFilteredResponses: rawResponses,
      surveyTitle: 'Research survey',
      surveyDocumentURLs: docUrls,
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredQuestionsCount: 1,
      responses: rawResponses,
      filteredResponsesCount: 1,
      surveyResultsHydrated: true,
    });
  });

  it('builds question-mode hydration patches', () => {
    const finalAggregator = { q1: [{ responder: '0x1' }] };
    const filteredAggregator = { q1: [] };
    const questionResponses = { q1: { '0x1': { answer: 'Yes' } } };

    expect(buildSurveyResultsFilteredQuestionModeHydratedPatch({
      aggregatorQuestionResponses: finalAggregator,
      currentFilteredQuestionsCount: 7,
      currentFilteredResponsesCount: undefined,
      initialFilteredCount: 3,
      questionResponses,
      sbtFilteredAggregatorQuestionResponses: filteredAggregator,
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
    })).toEqual({
      aggregatorQuestionResponses: finalAggregator,
      sbtFilteredAggregatorQuestionResponses: filteredAggregator,
      questionResponses,
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
      filteredQuestionsCount: 2,
      filteredResponsesCount: 3,
      questionResultsHydrated: true,
    });

    expect(buildSurveyResultsUnfilteredQuestionModeHydratedPatch({
      aggregatorQuestionResponses: finalAggregator,
      filteredResponsesCount: 3,
      questionResponses,
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
    })).toEqual({
      aggregatorQuestionResponses: finalAggregator,
      sbtFilteredAggregatorQuestionResponses: finalAggregator,
      questionResponses,
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
      filteredQuestionsCount: 2,
      filteredResponsesCount: 3,
      questionResultsHydrated: true,
    });
  });
});

describe('surveyResultsHelpers signature serialization', () => {
  it('serializes object keys deterministically and preserves bigint values', () => {
    expect(stableSerializeSignatureValue({
      z: 1,
      a: 2n,
      nested: { b: 'two', a: 'one' },
    })).toBe('{"a":"__bigint:2","nested":{"a":"one","b":"two"},"z":1}');
  });

  it('handles circular payloads without throwing', () => {
    const payload: Record<string, unknown> = { answer: 'visible' };
    payload.self = payload;

    expect(stableSerializeSignatureValue(payload)).toBe('{"answer":"visible","self":"__circular__"}');
  });

  it('changes responder signatures when deep payload values mutate in place', () => {
    const responderPayload = {
      responses: [
        { questionID: 'q1', answer: { value: 'before' } },
      ],
    };
    const responsesByResponder = {
      '0xA': responderPayload,
    };

    const before = buildSurveyRespondersSignature(responsesByResponder);
    responderPayload.responses[0].answer.value = 'after';

    expect(buildSurveyRespondersSignature(responsesByResponder)).not.toBe(before);
  });
});

describe('surveyResultsHelpers timestamps', () => {
  it('normalizes numeric, numeric-string, and ISO timestamps to milliseconds', () => {
    expect(normalizeResponseTimestampMs(123)).toBe(123000);
    expect(normalizeResponseTimestampMs('123.4')).toBe(123400);
    expect(normalizeResponseTimestampMs('2025-01-01T00:00:00.000Z')).toBe(1735689600000);
  });

  it('uses payload recency when the answer row timestamp is missing or stale', () => {
    const payload = {
      timeStamp: '2025-02-01T00:00:00.000Z',
      responses: [
        {
          questionID: 'q1',
          timeStamp: '2024-01-01T00:00:00.000Z',
          answer: { value: 'answer' },
        },
      ],
    };

    expect(getSurveyResponseAggregateTimestampMs(payload.responses[0], payload))
      .toBe(1738368000000);
  });

  it('dedupes survey payload responses by effective responder/question recency', () => {
    const normalized = normalizeSurveyResponsePayloadByQuestionId({
      timeStamp: '2025-02-01T00:00:00.000Z',
      responses: [
        {
          questionId: 'q1',
          timeStamp: '2025-01-15T00:00:00.000Z',
          answer: { value: 'old' },
        },
        { kind: 'legacyMeta' },
        {
          questionID: 'q1',
          timeStamp: '2024-01-01T00:00:00.000Z',
          answer: { value: 'latest' },
        },
      ],
    }) as {
      responses: Array<Record<string, unknown> & { answer?: { value?: unknown } }>;
    };

    expect(normalized.responses.map((row) => row.questionID || row.questionId || row.kind))
      .toEqual(['q1', 'legacyMeta']);
    expect(normalized.responses[0]?.answer?.value).toBe('latest');
  });

  it('picks CSV timestamps from answer, payload, then row fallbacks', () => {
    const ms = pickTimestampMs(
      { answer: { timeStamp: '2025-03-01T00:00:00.000Z' } },
      { timeStamp: '2024-01-01T00:00:00.000Z' },
      { timeStamp: '2023-01-01T00:00:00.000Z' }
    );

    expect(formatTsForCsv(ms)).toBe('2025-03-01T00:00:00.000Z');
  });
});

describe('surveyResultsHelpers count helpers', () => {
  it('excludes blank freeform rows from question-mode response totals', () => {
    expect(countQuestionModeResponses(
      {
        q1: [
          { response: { answer: { value: '   ' } } },
          { response: { answer: { value: 'Visible answer' } } },
        ],
      },
      { q1: { type: 'freeform' } }
    )).toBe(1);
  });

  it('recognizes survey payloads with at least one countable answer', () => {
    expect(hasAnyCountableSurveyAnswer(
      {
        responses: [
          { questionID: 'q1', answer: { value: '   ' } },
          { questionID: 'q2', answer: { value: 'Agree' } },
        ],
      },
      {
        q1: { type: 'freeform' },
        q2: { type: 'binary' },
      }
    )).toBe(true);
  });
});
