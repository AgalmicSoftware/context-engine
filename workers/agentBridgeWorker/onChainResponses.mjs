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
    ...(origin ? { origin, Origin: origin } : {}),
  };
}

function normalizeBaseUrl(value = '') {
  const text = safeString(value).replace(/\/+$/, '');
  if (!text) return '';
  try {
    return new URL(text).toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function resolveLoginOrigin(env = {}) {
  const configured = safeString(env.AGENT_BRIDGE_WORKER_LOGIN_ORIGIN || env.LOCAL_AUTH_ORIGIN);
  const origin = configured || DEFAULT_LOGIN_ORIGIN;
  try {
    return new URL(origin).origin;
  } catch {
    return DEFAULT_LOGIN_ORIGIN;
  }
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

function resolveRpcUrl(env = {}, session = {}) {
  return safeString(
    session.rpcUrl ||
    session.defaultRpcUrl ||
    env.AGENT_BRIDGE_RPC_URL ||
    env.DEFAULT_RPC_URL ||
    env.RPC_URL
  );
}

function normalizeChainId(env = {}, session = {}) {
  const value = Number(session.chainId || env.DEFAULT_CHAIN_ID || 11155420);
  return Number.isInteger(value) && value > 0 ? value : 11155420;
}

async function parseJsonResponse(response) {
  if (!response || typeof response.json !== 'function') return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function checkedJsonFetch(fetchImpl, url, init = {}, {
  tokenField = '',
  errorPrefix = 'request_failed',
} = {}) {
  const response = await fetchImpl(url, init);
  const body = await parseJsonResponse(response);
  if (!response?.ok || (tokenField && !body?.[tokenField])) {
    const upstream = safeString(body?.error || body?.reason || response?.status);
    throw new Error(`${errorPrefix}: ${upstream || 'upstream_error'}`);
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

  const origin = resolveLoginOrigin(env);
  const sessionSlug = safeString(session.sessionSlug || session.slug);
  const nonce = await checkedJsonFetch(fetchImpl, `${baseUrl}/auth/nonce`, {
    method: 'POST',
    headers: jsonHeaders(origin),
    body: JSON.stringify({ address: wallet.address, sessionSlug }),
  }, {
    tokenField: 'nonce',
    errorPrefix: 'worker_nonce_failed',
  }).then(({ body }) => body.nonce).catch((error) => {
    throw new Error(safeString(error?.message || error) || 'worker_nonce_failed');
  });

  const issuedAt = now instanceof Date ? now : new Date(now);
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);
  const originUrl = new URL(origin);
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
      sessionSlug,
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
  };
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
      ...jsonHeaders(resolveLoginOrigin(env)),
      authorization: `Bearer ${login.token}`,
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
  const response = await fetchImpl(`${workerUrl}/arweave/upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: JSON.stringify(payload),
      contentType: 'application/json',
    }),
  });
  const body = await parseJsonResponse(response);
  if (!response?.ok) {
    throw new Error(`arweave_upload_failed: ${safeString(body?.error || response?.status)}`);
  }
  const txId = safeString(body?.id || body?.txId || body?.transactionId);
  if (!txId) throw new Error('arweave_upload_missing_transaction_id');
  return txId;
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
  const rpcUrl = resolveRpcUrl(env, session);
  if (!rpcUrl && !contractFactory) return { ok: false, skipped: true, reason: 'rpc_url_missing' };

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

  const faucet = session.sponsoredFaucetAllowed === true
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
    const arweaveTxId = await uploadResponsePayload({
      fetchImpl,
      workerUrl,
      token: auth.token,
      payload,
    });
    const responseHash = base64urlToHex(arweaveTxId);
    const provider = rpcUrl ? new ethersLib.providers.JsonRpcProvider(rpcUrl, normalizeChainId(env, session)) : null;
    const signer = provider ? new ethersLib.Wallet(privateKey, provider) : new ethersLib.Wallet(privateKey);
    const contract = typeof contractFactory === 'function'
      ? contractFactory({ surveysAddress, abi: SUBMIT_RESPONSES_ABI, signer, ethersLib })
      : new ethersLib.Contract(surveysAddress, SUBMIT_RESPONSES_ABI, signer);
    const tx = await contract.submitResponses([qid], [responseHash], HASH_ZERO, HASH_ZERO);
    const receipt = typeof tx?.wait === 'function' ? await tx.wait() : null;
    return {
      ok: true,
      action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
      status: 'direct_submitted',
      idempotencyKey: safeString(idempotencyKey),
      sessionSlug,
      questionId: qid,
      accountAddress: auth.accountAddress,
      txHash: tx?.hash || receipt?.transactionHash || null,
      blockNumber: receipt?.blockNumber ?? null,
      arweaveTxId,
      responseHash,
      surveysAddress,
      chainId: normalizeChainId(env, session),
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
  normalizeAnswerForPayload,
  resolveLoginOrigin,
  uploadResponsePayload,
};
