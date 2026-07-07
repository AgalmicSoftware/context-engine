import {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsBookmarkFeedbackPatch,
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCommittedFilterStatePatch,
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
  buildSurveyResultsFilteredResponsesPatchPlan,
  buildSurveyResultsIndividualResponseAggregator,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsLockedResponsesDecryptCompletePatch,
  buildSurveyResultsLockedResponsesDecryptingPatch,
  buildSurveyResultsLocalStoragePollPatch,
  buildSurveyResultsNetworkLatestBlockPatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsQuestionFilterCountPatch,
  buildSurveyResultsQuestionFilterQuestions,
  buildSurveyResultsQuestionFilterPatch,
  buildSurveyResultsQuestionScopeResetPatch,
  buildSurveyResultsRefreshStatusSequencePlan,
  buildSurveyResultsRefreshTargetBlocksPatch,
  buildSurveyResultsRefreshStatusWritePlan,
  buildSurveyResultsSurveyIdPropChangePatch,
  buildSurveyResultsSurveyIdStateChangePatch,
  buildSurveyResultsSurveyModeHydratedPatch,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsUnfilteredQuestionModeHydratedPatch,
  buildSurveyResultsViewModeResetPatch,
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
  stringifySurveyResultsAggregatorResponses,
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
    expect(buildSurveyResultsNetworkLatestBlockPatch('123')).toEqual({
      networkLatestBlock: 123,
    });
    expect(buildSurveyResultsNetworkLatestBlockPatch(Number.POSITIVE_INFINITY)).toEqual({
      networkLatestBlock: 0,
    });
    expect(
      buildSurveyResultsViewModeResetPatch({
        questionResultsHydrated: true,
        surveyId: '0xsurvey',
        surveyResultsHydrated: true,
        viewMode: 'questions',
      }),
    ).toEqual({
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      surveyLocalBlock: 0,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      refreshTargetSurveyBlock: 0,
      questionResultsHydrated: false,
      surveyResultsHydrated: true,
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
      surveyId: '',
    });
    expect(
      buildSurveyResultsViewModeResetPatch({
        questionResultsHydrated: true,
        surveyId: '0xsurvey',
        surveyResultsHydrated: true,
        viewMode: 'survey',
      }),
    ).toEqual({
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      surveyLocalBlock: 0,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      refreshTargetSurveyBlock: 0,
      questionResultsHydrated: true,
      surveyResultsHydrated: false,
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
      surveyId: '0xsurvey',
    });
    expect(buildSurveyResultsSurveyIdPropChangePatch('0xnext')).toEqual({
      surveyId: '0xnext',
      viewMode: 'survey',
      surveyLocalBlock: 0,
      refreshTargetSurveyBlock: 0,
      surveyResultsHydrated: false,
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
    });
    expect(buildSurveyResultsSurveyIdStateChangePatch()).toEqual({
      surveyLocalBlock: 0,
      refreshTargetSurveyBlock: 0,
      surveyResultsHydrated: false,
      demoResultsViewMode: 'raw',
      demoResultsAtlasNodeId: null,
    });
    expect(
      buildSurveyResultsLocalStoragePollPatch({
        cachedQuestionsCount: 3,
        cachedSurveyResponsesCount: 4,
        networkLatestBlock: 99,
        questionLocalBlock: 10,
        responseLocalBlock: 11,
        surveyLocalBlock: 12,
      }),
    ).toEqual({
      questionLocalBlock: 10,
      responseLocalBlock: 11,
      surveyLocalBlock: 12,
      cachedQuestionsCount: 3,
      cachedSurveyResponsesCount: 4,
      networkLatestBlock: 99,
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
    expect(
      buildSurveyResultsRefreshStatusWritePlan({
        latestBlock: 789,
        writeNetworkLatestBlock: true,
      }),
    ).toEqual({
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
    expect(
      buildSurveyResultsRefreshStatusWritePlan({
        latestBlock: Number.POSITIVE_INFINITY,
        writeNetworkLatestBlock: true,
      }),
    ).toEqual({
      blockedReason: '',
      shouldWrite: true,
      statePatch: {
        networkLatestBlock: 0,
        refreshTargetQuestionBlock: Number.POSITIVE_INFINITY,
        refreshTargetResponseBlock: Number.POSITIVE_INFINITY,
        refreshTargetSurveyBlock: Number.POSITIVE_INFINITY,
      },
      target: {
        latestBlock: Number.POSITIVE_INFINITY,
      },
    });
    expect(
      buildSurveyResultsRefreshStatusWritePlan({
        isMounted: false,
        latestBlock: 999,
        writeNetworkLatestBlock: true,
      }),
    ).toEqual({
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
    expect(
      buildSurveyResultsRefreshStatusSequencePlan({
        latestBlock: 321,
        followUpEffects: [
          'manualRefreshDispatch',
          '',
          'resetLocalStoragePollingBackoff:manual-refresh',
          'pollLocalStorageForUpdates',
          'queueResultsRefresh:manual-refresh',
        ],
      }),
    ).toEqual({
      blockedReason: '',
      dispatchEligibility: 'eligible',
      orderedEffects: [
        {
          kind: 'state-patch',
          keys: ['refreshTargetQuestionBlock', 'refreshTargetResponseBlock', 'refreshTargetSurveyBlock'],
          target: {
            latestBlock: 321,
          },
        },
        { kind: 'follow-up', effect: 'manualRefreshDispatch' },
        { kind: 'follow-up', effect: 'resetLocalStoragePollingBackoff:manual-refresh' },
        { kind: 'follow-up', effect: 'pollLocalStorageForUpdates' },
        { kind: 'follow-up', effect: 'queueResultsRefresh:manual-refresh' },
      ],
      shouldDispatchFollowUp: true,
      shouldWrite: true,
      statePatch: {
        refreshTargetQuestionBlock: 321,
        refreshTargetResponseBlock: 321,
        refreshTargetSurveyBlock: 321,
      },
      target: {
        latestBlock: 321,
      },
    });
    expect(
      buildSurveyResultsRefreshStatusSequencePlan({
        isMounted: false,
        latestBlock: 654,
        writeNetworkLatestBlock: true,
        followUpEffects: ['pollLocalStorageForUpdates'],
      }),
    ).toEqual({
      blockedReason: 'unmounted',
      dispatchEligibility: 'blocked',
      orderedEffects: [],
      shouldDispatchFollowUp: false,
      shouldWrite: false,
      statePatch: null,
      target: {
        latestBlock: 654,
      },
    });
    expect(
      buildSurveyResultsRefreshStatusSequencePlan({
        latestBlock: 789,
        writeNetworkLatestBlock: true,
        followUpEffects: ['pollLocalStorageForUpdates'],
      }).orderedEffects,
    ).toEqual([
      {
        kind: 'state-patch',
        keys: [
          'networkLatestBlock',
          'refreshTargetQuestionBlock',
          'refreshTargetResponseBlock',
          'refreshTargetSurveyBlock',
        ],
        target: {
          latestBlock: 789,
        },
      },
      { kind: 'follow-up', effect: 'pollLocalStorageForUpdates' },
    ]);
    expect(
      buildSurveyResultsRefreshStatusSequencePlan({
        latestBlock: Number.POSITIVE_INFINITY,
        writeNetworkLatestBlock: true,
        followUpEffects: ['pollLocalStorageForUpdates'],
      }).statePatch,
    ).toEqual({
      networkLatestBlock: 0,
      refreshTargetQuestionBlock: Number.POSITIVE_INFINITY,
      refreshTargetResponseBlock: Number.POSITIVE_INFINITY,
      refreshTargetSurveyBlock: Number.POSITIVE_INFINITY,
    });
    expect(buildSurveyResultsFilteredQuestionsCountPatch(4)).toEqual({
      filteredQuestionsCount: 4,
    });
    expect(
      buildSurveyResultsQuestionFilterCountPatch({
        count: 2,
        props: { isQuestionCacheReady: false, isResponsesCacheReady: true },
        state: { filteredQuestionsCount: 1 },
      }),
    ).toBeNull();
    expect(
      buildSurveyResultsQuestionFilterCountPatch({
        count: 0,
        props: { isQuestionCacheReady: true, isResponsesCacheReady: false },
        state: { aggregatorQuestionResponses: {}, questionResponses: {}, filteredQuestionsCount: 3 },
      }),
    ).toBeNull();
    expect(
      buildSurveyResultsQuestionFilterCountPatch({
        count: 0,
        props: { isQuestionCacheReady: true, isResponsesCacheReady: true },
        state: {
          aggregatorQuestionResponses: { q1: [{ responder: '0x1' }] },
          filteredQuestionsCount: 3,
          filterLoading: false,
        },
      }),
    ).toEqual({
      filteredQuestionsCount: 0,
    });
    expect(
      buildSurveyResultsQuestionFilterQuestions({
        questionResponses: {
          Q1: { '0xaaa': { response: true } },
          q2: { '0xbbb': { response: true } },
        },
        networkQuestionsById: {
          q1: {
            id: 'q1',
            creator: '0xaaa',
            prompt: 'Question one',
            type: 'freeform',
          },
        },
      }),
    ).toEqual([
      {
        id: 'q1',
        creator: '0xaaa',
        prompt: 'Question one',
        type: 'freeform',
      },
      {
        id: 'q2',
        creator: '',
        prompt: '',
        type: '',
      },
    ]);
    expect(buildSurveyResultsQuestionFilterQuestions()).toEqual([]);
    expect(
      stringifySurveyResultsAggregatorResponses({
        q1: [
          { responder: '0x1', response: 'already text' },
          { responder: '0x2', response: { answer: 'choice-a' } },
        ],
        q2: 'not-an-array',
      }),
    ).toEqual({
      q1: [
        { responder: '0x1', response: 'already text' },
        { responder: '0x2', response: '{"answer":"choice-a"}' },
      ],
      q2: [],
    });
    expect(stringifySurveyResultsAggregatorResponses(null)).toEqual({});
    expect(
      buildSurveyResultsQuestionFilterCountPatch({
        count: 0,
        props: { isQuestionCacheReady: true, isResponsesCacheReady: true },
        state: {
          viewMode: 'survey',
          surveyViewMode: 'aggregate',
          aggregateQuestionResponses: { q1: [] },
          aggregatorQuestionResponses: {},
          filteredQuestionsCount: 3,
        },
      }),
    ).toEqual({
      filteredQuestionsCount: 0,
    });
    expect(
      buildSurveyResultsQuestionFilterCountPatch({
        count: 3,
        props: { isQuestionCacheReady: true, isResponsesCacheReady: true },
        state: { filteredQuestionsCount: 3 },
      }),
    ).toBeNull();
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
    expect(
      buildSurveyResultsFilterLoadingUpdate({
        loading: true,
        stateFilterLoading: true,
      }),
    ).toEqual({
      nextLoading: true,
      nextPendingValue: null,
      shouldQueueState: false,
    });
    expect(
      buildSurveyResultsFilterLoadingUpdate({
        loading: false,
        pendingValue: true,
        stateFilterLoading: false,
      }),
    ).toEqual({
      nextLoading: false,
      nextPendingValue: false,
      shouldQueueState: true,
    });
    expect(
      buildSurveyResultsFilterLoadingStatePatch({
        nextLoading: false,
        prevState: { filterLoading: true },
      }),
    ).toEqual({
      filterLoading: false,
    });
    expect(
      buildSurveyResultsFilterLoadingStatePatch({
        nextLoading: false,
        prevState: { filterLoading: false },
      }),
    ).toBeNull();
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

  it('builds committed filter and question-filter state patches', () => {
    expect(
      buildSurveyResultsCommittedFilterStatePatch({
        filterState: { questionTypes: ['binary'] },
        statePatch: { filteredQuestionsCount: 2 },
      }),
    ).toEqual({
      filteredQuestionsCount: 2,
      filterState: { questionTypes: ['binary'] },
    });
    expect(
      buildSurveyResultsCommittedFilterStatePatch({
        filterState: { questionTypes: ['rating'] },
        statePatch: null,
      }),
    ).toEqual({
      filterState: { questionTypes: ['rating'] },
    });
    expect(buildSurveyResultsQuestionScopeResetPatch()).toEqual({
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredResponsesCount: 0,
      filteredQuestionsCount: 0,
      questionResultsHydrated: false,
    });

    const sourceMap = {
      q1: [{ responder: '0x1', response: { answer: { value: 'source' } } }],
      q2: [{ responder: '0x2', response: { answer: { value: 'source' } } }],
      q3: [{ responder: '0x3', response: { answer: { value: 'omitted' } } }],
    };
    expect(
      buildSurveyResultsQuestionFilterPatch({
        filteredQuestions: [{ id: 'Q1' }, { id: 'q2' }],
        filteredResponsesByQuestion: {
          q1: [{ responder: '0x4', response: { answer: { value: 'filtered' } } }],
          q2: [],
        },
        networkQuestions: {
          q1: { type: 'freeform' },
          q2: { type: 'freeform' },
        },
        sourceMap,
        totalResponsesCount: 5,
      }),
    ).toEqual({
      filteredQuestionsCount: 2,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0x4', response: { answer: { value: 'filtered' } } }],
      },
      filteredResponsesCount: 1,
    });

    expect(
      buildSurveyResultsQuestionFilterPatch({
        filteredQuestions: [{ id: 'q1' }, { id: 'q2' }],
        isSurveyAggregate: true,
        sourceMap: {
          q1: [{ responder: '0xAAA' }, { responder: '0xaaa' }],
          q2: [{ responder: '0xBBB' }],
        },
        totalResponsesCount: 1,
      }),
    ).toEqual({
      filteredQuestionsCount: 2,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xAAA' }, { responder: '0xaaa' }],
        q2: [{ responder: '0xBBB' }],
      },
      filteredResponsesCount: 1,
    });

    expect(
      buildSurveyResultsQuestionFilterPatch({
        filteredQuestions: [{ id: 'q1' }, { id: 'q2' }],
        isSurveyIndividuals: true,
        sourceMap,
        totalResponsesCount: 5,
      }),
    ).toEqual({
      filteredQuestionsCount: 2,
    });
  });

  it('builds filtered response patch plans by view mode', () => {
    expect(
      buildSurveyResultsFilteredResponsesPatchPlan({
        filteredResponses: [{ responder: '0x1' }],
        surveyViewMode: 'individuals',
        viewMode: 'survey',
      }),
    ).toEqual({
      patch: {
        sbtFilteredResponses: [{ responder: '0x1' }],
        filteredResponsesCount: 1,
      },
      status: 'apply',
    });

    expect(
      buildSurveyResultsFilteredResponsesPatchPlan({
        filteredResponses: null,
        surveyViewMode: 'individuals',
        viewMode: 'survey',
      }),
    ).toEqual({
      patch: {
        sbtFilteredResponses: [],
        filteredResponsesCount: 0,
      },
      status: 'invalid-array',
    });

    expect(
      buildSurveyResultsFilteredResponsesPatchPlan({
        filteredResponses: {
          q1: [{ responder: '0xAAA' }, { responder: '0xaaa' }],
          q2: [],
          q3: [{ responder: '0xBBB' }],
        },
        surveyViewMode: 'aggregate',
        totalResponsesCount: 5,
        viewMode: 'survey',
      }),
    ).toEqual({
      patch: {
        sbtFilteredAggregatorQuestionResponses: {
          q1: [{ responder: '0xAAA' }, { responder: '0xaaa' }],
          q3: [{ responder: '0xBBB' }],
        },
        filteredResponsesCount: 2,
      },
      status: 'apply',
    });

    expect(
      buildSurveyResultsFilteredResponsesPatchPlan({
        filteredResponses: {
          q1: [{ responder: '0x1', response: { answer: { value: 'Yes' } } }],
          q2: [],
        },
        networkQuestions: { q1: { type: 'freeform' } },
        totalResponsesCount: 1,
        viewMode: 'questions',
      }),
    ).toEqual({
      patch: {
        sbtFilteredAggregatorQuestionResponses: {
          q1: [{ responder: '0x1', response: { answer: { value: 'Yes' } } }],
        },
        filteredResponsesCount: 1,
      },
      status: 'apply',
    });

    expect(
      buildSurveyResultsFilteredResponsesPatchPlan({
        filteredResponses: 'invalid',
        viewMode: 'questions',
      }),
    ).toEqual({
      patch: null,
      status: 'invalid-aggregator',
    });
  });

  it('builds bookmark-list and locked decrypt state patches', () => {
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
    expect(buildSurveyResultsLockedResponsesDecryptingPatch(true)).toEqual({
      lockedResponsesDecrypting: true,
      alertMessage: '',
    });
    const overrides = { row1: { answerValue: 'yes' } };
    expect(
      buildSurveyResultsLockedResponsesDecryptCompletePatch({
        anyDecrypted: true,
        decryptedResponseOverrides: overrides,
        walletLowerLabel: 'wallet',
      }),
    ).toEqual({
      lockedResponsesDecrypting: false,
      decryptedResponseOverrides: overrides,
    });
    expect(
      buildSurveyResultsLockedResponsesDecryptCompletePatch({
        anyDecrypted: false,
        decryptedResponseOverrides: overrides,
        walletLowerLabel: 'account',
      }),
    ).toEqual({
      lockedResponsesDecrypting: false,
      decryptedResponseOverrides: overrides,
      alertMessage: 'Unable to decrypt locked responses with the connected account.',
    });
    expect(
      toggleSurveyResultsLockedResponseDetailsPatch({
        lockedResponseDetailsOpen: false,
      }),
    ).toEqual({
      lockedResponseDetailsOpen: true,
    });
    expect(
      toggleSurveyResultsLockedResponseDetailsPatch({
        lockedResponseDetailsOpen: true,
      }),
    ).toEqual({
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

    expect(
      buildSurveyResultsSurveyModeHydratedPatch({
        aggregateQuestionResponses: finalAggregator,
        filteredResponsesCount: rawResponses.length,
        responses: rawResponses,
        sbtFilteredAggregatorQuestionResponses: finalAggregator,
        sbtFilteredResponses: rawResponses,
        surveyDocumentURLs: docUrls,
        surveyTitle: 'Research survey',
        totalQuestionsCount: 1,
        totalResponsesCount: 1,
      }),
    ).toEqual({
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

    expect(
      buildSurveyResultsFilteredQuestionModeHydratedPatch({
        aggregatorQuestionResponses: finalAggregator,
        currentFilteredQuestionsCount: 7,
        currentFilteredResponsesCount: undefined,
        initialFilteredCount: 3,
        questionResponses,
        sbtFilteredAggregatorQuestionResponses: filteredAggregator,
        totalQuestionsCount: 2,
        totalResponsesCount: 3,
      }),
    ).toEqual({
      aggregatorQuestionResponses: finalAggregator,
      sbtFilteredAggregatorQuestionResponses: filteredAggregator,
      questionResponses,
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
      filteredQuestionsCount: 2,
      filteredResponsesCount: 3,
      questionResultsHydrated: true,
    });

    expect(
      buildSurveyResultsUnfilteredQuestionModeHydratedPatch({
        aggregatorQuestionResponses: finalAggregator,
        filteredResponsesCount: 3,
        questionResponses,
        totalQuestionsCount: 2,
        totalResponsesCount: 3,
      }),
    ).toEqual({
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

describe('surveyResultsHelpers individual response aggregation', () => {
  it('aggregates individual survey responses by normalized latest question rows', () => {
    const aggregator = buildSurveyResultsIndividualResponseAggregator([
      {
        responder: '0xAAA',
        response: {
          timestamp: '2025-01-02T00:00:00.000Z',
          responses: [
            {
              questionID: 'Q1',
              answer: { value: 'old' },
              timestamp: '2025-01-01T00:00:00.000Z',
            },
            {
              questionID: 'Q1',
              answer: { value: 'new' },
              timestamp: '2025-01-03T00:00:00.000Z',
            },
            {
              questionId: 'Q2',
              answer: { value: 'second' },
            },
          ],
        },
      },
    ]);

    expect(aggregator.q1).toEqual([
      {
        responder: '0xaaa',
        questionId: 'q1',
        response: {
          questionID: 'Q1',
          answer: { value: 'new' },
          timestamp: '2025-01-03T00:00:00.000Z',
        },
        timestamp: Date.parse('2025-01-03T00:00:00.000Z'),
      },
    ]);
    expect(aggregator.q2).toEqual([
      {
        responder: '0xaaa',
        questionId: 'q2',
        response: {
          questionId: 'Q2',
          answer: { value: 'second' },
        },
        timestamp: Date.parse('2025-01-02T00:00:00.000Z'),
      },
    ]);
    expect(buildSurveyResultsIndividualResponseAggregator(null)).toEqual({});
  });
});

describe('surveyResultsHelpers signature serialization', () => {
  it('serializes object keys deterministically and preserves bigint values', () => {
    expect(
      stableSerializeSignatureValue({
        z: 1,
        a: 2n,
        nested: { b: 'two', a: 'one' },
      }),
    ).toBe('{"a":"__bigint:2","nested":{"a":"one","b":"two"},"z":1}');
  });

  it('handles circular payloads without throwing', () => {
    const payload: Record<string, unknown> = { answer: 'visible' };
    payload.self = payload;

    expect(stableSerializeSignatureValue(payload)).toBe('{"answer":"visible","self":"__circular__"}');
  });

  it('changes responder signatures when deep payload values mutate in place', () => {
    const responderPayload = {
      responses: [{ questionID: 'q1', answer: { value: 'before' } }],
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

    expect(getSurveyResponseAggregateTimestampMs(payload.responses[0], payload)).toBe(1738368000000);
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

    expect(normalized.responses.map((row) => row.questionID || row.questionId || row.kind)).toEqual([
      'q1',
      'legacyMeta',
    ]);
    expect(normalized.responses[0]?.answer?.value).toBe('latest');
  });

  it('preserves passthrough row order around deduped question answers', () => {
    const normalized = normalizeSurveyResponsePayloadByQuestionId({
      responses: [
        {
          questionID: 'q1',
          timeStamp: '2025-01-01T00:00:00.000Z',
          answer: { value: 'stale q1' },
        },
        { kind: 'intro-note' },
        {
          questionID: 'q2',
          timeStamp: '2025-01-02T00:00:00.000Z',
          answer: { value: 'q2 answer' },
        },
        { kind: 'between-note' },
        {
          questionID: 'q1',
          timeStamp: '2025-01-03T00:00:00.000Z',
          answer: { value: 'fresh q1' },
        },
        { kind: 'closing-note' },
      ],
    }) as {
      responses: Array<Record<string, unknown> & { answer?: { value?: unknown } }>;
    };

    expect(normalized.responses.map((row) => row.kind || row.questionID)).toEqual([
      'q1',
      'intro-note',
      'q2',
      'between-note',
      'closing-note',
    ]);
    expect(normalized.responses[0]?.answer?.value).toBe('fresh q1');
    expect(normalized.responses[2]?.answer?.value).toBe('q2 answer');
  });

  it('picks CSV timestamps from answer, payload, then row fallbacks', () => {
    const ms = pickTimestampMs(
      { answer: { timeStamp: '2025-03-01T00:00:00.000Z' } },
      { timeStamp: '2024-01-01T00:00:00.000Z' },
      { timeStamp: '2023-01-01T00:00:00.000Z' },
    );

    expect(formatTsForCsv(ms)).toBe('2025-03-01T00:00:00.000Z');
  });
});

describe('surveyResultsHelpers count helpers', () => {
  it('excludes blank freeform rows from question-mode response totals', () => {
    expect(
      countQuestionModeResponses(
        {
          q1: [{ response: { answer: { value: '   ' } } }, { response: { answer: { value: 'Visible answer' } } }],
        },
        { q1: { type: 'freeform' } },
      ),
    ).toBe(1);
  });

  it('recognizes survey payloads with at least one countable answer', () => {
    expect(
      hasAnyCountableSurveyAnswer(
        {
          responses: [
            { questionID: 'q1', answer: { value: '   ' } },
            { questionID: 'q2', answer: { value: 'Agree' } },
          ],
        },
        {
          q1: { type: 'freeform' },
          q2: { type: 'binary' },
        },
      ),
    ).toBe(true);
  });
});
