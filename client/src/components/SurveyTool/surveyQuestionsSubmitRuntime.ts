import type {
  SurveyQuestionsLegacyRecord,
  SurveyQuestionsLegacyValue,
  SurveySubmitFailureStatePatch,
  SurveySubmitStartStatePatch,
  SurveySubmitSuccessStatePatch,
} from './surveyQuestionsTypes.js';
import type {
  SurveyQuestionsSubmitPendingStats,
  SurveyQuestionsSubmitStaleStatePatch,
  SurveyQuestionsSubmitStartControllerResult,
} from './surveyQuestionsSubmitController.js';
import { resolveSurveyToolWorkerTargetSignature } from './surveyToolWorkerCacheIsolation.js';

export type SurveyQuestionsSubmitRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsSubmitRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsSubmitRuntime => {
  const {
    buildCurrentStepState,
    buildFieldEncryptionWorkGroupsCore,
    buildSubmissionErrorState,
    buildSurveysResponseStatePatch,
    canUpdateStateForAsyncSnapshot,
    clearDraft,
    clearDraftFor,
    cryptoUtils,
    deepClone,
    ethers,
    getAnsweredQuestionsCount,
    getChangedQidsAndFields,
    getEffectiveRecipientsForField,
    getPendingEditStats,
    inst,
    invalidateDiffCaches,
    isQuestionLockedForResponse,
    maybeBlockSubmitUntilQuestionPoolComplete,
    normalizeQuestionIdKey,
    normalizeSessionSlugValue,
    prepareJsonAndHash,
    propsRef,
    resolveEffectiveSlug,
    resolveEffectiveResponseGateConfig,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveSessionChainId,
    resolveSubmitEffectiveDraftSlug,
    resolveSurveyQuestionsSubmittedResponseUrl,
    resolveSurveyQuestionsSubmitPendingStats,
    runSurveyQuestionsStaleSubmitController,
    runSurveyQuestionsSubmitFailureController,
    runSurveyQuestionsSubmitStartController,
    runSurveyQuestionsSubmitSuccessController,
    setState,
    stateRef,
    submitSurveyResponse,
    surveyLog,
    verifyEncryption,
    writeSubmittedResponsesToLocalCaches,
  } = context;
  const buildLitEncryptionOptionsForRecipients = (recipients: SurveyQuestionsLegacyValue = []) => {
    const list: SurveyQuestionsLegacyValue = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    if (!list.length) return undefined;

    const litHooks: SurveyQuestionsLegacyValue =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      return undefined;
    }

    const first: SurveyQuestionsLegacyValue = list[0] || {};
    if (!first.accessControlConditions || !first.chain) return undefined;

    const out: SurveyQuestionsLegacyValue = {
      saveKey: litHooks.saveKey,
      getKey: litHooks.getKey,
      accessControlConditions: first.accessControlConditions,
      chain: first.chain,
      recipients: list,
    };

    if (litHooks.litNetwork) out.litNetwork = litHooks.litNetwork;
    if (litHooks.connectTimeout) out.connectTimeout = litHooks.connectTimeout;
    if (litHooks.providerLike) out.providerLike = litHooks.providerLike;
    else if (propsRef.current.provider) out.providerLike = propsRef.current.provider;
    if (litHooks.resourceAbilityRequests) out.resourceAbilityRequests = litHooks.resourceAbilityRequests;

    return out;
  };

  const buildFieldEncryptionWorkGroups = (
    slice: SurveyQuestionsLegacyValue = {},
    changedQids: SurveyQuestionsLegacyValue = new Set(),
  ) => {
    return buildFieldEncryptionWorkGroupsCore(slice, changedQids, {
      isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
      resolveFieldEncryptionGateId: (
        f: SurveyQuestionsLegacyValue,
        q: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(f, q, fk),
      resolveFieldEncryptionAudience: (
        f: SurveyQuestionsLegacyValue,
        q: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(f, q, fk),
      getEffectiveRecipientsForField: ((opts: SurveyQuestionsLegacyValue) =>
        getEffectiveRecipientsForField(opts)) as SurveyQuestionsLegacyValue,
    });
  };

  const encryptFieldWorkGroups = async ({ workGroups = [], baseOpts = {} }: SurveyQuestionsLegacyValue = {}) => {
    const encState: SurveyQuestionsLegacyValue = { answers: {}, additionalComments: {} };
    const list: SurveyQuestionsLegacyValue = Array.isArray(workGroups) ? workGroups : [];

    for (const group of list) {
      const hasSliceWork: SurveyQuestionsLegacyValue =
        Object.keys(group?.slice?.answers || {}).length > 0 ||
        Object.keys(group?.slice?.additionalComments || {}).length > 0;
      if (!hasSliceWork || !Array.isArray(group?.qids) || group.qids.length === 0) {
        continue;
      }

      let partial: SurveyQuestionsLegacyValue = null;
      if (Array.isArray(group.recipients) && group.recipients.length > 0) {
        const lit: SurveyQuestionsLegacyValue = buildLitEncryptionOptionsForRecipients(group.recipients);
        if (!lit) {
          throw new Error('Lit hooks unavailable; cannot encrypt gated responses.');
        }

        partial = await (cryptoUtils as SurveyQuestionsLegacyValue).encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
          lit,
        });
      } else {
        partial = await (cryptoUtils as SurveyQuestionsLegacyValue).encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
        });
      }

      Object.assign(encState.answers, partial?.answers || {});
      Object.assign(encState.additionalComments, partial?.additionalComments || {});
    }

    return encState;
  };

  const buildSubmitContextSnapshot = () => {
    const singleQuestionMode: SurveyQuestionsLegacyValue = !!propsRef.current.singleQuestionMode;
    const isStandalone: SurveyQuestionsLegacyValue = !!propsRef.current.isStandalone;
    const surveyIndex: SurveyQuestionsLegacyValue =
      singleQuestionMode || isStandalone ? 0 : propsRef.current.surveyIndex || 0;
    const effectiveDraftSlug: SurveyQuestionsLegacyValue = resolveSubmitEffectiveDraftSlug({
      draftSlug: inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '',
      routeSlug: resolveEffectiveSlug(propsRef.current),
      normalizeSlug: normalizeSessionSlugValue,
    });
    const workerTarget: SurveyQuestionsLegacyValue = resolveSurveyToolWorkerTargetSignature({
      sessionConfig: resolveEffectiveResponseGateConfig(effectiveDraftSlug, propsRef.current),
      sessionSlug: effectiveDraftSlug,
    });

    return {
      props: propsRef.current,
      account: propsRef.current.account || '',
      provider: propsRef.current.provider,
      providerKind: String((cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(propsRef.current.provider) || '')
        .trim()
        .toLowerCase(),
      loginComplete: !!propsRef.current.loginComplete,
      singleQuestionMode,
      isStandalone,
      surveyIndex,
      surveyId: propsRef.current.surveyId || '',
      questionID: propsRef.current.questionID || '',
      effectiveDraftSlug,
      chainId: resolveSessionChainId(effectiveDraftSlug, null, propsRef.current),
      workerTargetKey: String(workerTarget?.key || ''),
      workerTargetValid: workerTarget?.valid !== false,
      mounted: !!inst._isMounted,
    };
  };

  const buildSubmitContextKey = (snapshot: SurveyQuestionsLegacyValue = null) => {
    const context: SurveyQuestionsLegacyValue = snapshot || buildSubmitContextSnapshot();
    return [
      String(context.account || '')
        .trim()
        .toLowerCase(),
      String(context.providerKind || '')
        .trim()
        .toLowerCase(),
      normalizeSessionSlugValue(context.effectiveDraftSlug || ''),
      String(context.chainId || '').trim(),
      context.singleQuestionMode ? 'single' : context.isStandalone ? 'standalone' : 'survey',
      String(context.surveyIndex ?? '').trim(),
      String(context.surveyId || '')
        .trim()
        .toLowerCase(),
      String(context.questionID || '')
        .trim()
        .toLowerCase(),
      ...(context.workerTargetKey ? [String(context.workerTargetKey).trim()] : []),
    ].join('|');
  };

  const isSubmitContextCurrent = (snapshot: SurveyQuestionsLegacyValue = null) =>
    !!snapshot &&
    snapshot.workerTargetValid !== false &&
    (!snapshot.mounted || inst._isMounted) &&
    (() => {
      const current = buildSubmitContextSnapshot();
      return current.workerTargetValid !== false && buildSubmitContextKey(snapshot) === buildSubmitContextKey(current);
    })();

  const startSubmitAttempt = (): number => {
    const attemptId = (Number(inst._submitAttemptSeq) || 0) + 1;
    inst._submitAttemptSeq = attemptId;
    inst._activeSubmitAttemptSeq = attemptId;
    return attemptId;
  };

  const finishSubmitAttempt = (attemptId: unknown = null): void => {
    if (Number(attemptId || 0) > 0 && inst._activeSubmitAttemptSeq === attemptId) {
      inst._activeSubmitAttemptSeq = 0;
    }
  };

  const handleStaleSubmitContext = (snapshot: SurveyQuestionsLegacyValue = null) => {
    runSurveyQuestionsStaleSubmitController({
      snapshot,
      ports: {
        clearSubmitGuard: () => {
          inst._submitGuard = false;
        },
        canUpdateSubmitState: (currentSnapshot: SurveyQuestionsLegacyValue) =>
          canUpdateStateForAsyncSnapshot(currentSnapshot),
        isSubmitAttemptActive: (
          _submitAttemptId: SurveyQuestionsLegacyValue,
          currentSnapshot: SurveyQuestionsLegacyValue,
        ) =>
          inst._activeSubmitAttemptSeq ===
          (currentSnapshot as { submitAttemptId?: unknown } | null | undefined)?.submitAttemptId,
        finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
        setSubmitStaleState: (statePatch: SurveyQuestionsSubmitStaleStatePatch) => setState(statePatch),
      },
    });
  };

  const encryptAndUpload = async () => {
    let submitContext: SurveyQuestionsLegacyValue = null;
    try {
      if (!propsRef.current.loginComplete) {
        inst._submitGuard = false;
        propsRef.current.toggleLoginModal(true);
        return;
      }

      const answeredCount: SurveyQuestionsLegacyValue = getAnsweredQuestionsCount();
      if (answeredCount === 0) {
        inst._submitGuard = false;
        setState(buildSubmissionErrorState('No responses to submit.'));
        if (inst._emptySubmitTimer) {
          clearTimeout(inst._emptySubmitTimer);
        }
        inst._emptySubmitTimer = setTimeout(() => {
          setState(buildSubmissionErrorState(''));
          inst._emptySubmitTimer = null;
        }, 2000);
        return;
      }

      if (maybeBlockSubmitUntilQuestionPoolComplete()) {
        inst._submitGuard = false;
        return;
      }

      submitContext = buildSubmitContextSnapshot();
      const startResult: SurveyQuestionsSubmitStartControllerResult = runSurveyQuestionsSubmitStartController({
        ports: {
          startSubmitAttempt: () => startSubmitAttempt(),
          setSubmitStartState: (statePatch: SurveySubmitStartStatePatch) => setState(statePatch),
        },
      });
      submitContext.submitAttemptId = startResult.submitAttemptId;

      const providerKind: SurveyQuestionsLegacyValue = (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(
        submitContext.provider,
      );

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex: SurveyQuestionsLegacyValue = submitContext.surveyIndex;
      const { changedQids }: SurveyQuestionsLegacyValue = getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex] || {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      };

      // Only encrypt when there are changed encrypted fields
      const pendingStats: SurveyQuestionsSubmitPendingStats = resolveSurveyQuestionsSubmitPendingStats({
        getPendingEditStats: typeof getPendingEditStats === 'function' ? () => getPendingEditStats() : undefined,
        fallbackTotal: stateRef.current.modifiedCount || 0,
        fallbackEncrypted: stateRef.current.hasEncryptedChanges ? 1 : 0,
      });
      const shouldEncrypt = Number(pendingStats.encrypted || 0) > 0 && changedQids.size > 0;

      if (shouldEncrypt) {
        const { groups: workGroups, missingRecipients }: SurveyQuestionsLegacyValue = buildFieldEncryptionWorkGroups(
          activeSlice,
          changedQids,
        );
        const hasWork: SurveyQuestionsLegacyValue = workGroups.some(
          (group: SurveyQuestionsLegacyValue) =>
            Object.keys(group?.slice?.answers || {}).length > 0 ||
            Object.keys(group?.slice?.additionalComments || {}).length > 0,
        );

        if (hasWork) {
          if (missingRecipients.length > 0) {
            throw new Error(`Missing Lit recipients for gated field(s): ${missingRecipients.join(', ')}`);
          }
          const surveyId: SurveyQuestionsLegacyValue = submitContext.singleQuestionMode
            ? ethers.constants.HashZero
            : submitContext.surveyId;
          const poolForCommit: SurveyQuestionsLegacyValue =
            Array.isArray(stateRef.current.questionPool) && stateRef.current.questionPool.length > 0
              ? stateRef.current.questionPool
              : Array.isArray(stateRef.current.pileQuestions)
                ? stateRef.current.pileQuestions
                : [];
          const encState: SurveyQuestionsLegacyValue = await encryptFieldWorkGroups({
            workGroups,
            baseOpts: {
              providerKind,
              provider: submitContext.provider,
              account: submitContext.account,
              chainId: submitContext.chainId,
              surveyId,
              questionPool: poolForCommit,
              hasher: stateRef.current.hasher,
            },
          });
          if (!isSubmitContextCurrent(submitContext)) {
            handleStaleSubmitContext(submitContext);
            return;
          }

          // Merge back (overrides hash with salted Keccak; carries envelope v1 + recipients)
          const newArr: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
          const base: SurveyQuestionsLegacyValue = {
            ...(newArr[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          };

          Object.keys(encState.answers || {}).forEach((qid: SurveyQuestionsLegacyValue) => {
            base.answers = { ...(base.answers || {}) };
            base.answers[qid] = { ...(base.answers[qid] || {}), ...(encState.answers[qid] || {}) };
          });
          Object.keys(encState.additionalComments || {}).forEach((qid: SurveyQuestionsLegacyValue) => {
            base.additionalComments = { ...(base.additionalComments || {}) };
            base.additionalComments[qid] = {
              ...(base.additionalComments[qid] || {}),
              ...(encState.additionalComments[qid] || {}),
            };
          });

          // Update local tracker AND React state
          activeSlice = base;
          newArr[surveyIndex] = base;
          setState(buildSurveysResponseStatePatch(newArr));

          // Verify against the freshly merged slice instead of immediately rereading
          // `stateRef.current`, which can still hold the pre-encryption draft until React
          // flushes the async class-state update.
          await verifyEncryption(changedQids, base);
        }
      }

      setState(buildCurrentStepState(2));

      // Await the receipt to ensure transaction is confirmed before optimistic update
      const receipt: SurveyQuestionsLegacyValue = await submitSurveyResponse(activeSlice, changedQids, submitContext);
      if (!isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return;
      }
      surveyLog.log('Submission receipt received', receipt?.blockNumber || 'unknown block');

      // Success path

      // 1. STOP any pending draft saves immediately
      if (inst._persistTimer) {
        clearTimeout(inst._persistTimer);
        inst._persistTimer = null;
      }

      // 2. Clear drafts for changed QIDs
      surveyLog.log('Clearing drafts for QIDs:', Array.from(changedQids));
      try {
        Array.from(changedQids).forEach(
          (qid: SurveyQuestionsLegacyValue) => clearDraftFor && clearDraftFor(String(qid)),
        );
      } catch (_: any) {
        if (propsRef.current.singleQuestionMode && propsRef.current.questionID) {
          clearDraftFor(propsRef.current.questionID.toLowerCase());
        } else {
          clearDraft();
        }
      }

      // 3. Compute responder URL for post-submit UI
      const submittedCacheSlug: SurveyQuestionsLegacyValue = normalizeSessionSlugValue(
        receipt?.__ceSubmissionGroupKey != null ? receipt.__ceSubmissionGroupKey : submitContext.effectiveDraftSlug,
      );
      const responseUrl = resolveSurveyQuestionsSubmittedResponseUrl({
        account: submitContext.account,
        currentPathname: window.location.pathname,
        isStandalone: submitContext.isStandalone,
        logWarn: (message: SurveyQuestionsLegacyValue, error: SurveyQuestionsLegacyValue) =>
          surveyLog.warn(message, error),
        questionID: submitContext.questionID,
        singleQuestionMode: submitContext.singleQuestionMode,
        submissionSlug: submittedCacheSlug,
        surveyId: submitContext.surveyId,
      });

      // 4. UPDATE BASELINE & OPTIMISTIC STATE
      surveyLog.log('Setting new Baseline');

      // Ensure surveysResponseState and editBaseline are mathematically identical
      // We clone activeSlice (which holds the final encrypted/plaintext state)
      const finalSlice: SurveyQuestionsLegacyValue = deepClone(activeSlice);
      const nextBaseline: SurveyQuestionsLegacyValue = deepClone(finalSlice);

      // Construct the explicit new state array to prevent any diff artifacts
      const nextSurveysResponseState: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
      nextSurveysResponseState[surveyIndex] = finalSlice;

      // Regression guard: the encrypted merge above is a class setState, so
      // build optimistic JSON from the known final slice instead of stateRef.current.
      const optimisticUserAnswers: SurveyQuestionsLegacyValue = prepareJsonAndHash(surveyIndex, undefined, finalSlice);

      // Check encryption status from the new baseline
      const hasEncrypted =
        Object.values(nextBaseline.answers || {}).some((a: SurveyQuestionsLegacyValue) => !!a.encrypted) ||
        Object.values(nextBaseline.additionalComments || {}).some((a: SurveyQuestionsLegacyValue) => !!a.encrypted);
      invalidateDiffCaches();
      inst._userAnswersSliceCache = { source: null, value: null };

      runSurveyQuestionsSubmitSuccessController({
        editBaseline: nextBaseline,
        hasEncrypted,
        responseUrl,
        submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
        submitAttemptId: submitContext.submitAttemptId,
        surveysResponseState: nextSurveysResponseState,
        userAnswers: optimisticUserAnswers,
        ports: {
          clearSubmitGuard: () => {
            inst._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
          setSubmitSuccessState: (statePatch: SurveySubmitSuccessStatePatch, afterStateApplied?: () => void) =>
            setState(statePatch, afterStateApplied),
        },
        afterStateApplied: async () => {
          try {
            if (!isSubmitContextCurrent(submitContext)) return;
            const cacheWriteResult: SurveyQuestionsLegacyValue = await writeSubmittedResponsesToLocalCaches(
              {
                receipt,
                questionResponses: receipt?.__ceQuestionResponses,
                surveyResponse: receipt?.__ceSurveyResponse,
                surveyId: receipt?.__ceSurveyId,
                submissionSlug: submittedCacheSlug,
              },
              submitContext,
            ).catch((error: any) => {
              surveyLog.warn('[SurveyQuestions] Local submit cache write-through failed:', error);
              return { questionCacheWritten: false, surveyCacheWritten: false };
            });
            if (!isSubmitContextCurrent(submitContext)) return;

            // Worker write-through updates IndexedDB directly, so there is no chain event to advance
            // MainSite's response nonce. Rehydrate once to publish that revision to live Results views.
            const shouldRefreshQuestionResponses =
              !cacheWriteResult?.questionCacheWritten || !!submitContext.workerTargetKey;
            if (
              shouldRefreshQuestionResponses &&
              typeof propsRef.current.refreshQuestionResponses === 'function'
            ) {
              const ids: SurveyQuestionsLegacyValue = Array.from(changedQids)
                .map((id: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(id))
                .filter(Boolean);
              if (ids.length > 0 && isSubmitContextCurrent(submitContext)) {
                await propsRef.current.refreshQuestionResponses(ids, {
                  slug: submittedCacheSlug,
                  responder: submitContext.account || '',
                });
              }
            }
            if (
              !cacheWriteResult?.surveyCacheWritten &&
              !submitContext.singleQuestionMode &&
              typeof propsRef.current.refreshSurveyResponsesByID === 'function' &&
              submitContext.surveyId
            ) {
              if (isSubmitContextCurrent(submitContext)) {
                await propsRef.current.refreshSurveyResponsesByID(submitContext.surveyId);
              }
            }
          } catch (e: any) {
            surveyLog.warn('SurveyTool: callback', e);
          }
        },
      });
    } catch (error: any) {
      surveyLog.error('Failed to submit survey:', error);
      if (submitContext && !isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return;
      }
      runSurveyQuestionsSubmitFailureController({
        error,
        submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
        submitAttemptId: submitContext?.submitAttemptId,
        ports: {
          clearSubmitGuard: () => {
            inst._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
          setSubmitFailureState: (statePatch: SurveySubmitFailureStatePatch) => setState(statePatch),
        },
      });
    }
  };
  return {
    buildLitEncryptionOptionsForRecipients,
    buildFieldEncryptionWorkGroups,
    encryptFieldWorkGroups,
    buildSubmitContextSnapshot,
    buildSubmitContextKey,
    isSubmitContextCurrent,
    startSubmitAttempt,
    finishSubmitAttempt,
    handleStaleSubmitContext,
    encryptAndUpload,
  };
};
