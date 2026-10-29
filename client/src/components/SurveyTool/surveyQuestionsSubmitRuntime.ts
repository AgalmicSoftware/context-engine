import { buildSavedInterviewConsent } from './sessionInterviewConsent';
import { getSubmittedWorkerResponseRecency } from '../../utilities/survey/workerResponseRecency';
import {
  nameQuestionForNotice,
  readAnswerTooLongMessage,
  sessionStoresAnswersInWorker,
} from '../../utilities/survey/answerSizeBudget';
import { validateQuadraticAllocation } from '../../../../shared/questions/quadraticAllocation.mjs';
import type {
  SurveyQuestionsLegacyRecord,
  SurveyQuestionsLegacyValue,
  SurveySubmitFailureStatePatch,
  SurveySubmitStartStatePatch,
  SurveySubmitSuccessStatePatch,
} from './surveyQuestionsTypes.js';
import type {
  SurveyQuestionsSubmitStaleStatePatch,
  SurveyQuestionsSubmitStartControllerResult,
} from './surveyQuestionsSubmitController.js';
import { resolveSurveyToolWorkerTargetSignature } from './surveyToolWorkerCacheIsolation.js';
import { isLockedAudienceChange, remaskUnchangedEncryptedFields } from './surveyToolSubmitPrepController.js';
import { shouldEncryptResponseFieldForSubmit } from './surveyToolDraftState.js';
import { getQuestionEncryptionGates } from './surveyToolAudienceDerivationController.js';
import { readQuestionsCacheRef } from './surveyToolCacheState.js';
import { resolveQuestionReadCacheContext } from './surveyToolScope.js';
import {
  captureInterviewPredictionComparisonSubmissions,
  resolveEditableQuestionList,
} from './surveyToolResponsePayloadController.js';

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
    inst,
    invalidateDiffCaches,
    isQuestionLockedForResponse,
    maybeBlockSubmitUntilQuestionPoolComplete,
    normalizeQuestionIdKey,
    normalizeSessionSlugValue,
    prepareJsonAndHash,
    propsRef,
    resolveDiffBaselineSlice,
    resolveEffectiveSlug,
    resolveEffectiveResponseGateConfig,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveSessionChainId,
    resolveSubmitEffectiveDraftSlug,
    resolveSurveyQuestionsSubmittedResponseUrl,
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

  const resolveFieldEncryptionPolicy = (field: SurveyQuestionsLegacyValue, qid: string, fieldKey: string) => {
    const audience = resolveFieldEncryptionAudience(field, qid, fieldKey);
    return {
      audience,
      lit:
        audience === 'gate'
          ? buildLitEncryptionOptionsForRecipients(getEffectiveRecipientsForField({ questionId: qid, fieldKey, field }))
          : undefined,
    };
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

  // A rating keeps its saved envelope while it stays locked or this browser never
  // decrypted it. Read the saved answer and the cached one, as the upload does.
  const readSavedRatingEnvelopes = (submitContext: SurveyQuestionsLegacyValue, qid: string) => {
    const saved: SurveyQuestionsLegacyValue = stateRef.current.userAnswers;
    const savedRows: SurveyQuestionsLegacyValue[] = Array.isArray(saved?.responses)
      ? saved.responses
      : saved
        ? [saved]
        : [];
    let cachedRow: SurveyQuestionsLegacyValue = null;
    try {
      const slug = submitContext.effectiveDraftSlug;
      const scope = resolveQuestionReadCacheContext(submitContext.props || propsRef.current, slug);
      const raw = (
        readQuestionsCacheRef(slug)?.[scope.networkIdStr]?.questionResponses as SurveyQuestionsLegacyValue
      )?.[qid]?.[String(submitContext.account || '').toLowerCase()];
      cachedRow = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      cachedRow = null;
    }
    const rows = [
      savedRows.find((row) => normalizeQuestionIdKey(row?.questionID || row?.questionId) === qid),
      cachedRow,
    ].filter((row) => row && typeof row === 'object');
    const envelopeOf = (fieldKey: string, envelopeKey: string): string => {
      const row = rows.find((candidate) => !!candidate[envelopeKey] || candidate[fieldKey] != null);
      return typeof row?.[envelopeKey] === 'string' ? row[envelopeKey] : '';
    };
    return {
      importance: envelopeOf('importance', 'importanceEncrypted'),
      conviction: envelopeOf('conviction', 'convictionEncrypted'),
    };
  };

  // Why the session Worker would refuse each changed answer as it will be
  // stored: built like the upload, with the fields and ratings it will lock.
  const readOversizeAnswers = (
    submitContext: SurveyQuestionsLegacyValue,
    slice: SurveyQuestionsLegacyValue,
    changedQids: Set<string>,
    questionPool: SurveyQuestionsLegacyValue[],
  ): Map<string, string> => {
    const oversize = new Map<string, string>();
    if (
      !changedQids.size ||
      !sessionStoresAnswersInWorker(
        resolveEffectiveResponseGateConfig(submitContext.effectiveDraftSlug, submitContext.props),
      )
    ) {
      return oversize;
    }
    const sizeSlice: SurveyQuestionsLegacyValue = remaskUnchangedEncryptedFields(
      captureInterviewPredictionComparisonSubmissions(slice, changedQids) as SurveyQuestionsLegacyValue,
      stateRef.current.editBaseline,
      changedQids,
      resolveFieldEncryptionPolicy,
    );
    const built: SurveyQuestionsLegacyValue = prepareJsonAndHash(
      submitContext.surveyIndex,
      undefined,
      sizeSlice,
      changedQids,
    );
    const rows: SurveyQuestionsLegacyValue[] = Array.isArray(built?.responses)
      ? built.responses
      : built?.questionID
        ? [built]
        : [];
    const lockedBy = new Map<string, SurveyQuestionsLegacyValue[]>();
    buildFieldEncryptionWorkGroups(sizeSlice, changedQids).groups.forEach((group: SurveyQuestionsLegacyValue) =>
      (group.qids || []).forEach((qid: string) => {
        if (group.slice?.answers?.[qid]) lockedBy.set(`answers:${qid}`, group.recipients || []);
        if (group.slice?.additionalComments?.[qid]) lockedBy.set(`additionalComments:${qid}`, group.recipients || []);
      }),
    );
    const hasText = (field: SurveyQuestionsLegacyValue) => typeof field?.value === 'string' && !!field.value.trim();
    for (const qid of changedQids) {
      const question = questionPool.find((entry) => normalizeQuestionIdKey(entry?.id) === qid) || null;
      const row = rows.find((entry) => normalizeQuestionIdKey(entry?.questionID ?? entry?.questionId) === qid) || null;
      const asStored = (bucket: 'answers' | 'additionalComments', rowField: SurveyQuestionsLegacyValue) => {
        const field = { ...(sizeSlice[bucket]?.[qid] || {}), ...(rowField || {}) };
        const recipients = lockedBy.get(`${bucket}:${qid}`);
        if (!recipients) return field;
        const audience = recipients.length ? 'gate' : field.encryptionAudience;
        return { ...field, encrypted: true, encryptionAudience: audience, gateRecipients: recipients };
      };
      const answer = asStored('answers', row?.answer);
      const comment = asStored('additionalComments', row?.additional);
      const saved = readSavedRatingEnvelopes(submitContext, qid);
      const message = readAnswerTooLongMessage({
        question,
        promptLocked: getQuestionEncryptionGates(question).length > 0,
        entry: row,
        answer,
        comment,
        ratings: [
          { value: sizeSlice.importance?.[qid] ?? null, savedEnvelope: saved.importance },
          { value: sizeSlice.conviction?.[qid] ?? null, savedEnvelope: saved.conviction },
        ],
        // As the rating step decides: the answer's lock, or a comment lock with text or
        // saved ratings. A blank comment is sent unlocked, but its lock still counts here.
        ratingsLocked:
          !!isQuestionLockedForResponse(qid) ||
          !!sizeSlice.answers?.[qid]?.encrypted ||
          !!answer.encrypted ||
          ((!!sizeSlice.additionalComments?.[qid]?.encrypted || !!comment.encrypted) &&
            (!!saved.importance || !!saved.conviction || hasText(comment))),
      });
      if (message) oversize.set(qid, message);
    }
    return oversize;
  };

  const encryptAndUpload = async () => {
    let submitContext: SurveyQuestionsLegacyValue = null;
    let heldBackNotice = '';
    try {
      if (!propsRef.current.loginComplete) {
        inst._submitGuard = false;
        propsRef.current.toggleLoginModal(true);
        return { status: 'login-required' };
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
        return { status: 'failed', message: 'No responses to submit.' };
      }

      if (maybeBlockSubmitUntilQuestionPoolComplete()) {
        inst._submitGuard = false;
        return { status: 'pending', message: 'Question metadata is still loading.' };
      }

      submitContext = buildSubmitContextSnapshot();
      const operationContextKey = buildSubmitContextKey(submitContext);
      if (!inst._submitOperationId || inst._submitOperationContextKey !== operationContextKey) {
        inst._submitOperationId = ethers.utils.hexlify(ethers.utils.randomBytes(16));
        inst._submitOperationContextKey = operationContextKey;
        inst._submitOperationTimestamp = Date.now();
        inst._submitOperationPayloads = new Map();
        inst._submitUploadRevisions = new Map();
      }
      submitContext.operationId = inst._submitOperationId;
      submitContext.operationTimestamp = inst._submitOperationTimestamp;
      submitContext.operationPayloads = inst._submitOperationPayloads;
      submitContext.uploadRevisions = inst._submitUploadRevisions;
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
      const { changedQids, changedMap }: SurveyQuestionsLegacyValue = getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex] || {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      };
      const submitQuestionPool: SurveyQuestionsLegacyValue = stateRef.current.questionPool?.length
        ? stateRef.current.questionPool
        : resolveEditableQuestionList(stateRef.current);
      // Typed asterisks have no envelope: editing always clears the old ciphertext.
      // Saved masks go through per-question holdback so other answers can still submit.
      for (const qid of changedQids as Set<string>) {
        for (const field of [activeSlice.answers?.[qid], activeSlice.additionalComments?.[qid]]) {
          if (typeof field?.value === 'string' && field.value.trim() === '*' && !field.encryptedPortion) {
            throw new Error("A lone * can't be saved; add more text.");
          }
        }
      }
      for (const question of submitQuestionPool) {
        // The diff and the slice use normalized ids; pool ids may differ in case.
        const qid = normalizeQuestionIdKey(question.id);
        if (question.type !== 'quadratic' || !changedQids.has(qid)) continue;
        // The diff stores per-field flags, not a list of field names.
        if (changedMap?.[qid] && !changedMap[qid].answer) continue;
        const value = activeSlice.answers?.[qid]?.value;
        if (value === '' || value === undefined || value === null) continue;
        const error = validateQuadraticAllocation(value, question);
        if (error) throw new Error(error);
      }
      // The Worker refuses an answer too large to store. Before locking or upload,
      // hold back and name each one; the other changes still submit.
      const oversize = readOversizeAnswers(submitContext, activeSlice, changedQids, submitQuestionPool);
      // A still-locked field with a new audience can't be re-encrypted until it is decrypted again.
      Array.from(changedQids as Set<string>).forEach((qid) => {
        if (
          (
            [
              ['answers', 'answer'],
              ['additionalComments', 'additional'],
            ] as const
          ).some(([bucket, key]) => {
            const field = activeSlice[bucket]?.[qid];
            return field && isLockedAudienceChange(field, resolveFieldEncryptionPolicy(field, qid, key));
          })
        )
          oversize.set(
            qid,
            "It is still locked, so its new audience can't be applied yet. Decrypt it, then submit again.",
          );
      });
      heldBackNotice = Array.from(oversize, ([qid, message]) =>
        submitContext.singleQuestionMode
          ? message
          : `${nameQuestionForNotice(
              submitQuestionPool.find((entry: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(entry?.id) === qid)
                ?.prompt,
              qid,
            )} wasn't submitted. ${message}`,
      ).join(' ');
      const submitQids = new Set<string>(Array.from(changedQids as Set<string>).filter((qid) => !oversize.has(qid)));
      if (oversize.size && !submitQids.size) throw new Error(heldBackNotice);

      activeSlice = captureInterviewPredictionComparisonSubmissions(activeSlice, submitQids);

      activeSlice = remaskUnchangedEncryptedFields(
        activeSlice,
        stateRef.current.editBaseline,
        submitQids,
        resolveFieldEncryptionPolicy,
      );
      const shouldEncrypt = Array.from(submitQids).some(
        (qid) =>
          shouldEncryptResponseFieldForSubmit(activeSlice.answers?.[qid]) ||
          shouldEncryptResponseFieldForSubmit(activeSlice.additionalComments?.[qid]),
      );

      if (shouldEncrypt) {
        const { groups: workGroups, missingRecipients }: SurveyQuestionsLegacyValue = buildFieldEncryptionWorkGroups(
          activeSlice,
          submitQids,
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
          const encState: SurveyQuestionsLegacyValue = await encryptFieldWorkGroups({
            workGroups,
            baseOpts: {
              providerKind,
              provider: submitContext.provider,
              account: submitContext.account,
              chainId: submitContext.chainId,
              sessionSlug: submitContext.effectiveDraftSlug,
              sessionConfig: resolveEffectiveResponseGateConfig(submitContext.effectiveDraftSlug, submitContext.props),
              surveyId,
              questionPool: submitQuestionPool,
              hasher: stateRef.current.hasher,
            },
          });
          if (!isSubmitContextCurrent(submitContext)) {
            handleStaleSubmitContext(submitContext);
            return { status: 'stale', message: 'Submission context changed before encryption completed.' };
          }

          // Merge back (overrides hash with salted Keccak; carries envelope v1 + recipients)
          const newArr: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
          const base: SurveyQuestionsLegacyValue = {
            ...activeSlice,
            // Keep research snapshots captured before encryption replaces plaintext fields.
            interviewProvenance: activeSlice.interviewProvenance,
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
        }
      }

      // Check even when no new encryption ran: an audience-only edit must not
      // reuse masked ciphertext whose recipients still grant the old audience.
      await verifyEncryption(submitQids, activeSlice);
      setState(buildCurrentStepState(2));

      // Await the receipt to ensure transaction is confirmed before optimistic update
      const receipt: SurveyQuestionsLegacyValue = await submitSurveyResponse(activeSlice, submitQids, submitContext);
      if (!isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return { status: 'stale', message: 'Submission context changed before upload completed.' };
      }
      if (oversize.size) {
        // Listed with any answers the upload itself held back, so callers report them too.
        const heldBackQids = Array.isArray(inst._heldBackSubmitQids) ? inst._heldBackSubmitQids : [];
        inst._heldBackSubmitQids = Array.from(new Set([...heldBackQids, ...oversize.keys()]));
        inst._heldBackSubmitMessage = [inst._heldBackSubmitMessage, heldBackNotice].filter(Boolean).join(' ');
        setState(buildSubmissionErrorState(inst._heldBackSubmitMessage));
      }
      surveyLog.log('Submission receipt received', receipt?.blockNumber || 'unknown block');

      // Success path. Only rows that reached storage are saved; any other change
      // keeps its draft and stays pending against the previous baseline.
      const uploadedQids = new Set<string>(
        (Array.isArray(receipt?.__ceQuestionResponses) ? receipt.__ceQuestionResponses : [])
          .map((response: SurveyQuestionsLegacyValue) =>
            normalizeQuestionIdKey(response?.questionID || response?.questionId),
          )
          .filter(Boolean),
      );

      // 1. STOP any pending draft saves immediately
      if (inst._persistTimer) {
        clearTimeout(inst._persistTimer);
        inst._persistTimer = null;
      }

      // 2. Clear drafts for uploaded QIDs
      surveyLog.log('Clearing drafts for QIDs:', Array.from(uploadedQids));
      try {
        Array.from(uploadedQids).forEach((qid: string) => clearDraftFor && clearDraftFor(qid));
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

      // Uploaded questions match their saved rows exactly; the rest keep the old baseline.
      // We clone activeSlice (which holds the final encrypted/plaintext state)
      const finalSlice: SurveyQuestionsLegacyValue = deepClone(activeSlice);
      const nextBaseline: SurveyQuestionsLegacyValue = deepClone(resolveDiffBaselineSlice(false) || {});
      for (const field of ['answers', 'additionalComments', 'importance', 'conviction']) {
        const merged: SurveyQuestionsLegacyValue = Object.fromEntries(
          Object.entries(nextBaseline[field] || {}).filter(([qid]) => !uploadedQids.has(normalizeQuestionIdKey(qid))),
        );
        Object.entries(finalSlice[field] || {}).forEach(([qid, value]) => {
          if (uploadedQids.has(normalizeQuestionIdKey(qid))) merged[qid] = deepClone(value);
        });
        nextBaseline[field] = merged;
      }

      // Construct the explicit new state array to prevent any diff artifacts
      const nextSurveysResponseState: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
      nextSurveysResponseState[surveyIndex] = finalSlice;

      // Regression guard: the encrypted merge above is a class setState, so
      // build optimistic JSON from the known final slice instead of stateRef.current.
      // The slice holds plaintext ratings; uploaded rows hold what storage now has
      // (envelopes, null plaintext), which a later submit must keep for untouched ratings.
      const uploadedRows = new Map<string, SurveyQuestionsLegacyValue>(
        (Array.isArray(receipt?.__ceQuestionResponses) ? receipt.__ceQuestionResponses : []).map(
          (row: SurveyQuestionsLegacyValue) => [normalizeQuestionIdKey(row?.questionID || row?.questionId), row],
        ),
      );
      const withUploadedRatings = (row: SurveyQuestionsLegacyValue) => {
        const uploaded = uploadedRows.get(normalizeQuestionIdKey(row?.questionID));
        return uploaded
          ? {
              ...row,
              importance: uploaded.importance ?? null,
              conviction: uploaded.conviction ?? null,
              importanceEncrypted: uploaded.importanceEncrypted || '',
              convictionEncrypted: uploaded.convictionEncrypted || '',
            }
          : row;
      };
      // Saved rows mirror storage: an uploaded question gets its new row, and every other
      // question keeps the row it had exactly. A row rebuilt from the form would carry
      // decrypted ratings without their envelopes, and a later Submit would publish them.
      const rowQid = (row: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(row?.questionID || row?.questionId);
      const priorAnswers: SurveyQuestionsLegacyValue = stateRef.current.userAnswers;
      const priorResponses: SurveyQuestionsLegacyValue[] = Array.isArray(priorAnswers?.responses)
        ? priorAnswers.responses
        : [];
      const priorRows = new Map<string, SurveyQuestionsLegacyValue>(priorResponses.map((row) => [rowQid(row), row]));
      const builtUserAnswers: SurveyQuestionsLegacyValue = prepareJsonAndHash(surveyIndex, undefined, finalSlice);
      const builtRows: SurveyQuestionsLegacyValue[] = Array.isArray(builtUserAnswers?.responses)
        ? builtUserAnswers.responses
        : [];
      const builtQids = new Set(builtRows.map(rowQid));
      const optimisticUserAnswers: SurveyQuestionsLegacyValue = Array.isArray(builtUserAnswers?.responses)
        ? {
            ...builtUserAnswers,
            responses: [
              ...builtRows
                .map((row) => (uploadedQids.has(rowQid(row)) ? withUploadedRatings(row) : priorRows.get(rowQid(row))))
                .filter(Boolean),
              ...priorResponses.filter((row) => !builtQids.has(rowQid(row))),
            ],
          }
        : withUploadedRatings(builtUserAnswers);
      nextBaseline.interviewProvenance = {
        ...stateRef.current.editBaseline?.interviewProvenance,
        ...Object.fromEntries(
          (optimisticUserAnswers.responses || (optimisticUserAnswers.questionID ? [optimisticUserAnswers] : []))
            // Only an uploaded question acquires a new saved-consent version.
            .filter((response: SurveyQuestionsLegacyValue) =>
              uploadedQids.has(normalizeQuestionIdKey(response.questionID)),
            )
            .map((response: SurveyQuestionsLegacyValue) => [
              response.questionID,
              buildSavedInterviewConsent(response, getSubmittedWorkerResponseRecency(receipt, response.questionID)),
            ]),
        ),
      };
      // Uploaded questions now hold their saved consent in the baseline. A question
      // that was not uploaded keeps its unsaved consent edits, so a withdrawal stays.
      const pendingProvenance = Object.fromEntries(
        Object.entries(finalSlice.interviewProvenance || {}).filter(
          ([qid]) => !uploadedQids.has(normalizeQuestionIdKey(qid)),
        ),
      );
      if (Object.keys(pendingProvenance).length) finalSlice.interviewProvenance = pendingProvenance;
      else delete finalSlice.interviewProvenance;

      // Check encryption status from the new baseline
      const hasEncrypted =
        Object.values(nextBaseline.answers || {}).some((a: SurveyQuestionsLegacyValue) => !!a.encrypted) ||
        Object.values(nextBaseline.additionalComments || {}).some((a: SurveyQuestionsLegacyValue) => !!a.encrypted);
      invalidateDiffCaches();
      inst._userAnswersSliceCache = { source: null, value: null };

      if (receipt?.retryPending !== true && !inst._heldBackSubmitQids?.length) {
        delete inst._submitOperationId;
        delete inst._submitOperationContextKey;
        delete inst._submitOperationTimestamp;
        delete inst._submitOperationPayloads;
        delete inst._submitUploadRevisions;
      }
      runSurveyQuestionsSubmitSuccessController({
        editBaseline: nextBaseline,
        hasEncrypted,
        responseUrl,
        submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
        submitAttemptId: submitContext.submitAttemptId,
        surveysResponseState: nextSurveysResponseState,
        userAnswers: optimisticUserAnswers,
        retryPending: receipt?.retryPending === true,
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
            if (stateRef.current.draftPersistenceError && getChangedQidsAndFields(surveyIndex).changedQids.size === 0) {
              setState({ draftPersistenceError: '' });
            }
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
            if (shouldRefreshQuestionResponses && typeof propsRef.current.refreshQuestionResponses === 'function') {
              const ids: SurveyQuestionsLegacyValue = Array.from(uploadedQids);
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
      return { status: 'submitted' };
    } catch (error: any) {
      surveyLog.error('Failed to submit survey:', error);
      if (submitContext && !isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return { status: 'stale', message: 'Submission context changed before failure handling completed.' };
      }
      // An answer held back for size stays named when the rest then fails.
      const reportedError =
        heldBackNotice && !String(error?.message || '').includes(heldBackNotice)
          ? new Error([error?.message, heldBackNotice].filter(Boolean).join(' '))
          : error;
      runSurveyQuestionsSubmitFailureController({
        error: reportedError,
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
      return { status: 'failed', message: reportedError?.message || 'Submission failed.' };
    }
  };
  return {
    resolveFieldEncryptionPolicy,
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
