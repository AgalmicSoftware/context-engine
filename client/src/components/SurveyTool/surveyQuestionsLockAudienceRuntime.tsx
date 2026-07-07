import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsLockAudienceRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsLockAudienceRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsLockAudienceRuntime => {
  const {
    SurveyQuestionsLockAudienceControl,
    buildAdditionalAudienceSelectionPlan,
    buildAdditionalEncryptionAudienceState,
    buildAnswerAudienceSelectionPlan,
    buildAnswerEncryptionAudienceState,
    buildEmptyResponseFieldState,
    buildInheritedAdditionalFieldState,
    buildLockAudienceButtonAction,
    buildLockAudienceDisplayState,
    buildLockAudienceGateDetailsState,
    buildLockAudienceMenuState,
    buildSurveyResponseStateArray,
    invalidateDiffCaches,
    isQuestionLockedForResponse,
    normalizeFieldAudienceMode,
    normalizeGateLabelText,
    normalizeResponseEncryptionAudience,
    persistDraftSafely,
    propsRef,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveQuestionGateOption,
    scheduleJsonPreviewUpdate,
    setState,
    stateRef,
    toggleAdditionalCommentsEncryption,
    toggleAnswerEncryption,
  } = context;

  const getLockAudienceMenuStateKey = (
    questionId: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    if (!qid) return '';
    return String(fieldKey || '')
      .trim()
      .toLowerCase() === 'additional'
      ? `${qid}:additional`
      : qid;
  };

  const isLockAudienceMenuOpen = (
    questionId: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const key: SurveyQuestionsLegacyValue = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return false;
    return !!(stateRef.current.lockAudienceMenuByQuestion && stateRef.current.lockAudienceMenuByQuestion[key]);
  };

  const getLockAudienceDisplayState = ({
    questionId,
    answer,
    fieldKey = 'answer',
    field = null,
    lockDisabled,
    lockTitle,
    glowAnswer,
    forceAudienceMenu = false,
    selfAudienceLabel = 'for me',
    showPlaintextOption = false,
    visualContext = 'default',
  }: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    const resolvedFieldKey: SurveyQuestionsLegacyValue =
      String(fieldKey || '')
        .trim()
        .toLowerCase() === 'additional'
        ? 'additional'
        : 'answer';
    const fieldState: SurveyQuestionsLegacyValue = field && typeof field === 'object' ? field : answer || {};
    const forcedGate: SurveyQuestionsLegacyValue = isQuestionLockedForResponse(qid);
    const gateOption: SurveyQuestionsLegacyValue = resolveQuestionGateOption(qid);
    const gateOptions: SurveyQuestionsLegacyValue = Array.isArray(gateOption?.gateDetails)
      ? gateOption.gateDetails
      : [];
    const currentAudience: SurveyQuestionsLegacyValue = resolveFieldEncryptionAudience(
      fieldState,
      qid,
      resolvedFieldKey,
    );
    const currentGateId: SurveyQuestionsLegacyValue = resolveFieldEncryptionGateId(fieldState, qid, resolvedFieldKey);
    const currentAudienceMode: SurveyQuestionsLegacyValue = normalizeFieldAudienceMode(
      fieldState?.audienceMode,
      resolvedFieldKey,
      fieldState,
    );
    const displayState: SurveyQuestionsLegacyValue = buildLockAudienceDisplayState({
      questionId: qid,
      fieldKey: resolvedFieldKey,
      fieldState,
      lockDisabled,
      lockTitle,
      glowAnswer,
      forceAudienceMenu,
      selfAudienceLabel: normalizeGateLabelText(selfAudienceLabel) || 'for me',
      showPlaintextOption,
      visualContext,
      forcedGate,
      gateOptions,
      hasGateOption: !!gateOption,
      menuOpen: isLockAudienceMenuOpen(qid, resolvedFieldKey),
      currentAudience,
      currentGateId,
      currentAudienceMode,
    });
    const menuStateKey: SurveyQuestionsLegacyValue = displayState.hasAudienceMenu
      ? getLockAudienceMenuStateKey(qid, displayState.effectiveFieldKey)
      : '';
    const expandedGateId: SurveyQuestionsLegacyValue = normalizeGateLabelText(
      stateRef.current.lockAudienceGateDetailsByQuestion?.[menuStateKey] || '',
    );

    return {
      ...displayState,
      expandedGateId,
    };
  };

  const toggleLockAudienceGateDetails = (
    questionId: SurveyQuestionsLegacyValue,
    forceOpen: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const key: SurveyQuestionsLegacyValue = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    const normalizedGateId: SurveyQuestionsLegacyValue = normalizeGateLabelText(
      typeof forceOpen === 'string' ? forceOpen : '',
    );
    setState((prev: SurveyQuestionsLegacyValue) =>
      buildLockAudienceGateDetailsState(prev, key, forceOpen, normalizedGateId, normalizeGateLabelText),
    );
  };

  const toggleLockAudienceMenu = (
    questionId: SurveyQuestionsLegacyValue,
    forceOpen: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const key: SurveyQuestionsLegacyValue = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    setState((prev: SurveyQuestionsLegacyValue) => buildLockAudienceMenuState(prev, key, forceOpen));
  };

  const applyAnswerEncryptionAudience = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    audience: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    const idx: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex || 0;
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    if (!qid) return;
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildAnswerEncryptionAudienceState(prev, {
          audience,
          buildAnswerAudienceSelectionPlan: buildAnswerAudienceSelectionPlan as SurveyQuestionsLegacyValue,
          buildSurveyResponseStateArray,
          deps: {
            isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
            buildEmptyResponseFieldState: (q: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
              buildEmptyResponseFieldState(q, fk),
            resolveFieldEncryptionAudience: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionAudience(f, q, fk),
            resolveFieldEncryptionGateId: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionGateId(f, q, fk),
            normalizeFieldAudienceMode: (
              v: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
              f: SurveyQuestionsLegacyValue,
            ) => normalizeFieldAudienceMode(v, fk, f),
            buildInheritedAdditionalFieldState: (
              af: SurveyQuestionsLegacyValue,
              ans: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
            ) => buildInheritedAdditionalFieldState(af, ans, q),
            normalizeResponseEncryptionAudience: (a: SurveyQuestionsLegacyValue, q: SurveyQuestionsLegacyValue) =>
              normalizeResponseEncryptionAudience(a, q),
          },
          gateId: options?.gateId || '',
          questionId: qid,
          surveyIndex: idx,
        }),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely && persistDraftSafely();
      },
    );
  };

  const applyAdditionalEncryptionAudience = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    audience: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    const idx: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex || 0;
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    if (!qid) return;
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildAdditionalEncryptionAudienceState(prev, {
          audience,
          buildAdditionalAudienceSelectionPlan: buildAdditionalAudienceSelectionPlan as SurveyQuestionsLegacyValue,
          buildSurveyResponseStateArray,
          deps: {
            isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
            buildEmptyResponseFieldState: (q: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
              buildEmptyResponseFieldState(q, fk),
            resolveFieldEncryptionAudience: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionAudience(f, q, fk),
            resolveFieldEncryptionGateId: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionGateId(f, q, fk),
            normalizeFieldAudienceMode: (
              v: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
              f: SurveyQuestionsLegacyValue,
            ) => normalizeFieldAudienceMode(v, fk, f),
            buildInheritedAdditionalFieldState: (
              af: SurveyQuestionsLegacyValue,
              ans: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
            ) => buildInheritedAdditionalFieldState(af, ans, q),
            normalizeResponseEncryptionAudience: (a: SurveyQuestionsLegacyValue, q: SurveyQuestionsLegacyValue) =>
              normalizeResponseEncryptionAudience(a, q),
          },
          gateId: options?.gateId || '',
          questionId: qid,
          surveyIndex: idx,
        }),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely && persistDraftSafely();
      },
    );
  };

  const applyLockAudienceSelection = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    audience,
    gateId = '',
  }: SurveyQuestionsLegacyValue) => {
    if (effectiveFieldKey === 'additional') {
      applyAdditionalEncryptionAudience(surveyIndex, qid, audience, { gateId });
      return;
    }
    applyAnswerEncryptionAudience(surveyIndex, qid, audience, { gateId });
  };

  const toggleQuestionFieldEncryptionEnabled = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    nextEncrypted,
  }: SurveyQuestionsLegacyValue) => {
    if (effectiveFieldKey === 'additional') {
      toggleAdditionalCommentsEncryption(surveyIndex, qid, nextEncrypted);
      return;
    }
    toggleAnswerEncryption(surveyIndex, qid, nextEncrypted);
  };

  const handleLockAudienceButtonClick = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    fieldState,
    lockDisabled,
    forcedGate,
    hasAudienceMenu,
    menuOpen,
    hasGateOption,
  }: SurveyQuestionsLegacyValue) => {
    const action: SurveyQuestionsLegacyValue = buildLockAudienceButtonAction({
      effectiveFieldKey,
      fieldEncrypted: !!fieldState?.encrypted,
      lockDisabled,
      forcedGate,
      hasAudienceMenu,
      menuOpen,
      hasGateOption,
    });

    if (action.kind === 'noop') return;

    if (action.kind === 'toggle-field-encryption') {
      toggleQuestionFieldEncryptionEnabled({
        surveyIndex,
        qid,
        effectiveFieldKey,
        nextEncrypted: action.nextEncrypted,
      });
      return;
    }

    if (action.kind === 'disable-field-encryption-and-close-menu') {
      toggleQuestionFieldEncryptionEnabled({
        surveyIndex,
        qid,
        effectiveFieldKey,
        nextEncrypted: false,
      });
      toggleLockAudienceMenu(qid, false, effectiveFieldKey);
      return;
    }

    if (action.kind === 'enable-answer-and-open-menu') {
      toggleAnswerEncryption(surveyIndex, qid, true);
      toggleLockAudienceMenu(qid, true, effectiveFieldKey);
      return;
    }

    if (action.kind === 'set-menu-open') {
      toggleLockAudienceMenu(qid, action.nextOpen, effectiveFieldKey);
    }
  };

  const renderAnswerLockControl = ({
    surveyIndex,
    questionId,
    answer,
    fieldKey = 'answer',
    field = null,
    lockDisabled,
    lockTitle,
    glowAnswer,
    forceAudienceMenu = false,
    selfAudienceLabel = 'for me',
    showPlaintextOption = false,
    showFollowOption = false,
    visualContext = 'default',
  }: SurveyQuestionsLegacyValue) => {
    const {
      qid,
      effectiveFieldKey,
      isPileVisualContext,
      fieldState,
      forcedGate,
      gateOptions,
      hasGateOption,
      hasAudienceMenu,
      menuOpen,
      currentGateId,
      gateActive,
      selfActive,
      plaintextActive,
      followActive,
      pileMenuPressed,
      showBrightLockState,
      isLockDisabled,
      allowPlaintextOption,
      lockButtonStyle,
      normalizedSelfAudienceLabel,
      expandedGateId,
      buttonTitle,
    }: SurveyQuestionsLegacyValue = getLockAudienceDisplayState({
      questionId,
      answer,
      fieldKey,
      field,
      lockDisabled,
      lockTitle,
      glowAnswer,
      forceAudienceMenu,
      selfAudienceLabel,
      showPlaintextOption,
      visualContext,
    });
    const handleAudienceSelect: SurveyQuestionsLegacyValue = (
      audience: SurveyQuestionsLegacyValue,
      gateId: SurveyQuestionsLegacyValue = '',
    ) => {
      applyLockAudienceSelection({
        surveyIndex,
        qid,
        effectiveFieldKey,
        audience,
        gateId,
      });
    };

    const handleLockClick: SurveyQuestionsLegacyValue = () => {
      handleLockAudienceButtonClick({
        surveyIndex,
        qid,
        effectiveFieldKey,
        fieldState,
        lockDisabled,
        forcedGate,
        hasAudienceMenu,
        menuOpen,
        hasGateOption,
      });
    };

    return (
      <SurveyQuestionsLockAudienceControl
        qid={qid}
        effectiveFieldKey={effectiveFieldKey}
        isPileVisualContext={isPileVisualContext}
        pileMenuPressed={pileMenuPressed}
        showBrightLockState={showBrightLockState}
        isLockDisabled={isLockDisabled}
        buttonTitle={buttonTitle}
        hasAudienceMenu={hasAudienceMenu}
        menuOpen={menuOpen}
        lockButtonStyle={lockButtonStyle}
        fieldState={fieldState}
        forcedGate={forcedGate}
        gateOptions={gateOptions}
        gateActive={gateActive}
        currentGateId={currentGateId}
        selfActive={selfActive}
        plaintextActive={plaintextActive}
        followActive={followActive}
        allowPlaintextOption={allowPlaintextOption}
        normalizedSelfAudienceLabel={normalizedSelfAudienceLabel}
        expandedGateId={expandedGateId}
        showFollowOption={showFollowOption}
        onLockClick={handleLockClick}
        onSelectAudience={handleAudienceSelect}
        onToggleGateDetails={(
          nextQid: SurveyQuestionsLegacyValue,
          gateId: SurveyQuestionsLegacyValue,
          nextFieldKey: SurveyQuestionsLegacyValue,
        ) => toggleLockAudienceGateDetails(nextQid, gateId, nextFieldKey)}
      />
    );
  };

  return {
    applyAdditionalEncryptionAudience,
    applyAnswerEncryptionAudience,
    applyLockAudienceSelection,
    getLockAudienceDisplayState,
    getLockAudienceMenuStateKey,
    handleLockAudienceButtonClick,
    isLockAudienceMenuOpen,
    renderAnswerLockControl,
    toggleLockAudienceGateDetails,
    toggleLockAudienceMenu,
    toggleQuestionFieldEncryptionEnabled,
  };
};
