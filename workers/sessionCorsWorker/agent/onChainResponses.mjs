import { boundedAgentFetch } from './transport.mjs';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';
import { normalizeAgentRatingAnswer } from './ratingScale.mjs';
import { validateQuadraticAllocation } from '../../../shared/questions/quadraticAllocation.mjs';

import { safeString, lower, envFlagDisabled } from './runtimePrimitives.mjs';
import { ethers } from 'ethers';
import {
  AGENT_ACTIONS,
} from './constants.mjs';
import {
  deriveDemoPrivateKeyMaterial,
} from './managedAccounts.mjs';
import { assertNoSecretShape } from './redaction.mjs';

const HASH_ZERO = `0x${'0'.repeat(64)}`;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const SUBMIT_RESPONSES_ABI = [
  'function submitResponses(bytes32[] questionIds, bytes32[] responseHashes, bytes32 surveyId, bytes32 surveyResponseHash)',
];

export function directSubmitFeatureEnabled(env = {}) {
  return env.AGENT_CONTEXT?.config?.agentHttp?.managedAccountSubmitAllowed === true && !envFlagDisabled(env.AGENT_DIRECT_SUBMIT_ENABLED);
}

export function resolveSessionWorkerUrl(env) { return env.AGENT_CONTEXT.origin; }

export function resolveSurveysAddress(env = {}, session = {}) {
  const address = safeString(
    session.surveysAddress
  );
  if (!ADDRESS_RE.test(address)) return '';
  try {
    return ethers.getAddress(address);
  } catch {
    return '';
  }
}

function splitRpcUrls(value = '') {
  return safeString(value)
    .split(/[\s,]+/)
    .map(safeString)
    .filter(Boolean);
}

