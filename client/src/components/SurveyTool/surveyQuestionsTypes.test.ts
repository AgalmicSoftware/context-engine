import {
  buildActiveTagModalState,
  buildAdditionalEncryptionAudienceState,
  buildAdditionalEncryptionToggleResponseState,
  buildAnswerEncryptionAudienceState,
  buildAnswerEncryptionToggleResponseState,
  buildAutoDecryptAttemptedState,
  buildAutoDecryptToggleState,
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildBulkPromptReloadingState,
  buildCanDecryptOtherResponsesState,
  buildCommentsToggleState,
  buildClearedSurveyQuestionPoolState,
  buildCopiedQuestionsJsonState,
  buildCopiedResponseJsonState,
  buildCopiedSurveyJsonState,
  buildClearedDecryptingByKeyState,
  buildCurrentStepState,
  buildDecryptEditFailureState,
  buildDecryptEditStartState,
  buildDecryptingByKeyState,
  buildDisplayAnswerModeToggleState,
  buildDisplayAnswerModeState,
  buildEditStatsState,
  buildEditingResponseModeState,
  buildFetchedQuestionPoolState,
  buildGateSbtNameRevisionState,
  buildHasherState,
  buildHydratingPriorResponsesState,
  buildInitialSurveyQuestionsState,
  buildInitialStandaloneResponseState,
  buildInitialSurveyResponseState,
  buildJsonPreviewState,
  buildLockAudienceGateDetailsState,
  buildLockAudienceMenuState,
  buildLockedGateDetailsExpandedState,
  buildParsedViewAddressAnswersState,
  buildPrefillQueuedAfterCacheState,
  buildQuestionsJsonToggleState,
  buildQuestionPoolResponseMergeState,
  buildRenderedQuestionPayloadPoolsState,
  buildResponseEditCompleteState,
  buildResponseHydrationInvalidatedState,
  buildResponseLoadingResetState,
  buildResponseJsonToggleState,
  buildShowJsonState,
  buildSingleQuestionPlaceholderHydrationState,
  buildSingleQuestionPoolFallbackState,
  buildSingleQuestionReadyHydrationState,
  buildSingleQuestionRetryLoadingState,
  buildStandaloneAuthResetState,
  buildSurveyJsonToggleState,
  buildSurveyResponseFetchLoadingState,
  buildSurveyResponseMergeState,
  buildSubmitFailureState,
  buildSubmitPreparationErrorState,
  buildSubmitSuccessState,
  buildSubmissionErrorState,
  buildSubmitStartState,
  buildSurveysResponseStatePatch,
  buildSurveyAccountViewResetState,
  buildSurveyChangedResetState,
  buildSurveyQuestionsAuthoringRouteReadinessDescriptor,
  buildSurveyQuestionsAuthoringPanelDisplayState,
  buildSurveyQuestionsFullLoadingProgressFillStyle,
  buildSurveyQuestionsFullLoadingProgressState,
  buildSurveyQuestionsJsonTreeItemStyle,
  buildSurveyQuestionsLayoutDisplayState,
  buildSurveyQuestionsMaskedQuestionVisibility,
  buildSurveyQuestionsPrimarySubmitPlan,
  buildSurveyQuestionsRenderReadinessDescriptor,
  buildSurveyQuestionsLockAudienceGateClassName,
  buildSurveyQuestionsLockAudiencePopoverClassName,
  buildSurveyQuestionsLockAudienceToggleClassName,
  buildSurveyQuestionsRouteViewDisplayState,
  buildSurveyQuestionsSubmitAuxIconClassName,
  buildSurveyQuestionsSubmitFooterDisplayState,
  buildSurveyUserEditResponseStatePatch,
  buildSurveyQuestionPoolLoadState,
  buildVisiblePileQuestionsAfterPromptDecryptState,
  buildViewingResponseModeState,
  buildViewedSurveyNoResponseState,
  buildViewedSurveyResponseState,
  buildUserSurveyResponseFoundState,
  buildUserSurveyResponseMissingState,
  isSurveyQuestionsMaskedPromptText,
  resolveSurveyQuestionsIconGlowClassName,
  SURVEY_QUESTIONS_SUBMISSION_ERROR_STYLE,
  SURVEY_QUESTIONS_SUBMIT_ICON_STYLE,
  toggleShowJsonState,
} from './surveyQuestionsTypes.js';

