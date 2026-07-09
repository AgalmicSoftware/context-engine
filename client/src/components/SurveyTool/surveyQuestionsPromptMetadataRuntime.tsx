import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsPromptMetadataRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsPromptMetadataRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsPromptMetadataRuntime => {
  const {
    E2E_TESTIDS,
    FontAwesomeIcon,
    QUESTION_TAG_DROPDOWN_ROW_STYLE,
    SurveyQuestionTagControl,
    areQuestionPayloadsEquivalent,
    buildActiveTagModalState,
    buildBulkPromptReloadingState,
    buildDecryptingByKeyState,
    buildQuestionDecryptContextForSession,
    buildQuestionPromptDecryptDisplayState,
    buildRenderedQuestionPayloadPoolsState,
    buildVisiblePileQuestionsAfterPromptDecryptState,
    ensureQuestionsNet,
    faSpinner,
    fetchSingleQuestionData,
    getAllSessionSlugs,
    getQuestionFieldTaskKey,
    getQuestionPayloadDisplayState,
    getSessionSlugHintFromProps,
    getSessionSlugPinnedFromProps,
    inst,
    isMaskedQuestionPayload,
    isQuestionFieldBusy,
    isSurveyQuestionsMaskedPromptText,
    isSurveyToolFilterStateActive,
    pickBetterQuestionPayload,
    propsRef,
    readQuestionsCache,
    resolveCurrentTagSessionSlug,
    resolveDraftSessionContext,
    resolveEffectiveSlug,
    resolveExplicitSessionContext,
    resolveQuestionPayloadCacheWriteContext,
    resolveSessionChainId,
    resolveSlugForIds,
    setState,
    shouldAttemptAutomaticPromptDecrypt,
    stateRef,
    styles,
    surveyLog,
    surveyQuestionReadsPort,
    writeQuestionsCache,
  } = context;

  const _getDraftScope = () => {
    return propsRef.current.singleQuestionMode
      ? 'questions' // Align primary scope with spec; per-QID isolation stays in answers
      : String(propsRef.current?.surveyId || 'questions').toLowerCase();
  };

  const _getEffectiveDraftSlug = () => {
    return propsRef.current.singleQuestionMode
      ? resolveSlugForIds({
          questionId: propsRef.current.questionID,
          props: propsRef.current,
          network: propsRef.current.network,
        })
      : resolveSlugForIds({
          surveyId: propsRef.current.surveyId || null,
          props: propsRef.current,
          network: propsRef.current.network,
        });
  };

  const getAudioInputWorkerProps = () => {
    // Prefer the explicit route/session slug to avoid cross-cache slug drift on /question routes.
    const explicitSessionSlug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
    const resolvedSession: SurveyQuestionsLegacyValue = explicitSessionSlug
      ? resolveExplicitSessionContext(explicitSessionSlug)
      : resolveDraftSessionContext(propsRef.current, inst._getEffectiveDraftSlug());
    const sessionSlug: SurveyQuestionsLegacyValue = resolvedSession.sessionSlug || '';
    const sessionConfig: SurveyQuestionsLegacyValue = resolvedSession.sessionConfig || null;
    const providerLike: SurveyQuestionsLegacyValue =
      typeof propsRef.current.providerLike === 'string'
        ? propsRef.current.providerLike
        : typeof propsRef.current.provider === 'string'
          ? propsRef.current.provider
          : '';
    const chainId: SurveyQuestionsLegacyValue = resolveSessionChainId(sessionSlug, sessionConfig);
    return {
      sessionSlug,
      sessionConfig,
      context: {
        account: propsRef.current.account || '',
        providerLike,
        chainId,
      },
    };
  };

  const buildQuestionDecryptContext = (slugIn: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = String(slugIn ?? '')
      .trim()
      .toLowerCase();
    const cfg: SurveyQuestionsLegacyValue = resolveExplicitSessionContext(slug).sessionConfig || null;
    const litHooks: SurveyQuestionsLegacyValue =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
    return buildQuestionDecryptContextForSession({
      cfg,
      account: propsRef.current.account || '',
      providerLike: propsRef.current.provider || '',
      litHooks,
      fallbackChainId: resolveSessionChainId(slug, cfg),
    });
  };

  const buildAutomaticQuestionMetadataFetchOptions = (slugIn: SurveyQuestionsLegacyValue) => {
    const decryptContext: SurveyQuestionsLegacyValue = buildQuestionDecryptContext(slugIn);
    return shouldAttemptAutomaticPromptDecrypt() ? { decryptContext } : { decryptContext, skipDecrypt: true };
  };

  const hasMaskedCurrentQuestionPayload = () => {
    if (!propsRef.current.singleQuestionMode) return false;
    const q: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current.questionPool)
      ? stateRef.current.questionPool[0]
      : null;
    if (q && typeof q === 'object') {
      if (isMaskedQuestionPayload(q)) return true;
      const prompt: SurveyQuestionsLegacyValue = String(q.prompt || '').trim();
      if (prompt || q.promptDecrypted) return false;
    }
    const qid: SurveyQuestionsLegacyValue = String(propsRef.current.questionID || '').toLowerCase();
    if (!qid) return false;
    const slug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug();
    const cfg: SurveyQuestionsLegacyValue = resolveExplicitSessionContext(slug).sessionConfig || null;
    const netIdStr: SurveyQuestionsLegacyValue = String(
      propsRef.current.network?.id ?? propsRef.current.networkChainId ?? cfg?.networkChainId ?? '',
    );
    if (!netIdStr) return false;
    const cache: SurveyQuestionsLegacyValue = readQuestionsCache(slug) || {};
    const cached: SurveyQuestionsLegacyValue = cache?.[netIdStr]?.questions?.[qid];
    return isMaskedQuestionPayload(cached);
  };

  const isMaskedPromptText = (prompt: SurveyQuestionsLegacyValue) => isSurveyQuestionsMaskedPromptText(prompt);

  const getQuestionFetchCandidateSlugs = (
    questionId: SurveyQuestionsLegacyValue,
    preferredSlug: SurveyQuestionsLegacyValue = '',
    opts: SurveyQuestionsLegacyValue = {},
  ) => {
    const sanitize: SurveyQuestionsLegacyValue = (s: SurveyQuestionsLegacyValue) =>
      s == null
        ? ''
        : String(s)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '');

    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    const slugPinned: SurveyQuestionsLegacyValue = getSessionSlugPinnedFromProps(propsRef.current);
    const explicitSlug: SurveyQuestionsLegacyValue = sanitize(getSessionSlugHintFromProps(propsRef.current));
    const currentQuestionSessionName: SurveyQuestionsLegacyValue = (
      stateRef.current.questionPool?.[0] as SurveyQuestionsLegacyValue
    )?.sessionName;
    const resolvedSlug: SurveyQuestionsLegacyValue = sanitize(
      resolveSlugForIds({
        sessionName: propsRef.current.sessionName || currentQuestionSessionName,
        questionId: qid || propsRef.current.questionID || null,
        surveyId: propsRef.current.singleQuestionMode ? null : propsRef.current.surveyId || null,
        props: propsRef.current,
        network: propsRef.current.network,
      }),
    );
    const preferred: SurveyQuestionsLegacyValue = sanitize(preferredSlug);
    const effective: SurveyQuestionsLegacyValue =
      preferred || explicitSlug || resolvedSlug || sanitize(resolveEffectiveSlug(propsRef.current));
    const explicitSlugKnown: SurveyQuestionsLegacyValue =
      explicitSlug === '' || !!resolveExplicitSessionContext(explicitSlug).sessionConfig;
    // Default behavior preserves strict session pinning; callers can opt into fallback explicitly.
    const allowPinnedFallback: SurveyQuestionsLegacyValue =
      opts?.allowPinnedFallback === true || (slugPinned && !!explicitSlug && !explicitSlugKnown);

    const out: SurveyQuestionsLegacyValue = [];
    const seen: SurveyQuestionsLegacyValue = new Set();
    const pushSlug: SurveyQuestionsLegacyValue = (slugIn: SurveyQuestionsLegacyValue) => {
      const slug: SurveyQuestionsLegacyValue = sanitize(slugIn);
      if (seen.has(slug)) return;
      seen.add(slug);
      out.push(slug);
    };

    pushSlug(effective);
    pushSlug(explicitSlug);
    pushSlug(resolvedSlug);
    pushSlug(resolveEffectiveSlug(propsRef.current));

    if (!slugPinned || allowPinnedFallback) {
      getAllSessionSlugs().forEach((s: SurveyQuestionsLegacyValue) => pushSlug(s));
      pushSlug('');
    }

    return out;
  };

  const cacheQuestionPayloadForSlug = (
    slugIn: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    questionPayload: SurveyQuestionsLegacyValue,
  ) => {
    const slug: SurveyQuestionsLegacyValue = String(slugIn ?? '')
      .trim()
      .toLowerCase();
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid || !questionPayload) return;

    const cacheWriteContext: SurveyQuestionsLegacyValue = resolveQuestionPayloadCacheWriteContext(
      propsRef.current,
      slug,
    );
    const netIdStr: SurveyQuestionsLegacyValue = cacheWriteContext.networkIdStr || '';
    if (!netIdStr) return;

    const questionsCache: SurveyQuestionsLegacyValue = ensureQuestionsNet(readQuestionsCache(slug), netIdStr);
    const existing: SurveyQuestionsLegacyValue = questionsCache?.[netIdStr]?.questions?.[qid] || null;
    const picked: SurveyQuestionsLegacyValue = pickBetterQuestionPayload(existing, questionPayload) || questionPayload;
    const nextPayload: SurveyQuestionsLegacyValue = { ...picked, id: qid };
    if (areQuestionPayloadsEquivalent(existing, nextPayload)) return;
    questionsCache[netIdStr].questions[qid] = nextPayload;
    void writeQuestionsCache(slug, questionsCache);
  };

  const applyQuestionPayloadToRenderedPools = (
    questionId: SurveyQuestionsLegacyValue,
    questionPayload: SurveyQuestionsLegacyValue,
  ) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid || !questionPayload) return;

    setState((prev: SurveyQuestionsLegacyValue) =>
      buildRenderedQuestionPayloadPoolsState(prev, qid, questionPayload, {
        pickBetterQuestionPayload: pickBetterQuestionPayload as SurveyQuestionsLegacyValue,
        areQuestionPayloadsEquivalent,
      }),
    );
  };

  const fetchQuestionPayloadWithDeterministicContext = async (
    questionId: SurveyQuestionsLegacyValue,
    opts: SurveyQuestionsLegacyValue = {},
  ) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid) return { promptReady: false, bestQuestionData: null, bestSlug: '' };

    const currentQuestion: SurveyQuestionsLegacyValue =
      (Array.isArray(stateRef.current.questionPool)
        ? stateRef.current.questionPool.find(
            (q: SurveyQuestionsLegacyValue) => String(q?.id || '').toLowerCase() === qid,
          )
        : null) ||
      (Array.isArray(stateRef.current.pileQuestions)
        ? stateRef.current.pileQuestions.find(
            (q: SurveyQuestionsLegacyValue) => String(q?.id || '').toLowerCase() === qid,
          )
        : null) ||
      null;

    let bestQuestionData: SurveyQuestionsLegacyValue = currentQuestion ? { ...currentQuestion, id: qid } : null;
    let bestSlug: SurveyQuestionsLegacyValue = String(
      opts.preferredSlug ?? inst._getEffectiveDraftSlug() ?? '',
    ).toLowerCase();
    const candidateSlugs: SurveyQuestionsLegacyValue = getQuestionFetchCandidateSlugs(qid, bestSlug);
    let fetchedAny: SurveyQuestionsLegacyValue = false;

    for (const candidateSlug of candidateSlugs) {
      const decryptContext: SurveyQuestionsLegacyValue = buildQuestionDecryptContext(candidateSlug);
      const litReady: SurveyQuestionsLegacyValue = !!(
        decryptContext?.litHooks && typeof decryptContext.litHooks.getKey === 'function'
      );
      try {
        const fetched: SurveyQuestionsLegacyValue = await surveyQuestionReadsPort.getQuestionData(
          propsRef.current.provider,
          qid,
          candidateSlug,
          { decryptContext },
        );
        if (!fetched) continue;
        fetchedAny = true;
        const normalized: SurveyQuestionsLegacyValue = { ...fetched, id: qid };
        const picked: SurveyQuestionsLegacyValue =
          pickBetterQuestionPayload(bestQuestionData, normalized) || normalized;
        bestQuestionData = picked;
        bestSlug = candidateSlug;
        cacheQuestionPayloadForSlug(candidateSlug, qid, picked);
        const promptReady: SurveyQuestionsLegacyValue = !isMaskedPromptText(picked?.prompt);
        if (promptReady || !isMaskedQuestionPayload(picked)) break;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error || '');
        surveyLog.debug('[question-prompt-reload] getQuestionData failed', {
          questionId: qid,
          slug: candidateSlug,
          chainId: decryptContext?.chainId || null,
          hasProvider: !!propsRef.current.provider,
          hasAccount: !!propsRef.current.account,
          loginComplete: !!propsRef.current.loginComplete,
          litReady,
          error: message,
        });
      }
    }

    if (bestQuestionData) {
      applyQuestionPayloadToRenderedPools(qid, bestQuestionData);
      if (bestSlug || bestSlug === '') {
        cacheQuestionPayloadForSlug(bestSlug, qid, bestQuestionData);
      }
    }

    const promptReady: SurveyQuestionsLegacyValue = !!bestQuestionData && !isMaskedPromptText(bestQuestionData?.prompt);
    if (!promptReady) {
      const litHooks: SurveyQuestionsLegacyValue =
        propsRef.current.lit ||
        propsRef.current.litHooks ||
        (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
      const litReady: SurveyQuestionsLegacyValue = !!(litHooks && typeof litHooks.getKey === 'function');
      const chainId: SurveyQuestionsLegacyValue =
        Number(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? 0) || null;
      const reason: SurveyQuestionsLegacyValue =
        !propsRef.current.loginComplete || !propsRef.current.account
          ? 'not_logged_in'
          : !propsRef.current.provider
            ? 'provider_missing'
            : !chainId
              ? 'missing_or_wrong_chain'
              : !litReady
                ? 'lit_hooks_unready'
                : !fetchedAny
                  ? 'question_fetch_unavailable'
                  : 'acc_failed_or_entitlement_missing';
      surveyLog.debug('[question-prompt-reload] prompt remains masked', {
        questionId: qid,
        slug: bestSlug,
        reason,
        fetchedAny,
        hasProvider: !!propsRef.current.provider,
        hasAccount: !!propsRef.current.account,
        loginComplete: !!propsRef.current.loginComplete,
        chainId,
        litReady,
      });
    }

    return { promptReady, bestQuestionData, bestSlug };
  };

  const handleReloadMaskedPrompt = async (questionId: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid) return false;
    const key: SurveyQuestionsLegacyValue = getQuestionFieldTaskKey(qid, 'prompt');

    setState((prev: SurveyQuestionsLegacyValue) => buildDecryptingByKeyState(prev, key, true));

    try {
      const preferredSlug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug();
      const result: SurveyQuestionsLegacyValue = await fetchQuestionPayloadWithDeterministicContext(qid, {
        preferredSlug,
      });

      if (propsRef.current.singleQuestionMode && qid === String(propsRef.current.questionID || '').toLowerCase()) {
        await fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });
      }

      // Pile view keeps gated/masked questions in allQuestionsForFilter as source-of-truth.
      // After a successful decrypt, refresh the visible pile cards from that source without
      // triggering a full filter/apply cycle that could wipe in-progress edits.
      if (result?.promptReady) {
        setState((prev: SurveyQuestionsLegacyValue) =>
          buildVisiblePileQuestionsAfterPromptDecryptState(prev, {
            isFilterStateActive: isSurveyToolFilterStateActive,
            isMaskedPromptText: isMaskedPromptText,
          }),
        );
      }

      const activePrompt: SurveyQuestionsLegacyValue = (() => {
        const q: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current.questionPool)
          ? stateRef.current.questionPool.find(
              (item: SurveyQuestionsLegacyValue) => String(item?.id || '').toLowerCase() === qid,
            )
          : null;
        return q?.prompt;
      })();
      return !isMaskedPromptText(activePrompt) || !!result.promptReady;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || '');
      surveyLog.debug('[question-prompt-reload] manual reload failed', {
        questionId: qid,
        error: message,
      });
      return false;
    } finally {
      setState((prev: SurveyQuestionsLegacyValue) => buildDecryptingByKeyState(prev, key, false));
    }
  };

  const reloadMaskedQuestionBatch = async (questionIds: SurveyQuestionsLegacyValue = []) => {
    const ids: SurveyQuestionsLegacyValue = Array.from(
      new Set(
        (Array.isArray(questionIds) ? questionIds : [])
          .map((qid: SurveyQuestionsLegacyValue) =>
            String(qid || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    if (!ids.length) return;

    setState(buildBulkPromptReloadingState(true));
    try {
      for (const qid of ids) {
        // eslint-disable-next-line no-await-in-loop
        await handleReloadMaskedPrompt(qid);
      }
    } finally {
      setState(buildBulkPromptReloadingState(false));
    }
  };

  const renderPromptWithManualDecrypt = (question: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = String(question?.id || '')
      .trim()
      .toLowerCase();
    const promptText: SurveyQuestionsLegacyValue = question?.prompt || 'Question';
    const promptMasked: SurveyQuestionsLegacyValue = isMaskedPromptText(promptText);
    const payloadDisplay: SurveyQuestionsLegacyValue = getQuestionPayloadDisplayState(question);
    const promptReloading: SurveyQuestionsLegacyValue = isQuestionFieldBusy(qid, 'prompt');
    const promptDisplay: SurveyQuestionsLegacyValue = buildQuestionPromptDecryptDisplayState({
      questionId: qid,
      promptText,
      promptMasked,
      promptReloading,
      payloadDisplay,
      loginComplete: propsRef.current.loginComplete,
      account: propsRef.current.account,
      canReloadPrompt: promptMasked && qid,
    });

    return (
      <div className={styles.promptTitleBlock}>
        <h4 id={styles.questionTitle}>
          {promptDisplay.showPromptAction ? (
            <button
              type="button"
              className={styles.maskedPromptActionButton}
              data-testid={E2E_TESTIDS.SURVEY_DECRYPT_PROMPT}
              data-ce-question-id={promptDisplay.qid}
              onClick={() => handleReloadMaskedPrompt(promptDisplay.qid)}
              disabled={promptDisplay.noticeActionDisabled}
              aria-busy={promptDisplay.noticeActionBusy}
              title={promptDisplay.promptTitle}
            >
              {promptDisplay.noticeActionBusy ? (
                <span className={styles.maskedPromptLoading}>
                  <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
                  <span>{promptDisplay.promptBusyLabel}</span>
                </span>
              ) : (
                promptDisplay.promptLabel
              )}
            </button>
          ) : (
            promptDisplay.promptText
          )}
        </h4>
      </div>
    );
  };

  const renderQuestionTagControl = (question: SurveyQuestionsLegacyValue, options: SurveyQuestionsLegacyValue = {}) => {
    const { rowStyle }: SurveyQuestionsLegacyValue = options;
    return (
      <SurveyQuestionTagControl
        tags={question.tags}
        sessionSlug={resolveCurrentTagSessionSlug({
          props: propsRef.current,
          state: stateRef.current,
          getEffectiveDraftSlug: inst._getEffectiveDraftSlug,
        })}
        useTagModal={!propsRef.current.singleQuestionMode && !propsRef.current.isStandalone}
        onTagSelect={handleQuestionTagSelect}
        rowStyle={rowStyle}
      />
    );
  };

  const renderQuestionTagDropdown = (question: SurveyQuestionsLegacyValue) => renderQuestionTagControl(question);

  const handleQuestionTagSelect = (tag: SurveyQuestionsLegacyValue) => {
    const normalizedTag: SurveyQuestionsLegacyValue = String(tag || '').trim();
    if (!normalizedTag) return;
    setState(buildActiveTagModalState(normalizedTag));
  };

  const closeQuestionTagModal = () => {
    setState(buildActiveTagModalState());
  };

  const renderQuestionTagDropdownRow = (question: SurveyQuestionsLegacyValue) =>
    renderQuestionTagControl(question, {
      rowStyle: QUESTION_TAG_DROPDOWN_ROW_STYLE,
    });

  return {
    _getDraftScope,
    _getEffectiveDraftSlug,
    applyQuestionPayloadToRenderedPools,
    buildAutomaticQuestionMetadataFetchOptions,
    buildQuestionDecryptContext,
    cacheQuestionPayloadForSlug,
    closeQuestionTagModal,
    fetchQuestionPayloadWithDeterministicContext,
    getAudioInputWorkerProps,
    getQuestionFetchCandidateSlugs,
    handleQuestionTagSelect,
    handleReloadMaskedPrompt,
    hasMaskedCurrentQuestionPayload,
    isMaskedPromptText,
    reloadMaskedQuestionBatch,
    renderPromptWithManualDecrypt,
    renderQuestionTagControl,
    renderQuestionTagDropdown,
    renderQuestionTagDropdownRow,
  };
};
