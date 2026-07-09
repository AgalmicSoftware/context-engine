import {
  buildAnswerLockDisplayState,
  buildGatedPromptNoticeState,
  buildLockAudienceButtonAction,
  buildLockAudienceDisplayState,
  buildQuestionPromptDecryptDisplayState,
  buildQuestionScanProgressDisplay,
  doesQuestionProgressMatchSlug,
  formatQuestionScanBlockCount,
  isSurveyToolFilterStateActive,
  isQuestionPromptMasked,
  normalizeSurveyToolFilterState,
  serializeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
} from './surveyToolViewState.js';

describe('surveyToolViewState', () => {
  it('builds lock-audience display state for full and pile contexts', () => {
    expect(
      buildLockAudienceDisplayState({
        questionId: 'Q1',
        fieldKey: 'answer',
        fieldState: { encrypted: false },
        lockDisabled: false,
        lockTitle: 'Not encrypted',
        forceAudienceMenu: true,
        selfAudienceLabel: 'only me',
        showPlaintextOption: true,
        visualContext: 'default',
        forcedGate: false,
        gateOptions: [],
        hasGateOption: false,
        menuOpen: true,
        currentAudience: 'self',
        currentGateId: '',
        currentAudienceMode: 'explicit',
      }),
    ).toEqual({
      qid: 'q1',
      effectiveFieldKey: 'answer',
      isPileVisualContext: false,
      fieldState: { encrypted: false },
      forcedGate: false,
      gateOptions: [],
      hasGateOption: false,
      hasAudienceMenu: true,
      menuOpen: true,
      currentAudience: 'self',
      currentGateId: '',
      currentAudienceMode: 'explicit',
      gateActive: false,
      selfActive: false,
      plaintextActive: true,
      followActive: false,
      lockActive: false,
      lockVisualActive: true,
      pileMenuPressed: false,
      showBrightLockState: true,
      isLockDisabled: false,
      allowPlaintextOption: true,
      lockButtonStyle: { opacity: 1 },
      normalizedSelfAudienceLabel: 'only me',
      buttonTitle: 'Choose encryption audience',
    });

    expect(
      buildLockAudienceDisplayState({
        questionId: 'Q1',
        fieldKey: 'additional',
        fieldState: { encrypted: true, audienceMode: 'inherit' },
        lockDisabled: false,
        lockTitle: 'Encrypted comments',
        glowAnswer: false,
        forceAudienceMenu: true,
        selfAudienceLabel: 'only me',
        showPlaintextOption: true,
        visualContext: 'pile',
        forcedGate: false,
        gateOptions: [],
        hasGateOption: false,
        menuOpen: true,
        currentAudience: 'self',
        currentGateId: '',
        currentAudienceMode: 'inherit',
      }),
    ).toMatchObject({
      qid: 'q1',
      effectiveFieldKey: 'additional',
      isPileVisualContext: true,
      hasAudienceMenu: true,
      menuOpen: true,
      followActive: true,
      allowPlaintextOption: false,
      pileMenuPressed: false,
      showBrightLockState: true,
      buttonTitle: 'Choose encryption audience',
    });

    expect(
      buildLockAudienceDisplayState({
        questionId: 'q1',
        fieldKey: 'answer',
        fieldState: { encrypted: false },
        lockDisabled: false,
        lockTitle: 'Not encrypted',
        forcedGate: true,
        gateOptions: [{ gateId: 'vip_gate' }],
        menuOpen: true,
      }),
    ).toMatchObject({
      forcedGate: true,
      hasAudienceMenu: false,
      menuOpen: false,
      isLockDisabled: true,
      buttonTitle: 'Locked by question gate',
    });
  });

  it('builds masked-prompt, answer-lock, and gated-notice view state', () => {
    expect(
      isQuestionPromptMasked({
        prompt: '[encrypted]',
        promptDecrypted: false,
      }),
    ).toBe(true);
    expect(
      isQuestionPromptMasked({
        prompt: '[encrypted]',
        promptDecrypted: true,
      }),
    ).toBe(false);

    expect(
      buildAnswerLockDisplayState({
        field: { encrypted: false },
        masked: true,
        isSubmitting: false,
      }),
    ).toEqual({
      lockDisabled: true,
      lockTitle: 'Encrypted answer',
    });

    expect(
      buildAnswerLockDisplayState({
        field: { encrypted: true },
        masked: false,
        isSubmitting: false,
      }),
    ).toEqual({
      lockDisabled: false,
      lockTitle: 'Encrypted',
    });

    expect(
      buildAnswerLockDisplayState({
        field: { encrypted: false },
        masked: false,
        isSubmitting: true,
      }),
    ).toEqual({
      lockDisabled: true,
      lockTitle: 'Not encrypted',
    });

    expect(
      buildGatedPromptNoticeState({
        questionId: 'Q 1',
        tooltipIdSuffix: 'pile',
        gateNames: ['Gate Alpha', 'Gate Beta'],
        sbtLabel: 'SBT',
        gateLabel: 'gate',
        gatesLabel: 'gates',
      }),
    ).toEqual({
      tooltipId: 'ce-gated-prompt-tip-q-1-pile',
      tooltipText: 'Required SBT gates: Gate Alpha, Gate Beta',
    });

    expect(
      buildGatedPromptNoticeState({
        questionId: '',
        tooltipIdSuffix: 'full',
        fallbackId: 'fallback id',
        gateNames: [],
        sbtLabel: 'SBT',
        gateLabel: 'gate',
        gatesLabel: 'gates',
      }),
    ).toEqual({
      tooltipId: 'ce-gated-prompt-tip-fallback-id-full',
      tooltipText: 'SBT gate required',
    });

    expect(
      buildGatedPromptNoticeState({
        questionId: ' Q/2 ',
        tooltipIdSuffix: 'full',
        gateNames: [' ', 'Contributors'],
        sbtLabel: 'Badge',
        gateLabel: 'audience',
        gatesLabel: 'audiences',
      }),
    ).toEqual({
      tooltipId: 'ce-gated-prompt-tip-q-2-full',
      tooltipText: 'Required Badge audience: Contributors',
    });
  });

  it('builds gated prompt decrypt display state from payload and auth state', () => {
    expect(
      buildQuestionPromptDecryptDisplayState({
        account: '',
        canReloadPrompt: true,
        loginComplete: false,
        payloadDisplay: {
          requiresAuth: true,
          actionTitle: 'Open wallet',
          label: 'Unlock prompt',
          busyLabel: 'Unlocking...',
          actionLabel: 'Decrypt Prompt',
          noticeLeadingText: 'This prompt is',
          noticeStatusText: 'private',
          noticeSuffix: 'Unlock to respond.',
        },
        promptMasked: true,
        promptReloading: true,
        promptText: '[encrypted]',
        questionId: ' Q1 ',
      }),
    ).toEqual({
      qid: 'q1',
      promptText: '[encrypted]',
      promptMasked: true,
      showPromptAction: true,
      promptTitle: 'Login required to decrypt gated prompts.',
      promptLabel: 'Unlock prompt',
      promptBusyLabel: 'Unlocking...',
      noticeLeadingText: 'This prompt is',
      noticeStatusText: 'private',
      noticeSuffix: 'Unlock to respond.',
      noticeActionBusy: true,
      noticeActionDisabled: true,
      noticeActionLabel: 'Decrypt Prompt',
      noticeActionTitle: 'Login required to decrypt gated prompts.',
      canReloadPrompt: true,
    });
  });

  it('builds plaintext prompt and default decrypt notice labels', () => {
    expect(
      buildQuestionPromptDecryptDisplayState({
        account: '0xabc',
        loginComplete: true,
        payloadDisplay: {},
        promptMasked: false,
        promptText: 'Visible prompt',
        questionId: '',
      }),
    ).toMatchObject({
      qid: '',
      promptText: 'Visible prompt',
      promptMasked: false,
      showPromptAction: false,
      promptTitle: 'Decrypt gated prompt',
      promptLabel: 'Visible prompt',
      promptBusyLabel: 'Decrypting...',
      noticeActionBusy: false,
      noticeActionDisabled: false,
      noticeActionLabel: 'Decrypt Prompt',
      noticeActionTitle: 'Decrypt gated prompt',
      canReloadPrompt: false,
    });
  });

  it('builds lock-audience button actions for each menu/encryption state', () => {
    expect(
      buildLockAudienceButtonAction({
        lockDisabled: true,
      }),
    ).toEqual({ kind: 'noop' });

    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'answer',
        fieldEncrypted: false,
        hasAudienceMenu: false,
      }),
    ).toEqual({
      kind: 'toggle-field-encryption',
      nextEncrypted: true,
    });

    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'additional',
        fieldEncrypted: true,
        hasAudienceMenu: true,
        menuOpen: true,
      }),
    ).toEqual({
      kind: 'disable-field-encryption-and-close-menu',
    });

    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'answer',
        fieldEncrypted: false,
        hasAudienceMenu: true,
        menuOpen: false,
        hasGateOption: false,
      }),
    ).toEqual({
      kind: 'enable-answer-and-open-menu',
    });

    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'answer',
        fieldEncrypted: false,
        hasAudienceMenu: true,
        menuOpen: false,
        hasGateOption: true,
      }),
    ).toEqual({
      kind: 'set-menu-open',
      nextOpen: true,
    });

    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'answer',
        fieldEncrypted: false,
        hasAudienceMenu: true,
        menuOpen: true,
        hasGateOption: true,
      }),
    ).toEqual({
      kind: 'set-menu-open',
      nextOpen: false,
    });
  });

  it('matches pile progress slugs across general alias and empty scope', () => {
    expect(doesQuestionProgressMatchSlug('general', '')).toBe(true);
    expect(doesQuestionProgressMatchSlug('GENERAL', '')).toBe(true);
    expect(doesQuestionProgressMatchSlug('', 'general')).toBe(true);
    expect(doesQuestionProgressMatchSlug('edge', '')).toBe(false);
  });

  it('formats capped question scan progress against the requested total range', () => {
    const display = buildQuestionScanProgressDisplay({
      totalBlocks: 50000,
      requestedTotalBlocks: 234000,
      wasCapped: true,
      scannedBlocks: 50000,
      remainingBlocks: 184000,
    });

    expect(display.metaLeftText).toBe('184,000 blocks left');
    expect(display.metaRightText).toBe('50,000 / 234,000');
    expect(display.percentComplete).toBe(21);
  });

  it('formats block counts defensively for invalid inputs', () => {
    expect(formatQuestionScanBlockCount('not-a-number')).toBe('0');
    expect(formatQuestionScanBlockCount(1234.9)).toBe('1,234');
  });

  it('keeps full pile loading visible when progress is active and cards are empty', () => {
    expect(
      shouldShowPileFullLoadingState({
        loading: false,
        hasVisibleQuestions: false,
        firstBoot: false,
        isQuestionCacheReady: true,
        recentRateLimit: false,
        hasScanOrHydrationWork: true,
      }),
    ).toBe(true);
    expect(
      shouldShowPileFullLoadingState({
        loading: false,
        hasVisibleQuestions: true,
        firstBoot: false,
        isQuestionCacheReady: true,
        recentRateLimit: false,
        hasScanOrHydrationWork: true,
      }),
    ).toBe(false);
  });

  it('allows settled empty piles to exit full-loading even when cache-ready stays false', () => {
    expect(
      shouldShowPileFullLoadingState({
        loading: true,
        hasVisibleQuestions: false,
        firstBoot: false,
        isQuestionCacheReady: false,
        recentRateLimit: false,
        hasScanOrHydrationWork: false,
        allowUnreadyEmptySettlement: true,
      }),
    ).toBe(false);
  });

  it('allows filtered empty piles to exit full-loading while background refresh continues', () => {
    expect(
      shouldShowPileFullLoadingState({
        loading: true,
        hasVisibleQuestions: false,
        firstBoot: false,
        isQuestionCacheReady: true,
        recentRateLimit: false,
        hasScanOrHydrationWork: true,
        allowFilteredEmptySettlement: true,
      }),
    ).toBe(false);
  });

  it('exits full-loading when a terminal scan error is present', () => {
    expect(
      shouldShowPileFullLoadingState({
        loading: true,
        hasVisibleQuestions: false,
        firstBoot: false,
        isQuestionCacheReady: false,
        recentRateLimit: false,
        hasScanOrHydrationWork: false,
        hasTerminalScanError: true,
      }),
    ).toBe(false);
  });

  it('normalizes legacy empty filter payloads to an inactive empty state', () => {
    const normalized = normalizeSurveyToolFilterState({
      includedSBTs: [],
      excludedSBTs: [],
      onlyVerifiedHumans: false,
      tags: [],
      types: [],
    });

    expect(normalized).toEqual({});
    expect(serializeSurveyToolFilterState(normalized)).toBe('');
    expect(isSurveyToolFilterStateActive(normalized)).toBe(false);
  });

  it('preserves aiTopN and aiCombine only when aiFilter is active', () => {
    const active = normalizeSurveyToolFilterState({
      aiFilter: 'climate',
      aiTopN: 6,
      aiCombine: true,
    });
    expect(active).toMatchObject({
      aiFilter: 'climate',
      aiTopN: 6,
      aiCombine: true,
    });
    expect(isSurveyToolFilterStateActive(active)).toBe(true);

    const inactive = normalizeSurveyToolFilterState({
      aiFilter: null,
      aiTopN: 6,
      aiCombine: true,
    });
    expect(inactive).toEqual({});
  });
});