function resolveRpcUrls(env = {}, session = {}) {
  const ordered = [
    session.rpcUrl,
    session.defaultRpcUrl,
    env.DEFAULT_RPC_URL,
    env.RPC_URL,
    session.additionalRpcUrl,
    session.fallbackRpcUrl,
    env.ADDITIONAL_RPC_URL,
  ].flatMap(splitRpcUrls);
  const seen = new Set();
  return ordered.filter((url) => {
    const key = lower(url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeChainId(env = {}, session = {}) {
  const value = Number(session.chainId || env.DEFAULT_CHAIN_ID || 11155420);
  return Number.isInteger(value) && value > 0 ? value : 11155420;
}

function faucetBalanceWaitConfig() { return { attempts: 6, intervalMs: 1000 }; }

async function sleepMs(ms = 0) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function rpcConnection(rpcUrl = '', fetchImpl = null) {
  return typeof fetchImpl === 'function'
    ? { url: rpcUrl, fetch: fetchImpl }
    : rpcUrl;
}

function rpcQuantity(value, ethersLib = ethers) {
  return ethersLib.toQuantity(BigInt(value));
}

async function rpcJsonFetch(fetchImpl, rpcUrl = '', method = '', params = []) {
  const response = await boundedAgentFetch(fetchImpl)(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  const body = await parseJsonResponse(response);
  if (!response?.ok || body?.error) {
    throw new Error('agent_rpc_request_failed');
  }
  return body?.result;
}

async function selectReadyRpcUrl({
  rpcUrls = [],
  chainId = 11155420,
  fetchImpl = globalThis.fetch,
  ethersLib = ethers,
} = {}) {
  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    try {
      const remoteChainId = ethersLib.getNumber(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_chainId', []));
      if (remoteChainId !== Number(chainId)) {
        throw new Error(`chain_id_mismatch:${remoteChainId}`);
      }
      return rpcUrl;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`rpc_network_unavailable: ${safeString(lastError?.message || lastError) || 'all_rpc_urls_failed'}`);
}

async function waitForAccountBalance({
  fetchImpl = globalThis.fetch,
  rpcUrls = [],
  chainId = 11155420,
  accountAddress = '',
  attempts = 6,
  intervalMs = 1000,
  ethersLib = ethers,
} = {}) {
  if (!attempts) return { ok: false, skipped: true, reason: 'balance_wait_disabled' };
  const rpcUrl = await selectReadyRpcUrl({ rpcUrls, chainId, fetchImpl, ethersLib });
  const address = ethersLib.getAddress(accountAddress);
  let lastBalance = BigInt(0);
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      lastBalance = BigInt(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_getBalance', [address, 'latest']));
      if (lastBalance > 0n) {
        return {
          ok: true,
          attempts: i + 1,
          balanceWei: rpcQuantity(lastBalance, ethersLib),
        };
      }
    } catch (error) {
      lastError = error;
    }
    if (i < attempts - 1) await sleepMs(intervalMs);
  }
  return {
    ok: false,
    reason: 'balance_wait_timeout',
    attempts,
    balanceWei: rpcQuantity(lastBalance, ethersLib),
    ...(lastError ? { error: safeString(lastError?.message || lastError) } : {}),
  };
}

async function broadcastSubmitResponsesWithRpc({
  beforeBroadcast,
  onBroadcast,
  fetchImpl = globalThis.fetch,
  rpcUrls = [],
  chainId = 11155420,
  privateKey = '',
  accountAddress = '',
  surveysAddress = '',
  questionId = '',
  responseHash = '',
  ethersLib = ethers,
} = {}) {
  const rpcUrl = await selectReadyRpcUrl({ rpcUrls, chainId, fetchImpl, ethersLib });
  const iface = new ethersLib.Interface(SUBMIT_RESPONSES_ABI);
  const data = iface.encodeFunctionData('submitResponses', [[questionId], [responseHash], HASH_ZERO, HASH_ZERO]);
  const from = ethersLib.getAddress(accountAddress);
  const nonce = BigInt(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_getTransactionCount', [from, 'pending']));
  const gasPrice = BigInt(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_gasPrice', []));
  const estimate = BigInt(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_estimateGas', [{
    from,
    to: surveysAddress,
    data,
    value: '0x0',
  }]));
  const gasLimit = (estimate * 13n) / 10n;
  if (gasLimit <= 0n || gasLimit > 2_000_000n) throw new Error('agent_gas_limit_exceeded');
  const wallet = new ethersLib.Wallet(privateKey);
  const rawTx = await wallet.signTransaction({
    chainId,
    to: surveysAddress,
    data,
    type: 0,
    value: 0n,
    nonce: ethersLib.getNumber(nonce),
    gasLimit,
    gasPrice,
  });
  await beforeBroadcast();
  onBroadcast();
  let txHash;
  try {
    txHash = await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_sendRawTransaction', [rawTx]);
    if (!BYTES32_RE.test(safeString(txHash))) throw new Error('eth_sendRawTransaction_result_unavailable');
  } catch (error) {
    // A lost RPC response does not prove that the signed transaction was rejected.
    // Preserve its public identifier for reconciliation without persisting signer material.
    const failure = error instanceof Error ? error : new Error(safeString(error));
    failure.txHash = ethersLib.keccak256(rawTx);
    throw failure;
  }
  return {
    txHash: safeString(txHash),
    rpcUrl,
    gasLimit: rpcQuantity(gasLimit, ethersLib),
    gasPrice: rpcQuantity(gasPrice, ethersLib),
  };
}

async function parseJsonResponse(response) {
  if (!response || typeof response.json !== 'function') return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function retryAfterSeconds(response) {
  const value = safeString(response?.headers?.get?.('Retry-After'));
  if (!value) return 0;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 0;
}

async function deriveManagedWallet({
  env = {},
  principal = {},
  account = {},
  ethersLib = ethers,
} = {}) {
  const deploymentId = safeString(env.AGENT_CONTEXT.sessionId);
  const privateKey = await deriveDemoPrivateKeyMaterial({
    principal,
    deploymentId,
    rootSecret: env.AGENT_MANAGED_ROOT_SECRET || '',
  });
  const wallet = new ethersLib.Wallet(privateKey);
  if (account.accountAddress && lower(wallet.address) !== lower(account.accountAddress)) {
    throw new Error('managed_account_address_mismatch');
  }
  return { privateKey, wallet, deploymentId };
}

export async function authenticateSessionWorker({ env, account }) {
  await env.AGENT_SERVICES.current();
  const ctx = env.AGENT_CONTEXT;
  if (!ctx.address || account?.accountAddress && lower(account.accountAddress) !== lower(ctx.address)) return { ok: false, reason: 'agent_account_mismatch' };
  return { ok: true, internal: true, accountAddress: ctx.address, sessionId: ctx.sessionId, workerUrl: ctx.origin };
}

export async function requestSessionWorkerFaucet({ env }) {
  return env.AGENT_SERVICES.faucet();
}

function decodeBase64(base64) {
  if (typeof atob === 'function') return atob(base64);
  return Buffer.from(base64, 'base64').toString('binary');
}

export function base64urlToHex(value = '') {
  const text = safeString(value);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(text)) {
    throw new Error('invalid_arweave_transaction_id');
  }
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = decodeBase64(base64);
  const bytes = Array.from(binary, (char) => char.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('invalid_arweave_transaction_hash');
  return `0x${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeAnswerForPayload(answer = {}, questionRef = {}) {
  const type = lower(questionRef.questionType || answer.questionType || answer.controlType || 'freeform');
  if (type === 'quadratic') return { questionType: 'quadratic', value: answer.value };
  if (type === 'rating' || type === 'rating_button') {
    const value = normalizeAgentRatingAnswer(answer.value ?? answer.rating ?? answer.answer ?? answer.label, questionRef);
    if (value === null) throw new Error('rating_answer_invalid');
    return { questionType: 'rating', value };
  }
  if (type === 'agree_unsure_disagree' || type === 'binary') {
    const raw = lower(answer.value || answer.answer || answer.label);
    if (raw === 'agree' || raw === 'yes' || raw === 'true') return { questionType: 'binary', value: 'Agree' };
    if (raw === 'disagree' || raw === 'no' || raw === 'false') return { questionType: 'binary', value: 'Disagree' };
    return { questionType: 'binary', value: 'Unsure' };
  }
  if (type === 'multichoice' || type === 'single_select' || type === 'multi_select_toggle') {
    const raw = Array.isArray(answer.values)
      ? answer.values
      : (Array.isArray(answer.selectedValues) ? answer.selectedValues : [answer.value ?? answer.answer ?? answer.label]);
    return {
      questionType: 'multichoice',
      value: raw.map(safeString).filter(Boolean),
    };
  }
  return {
    questionType: 'freeform',
    value: safeString(answer.text || answer.value || answer.answer || answer.label),
  };
}

export function buildAgentResponsePayload({
  sessionSlug = '',
  questionRef = {},
  answer = {},
  accountAddress = '',
  createdAt = null,
} = {}) {
  const normalized = normalizeAnswerForPayload(answer, questionRef);
  if (questionRef.questionType === 'quadratic' || normalized.questionType === 'quadratic') {
    const error = validateQuadraticAllocation(normalized.value, questionRef);
    if (error) throw new Error(error);
  }
  if (normalized.questionType === 'multichoice') {
    const schema = buildAgentQuestionAnswerSchema(questionRef).answerSchema;
    const values = Array.isArray(answer.values) ? answer.values : [answer.value];
    if (!schema.options || !values.length || new Set(values).size !== values.length || values.length > schema.maxSelections ||
        values.some(value => !schema.options.includes(value))) throw new Error('multichoice_answer_invalid');
  }
  const comments = safeString(answer.comments || answer.additionalComments);
  const payload = {
    timeStamp: createdAt ? new Date(createdAt).getTime() : Date.now(),
    sessionName: safeString(sessionSlug || questionRef.sessionSlug),
    questionID: safeString(questionRef.questionId),
    type: normalized.questionType,
    prompt: safeString(questionRef.prompt || questionRef.questionText || ''),
    conviction: null,
    importance: null,
    answer: {
      value: normalized.value,
      encrypted: false,
      encryptionAudience: 'public',
      encryptionGateId: '',
      audienceMode: 'explicit',
      hash: ['binary', 'multichoice', 'rating', 'quadratic'].includes(normalized.questionType)
        ? ''
        : ethers.id(String(normalized.value || '')),
      encryptedPortion: '',
    },
    additional: {
      value: comments,
      encrypted: false,
      encryptionAudience: 'public',
      encryptionGateId: '',
      audienceMode: 'default',
      hash: comments ? ethers.id(comments) : '',
      encryptedPortion: '',
    },
    source: 'telegram-agent-bridge',
    responder: safeString(accountAddress),
    encryptionRequested: false,
  };
  assertNoSecretShape(payload, "Agent on-chain response payloads must not serialize secrets.");
  return payload;
}

async function uploadResponsePayload({ env, payload, idempotencyKey } = {}) {
  let response;
  try {
    response = await env.AGENT_SERVICES.storage('/storage/upload', { method: 'POST', body: {
      data: payload, contentType: 'application/json', resource: 'responses', requestId: idempotencyKey,
    } });
  } catch (error) {
    if ([400, 401, 403, 410, 413, 422, 429].includes(error?.status)) {
      error.uploadRejected = true;
      error.retryable = error.status === 429;
    }
    throw error;
  }
  const body = await parseJsonResponse(response);
  if (!response?.ok) {
    const error = new Error(`storage_upload_failed: ${safeString(body?.error || response?.status)}`);
    error.status = Number(response?.status) || 0;
    const knownId = safeString(body?.storageRef?.id || body?.id || body?.txId || body?.transactionId);
    if (knownId) error.storageUpload = { id: knownId, storageRef: body?.storageRef || null, backend: safeString(body?.storageRef?.backend || body?.backend) };
    // These admission/validation responses reject before storing the payload.
    // Timeouts, transport errors, and 5xx can follow storage and remain uncertain.
    error.uploadRejected = !knownId && [400, 401, 403, 404, 405, 410, 413, 415, 422, 429].includes(error.status);
    error.retryable = error.status === 429;
    error.retryAfterSeconds = retryAfterSeconds(response);
    throw error;
  }
  const id = safeString(body?.storageRef?.id || body?.id || body?.txId || body?.transactionId);
  if (!id) throw new Error('storage_upload_missing_id');
  return {
    id,
    storageRef: body?.storageRef || null,
    backend: safeString(body?.storageRef?.backend || body?.backend || ''),
  };
}

export async function submitAgentResponseOnChain({
  env = {},
  session = {},
  account = {},
  principal = {},
  questionRef = {},
  answer = {},
  idempotencyKey = '',
  createdAt = null,
  now = new Date(),
  fetchImpl = env.AGENT_FETCH || globalThis.fetch,
  ethersLib = ethers,
  contractFactory = null,
  beforeUpload = null,
  previousOutcome = null,
} = {}) {
  if (!directSubmitFeatureEnabled(env)) {
    return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'direct_submit_disabled' };
  }
  if (session.managedAccountSubmitAllowed !== true) {
    return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'session_direct_submit_not_allowed' };
  }

  const sessionSlug = safeString(session.sessionSlug || questionRef.sessionSlug);
  const qid = safeString(questionRef.questionId);
  if (session.sessionModeProfile?.authority?.mode === 'worker_canonical') {
    if (!sessionSlug || !qid || !idempotencyKey) return { ok: false, skipped: true, reason: 'submission_identity_required' };
    let payload;
    try { payload = buildAgentResponsePayload({ sessionSlug, questionRef, answer, accountAddress: env.AGENT_CONTEXT.address, createdAt }); }
    catch (error) { return { ok: false, reason: safeString(error.message), retryable: false, safeToRetry: true, status: 422 }; }
    try {
      // Reuse the admitted bytes even after a later question wording edit.
      if (typeof beforeUpload === 'function') {
        const admission = await beforeUpload({ payload });
        if (admission?.responsePayload) payload = admission.responsePayload;
        else if (admission) return admission;
      }
      const uploaded = await uploadResponsePayload({ env, payload, idempotencyKey });
      return { ok: true, status: 'direct_submitted', action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE, sessionSlug, questionId: qid,
        accountAddress: env.AGENT_CONTEXT.address, idempotencyKey, storageId: uploaded.id, storageRef: uploaded.storageRef,
        backend: 'cloudflare', txHash: null };
    } catch (error) {
      // Hosted writes use a canonical receipt for these exact bytes. A pending
      // or lost reply can be retried safely; it is not an uncertain chain broadcast.
      return { ok: false, reason: 'hosted_submit_failed', stage: 'upload', retryable: !error.status || error.status >= 500 || [409, 429].includes(error.status),
        safeToRetry: true, reconciliationRequired: false,
        retryAfterSeconds: error.retryAfterSeconds || 0, status: error.status || 503 };
    }
  }
  if (!sessionSlug || !BYTES32_RE.test(qid)) {
    return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'direct_submit_requires_bytes32_question_id' };
  }

  if (![11155420, 84532].includes(normalizeChainId(env, session))) return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'agent_testnet_required' };

  const workerUrl = resolveSessionWorkerUrl(env, session);
  if (!workerUrl) return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'session_worker_url_missing' };
  const surveysAddress = resolveSurveysAddress(env, session);
  if (!surveysAddress) return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'surveys_address_missing' };
  const rpcUrls = resolveRpcUrls(env, session);
  if (!rpcUrls.length && !contractFactory) return { ok: false, skipped: true, retryable: false, safeToRetry: true, reason: 'rpc_url_missing' };

  let auth;
  try {
    auth = await authenticateSessionWorker({
      env,
      session,
      account,
      principal,
      workerUrl,
      fetchImpl,
      ethersLib,
      now,
    });
  } catch (error) {
    return {
      ok: false,
      reason: 'worker_auth_failed',
      error: safeString(error?.message || error),
      retryable: error?.retryable === true,
      safeToRetry: true,
      retryAfterSeconds: Number(error?.retryAfterSeconds) || 0,
      ...(error?.status ? { status: error.status } : {}),
    };
  }
  if (!auth.ok) return { ...auth, retryable: false, safeToRetry: true, reason: auth.reason || 'worker_auth_failed' };

  let admittedPayload;
  try { admittedPayload = buildAgentResponsePayload({ sessionSlug, questionRef, answer, accountAddress: auth.accountAddress, createdAt }); }
  catch (error) { return { ok: false, reason: safeString(error.message), retryable: false, safeToRetry: true, status: 422 }; }
  if (typeof beforeUpload === 'function') {
    try {
      const admission = await beforeUpload({ payload: admittedPayload });
      if (admission?.submissionCreatedAt) {
        createdAt = admission.submissionCreatedAt;
        admittedPayload = admission.responsePayload || admittedPayload;
        previousOutcome = admission.previousOutcome || previousOutcome;
      }
      else if (admission) return admission;
    } catch (error) {
      return { ok: false, reason: 'submission_admission_failed', error: safeString(error?.message || error), retryable: true, safeToRetry: true };
    }
  }

  let faucet = session.sponsoredFaucetAllowed === true
    ? await requestSessionWorkerFaucet({
      env,
      session,
      account,
      principal,
      now,
      fetchImpl,
      ethersLib,
      auth,
    }).catch((error) => ({ ok: false, reason: 'faucet_request_failed', error: safeString(error?.message || error) }))
    : { ok: false, skipped: true, reason: 'session_faucet_not_allowed' };

  let privateKey;
  let storageUpload = null;
  let responseHash = '';
  let tx = null;
  let receipt = null;
  let stage = 'payload';
  try {
    ({ privateKey } = await deriveManagedWallet({ env, principal, account, ethersLib }));
  } catch (error) {
    return { ok: false, reason: safeString(error?.message || error) || 'managed_wallet_unavailable', faucet };
  }

  try {
    const payload = admittedPayload;
    stage = 'upload';
    storageUpload = previousOutcome?.safeToRetry === true && previousOutcome.storageId ? {
      id: previousOutcome.storageId, storageRef: previousOutcome.storageRef, backend: previousOutcome.storageRef?.backend || 'arweave',
    } : await uploadResponsePayload({
      env, idempotencyKey,
      fetchImpl,
      workerUrl,
      token: auth.token,
      payload,
    });
    stage = 'prepare_broadcast';
    responseHash = base64urlToHex(storageUpload.id);
    const storageBackend = lower(storageUpload.backend || storageUpload.storageRef?.backend);
    const chainId = normalizeChainId(env, session);
    const beforeBroadcast = async () => {
      await env.AGENT_SERVICES.current();
      if (!(env.AGENT_CONTEXT.scopes?.storage || env.AGENT_CONTEXT.scopes?.arweave)) throw Object.assign(new Error('agent_submit_scope_denied'), { status: 403 });
    };
    await beforeBroadcast();
    if (typeof contractFactory === 'function') {
      const provider = rpcUrls[0]
        ? new ethersLib.JsonRpcProvider(rpcConnection(rpcUrls[0], fetchImpl), chainId)
        : null;
      const signer = provider ? new ethersLib.Wallet(privateKey, provider) : new ethersLib.Wallet(privateKey);
      const contract = contractFactory({ surveysAddress, abi: SUBMIT_RESPONSES_ABI, signer, ethersLib });
      await beforeBroadcast();
      stage = 'broadcast';
      tx = await contract.submitResponses([qid], [responseHash], HASH_ZERO, HASH_ZERO);
      stage = 'confirmation';
      receipt = typeof tx?.wait === 'function' ? await tx.wait() : null;
    } else {
      if (faucet?.ok === true && faucet.skipped !== true) {
        const waitConfig = faucetBalanceWaitConfig(env);
        const balanceWait = await waitForAccountBalance({
          fetchImpl,
          rpcUrls,
          chainId,
          accountAddress: auth.accountAddress,
          attempts: waitConfig.attempts,
          intervalMs: waitConfig.intervalMs,
          ethersLib,
        }).catch((error) => ({
          ok: false,
          reason: 'balance_wait_failed',
          error: safeString(error?.message || error),
        }));
        faucet = { ...faucet, balanceWait };
      }
      tx = await broadcastSubmitResponsesWithRpc({
        beforeBroadcast,
        onBroadcast: () => { stage = 'broadcast'; },
        fetchImpl,
        rpcUrls,
        chainId,
        privateKey,
        accountAddress: auth.accountAddress,
        surveysAddress,
        questionId: qid,
        responseHash,
        ethersLib,
      });
    }
    return {
      ok: true,
      action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE,
      status: 'direct_submitted',
      idempotencyKey: safeString(idempotencyKey),
      sessionSlug,
      questionId: qid,
      accountAddress: auth.accountAddress,
      txHash: tx?.hash || tx?.txHash || receipt?.transactionHash || null,
      blockNumber: receipt?.blockNumber ?? null,
      storageRef: storageUpload.storageRef,
      storageId: storageUpload.id,
      ...(storageBackend === 'cloudflare' ? {} : { arweaveTxId: storageUpload.id }),
      responseHash,
      surveysAddress,
      chainId,
      faucet,
    };
  } catch (error) {
    if (stage === 'upload' && error?.storageUpload) storageUpload = error.storageUpload;
    return {
      ok: false,
      reason: 'direct_submit_failed',
      error: 'agent_submission_execution_failed',
      retryable: (stage === 'prepare_broadcast' && ![400, 401, 403, 410, 422].includes(error?.status)) || (stage === 'upload' && error?.uploadRejected === true && error?.retryable === true),
      safeToRetry: ['payload', 'prepare_broadcast'].includes(stage) || (stage === 'upload' && error?.uploadRejected === true),
      retryAfterSeconds: Number(error?.retryAfterSeconds) || 0,
      reconciliationRequired: !['payload', 'prepare_broadcast'].includes(stage) && !(stage === 'upload' && error?.uploadRejected === true),
      stage,
      txHash: tx?.hash || tx?.txHash || receipt?.transactionHash || error?.txHash || null,
      storageRef: storageUpload?.storageRef || null,
      storageId: storageUpload?.id || null,
      responseHash: responseHash || null,
      sessionSlug,
      questionId: qid,
      accountAddress: auth.accountAddress,
      surveysAddress,
      chainId: normalizeChainId(env, session),
      faucet,
    };
  }
}
