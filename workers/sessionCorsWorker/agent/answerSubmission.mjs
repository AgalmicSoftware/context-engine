import { safeString, nowIso, safeEnvJsonParse as safeJsonParse, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { AGENT_EVENT_TYPES, AGENT_ACTIONS, LEGACY_TRANSPORT_LANES } from './constants.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { submitAgentResponseOnChain, buildAgentResponsePayload } from './onChainResponses.mjs';
import { buildOpaqueActionId, buildSubmitIdempotencyKey } from './opaqueActions.mjs';
import { normalizeAgentRatingScale } from './ratingScale.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { resolveSessionInvocation } from './sessionPolicy.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { buildQueuedSubmitRecord, enqueueAgentSubmitRecord, queueAgentSubmitRecord, submitRequestKvKey, agentSubmitQueueEnabled } from './agentSubmitQueue.mjs';
import { questionId, shortQuestionId } from './runtimeCore.mjs';
import { onChainAnswerFromDraft } from './draftAnswerEncoding.mjs';
import { loadQuestionsForSession } from './sessionQuestionLoading.mjs';
import { answerDraftFingerprint, writeDraftLifecycleEvent, buildDraftProvenance, readAnswerDraftFirstViewedAt } from './answerDrafts.mjs';

const activeSubmissions = new Map();
const submissionIdentity = (normalized, draft, slug, qid) => buildSubmitIdempotencyKey({
  transport: 'telegram_bot_submit', principal: safeString(normalized.user?.telegramUserId), sessionSlug: slug, questionId: qid,
  answer: { answerLabel: safeString(draft.answerLabel), answerValue: safeString(draft.answerValue), controlType: safeString(draft.controlType) },
});
const resultFromRecord = (record, replayed = false) => ({
  ok: ['direct_submitted', 'submit_queued'].includes(record.status),
  requestId: record.requestId, status: record.status, idempotencyKey: record.idempotencyKey,
  canonicalApiRequest: record.canonicalApiRequest || null, onChain: record.onChain || null,
  reason: record.onChain?.reason || (record.status === 'submit_request_created' ? 'direct_submit_unavailable' : record.status),
  retryable: record.onChain?.retryable === true, replayed,
});

export async function persistAgentSubmitRequest(options = {}) {
  const { env = {}, normalized = {}, draft = {} } = options;
  const slug = sanitizeSessionSlug(options.sessionSlug || draft.sessionSlug);
  const qid = safeString(options.selectedQuestionId || draft.questionId);
  const key = `${env.AGENT_CONTEXT?.origin}:${env.AGENT_CONTEXT?.sessionId}:${submissionIdentity(normalized, draft, slug, qid)}`;
  // Coalesce identical in-flight requests in this isolate. Durable intent and
  // hosted receipts still govern replay across isolates; KV is not a global lock.
  if (activeSubmissions.has(key)) return { ...await activeSubmissions.get(key), replayed: true };
  const pending = executeAgentSubmitRequest(options);
  activeSubmissions.set(key, pending);
  try { return await pending; } finally { activeSubmissions.delete(key); }
}

async function executeAgentSubmitRequest({
  env = {},
  normalized = {},
  draft = {},
  sessionSlug = '',
  selectedQuestionId = '',
  createdAt = null,
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function' || typeof env.AGENT_ACTION_KV.get !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const telegramUserId = safeString(normalized.user?.telegramUserId);
  const slug = sanitizeSessionSlug(sessionSlug || draft.sessionSlug);
  const qid = safeString(selectedQuestionId || draft.questionId);
  if (!telegramUserId || !slug || !qid || draft.status !== 'draft_saved') {
    return { ok: false, reason: 'submit_request_incomplete' };
  }
  const answerFingerprint = answerDraftFingerprint(draft);
  const idempotencyKey = submissionIdentity(normalized, draft, slug, qid);
  const requestId = buildOpaqueActionId(idempotencyKey);
  const kvKey = submitRequestKvKey(requestId);
  let existing;
  try {
    const raw = await env.AGENT_ACTION_KV.get(kvKey);
    existing = raw == null ? null : safeJsonParse(raw, null);
    if (raw != null && (!existing || typeof existing !== 'object' || Array.isArray(existing))) {
      return { ok: false, reason: 'submit_request_record_invalid', requestId };
    }
  } catch (error) {
    return { ok: false, reason: 'submit_request_read_failed', requestId, retryable: true, error: safeString(error?.message || error) };
  }
  // A durable intent/outcome may not have reached KV yet. Consult its owner
  // before validating a new effect, so a replay does not depend on stale indexes.
  const principal = (env.AGENT_CONTEXT.auth.delegation?.principal || env.AGENT_CONTEXT.auth.principal);
  const journal = await env.AGENT_SERVICES.readSubmitRecord({
    sessionId: env.AGENT_CONTEXT.sessionId, sessionSlug: slug, workerOrigin: env.AGENT_CONTEXT.origin,
    accountAddress: env.AGENT_CONTEXT.address, principalId: principal.principalId,
    questionId: qid, requestId, idempotencyKey,
  });
  if (!journal.ok) return { ...journal, requestId, idempotencyKey };
  if (journal.record) existing = journal.record;
  const retrySafeFailure = existing?.admissionComplete === false ||
    ['direct_submit_failed', 'direct_submit_in_progress'].includes(existing?.status) && existing?.onChain?.safeToRetry === true;
  if (existing && typeof existing === 'object' && !Array.isArray(existing) && !retrySafeFailure) {
    assertNoSecretShape(existing, "Agent submit requests must not serialize secrets.");
    let queued = false;
    if (existing.status === 'submit_queued' && existing.onChain?.reconciliationRequired !== true) {
      // Publication can fail before or after the queue accepts a message. Resend
      // the saved generation without rewriting KV: a consumer may already have
      // recorded an intent or outcome, which its replay checks must preserve.
      const retry = await enqueueAgentSubmitRecord({ env, record: existing }).catch(() => ({
        ok: false, reason: 'telegram_submit_queue_failed',
      }));
      if (!retry.ok) return { ...retry, requestId, idempotencyKey, retryable: true };
      queued = true;
    }
    return { ...resultFromRecord(existing, true), ...(queued ? { queued: true } : {}) };
  }
  // The coordinator retains this first submission time across isolates/retries.
  createdAt = existing?.createdAt || createdAt || nowIso();
  // A draft is evidence, not current question authority. Reload its canonical
  // schema before an effect so every answer type retains options and limits.
  const loaded = await loadQuestionsForSession(env, slug, { preferredQuestionIds: [qid] });
  const canonicalQuestion = (loaded.questions || []).find(entry => questionId(entry) === qid);
  if (!canonicalQuestion || canonicalQuestion.locked || canonicalQuestion.encrypted ||
      canonicalQuestion.answerable === false || !['public', ''].includes(canonicalQuestion.visibility || '')) {
    return { ok: false, reason: 'submission_question_unavailable', retryable: true };
  }
  try {
    buildAgentResponsePayload({ sessionSlug: slug, questionRef: canonicalQuestion,
      answer: onChainAnswerFromDraft(draft), accountAddress: env.AGENT_CONTEXT.address, createdAt });
  } catch (error) {
    return { ok: false, reason: safeString(error.message), retryable: false, safeToRetry: true, requestId, idempotencyKey };
  }
  const ratingScale = normalizeAgentRatingScale(canonicalQuestion);
  const policy = await loadSessionPolicy(env);
  const resolved = resolveSessionInvocation(policy, slug);
  const session = resolved.ok ? resolved.session : { sessionSlug: slug };
  const submittedAt = safeString(createdAt) || nowIso();
  const firstViewedAt = await readAnswerDraftFirstViewedAt({
    env,
    normalized,
    sessionSlug: slug,
    selectedQuestionId: qid,
  });
  const draftProvenance = buildDraftProvenance({ draft, submittedAt, firstViewedAt });
  const emitSubmittedEvent = () => writeDraftLifecycleEvent(env, {
    event: 'draft_submitted',
    sessionSlug: slug,
    questionId: qid,
    source: safeString(draft.source),
    originSource: safeString(draft.origin?.source),
    controlType: safeString(draft.controlType),
    editCount: Number(draft.editCount || 0),
    draftToSubmitMs: draftProvenance?.draftToSubmitMs ?? null,
    telegramUserId,
  });
  if (agentSubmitQueueEnabled(env)) {
    const record = buildQueuedSubmitRecord({
      session,
      canonicalBody: {
        session: slug,
        questionId: qid,
        answerRef: 'telegram_private_answer_ref',
        idempotencyKey,
      },
      baseRecord: {
        sessionId: env.AGENT_CONTEXT.sessionId,
        workerOrigin: env.AGENT_CONTEXT.origin,
        sourceCredentialHash: env.AGENT_CONTEXT.auth.delegation.tokenHash,
        principalId: env.AGENT_CONTEXT.auth.delegation.principal.principalId,
        accountAddress: env.AGENT_CONTEXT.address,
        authzEpoch: env.AGENT_CONTEXT.authzEpoch,
        version: 1,
        requestId,
        idempotencyKey,
        answerFingerprint,
        lane: LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
        telegramUserId,
        username: safeString(normalized.user?.username),
        languageCode: safeString(normalized.user?.languageCode),
        chatId: safeString(normalized.chat?.chatId),
        sessionSlug: slug,
        questionId: qid,
        questionIdShort: shortQuestionId(qid),
        answer: {
          label: safeString(draft.answerLabel),
          value: safeString(draft.answerValue),
          controlType: safeString(draft.controlType),
        },
        ratingScale,
        onChainAnswer: onChainAnswerFromDraft(draft),
        answerRef: draft.key ? { kind: 'telegram_answer_draft', key: draft.key } : null,
        draftProvenance,
        createdAt,
      },
    });
    // Sending the same answer again resends the saved request under its queue
    // generation (or saves it, if that write failed), so callers may retry it.
    const queued = await queueAgentSubmitRecord({ env, kvKey, record }).catch((error) => ({
      ok: false,
      reason: 'telegram_submit_queue_failed',
      retryable: true,
      error: safeString(error?.message || error),
    }));
    if (queued.ok === true) {
      await emitSubmittedEvent();
      return {
        ok: true,
        requestId,
        status: record.status,
        canonicalApiRequest: record.canonicalApiRequest,
        idempotencyKey,
        queued: true,
        replayed: false,
      };
    }
    // A rejected send promise can follow accepted queue publication. Falling
    // through to direct submission could race that already-enqueued message.
    return { ...queued, requestId, idempotencyKey };
  }
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_CONTEXT.sessionId,
    rootSecret: env.AGENT_MANAGED_ROOT_SECRET || '',
    lifecycle: AGENT_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
  const baseRecord = {
    version: 1, submissionJournal: true, requestId, idempotencyKey, answerFingerprint,
    sessionId: env.AGENT_CONTEXT.sessionId, workerOrigin: env.AGENT_CONTEXT.origin,
    sourceCredentialHash: env.AGENT_CONTEXT.auth.delegation.tokenHash,
    principalId: principal.principalId, accountAddress: env.AGENT_CONTEXT.address,
    authzEpoch: env.AGENT_CONTEXT.authzEpoch,
    action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE, lane: LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT,
    telegramUserId, chatId: safeString(normalized.chat?.chatId), sessionSlug: slug,
    questionId: qid, questionIdShort: shortQuestionId(qid),
    answer: { label: safeString(draft.answerLabel), value: safeString(draft.answerValue), controlType: safeString(draft.controlType) },
    answerRef: draft.key ? { kind: 'telegram_answer_draft', key: draft.key } : null,
    draftProvenance, createdAt,
    canonicalApiRequest: { method: 'POST', path: '/api/agent/responses/submit-request',
      body: { session: slug, questionId: qid, answerRef: 'telegram_private_answer_ref', idempotencyKey } },
  };
  let admitted = false;
  const submissionAttemptId = crypto.randomUUID();
  const hosted = session.sessionModeProfile?.authority?.mode === 'worker_canonical';
  const directSubmit = await submitAgentResponseOnChain({
    env, session, account, principal,
    questionRef: { ...canonicalQuestion, sessionSlug: slug, questionId: qid, ratingScale },
    answer: onChainAnswerFromDraft(draft), idempotencyKey, createdAt,
    previousOutcome: existing?.onChain,
    beforeUpload: async ({ payload }) => {
      // Intent is admitted durably before the first upload or chain effect.
      const intent = { ...baseRecord, responsePayload: payload, status: hosted ? 'direct_submit_in_progress' : 'direct_submit_reconciliation_required',
        onChain: { ok: false, reason: 'submission_in_progress', stage: 'admitted', submissionAttemptId,
          retryable: hosted, safeToRetry: hosted, reconciliationRequired: !hosted } };
      const saved = await env.AGENT_SERVICES.persistSubmitIntent(intent);
      if (!saved.ok) {
        // A coordinator reply can be lost after it records admission. This
        // caller has made no effect; only its own attempt may clear that intent.
        await env.AGENT_SERVICES.persistSubmitOutcome({ ...intent, status: 'direct_submit_failed',
          onChain: { ...intent.onChain, reason: 'submission_admission_failed', safeToRetry: true, retryable: true, reconciliationRequired: false } });
        throw new Error(saved.reason || 'submit_intent_write_failed');
      }
      if (saved.replayed) return { ...resultFromRecord(saved.record, true), replayed: true };
      baseRecord.createdAt = saved.record.createdAt;
      baseRecord.draftProvenance = saved.record.draftProvenance;
      baseRecord.responsePayload = saved.record.responsePayload;
      admitted = true;
      return { submissionCreatedAt: saved.record.createdAt, responsePayload: saved.record.responsePayload, previousOutcome: saved.previousOutcome };
    },
  });
  if (directSubmit.replayed) return { ...directSubmit, requestId, idempotencyKey };
  if (!admitted) return { ...directSubmit, ok: false, requestId, idempotencyKey };
  const status = directSubmit.ok === true ? 'direct_submitted' : directSubmit.reconciliationRequired ? 'direct_submit_reconciliation_required' : 'direct_submit_failed';
  const record = { ...baseRecord, status, onChain: { ...directSubmit, submissionAttemptId },
    canonicalApiRequest: { ...baseRecord.canonicalApiRequest, status: directSubmit.ok ? 'executed_direct_onchain' : status } };
  assertNoSecretShape(record, 'Agent direct submit records must not serialize secrets.');
  const persisted = await env.AGENT_SERVICES.persistSubmitOutcome(record);
  if (persisted.replayed && persisted.record) return resultFromRecord(persisted.record, true);
  if (!persisted.ok || persisted.replayed) return { ...persisted, requestId, idempotencyKey };
  // Activity is ancillary to the already-durable outcome. Revocation during the
  // effect must not turn a recorded success into a client-visible failure.
  if (directSubmit.ok) await emitSubmittedEvent().catch(() => {});
  return resultFromRecord(persisted.record || record, persisted.replayed);
}
