import {
  buildActiveTagModalState,
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildBulkPromptReloadingState,
  buildCanDecryptOtherResponsesState,
  buildClearedSurveyQuestionPoolState,
  buildCopiedQuestionsJsonState,
  buildCopiedResponseJsonState,
  buildCopiedSurveyJsonState,
  buildClearedDecryptingByKeyState,
  buildCurrentStepState,
  buildDecryptEditFailureState,
  buildDecryptEditStartState,
  buildDisplayAnswerModeState,
  buildEditingResponseModeState,
  buildHasherState,
  buildHydratingPriorResponsesState,
  buildInitialSurveyQuestionsState,
  buildJsonPreviewState,
  buildParsedViewAddressAnswersState,
  buildPrefillQueuedAfterCacheState,
  buildResponseEditCompleteState,
  buildResponseLoadingResetState,
  buildShowJsonState,
  buildStandaloneAuthResetState,
  buildSubmitFailureState,
  buildSubmitPreparationErrorState,
  buildSubmitSuccessState,
  buildSubmissionErrorState,
  buildSubmitStartState,
  buildSurveysResponseStatePatch,
  buildSurveyAccountViewResetState,
  buildSurveyChangedResetState,
  buildSurveyQuestionsFullLoadingProgressFillStyle,
  buildSurveyQuestionsFullLoadingProgressState,
  buildSurveyQuestionsJsonPanelDisplayState,
  buildSurveyQuestionsJsonTreeItemStyle,
  buildSurveyQuestionsLockAudienceGateClassName,
  buildSurveyQuestionsLockAudiencePopoverClassName,
  buildSurveyQuestionsLockAudienceToggleClassName,
  buildSurveyQuestionsRouteViewDisplayState,
  buildSurveyQuestionsSubmitAuxIconClassName,
  buildSurveyUserEditResponseStatePatch,
  buildSurveyQuestionPoolLoadState,
  buildViewingResponseModeState,
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

    expect(buildInitialSurveyQuestionsState({
      isStandalone: true,
      singleQuestionMode: false,
      questionPool,
    }).questionPool).toBe(questionPool);

    expect(buildInitialSurveyQuestionsState({
      isStandalone: false,
      singleQuestionMode: true,
      questionPool,
    }).questionPool).toBe(questionPool);
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
      color: 'red',
    });
    expect(buildSurveyQuestionsFullLoadingProgressFillStyle({
      hydrateDiscovered: 8,
      hydrateDone: 3,
      isHydrating: true,
      scanPercent: 92,
    })).toEqual({ width: '38%' });
    expect(buildSurveyQuestionsFullLoadingProgressFillStyle({
      hydrateDiscovered: 0,
      hydrateDone: 0,
      isHydrating: true,
      scanPercent: 92,
    })).toEqual({ width: '0%' });
    expect(buildSurveyQuestionsFullLoadingProgressFillStyle({
      isHydrating: false,
      scanPercent: 92,
    })).toEqual({ width: '92%' });
    expect(buildSurveyQuestionsSubmitAuxIconClassName(styleMap, true)).toBe('icon single-submit-icon');
    expect(buildSurveyQuestionsSubmitAuxIconClassName(styleMap, false)).toBe('icon');
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

    expect(buildSurveyQuestionsJsonPanelDisplayState({
      isSingleQuestionView: false,
      isStandalone: false,
      singleQuestionMode: false,
      showQuestionsJson: true,
      showResponseJson: true,
      showSurveyJson: true,
      styleMap,
    })).toEqual({
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

    expect(buildSurveyQuestionsJsonPanelDisplayState({
      isSingleQuestionView: true,
      isStandalone: true,
      singleQuestionMode: false,
      showQuestionsJson: true,
      showResponseJson: true,
      showSurveyJson: true,
      styleMap,
    })).toEqual({
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

  it('builds SurveyQuestions route view display state for viewed addresses', () => {
    const shortenAddress = jest.fn((address, notClickable) => `${address}:${notClickable}`);

    expect(buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      responderAddress: '0xdef',
      shortenAddress,
      viewAddress: ' 0xABC ',
    })).toEqual({
      viewedAddressRaw: '0xABC',
      viewedAddressLower: '0xabc',
      shortenedViewAddress: '0xABC:false',
      isOwnResponse: false,
      isSingleQuestionView: undefined,
    });
    expect(shortenAddress).toHaveBeenCalledWith('0xABC', false);
  });

  it('preserves SurveyQuestions route view fallback and own-response checks', () => {
    expect(buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      responderAddress: '0xABC',
    })).toMatchObject({
      viewedAddressRaw: '0xABC',
      viewedAddressLower: '0xabc',
      shortenedViewAddress: '0xABC',
      isOwnResponse: true,
    });

    expect(buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      responderAddress: '0xABC',
      viewAddress: '0xdef',
    })).toMatchObject({
      viewedAddressRaw: '0xdef',
      isOwnResponse: true,
    });

    expect(buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      userHasResponse: true,
    }).isOwnResponse).toBe(true);

    expect(buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      viewAddress: '0xABC',
    }).isOwnResponse).toBe(true);

    expect(buildSurveyQuestionsRouteViewDisplayState({
      account: '0xabc',
      viewAddress: ' 0xABC ',
    }).isOwnResponse).toBe(false);

    expect(buildSurveyQuestionsRouteViewDisplayState().shortenedViewAddress).toBe('');
  });

  it('builds SurveyQuestions single-question route flags without moving state', () => {
    expect(buildSurveyQuestionsRouteViewDisplayState({
      singleQuestionMode: true,
    }).isSingleQuestionView).toBe(true);

    expect(buildSurveyQuestionsRouteViewDisplayState({
      isStandalone: true,
      questionPool: [{ id: 'q1' }],
    }).isSingleQuestionView).toBe(true);

    expect(buildSurveyQuestionsRouteViewDisplayState({
      isStandalone: true,
      questionPool: [{ id: 'q1' }, { id: 'q2' }],
    }).isSingleQuestionView).toBe(false);

    expect(buildSurveyQuestionsRouteViewDisplayState({
      isStandalone: true,
      questionPool: null,
    }).isSingleQuestionView).toBe(false);
  });

  it('reports no pending question-pool work for standalone and single-question flows', () => {
    expect(buildSurveyQuestionPoolLoadState({
      isStandalone: true,
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: ['q1'],
    })).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });

    expect(buildSurveyQuestionPoolLoadState({
      singleQuestionMode: true,
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: ['q1'],
    })).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('derives pending question-pool metadata for survey flows', () => {
    expect(buildSurveyQuestionPoolLoadState({
      isStandalone: false,
      singleQuestionMode: false,
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    })).toEqual({
      expectedIds: ['q1', 'q2'],
      pendingIds: ['q2'],
      pendingCount: 1,
      isIncomplete: true,
    });

    expect(buildSurveyQuestionPoolLoadState({
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    })).toEqual({
      expectedIds: ['q1'],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
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

    expect(buildCanDecryptOtherResponsesState({
      canDecrypt: true,
      status: 'granted',
    })).toEqual({
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
    expect(buildSurveyAccountViewResetState({
      noResponse: 'keep-no-response',
      parsedViewAddressAnswers: { answer: 'keep' },
      submittedSinceLastEdit: true,
    })).toEqual({
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
    expect(buildSubmitSuccessState({
      editBaseline: submittedBaseline,
      hasEncrypted: 1,
      responseUrl: 'https://example.com/response',
      submittedSinceLastEdit: true,
      surveysResponseState: submittedResponses,
      userAnswers: submittedAnswers,
    })).toEqual({
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
    expect(buildSubmitFailureState({
      submittedSinceLastEdit: false,
      submissionError: '',
    })).toEqual({
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
});
