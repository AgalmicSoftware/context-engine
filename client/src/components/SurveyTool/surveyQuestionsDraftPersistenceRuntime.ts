import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsDraftPersistenceRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsDraftPersistenceRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsDraftPersistenceRuntime => {
  const {
    buildPersistDraftAllowedQuestionIds,
    buildPersistedDraftMapsForAllowedIds,
    buildPersistedDraftPayload,
    buildPersistedDraftQuestionRemovalPlan,
    buildPersistedDraftTrackingAfterLoad,
    buildPersistedDraftTrackingAfterScopedDelete,
    buildPersistedDraftTrackingAfterWrite,
    buildPersistedDraftTrackingClearedState,
    buildPersistedDraftTrackingOnKeyChange,
    buildPersistedDraftWritePlan,
    buildSurveyDraftLoadPlan,
    buildSurveyDraftSemanticSignature,
    buildSurveyDraftStorageKey,
    buildSurveyDraftStorageVariantKeys,
    getHydrationQuestionIds,
    inst,
    loadPreviousPersistedDraftSnapshot,
    measureSync,
    mergePersistedDraftPayloads,
    normalizeFieldAudienceMode,
    parsePersistedDraftStorageValue,
    propsRef,
    resolveDraftStorageContext,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    stateRef,
    surveyLog,
  } = context;

  const getDraftKey = () => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;
      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      return buildSurveyDraftStorageKey({
        sessionSlug: slug,
        networkIdStr: networkIdStr || '__pending__',
        account: propsRef.current?.account,
        surveyScope,
      });
    } catch (e: unknown) {
      return null;
    }
  };

  const loadDraft = () => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;

      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      const accountLower: SurveyQuestionsLegacyValue = (propsRef.current?.account || '').toLowerCase();
      const {
        primaryAnonKey: anonKey,
        primaryAccountKey: acctKey,
        compatAnonKey: anonCompatKey,
        compatAccountKey: acctCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAnonKey: anonPerQidKey,
        perQuestionAccountKey: acctPerQidKey,
      }: SurveyQuestionsLegacyValue = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: propsRef.current.questionID,
        includePerQuestionScope: !!propsRef.current.singleQuestionMode,
      });

      const readAndParse: SurveyQuestionsLegacyValue = (key: SurveyQuestionsLegacyValue) => {
        if (!key) return null;
        try {
          const raw: SurveyQuestionsLegacyValue = sessionStorage.getItem(key);
          if (!raw) return null;
          const parsedResult: SurveyQuestionsLegacyValue = parsePersistedDraftStorageValue({ raw });
          if (parsedResult.status !== 'valid') {
            try {
              sessionStorage.removeItem(key);
            } catch (e: unknown) {
              surveyLog.warn('SurveyTool: fallback', e);
            }
            return null;
          }
          return { raw: parsedResult.raw, obj: parsedResult.payload };
        } catch (e: unknown) {
          return null;
        }
      };
      const pend: SurveyQuestionsLegacyValue = readAndParse(pendingKey);
      const perQidAnon: SurveyQuestionsLegacyValue = anonPerQidKey ? readAndParse(anonPerQidKey) : null;
      const perQidAcct: SurveyQuestionsLegacyValue = acctPerQidKey ? readAndParse(acctPerQidKey) : null;
      const rawDraftByKey: SurveyQuestionsLegacyValue = new Map([
        ...(pend ? [[pendingKey, pend]] : []),
        ...(perQidAnon ? [[anonPerQidKey, perQidAnon]] : []),
        ...(perQidAcct ? [[acctPerQidKey, perQidAcct]] : []),
      ] as SurveyQuestionsLegacyValue);
      const loadPlan: SurveyQuestionsLegacyValue = buildSurveyDraftLoadPlan({
        hasAccount: !!accountLower,
        primaryAccountKey: acctKey,
        primaryAnonKey: anonKey,
        compatAccountKey: acctCompatKey,
        compatAnonKey: anonCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAccountKey: acctPerQidKey,
        perQuestionAnonKey: anonPerQidKey,
      });

      const draftHits: SurveyQuestionsLegacyValue = [];
      for (const step of loadPlan) {
        const hit: SurveyQuestionsLegacyValue = rawDraftByKey.get(step.readKey) || readAndParse(step.readKey);
        if (!hit) continue;
        draftHits.push({ ...step, ...hit });
      }

      if (draftHits.length === 0) return null;

      const mergedDraft: SurveyQuestionsLegacyValue = mergePersistedDraftPayloads({
        drafts: draftHits.map((hit: SurveyQuestionsLegacyValue) => hit.obj),
      });
      if (!mergedDraft) return null;

      const targetKey: SurveyQuestionsLegacyValue = accountLower ? acctKey : anonKey;
      const mergedRaw: SurveyQuestionsLegacyValue = JSON.stringify(mergedDraft);
      const targetHit: SurveyQuestionsLegacyValue = draftHits.find(
        (hit: SurveyQuestionsLegacyValue) => hit.readKey === targetKey,
      );
      const shouldWriteTarget: SurveyQuestionsLegacyValue =
        !!targetKey &&
        (!targetHit ||
          targetHit.raw !== mergedRaw ||
          draftHits.some((hit: SurveyQuestionsLegacyValue) => hit.readKey !== targetKey || hit.writeKey));

      let wroteTarget: SurveyQuestionsLegacyValue = !shouldWriteTarget;
      if (shouldWriteTarget) {
        try {
          sessionStorage.setItem(targetKey, mergedRaw);
          wroteTarget = true;
        } catch (e: unknown) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      }

      if (wroteTarget && targetKey) {
        draftHits.forEach((hit: SurveyQuestionsLegacyValue) => {
          if (!hit.readKey || hit.readKey === targetKey) return;
          try {
            sessionStorage.removeItem(hit.readKey);
          } catch (e: unknown) {
            surveyLog.warn('SurveyTool: fallback', e);
          }
        });
      }

      if (targetKey && wroteTarget) {
        rawDraftByKey.set(targetKey, { raw: mergedRaw, obj: mergedDraft });
      }

      return mergedDraft;
    } catch (e: unknown) {
      return null;
    }
  };

  const migratePersistedDraftForActiveAccount = () => {
    try {
      if (!propsRef.current?.account) return null;
      return loadDraft();
    } catch (e: unknown) {
      surveyLog.warn('SurveyTool: fallback', e);
      return null;
    }
  };

  const persistDraftSafely = (delayMs: SurveyQuestionsLegacyValue = 150) => {
    if (inst._persistTimer) clearTimeout(inst._persistTimer);
    inst._persistTimer = setTimeout(persistDraft, delayMs);
  };

  const persistDraft = () =>
    measureSync('ce.surveyQuestions.persistDraft', () => {
      try {
        const key: SurveyQuestionsLegacyValue = getDraftKey();

        // Guard null key and clean up malformed JSON
        if (!key) return;
        const keyTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingOnKeyChange({
          nextDraftKey: key,
          lastDraftKey: inst._lastDraftKey,
          lastDraftJSON: inst._lastDraftJSON,
          lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
          draftParseCache: inst._draftParseCache,
        });
        inst._applyDraftTrackingState(keyTracking);

        migratePersistedDraftForActiveAccount();

        // Preload prior persisted answers so we don't prune non-rendered QIDs
        const {
          prevAnswers,
          prevBaseline,
          prevDraftRaw,
          prevSemanticSignature,
          nextDraftParseCache,
          shouldResetDraftTracking,
        }: SurveyQuestionsLegacyValue = loadPreviousPersistedDraftSnapshot(
          {
            key,
            lastDraftKey: inst._lastDraftKey,
            lastDraftJSON: inst._lastDraftJSON,
            lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
            draftParseCache: inst._draftParseCache,
          },
          {
            readDraftRaw: (draftKey: SurveyQuestionsLegacyValue) => sessionStorage.getItem(draftKey) || '',
            removeDraftRaw: (draftKey: SurveyQuestionsLegacyValue) => sessionStorage.removeItem(draftKey),
            buildSemanticSignature: buildSurveyDraftSemanticSignature,
          },
        );
        const loadTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterLoad({
          lastDraftKey: inst._lastDraftKey,
          lastDraftJSON: inst._lastDraftJSON,
          lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
          draftParseCache: inst._draftParseCache,
          nextDraftParseCache,
          shouldResetDraftTracking,
        });
        inst._applyDraftTrackingState(loadTracking);

        const surveyIndex: SurveyQuestionsLegacyValue =
          propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
        const slice: SurveyQuestionsLegacyValue = (stateRef.current.surveysResponseState &&
          stateRef.current.surveysResponseState[surveyIndex]) || {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        };

        // Only persist rendered (or all if none rendered)
        const renderedIds: SurveyQuestionsLegacyValue = getHydrationQuestionIds();
        const dirtyQids: SurveyQuestionsLegacyValue = inst._draftDirtyQids ? [...inst._draftDirtyQids] : [];
        const allowed: SurveyQuestionsLegacyValue = buildPersistDraftAllowedQuestionIds({
          renderedQuestionIds: renderedIds,
          dirtyQuestionIds: dirtyQids,
          slice,
        });

        const baselineSlice: SurveyQuestionsLegacyValue = stateRef.current.editBaseline || {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        };
        // Start from previous draft answers/baseline so non-rendered QIDs survive,
        // then overwrite only the currently allowed question set.
        const { answersObj, baselineObj }: SurveyQuestionsLegacyValue = buildPersistedDraftMapsForAllowedIds({
          allowedQuestionIds: allowed,
          slice,
          baselineSlice,
          prevAnswers,
          prevBaseline,
          resolvers: {
            resolveFieldEncryptionAudience: resolveFieldEncryptionAudience,
            resolveFieldEncryptionGateId: resolveFieldEncryptionGateId,
            normalizeFieldAudienceMode: normalizeFieldAudienceMode,
          },
        });

        if (Object.keys(answersObj).length === 0) {
          // No meaningful draft → clear both scoped variants (and SQM compat)
          clearDraft();
          return;
        }

        const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
          propsRef.current,
          inst._getEffectiveDraftSlug(),
        );
        const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
        const persistWritePlan: SurveyQuestionsLegacyValue = buildPersistedDraftWritePlan({
          draftKey: key,
          sessionSlug: slug,
          networkIdStr: draftContext.networkIdStr,
          account: propsRef.current?.account,
          surveyScope: inst._getDraftScope(),
          singleQuestionMode: propsRef.current.singleQuestionMode,
        });
        const payload: SurveyQuestionsLegacyValue = buildPersistedDraftPayload({
          draftContext,
          singleQuestionMode: propsRef.current.singleQuestionMode,
          questionId: propsRef.current.questionID,
          surveyId: propsRef.current.surveyId,
          answersObj,
          // Keep baseline in storage; prefill/merge logic depends on it to avoid false dirty diffs.
          baselineObj,
        });

        const nextSemanticSignature: SurveyQuestionsLegacyValue = buildSurveyDraftSemanticSignature(payload);
        if (nextSemanticSignature && nextSemanticSignature === prevSemanticSignature) {
          inst._lastDraftJSON = prevDraftRaw || inst._lastDraftJSON;
          inst._lastDraftSemanticSignature = nextSemanticSignature;
          if (inst._draftDirtyQids) inst._draftDirtyQids.clear();
          return;
        }

        const nextJson: SurveyQuestionsLegacyValue = JSON.stringify(payload);
        if (nextJson === inst._lastDraftJSON) return;
        try {
          sessionStorage.setItem(key, nextJson);
        } catch (e: unknown) {
          surveyLog.warn('SurveyTool: draft persistence failed', e);
          return;
        }

        // SQM compat mirror under :questions (without :q:<qid>) for tooling/tests
        if (persistWritePlan.compatWriteKey) {
          try {
            sessionStorage.setItem(persistWritePlan.compatWriteKey, nextJson);
          } catch (e: unknown) {
            surveyLog.warn('SurveyTool: fallback', e);
          }
        }

        const writeTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterWrite({
          key,
          raw: nextJson,
          payload,
          semanticSignature: nextSemanticSignature,
        });
        inst._applyDraftTrackingState(writeTracking);
        if (inst._draftDirtyQids) inst._draftDirtyQids.clear();

        persistWritePlan.staleAnonKeys.forEach((draftKey: SurveyQuestionsLegacyValue) => {
          try {
            sessionStorage.removeItem(draftKey);
          } catch (e: unknown) {
            surveyLog.warn('SurveyTool: fallback', e);
          }
        });
      } catch (e: unknown) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
    });

  const clearDraft = () => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;

      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      const accountLower: SurveyQuestionsLegacyValue = (propsRef.current?.account || '').toLowerCase() || 'anon';
      const { purgeKeys }: SurveyQuestionsLegacyValue = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
      });

      purgeKeys.forEach((k: SurveyQuestionsLegacyValue) => {
        try {
          sessionStorage.removeItem(k);
        } catch (e: unknown) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      });

      const clearedTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingClearedState();
      inst._applyDraftTrackingState(clearedTracking);
    } catch (e: unknown) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  const clearDraftFor = (qid: SurveyQuestionsLegacyValue) => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;

      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      const accountLower: SurveyQuestionsLegacyValue = (propsRef.current?.account || '').toLowerCase() || 'anon';
      const qidLower: SurveyQuestionsLegacyValue = (qid || '').toLowerCase();
      const { purgeKeys }: SurveyQuestionsLegacyValue = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: qidLower,
        includePerQuestionScope: !!propsRef.current.singleQuestionMode,
      });

      purgeKeys.forEach((key: SurveyQuestionsLegacyValue) => {
        try {
          const raw: SurveyQuestionsLegacyValue = sessionStorage.getItem(key);
          if (!raw) return;
          const removalPlan: SurveyQuestionsLegacyValue = buildPersistedDraftQuestionRemovalPlan({
            raw,
            questionId: qidLower,
            buildSemanticSignature: buildSurveyDraftSemanticSignature,
          });
          if (removalPlan.action === 'delete-storage') {
            try {
              sessionStorage.removeItem(key);
            } catch (e: unknown) {
              surveyLog.warn('SurveyTool: fallback', e);
            }
            const deleteTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterScopedDelete({
              key,
              lastDraftKey: inst._lastDraftKey,
              lastDraftJSON: inst._lastDraftJSON,
              lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
              draftParseCache: inst._draftParseCache,
            });
            inst._applyDraftTrackingState(deleteTracking);
            return;
          }
          if (removalPlan.action === 'update-storage' && removalPlan.nextPayload && removalPlan.nextJson) {
            sessionStorage.setItem(key, removalPlan.nextJson);
            const writeTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterWrite({
              key,
              raw: removalPlan.nextJson,
              payload: removalPlan.nextPayload,
              semanticSignature: removalPlan.nextSemanticSignature,
            });
            inst._applyDraftTrackingState(writeTracking);
          }
        } catch (e: unknown) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      });
    } catch (e: unknown) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  return {
    clearDraft,
    clearDraftFor,
    getDraftKey,
    loadDraft,
    migratePersistedDraftForActiveAccount,
    persistDraft,
    persistDraftSafely,
  };
};
