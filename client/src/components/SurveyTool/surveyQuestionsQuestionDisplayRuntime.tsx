import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsQuestionDisplayRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsQuestionDisplayRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsQuestionDisplayRuntime => {
  const {
    E2E_TESTIDS,
    ENABLE_IMPORTANCE_SLIDER_TOGGLE,
    FullQuestionFooterIcons,
    GatedPromptNotice,
    QuestionCardLinks,
    QuestionDecryptControl,
    SurveyAudioFieldInput,
    SurveyQuestionsFullQuestionCardShell,
    SurveyQuestionsFullQuestionResponseInput,
    SurveyQuestionsFullQuestionSliderSection,
    buildAnswerLockDisplayState,
    buildEmptyResponseFieldState,
    buildFieldDecryptStateHelper,
    buildGatedPromptNoticeState,
    buildQuestionFieldDecryptControlDisplayStateHelper,
    buildQuestionFieldDisplayStateHelper,
    buildQuestionPromptDecryptDisplayState,
    buildQuestionRenderDisplayStateHelper,
    buildQuestionResponseDisplayStateHelper,
    buildQuestionRoutePath,
    buildSliderModeStatePatch,
    buildSliderPersistOptions,
    engine,
    getAudioInputWorkerProps,
    getQuestionConvictionSliderValue,
    getQuestionImportanceSliderValue,
    getQuestionSliderMode,
    handleAdditional,
    handleAnswer,
    handleBookmarkToggle,
    handleConviction,
    handleDecryptQuestionAnswer,
    handleImportance,
    handleReloadMaskedPrompt,
    hasConvictionOrImportanceValueForQuestion,
    hasMeaningfulFieldValue,
    inst,
    isMaskedPromptText,
    isQuestionFieldBusy,
    isQuestionPromptMaskedHelper,
    normalizeSessionSlugValue,
    parseEncryptedEnvelopeHelper,
    persistDraftSafely,
    propsRef,
    renderAnswerLockControl,
    renderPromptWithManualDecrypt,
    renderQuestionTagDropdown,
    renderQuestionTagDropdownRow,
    renderSurveyQuestionsFullQuestionGatedPromptCard,
    resolveEffectiveSlug,
    resolveExplicitSessionContext,
    resolveGatedPromptGateNames,
    resolveQuestionPayloadDisplayState,
    setState,
    stateRef,
    styles,
    surveyResponseStoragePort,
    t,
    toggleAdditionalCommentsEncryption,
    toggleAnswerEncryption,
  } = context;

  const getSliderMode = (questionId: SurveyQuestionsLegacyValue) => {
    return getQuestionSliderMode({
      explicitMode: stateRef.current.sliderModeByQuestion?.[questionId],
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      surveyIndex: propsRef.current.surveyIndex,
      surveysResponseState: stateRef.current.surveysResponseState,
      questionId,
    });
  };

  const setSliderMode = (questionId: SurveyQuestionsLegacyValue, mode: SurveyQuestionsLegacyValue) => {
    setState((prev: SurveyQuestionsLegacyValue) =>
      // Track whether the conviction/importance control has been "opened" for engine question.
      buildSliderModeStatePatch(prev, questionId, mode),
    );
  };

  const getConvictionValueForSlice = (slice: SurveyQuestionsLegacyValue, questionId: SurveyQuestionsLegacyValue) => {
    return getQuestionConvictionSliderValue(slice, questionId);
  };

  const getImportanceValueForSlice = (slice: SurveyQuestionsLegacyValue, questionId: SurveyQuestionsLegacyValue) => {
    return getQuestionImportanceSliderValue(slice, questionId);
  };

  const flushDraftPersistAfterSliderChange = () => {
    persistDraftSafely && persistDraftSafely(0);
  };

  const getCachedAudioInputWorkerProps = () => {
    if (inst._a) {
      return inst._a;
    }

    const nextWorkerProps = getAudioInputWorkerProps();
    const nextContext = nextWorkerProps?.context || {};
    const memo = inst._audioInputWorkerPropsMemo;
    const hasSameWorkerContext =
      memo &&
      Object.is(memo.sessionSlug, nextWorkerProps?.sessionSlug) &&
      Object.is(memo.sessionConfig, nextWorkerProps?.sessionConfig) &&
      Object.is(memo.account, nextContext.account) &&
      Object.is(memo.providerLike, nextContext.providerLike) &&
      Object.is(memo.chainId, nextContext.chainId);

    // Stable props let React.memo skip every unchanged question response input
    // after a vote while still invalidating on any session or wallet change.
    if (hasSameWorkerContext) {
      inst._a = memo.value;
      return inst._a;
    }

    inst._audioInputWorkerPropsMemo = {
      value: nextWorkerProps,
      sessionSlug: nextWorkerProps?.sessionSlug,
      sessionConfig: nextWorkerProps?.sessionConfig,
      account: nextContext.account,
      providerLike: nextContext.providerLike,
      chainId: nextContext.chainId,
    };
    inst._a = nextWorkerProps;
    return inst._a;
  };

  const beginQuestionDisplayRender = () => {
    inst._a = null;
  };

  const getQuestionInputHandlers = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
  ) => {
    const cacheKey = `${String(surveyIndex ?? '')}:${String(questionId ?? '')}`;
    const cached = inst._q.get(cacheKey);
    if (cached) return cached;

    const handlers = {
      onAnswerChange: (answerValue: SurveyQuestionsLegacyValue) => handleAnswer(surveyIndex, questionId, answerValue),
      onDeferredRatingCommit: (committedRating: SurveyQuestionsLegacyValue) =>
        handleAnswer(surveyIndex, questionId, committedRating, {
          persistDraft: false,
          afterUpdate: flushDraftPersistAfterSliderChange,
        }),
      onRatingChange: (ratingAnswer: SurveyQuestionsLegacyValue, event: SurveyQuestionsLegacyValue) =>
        handleAnswer(surveyIndex, questionId, ratingAnswer, buildSliderPersistOptions(event)),
      onRatingChangeComplete: flushDraftPersistAfterSliderChange,
      onToggleAnswerEncryption: (newEncryptedState: SurveyQuestionsLegacyValue) =>
        toggleAnswerEncryption(surveyIndex, questionId, newEncryptedState),
    };
    inst._q.set(cacheKey, handlers);
    return handlers;
  };

  const handleConvictionImportanceChange = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    mode: SurveyQuestionsLegacyValue,
    value: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    if (mode === 'importance') {
      handleImportance(surveyIndex, questionId, value, options);
    } else {
      handleConviction(surveyIndex, questionId, value, options);
    }
  };

  const renderFullQuestionSliderSection = ({
    surveyIndex,
    questionId,
    sliderMode,
    activeSliderValue,
    convictionValue,
    importanceValue,
    hasConvictionImportanceValue,
    sliderOpen,
  }: SurveyQuestionsLegacyValue) => (
    <SurveyQuestionsFullQuestionSliderSection
      activeSliderValue={activeSliderValue}
      convictionValue={convictionValue}
      hasConvictionImportanceValue={hasConvictionImportanceValue}
      importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
      importanceValue={importanceValue}
      isSubmitting={stateRef.current.isSubmitting}
      onChange={(value: SurveyQuestionsLegacyValue, event: SurveyQuestionsLegacyValue) =>
        handleConvictionImportanceChange(surveyIndex, questionId, sliderMode, value, buildSliderPersistOptions(event))
      }
      onChangeComplete={flushDraftPersistAfterSliderChange}
      onCommit={(committedValue: SurveyQuestionsLegacyValue) =>
        handleConvictionImportanceChange(surveyIndex, questionId, sliderMode, committedValue, {
          persistDraft: false,
          afterUpdate: flushDraftPersistAfterSliderChange,
        })
      }
      onSelectMode={(nextMode: SurveyQuestionsLegacyValue) => setSliderMode(questionId, nextMode)}
      questionId={questionId}
      singleQuestionMode={propsRef.current.singleQuestionMode}
      sliderMode={sliderMode}
      sliderOpen={sliderOpen}
      sliderToggleExpandedByQuestion={stateRef.current.sliderToggleExpandedByQuestion}
    />
  );

  const renderFullQuestionResponseInput = ({
    question,
    surveyIndex,
    answer,
    glowAnswer,
  }: SurveyQuestionsLegacyValue) => {
    const handlers = getQuestionInputHandlers(surveyIndex, question.id);
    return (
      <SurveyQuestionsFullQuestionResponseInput
        question={question}
        answer={answer}
        glowAnswer={glowAnswer}
        isSubmitting={stateRef.current.isSubmitting}
        singleQuestionMode={propsRef.current.singleQuestionMode}
        audioInputWorkerProps={getCachedAudioInputWorkerProps()}
        onAnswerChange={handlers.onAnswerChange}
        onDeferredRatingCommit={handlers.onDeferredRatingCommit}
        onRatingChange={handlers.onRatingChange}
        onRatingChangeComplete={handlers.onRatingChangeComplete}
        onToggleAnswerEncryption={handlers.onToggleAnswerEncryption}
      />
    );
  };

  const renderFullQuestionAdditionalInput = ({
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
  }: SurveyQuestionsLegacyValue) => {
    return (
      <SurveyAudioFieldInput
        {...getCachedAudioInputWorkerProps()}
        placeholder={'related thoughts or URLs (optional)'}
        value={additional?.value || ''}
        encrypted={additional?.encrypted || false}
        dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
        dataCeQuestionId={String(questionId || '')
          .trim()
          .toLowerCase()}
        disabled={stateRef.current.isSubmitting}
        forceGlow={glowAdditional}
        updateFunction={(additionalCommentsValue: SurveyQuestionsLegacyValue) =>
          handleAdditional(surveyIndex, questionId, additionalCommentsValue)
        }
        toggleEncryption={(newEncryptedState: SurveyQuestionsLegacyValue) =>
          toggleAdditionalCommentsEncryption(surveyIndex, questionId, newEncryptedState)
        }
      />
    );
  };

  const parseEncryptedEnvelope = (field: SurveyQuestionsLegacyValue) =>
    (parseEncryptedEnvelopeHelper as SurveyQuestionsLegacyValue)(field);

  const getFieldDecryptState = ({ questionId, fieldKey, field }: SurveyQuestionsLegacyValue) =>
    (buildFieldDecryptStateHelper as SurveyQuestionsLegacyValue)(field, {
      loginComplete: propsRef.current.loginComplete,
      account: propsRef.current.account,
      busy: isQuestionFieldBusy(questionId, fieldKey),
    });

  const getQuestionFieldDisplayState = ({ questionId, answer, additional }: SurveyQuestionsLegacyValue) => {
    const answerDecryptState: SurveyQuestionsLegacyValue = getFieldDecryptState({
      questionId,
      fieldKey: 'answer',
      field: answer,
    });
    const additionalDecryptState: SurveyQuestionsLegacyValue = getFieldDecryptState({
      questionId,
      fieldKey: 'additional',
      field: additional,
    });
    return (buildQuestionFieldDisplayStateHelper as SurveyQuestionsLegacyValue)({
      answer,
      additional,
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: hasMeaningfulFieldValue(additional),
    });
  };

  const getQuestionResponseDisplayState = ({ questionId, responseSlice }: SurveyQuestionsLegacyValue) => {
    const slice: SurveyQuestionsLegacyValue = responseSlice || {};
    const answer: SurveyQuestionsLegacyValue = slice.answers?.[questionId] || buildEmptyResponseFieldState(questionId);
    const additional: SurveyQuestionsLegacyValue =
      slice.additionalComments?.[questionId] || buildEmptyResponseFieldState(questionId, 'additional');
    const convictionValue: SurveyQuestionsLegacyValue = getConvictionValueForSlice(slice, questionId);
    const importanceValue: SurveyQuestionsLegacyValue = getImportanceValueForSlice(slice, questionId);
    const hasConvictionImportanceValue: SurveyQuestionsLegacyValue = hasConvictionOrImportanceValueForQuestion(
      slice,
      questionId,
    );
    const sliderMode: SurveyQuestionsLegacyValue = ENABLE_IMPORTANCE_SLIDER_TOGGLE
      ? getSliderMode(questionId)
      : 'conviction';
    return (buildQuestionResponseDisplayStateHelper as SurveyQuestionsLegacyValue)({
      answer,
      additional,
      convictionValue,
      importanceValue,
      hasConvictionImportanceValue,
      sliderMode,
    });
  };

  const getQuestionRenderDisplayState = ({ questionId, responseSlice }: SurveyQuestionsLegacyValue) => {
    const responseDisplayState: SurveyQuestionsLegacyValue = getQuestionResponseDisplayState({
      questionId,
      responseSlice,
    });
    const fieldDisplayState: SurveyQuestionsLegacyValue = getQuestionFieldDisplayState({
      questionId,
      answer: responseDisplayState.answer,
      additional: responseDisplayState.additional,
    });

    return (buildQuestionRenderDisplayStateHelper as SurveyQuestionsLegacyValue)({
      responseDisplayState,
      fieldDisplayState,
    });
  };

  const isQuestionPromptMasked = (question: SurveyQuestionsLegacyValue): boolean =>
    isQuestionPromptMaskedHelper(question);

  const getQuestionPayloadDisplayState = (question: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = normalizeSessionSlugValue(
      question?.sessionSlug ||
        question?.sessionName ||
        inst._getEffectiveDraftSlug() ||
        resolveEffectiveSlug(propsRef.current),
    );
    const sessionConfig: SurveyQuestionsLegacyValue = slug
      ? resolveExplicitSessionContext(slug).sessionConfig || null
      : null;
    return resolveQuestionPayloadDisplayState(question, sessionConfig);
  };

  const getAnswerLockDisplayState = ({ field, masked }: SurveyQuestionsLegacyValue) =>
    buildAnswerLockDisplayState({
      field,
      masked,
      isSubmitting: stateRef.current.isSubmitting,
    });

  const getGatedPromptNoticeState = ({ question, tooltipIdSuffix, fallbackId = 'gated' }: SurveyQuestionsLegacyValue) =>
    buildGatedPromptNoticeState({
      questionId: question?.id,
      tooltipIdSuffix,
      fallbackId,
      gateNames: resolveGatedPromptGateNames(question),
      sbtLabel: t('sbt'),
      gateLabel: t('gate'),
      gatesLabel: t('gates'),
    });

  const renderGatedPromptNotice = ({ question, tooltipIdSuffix, fallbackId }: SurveyQuestionsLegacyValue) => {
    const { tooltipId, tooltipText }: SurveyQuestionsLegacyValue = getGatedPromptNoticeState({
      question,
      tooltipIdSuffix,
      fallbackId,
    });
    const qid: SurveyQuestionsLegacyValue = String(question?.id || '')
      .trim()
      .toLowerCase();
    const promptReloading: SurveyQuestionsLegacyValue = qid ? isQuestionFieldBusy(qid, 'prompt') : false;
    const canReloadPrompt: SurveyQuestionsLegacyValue = qid && isQuestionPromptMasked(question);
    const payloadDisplay: SurveyQuestionsLegacyValue = getQuestionPayloadDisplayState(question);
    const promptDisplay: SurveyQuestionsLegacyValue = buildQuestionPromptDecryptDisplayState({
      questionId: qid,
      promptText: question?.prompt || 'Question',
      promptMasked: isMaskedPromptText(question?.prompt || 'Question'),
      promptReloading,
      payloadDisplay,
      loginComplete: propsRef.current.loginComplete,
      account: propsRef.current.account,
      canReloadPrompt,
    });

    return (
      <GatedPromptNotice
        questionId={question.id}
        tooltipId={tooltipId}
        tooltipText={tooltipText}
        leadingText={promptDisplay.noticeLeadingText}
        statusText={promptDisplay.noticeStatusText}
        suffix={promptDisplay.noticeSuffix}
        actionBusy={promptDisplay.noticeActionBusy}
        actionDisabled={promptDisplay.noticeActionDisabled}
        actionLabel={promptDisplay.noticeActionLabel}
        actionTestId={E2E_TESTIDS.SURVEY_DECRYPT_PROMPT_NOTICE}
        actionTitle={promptDisplay.noticeActionTitle}
        onAction={promptDisplay.canReloadPrompt ? () => handleReloadMaskedPrompt(promptDisplay.qid) : undefined}
      />
    );
  };

  const renderFullQuestionGatedPromptCard = ({ cardKey, question, cardIcons }: SurveyQuestionsLegacyValue) =>
    renderSurveyQuestionsFullQuestionGatedPromptCard({
      cardKey,
      promptContent: renderPromptWithManualDecrypt(question),
      cardIcons,
      gatedPromptNotice: renderGatedPromptNotice({
        question,
        tooltipIdSuffix: 'full',
        fallbackId: cardKey || 'gated',
      }),
      tagDropdownRow: renderQuestionTagDropdownRow(question),
    });

  const renderQuestionMaskedPromptCard = ({ mode, question, cardKey, cardIcons }: SurveyQuestionsLegacyValue) =>
    mode === 'full'
      ? renderFullQuestionGatedPromptCard({
          cardKey,
          question,
          cardIcons,
        })
      : typeof engine.renderPileGatedPromptCard === 'function'
        ? engine.renderPileGatedPromptCard({ question })
        : null;

  const renderQuestionAnswerLockControl = ({
    surveyIndex,
    questionId,
    answer,
    glowAnswer,
    lockDisabled,
    lockTitle,
    visualContext,
  }: SurveyQuestionsLegacyValue) =>
    renderAnswerLockControl({
      surveyIndex,
      questionId,
      answer,
      lockDisabled,
      lockTitle,
      glowAnswer,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      visualContext,
    });

  const renderQuestionAdditionalLockControl = ({
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
    visualContext,
  }: SurveyQuestionsLegacyValue) =>
    renderAnswerLockControl({
      surveyIndex,
      questionId,
      answer: additional,
      field: additional,
      fieldKey: 'additional',
      lockDisabled: stateRef.current.isSubmitting,
      lockTitle: additional.encrypted ? 'Encrypted comments' : 'Comments encryption audience',
      glowAnswer: glowAdditional,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      showFollowOption: true,
      visualContext,
    });

  const renderFullQuestionFooterIcons = ({
    surveyIndex,
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
    commentsOpen,
    onToggleComments,
  }: SurveyQuestionsLegacyValue) => {
    const { lockDisabled, lockTitle }: SurveyQuestionsLegacyValue = getAnswerLockDisplayState({
      field: answer,
      masked: maskedAnswer,
    });

    return (
      <FullQuestionFooterIcons
        hasAdditionalContent={hasAdditionalContent}
        commentsOpen={commentsOpen}
        onToggleComments={onToggleComments}
        questionId={question.id}
      >
        {renderQuestionAnswerLockControl({
          surveyIndex,
          questionId: question.id,
          answer,
          glowAnswer,
          lockDisabled,
          lockTitle,
        })}
        {renderQuestionTagDropdown(question)}
      </FullQuestionFooterIcons>
    );
  };

  const renderFullQuestionCardIcons = ({
    question,
    showResponseLookupSpinner,
    isQuestionBookmarked,
  }: SurveyQuestionsLegacyValue) => {
    return (
      <QuestionCardLinks
        showResponseLookupSpinner={showResponseLookupSpinner}
        isQuestionBookmarked={isQuestionBookmarked}
        onBookmarkToggle={() => handleBookmarkToggle(question.id)}
        arweaveHref={surveyResponseStoragePort.buildQuestionArweaveHref(question, {
          contextLabel: 'survey_tool_question_link',
        })}
        questionHref={
          question.id ? buildQuestionRoutePath(question.id, { sessionSlug: inst._getEffectiveDraftSlug() }) : ''
        }
      />
    );
  };

  const renderQuestionFieldDecryptControl = ({
    questionId,
    fieldKey,
    allowDecrypt,
    decryptTooltip,
    actionLabel,
    busy,
    showBusySpinnerWhenAutoDecryptEnabled = false,
    wrapperStyle,
  }: SurveyQuestionsLegacyValue) => {
    const displayState: SurveyQuestionsLegacyValue = (
      buildQuestionFieldDecryptControlDisplayStateHelper as SurveyQuestionsLegacyValue
    )({
      actionLabel,
      allowDecrypt,
      autoDecryptEnabled: stateRef.current.autoDecryptEnabled,
      busy,
      decryptTooltip,
      isDecrypting: stateRef.current.isDecrypting,
      showBusySpinnerWhenAutoDecryptEnabled,
      wrapperStyle,
    });

    return (
      <QuestionDecryptControl {...displayState} onClick={() => handleDecryptQuestionAnswer(questionId, fieldKey)} />
    );
  };

  const renderFullQuestionCardShell = ({
    cardKey,
    question,
    cardIcons,
    mainContent,
    footerIcons,
    sliderSection,
    commentsSection,
  }: SurveyQuestionsLegacyValue) => (
    <SurveyQuestionsFullQuestionCardShell
      key={cardKey}
      cardKey={cardKey}
      promptContent={renderPromptWithManualDecrypt(question)}
      cardIcons={cardIcons}
      mainContent={mainContent}
      footerIcons={footerIcons}
      sliderSection={sliderSection}
      commentsSection={commentsSection}
    />
  );

  return {
    beginQuestionDisplayRender,
    flushDraftPersistAfterSliderChange,
    getAnswerLockDisplayState,
    getConvictionValueForSlice,
    getFieldDecryptState,
    getGatedPromptNoticeState,
    getImportanceValueForSlice,
    getQuestionFieldDisplayState,
    getQuestionPayloadDisplayState,
    getQuestionRenderDisplayState,
    getQuestionResponseDisplayState,
    getSliderMode,
    handleConvictionImportanceChange,
    isQuestionPromptMasked,
    parseEncryptedEnvelope,
    renderFullQuestionAdditionalInput,
    renderFullQuestionCardIcons,
    renderFullQuestionCardShell,
    renderFullQuestionFooterIcons,
    renderFullQuestionGatedPromptCard,
    renderFullQuestionResponseInput,
    renderFullQuestionSliderSection,
    renderGatedPromptNotice,
    renderQuestionAdditionalLockControl,
    renderQuestionAnswerLockControl,
    renderQuestionFieldDecryptControl,
    renderQuestionMaskedPromptCard,
    setSliderMode,
  };
};
