import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';
import type { SurveyQuestionsCacheQuestion, SurveyQuestionsRecord } from './surveyQuestionsInstanceFields';

export type SurveyQuestionsDataRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsDataRuntime = (context: SurveyQuestionsLegacyRecord): SurveyQuestionsDataRuntime => {
  const {
    _applyResponseHydrationListToSlice,
    areQuestionPayloadsEquivalent,
    buildClearedSurveyQuestionPoolState,
    publishSurveyQuestionPoolIfCurrent,
    buildMergedSurveyResponseState,
    buildQuestionIdScopeSignature,
    buildResponseHydrationInvalidatedState,
    buildSingleQuestionEncryptedMetadataPlaceholder,
    buildSingleQuestionPlaceholderHydrationState,
    buildSingleQuestionPoolFallbackState,
    buildSingleQuestionPreservedPoolState,
    buildSingleQuestionReadyHydrationState,
    buildSingleQuestionRetryLoadingState,
    buildSingleQuestionSeededHydrationState,
    buildSingleQuestionSourceRestoreContextPlan,
    buildSurveyResponseFetchLoadingState,
    buildUserSurveyResponseFoundState,
    buildUserSurveyResponseMissingState,
    buildViewedSurveyNoResponseState,
    buildViewedSurveyResponseState,
    bumpSurveyPerfCounter,
    canUseRecentQuestionPayloadForAccount,
    clearSingleQuestionBootstrapRetry,
    engine,
    ensureQuestionsNet,
    ensureSurveysNet,
    executeOwnSingleQuestionResponseBootstrap,
    executeSurveySingleQuestionPrefill,
    executeSurveyStartFresh,
    executeViewedSingleQuestionResponseBootstrap,
    fetchSingleQuestionMetadataCandidates,
    getBlockedQuestionIdsSet,
    getTemporaryDemoSessionQuestionFixtures,
    inst,
    invalidateResponseHydrationRuns,
    isMaskedQuestionPayload,
    isPendingQuestionMetadataPlaceholder,
    mergeDecryptedViewedResponse,
    normalizeQuestionIdKey,
    normalizeSessionSlugValue,
    normalizeSingleQuestionMetadataForCache,
    pickBetterQuestionPayload,
    propsRef,
    readFreshSingleQuestionCachedResponderResponse,
    readQuestionsCache,
    readQuestionsCacheAsync,
    readRecentQuestionPayload,
    readSingleQuestionCachedResponderResponse,
    readSurveysCache,
    resolveEffectiveSlug,
    resolveQuestionBootstrapContext,
    resolveQuestionReadCacheContext,
    resolveSingleQuestionCacheBootstrap,
    resolveSingleQuestionCacheBootstrapFlowPlan,
    resolveSingleQuestionCacheBootstrapStopHandlingPlan,
    resolveSingleQuestionCacheState,
    resolveSingleQuestionMetadataBootstrap,
    resolveSlugForIds,
    scheduleSingleQuestionBootstrapRetry,
    setResponseHydrationState,
    setState,
    state,
    stateRef,
    surveyLog,
    surveyQuestionReadsPort,
    t,
    updateCacheAtomic,
    updateSingleQuestionDebug,
    updateSubmittedSinceLastEdit,
    writeQuestionsCache,
    writeSingleQuestionResponseToCache,
    writeSurveysCache,
  } = context;
  const {
    areResponsesConsistent,
    buildAutomaticQuestionMetadataFetchOptions,
    buildEmptyResponseFieldState,
    buildSliceFromUserAnswers,
    clearDraftFor,
    deepClone,
    getCurrentRenderedQuestionIds,
    getQuestionFetchCandidateSlugs,
    getSurveyResponse,
    normalizeSingleQuestionViewedResponse,
    persistDraftSafely,
    prefillSurveyResponses,
    recalculateEditStats,
    rehydrateDraftForRenderedIds,
    rehydrateLocalCacheAnswersForRenderedIds,
    updateJsonPreview,
  } = context;

  const getLatestQuestionResponse = async (
    responder: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    networkID: SurveyQuestionsLegacyValue,
    questionsCache: SurveyQuestionsLegacyValue,
  ) => {
    const slug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug();
    const strNet: SurveyQuestionsLegacyValue = String(networkID || '');

    let latest: SurveyQuestionsLegacyValue = null;
    try {
      latest = await surveyQuestionReadsPort.getResponse(propsRef.current.provider, responder, questionId, slug);
      if (latest) {
        const addrLower: SurveyQuestionsLegacyValue = String(responder || '').toLowerCase();

        // Re-read after await to avoid overwriting concurrent cache writes.
        let freshCache: SurveyQuestionsLegacyValue = ensureQuestionsNet(await readQuestionsCacheAsync(slug), strNet);

        // ensure scaffolding
        freshCache[strNet] = freshCache[strNet] || {};
        freshCache[strNet].questionResponses = freshCache[strNet].questionResponses || {};
        freshCache[strNet].questionResponses[questionId] = freshCache[strNet].questionResponses[questionId] || {};
        freshCache[strNet].questionResponsesMeta = freshCache[strNet].questionResponsesMeta || {};
        freshCache[strNet].questionResponsesMeta[questionId] =
          freshCache[strNet].questionResponsesMeta[questionId] || {};

        // Recency guard (only replace if strictly newer by (bn, li))
        const prev: SurveyQuestionsLegacyValue = freshCache[strNet].questionResponsesMeta[questionId][addrLower] || {
          bn: 0,
          li: 0,
        };
        const bn: SurveyQuestionsLegacyValue = latest?.blockNumber ?? 0;
        const li: SurveyQuestionsLegacyValue = latest?.logIndex ?? 0;
        const isStale: SurveyQuestionsLegacyValue = bn < prev.bn || (bn === prev.bn && li <= prev.li);
        if (!isStale) {
          freshCache[strNet].questionResponses[questionId][addrLower] = latest;
          freshCache[strNet].questionResponsesMeta[questionId][addrLower] = { bn, li };
          await writeQuestionsCache(slug, freshCache);
        }
        return latest;
      }
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }

    return latest;
  };

  const getLatestSurveyResponse = async (
    responder: SurveyQuestionsLegacyValue,
    surveyId: SurveyQuestionsLegacyValue,
  ) => {
    try {
      const latest: SurveyQuestionsLegacyValue = await getSurveyResponse(responder, surveyId);
      return latest || null;
    } catch (e: any) {
      return null;
    }
  };

  async function fetchQuestionPool() {
    if (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) return;
    const runId: SurveyQuestionsLegacyValue = (Number(inst._questionPoolHydrationRunId) || 0) + 1;
    inst._questionPoolHydrationRunId = runId;
    const isStaleQuestionPoolRun: SurveyQuestionsLegacyValue = () =>
      !inst._isMounted || inst._questionPoolHydrationRunId !== runId;
    const setQuestionPoolState: SurveyQuestionsLegacyValue = (...args: SurveyQuestionsLegacyValue[]) => {
      if (!isStaleQuestionPoolRun()) {
        setState(...args);
      }
    };
    if (!propsRef.current.surveyId) {
      surveyLog.warn('SurveyQuestions: fetchQuestionPool – no surveyID supplied');
      setQuestionPoolState(buildClearedSurveyQuestionPoolState());
      return;
    }

    // Prefer ID-aware resolver for /survey/:id routes (no /session/:slug)
    const slug: SurveyQuestionsLegacyValue = propsRef.current.surveyId
      ? resolveSlugForIds({
          surveyId: propsRef.current.surveyId,
          props: propsRef.current,
          network: propsRef.current.network,
        })
      : resolveEffectiveSlug(propsRef.current);
    const questionReadContext: SurveyQuestionsLegacyValue = resolveQuestionReadCacheContext(propsRef.current, slug);
    let effectiveSlug: SurveyQuestionsLegacyValue = questionReadContext.sessionSlug || slug;
    const netIdStr: SurveyQuestionsLegacyValue = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error('SurveyQuestions: fetchQuestionPool – network.id undefined');
      setQuestionPoolState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const surveyIdLower: SurveyQuestionsLegacyValue = propsRef.current.surveyId.toLowerCase();

    // surveys cache via safe reader (already purges)
    let surveysCache: SurveyQuestionsLegacyValue = readSurveysCache(effectiveSlug);
    if (!surveysCache || typeof surveysCache !== 'object') surveysCache = {};
    const surveysNet: SurveyQuestionsLegacyValue = surveysCache[netIdStr] || {
      surveysLatestBlock: 0,
      surveys: {},
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };
    let surveyDataFromCache: SurveyQuestionsLegacyValue = surveysNet.surveys?.[surveyIdLower];

    let surveyData: SurveyQuestionsLegacyValue = null;
    if (
      propsRef.current.surveys &&
      propsRef.current.surveyIndex !== null &&
      propsRef.current.surveys[propsRef.current.surveyIndex]
    ) {
      const surveyFromProp: SurveyQuestionsLegacyValue = propsRef.current.surveys[propsRef.current.surveyIndex];
      if (surveyFromProp.id && surveyFromProp.id.toLowerCase() === surveyIdLower) {
        surveyData = surveyFromProp;
      }
    }
    if (!surveyData) {
      surveyData = surveyDataFromCache;
    }

    // Temporary demo-1 compatibility: render fixture questions synchronously while
    // the durable Cloudflare-backed demo session is still pending.
    const temporaryDemoSessionConfig = propsRef.current.sessionConfig || {};
    const temporaryDemoSlugCandidates = [
      effectiveSlug,
      questionReadContext.sessionSlug,
      slug,
      propsRef.current.sessionSlug,
      propsRef.current.activeSessionSlug,
    ];
    let temporaryDemoFixtureSlug: SurveyQuestionsLegacyValue = '';
    let temporaryDemoFixtureQuestions: SurveyQuestionsLegacyValue[] = [];
    for (const candidateSlug of temporaryDemoSlugCandidates) {
      const candidateQuestions = getTemporaryDemoSessionQuestionFixtures(candidateSlug, temporaryDemoSessionConfig);
      if (!candidateQuestions.length) continue;
      temporaryDemoFixtureSlug = normalizeSessionSlugValue(candidateSlug);
      temporaryDemoFixtureQuestions = candidateQuestions;
      break;
    }
    const temporaryDemoQuestionIds = temporaryDemoFixtureQuestions
      .map((question) => normalizeQuestionIdKey(question?.id))
      .filter(Boolean);
    const shouldUseTemporaryDemoQuestionPool = temporaryDemoQuestionIds.length > 0;
    if (shouldUseTemporaryDemoQuestionPool) {
      if (temporaryDemoFixtureSlug) effectiveSlug = temporaryDemoFixtureSlug;
      const currentQuestionsCache = ensureQuestionsNet(
        readQuestionsCache(effectiveSlug) || {},
        netIdStr,
      ) as SurveyQuestionsRecord;
      const questionsNet = currentQuestionsCache[netIdStr] as SurveyQuestionsRecord;
      if (!questionsNet.questions || typeof questionsNet.questions !== 'object') questionsNet.questions = {};
      const questionMap = questionsNet.questions as SurveyQuestionsRecord;
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid) return;
        questionMap[qid] = {
          ...question,
          id: qid,
        };
        if (questionsNet.pendingQuestionMetadata && typeof questionsNet.pendingQuestionMetadata === 'object') {
          const pendingQuestionMetadata = questionsNet.pendingQuestionMetadata as SurveyQuestionsRecord;
          delete pendingQuestionMetadata[qid];
        }
      });
      writeQuestionsCache(effectiveSlug, currentQuestionsCache);

      surveyData = {
        ...(surveyData || surveyDataFromCache || {}),
        id: surveyIdLower,
        surveyID: surveyIdLower,
        title: surveyData?.title || surveyDataFromCache?.title || propsRef.current.surveyTitle || 'Demo Session',
        sessionName:
          surveyData?.sessionName || surveyDataFromCache?.sessionName || propsRef.current.sessionName || effectiveSlug,
        questionIDs: temporaryDemoQuestionIds,
        temporaryDemoSeed: true,
      };

      const currentSurveysCache = ensureSurveysNet(readSurveysCache(effectiveSlug) || {}, netIdStr);
      if (!currentSurveysCache[netIdStr].surveys || typeof currentSurveysCache[netIdStr].surveys !== 'object') {
        currentSurveysCache[netIdStr].surveys = {};
      }
      currentSurveysCache[netIdStr].surveys[surveyIdLower] = surveyData;
      writeSurveysCache(effectiveSlug, currentSurveysCache);
    }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      try {
        surveyData = await surveyQuestionReadsPort.getSurveyDataById(
          propsRef.current.provider,
          surveyIdLower,
          effectiveSlug,
        );
        if (isStaleQuestionPoolRun()) return;
        if (surveyData) {
          if (!Array.isArray(surveyData.questionIDs)) surveyData.questionIDs = [];
          surveyData.surveyID = surveyIdLower;
          surveyData.id = surveyIdLower;

          let currentGlobalSurveysCache: SurveyQuestionsLegacyValue = readSurveysCache(effectiveSlug);
          if (!currentGlobalSurveysCache || typeof currentGlobalSurveysCache !== 'object') {
            currentGlobalSurveysCache = {};
          }
          if (!currentGlobalSurveysCache[netIdStr]) {
            currentGlobalSurveysCache[netIdStr] = {
              surveys: {},
              surveysLatestBlock: 0,
              surveyResponses: {},
              surveyResponsesLatestBlock: {},
            };
          }
          if (!currentGlobalSurveysCache[netIdStr].surveys) {
            currentGlobalSurveysCache[netIdStr].surveys = {};
          }
          currentGlobalSurveysCache[netIdStr].surveys[surveyIdLower] = surveyData;
          await writeSurveysCache(effectiveSlug, currentGlobalSurveysCache);
        }
      } catch (e: any) {
        surveyLog.error('SurveyQuestions: failed to fetch survey from chain:', e);
        surveyData = null;
      }
    }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      surveyLog.warn(`SurveyQuestions: survey ${surveyIdLower} still has no questionIDs – aborting pool build`);
      setQuestionPoolState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const blockedQuestionIds: SurveyQuestionsLegacyValue = getBlockedQuestionIdsSet(effectiveSlug);
    const expectedQuestionIds: SurveyQuestionsLegacyValue = surveyData.questionIDs
      .map((qid: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(qid))
      .filter((qid: SurveyQuestionsLegacyValue) => qid && !blockedQuestionIds.has(qid));

    if (shouldUseTemporaryDemoQuestionPool) {
      const fixtureQuestionById = new Map();
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid || fixtureQuestionById.has(qid)) return;
        fixtureQuestionById.set(qid, { ...question, id: qid });
      });
      const questionPool = expectedQuestionIds
        .map((qid: SurveyQuestionsLegacyValue) => fixtureQuestionById.get(qid))
        .filter(Boolean);
      setQuestionPoolState({
        questionPool,
        questionPoolExpectedIds: expectedQuestionIds,
        questionPoolPendingIds: expectedQuestionIds.filter(
          (qid: SurveyQuestionsLegacyValue) => !fixtureQuestionById.has(qid),
        ),
      });
      return;
    }

    let lastPublishedQuestionPoolSnapshotSig = '';
    const publishQuestionPoolFromCache = ({ warnMissing = false } = {}) => {
      return publishSurveyQuestionPoolIfCurrent({
        isStaleRun: isStaleQuestionPoolRun,
        warnMissing,
        publishQuestionPool: ({ warnMissing: shouldWarnMissing }: SurveyQuestionsLegacyValue = {}) => {
          const questionsCacheFromStorage = readQuestionsCache(effectiveSlug) || {};
          const questionsNet = questionsCacheFromStorage[netIdStr] || {
            questionsLatestBlock: 0,
            questions: {},
            questionResponses: {},
            questionResponsesLatestBlock: 0,
          };
          const networkQuestions = (questionsNet.questions || {}) as SurveyQuestionsRecord;

          const questionPool = expectedQuestionIds
            .map((qid: string) => {
              const qData = networkQuestions[qid] as SurveyQuestionsCacheQuestion | undefined;
              if (isPendingQuestionMetadataPlaceholder(qData)) return null;
              if (qData) return { ...qData, id: qData.id.toLowerCase() };
              if (shouldWarnMissing) {
                surveyLog.warn(
                  `SurveyQuestions: Question data for ID ${qid} not found in cache after ensureQuestionCached.`,
                );
              }
              return null;
            })
            .filter(Boolean);
          const loadedQuestionIds = new Set(
            questionPool
              .map((question: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(question?.id))
              .filter(Boolean),
          );
          const pendingQuestionIds = expectedQuestionIds.filter((qid: string) => !loadedQuestionIds.has(qid));

          const nextQuestionPoolSig = buildQuestionIdScopeSignature(questionPool);
          const snapshotSig = JSON.stringify({
            expectedQuestionIds,
            pendingQuestionIds,
            questionPool,
          });
          if (snapshotSig === lastPublishedQuestionPoolSnapshotSig) return;
          lastPublishedQuestionPoolSnapshotSig = snapshotSig;
          setQuestionPoolState((prev: SurveyQuestionsLegacyValue) => {
            const prevQuestionPool = Array.isArray(prev?.questionPool) ? prev.questionPool : [];
            const prevExpectedQuestionIds = Array.isArray(prev?.questionPoolExpectedIds)
              ? prev.questionPoolExpectedIds
              : [];
            const prevPendingQuestionIds = Array.isArray(prev?.questionPoolPendingIds)
              ? prev.questionPoolPendingIds
              : [];
            const prevQuestionPoolById = new Map();
            prevQuestionPool.forEach((entry: SurveyQuestionsLegacyValue) => {
              const key = normalizeQuestionIdKey(entry?.id);
              if (!key || prevQuestionPoolById.has(key)) return;
              prevQuestionPoolById.set(key, entry);
            });

            const mergedQuestionPool = questionPool.map((entry: SurveyQuestionsLegacyValue) => {
              const key = normalizeQuestionIdKey(entry?.id);
              if (!key) return entry;
              const existing = prevQuestionPoolById.get(key);
              if (!existing) return entry;
              const picked = pickBetterQuestionPayload(existing, entry) || entry;
              if (picked === existing) return existing;
              const normalized = { ...picked, id: key };
              return areQuestionPayloadsEquivalent(existing, normalized) ? existing : normalized;
            });

            const prevQuestionPoolSig = buildQuestionIdScopeSignature(prevQuestionPool);
            const expectedIdsUnchanged =
              prevExpectedQuestionIds.length === expectedQuestionIds.length &&
              prevExpectedQuestionIds.every(
                (qid: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) =>
                  qid === expectedQuestionIds[index],
              );
            const pendingIdsUnchanged =
              prevPendingQuestionIds.length === pendingQuestionIds.length &&
              prevPendingQuestionIds.every(
                (qid: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) =>
                  qid === pendingQuestionIds[index],
              );
            if (prevQuestionPoolSig === nextQuestionPoolSig) {
              const hasSemanticChange =
                prevQuestionPool.length !== mergedQuestionPool.length ||
                prevQuestionPool.some(
                  (entry: SurveyQuestionsLegacyValue, idx: SurveyQuestionsLegacyValue) =>
                    entry !== mergedQuestionPool[idx],
                );
              if (!hasSemanticChange && expectedIdsUnchanged && pendingIdsUnchanged) {
                bumpSurveyPerfCounter('noopSkipCount');
                return null;
              }
            }
            return {
              questionPool: mergedQuestionPool,
              questionPoolExpectedIds: expectedQuestionIds,
              questionPoolPendingIds: pendingQuestionIds,
            };
          });
        },
      });
    };

    publishQuestionPoolFromCache();

    // Pass sessionName context to ensureQuestionCached so it knows where to look.
    // Publish after each settled hydration so a survey can render as soon as the
    // first question metadata lands instead of waiting for the full batch.
    const cacheHydrationResults: SurveyQuestionsLegacyValue = await Promise.allSettled(
      surveyData.questionIDs.map(async (qid: SurveyQuestionsLegacyValue) => {
        try {
          await propsRef.current.ensureQuestionCached(qid, { sessionName: surveyData.sessionName });
          return qid;
        } finally {
          publishQuestionPoolFromCache();
        }
      }),
    );
    const failedQuestionHydrations: SurveyQuestionsLegacyValue = cacheHydrationResults.filter(
      (result: SurveyQuestionsLegacyValue) => result.status === 'rejected',
    );
    if (failedQuestionHydrations.length > 0) {
      surveyLog.warn(
        `SurveyQuestions: ${failedQuestionHydrations.length} question cache hydration request(s) failed for survey ${surveyIdLower}.`,
        failedQuestionHydrations.map(
          (result: SurveyQuestionsLegacyValue) => result.reason?.message || result.reason || 'unknown error',
        ),
      );
    }
    publishQuestionPoolFromCache({ warnMissing: true });
  }

  const loadQuestionFromCache = async (questionId: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
    const questionReadContext: SurveyQuestionsLegacyValue = resolveQuestionReadCacheContext(propsRef.current, slug);
    const effectiveSlug: SurveyQuestionsLegacyValue = questionReadContext.sessionSlug || slug;
    const netIdStr: SurveyQuestionsLegacyValue = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error('SurveyQuestions: Network ID undefined in loadQuestionFromCache');
      return null;
    }
    let questionsCache: SurveyQuestionsLegacyValue = readQuestionsCache(effectiveSlug) || {};
    if (!questionsCache[netIdStr] || !questionsCache[netIdStr].questions) return null;
    const qIdLower: SurveyQuestionsLegacyValue = questionId.toLowerCase();
    return questionsCache[netIdStr].questions[qIdLower] || null;
  };

  const mergeSurveyResponseState = (
    currentState: SurveyQuestionsLegacyValue,
    newQuestionPool: SurveyQuestionsLegacyValue,
    surveyIndex: SurveyQuestionsLegacyValue = 0,
  ) => {
    return buildMergedSurveyResponseState({
      currentState,
      newQuestionPool,
      renderedQuestionIds: getCurrentRenderedQuestionIds(),
      surveyIndex,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
    });
  };

  async function fetchSurveyResponse() {
    if (!inst._isMounted) return;
    const runId: SurveyQuestionsLegacyValue = Number(inst._fetchSurveyResponseRunId || 0) + 1;
    inst._fetchSurveyResponseRunId = runId;
    const isStale: SurveyQuestionsLegacyValue = () => !inst._isMounted || inst._fetchSurveyResponseRunId !== runId;
    const safe: SurveyQuestionsLegacyValue = (...args: SurveyQuestionsLegacyValue[]) => {
      if (!isStale()) (setResponseHydrationState as SurveyQuestionsLegacyValue)(...args);
    };

    safe(buildSurveyResponseFetchLoadingState());

    // 1. View Mode (Address lookup) - Unaffected by submission state
    if (propsRef.current.displayAnswerMode && propsRef.current.viewAddress) {
      try {
        const viewAnswers: SurveyQuestionsLegacyValue = await getLatestSurveyResponse(
          propsRef.current.viewAddress,
          propsRef.current.surveyId,
        );
        if (isStale()) return;
        if (viewAnswers) {
          safe((prev: SurveyQuestionsLegacyValue) =>
            buildViewedSurveyResponseState(
              prev,
              viewAnswers,
              mergeDecryptedViewedResponse as SurveyQuestionsLegacyValue,
            ),
          );
        } else {
          safe(buildViewedSurveyNoResponseState());
        }
      } catch (error: any) {
        surveyLog.error('Error fetching survey response:', error);
        if (isStale()) return;
        safe(buildViewedSurveyNoResponseState());
      }
    } else {
      safe(buildViewedSurveyNoResponseState(false));
    }

    // 2. User Account Mode
    if (propsRef.current.account) {
      try {
        const userAnswers: SurveyQuestionsLegacyValue = await getLatestSurveyResponse(
          propsRef.current.account,
          propsRef.current.surveyId,
        );
        if (isStale()) return;

        // Consistency check logic
        if (stateRef.current.submissionComplete) {
          const surveyIndex: SurveyQuestionsLegacyValue =
            propsRef.current.isStandalone || propsRef.current.singleQuestionMode
              ? 0
              : propsRef.current.surveyIndex || 0;
          surveyLog.log('Comparing incoming chain data vs optimistic baseline');

          // Only switch off optimistic mode if chain data matches our submitted baseline
          if (userAnswers && areResponsesConsistent(userAnswers, surveyIndex)) {
            surveyLog.log('Result: New. Chain data consistent with submission. Exiting optimistic mode.');
            const hasEncrypted: SurveyQuestionsLegacyValue = userAnswers.responses?.some(
              (r: SurveyQuestionsLegacyValue) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion,
            );
            safe(
              buildUserSurveyResponseFoundState({
                hasEncrypted,
                resetSubmissionComplete: true,
                userAnswers,
              }),
            );
            // We do NOT call prefillSurveyResponses here to avoid rebuilding baseline unnecessarily
          } else {
            // Chain is stale or null. Keep optimistic state.
            surveyLog.log('Result: Stale. Chain data older than optimistic baseline. Ignoring fetch.');
          }
        }
        // Normal Path (Not in optimistic mode)
        else if (userAnswers) {
          const hasEncrypted: SurveyQuestionsLegacyValue = userAnswers.responses?.some(
            (r: SurveyQuestionsLegacyValue) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion,
          );
          safe(
            buildUserSurveyResponseFoundState({
              hasEncrypted,
              userAnswers,
            }),
          );
          if (!isStale()) {
            prefillSurveyResponses(userAnswers, { responseHydrationOwned: true });
          }
        } else {
          // Only reset to "no response" if we aren't holding an optimistic submission
          if (!stateRef.current.submissionComplete) {
            safe(buildUserSurveyResponseMissingState());
          }
        }
      } catch (error: any) {
        surveyLog.error("Error fetching user's survey response:", error);
        if (isStale()) return;
        // On error, if we are optimistic, we just stay optimistic.
        if (!stateRef.current.submissionComplete) {
          safe(buildUserSurveyResponseMissingState());
        }
      }
    }

    safe(buildResponseHydrationInvalidatedState());
  }

  const prefillSingleQuestionResponse = (userAnswer: SurveyQuestionsLegacyValue) => {
    const questionId: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(propsRef.current.questionID);

    executeSurveySingleQuestionPrefill({
      state: stateRef.current,
      questionId,
      userAnswer,
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      applyResponseHydrationListToSlice: inst._applyResponseHydrationListToSlice,
      setState: setResponseHydrationState.bind(engine),
      updateJsonPreview: updateJsonPreview,
      recalculateEditStats: recalculateEditStats,
    });
  };

  const parseAnswerValue = (value: SurveyQuestionsLegacyValue) => {
    try {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        return JSON.parse(value);
      }
    } catch (e: any) {
      return value;
    }
    return value;
  };

  const handleStartFresh = () => {
    invalidateResponseHydrationRuns();
    executeSurveyStartFresh({
      props: propsRef.current,
      state: stateRef.current,
      getRenderedQuestionIds: getCurrentRenderedQuestionIds,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      cloneValue: deepClone,
      setState: setState.bind(engine),
      clearDraftFor: clearDraftFor,
      recalculateEditStats: recalculateEditStats,
      persistDraftSafely: persistDraftSafely,
      updateSubmittedSinceLastEdit,
    });
  };

  async function fetchSingleQuestionData(opts: SurveyQuestionsLegacyValue = {}) {
    const runId: SurveyQuestionsLegacyValue = (Number(inst._fetchSingleQuestionRunId) || 0) + 1;
    inst._fetchSingleQuestionRunId = runId;
    const isStaleRun: SurveyQuestionsLegacyValue = () => !inst._isMounted || inst._fetchSingleQuestionRunId !== runId;
    const safeSetState: SurveyQuestionsLegacyValue = (...args: SurveyQuestionsLegacyValue[]) => {
      if (!isStaleRun()) (setResponseHydrationState as SurveyQuestionsLegacyValue)(...args);
    };
    const bootstrapRetryAttempt: SurveyQuestionsLegacyValue = Number(opts?.bootstrapRetryAttempt || 0);
    const configuredFetchTimeoutMs: SurveyQuestionsLegacyValue = Number(opts?.questionFetchTimeoutMs);
    const fetchTimeoutMs: SurveyQuestionsLegacyValue =
      Number.isFinite(configuredFetchTimeoutMs) && configuredFetchTimeoutMs > 0
        ? Math.max(3000, configuredFetchTimeoutMs)
        : 8000;
    const configuredFetchRecoveryMs: SurveyQuestionsLegacyValue = Number(opts?.questionFetchTimeoutRecoveryMs);
    const fetchTimeoutRecoveryMs: SurveyQuestionsLegacyValue =
      Number.isFinite(configuredFetchRecoveryMs) && configuredFetchRecoveryMs > 0
        ? Math.max(fetchTimeoutMs, configuredFetchRecoveryMs)
        : Math.max(fetchTimeoutMs, 20000);
    const maxCandidateSlugs: SurveyQuestionsLegacyValue = Math.max(2, Number(opts?.maxCandidateSlugs || 8));

    const sourceContextPlan: SurveyQuestionsLegacyValue = buildSingleQuestionSourceRestoreContextPlan({
      bootstrapRetryAttempt,
      getQuestionFetchCandidateSlugs: getQuestionFetchCandidateSlugs,
      maxCandidateSlugs,
      pendingRetrySig: inst._singleQuestionBootstrapRetrySig,
      props: propsRef.current,
      questionPool: stateRef.current.questionPool,
      runId,
    });
    if (sourceContextPlan.status === 'missing-question-id') {
      updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn('SurveyQuestions: No questionID provided in singleQuestionMode.');
      safeSetState(sourceContextPlan.statePatch);
      return;
    }
    const questionId: SurveyQuestionsLegacyValue = sourceContextPlan.questionId;
    const preserveCurrentSingleQuestionPool: SurveyQuestionsLegacyValue = (
      extraState: SurveyQuestionsLegacyValue = {},
    ) => {
      const plan: SurveyQuestionsLegacyValue = buildSingleQuestionPreservedPoolState({
        questionId,
        questionPool: stateRef.current.questionPool,
        extraState,
      });
      if (plan.action !== 'preserve') return false;
      safeSetState(plan.statePatch);
      return true;
    };

    if (sourceContextPlan.retryCleanupAction !== 'none') {
      clearSingleQuestionBootstrapRetry();
    }
    updateSingleQuestionDebug(sourceContextPlan.startDebugPayload);

    let effectiveSingleSlug: SurveyQuestionsLegacyValue = sourceContextPlan.effectiveSingleSlug;
    const fetchCandidateSlugs: SurveyQuestionsLegacyValue = sourceContextPlan.fetchCandidateSlugs;
    const hasPendingRetryForQuestion: SurveyQuestionsLegacyValue = sourceContextPlan.hasPendingRetryForQuestion;

    if (sourceContextPlan.status === 'blocked-question') {
      updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn(`SurveyQuestions: Question ${questionId} is blocked; skipping.`);
      safeSetState(sourceContextPlan.statePatch);
      return;
    }

    const responderAddress: SurveyQuestionsLegacyValue = propsRef.current.responderAddress;

    const getCacheStateForSlug: SurveyQuestionsLegacyValue = async (slug: SurveyQuestionsLegacyValue) =>
      resolveSingleQuestionCacheState({
        slug,
        questionId,
        resolveQuestionBootstrapContext: (nextSlug: SurveyQuestionsLegacyValue) =>
          resolveQuestionBootstrapContext(propsRef.current, nextSlug),
        readQuestionsCacheAsync,
        ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
      });

    const cacheBootstrapResult: SurveyQuestionsLegacyValue = await resolveSingleQuestionCacheBootstrap({
      questionId,
      effectiveSingleSlug,
      responderAddress: String(responderAddress || ''),
      account: String(propsRef.current.account || ''),
      resolveCacheState: getCacheStateForSlug,
      readRecentPayload: readRecentQuestionPayload,
      canUseRecentPayload: canUseRecentQuestionPayloadForAccount,
      resolveBootstrapNetworkId: (slug: SurveyQuestionsLegacyValue) =>
        resolveQuestionBootstrapContext(propsRef.current, slug).networkIdStr || '',
      updateCacheAtomic,
      ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
      pickBetterQuestionPayload: pickBetterQuestionPayload as SurveyQuestionsLegacyValue,
      areQuestionPayloadsEquivalent,
      writeQuestionsCache: writeQuestionsCache as SurveyQuestionsLegacyValue,
    });
    if (isStaleRun()) return;

    const cacheBootstrapPlan: SurveyQuestionsLegacyValue = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult,
    });
    if (cacheBootstrapPlan.seededHydration) {
      const { questionData: seededQData, isLoadingResponse }: SurveyQuestionsLegacyValue =
        cacheBootstrapPlan.seededHydration;
      setResponseHydrationState(
        (prev: SurveyQuestionsLegacyValue) =>
          buildSingleQuestionSeededHydrationState({
            prevState: prev,
            questionData: seededQData,
            isLoadingResponse,
            mergeSurveyResponseState: mergeSurveyResponseState,
          }),
        () => {
          updateJsonPreview();
          rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
        },
      );
    }
    if (isStaleRun()) return;

    if (cacheBootstrapPlan.action === 'stop') {
      const stopPlanContext: SurveyQuestionsLegacyValue = {
        bootstrapRetryAttempt,
        cacheBootstrapPlan,
        effectiveSingleSlug: cacheBootstrapResult.target.effectiveSingleSlug,
        questionId: cacheBootstrapResult.target.questionId,
        responderAddress: cacheBootstrapResult.target.responderAddress,
        runId,
      };
      const stopHandlingPlan: SurveyQuestionsLegacyValue =
        resolveSingleQuestionCacheBootstrapStopHandlingPlan(stopPlanContext);
      if (stopHandlingPlan.action === 'retry') {
        const didScheduleRetry: SurveyQuestionsLegacyValue = scheduleSingleQuestionBootstrapRetry(
          stopHandlingPlan.retryRequest,
        );
        const retryOutcome: SurveyQuestionsLegacyValue = (
          resolveSingleQuestionCacheBootstrapStopHandlingPlan({
            ...stopPlanContext,
            didScheduleRetry,
          } as SurveyQuestionsLegacyValue) as SurveyQuestionsLegacyValue
        ).retryOutcome;
        if (retryOutcome?.debugPayload) {
          updateSingleQuestionDebug(retryOutcome.debugPayload);
        }
        if (retryOutcome?.shouldClearRetry) {
          clearSingleQuestionBootstrapRetry();
          safeSetState(retryOutcome.exhaustedStatePatch);
        }
        return;
      }

      if (stopHandlingPlan.action === 'fallback') {
        if (stopHandlingPlan.debugPayload) {
          updateSingleQuestionDebug(stopHandlingPlan.debugPayload);
        }
        if (stopHandlingPlan.logMissingCacheState) {
          surveyLog.error('SurveyQuestions: Network ID undefined in fetchSingleQuestionData');
        }
        if (stopHandlingPlan.preserveCurrentPoolPatch) {
          if (preserveCurrentSingleQuestionPool(stopHandlingPlan.preserveCurrentPoolPatch)) {
            return;
          }
        }
        if (stopHandlingPlan.shouldApplyFallbackStatePatch) {
          safeSetState(stopHandlingPlan.fallbackStatePatch);
        }
        return;
      }

      return;
    }

    let qData: SurveyQuestionsLegacyValue = cacheBootstrapPlan.questionData;
    let cacheState: SurveyQuestionsLegacyValue = cacheBootstrapPlan.cacheState;
    let { netIdStr, questionsCache }: SurveyQuestionsLegacyValue = cacheState;
    const recentPayloadForAccount: SurveyQuestionsLegacyValue = cacheBootstrapPlan.recentPayloadForAccount;

    const metadataBootstrapResult: SurveyQuestionsLegacyValue = await resolveSingleQuestionMetadataBootstrap({
      questionId,
      questionData: qData,
      effectiveSingleSlug,
      cacheState,
      fetchCandidateSlugs,
      fetchTimeoutMs,
      fetchTimeoutRecoveryMs,
      forceRefetch: !!opts.forceQuestionMetadataRefetch,
      loginComplete: !!propsRef.current.loginComplete,
      hasAccount: !!propsRef.current.account,
      isMaskedQuestionPayload,
      fetchSingleQuestionMetadataCandidates: (args: SurveyQuestionsLegacyValue) =>
        fetchSingleQuestionMetadataCandidates({
          ...args,
          getQuestionData: (candidateSlug: SurveyQuestionsLegacyValue) =>
            surveyQuestionReadsPort.getQuestionData(
              propsRef.current.provider,
              questionId,
              candidateSlug,
              buildAutomaticQuestionMetadataFetchOptions(candidateSlug),
            ),
        }),
      pickBetterQuestionPayload: pickBetterQuestionPayload as SurveyQuestionsLegacyValue,
      areQuestionPayloadsEquivalent,
      normalizeSingleQuestionMetadataForCache,
      resolveCacheState: getCacheStateForSlug,
      writeQuestionsCache: writeQuestionsCache as SurveyQuestionsLegacyValue,
    });
    if (isStaleRun()) return;

    if (metadataBootstrapResult.status === 'missing-cache-state') {
      if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
        return;
      }
      safeSetState(buildSingleQuestionPoolFallbackState());
      return;
    }

    if (metadataBootstrapResult.status === 'unavailable') {
      surveyLog.warn(
        `SurveyQuestions: No question data for ${questionId} (slug='${metadataBootstrapResult.effectiveSingleSlug}').`,
      );
      const didScheduleRetry: SurveyQuestionsLegacyValue = scheduleSingleQuestionBootstrapRetry({
        questionId,
        attempt: bootstrapRetryAttempt,
        reason: metadataBootstrapResult.retryReason,
      });
      updateSingleQuestionDebug({
        phase: 'question-data-unavailable',
        runId,
        questionId,
        effectiveSingleSlug: String(metadataBootstrapResult.effectiveSingleSlug || ''),
        fetchedAny: !!metadataBootstrapResult.fetchedAny,
        timedOutFetchCount: Number(metadataBootstrapResult.timedOutFetchCount || 0),
        didScheduleRetry: !!didScheduleRetry,
        retryAttempt: bootstrapRetryAttempt,
      });
      const placeholderQuestion: SurveyQuestionsLegacyValue = buildSingleQuestionEncryptedMetadataPlaceholder({
        questionId,
        sessionSlug: metadataBootstrapResult.effectiveSingleSlug || effectiveSingleSlug,
        existingQuestionData: qData || recentPayloadForAccount || null,
      });
      if (placeholderQuestion) {
        safeSetState((prev: SurveyQuestionsLegacyValue) =>
          buildSingleQuestionPlaceholderHydrationState(prev, {
            mergeSurveyResponseState: mergeSurveyResponseState,
            placeholderQuestion,
          }),
        );
        return;
      }
      if (didScheduleRetry) {
        safeSetState(buildSingleQuestionRetryLoadingState());
        return;
      }
      if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
        return;
      }
      safeSetState(buildSingleQuestionPoolFallbackState());
      return;
    }

    // 'ready' or 'skipped' — extract resolved data
    qData = metadataBootstrapResult.questionData;
    if (metadataBootstrapResult.status === 'ready') {
      effectiveSingleSlug = metadataBootstrapResult.effectiveSingleSlug;
      cacheState = metadataBootstrapResult.cacheState;
      ({ netIdStr, questionsCache } = cacheState);
    }

    if (isStaleRun()) return;
    if (!hasPendingRetryForQuestion || bootstrapRetryAttempt > 0) {
      clearSingleQuestionBootstrapRetry();
    }

    // Build pool and merge state before fetching responses
    if (isStaleRun()) return;
    setResponseHydrationState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildSingleQuestionReadyHydrationState(prev, {
          mergeSurveyResponseState: mergeSurveyResponseState,
          questionData: qData,
        }),
      async () => {
        if (isStaleRun()) return;
        const writeRespToCache: SurveyQuestionsLegacyValue = async (
          responder: SurveyQuestionsLegacyValue,
          respObj: SurveyQuestionsLegacyValue,
        ) =>
          writeSingleQuestionResponseToCache({
            responder,
            respObj,
            questionId,
            effectiveSingleSlug,
            netIdStr,
            readQuestionsCacheAsync,
            ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
            writeQuestionsCache: writeQuestionsCache as SurveyQuestionsLegacyValue,
          });

        const readCachedResponderResponse: SurveyQuestionsLegacyValue = (responder: SurveyQuestionsLegacyValue) =>
          readSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            questionsCache,
            cloneValue: deepClone,
          });

        const readFreshCachedResponderResponse: SurveyQuestionsLegacyValue = async (
          responder: SurveyQuestionsLegacyValue,
        ) =>
          readFreshSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            effectiveSingleSlug,
            readQuestionsCacheAsync,
            ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
            cloneValue: deepClone,
            updateQuestionsCache: (nextCache: SurveyQuestionsLegacyValue) => {
              questionsCache = nextCache;
            },
          });

        // Fetch latest response for the appropriate address, scoped to engine slug
        if (responderAddress) {
          const viewedBootstrapResult: SurveyQuestionsLegacyValue = await executeViewedSingleQuestionResponseBootstrap({
            props: propsRef.current,
            state: stateRef.current,
            questionId,
            responderAddress,
            effectiveSingleSlug,
            bootstrapRetryAttempt,
            runId,
            isStaleRun,
            safeSetState,
            updateSingleQuestionDebug: updateSingleQuestionDebug,
            normalizeViewedResponse: normalizeSingleQuestionViewedResponse,
            mergeViewedResponse: mergeDecryptedViewedResponse as SurveyQuestionsLegacyValue,
            scheduleRetry: scheduleSingleQuestionBootstrapRetry,
            clearRetry: clearSingleQuestionBootstrapRetry,
            getResponse: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
              forceArweaveFetch = false,
            }: SurveyQuestionsLegacyValue) =>
              surveyQuestionReadsPort.getResponse(provider, nextResponderAddress, nextQuestionId, nextSingleSlug, {
                forceArweaveFetch,
              }),
            getResponseHash: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
            }: SurveyQuestionsLegacyValue) =>
              surveyQuestionReadsPort.getResponseHash(provider, nextResponderAddress, nextQuestionId, nextSingleSlug),
            writeResponseToCache: writeRespToCache,
            readCachedResponderResponse,
            readFreshCachedResponderResponse,
            prefillSingleQuestionResponse: prefillSingleQuestionResponse,
          });
          if (
            viewedBootstrapResult?.reason === 'stale' ||
            viewedBootstrapResult?.reason === 'retrying' ||
            viewedBootstrapResult?.reason === 'malformed'
          ) {
            return;
          }
        } else {
          const ownBootstrapResult: SurveyQuestionsLegacyValue = await executeOwnSingleQuestionResponseBootstrap({
            props: propsRef.current,
            state: stateRef.current,
            questionId,
            effectiveSingleSlug,
            isStaleRun,
            safeSetState,
            getResponse: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
            }: SurveyQuestionsLegacyValue) =>
              surveyQuestionReadsPort.getResponse(provider, nextResponderAddress, nextQuestionId, nextSingleSlug),
            writeResponseToCache: writeRespToCache,
            areResponsesConsistent: areResponsesConsistent,
            prefillSingleQuestionResponse: prefillSingleQuestionResponse,
          });
          if (ownBootstrapResult?.reason === 'stale') return;
        }

        // Maintain existing preview + local prefill behaviors
        if (isStaleRun()) return;
        updateJsonPreview();
        rehydrateDraftForRenderedIds();
        rehydrateLocalCacheAnswersForRenderedIds();
      },
    );
  }
  return {
    getLatestQuestionResponse,
    getLatestSurveyResponse,
    fetchQuestionPool,
    loadQuestionFromCache,
    mergeSurveyResponseState,
    fetchSurveyResponse,
    prefillSingleQuestionResponse,
    parseAnswerValue,
    handleStartFresh,
    fetchSingleQuestionData,
  };
};
