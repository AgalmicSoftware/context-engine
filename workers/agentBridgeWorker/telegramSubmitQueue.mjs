import { AGENT_BRIDGE_EVENT_TYPES, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { submitTelegramResponseOnChain } from './onChainResponses.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { normalizeTelegramPrincipal } from './telegramUpdates.mjs';

export const SUBMIT_REQUEST_KV_PREFIX = 'telegram:submit-request:';
export const SUBMIT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;
export const TELEGRAM_SUBMIT_QUEUE_MESSAGE_TYPE = 'telegram_submit_direct_v1';
export const SUBMITTED_RESULT_STATUSES = Object.freeze([
  'direct_submitted',
  'submit_queued',
  'submit_request_created',
]);

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(lower(value));
}

function envFlagDisabled(value = '') {
  return ['0', 'false', 'no', 'off'].includes(lower(value));
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

export function telegramSubmitQueueEnabled(env = {}) {
  if (envFlagDisabled(env.AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED)) return false;
  if (!envFlagEnabled(env.AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED)) return false;
  return env?.AGENT_RESPONSE_QUEUE && typeof env.AGENT_RESPONSE_QUEUE.send === 'function';
}

export function safeSessionSnapshotForSubmitQueue(session = {}) {
  return {
    sessionSlug: sanitizeSessionSlug(session.sessionSlug),
    sessionName: safeString(session.sessionName || session.name),
    managedAccountSubmitAllowed: session.managedAccountSubmitAllowed === true,
    sponsoredFaucetAllowed: session.sponsoredFaucetAllowed === true,
    sessionWorkerUrl: safeString(session.sessionWorkerUrl || session.workerUrl || session.corsWorkerUrl),
    surveysAddress: safeString(session.surveysAddress || session.surveyAddress),
    chainId: Number(session.chainId || 0) || undefined,
    rpcUrl: safeString(session.rpcUrl || session.defaultRpcUrl),
    additionalRpcUrl: safeString(session.additionalRpcUrl || session.fallbackRpcUrl),
  };
}

export function buildQueuedSubmitRecord({
  baseRecord = {},
  session = {},
  canonicalBody = {},
} = {}) {
  const record = {
    ...baseRecord,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    status: 'submit_queued',
    canonicalApiRequest: {
      method: 'POST',
      path: '/api/agent/responses/submit-request',
      status: 'queued_direct_onchain',
      body: canonicalBody,
    },
    sessionSnapshot: safeSessionSnapshotForSubmitQueue(session),
  };
  assertNoSecretShape(record, 'Queued Telegram submit records must not serialize secrets.');
  return record;
}

export async function persistQueuedSubmitRecord({
  env = {},
  kvKey = '',
  record = {},
} = {}) {
  if (!env?.AGENT_ACTION_KV || typeof env.AGENT_ACTION_KV.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  assertNoSecretShape(record, 'Queued Telegram submit records must not serialize secrets.');
  await env.AGENT_ACTION_KV.put(kvKey, JSON.stringify(record), {
    expirationTtl: SUBMIT_REQUEST_TTL_SECONDS,
  });
  return { ok: true };
}

export async function enqueueTelegramSubmitRecord({
  env = {},
  record = {},
} = {}) {
  if (!telegramSubmitQueueEnabled(env)) {
    return { ok: false, skipped: true, reason: 'telegram_submit_queue_disabled' };
  }
  const body = {
    type: TELEGRAM_SUBMIT_QUEUE_MESSAGE_TYPE,
    version: 1,
    requestId: safeString(record.requestId),
    record,
  };
  assertNoSecretShape(body, 'Queued Telegram submit messages must not serialize secrets.');
  await env.AGENT_RESPONSE_QUEUE.send(body, { contentType: 'json' });
  return { ok: true, requestId: body.requestId };
}

export async function queueTelegramSubmitRecord({
  env = {},
  kvKey = '',
  record = {},
} = {}) {
  const persisted = await persistQueuedSubmitRecord({ env, kvKey, record });
  if (!persisted.ok) return persisted;
  const queued = await enqueueTelegramSubmitRecord({ env, record });
  if (!queued.ok) return queued;
  return { ok: true, queued: true, requestId: record.requestId };
}

export async function processQueuedTelegramSubmitRecord({
  env = {},
  record = {},
  createdAt = null,
  contractFactory = env.AGENT_BRIDGE_CONTRACT_FACTORY,
} = {}) {
  const requestId = safeString(record.requestId);
  const kvKey = `${SUBMIT_REQUEST_KV_PREFIX}${requestId}`;
  const existing = env?.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.get === 'function'
    ? safeJsonParse(await env.AGENT_ACTION_KV.get(kvKey).catch(() => null), null)
    : null;
  if (existing?.status === 'direct_submitted') {
    return { ok: true, requestId, replayed: true, status: 'direct_submitted' };
  }
  const source = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : record;
  const session = source.sessionSnapshot || { sessionSlug: source.sessionSlug };
  const principal = normalizeTelegramPrincipal({
    telegramUserId: source.telegramUserId,
    username: source.username,
    languageCode: source.languageCode,
  });
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt: createdAt || source.createdAt || null,
  });
  const directSubmit = await submitTelegramResponseOnChain({
    env,
    session,
    account,
    principal,
    questionRef: {
      sessionSlug: source.sessionSlug,
      questionId: source.questionId,
    },
    answer: source.onChainAnswer || source.answer,
    idempotencyKey: source.idempotencyKey,
    createdAt: createdAt || source.createdAt || null,
    contractFactory,
  });
  const updated = {
    ...source,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    status: directSubmit.ok === true ? 'direct_submitted' : 'direct_submit_failed',
    canonicalApiRequest: {
      ...(source.canonicalApiRequest || {}),
      status: directSubmit.ok === true ? 'executed_direct_onchain' : 'direct_submit_failed',
    },
    onChain: directSubmit,
    processedAt: createdAt || new Date().toISOString(),
  };
  assertNoSecretShape(updated, 'Queued Telegram submit records must not serialize secrets.');
  if (env?.AGENT_ACTION_KV && typeof env.AGENT_ACTION_KV.put === 'function') {
    await env.AGENT_ACTION_KV.put(kvKey, JSON.stringify(updated), {
      expirationTtl: SUBMIT_REQUEST_TTL_SECONDS,
    });
  }
  return {
    ok: directSubmit.ok === true,
    requestId,
    status: updated.status,
    reason: directSubmit.reason || null,
    error: directSubmit.error || null,
  };
}

export async function processTelegramSubmitQueueBatch(batch = {}, env = {}) {
  const messages = Array.isArray(batch.messages) ? batch.messages : [];
  const results = [];
  for (const message of messages) {
    const body = message.body || {};
    if (body.type !== TELEGRAM_SUBMIT_QUEUE_MESSAGE_TYPE || !body.record) {
      message.ack?.();
      results.push({ ok: true, skipped: true, reason: 'unsupported_queue_message' });
      continue;
    }
    try {
      const result = await processQueuedTelegramSubmitRecord({ env, record: body.record });
      message.ack?.();
      results.push(result);
    } catch (error) {
      message.retry?.();
      results.push({
        ok: false,
        reason: 'telegram_submit_queue_processing_failed',
        error: safeString(error?.message || error),
      });
    }
  }
  return { ok: results.every((result) => result.ok !== false), results };
}