describe('surveyQuestionsTypes', () => {
  it('builds the default SurveyQuestions state for non-standalone flows', () => {
    const state = buildInitialSurveyQuestionsState({
      displayAnswerMode: true,
      isStandalone: false,
      singleQuestionMode: false,
      questionPool: [{ id: 'q1' }],
    });

    expect(state.displayAnswerMode).toBe(true);
    expect(state.questionPool).toEqual([]);
    expect(state.surveysResponseState).toEqual([]);
    expect(state.bookmarkedQuestions).toEqual(new Set());
    expect(state.submittedSinceLastEdit).toBe(false);
    expect(state.canDecryptOtherResponsesStatus).toBe('unknown');
  });

  it('seeds standalone and single-question flows with the provided question pool', () => {
    const questionPool = [{ id: 'q1' }, { id: 'q2' }];

    expect(
      buildInitialSurveyQuestionsState({
        isStandalone: true,
        singleQuestionMode: false,
        questionPool,
      }).questionPool,
    ).toBe(questionPool);

    expect(
      buildInitialSurveyQuestionsState({
        isStandalone: false,
        singleQuestionMode: true,
        questionPool,
      }).questionPool,
    ).toBe(questionPool);
  });

  it('builds the cleared question-pool patch used by fetch fallbacks', () => {
    expect(buildClearedSurveyQuestionPoolState()).toEqual({
      questionPool: [],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
    });
  });

  it('builds SurveyQuestions display class names and styles', () => {
    const styleMap = {
      convictionToggleButtonActive: 'active',
      convictionToggleLine: 'line',
      iconGlow: 'glow',
      iconButton: 'icon',
      lockAudienceGateButton: 'gate',
      lockAudiencePopover: 'popover',
      pileLockAudiencePopover: 'pile',
      singleQuestionSubmitIconButton: 'single-submit-icon',
    };

    expect(buildSurveyQuestionsJsonTreeItemStyle(3)).toEqual({ marginLeft: '60px' });
    expect(buildSurveyQuestionsLockAudienceGateClassName(styleMap, true)).toBe('line gate active');
    expect(buildSurveyQuestionsLockAudienceGateClassName(styleMap, false)).toBe('line gate ');
    expect(buildSurveyQuestionsLockAudiencePopoverClassName(styleMap, true)).toBe('popover pile');
    expect(buildSurveyQuestionsLockAudiencePopoverClassName(styleMap, false)).toBe('popover ');
    expect(buildSurveyQuestionsLockAudienceToggleClassName(styleMap, true)).toBe('line active');
    expect(buildSurveyQuestionsLockAudienceToggleClassName(styleMap, false)).toBe('line ');
    expect(resolveSurveyQuestionsIconGlowClassName(styleMap, true)).toBe('glow');
    expect(resolveSurveyQuestionsIconGlowClassName(styleMap, false)).toBeUndefined();
    expect(SURVEY_QUESTIONS_SUBMIT_ICON_STYLE).toEqual({ marginRight: '10px' });
    expect(SURVEY_QUESTIONS_SUBMISSION_ERROR_STYLE).toEqual({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--ce-status-danger-text)',
    });
    expect(
      buildSurveyQuestionsFullLoadingProgressFillStyle({
        hydrateDiscovered: 8,
        hydrateDone: 3,
        isHydrating: true,
        scanPercent: 92,
      }),
    ).toEqual({ width: '38%' });
    expect(
      buildSurveyQuestionsFullLoadingProgressFillStyle({
        hydrateDiscovered: 0,
        hydrateDone: 0,
        isHydrating: true,
        scanPercent: 92,
      }),
    ).toEqual({ width: '0%' });
    expect(
      buildSurveyQuestionsFullLoadingProgressFillStyle({
        isHydrating: false,
        scanPercent: 92,
      }),
    ).toEqual({ width: '92%' });
    expect(buildSurveyQuestionsSubmitAuxIconClassName(styleMap, true)).toBe('icon single-submit-icon');
    expect(buildSurveyQuestionsSubmitAuxIconClassName(styleMap, false)).toBe('icon');
  });

  it('builds SurveyQuestions authoring panel display state without moving parent-owned actions', () => {
    expect(
      buildSurveyQuestionsAuthoringPanelDisplayState({
        canEditQuestions: true,
        hasCurrentSurveyResponseState: true,
        hideEmbeddedDebugUi: false,
        questionPoolReady: true,
        singleQuestionMode: false,
      }),
    ).toEqual({
      showBackToTopControl: true,
      showJsonControl: true,
      showLockedQuestionsBanner: true,
    });

    expect(
      buildSurveyQuestionsAuthoringPanelDisplayState({
        canEditQuestions: true,
        hasCurrentSurveyResponseState: true,
        hideEmbeddedDebugUi: true,
        questionPoolReady: true,
        singleQuestionMode: false,
      }),
    ).toEqual({
      showBackToTopControl: true,
      showJsonControl: false,
      showLockedQuestionsBanner: false,
    });

    expect(
      buildSurveyQuestionsAuthoringPanelDisplayState({
        canEditQuestions: true,
        hasCurrentSurveyResponseState: true,
        hideEmbeddedDebugUi: false,
        questionPoolReady: true,
        singleQuestionMode: true,
      }),
    ).toEqual({
      showBackToTopControl: false,
      showJsonControl: false,
      showLockedQuestionsBanner: true,
    });
  });

  it('builds SurveyQuestions authoring route readiness without owning rendering', () => {
    expect(
      buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
        canEditQuestions: true,
        gatedEmptyStateReady: false,
        hasCurrentSurveyResponseState: true,
        questionPoolReady: true,
        visibleQuestionPool: [{ id: 'q1' }],
      }),
    ).toEqual({
      canEditQuestions: true,
      gatedEmptyStateReady: false,
      hasCurrentSurveyResponseState: true,
      hasVisibleQuestions: true,
      questionPoolReady: true,
      shouldRenderEditableQuestions: true,
      visibleQuestionCount: 1,
    });

    expect(
      buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
        canEditQuestions: true,
        gatedEmptyStateReady: true,
        hasCurrentSurveyResponseState: true,
        questionPoolReady: true,
        visibleQuestionPool: [{ id: 'q1' }],
      }).shouldRenderEditableQuestions,
    ).toBe(false);

    expect(
      buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
        canEditQuestions: true,
        gatedEmptyStateReady: false,
        hasCurrentSurveyResponseState: true,
        questionPoolReady: true,
        visibleQuestionPool: null,
      }),
    ).toMatchObject({
      hasVisibleQuestions: false,
      shouldRenderEditableQuestions: false,
      visibleQuestionCount: 0,
    });
  });

  it('builds SurveyQuestions full loading progress state for scan progress', () => {
    const progressState = buildSurveyQuestionsFullLoadingProgressState({
      progressSlug: 'session-a',
      questionScanProgress: {
        slug: 'session-a',
        totalBlocks: 100,
        scannedBlocks: 25,
      },
    });

    expect(progressState.hasFullLoadingProgress).toBe(true);
    expect(progressState.isHydrating).toBe(false);
    expect(progressState.metaLeftText).toBe('75 blocks left');
    expect(progressState.metaRightText).toBe('25 / 100');
    expect(progressState.fillStyle).toEqual({ width: '25%' });
  });

  it('builds SurveyQuestions hydrate progress labels and clamps completed counts', () => {
    const progressState = buildSurveyQuestionsFullLoadingProgressState({
      progressSlug: '',
      questionScanProgress: {
        slug: 'GENERAL',
        phase: 'hydrate',
        discoveredQuestions: 8,
        hydratedQuestions: 12,
      },
    });

    expect(progressState.hasFullLoadingProgress).toBe(true);
    expect(progressState.isHydrating).toBe(true);
    expect(progressState.hydrateDiscovered).toBe(8);
    expect(progressState.hydrateDone).toBe(12);
    expect(progressState.metaLeftText).toBe('0 items left');
    expect(progressState.metaRightText).toBe('8 / 8');
    expect(progressState.fillStyle).toEqual({ width: '100%' });
  });

  it('ignores SurveyQuestions full loading progress for unrelated slugs', () => {
    const progressState = buildSurveyQuestionsFullLoadingProgressState({
      progressSlug: 'session-a',
      questionScanProgress: {
        slug: 'session-b',
        totalBlocks: 100,
        scannedBlocks: 25,
      },
    });

    expect(progressState.questionScanProgress).toBeNull();
    expect(progressState.hasFullLoadingProgress).toBe(false);
    expect(progressState.metaLeftText).toBe('0 blocks left');
    expect(progressState.metaRightText).toBe('0 / 0');
    expect(progressState.fillStyle).toEqual({ width: '0%' });
  });

  it('builds SurveyQuestions JSON panel display state for full survey flows', () => {
    const styleMap = {
      singleQuestionJsonPanel: 'single-panel',
      singleQuestionJsonRow: 'single-row',
      singleQuestionJsonToggle: 'single-toggle',
      singleQuestionJsonToggleQuestion: 'question-toggle',
      singleQuestionJsonToggleResponse: 'response-toggle',
      surveyJsonRow: 'json-row',
    };

    expect(
      buildSurveyQuestionsJsonPanelDisplayState({
        isSingleQuestionView: false,
        isStandalone: false,
        singleQuestionMode: false,
        showQuestionsJson: true,
        showResponseJson: true,
        showSurveyJson: true,
        styleMap,
      }),
    ).toEqual({
      showFullSurveyJsonControls: true,
      showQuestionJsonControls: false,
      showSurveyJsonPanel: true,
      showQuestionsJsonPanel: false,
      showResponseJsonPanel: true,
      surveyJsonRowClassName: 'json-row',
      surveyJsonToggleClassName: undefined,
      questionJsonToggleClassName: undefined,
      responseJsonToggleClassName: undefined,
      surveyJsonPanelClassName: undefined,
    });
  });

  it('builds SurveyQuestions JSON panel display state for single-question flows', () => {
    const styleMap = {
      singleQuestionJsonPanel: 'single-panel',
      singleQuestionJsonRow: 'single-row',
      singleQuestionJsonToggle: 'single-toggle',
      singleQuestionJsonToggleQuestion: 'question-toggle',
      singleQuestionJsonToggleResponse: 'response-toggle',
      surveyJsonRow: 'json-row',
    };

    expect(
      buildSurveyQuestionsJsonPanelDisplayState({
        isSingleQuestionView: true,
        isStandalone: true,
        singleQuestionMode: false,
        showQuestionsJson: true,
        showResponseJson: true,
        showSurveyJson: true,
        styleMap,
      }),
    ).toEqual({
      showFullSurveyJsonControls: false,
      showQuestionJsonControls: true,
      showSurveyJsonPanel: false,
      showQuestionsJsonPanel: true,
      showResponseJsonPanel: true,
      surveyJsonRowClassName: 'json-row single-row',
      surveyJsonToggleClassName: 'single-toggle',
      questionJsonToggleClassName: 'single-toggle question-toggle',
      responseJsonToggleClassName: 'single-toggle response-toggle',
      surveyJsonPanelClassName: 'single-panel',
    });
  });

  it('builds SurveyQuestions JSON display payloads for preview and viewed responses', () => {
    const jsonPreview = { preview: true };
    const userAnswers = { responses: [{ q: 'own' }] };
    const parsedViewAddressAnswers = { responses: [{ q: 'other' }] };

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        jsonPreview,
        viewingAnswers: false,
      }).jsonForDisplay,
    ).toBe(jsonPreview);

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        isOwnResponse: true,
        jsonPreview,
        userAnswers,
        viewingAnswers: true,
      }).jsonForDisplay,
    ).toBe(userAnswers);

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        isOwnResponse: false,
        parsedViewAddressAnswers,
        viewingAnswers: true,
      }).jsonForDisplay,
    ).toBe(parsedViewAddressAnswers);
  });

  it('builds SurveyQuestions route JSON preview availability from route mode', () => {
    const jsonPreview = { preview: true };

    expect(
      buildSurveyQuestionsJsonPreviewDisplayState({
        jsonPreview,
        questionPool: null,
        viewingAnswers: false,
      }),
    ).toEqual({
      canUseJsonPreview: true,
      jsonPreview,
    });

    expect(
      buildSurveyQuestionsJsonPreviewDisplayState({
        jsonPreview,
        questionPool: [{ id: 'q1' }],
        viewingAnswers: true,
      }),
    ).toEqual({
      canUseJsonPreview: true,
      jsonPreview,
    });

    expect(
      buildSurveyQuestionsJsonPreviewDisplayState({
        jsonPreview,
        questionPool: null,
        viewingAnswers: true,
      }),
    ).toEqual({
      canUseJsonPreview: false,
      jsonPreview: null,
    });

    expect(
      buildSurveyQuestionsJsonPreviewDisplayState({
        jsonPreview: '',
        questionPool: [],
        viewingAnswers: true,
      }),
    ).toEqual({
      canUseJsonPreview: true,
      jsonPreview: {},
    });
  });

  it('builds SurveyQuestions JSON display fallbacks for missing responses', () => {
    const jsonPreview = { preview: true };

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        isOwnResponse: true,
        jsonPreview,
        userAnswers: null,
        viewingAnswers: true,
      }).jsonForDisplay,
    ).toBe(jsonPreview);

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        isOwnResponse: false,
        parsedViewAddressAnswers: null,
        viewingAnswers: true,
      }).jsonForDisplay,
    ).toEqual({ info: 'Loading viewed response...' });

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        noResponse: true,
        viewAddress: '0xabc',
        viewingAnswers: true,
      }).jsonForDisplay,
    ).toEqual({
      message: 'No response found for survey from address: 0xabc',
    });

    expect(
      buildSurveyQuestionsJsonForDisplayState({
        noResponse: true,
        singleQuestionMode: true,
        viewingAnswers: true,
      }).jsonForDisplay,
    ).toEqual({
      message: 'No response found for question from address: N/A',
    });
  });

  it('builds SurveyQuestions layout display state for full survey flows', () => {
    const styleMap = {
      singleQuestionPage: 'single-page',
      singleQuestionReadPage: 'single-read',
      singleQuestionResponseView: 'single-response',
      singleQuestionTopBar: 'single-top',
    };

    expect(
      buildSurveyQuestionsLayoutDisplayState({
        activeTagModalTag: ' governance ',
        isStandalone: false,
        singleQuestionMode: false,
        styleMap,
        viewingAnswers: true,
      }),
    ).toEqual({
      activeTagModalTag: 'governance',
      responseViewClassName: undefined,
      surveyPageClassName: undefined,
      topSectionClassName: undefined,
      useTagModal: true,
    });
  });

  it('builds SurveyQuestions layout display state for single-question flows', () => {
    const styleMap = {
      singleQuestionPage: 'single-page',
      singleQuestionReadPage: 'single-read',
      singleQuestionResponseView: 'single-response',
      singleQuestionTopBar: 'single-top',
    };

    expect(
      buildSurveyQuestionsLayoutDisplayState({
        activeTagModalTag: ' governance ',
        isSingleQuestionView: true,
        isStandalone: true,
        singleQuestionMode: true,
        styleMap,
        viewingAnswers: true,
      }),
    ).toEqual({
      activeTagModalTag: '',
      responseViewClassName: 'single-response',
      surveyPageClassName: 'single-page single-read',
      topSectionClassName: 'single-top',
      useTagModal: false,
    });
  });

  it('builds SurveyQuestions route view display state for viewed addresses', () => {
    const shortenAddress = jest.fn((address, notClickable) => `${address}:${notClickable}`);

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        responderAddress: '0xdef',
        shortenAddress,
        viewAddress: ' 0xABC ',
      }),
    ).toEqual({
      viewedAddressRaw: '0xABC',
      viewedAddressLower: '0xabc',
      shortenedViewAddress: '0xABC:false',
      isOwnResponse: false,
      isSingleQuestionView: undefined,
      showViewAnswersButton: true,
      viewAnswersButtonText: ' View 0xABC:false answers',
    });
    expect(shortenAddress).toHaveBeenCalledWith('0xABC', false);
  });

  it('preserves SurveyQuestions route view fallback and own-response checks', () => {
    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        responderAddress: '0xABC',
      }),
    ).toMatchObject({
      viewedAddressRaw: '0xABC',
      viewedAddressLower: '0xabc',
      shortenedViewAddress: '0xABC',
      isOwnResponse: true,
    });

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        responderAddress: '0xABC',
        viewAddress: '0xdef',
      }),
    ).toMatchObject({
      viewedAddressRaw: '0xdef',
      isOwnResponse: true,
    });

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        userHasResponse: true,
      }).isOwnResponse,
    ).toBe(true);

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        viewAddress: '0xABC',
      }).isOwnResponse,
    ).toBe(true);

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        viewAddress: ' 0xABC ',
      }).isOwnResponse,
    ).toBe(false);

    expect(buildSurveyQuestionsRouteViewDisplayState().shortenedViewAddress).toBe('');
  });

  it('builds SurveyQuestions single-question route flags without moving state', () => {
    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        singleQuestionMode: true,
      }).isSingleQuestionView,
    ).toBe(true);

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        isStandalone: true,
        questionPool: [{ id: 'q1' }],
      }).isSingleQuestionView,
    ).toBe(true);

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        isStandalone: true,
        questionPool: [{ id: 'q1' }, { id: 'q2' }],
      }).isSingleQuestionView,
    ).toBe(false);

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        isStandalone: true,
        questionPool: null,
      }).isSingleQuestionView,
    ).toBe(false);
  });

  it('builds SurveyQuestions view-answer toggle labels', () => {
    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        viewingAnswers: true,
      }),
    ).toMatchObject({
      viewAnswersButtonText: ' Fill out survey',
    });

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        singleQuestionMode: true,
        viewingAnswers: true,
      }),
    ).toMatchObject({
      viewAnswersButtonText: ' Fill out question',
    });

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        shortenAddress: () => '0xabc...1234',
        viewAddress: '0xabcdef1234',
      }),
    ).toMatchObject({
      viewAnswersButtonText: ' View 0xabc...1234 answers',
    });

    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        shortenAddress: () => '0xabc...1234',
        singleQuestionMode: true,
        viewAddress: '0xabcdef1234',
      }),
    ).toMatchObject({
      viewAnswersButtonText: ' View 0xabc...1234 answer',
    });
  });

  it('builds SurveyQuestions view-answer toggle visibility', () => {
    expect(buildSurveyQuestionsRouteViewDisplayState().showViewAnswersButton).toBeUndefined();
    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        isEditing: true,
        account: '0xabc',
        viewAddress: '0xabc',
      }).showViewAnswersButton,
    ).toBe(false);
    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        account: '0xabc',
        isEditing: false,
        viewAddress: '0xabc',
      }).showViewAnswersButton,
    ).toBe(true);
    expect(
      buildSurveyQuestionsRouteViewDisplayState({
        isEditing: true,
        responderAddress: '0xdef',
      }).showViewAnswersButton,
    ).toBe(true);
  });

  it('builds primary submit plans for inert and submit boundaries', () => {
    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        isSubmitting: true,
        pendingEditCount: 1,
      }),
    ).toEqual({
      action: 'inert',
      reason: 'submitting',
      path: '',
    });

    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        submitGuardActive: true,
        pendingEditCount: 1,
      }),
    ).toEqual({
      action: 'inert',
      reason: 'submit_guard',
      path: '',
    });

    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        submittedSinceLastEdit: true,
        submissionComplete: false,
        pendingEditCount: 0,
      }),
    ).toEqual({
      action: 'inert',
      reason: 'submitted_without_new_edits',
      path: '',
    });

    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        pendingEditCount: 2,
        submittedSinceLastEdit: true,
      }),
    ).toEqual({
      action: 'submit',
      reason: 'pending_edits',
      path: '',
    });
  });

  it('builds completed-response navigation plans without mutating route state', () => {
    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        account: '0xABC',
        draftSlug: 'edge session',
        pendingEditCount: 0,
        submissionComplete: true,
        surveyId: '0xSurveyABC',
      }),
    ).toEqual({
      action: 'navigate',
      reason: 'completed_survey_response',
      path: '/survey/0xsurveyabc/0xabc?session=edge%20session',
    });

    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        account: '0xABC',
        draftSlug: 'edge',
        pendingEditCount: 0,
        questionID: 'Q1',
        singleQuestionMode: true,
        submissionComplete: true,
      }),
    ).toEqual({
      action: 'navigate',
      reason: 'completed_single_question_response',
      path: '/question/q1?session=edge&responder=0xabc',
    });

    expect(
      buildSurveyQuestionsPrimarySubmitPlan({
        account: '0xABC',
        isStandalone: true,
        pendingEditCount: 0,
        submissionComplete: true,
      }),
    ).toEqual({
      action: 'inert',
      reason: 'completed_standalone_response',
      path: '',
    });
  });

  it('builds SurveyQuestions submit footer affordance display state', () => {
    expect(
      buildSurveyQuestionsSubmitFooterDisplayState({
        currentStep: 1,
        hasEncryptedAnswers: true,
        isDirty: true,
        isSubmitting: true,
        pendingEditCount: 3,
      }),
    ).toEqual({
      submittedStateActive: false,
      submittedIndicatorActive: false,
      singleQuestionSubmittedIndicatorActive: false,
      showSubmitAux: false,
      uploadStatusText: 'Encrypting...',
      submitDisabled: true,
      canEditQuestions: true,
      hasPendingEdits: true,
      genericShowInlineSubmit: true,
      showInlineSubmit: true,
      showTopInlineSubmit: true,
    });

    expect(
      buildSurveyQuestionsSubmitFooterDisplayState({
        isLoadingResponse: false,
        responseUrl: 'https://example.test/response',
        submissionComplete: true,
        userHasResponse: true,
      }),
    ).toMatchObject({
      submittedStateActive: true,
      submittedIndicatorActive: true,
      singleQuestionSubmittedIndicatorActive: true,
      showSubmitAux: true,
      uploadStatusText: 'Uploading...',
      canEditQuestions: false,
      hasPendingEdits: false,
      genericShowInlineSubmit: true,
      showInlineSubmit: true,
      showTopInlineSubmit: true,
    });
  });

  it('describes submit readiness for encrypted upload status and masked single-question payloads', () => {
    const maskedResolver = jest.fn(() => true);

    expect(
      buildSurveyQuestionsSubmitReadinessDescriptor({
        currentStep: 1,
        isSubmitting: true,
        pendingStats: { total: 3, encrypted: 2 },
        resolveMaskedCurrentQuestionPayload: maskedResolver,
        singleQuestionMode: true,
      }),
    ).toEqual({
      currentStep: 1,
      encryptedPendingEditCount: 2,
      hasEncryptedAnswers: true,
      hasMaskedCurrentQuestionPayload: false,
      isSubmitting: true,
      pendingEditCount: 3,
      shouldCheckMaskedCurrentQuestionPayload: false,
      singleQuestionMode: true,
      uploadPhase: 'encrypting',
    });
    expect(maskedResolver).not.toHaveBeenCalled();

    expect(
      buildSurveyQuestionsSubmitReadinessDescriptor({
        currentStep: 0,
        isSubmitting: false,
        pendingStats: { total: '1', encrypted: '0' },
        resolveMaskedCurrentQuestionPayload: maskedResolver,
        singleQuestionMode: true,
      }),
    ).toEqual({
      currentStep: 0,
      encryptedPendingEditCount: 0,
      hasEncryptedAnswers: false,
      hasMaskedCurrentQuestionPayload: true,
      isSubmitting: false,
      pendingEditCount: 1,
      shouldCheckMaskedCurrentQuestionPayload: true,
      singleQuestionMode: true,
      uploadPhase: 'uploading',
    });
    expect(maskedResolver).toHaveBeenCalledTimes(1);
  });

  it('keeps submit readiness unmasked outside single-question mode', () => {
    const maskedResolver = jest.fn(() => true);

    expect(
      buildSurveyQuestionsSubmitReadinessDescriptor({
        currentStep: 'not-a-step',
        isSubmitting: false,
        pendingStats: { total: 2, encrypted: 'not-a-count' },
        resolveMaskedCurrentQuestionPayload: maskedResolver,
        singleQuestionMode: false,
      }),
    ).toMatchObject({
      currentStep: 0,
      encryptedPendingEditCount: 0,
      hasEncryptedAnswers: false,
      hasMaskedCurrentQuestionPayload: false,
      pendingEditCount: 2,
      shouldCheckMaskedCurrentQuestionPayload: false,
      uploadPhase: 'uploading',
    });
    expect(maskedResolver).not.toHaveBeenCalled();
  });

  it('builds SurveyQuestions single-question submit display state without route affordances', () => {
    expect(
      buildSurveyQuestionsSubmitFooterDisplayState({
        hasMaskedCurrentQuestionPayload: true,
        isDirty: true,
        isSingleQuestionView: true,
        pendingEditCount: 1,
        responseUrl: 'https://example.test/response',
        singleQuestionMode: true,
        submittedSinceLastEdit: true,
        userHasResponse: true,
      }),
    ).toEqual({
      submittedStateActive: true,
      submittedIndicatorActive: true,
      singleQuestionSubmittedIndicatorActive: false,
      showSubmitAux: false,
      uploadStatusText: 'Uploading...',
      submitDisabled: true,
      canEditQuestions: false,
      hasPendingEdits: true,
      genericShowInlineSubmit: true,
      showInlineSubmit: true,
      showTopInlineSubmit: false,
    });
  });

  it('reports no pending question-pool work for standalone and single-question flows', () => {
    expect(
      buildSurveyQuestionPoolLoadState({
        isStandalone: true,
        questionPoolExpectedIds: ['q1'],
        questionPoolPendingIds: ['q1'],
      }),
    ).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });

    expect(
      buildSurveyQuestionPoolLoadState({
        singleQuestionMode: true,
        questionPoolExpectedIds: ['q1'],
        questionPoolPendingIds: ['q1'],
      }),
    ).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('derives pending question-pool metadata for survey flows', () => {
    expect(
      buildSurveyQuestionPoolLoadState({
        isStandalone: false,
        singleQuestionMode: false,
        questionPoolExpectedIds: ['q1', 'q2'],
        questionPoolPendingIds: ['q2'],
      }),
    ).toEqual({
      expectedIds: ['q1', 'q2'],
      pendingIds: ['q2'],
      pendingCount: 1,
      isIncomplete: true,
    });

    expect(
      buildSurveyQuestionPoolLoadState({
        questionPoolExpectedIds: ['q1'],
        questionPoolPendingIds: [],
      }),
    ).toEqual({
      expectedIds: ['q1'],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('builds masked question visibility without owning render memoization', () => {
    const encryptedPrompt = { id: 'Q1', prompt: '[encrypted]' };
    const decryptedPrompt = { id: 'Q2', prompt: '[encrypted]', promptDecrypted: true };
    const plainPrompt = { id: 'Q3', prompt: 'Plain prompt' };
    const anonymousMaskedPrompt = { prompt: '[encrypted]' };
    const pendingMetadataPlaceholder = {
      id: 'QPending',
      prompt: '[encrypted]',
      __ceQuestionMetadataPending: true,
    };
    const questionPool = [
      encryptedPrompt,
      decryptedPrompt,
      plainPrompt,
      anonymousMaskedPrompt,
      null,
      pendingMetadataPlaceholder,
    ];
    const concreteQuestionPool = [encryptedPrompt, decryptedPrompt, plainPrompt, anonymousMaskedPrompt, null];

    expect(isSurveyQuestionsMaskedPromptText(' [encrypted] ')).toBe(true);
    expect(isSurveyQuestionsMaskedPromptText('[Encrypted]')).toBe(false);
    expect(
      buildSurveyQuestionsMaskedQuestionVisibility({
        questionPool,
        singleQuestionMode: false,
      }),
    ).toEqual({
      fullQuestionPool: concreteQuestionPool,
      visibleQuestionPool: [decryptedPrompt, plainPrompt, null],
      hiddenMaskedQuestionIds: ['q1'],
    });
    expect(
      buildSurveyQuestionsMaskedQuestionVisibility({
        questionPool,
        singleQuestionMode: true,
      }),
    ).toEqual({
      fullQuestionPool: concreteQuestionPool,
      visibleQuestionPool: concreteQuestionPool,
      hiddenMaskedQuestionIds: [],
    });

    const injectedPredicate = jest.fn((prompt) => prompt === 'LOCKED');
    expect(
      buildSurveyQuestionsMaskedQuestionVisibility({
        isMaskedPromptText: injectedPredicate,
        questionPool: [
          { id: 'custom', prompt: 'LOCKED' },
          { id: 'plain', prompt: '[encrypted]' },
        ],
        singleQuestionMode: false,
      }),
    ).toEqual({
      fullQuestionPool: [
        { id: 'custom', prompt: 'LOCKED' },
        { id: 'plain', prompt: '[encrypted]' },
      ],
      visibleQuestionPool: [{ id: 'plain', prompt: '[encrypted]' }],
      hiddenMaskedQuestionIds: ['custom'],
    });
    expect(injectedPredicate).toHaveBeenCalledWith('LOCKED');
  });

  it('builds render readiness while preserving display-answer fallthrough', () => {
    const descriptor = buildSurveyQuestionsRenderReadinessDescriptor({
      displayAnswerMode: true,
      parsedViewAddressAnswers: { answers: {} },
      questionPool: [],
      singleQuestionMode: true,
      surveyIndex: 2,
      surveysResponseState: [],
    });

    expect(descriptor).toMatchObject({
      surveyIndex: 0,
      currentSurveyResponseState: null,
      questionPoolReady: false,
      canFallThroughDisplayAnswerMode: true,
      shouldShowLoadingState: false,
      gatedEmptyStateReady: false,
      hasHiddenMaskedQuestions: false,
    });
  });

  it('keeps render readiness loading when only pending metadata placeholders exist', () => {
    const responseSlice = { answers: {} };
    const descriptor = buildSurveyQuestionsRenderReadinessDescriptor({
      fullQuestionPool: [],
      hiddenMaskedQuestionIds: [],
      isQuestionCacheReady: false,
      questionPool: [
        {
          id: 'qpending',
          prompt: '[encrypted]',
          __ceQuestionMetadataPending: true,
        },
      ],
      singleQuestionMode: false,
      surveyIndex: 0,
      surveysResponseState: [responseSlice],
      visibleQuestionPool: [],
    });

    expect(descriptor).toMatchObject({
      currentSurveyResponseState: responseSlice,
      questionPoolReady: false,
      gatedEmptyStateReady: false,
      hasHiddenMaskedQuestions: false,
      shouldShowLoadingState: true,
    });
  });

  it('describes gated empty-state readiness from masked question visibility', () => {
    const responseSlice = { answers: {} };
    const descriptor = buildSurveyQuestionsRenderReadinessDescriptor({
      fullQuestionPool: [{ id: 'q1' }, { id: 'q2' }],
      hiddenMaskedQuestionIds: ['q1', 2],
      isQuestionCacheReady: true,
      questionPool: [{ id: 'q1' }, { id: 'q2' }],
      singleQuestionMode: false,
      surveyIndex: 1,
      surveysResponseState: [{ answers: { q0: 'skip' } }, responseSlice],
      visibleQuestionPool: [],
    });

    expect(descriptor).toMatchObject({
      surveyIndex: 1,
      currentSurveyResponseState: responseSlice,
      questionPoolReady: true,
      gatedEmptyStateReady: true,
      hasHiddenMaskedQuestions: true,
      hiddenMaskedQuestionIds: ['q1', '2'],
      shouldShowLoadingState: false,
    });
  });

  it('builds the auto-decrypt disabled state patch', () => {
    expect(buildAutoDecryptDisabledState()).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
    expect(buildClearedDecryptingByKeyState()).toEqual({
      decryptingByKey: {},
    });
  });

  it('builds the response-decrypt capability state patch', () => {
    expect(buildCanDecryptOtherResponsesState()).toEqual({
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'unknown',
    });

    expect(
      buildCanDecryptOtherResponsesState({
        canDecrypt: true,
        status: 'granted',
      }),
    ).toEqual({
      canDecryptOtherResponses: true,
      canDecryptOtherResponsesStatus: 'granted',
    });
  });

  it('builds normalized bookmarked question state', () => {
    expect(buildBookmarkedQuestionsState()).toEqual({
      bookmarkedQuestions: new Set(),
    });

    expect(buildBookmarkedQuestionsState(['q1', 2])).toEqual({
      bookmarkedQuestions: new Set(['q1', '2']),
    });
  });

  it('builds SurveyQuestions UI feedback state patches', () => {
    const hasher = jest.fn();

    expect(buildDecryptEditStartState()).toEqual({
      isDecrypting: true,
      submissionError: '',
      suppressPrefill: true,
    });
    expect(buildDecryptEditFailureState('No key')).toEqual({
      isDecrypting: false,
      submissionError: 'No key',
    });
    expect(buildDecryptEditFailureState('')).toEqual({
      isDecrypting: false,
      submissionError: 'Decryption failed.',
    });
    expect(buildResponseEditCompleteState()).toEqual({
      isEditing: false,
      userHasResponse: true,
      userResponseEncrypted: true,
    });
    expect(buildParsedViewAddressAnswersState()).toEqual({
      parsedViewAddressAnswers: null,
    });
    expect(buildDisplayAnswerModeState('prop-value')).toEqual({
      displayAnswerMode: 'prop-value',
    });
    expect(buildViewingResponseModeState()).toEqual({
      displayAnswerMode: true,
      isEditing: false,
    });
    expect(buildEditingResponseModeState()).toEqual({
      displayAnswerMode: false,
      isEditing: true,
    });
    expect(buildSubmissionErrorState('Missing recipients')).toEqual({
      submissionError: 'Missing recipients',
    });
    expect(buildResponseLoadingResetState(false)).toEqual({
      isLoadingResponse: true,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
    });
    expect(buildSurveyChangedResetState(false)).toEqual({
      userHasResponse: false,
      userAnswers: null,
      parsedViewAddressAnswers: null,
      noResponse: false,
      questionPool: [],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
      isEditing: false,
      surveysResponseState: [],
      jsonPreview: '',
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
    });
    expect(
      buildSurveyAccountViewResetState({
        noResponse: 'keep-no-response',
        parsedViewAddressAnswers: { answer: 'keep' },
        submittedSinceLastEdit: true,
      }),
    ).toEqual({
      isLoadingResponse: true,
      userHasResponse: false,
      userAnswers: null,
      isEditing: false,
      parsedViewAddressAnswers: { answer: 'keep' },
      noResponse: 'keep-no-response',
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: true,
    });
    expect(buildStandaloneAuthResetState(false)).toEqual({
      isEditing: false,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
    });
    expect(buildSubmitStartState()).toEqual({
      isSubmitting: true,
      submitProgress: 0,
      currentStep: 1,
      submissionError: '',
    });
    expect(buildSubmitPreparationErrorState()).toEqual({
      isSubmitting: false,
      submitProgress: 0,
      submissionError: 'No new or changed responses to submit.',
    });
    expect(buildSubmitPreparationErrorState('Missing changes')).toEqual({
      isSubmitting: false,
      submitProgress: 0,
      submissionError: 'Missing changes',
    });
    const submittedResponses = [{ answers: { q1: { value: 'yes' } } }];
    const submittedBaseline = { answers: { q1: { value: 'yes' } } };
    const submittedAnswers = { q1: 'yes' };
    expect(
      buildSubmitSuccessState({
        editBaseline: submittedBaseline,
        hasEncrypted: 1,
        responseUrl: 'https://example.com/response',
        submittedSinceLastEdit: true,
        surveysResponseState: submittedResponses,
        userAnswers: submittedAnswers,
      }),
    ).toEqual({
      isSubmitting: false,
      submitProgress: 100,
      submissionComplete: true,
      submittedSinceLastEdit: true,
      currentStep: 3,
      suppressPrefill: false,
      responseUrl: 'https://example.com/response',
      surveysResponseState: submittedResponses,
      editBaseline: submittedBaseline,
      userAnswers: submittedAnswers,
      userHasResponse: true,
      userResponseEncrypted: true,
      isDirty: false,
      modifiedCount: 0,
      pileDiscardedEdits: false,
      hasEncryptedChanges: false,
    });
    expect(
      buildSubmitFailureState({
        submittedSinceLastEdit: false,
        submissionError: '',
      }),
    ).toEqual({
      isSubmitting: false,
      submitProgress: 0,
      submissionComplete: false,
      submittedSinceLastEdit: false,
      submissionError: 'Submission failed.',
    });
    expect(buildCurrentStepState(2)).toEqual({
      currentStep: 2,
    });
    const surveysResponseState = [{ answers: { q1: 'yes' } }];
    expect(buildSurveysResponseStatePatch(surveysResponseState)).toEqual({
      surveysResponseState,
    });
    expect(buildSurveyUserEditResponseStatePatch(surveysResponseState, true)).toEqual({
      surveysResponseState,
      isEditing: true,
      submittedSinceLastEdit: true,
    });
    expect(buildHasherState(hasher)).toEqual({
      hasher,
    });
    expect(buildHasherState(null)).toEqual({
      hasher: null,
    });
    const jsonPreview = { answer: 'preview' };
    expect(buildJsonPreviewState(jsonPreview)).toEqual({
      jsonPreview,
    });
    expect(buildJsonPreviewState('').jsonPreview).toBe('');
    expect(buildShowJsonState(1)).toEqual({
      showJson: true,
    });
    expect(buildShowJsonState('')).toEqual({
      showJson: false,
    });
    expect(toggleShowJsonState({ showJson: false })).toEqual({
      showJson: true,
    });
    expect(toggleShowJsonState({ showJson: true })).toEqual({
      showJson: false,
    });
    expect(buildAutoDecryptToggleState({ autoDecryptEnabled: false })).toEqual({
      autoDecryptEnabled: true,
    });
    expect(buildAutoDecryptToggleState({ autoDecryptEnabled: true })).toEqual({
      autoDecryptEnabled: false,
    });
    expect(buildDisplayAnswerModeToggleState({ displayAnswerMode: false })).toEqual({
      displayAnswerMode: true,
      isEditing: true,
    });
    expect(buildDisplayAnswerModeToggleState({ displayAnswerMode: true })).toEqual({
      displayAnswerMode: false,
      isEditing: false,
    });
    expect(buildQuestionsJsonToggleState({ showQuestionsJson: false })).toEqual({
      showQuestionsJson: true,
    });
    expect(buildResponseJsonToggleState({ showResponseJson: true })).toEqual({
      showResponseJson: false,
    });
    expect(buildSurveyJsonToggleState({ showSurveyJson: false })).toEqual({
      showSurveyJson: true,
    });
    expect(buildCommentsToggleState({ showComments: { q1: true } }, 'q1')).toEqual({
      showComments: { q1: false },
    });
    expect(buildCommentsToggleState({ showComments: {} }, 'q2', true)).toEqual({
      showComments: { q2: false },
    });
    expect(buildGateSbtNameRevisionState({ gateSbtNameRevision: 2 })).toEqual({
      gateSbtNameRevision: 3,
    });
    expect(buildLockedGateDetailsExpandedState({ lockedGateDetailsExpanded: false })).toEqual({
      lockedGateDetailsExpanded: true,
    });
    expect(
      buildLockAudienceGateDetailsState(
        { lockAudienceGateDetailsByQuestion: { q1: ' gate-a ' } },
        'q1',
        'gate-a',
        'gate-a',
        (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      ),
    ).toEqual({
      lockAudienceGateDetailsByQuestion: {},
    });
    expect(
      buildLockAudienceGateDetailsState(
        { lockAudienceGateDetailsByQuestion: { q1: ' Gate A ' } },
        'q1',
        'gate-b',
        'gate-b',
        (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
      ),
    ).toEqual({
      lockAudienceGateDetailsByQuestion: { q1: 'gate-b' },
    });
    expect(
      buildLockAudienceMenuState(
        { lockAudienceMenuByQuestion: {}, lockAudienceGateDetailsByQuestion: { q1: 'gate-a' } },
        'q1',
        null,
      ),
    ).toEqual({
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: { q1: 'gate-a' },
    });
    expect(
      buildLockAudienceMenuState(
        { lockAudienceMenuByQuestion: { q1: true }, lockAudienceGateDetailsByQuestion: { q1: 'gate-a' } },
        'q1',
        null,
      ),
    ).toEqual({
      lockAudienceMenuByQuestion: {},
      lockAudienceGateDetailsByQuestion: {},
    });
    expect(buildPrefillQueuedAfterCacheState(true)).toEqual({
      prefillQueuedAfterCache: true,
    });
    expect(buildPrefillQueuedAfterCacheState(0)).toEqual({
      prefillQueuedAfterCache: false,
    });
    expect(buildHydratingPriorResponsesState(1)).toEqual({
      isHydratingPriorResponses: true,
    });
    expect(buildHydratingPriorResponsesState(false)).toEqual({
      isHydratingPriorResponses: false,
    });
    expect(buildBulkPromptReloadingState(1)).toEqual({
      bulkPromptReloading: true,
    });
    expect(buildBulkPromptReloadingState('')).toEqual({
      bulkPromptReloading: false,
    });
    expect(buildActiveTagModalState(' governance ')).toEqual({
      activeTagModalTag: 'governance',
    });
    expect(buildActiveTagModalState(null)).toEqual({
      activeTagModalTag: '',
    });
    expect(buildCopiedQuestionsJsonState(true)).toEqual({
      copiedQuestionsJson: true,
    });
    expect(buildCopiedResponseJsonState(false)).toEqual({
      copiedResponseJson: false,
    });
    expect(buildCopiedSurveyJsonState(1)).toEqual({
      copiedSurveyJson: true,
    });
  });

  it('builds SurveyQuestions prompt decrypt state patches', () => {
    const deps = {
      pickBetterQuestionPayload: (_existing, incoming) => incoming,
      areQuestionPayloadsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    };
    const renderedPatch = buildRenderedQuestionPayloadPoolsState(
      {
        questionPool: [{ id: 'q1', prompt: '[encrypted]' }],
        pileQuestions: [
          { id: 'q1', prompt: '[encrypted]' },
          { id: 'q2', prompt: 'open' },
        ],
        allQuestionsForFilter: [{ id: 'q1', prompt: '[encrypted]' }],
      },
      'Q1',
      { prompt: 'Decrypted prompt', promptDecrypted: true },
      deps,
    );
    expect(renderedPatch).toEqual({
      questionPool: [{ id: 'q1', prompt: 'Decrypted prompt', promptDecrypted: true }],
      pileQuestions: [
        { id: 'q1', prompt: 'Decrypted prompt', promptDecrypted: true },
        { id: 'q2', prompt: 'open' },
      ],
      allQuestionsForFilter: [{ id: 'q1', prompt: 'Decrypted prompt', promptDecrypted: true }],
    });
    expect(
      buildRenderedQuestionPayloadPoolsState(
        { questionPool: [{ id: 'q2', prompt: 'open' }] },
        'q1',
        { prompt: 'unused' },
        deps,
      ),
    ).toBeNull();

    expect(buildDecryptingByKeyState({ decryptingByKey: { old: true } }, 'q1:prompt', true)).toEqual({
      decryptingByKey: { old: true, 'q1:prompt': true },
    });
    expect(buildDecryptingByKeyState({ decryptingByKey: { 'q1:prompt': true } }, 'q1:prompt', false)).toEqual({
      decryptingByKey: { 'q1:prompt': false },
    });
    expect(buildAutoDecryptAttemptedState({ autoDecryptAttempted: { old: true } }, 'q1:answer')).toEqual({
      autoDecryptAttempted: { old: true, 'q1:answer': true },
    });

    const promptDeps = {
      isFilterStateActive: () => false,
      isMaskedPromptText: (prompt) => prompt === '[encrypted]',
    };
    expect(
      buildVisiblePileQuestionsAfterPromptDecryptState(
        {
          allQuestionsForFilter: [
            { id: 'q1', prompt: 'ready', promptDecrypted: true },
            { id: 'q2', prompt: '[encrypted]' },
            { id: 'q3', prompt: 'open' },
          ],
          pileQuestions: [
            { id: 'q1', prompt: 'ready' },
            { id: 'q2', prompt: '[encrypted]' },
            { id: 'q3', prompt: 'open' },
          ],
          activePileIndex: 2,
          hasHiddenGatedQuestions: false,
        },
        promptDeps,
      ),
    ).toEqual({
      pileQuestions: [
        { id: 'q1', prompt: 'ready', promptDecrypted: true },
        { id: 'q3', prompt: 'open' },
      ],
      hasHiddenGatedQuestions: true,
      activePileIndex: 1,
    });
    expect(
      buildVisiblePileQuestionsAfterPromptDecryptState(
        { allQuestionsForFilter: [{ id: 'q1', prompt: 'ready' }], isFilterActive: true },
        promptDeps,
      ),
    ).toBeNull();
  });

  it('builds SurveyQuestions lifecycle hydration state patches', () => {
    expect(buildResponseHydrationInvalidatedState()).toEqual({
      isLoadingResponse: false,
    });
    expect(
      buildInitialSurveyResponseState({
        surveysResponseState: [{ answers: { q1: 'yes' } }],
        editBaseline: { answers: { q1: 'yes' } },
      }),
    ).toEqual({
      surveysResponseState: [{ answers: { q1: 'yes' } }],
      editBaseline: { answers: { q1: 'yes' } },
    });
    expect(
      buildInitialStandaloneResponseState({
        surveysResponseState: [{ answers: { q1: 'yes' } }],
        editBaseline: { answers: { q1: 'yes' } },
        jsonPreview: '{"q1":"yes"}',
      }),
    ).toEqual({
      surveysResponseState: [{ answers: { q1: 'yes' } }],
      editBaseline: { answers: { q1: 'yes' } },
      jsonPreview: '{"q1":"yes"}',
    });

    const calls = [];
    const mergeSurveyResponseState = (currentState, questionPool, surveyIndex) => {
      calls.push({ currentState, questionPool, surveyIndex });
      return [{ merged: surveyIndex, currentState, questionPool }];
    };
    expect(
      buildQuestionPoolResponseMergeState(
        {
          surveysResponseState: [{ answers: { q1: 'draft' } }],
          editBaseline: { answers: { q1: 'baseline' } },
        },
        {
          includeQuestionPool: true,
          mergeSurveyResponseState,
          questionPool: [{ id: 'q1' }],
          surveyIndex: 2,
        },
      ),
    ).toEqual({
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          merged: 2,
          currentState: [{ answers: { q1: 'draft' } }],
          questionPool: [{ id: 'q1' }],
        },
      ],
      editBaseline: {
        merged: 0,
        currentState: [{ answers: { q1: 'baseline' } }],
        questionPool: [{ id: 'q1' }],
      },
    });
    expect(calls).toEqual([
      {
        currentState: [{ answers: { q1: 'draft' } }],
        questionPool: [{ id: 'q1' }],
        surveyIndex: 2,
      },
      {
        currentState: [{ answers: { q1: 'baseline' } }],
        questionPool: [{ id: 'q1' }],
        surveyIndex: 0,
      },
    ]);

    expect(
      buildSurveyResponseMergeState(
        { surveysResponseState: [{ answers: { q1: 'draft' } }] },
        {
          mergeSurveyResponseState,
          questionPool: [{ id: 'q2' }],
          surveyIndex: 3,
        },
      ),
    ).toEqual({
      surveysResponseState: [
        {
          merged: 3,
          currentState: [{ answers: { q1: 'draft' } }],
          questionPool: [{ id: 'q2' }],
        },
      ],
    });
  });

  it('builds SurveyQuestions response and question-pool state patches', () => {
    expect(
      buildEditStatsState({
        encryptedModifiedCount: 1,
        hasEncryptedChanges: true,
        isDirty: true,
        modifiedCount: 2,
        shouldRelatchSubmitted: true,
        shouldResetSubmitted: true,
      }),
    ).toEqual({
      modifiedCount: 2,
      encryptedModifiedCount: 1,
      hasEncryptedChanges: true,
      isDirty: true,
      submissionComplete: false,
      submittedSinceLastEdit: true,
    });

    const poolDeps = {
      areQuestionPayloadsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      buildQuestionIdScopeSignature: (pool) => (Array.isArray(pool) ? pool.map((q) => q.id).join('|') : ''),
      normalizeQuestionIdKey: (qid) =>
        String(qid || '')
          .trim()
          .toLowerCase(),
      pickBetterQuestionPayload: (_existing, incoming) => incoming,
    };
    expect(
      buildFetchedQuestionPoolState(
        {
          questionPool: [{ id: 'q1', prompt: 'old' }],
          questionPoolExpectedIds: ['q1'],
          questionPoolPendingIds: [],
        },
        {
          ...poolDeps,
          expectedQuestionIds: ['q1'],
          pendingQuestionIds: ['q2'],
          questionPool: [{ id: 'Q1', prompt: 'new' }],
        },
      ),
    ).toEqual({
      questionPool: [{ id: 'q1', prompt: 'new' }],
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: ['q2'],
    });
    const onNoop = jest.fn();
    expect(
      buildFetchedQuestionPoolState(
        {
          questionPool: [{ id: 'q1', prompt: 'old' }],
          questionPoolExpectedIds: ['q1'],
          questionPoolPendingIds: [],
        },
        {
          ...poolDeps,
          onNoop,
          pickBetterQuestionPayload: (existing) => existing,
          expectedQuestionIds: ['q1'],
          pendingQuestionIds: [],
          questionPool: [{ id: 'q1', prompt: 'old' }],
        },
      ),
    ).toBeNull();
    expect(onNoop).toHaveBeenCalledTimes(1);

    const encryptionDeps = { marker: 'deps' };
    const encryptionPlanInputs = [];
    const buildEncryptionTogglePlan = jest.fn((qid, field, newEncryptedState, slice) => {
      encryptionPlanInputs.push(JSON.parse(JSON.stringify(slice)));
      return {
        clearMenus: field === 'answer',
        nextAdditionalState: field === 'answer' ? { inheritedFrom: qid } : undefined,
        nextFieldState: { encrypted: newEncryptedState, field },
      };
    });
    expect(
      buildAnswerEncryptionToggleResponseState(
        {
          lockAudienceGateDetailsByQuestion: { q1: 'gate-a' },
          lockAudienceMenuByQuestion: { q1: true },
          submittedSinceLastEdit: true,
          surveysResponseState: [{ answers: {}, additionalComments: {} }],
        },
        {
          buildEncryptionTogglePlan,
          deps: encryptionDeps,
          newEncryptedState: true,
          questionId: 'q1',
          surveyIndex: 0,
        },
      ),
    ).toMatchObject({
      surveysResponseState: [
        {
          answers: { q1: { encrypted: true, field: 'answer' } },
          additionalComments: { q1: { inheritedFrom: 'q1' } },
        },
      ],
      lockAudienceMenuByQuestion: {},
      lockAudienceGateDetailsByQuestion: {},
      submittedSinceLastEdit: false,
    });
    expect(buildEncryptionTogglePlan).toHaveBeenCalledWith('q1', 'answer', true, expect.any(Object), encryptionDeps);
    expect(encryptionPlanInputs[0]).toEqual({ answers: {}, additionalComments: {} });

    expect(
      buildAdditionalEncryptionToggleResponseState(
        {
          lockAudienceGateDetailsByQuestion: { q1: 'gate-a' },
          lockAudienceMenuByQuestion: { q1: true },
          submittedSinceLastEdit: true,
          surveysResponseState: [{ answers: {}, additionalComments: {} }],
        },
        {
          buildEncryptionTogglePlan,
          deps: encryptionDeps,
          newEncryptedState: false,
          questionId: 'q1',
          surveyIndex: 0,
        },
      ),
    ).toMatchObject({
      surveysResponseState: [
        {
          additionalComments: { q1: { encrypted: false, field: 'additional' } },
        },
      ],
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: { q1: 'gate-a' },
      submittedSinceLastEdit: false,
    });

    const buildSurveyResponseStateArray = ({ prevSurveysResponseState }) => [...prevSurveysResponseState];
    const answerAudiencePlanInputs = [];
    const buildAnswerAudienceSelectionPlan = jest.fn((_qid, _audience, _gateId, slice) => {
      answerAudiencePlanInputs.push(JSON.parse(JSON.stringify(slice)));
      return {
        nextAnswerState: { audience: 'group' },
        nextAdditionalState: { inheritedAudience: 'group' },
      };
    });
    expect(
      buildAnswerEncryptionAudienceState(
        {
          submittedSinceLastEdit: true,
          surveysResponseState: [{ answers: {}, additionalComments: {} }],
        },
        {
          audience: 'group',
          buildAnswerAudienceSelectionPlan,
          buildSurveyResponseStateArray,
          deps: encryptionDeps,
          gateId: 'gate-a',
          questionId: 'q1',
          surveyIndex: 0,
        },
      ),
    ).toEqual({
      surveysResponseState: [
        {
          answers: { q1: { audience: 'group' } },
          additionalComments: { q1: { inheritedAudience: 'group' } },
        },
      ],
      lockAudienceMenuByQuestion: {},
      lockAudienceGateDetailsByQuestion: {},
      submittedSinceLastEdit: false,
    });
    expect(buildAnswerAudienceSelectionPlan).toHaveBeenCalledWith(
      'q1',
      'group',
      'gate-a',
      expect.any(Object),
      encryptionDeps,
    );
    expect(answerAudiencePlanInputs[0]).toEqual({ answers: {}, additionalComments: {} });

    expect(
      buildAdditionalEncryptionAudienceState(
        {
          submittedSinceLastEdit: true,
          surveysResponseState: [{ answers: {}, additionalComments: {} }],
        },
        {
          audience: 'public',
          buildAdditionalAudienceSelectionPlan: () => ({ nextAdditionalState: { audience: 'public' } }),
          buildSurveyResponseStateArray,
          deps: encryptionDeps,
          questionId: 'q1',
          surveyIndex: 0,
        },
      ),
    ).toEqual({
      surveysResponseState: [
        {
          answers: {},
          additionalComments: { q1: { audience: 'public' } },
        },
      ],
      lockAudienceMenuByQuestion: {},
      lockAudienceGateDetailsByQuestion: {},
      submittedSinceLastEdit: false,
    });
  });

  it('builds SurveyQuestions survey response hydration patches', () => {
    expect(buildSurveyResponseFetchLoadingState()).toEqual({
      isLoadingResponse: true,
      responseLookupWarning: '',
    });
    expect(buildResponseHydrationInvalidatedState()).toEqual({
      isLoadingResponse: false,
    });

    const mergeDecryptedViewedResponse = jest.fn((previous, next) => ({
      previous,
      next,
      merged: true,
    }));
    expect(
      buildViewedSurveyResponseState(
        { parsedViewAddressAnswers: { old: true } },
        { response: 'latest' },
        mergeDecryptedViewedResponse,
      ),
    ).toEqual({
      viewAddressAnswers: JSON.stringify({
        previous: { old: true },
        next: { response: 'latest' },
        merged: true,
      }),
      parsedViewAddressAnswers: {
        previous: { old: true },
        next: { response: 'latest' },
        merged: true,
      },
      noResponse: false,
      responseLookupWarning: '',
    });
    expect(mergeDecryptedViewedResponse).toHaveBeenCalledWith({ old: true }, { response: 'latest' });

    expect(buildViewedSurveyNoResponseState()).toEqual({
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
      noResponse: true,
      responseLookupWarning: '',
    });
    expect(buildViewedSurveyNoResponseState(false)).toEqual({
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
      noResponse: false,
      responseLookupWarning: '',
    });
    expect(
      buildUserSurveyResponseFoundState({
        hasEncrypted: 1,
        resetSubmissionComplete: true,
        userAnswers: { responses: [] },
      }),
    ).toEqual({
      userHasResponse: true,
      userResponseEncrypted: true,
      startFresh: false,
      userAnswers: { responses: [] },
      submissionComplete: false,
    });
    expect(
      buildUserSurveyResponseFoundState({
        hasEncrypted: false,
        userAnswers: { responses: ['plain'] },
      }),
    ).toEqual({
      userHasResponse: true,
      userResponseEncrypted: false,
      startFresh: false,
      userAnswers: { responses: ['plain'] },
    });
    expect(buildUserSurveyResponseMissingState()).toEqual({
      userHasResponse: false,
      userResponseEncrypted: false,
      userAnswers: null,
    });
  });

  it('builds SurveyQuestions single-question hydration patches', () => {
    expect(buildSingleQuestionPoolFallbackState()).toEqual({
      isLoadingResponse: false,
      questionPool: [],
    });
    expect(buildSingleQuestionRetryLoadingState()).toEqual({
      isLoadingResponse: true,
    });

    const calls = [];
    const mergeSurveyResponseState = (currentState, questionPool, surveyIndex) => {
      calls.push({ currentState, questionPool, surveyIndex });
      return [{ currentState, questionPool, surveyIndex }];
    };
    const placeholderQuestion = { id: 'q1', prompt: '[encrypted]' };
    expect(buildSingleQuestionPlaceholderHydrationState({}, { mergeSurveyResponseState, placeholderQuestion })).toEqual(
      {
        questionPool: [placeholderQuestion],
        surveysResponseState: [
          {
            currentState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
            questionPool: [placeholderQuestion],
            surveyIndex: 0,
          },
        ],
        isLoadingResponse: false,
        noResponse: false,
        responseLookupWarning: '',
      },
    );

    const questionData = { id: 'Q1', prompt: 'Ready' };
    expect(
      buildSingleQuestionReadyHydrationState(
        { surveysResponseState: [{ answers: { q1: 'draft' } }] },
        { mergeSurveyResponseState, questionData },
      ),
    ).toEqual({
      questionPool: [{ id: 'Q1', prompt: 'Ready' }],
      surveysResponseState: [
        {
          currentState: [{ answers: { q1: 'draft' } }],
          questionPool: [{ id: 'Q1', prompt: 'Ready' }],
          surveyIndex: 0,
        },
      ],
    });
    expect(calls).toEqual([
      {
        currentState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
        questionPool: [placeholderQuestion],
        surveyIndex: 0,
      },
      {
        currentState: [{ answers: { q1: 'draft' } }],
        questionPool: [{ id: 'Q1', prompt: 'Ready' }],
        surveyIndex: 0,
      },
    ]);
  });
});
