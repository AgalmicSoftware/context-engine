import {
  buildUserPageBooleanTogglePatch,
  buildUserPageProfileEditVisibility,
  buildUserPageSelectedTabStatePatch,
  buildUserPageSurveyExpansionTogglePatch,
  buildUserPageTooltipTargetIds,
  readBoolishUserPageTelemetryFlag,
  resolveUserPageAddressDisplayState,
  resolveUserPageAnalysisModalDisplayState,
  resolveUserPageBlockieSeed,
  resolveUserPageFullProfileModalDisplayState,
  resolveUserPageHeaderActionVisibility,
  resolveUserPageQuestionPromptText,
  resolveUserPageQuestionSectionDisplayState,
  resolveUserPageQuestionSourceSessionSlug,
  resolveUserPageSbtDisplayState,
  resolveUserPageSurveyCountDisplayState,
  resolveUserPageSurveyCreatedCardState,
  resolveUserPageSurveyPreviewDisplayState,
  resolveUserPageSurveyResponseCardState,
  resolveUserPageSurveySectionDisplayState,
  shortenUserPageQuestionId,
} from './userPageHelpers';

describe('userPageHelpers display state helpers', () => {
  it('builds boolean and survey expansion toggle patches', () => {
    expect(
      buildUserPageBooleanTogglePatch({
        state: { collapseOpen: false },
        stateKey: 'collapseOpen',
      }),
    ).toEqual({ collapseOpen: true });
    expect(
      buildUserPageBooleanTogglePatch({
        state: { showSectionSurveyResponsesOpen: 'open' },
        stateKey: 'showSectionSurveyResponsesOpen',
      }),
    ).toEqual({ showSectionSurveyResponsesOpen: false });
    expect(buildUserPageSelectedTabStatePatch({ selectedTab: 'surveys' })).toEqual({
      selectedTab: 'surveys',
    });
    expect(buildUserPageSelectedTabStatePatch({ selectedTab: null })).toEqual({
      selectedTab: '',
    });

    expect(
      buildUserPageSurveyExpansionTogglePatch({
        state: {
          expandedSurveyResponses: {
            alpha: true,
            beta: false,
          },
        },
        stateKey: 'expandedSurveyResponses',
        surveyId: 'alpha',
      }),
    ).toEqual({
      expandedSurveyResponses: {
        alpha: false,
        beta: false,
      },
    });
    expect(
      buildUserPageSurveyExpansionTogglePatch({
        state: {},
        stateKey: 'expandedSurveysCreated',
        surveyId: 42,
      }),
    ).toEqual({
      expandedSurveysCreated: {
        42: true,
      },
    });
  });

  it('resolves analysis modal display states', () => {
    expect(
      resolveUserPageAnalysisModalDisplayState({
        analysisDetails: 'detail',
        analysisError: 'error',
        analyzing: true,
      }),
    ).toEqual({
      shouldRenderAnalysisBody: false,
      shouldRenderAnalyzing: true,
      shouldRenderDetails: false,
      shouldRenderError: false,
      shouldRenderHistoricalAlignment: false,
      shouldRenderHistoricalFigure: false,
      shouldRenderHistoricalReasoning: false,
    });
    expect(
      resolveUserPageAnalysisModalDisplayState({
        analysisError: 'error',
        analyzing: false,
      }),
    ).toEqual({
      shouldRenderAnalysisBody: false,
      shouldRenderAnalyzing: false,
      shouldRenderDetails: false,
      shouldRenderError: true,
      shouldRenderHistoricalAlignment: false,
      shouldRenderHistoricalFigure: false,
      shouldRenderHistoricalReasoning: false,
    });
    expect(
      resolveUserPageAnalysisModalDisplayState({
        analysisDetails: 'detail',
        analysisHistoricalFigure: 'Ada Lovelace',
        analysisHistoricalReasoning: 'reasoning',
        analyzing: false,
      }),
    ).toEqual({
      shouldRenderAnalysisBody: true,
      shouldRenderAnalyzing: false,
      shouldRenderDetails: true,
      shouldRenderError: false,
      shouldRenderHistoricalAlignment: true,
      shouldRenderHistoricalFigure: true,
      shouldRenderHistoricalReasoning: true,
    });
  });

  it('resolves full profile modal display states', () => {
    expect(
      resolveUserPageFullProfileModalDisplayState({
        account: '0xabc',
        explorerUrl: 'https://explorer.test/address/0xabc',
        minimized: false,
        propViewAddress: '0xABC',
        surveyResponseInfo: [{ id: 'survey-1' }],
      }),
    ).toEqual({
      shouldRenderBookmarksLink: true,
      shouldRenderModalActions: true,
      shouldRenderSurveyEmptyText: false,
      shouldRenderSurveyList: true,
      shouldRenderSurveySpinner: false,
    });
    expect(
      resolveUserPageFullProfileModalDisplayState({
        explorerUrl: 'https://explorer.test/address/0xabc',
        propViewAddress: '0xabc',
        surveyResponseInfo: [],
      }),
    ).toEqual({
      shouldRenderBookmarksLink: false,
      shouldRenderModalActions: true,
      shouldRenderSurveyEmptyText: true,
      shouldRenderSurveyList: false,
      shouldRenderSurveySpinner: false,
    });
    expect(
      resolveUserPageFullProfileModalDisplayState({
        minimized: true,
        propViewAddress: '0xabc',
        surveyResponseInfo: [{ id: 'survey-1' }],
        surveyResponsesLoadingEmpty: true,
      }),
    ).toEqual({
      shouldRenderBookmarksLink: false,
      shouldRenderModalActions: false,
      shouldRenderSurveyEmptyText: false,
      shouldRenderSurveyList: false,
      shouldRenderSurveySpinner: true,
    });
  });

  it('builds stable tooltip and spinner target ids from view addresses', () => {
    expect(buildUserPageTooltipTargetIds('0xABCDEF123456')).toEqual({
      addrFragment: 'abcdef',
      analyzeBtnWrapId: 'analyzeBtnWrap_abcdef',
      compareBtnWrapId: 'compareBtnWrap_abcdef',
      questionSpinnerId: 'questionSpinner_abcdef',
      questionsCreatedSpinnerId: 'questionsCreatedSpinner_abcdef',
      sbtSpinnerId: 'sbtSpinner_abcdef',
      surveySpinnerId: 'surveySpinner_abcdef',
      surveysCreatedSpinnerId: 'surveysCreatedSpinner_abcdef',
    });

    expect(buildUserPageTooltipTargetIds('/u/0xAB-CD_12')).toMatchObject({
      addrFragment: 'u0xab-',
      analyzeBtnWrapId: 'analyzeBtnWrap_u0xab-',
      compareBtnWrapId: 'compareBtnWrap_u0xab-',
    });

    expect(buildUserPageTooltipTargetIds(null)).toMatchObject({
      addrFragment: 'addr',
      surveySpinnerId: 'surveySpinner_addr',
    });
  });

  it('reads boolish telemetry flags with fallback semantics', () => {
    expect(readBoolishUserPageTelemetryFlag(true, false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag(false, true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag(' YES ', false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('on', false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('0', true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag('off', true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag('', true)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('maybe', 0)).toBe(false);
  });

  it('builds profile edit visibility for nickname and username controls', () => {
    expect(
      buildUserPageProfileEditVisibility({
        account: '0xABC',
        cachedNickname: '',
        isEditingNickname: false,
        isEditingUsername: false,
        minimized: false,
        pendingNickname: 'Pending',
        viewAddress: '0xabc',
      }),
    ).toEqual({
      hasNickForThis: true,
      isOwner: true,
      notOwnPage: false,
      showPen: false,
      showUsernamePen: true,
    });
    expect(
      buildUserPageProfileEditVisibility({
        account: '0xABC',
        isEditingNickname: false,
        minimized: false,
        viewAddress: '0xDEF',
      }),
    ).toMatchObject({
      isOwner: false,
      notOwnPage: true,
      showPen: true,
      showUsernamePen: false,
    });
    expect(
      buildUserPageProfileEditVisibility({
        account: '0xABC',
        isEditingNickname: true,
        minimized: true,
        viewAddress: '0xDEF',
      }),
    ).toMatchObject({
      showPen: false,
      showUsernamePen: false,
    });
    expect(
      resolveUserPageHeaderActionVisibility({
        explorerUrl: 'https://explorer.test/address/0xabc',
        isEditingNickname: true,
        isOwner: false,
        isSimulated: false,
        minimized: false,
        notOwnPage: true,
        propViewAddress: '0xabc',
      }),
    ).toEqual({
      showBookmarkButton: true,
      showBookmarksLink: false,
      showCopyAddressButton: true,
      showExplorerLink: false,
      showNicknameEditor: true,
      showSimulatedBadge: false,
    });
    expect(
      resolveUserPageHeaderActionVisibility({
        explorerUrl: 'https://explorer.test/address/0xabc',
        isEditingNickname: false,
        isOwner: true,
        isSimulated: false,
        minimized: true,
        notOwnPage: false,
        propViewAddress: '0xabc',
      }),
    ).toEqual({
      showBookmarkButton: false,
      showBookmarksLink: false,
      showCopyAddressButton: true,
      showExplorerLink: true,
      showNicknameEditor: false,
      showSimulatedBadge: false,
    });
    expect(
      resolveUserPageHeaderActionVisibility({
        isOwner: false,
        isSimulated: true,
        minimized: false,
        propViewAddress: '0xsim',
      }),
    ).toMatchObject({
      showBookmarkButton: false,
      showCopyAddressButton: false,
      showSimulatedBadge: true,
    });
  });

  it('resolves address display label and link precedence', () => {
    const shorten = jest.fn((address) => `short:${address}`);
    expect(
      resolveUserPageAddressDisplayState({
        cachedNickname: 'Cached Nick',
        explorerUrl: 'https://explorer.test/address/0xABC',
        getShortenedAddress: shorten,
        minimized: false,
        propViewAddress: '0xABC',
        username: 'user.eth',
      }),
    ).toMatchObject({
      addressHref: 'https://explorer.test/address/0xABC',
      addressLabel: 'Cached Nick',
      nicknameToUse: 'Cached Nick',
      pendingNicknameForThis: '',
      profileUrl: '/u/0xABC',
      shouldLinkAddressLabel: true,
    });

    expect(
      resolveUserPageAddressDisplayState({
        bookmarked: true,
        explorerUrl: 'https://explorer.test/address/0xABC',
        getShortenedAddress: shorten,
        minimized: true,
        nicknameInput: '  Pending Nick  ',
        propViewAddress: '0xABC',
        stateViewAddress: '0xabc',
        username: 'user.eth',
      }),
    ).toMatchObject({
      addressHref: '/u/0xABC',
      addressLabel: 'Pending Nick',
      nicknameToUse: 'Pending Nick',
      pendingNicknameForThis: 'Pending Nick',
    });

    expect(
      resolveUserPageAddressDisplayState({
        getShortenedAddress: shorten,
        isSimulated: false,
        propViewAddress: '0xDEF',
        stateViewAddress: '0xabc',
        username: 'real.eth',
      }).addressLabel,
    ).toBe('real.eth');
    expect(
      resolveUserPageAddressDisplayState({
        getShortenedAddress: shorten,
        isSimulated: false,
        propViewAddress: '0xDEF',
      }).addressLabel,
    ).toBe('short:0xDEF');
    expect(
      resolveUserPageBlockieSeed({
        propViewAddress: '0xABC',
        username: 'user.eth',
      }),
    ).toBe('0xABC');
    expect(
      resolveUserPageBlockieSeed({
        username: 'user.eth',
      }),
    ).toBe('user.eth');
    expect(resolveUserPageBlockieSeed()).toBe('contextengine-default-seed');
  });

  it('resolves question display text and shortened ids', () => {
    expect(resolveUserPageQuestionPromptText({ question: '  Question text  ', prompt: 'Prompt text' })).toBe(
      'Question text',
    );
    expect(resolveUserPageQuestionPromptText({ question: '   ', prompt: '  Prompt text  ' })).toBe('Prompt text');
    expect(resolveUserPageQuestionPromptText({ question: 123, prompt: null })).toBe('');
    expect(shortenUserPageQuestionId('12345678901234567890')).toBe('12345678901234567890');
    expect(shortenUserPageQuestionId('123456789012345678901')).toBe('12345678...678901');
    expect(
      resolveUserPageSurveyCreatedCardState({
        survey: {
          tags: ['tag-a'],
          documentURLs: ['https://example.test/doc'],
          questionIDs: ['q-one', 'q-two'],
          slug: ' Survey Session ',
        },
      }),
    ).toEqual({
      hasDocURLs: true,
      hasExpandContent: true,
      hasQuestionIDs: true,
      hasTags: true,
      questionPreviewEntries: [
        { id: 'q-one', text: '' },
        { id: 'q-two', text: '' },
      ],
      surveyLinkSlug: 'Survey Session',
    });
    expect(
      resolveUserPageSurveyCreatedCardState({
        survey: {
          questionPreviews: [{ id: 'preview-one', text: 'Preview text' }],
        },
      }),
    ).toEqual({
      hasDocURLs: false,
      hasExpandContent: false,
      hasQuestionIDs: false,
      hasTags: false,
      questionPreviewEntries: [{ id: 'preview-one', text: 'Preview text' }],
      surveyLinkSlug: '',
    });
    expect(resolveUserPageSurveyCreatedCardState()).toMatchObject({
      hasExpandContent: false,
      questionPreviewEntries: [],
      surveyLinkSlug: '',
    });
    expect(
      resolveUserPageSurveyPreviewDisplayState({
        actionsClassName: 'survey-preview-actions',
        baseClassName: 'survey-preview',
        interactive: true,
      }),
    ).toEqual({
      className: 'survey-preview survey-preview-actions',
      style: { cursor: 'pointer' },
    });
    expect(
      resolveUserPageSurveyPreviewDisplayState({
        actionsClassName: 'survey-preview-actions',
        baseClassName: 'survey-preview',
        interactive: false,
      }),
    ).toEqual({
      className: 'survey-preview survey-preview-actions',
      style: { cursor: 'default' },
    });
    expect(
      resolveUserPageSurveyCountDisplayState({
        count: 7,
        countOnlyClassName: 'survey-count-only',
        infoClassName: 'survey-info',
      }),
    ).toEqual({
      ariaLabel: '7 questions',
      className: 'survey-info survey-count-only',
      title: '7 questions',
    });
    expect(
      resolveUserPageSurveyResponseCardState({
        questionArray: [{ id: 'q-one' }],
        survey: {
          tags: ['tag-a'],
          documentURLs: ['https://example.test/doc'],
        },
      }),
    ).toEqual({
      hasDocURLs: true,
      hasResponses: true,
      hasTags: true,
    });
    expect(
      resolveUserPageSurveyResponseCardState({
        questionArray: [],
        survey: {
          tags: [],
          documentURLs: null,
        },
      }),
    ).toEqual({
      hasDocURLs: false,
      hasResponses: false,
      hasTags: false,
    });
    expect(
      resolveUserPageSurveySectionDisplayState({
        surveyCreationInfo: [{ id: 'created-survey' }],
        surveyResponseInfo: [{ id: 'response-survey' }],
        surveyResponsesLoadingEmpty: false,
        surveysCreatedLoadingEmpty: false,
      }),
    ).toEqual({
      hasCreatedSurveys: true,
      hasSurveyResponses: true,
      shouldRenderSurveyResponsesEmptyText: false,
      shouldRenderSurveysCreatedEmptyText: false,
    });
    expect(
      resolveUserPageSurveySectionDisplayState({
        isDeepScanning: true,
        surveyCreationInfo: [],
        surveyResponseInfo: [],
        surveyResponsesLoadingEmpty: true,
        surveysCreatedLoadingEmpty: false,
      }),
    ).toEqual({
      hasCreatedSurveys: false,
      hasSurveyResponses: false,
      shouldRenderSurveyResponsesEmptyText: false,
      shouldRenderSurveysCreatedEmptyText: false,
    });
    expect(
      resolveUserPageQuestionSectionDisplayState({
        questionCreationInfo: [{ id: 'created-one' }],
        questionResponseInfo: [{ id: 'response-one' }],
        questionResponsesLoadingEmpty: false,
        questionsCreatedLoadingEmpty: false,
      }),
    ).toEqual({
      hasCreatedQuestions: true,
      hasQuestionResponses: true,
      shouldRenderQuestionResponsesEmptyText: false,
      shouldRenderQuestionsCreatedEmptyText: false,
    });
    expect(
      resolveUserPageQuestionSectionDisplayState({
        questionCreationInfo: [],
        questionResponseInfo: [],
        questionResponsesLoadingEmpty: true,
        questionsCreatedLoadingEmpty: false,
      }),
    ).toEqual({
      hasCreatedQuestions: false,
      hasQuestionResponses: false,
      shouldRenderQuestionResponsesEmptyText: false,
      shouldRenderQuestionsCreatedEmptyText: true,
    });
    expect(
      resolveUserPageSbtDisplayState({
        isSBTCacheReady: true,
        loadingSBTs: false,
        sbtList: [{ address: '0xA' }],
        sbtSectionLoadingEmpty: false,
      }),
    ).toEqual({
      hasSbts: true,
      shouldRenderMainEmptyText: false,
      shouldRenderModalEmptyText: false,
      shouldRenderModalSpinner: false,
    });
    expect(
      resolveUserPageSbtDisplayState({
        isSBTCacheReady: false,
        loadingSBTs: false,
        sbtList: [],
        sbtSectionLoadingEmpty: true,
      }),
    ).toEqual({
      hasSbts: false,
      shouldRenderMainEmptyText: false,
      shouldRenderModalEmptyText: false,
      shouldRenderModalSpinner: true,
    });
  });

  it('resolves question source session slug precedence', () => {
    const getSessionSlugByName = jest.fn((name: unknown) => (name === 'Mapped Session' ? 'mapped-session' : null));

    expect(
      resolveUserPageQuestionSourceSessionSlug({
        fallbackSlug: 'fallback',
        getSessionSlugByName,
        questionData: {
          sessionSlug: ' explicit-session ',
          sessionName: 'Mapped Session',
        },
      }),
    ).toBe('explicit-session');

    expect(
      resolveUserPageQuestionSourceSessionSlug({
        fallbackSlug: 'fallback',
        getSessionSlugByName,
        questionData: { sessionName: 'Mapped Session' },
      }),
    ).toBe('mapped-session');

    expect(
      resolveUserPageQuestionSourceSessionSlug({
        fallbackSlug: 'fallback',
        getSessionSlugByName,
        questionData: { sessionName: 'Local-Session_1' },
      }),
    ).toBe('Local-Session_1');

    expect(
      resolveUserPageQuestionSourceSessionSlug({
        fallbackSlug: ' fallback-session ',
        getSessionSlugByName,
        questionData: { sessionName: 'bad session name' },
      }),
    ).toBe('fallback-session');
  });
});
