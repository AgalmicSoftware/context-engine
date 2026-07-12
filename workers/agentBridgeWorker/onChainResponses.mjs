import { ethers } from 'ethers';
import {
  TELEGRAM_BRIDGE_ACTIONS,
} from './constants.mjs';
import {
  deriveDemoPrivateKeyMaterial,
} from './managedAccounts.mjs';
import { assertNoSecretShape } from './redaction.mjs';

const HASH_ZERO = `0x${'0'.repeat(64)}`;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SURVEYS_BY_CHAIN = Object.freeze({
  '11155420': '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
});
const SUBMIT_RESPONSES_ABI = [
  'function submitResponses(bytes32[] questionIds, bytes32[] responseHashes, bytes32 surveyId, bytes32 surveyResponseHash)',
];
const DEFAULT_LOGIN_ORIGIN = 'http://localhost:7391';

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

function jsonHeaders(origin = '') {
  return {
    'content-type': 'application/json',
    ...(origin ? { Origin: origin } : {}),
  };
}

function normalizeBaseUrl(value = '') {
  const text = safeString(value).replace(/\/+$/, '');
  if (!text) return '';
  try {
    const url = new URL(text);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function normalizeOrigin(value = '') {
  const text = safeString(value);
  if (!text) return '';
  try {
    return new URL(text).origin;
  } catch {
    return '';
  }
}

function appendUniqueOrigin(out = [], seen = new Set(), value = '') {
  const origin = normalizeOrigin(value);
  if (!origin || seen.has(origin)) return;
  seen.add(origin);
  out.push(origin);
}

function resolveLoginOriginCandidates(env = {}, session = {}) {
  const configured = safeString(
    env.AGENT_BRIDGE_WORKER_LOGIN_ORIGIN ||
    env.LOCAL_AUTH_ORIGIN ||
    env.AGENT_BRIDGE_PUBLIC_URL
  );
  const seen = new Set();
  const origins = [];
  appendUniqueOrigin(origins, seen, session.workerLoginOrigin);
  appendUniqueOrigin(origins, seen, session.sessionWorkerLoginOrigin);
  appendUniqueOrigin(origins, seen, session.ceSessionWorkerLoginOrigin);
  appendUniqueOrigin(origins, seen, session.loginOrigin);
  (Array.isArray(session.allowOrigins) ? session.allowOrigins : [])
    .forEach((origin) => appendUniqueOrigin(origins, seen, origin));
  appendUniqueOrigin(origins, seen, configured || DEFAULT_LOGIN_ORIGIN);
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://contextengine.xyz',
    'https://www.contextengine.xyz',
    DEFAULT_LOGIN_ORIGIN,
    'http://127.0.0.1:7391',
  ].forEach((origin) => appendUniqueOrigin(origins, seen, origin));
  return origins.length ? origins : [DEFAULT_LOGIN_ORIGIN];
}

function resolveLoginOrigin(env = {}, session = {}) {
  return resolveLoginOriginCandidates(env, session)[0] || DEFAULT_LOGIN_ORIGIN;
}

function isOriginAuthError(error = null) {
  return /Origin not allowed|Untrusted worker login origin|Missing Origin for worker login|SIWE uri origin does not match request Origin/i
    .test(safeString(error?.message || error));
}

export function directSubmitFeatureEnabled(env = {}) {
  const directSubmitFlag = safeString(env.AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED);
  if (envFlagDisabled(directSubmitFlag)) return false;
  const legacyBroadcastFlag = safeString(env.BROADCAST_ENABLED);
  if (envFlagDisabled(legacyBroadcastFlag)) return false;
  if (envFlagEnabled(directSubmitFlag)) return true;
  if (envFlagEnabled(legacyBroadcastFlag)) return true;
  return true;
}

export function resolveSessionWorkerUrl(env = {}, session = {}) {
  return normalizeBaseUrl(
    session.sessionWorkerUrl ||
    session.workerUrl ||
    session.corsWorkerUrl ||
    env.AGENT_BRIDGE_SESSION_WORKER_URL ||
    env.CE_SESSION_WORKER_BASE_URL ||
    env.SESSION_CORS_WORKER_URL ||
    env.SESSION_WORKER_URL ||
    env.CORS_WORKER_URL
  );
}

export function resolveSurveysAddress(env = {}, session = {}) {
  const address = safeString(
    session.surveysAddress ||
    session.surveyAddress ||
    env.AGENT_BRIDGE_SURVEYS_ADDRESS ||
    env.SURVEYS_CONTRACT_ADDRESS ||
    env.SURVEYS_ADDRESS ||
    SURVEYS_BY_CHAIN[String(normalizeChainId(env, session))]
  );
  return ADDRESS_RE.test(address) ? ethers.utils.getAddress(address) : '';
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
    env.AGENT_BRIDGE_RPC_URL,
    env.DEFAULT_RPC_URL,
    env.RPC_URL,
    session.additionalRpcUrl,
    session.fallbackRpcUrl,
    env.AGENT_BRIDGE_ADDITIONAL_RPC_URL,
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function faucetBalanceWaitConfig(env = {}) {
  return {
    attempts: Math.min(20, positiveInteger(env.AGENT_BRIDGE_FAUCET_BALANCE_WAIT_ATTEMPTS, 6)),
    intervalMs: Math.min(5000, positiveInteger(env.AGENT_BRIDGE_FAUCET_BALANCE_WAIT_MS, 1000)),
  };
}

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
  const hex = ethersLib.BigNumber.from(value).toHexString();
  return ethersLib.utils.hexStripZeros(hex) || '0x0';
}

async function rpcJsonFetch(fetchImpl, rpcUrl = '', method = '', params = []) {
  const response = await fetchImpl(rpcUrl, {
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
    const detail = safeString(body?.error?.message || body?.error || response?.status) || 'rpc_request_failed';
    throw new Error(`${method}_failed: ${detail}`);
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
      const remoteChainId = ethersLib.BigNumber.from(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_chainId', [])).toNumber();
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
  const address = ethersLib.utils.getAddress(accountAddress);
  let lastBalance = ethersLib.BigNumber.from(0);
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      lastBalance = ethersLib.BigNumber.from(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_getBalance', [address, 'latest']));
      if (!lastBalance.isZero()) {
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
  const iface = new ethersLib.utils.Interface(SUBMIT_RESPONSES_ABI);
  const data = iface.encodeFunctionData('submitResponses', [[questionId], [responseHash], HASH_ZERO, HASH_ZERO]);
  const from = ethersLib.utils.getAddress(accountAddress);
  const nonce = ethersLib.BigNumber.from(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_getTransactionCount', [from, 'pending']));
  const gasPrice = ethersLib.BigNumber.from(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_gasPrice', []));
  const estimate = ethersLib.BigNumber.from(await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_estimateGas', [{
    from,
    to: surveysAddress,
    data,
    value: '0x0',
  }]));
  const gasLimit = estimate.mul(13).div(10);
  const wallet = new ethersLib.Wallet(privateKey);
  const rawTx = await wallet.signTransaction({
    chainId,
    to: surveysAddress,
    data,
    value: 0,
    nonce: nonce.toNumber(),
    gasLimit,
    gasPrice,
  });
  const txHash = await rpcJsonFetch(fetchImpl, rpcUrl, 'eth_sendRawTransaction', [rawTx]);
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

async function parseTextResponse(response) {
  if (!response || typeof response.text !== 'function') return '';
  try {
    return safeString(await response.text()).replace(/\s+/g, ' ').slice(0, 240);
  } catch {
    return '';
  }
}

async function parseResponseBody(response) {
  if (!response) return { json: {}, text: '' };
  const clone = typeof response.clone === 'function' ? response.clone() : null;
  const json = await parseJsonResponse(response);
  const text = Object.keys(json).length ? '' : await parseTextResponse(clone || response);
  return { json, text };
}

function publicFetchTarget(url = '') {
  const text = safeString(url);
  try {
    const parsed = new URL(text);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return text.split('?')[0].slice(0, 240);
  }
}

async function checkedJsonFetch(fetchImpl, url, init = {}, {
  tokenField = '',
  errorPrefix = 'request_failed',
} = {}) {
  const response = await fetchImpl(url, init);
  const { json: body, text } = await parseResponseBody(response);
  if (!response?.ok || (tokenField && !body?.[tokenField])) {
    const upstream = safeString(body?.error || body?.reason || body?.message || text);
    const status = safeString(response?.status);
    const detail = upstream
      ? (status && upstream !== status ? `${upstream} (${status})` : upstream)
      : (status || 'upstream_error');
    throw new Error(`${errorPrefix}: ${detail} at ${publicFetchTarget(url)}`);
  }
  return { response, body };
}

async function deriveManagedWallet({
  env = {},
  principal = {},
  account = {},
  ethersLib = ethers,
} = {}) {
  const deploymentId = safeString(account.workerDeploymentId || env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo');
  const privateKey = await deriveDemoPrivateKeyMaterial({
    principal,
    deploymentId,
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || env.AGENT_BRIDGE_DEMO_ROOT_SECRET || '',
  });
  const wallet = new ethersLib.Wallet(privateKey);
  if (account.accountAddress && lower(wallet.address) !== lower(account.accountAddress)) {
    throw new Error('managed_account_address_mismatch');
  }
  return { privateKey, wallet, deploymentId };
}

export async function authenticateSessionWorker({
  env = {},
  session = {},
  account = {},
  principal = {},
  workerUrl = '',
  fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch,
  ethersLib = ethers,
  now = new Date(),
} = {}) {
  const baseUrl = normalizeBaseUrl(workerUrl || resolveSessionWorkerUrl(env, session));
  if (!baseUrl) return { ok: false, skipped: true, reason: 'session_worker_url_missing' };
  if (typeof fetchImpl !== 'function') return { ok: false, reason: 'fetch_unavailable' };

  let wallet;
  try {
    ({ wallet } = await deriveManagedWallet({ env, principal, account, ethersLib }));
  } catch (error) {
    return { ok: false, reason: safeString(error?.message || error) || 'managed_wallet_unavailable' };
  }

  const issuedAt = now instanceof Date ? now : new Date(now);
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);
  const configuredWorkerSlug = safeString(
    session.workerSessionSlug ||
    session.sessionWorkerSlug ||
    session.ceSessionWorkerSessionSlug ||
    session.sessionWorkerSessionSlug
  );
  const fallbackSlug = safeString(session.sessionSlug || session.slug);
  const sessionSlugCandidates = [configuredWorkerSlug || fallbackSlug];
  if (sessionSlugCandidates[0]) sessionSlugCandidates.push('');
  const originCandidates = resolveLoginOriginCandidates(env, session);
  let lastAuthError = null;
  for (const origin of originCandidates) {
    const originUrl = new URL(origin);
    for (const authSessionSlug of sessionSlugCandidates) {
      try {
        const nonce = await checkedJsonFetch(fetchImpl, `${baseUrl}/auth/nonce`, {
          method: 'POST',
          headers: jsonHeaders(origin),
          body: JSON.stringify({
            address: wallet.address,
            ...(authSessionSlug ? { sessionSlug: authSessionSlug } : {}),
          }),
        }, {
          tokenField: 'nonce',
          errorPrefix: 'worker_nonce_failed',
        }).then(({ body }) => body.nonce);

        const message = `${originUrl.host} wants you to sign in with your Ethereum account:\n`
          + `${wallet.address}\n\nSign in to Context Engine.\n\n`
          + `URI: ${origin}\nVersion: 1\nChain ID: ${normalizeChainId(env, session)}`
          + `\nNonce: ${nonce}`
          + `\nIssued At: ${issuedAt.toISOString()}`
          + `\nExpiration Time: ${expiresAt.toISOString()}`;
        const signature = await wallet.signMessage(message);
        const login = await checkedJsonFetch(fetchImpl, `${baseUrl}/auth/login`, {
          method: 'POST',
          headers: jsonHeaders(origin),
          body: JSON.stringify({
            address: wallet.address,
            message,
            signature,
            ...(authSessionSlug ? { sessionSlug: authSessionSlug } : {}),
          }),
        }, {
          tokenField: 'token',
          errorPrefix: 'worker_login_failed',
        }).then(({ body }) => body);

        return {
          ok: true,
          token: login.token,
          exp: login.exp || null,
          workerUrl: baseUrl,
          accountAddress: wallet.address,
          origin,
        };
      } catch (error) {
        lastAuthError = error;
        const message = safeString(error?.message || error);
        const shouldRetryWithoutSlug = authSessionSlug && /sessionSlug does not match worker session/i.test(message);
        if (shouldRetryWithoutSlug) continue;
        if (isOriginAuthError(error)) break;
        throw error;
      }
    }
  }

  throw new Error(safeString(lastAuthError?.message || lastAuthError) || 'worker_auth_failed');
}

export async function requestManagedAccountFaucetOnJoin({
  env = {},
  session = {},
  account = {},
  principal = {},
  createdAt = null,
  fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch,
  ethersLib = ethers,
} = {}) {
  if (envFlagDisabled(env.AGENT_BRIDGE_AUTO_FAUCET_ON_JOIN)) {
    return { ok: false, skipped: true, reason: 'auto_faucet_on_join_disabled' };
  }
  if (session.sponsoredFaucetAllowed !== true) {
    return { ok: false, skipped: true, reason: 'session_faucet_not_allowed' };
  }
  return requestSessionWorkerFaucet({
    env,
    session,
    account,
    principal,
    createdAt,
    fetchImpl,
    ethersLib,
  });
}

export async function requestSessionWorkerFaucet({
  env = {},
  session = {},
  account = {},
  principal = {},
  createdAt = null,
  fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch,
  ethersLib = ethers,
  auth = null,
} = {}) {
  const login = auth || await authenticateSessionWorker({
    env,
    session,
    account,
    principal,
    fetchImpl,
    ethersLib,
    now: createdAt ? new Date(createdAt) : new Date(),
  });
  if (!login.ok) return login;

  const response = await fetchImpl(`${login.workerUrl}/`, {
    method: 'POST',
    headers: {
      ...jsonHeaders(login.origin || resolveLoginOrigin(env, session)),
      Authorization: `Bearer ${login.token}`,
    },
    body: JSON.stringify({
      action: 'request_test_eth',
      sessionSlug: safeString(session.sessionSlug || session.slug),
      to: login.accountAddress,
    }),
  });
  const body = await parseJsonResponse(response);
  const balanceAlreadyFunded = response?.status === 403 && /^Balance above threshold/i.test(safeString(body?.error));
  if (!response?.ok && !balanceAlreadyFunded) {
    return {
      ok: false,
      reason: 'faucet_request_failed',
      status: response?.status || 0,
      error: safeString(body?.error || body?.reason || response?.status),
      workerUrl: login.workerUrl,
      accountAddress: login.accountAddress,
    };
  }
  return {
    ok: true,
    reason: balanceAlreadyFunded ? 'faucet_balance_above_threshold' : 'faucet_requested',
    skipped: balanceAlreadyFunded,
    status: response?.status || 200,
    amountEth: body?.amountEth || body?.amount || null,
    balanceEth: body?.balanceEth || null,
    txHash: body?.txHash || body?.hash || null,
    workerUrl: login.workerUrl,
    accountAddress: login.accountAddress,
  };
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

function normalizeAnswerForPayload(answer = {}) {
  const type = lower(answer.questionType || answer.controlType || 'freeform');
  if (type === 'rating' || type === 'rating_button') {
    const value = Number(answer.value ?? answer.rating ?? answer.answer ?? answer.label);
    return { questionType: 'rating', value: Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0 };
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

export function buildTelegramResponsePayload({
  sessionSlug = '',
  questionRef = {},
  answer = {},
  accountAddress = '',
  createdAt = null,
} = {}) {
  const normalized = normalizeAnswerForPayload(answer);
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
      hash: ['binary', 'multichoice', 'rating'].includes(normalized.questionType)
        ? ''
        : ethers.utils.id(String(normalized.value || '')),
      encryptedPortion: '',
    },
    additional: {
      value: comments,
      encrypted: false,
      encryptionAudience: 'public',
      encryptionGateId: '',
      audienceMode: 'default',
      hash: comments ? ethers.utils.id(comments) : '',
      encryptedPortion: '',
    },
    source: 'telegram-agent-bridge',
    responder: safeString(accountAddress),
    encryptionRequested: false,
  };
  assertNoSecretShape(payload, 'Telegram on-chain response payloads must not serialize secrets.');
  return payload;
}

async function uploadResponsePayload({
  fetchImpl,
  workerUrl,
  token,
  payload,
} = {}) {
  const response = await fetchImpl(`${workerUrl}/storage/upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: payload,
      contentType: 'application/json',
      resource: 'responses',
    }),
  });
  const body = await parseJsonResponse(response);
  if (!response?.ok) {
    throw new Error(`storage_upload_failed: ${safeString(body?.error || response?.status)}`);
  }
  const id = safeString(body?.storageRef?.id || body?.id || body?.txId || body?.transactionId);
  if (!id) throw new Error('storage_upload_missing_id');
  return {
    id,
    storageRef: body?.storageRef || null,
    backend: safeString(body?.storageRef?.backend || body?.backend || ''),
  };
}

export async function submitTelegramResponseOnChain({
  env = {},
  session = {},
  account = {},
  principal = {},
  questionRef = {},
  answer = {},
  idempotencyKey = '',
  createdAt = null,
  fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch,
  ethersLib = ethers,
  contractFactory = null,
} = {}) {
  if (!directSubmitFeatureEnabled(env)) {
    return { ok: false, skipped: true, reason: 'direct_submit_disabled' };
  }
  if (session.managedAccountSubmitAllowed !== true) {
    return { ok: false, skipped: true, reason: 'session_direct_submit_not_allowed' };
  }

  const sessionSlug = safeString(session.sessionSlug || questionRef.sessionSlug);
  const qid = safeString(questionRef.questionId);
  if (!sessionSlug || !BYTES32_RE.test(qid)) {
    return { ok: false, skipped: true, reason: 'direct_submit_requires_bytes32_question_id' };
  }

  const workerUrl = resolveSessionWorkerUrl(env, session);
  if (!workerUrl) return { ok: false, skipped: true, reason: 'session_worker_url_missing' };
  const surveysAddress = resolveSurveysAddress(env, session);
  if (!surveysAddress) return { ok: false, skipped: true, reason: 'surveys_address_missing' };
  const rpcUrls = resolveRpcUrls(env, session);
  if (!rpcUrls.length && !contractFactory) return { ok: false, skipped: true, reason: 'rpc_url_missing' };

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
      now: createdAt ? new Date(createdAt) : new Date(),
    });
  } catch (error) {
    return { ok: false, reason: 'worker_auth_failed', error: safeString(error?.message || error) };
  }
  if (!auth.ok) return { ...auth, reason: auth.reason || 'worker_auth_failed' };

  let faucet = session.sponsoredFaucetAllowed === true
    ? await requestSessionWorkerFaucet({
      env,
      session,
      account,
      principal,
      createdAt,
      fetchImpl,
      ethersLib,
      auth,
    }).catch((error) => ({ ok: false, reason: 'faucet_request_failed', error: safeString(error?.message || error) }))
    : { ok: false, skipped: true, reason: 'session_faucet_not_allowed' };

  let privateKey;
  try {
    ({ privateKey } = await deriveManagedWallet({ env, principal, account, ethersLib }));
  } catch (error) {
    return { ok: false, reason: safeString(error?.message || error) || 'managed_wallet_unavailable', faucet };
  }

  try {
    const payload = buildTelegramResponsePayload({
      sessionSlug,
      questionRef,
      answer,
      accountAddress: auth.accountAddress,
      createdAt,
    });
    const storageUpload = await uploadResponsePayload({
      fetchImpl,
      workerUrl,
      token: auth.token,
      payload,
    });
    const responseHash = base64urlToHex(storageUpload.id);
    const storageBackend = lower(storageUpload.backend || storageUpload.storageRef?.backend);
    const chainId = normalizeChainId(env, session);
    let tx = null;
    let receipt = null;
    if (typeof contractFactory === 'function') {
      const provider = rpcUrls[0]
        ? new ethersLib.providers.JsonRpcProvider(rpcConnection(rpcUrls[0], fetchImpl), chainId)
        : null;
      const signer = provider ? new ethersLib.Wallet(privateKey, provider) : new ethersLib.Wallet(privateKey);
      const contract = contractFactory({ surveysAddress, abi: SUBMIT_RESPONSES_ABI, signer, ethersLib });
      tx = await contract.submitResponses([qid], [responseHash], HASH_ZERO, HASH_ZERO);
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
      action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
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
    return {
      ok: false,
      reason: 'direct_submit_failed',
      error: safeString(error?.message || error) || 'direct_submit_failed',
      sessionSlug,
      questionId: qid,
      accountAddress: auth.accountAddress,
      surveysAddress,
      chainId: normalizeChainId(env, session),
      faucet,
    };
  }
}

export const __test__onChainResponses = {
  HASH_ZERO,
  SUBMIT_RESPONSES_ABI,
  broadcastSubmitResponsesWithRpc,
  normalizeAnswerForPayload,
  resolveRpcUrls,
  resolveLoginOrigin,
  selectReadyRpcUrl,
  waitForAccountBalance,
  uploadResponsePayload,
};
