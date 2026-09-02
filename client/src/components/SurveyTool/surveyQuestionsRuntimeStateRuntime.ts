import type {
  SurveyQuestionsLegacyRecord,
  SurveyQuestionsLegacyValue,
  SurveyQuestionsProps,
  SurveyQuestionsState,
} from './surveyQuestionsTypes.js';
import type { SurveyQuestionsPendingStatsInput } from './surveyQuestionsInstanceFields';
import { resolveSurveyToolWorkerTargetSignature } from './surveyToolWorkerCacheIsolation.js';

export type SurveyQuestionsRuntimeStateRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsRuntimeStateRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsRuntimeStateRuntime => {
  const {
    buildCanDecryptContext,
    buildCanDecryptOtherResponsesState,
    buildQuestionIdScopeSignature,
    checkSponsoredAccess,
    engine,
    evaluateCanDecryptPreCheck,
    getPendingStatsSnapshotFromState,
    getSessionSlugHintFromProps,
    getSessionSlugPinnedFromProps,
    inst,
    normalizeSessionSlugValue,
    propsRef,
    resolveCanDecryptGateAccess,
    resolveEffectiveSlug,
    setState,
    stateRef,
    surveyLog,
    t,
  } = context;
  const {
    clearAutoDecryptSweepScheduling,
    getResponseGatePolicy,
    isResponseGateQuestionFlow,
    resolveEffectiveResponseGateConfig,
    resolveResponseGateSessionSlug,
  } = context;
  const invalidateCanDecryptOtherResponsesTracking = () => {
    inst._canDecryptOtherResponsesRunId += 1;
    inst._canDecryptOtherResponsesKey = '';
    inst._canDecryptOtherResponsesInFlight = null;
  };

  const resetBlockedAutoDecryptSweepInternals = () => {
    inst._autoDecQueue = [];
    inst._autoDecProcessing = false;
    inst._autoDecryptMaskedAttemptSignature = {};
    clearAutoDecryptSweepScheduling();
  };

  const resetVisibleAutoDecryptSweepState = () => {
    inst._autoDecryptVisibleSweepCache = null;
    resetBlockedAutoDecryptSweepInternals();
  };

  const startCanDecryptOtherResponsesRun = (snapshotKey: SurveyQuestionsLegacyValue = '') => {
    inst._canDecryptOtherResponsesKey = String(snapshotKey || '');
    const runId: SurveyQuestionsLegacyValue = (Number(inst._canDecryptOtherResponsesRunId) || 0) + 1;
    inst._canDecryptOtherResponsesRunId = runId;
    return runId;
  };

  const isCurrentCanDecryptOtherResponsesRun = (
    runId: SurveyQuestionsLegacyValue,
    snapshotKey: SurveyQuestionsLegacyValue = '',
  ) => inst._canDecryptOtherResponsesRunId === runId && inst._canDecryptOtherResponsesKey === String(snapshotKey || '');

  const clearCanDecryptOtherResponsesInFlightIfTracked = (tracked: SurveyQuestionsLegacyValue = null) => {
    if (inst._canDecryptOtherResponsesInFlight === tracked) {
      inst._canDecryptOtherResponsesInFlight = null;
    }
  };

  const refreshCanDecryptOtherResponses = async () => {
    try {
      const ctx: SurveyQuestionsLegacyValue = buildCanDecryptContext({
        getEffectiveDraftSlug: () => resolveResponseGateSessionSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(propsRef.current),
        resolveEffectiveResponseGateConfig: (slug: SurveyQuestionsLegacyValue) =>
          resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => getResponseGatePolicy(),
        account: propsRef.current?.account || '',
        loginComplete: propsRef.current?.loginComplete,
        singleQuestionMode: isResponseGateQuestionFlow() as SurveyQuestionsLegacyValue,
        isStandalone: propsRef.current.isStandalone as SurveyQuestionsLegacyValue,
        sbtCacheRevision: propsRef.current?.sbtCacheRevision || 0,
      });
      const { cfg, slug, snapshot }: SurveyQuestionsLegacyValue = ctx;
      const preCheck: SurveyQuestionsLegacyValue = evaluateCanDecryptPreCheck(snapshot);

      if (preCheck.earlyExit) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI.
        invalidateCanDecryptOtherResponsesTracking();
        if (
          stateRef.current.canDecryptOtherResponses ||
          stateRef.current.canDecryptOtherResponsesStatus !== preCheck.status
        ) {
          setState(buildCanDecryptOtherResponsesState({ status: preCheck.status }));
        }
        return false;
      }

      const snapshotKey: SurveyQuestionsLegacyValue = String(snapshot.key || '');
      if (snapshotKey === inst._canDecryptOtherResponsesKey && inst._canDecryptOtherResponsesInFlight) {
        return await inst._canDecryptOtherResponsesInFlight;
      }
      const runId: SurveyQuestionsLegacyValue = startCanDecryptOtherResponsesRun(snapshotKey);

      const run: SurveyQuestionsLegacyValue = (async () => {
        if (
          stateRef.current.canDecryptOtherResponsesStatus !== 'checking' &&
          isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)
        ) {
          // Clear any previously granted permission while we verify against the current gate/session/wallet.
          setState(buildCanDecryptOtherResponsesState({ status: 'checking' }));
        }
        const { canDecrypt, status }: SurveyQuestionsLegacyValue = await resolveCanDecryptGateAccess(
          {
            cfg,
            slug,
            account: snapshot.account,
            resourceKeysToCheck: snapshot.resourceKeysToCheck,
          },
          checkSponsoredAccess,
        );
        if (isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
          setState(buildCanDecryptOtherResponsesState({ canDecrypt, status }));
        }
        return canDecrypt;
      })();

      let tracked: SurveyQuestionsLegacyValue = null;
      tracked = run
        .catch(() => {
          if (isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
            setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
          }
          return false;
        })
        .finally(() => {
          // Only clear the pointer if we're still tracking engine exact promise.
          clearCanDecryptOtherResponsesInFlightIfTracked(tracked);
        });
      inst._canDecryptOtherResponsesInFlight = tracked;

      return await inst._canDecryptOtherResponsesInFlight;
    } catch (_: any) {
      try {
        setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
      } catch (e: any) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
      return false;
    }
  };

  const buildCanDecryptOtherResponsesSignature = () => {
    try {
      return buildCanDecryptContext({
        getEffectiveDraftSlug: () => resolveResponseGateSessionSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(propsRef.current),
        resolveEffectiveResponseGateConfig: (slug: SurveyQuestionsLegacyValue) =>
          resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => getResponseGatePolicy(),
        account: propsRef.current?.account || '',
        loginComplete: propsRef.current?.loginComplete,
        singleQuestionMode: isResponseGateQuestionFlow() as SurveyQuestionsLegacyValue,
        isStandalone: propsRef.current.isStandalone as SurveyQuestionsLegacyValue,
        sbtCacheRevision: propsRef.current?.sbtCacheRevision || 0,
      }).snapshot.signature;
    } catch (_: any) {
      return '';
    }
  };

  const maybeRefreshCanDecryptOtherResponses = () => {
    try {
      const sig: SurveyQuestionsLegacyValue = buildCanDecryptOtherResponsesSignature();
      if (sig === inst._canDecryptOtherResponsesSig) return;
      inst._canDecryptOtherResponsesSig = sig;
      refreshCanDecryptOtherResponses();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  const emitPendingStats = (stats: SurveyQuestionsPendingStatsInput) => {
    if (typeof propsRef.current.onPendingStatsChange !== 'function') return;
    const total = Number(stats?.total || 0);
    const encrypted = Number(stats?.encrypted || 0);
    const submittedSinceLastEdit = !!stateRef.current.submittedSinceLastEdit;
    const isSubmitting = !!stateRef.current.isSubmitting;
    const last = inst._lastPendingStats;
    if (
      last?.total === total &&
      last?.encrypted === encrypted &&
      !!last?.submittedSinceLastEdit === submittedSinceLastEdit &&
      !!last?.isSubmitting === isSubmitting
    )
      return;
    inst._lastPendingStats = { total, encrypted, submittedSinceLastEdit, isSubmitting };
    propsRef.current.onPendingStatsChange({ total, encrypted, submittedSinceLastEdit, isSubmitting });
  };

  const getPendingStatsSnapshot = () => getPendingStatsSnapshotFromState(stateRef.current);

  const getActiveSurveyIndex = (surveyIndexParam?: number | null) =>
    propsRef.current.isStandalone || propsRef.current.singleQuestionMode
      ? 0
      : (surveyIndexParam ?? propsRef.current.surveyIndex ?? 0);

  const resolveWorkerTargetForProps = (props: SurveyQuestionsProps) => {
    const sessionSlug = normalizeSessionSlugValue(getSessionSlugHintFromProps(props) || resolveEffectiveSlug(props));
    return resolveSurveyToolWorkerTargetSignature({
      sessionConfig: props.sessionConfig,
      sessionSlug,
    });
  };

  const didEditDiffInputsChange = (
    prevProps?: SurveyQuestionsProps | null,
    prevState?: SurveyQuestionsState | null,
  ) => {
    if (!prevProps || !prevState) return true;
    const prevSessionSlugHint = getSessionSlugHintFromProps(prevProps);
    const nextSessionSlugHint = getSessionSlugHintFromProps(propsRef.current);
    const prevSessionSlugPinned = getSessionSlugPinnedFromProps(prevProps);
    const nextSessionSlugPinned = getSessionSlugPinnedFromProps(propsRef.current);
    const prevWorkerTarget = resolveWorkerTargetForProps(prevProps);
    const nextWorkerTarget = resolveWorkerTargetForProps(propsRef.current);
    const prevStateQuestionPoolSig = buildQuestionIdScopeSignature(prevState.questionPool);
    const nextStateQuestionPoolSig = buildQuestionIdScopeSignature(stateRef.current.questionPool);
    const prevStatePileQuestionsSig = buildQuestionIdScopeSignature(prevState.pileQuestions);
    const nextStatePileQuestionsSig = buildQuestionIdScopeSignature(stateRef.current.pileQuestions);
    const prevPropsQuestionPoolSig = buildQuestionIdScopeSignature(prevProps.questionPool);
    const nextPropsQuestionPoolSig = buildQuestionIdScopeSignature(propsRef.current.questionPool);
    if (prevState.surveysResponseState !== stateRef.current.surveysResponseState) return true;
    if (prevState.editBaseline !== stateRef.current.editBaseline) return true;
    if (prevState.userAnswers !== stateRef.current.userAnswers) return true;
    if (prevStateQuestionPoolSig !== nextStateQuestionPoolSig) return true;
    if (prevStatePileQuestionsSig !== nextStatePileQuestionsSig) return true;
    if (prevPropsQuestionPoolSig !== nextPropsQuestionPoolSig) return true;
    if (prevProps.isStandalone !== propsRef.current.isStandalone) return true;
    if (prevProps.minifiedMode !== propsRef.current.minifiedMode) return true;
    if (prevProps.surveyIndex !== propsRef.current.surveyIndex) return true;
    if (prevProps.surveyId !== propsRef.current.surveyId) return true;
    if (prevProps.viewAddress !== propsRef.current.viewAddress) return true;
    if (prevProps.account !== propsRef.current.account) return true;
    if (prevProps.loginComplete !== propsRef.current.loginComplete) return true;
    if (prevProps.singleQuestionMode !== propsRef.current.singleQuestionMode) return true;
    if (prevProps.questionID !== propsRef.current.questionID) return true;
    if (prevProps.responderAddress !== propsRef.current.responderAddress) return true;
    if (prevProps.network?.id !== propsRef.current.network?.id) return true;
    if (prevProps.networkChainId !== propsRef.current.networkChainId) return true;
    if (prevSessionSlugHint !== nextSessionSlugHint) return true;
    if (prevSessionSlugPinned !== nextSessionSlugPinned) return true;
    if (prevWorkerTarget.key !== nextWorkerTarget.key || prevWorkerTarget.valid !== nextWorkerTarget.valid) return true;
    return false;
  };

  const invalidateDiffCaches = () => {
    inst._changedQidsAndFieldsCache = null;
    inst._pendingEditStatsCache = null;
  };
  return {
    invalidateCanDecryptOtherResponsesTracking,
    resetBlockedAutoDecryptSweepInternals,
    resetVisibleAutoDecryptSweepState,
    startCanDecryptOtherResponsesRun,
    isCurrentCanDecryptOtherResponsesRun,
    clearCanDecryptOtherResponsesInFlightIfTracked,
    refreshCanDecryptOtherResponses,
    buildCanDecryptOtherResponsesSignature,
    maybeRefreshCanDecryptOtherResponses,
    emitPendingStats,
    getPendingStatsSnapshot,
    getActiveSurveyIndex,
    resolveWorkerTargetForProps,
    didEditDiffInputsChange,
    invalidateDiffCaches,
  };
};
