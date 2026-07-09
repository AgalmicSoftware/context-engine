import type {
  SurveyQuestionsLegacyRecord,
  SurveyQuestionsLegacyValue,
  SurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes.js';
import type { SurveyQuestionsSubmitPendingStats } from './surveyQuestionsSubmitController.js';

export type SurveyQuestionsJsonRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsJsonRuntime = (context: SurveyQuestionsLegacyRecord): SurveyQuestionsJsonRuntime => {
  const {
    SurveyQuestionsJsonTree,
    buildCommentsToggleState,
    buildCopiedQuestionsJsonState,
    buildCopiedResponseJsonState,
    buildCopiedSurveyJsonState,
    buildJsonPreviewState,
    buildQuestionsJsonToggleState,
    buildResponseJsonToggleState,
    buildResponsePayload,
    buildSubmittedResponseJson,
    buildSurveyDefinitionJson,
    buildSurveyQuestionsJson,
    buildSurveyQuestionsPrimarySubmitPlan,
    buildSurveyJsonToggleState,
    encryptAndUpload,
    engine,
    getConvictionFromSlice,
    getImportanceFromSlice,
    getPendingEditStats,
    getQuestionEncryptionGates,
    getRuntimeStrategy,
    inst,
    isResponseJsonPreviewVisible,
    normalizeFieldAudienceMode,
    notify,
    propsRef,
    readSurveysCacheRef,
    resolveEffectiveSlug,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveResponseJsonContext,
    resolveSlugForIds,
    resolveSurveyQuestionsSubmitPendingStats,
    runSurveyQuestionsSubmitController,
    setManagedTimeout,
    setState,
    shouldUseSubmittedResponseJson,
    stateRef,
    surveyLog,
    surveyQuestionReadsPort,
    surveyResponseStoragePort,
  } = context;

  const getSurveyResponse = async (
    responderAddress: SurveyQuestionsLegacyValue,
    surveyID: SurveyQuestionsLegacyValue,
  ) => {
    const slug: SurveyQuestionsLegacyValue = resolveSlugForIds({
      surveyId: surveyID,
      props: propsRef.current,
      network: propsRef.current.network,
    });
    const surveyAnswers: SurveyQuestionsLegacyValue = await surveyQuestionReadsPort.getSurveyResponse(
      propsRef.current.provider,
      responderAddress,
      surveyID,
      slug,
    );
    return surveyAnswers;
  };

  const getSurveyMetadataForJson = (surveyHash: SurveyQuestionsLegacyValue) => {
    if (!surveyHash) return { surveyTitle: null, sessionName: '' };

    try {
      const slug: SurveyQuestionsLegacyValue = resolveSlugForIds({
        surveyId: surveyHash,
        props: propsRef.current,
        network: propsRef.current.network,
      });
      const responseJsonContext: SurveyQuestionsLegacyValue = resolveResponseJsonContext(propsRef.current, slug);
      const netIdStr: SurveyQuestionsLegacyValue = responseJsonContext.networkIdStr;
      const surveyIdLower: SurveyQuestionsLegacyValue = String(surveyHash || '').toLowerCase();
      const cacheKey: SurveyQuestionsLegacyValue = `${String(slug || '')}|${String(netIdStr || '')}|${surveyIdLower}`;
      const surveysCache: SurveyQuestionsLegacyValue = readSurveysCacheRef(slug) || {};
      if (
        inst._surveyJsonMetaCache.key === cacheKey &&
        inst._surveyJsonMetaCache.source === surveysCache &&
        inst._surveyJsonMetaCache.value
      ) {
        return inst._surveyJsonMetaCache.value;
      }

      let surveyTitle: SurveyQuestionsLegacyValue = null;
      let sessionName: SurveyQuestionsLegacyValue = '';
      const netBucket: SurveyQuestionsLegacyValue = netIdStr ? surveysCache?.[netIdStr] || null : null;
      const survey = netBucket?.surveys?.[surveyIdLower];
      if (survey?.title) surveyTitle = surveyResponseStoragePort.sanitizeSurveyTitleForResponsePayload(survey);
      if (survey?.sessionName) sessionName = survey.sessionName;
      else if (responseJsonContext.sessionConfig?.sessionName) {
        sessionName = responseJsonContext.sessionConfig.sessionName;
      }

      const value: SurveyQuestionsLegacyValue = { surveyTitle, sessionName };
      inst._surveyJsonMetaCache = { key: cacheKey, source: surveysCache, value };
      return value;
    } catch (_: unknown) {
      return { surveyTitle: null, sessionName: '' };
    }
  };

  const prepareJsonAndHash = (
    surveyIndex: SurveyQuestionsLegacyValue,
    responderAddress?: SurveyQuestionsLegacyValue,
    overrideState: SurveyQuestionsLegacyValue = null,
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    const surveyResponseState: SurveyQuestionsLegacyValue =
      overrideState || stateRef.current.surveysResponseState[surveyIndex];
    return buildResponsePayload({
      isStandalone: propsRef.current.isStandalone as SurveyQuestionsLegacyValue,
      singleQuestionMode: propsRef.current.singleQuestionMode as SurveyQuestionsLegacyValue,
      surveyId: propsRef.current.surveyId,
      account: responderAddress || propsRef.current.account,
      surveyIndex,
      surveyResponseState,
      questionPool: Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      pileQuestions: Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : [],
      resolveFieldEncryptionAudience: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fieldKey: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(field, qid, fieldKey),
      getQuestionEncryptionGates: (q: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(q),
      resolveFieldEncryptionGateId: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fieldKey: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(field, qid, fieldKey),
      normalizeFieldAudienceMode: (
        mode: SurveyQuestionsLegacyValue,
        fieldKey: SurveyQuestionsLegacyValue,
        field: SurveyQuestionsLegacyValue,
      ) => normalizeFieldAudienceMode(mode, fieldKey, field),
      getSurveyMetadataForJson: (hash: SurveyQuestionsLegacyValue) => getSurveyMetadataForJson(hash),
      resolveSessionContext: () => {
        const responseJsonContext: SurveyQuestionsLegacyValue = resolveResponseJsonContext(
          propsRef.current,
          resolveEffectiveSlug(propsRef.current),
        );
        return { sessionName: responseJsonContext.sessionConfig?.sessionName || '' };
      },
      getConvictionFromSlice,
      getImportanceFromSlice,
      sanitizeQuestionPromptForResponsePayload: surveyResponseStoragePort.sanitizeQuestionPromptForResponsePayload,
    });
  };

  const updateJsonPreview = (force: SurveyQuestionsLegacyValue = false) => {
    if (!force && !isResponseJsonPreviewVisible()) return;
    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    setState(buildJsonPreviewState(prepareJsonAndHash(surveyIndex)));
  };

  const jsonTreeDisplay = (jsonInput: SurveyQuestionsLegacyValue) => (
    <SurveyQuestionsJsonTree
      jsonInput={jsonInput}
      onInvalidInput={(...args: SurveyQuestionsLegacyValue[]) => surveyLog.error(...args)}
    />
  );

  const handlePrimarySubmitClick = () => {
    const inFlightPlan: SurveyQuestionsPrimarySubmitPlan = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: stateRef.current.isSubmitting,
      submitGuardActive: inst._submitGuard,
    });
    if (inFlightPlan.action === 'inert') return;

    const pendingStats: SurveyQuestionsSubmitPendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: typeof getPendingEditStats === 'function' ? () => getPendingEditStats() : undefined,
      fallbackTotal: stateRef.current.modifiedCount || 0,
    });
    const pendingEditCount = pendingStats.total;
    const planBase: SurveyQuestionsLegacyRecord = {
      account: propsRef.current.account,
      draftSlug: '',
      isStandalone: propsRef.current.isStandalone,
      isSubmitting: stateRef.current.isSubmitting,
      pendingEditCount,
      questionID: propsRef.current.questionID,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      submissionComplete: stateRef.current.submissionComplete,
      submitGuardActive: inst._submitGuard,
      submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
      surveyId: propsRef.current.surveyId,
    };
    let plan: SurveyQuestionsPrimarySubmitPlan = buildSurveyQuestionsPrimarySubmitPlan(planBase);
    if (plan.action === 'navigate') {
      plan = buildSurveyQuestionsPrimarySubmitPlan({
        ...planBase,
        draftSlug: inst._getEffectiveDraftSlug(),
      });
    }
    if (plan.action === 'inert') return;
    if (plan.action === 'navigate') {
      runSurveyQuestionsSubmitController({
        plan,
        ports: {
          navigateToResponse: (path: string) => window.history.pushState({}, '', path),
        },
      });
      return;
    }
    runSurveyQuestionsSubmitController({
      plan,
      ports: {
        activateSubmitGuard: () => {
          inst._submitGuard = true;
        },
        dispatchSubmit: () => {
          encryptAndUpload();
        },
      },
    });
  };

  const getQuestionsJson = () => {
    return buildSurveyQuestionsJson({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      questionPool: stateRef.current.questionPool,
    });
  };

  const getResponseJson = () => {
    const isViewingSubmitted: SurveyQuestionsLegacyValue = shouldUseSubmittedResponseJson({
      viewAddress: propsRef.current.viewAddress,
      responderAddress: propsRef.current.responderAddress,
      parsedViewAddressAnswers: stateRef.current.parsedViewAddressAnswers,
      isEditing: stateRef.current.isEditing,
      userAnswers: stateRef.current.userAnswers,
    });

    if (isViewingSubmitted) {
      return buildSubmittedResponseJson({
        rawResponse: stateRef.current.parsedViewAddressAnswers || stateRef.current.userAnswers,
        singleQuestionMode: propsRef.current.singleQuestionMode,
      });
    }

    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    return prepareJsonAndHash(surveyIndex);
  };

  const getSurveyJson = () => {
    return buildSurveyDefinitionJson({
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      surveys: propsRef.current.surveys,
      surveyIndex: propsRef.current.surveyIndex,
      questionPool: stateRef.current.questionPool,
    });
  };

  const copyJsonToClipboard = (json: SurveyQuestionsLegacyValue, type: SurveyQuestionsLegacyValue) => {
    let jsonToUse: SurveyQuestionsLegacyValue = json;

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0)) {
      if (propsRef.current.singleQuestionMode) {
        jsonToUse = getResponseJson();
      }
    }

    if (
      !jsonToUse ||
      (typeof jsonToUse === 'object' &&
        Object.keys(jsonToUse).length === 0 &&
        type !== 'questions' &&
        type !== 'survey')
    ) {
      surveyLog.warn('No valid JSON data to copy for type:', type);
      return;
    }

    const jsonString: SurveyQuestionsLegacyValue =
      typeof jsonToUse === 'string' ? jsonToUse : JSON.stringify(jsonToUse, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        notify.success('Copied to clipboard');
        if (type === 'questions') {
          setState(buildCopiedQuestionsJsonState(true));
          setManagedTimeout(() => {
            setState(buildCopiedQuestionsJsonState(false));
          }, 2000);
        } else if (type === 'response') {
          setState(buildCopiedResponseJsonState(true));
          setManagedTimeout(() => {
            setState(buildCopiedResponseJsonState(false));
          }, 2000);
        } else if (type === 'survey') {
          setState(buildCopiedSurveyJsonState(true));
          setManagedTimeout(() => {
            setState(buildCopiedSurveyJsonState(false));
          }, 2000);
        }
      })
      .catch((error: unknown) => {
        surveyLog.error('Failed to copy JSON to clipboard:', error);
      });
  };

  const toggleShowQuestionsJson = () => {
    setState(buildQuestionsJsonToggleState);
  };

  const toggleShowResponseJson = () => {
    setState(buildResponseJsonToggleState, () => {
      if (stateRef.current.showResponseJson) {
        updateJsonPreview(true);
        return;
      }
      if (inst._jsonPreviewTimer) {
        clearTimeout(inst._jsonPreviewTimer);
        inst._jsonPreviewTimer = null;
      }
    });
  };

  const toggleShowSurveyJson = () => {
    setState(buildSurveyJsonToggleState);
  };

  const getCommentsOpen = (questionId: SurveyQuestionsLegacyValue, defaultOpen: SurveyQuestionsLegacyValue = false) => {
    const current: SurveyQuestionsLegacyValue = stateRef.current?.showComments?.[questionId];
    return typeof current === 'boolean' ? current : !!defaultOpen;
  };

  const toggleComments = (questionId: SurveyQuestionsLegacyValue, defaultOpen: SurveyQuestionsLegacyValue = false) => {
    const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
    if (typeof runtimeStrategy?.toggleComments === 'function') {
      return runtimeStrategy.toggleComments(engine, questionId, defaultOpen);
    }
    setState((prev: SurveyQuestionsLegacyValue) => buildCommentsToggleState(prev, questionId, defaultOpen));
  };

  return {
    copyJsonToClipboard,
    getCommentsOpen,
    getQuestionsJson,
    getResponseJson,
    getSurveyJson,
    getSurveyMetadataForJson,
    getSurveyResponse,
    handlePrimarySubmitClick,
    jsonTreeDisplay,
    prepareJsonAndHash,
    toggleComments,
    toggleShowQuestionsJson,
    toggleShowResponseJson,
    toggleShowSurveyJson,
    updateJsonPreview,
  };
};
