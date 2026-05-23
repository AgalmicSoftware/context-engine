import { setTimeout as nativeSetTimeout, clearTimeout as nativeClearTimeout } from 'node:timers';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { ethers } from 'ethers';
import { decodeTokenPayload, verifyJwt, signJwt } from './jwt.mjs';
import { debug, warn, error } from './log.mjs';
import {
  decryptFromFile,
  encryptToFile,
  isEncryptedFile,
  migrateToEncrypted,
  writeSecureFile,
} from './keyEncryption.mjs';
import { requireLocalJwtAuth as requireAuth } from './localAuth.mjs';
import { listScopedSessions, getCorsWorkerUrl, getSessionMetadata } from './sessions.mjs';
import {
  CE_SESSION_SCAN_SCOPE,
  CE_SESSION_SCAN_SLUGS,
  DEFAULT_CHAIN_ID,
  DEFAULT_CHAIN_METADATA,
  resolveRpcUrlsForChain,
} from './constants.mjs';
import {
  fetchQuestionIds,
  getRandomUnseen,
  getMergedAnsweredQuestionIds,
  formatQuestionForTerminal,
  warmQuestionCache,
  clearServed,
} from './questions.mjs';
import { submitResponses as submitOnChain, submitQuestions, canSubmit } from './submit.mjs';
import { isTrustedLocalRequest } from './localRequest.mjs';
import { recordConfirmedSubmission } from './submissionState.mjs';
import {
  attachStorageRefCompatibilityFields,
  getLegacyArweaveTxId,
  resolvePayloadStorageRef,
} from './storageRefs.mjs';

const LOCAL_AUTH_ORIGIN = 'http://localhost:7391';
import { normalizeConfiguredSessions } from '../public/js/sessionSlugs.mjs';
import {
  deriveResponseGateOptionsFromMetadata,
  normalizeResponseAudienceSelections,
  isEncryptedAudience,
} from './responseAudience.mjs';
import { buildAgentCapabilities } from './agent/capabilities.mjs';
import {
  buildAgentError,
  buildAgentOk,
  normalizeAgentQuestionPayload,
  redactAgentSensitiveFields,
  isValidAgentGrantId,
  normalizeAgentGrant,
  summarizeAgentRequestStatusCounts,
  summarizePendingResponseForAgent,
  summarizeRequestForAgent,
} from './agent/schemas.mjs';
import {
  AGENT_REQUEST_STATUS,
  AGENT_REQUEST_TYPES,
  buildApprovalRequiredResponse,
  buildAgentRequestFingerprint,
  buildAgentRequestRecord,
  createApprovalRequestId,
  isValidApprovalRequestId,
  normalizeAgentIdempotencyKey,
} from './agent/approvalResponses.mjs';
import {
  AGENT_ACCOUNT_SIGNER_BOUNDARIES,
  AGENT_BRIDGE_EVENT_TYPES,
  normalizeAgentBridgeEvent,
  normalizeAgentCreatedAccountMetadata,
} from './agent/bridgePrimitives.mjs';
import {
  AGENT_EXECUTION_POLICIES,
  AGENT_GRANT_SCOPES,
  AGENT_RISK_LEVELS,
  buildAgentGrantFromConnectRequest,
  evaluateAgentConnectRequestApproval,
  evaluateAgentRequestLifecycle,
  evaluateScopedDelegatedExecutionGrant,
  normalizeAgentConnectRequest,
  normalizeAgentGrantLifecycle,
  validateAgentConnectRequestForCreation,
} from './agent/lifecycle.mjs';
import { AGENT_ACTION_IDS } from './agent/actionInventory.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(process.env.CE_CC_DATA_DIR || resolve(__dirname, '..', '.data'));
const RESPONSES_DIR = resolve(DATA_DIR, 'responses');
const WORKER_TOKENS_DIR = resolve(DATA_DIR, 'worker-tokens');
const CONFIRMED_SUBMISSIONS_DIR = resolve(DATA_DIR, 'confirmed-submissions');
const AGENT_REQUESTS_DIR = resolve(DATA_DIR, 'agent-requests');
const AGENT_GRANTS_DIR = resolve(DATA_DIR, 'agent-grants');
const AGENT_ACCOUNTS_DIR = resolve(DATA_DIR, 'agent-accounts');
const AGENT_EVENTS_DIR = resolve(DATA_DIR, 'agent-events');
const SETTINGS_PATH = resolve(DATA_DIR, 'settings.json');
const DEFAULT_HOOK_COOLDOWN_MS = 45_000;
const MAX_HOOK_COOLDOWN_MS = 600_000;
const RESPONSE_COOLDOWN_INCREMENT_MS = 120_000;
const AUTO_SUBMIT_AWAIT_TIMEOUT_MS_DEFAULT = 30_000;
const DEFAULT_QUESTION_SURFACING_MODE = 'manual';
const QUESTION_SURFACING_MODES = new Set(['manual', 'idle', 'ambient']);
function getAutoSubmitAwaitTimeoutMs() {
  const raw = Number(process.env.CE_CC_AUTO_SUBMIT_AWAIT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : AUTO_SUBMIT_AWAIT_TIMEOUT_MS_DEFAULT;
}
const FAUCET_THRESHOLD_ETH = '0.001';
const FAUCET_THRESHOLD_WEI = ethers.utils.parseEther(FAUCET_THRESHOLD_ETH);
const SESSION_SLUG_RE = /^[a-z0-9_-]+$/i;
const MAX_SESSION_SLUG_LENGTH = 128;
const CONFIG_SESSION_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const MAX_ANSWER_LENGTH = 10_000;
const DEFAULT_SUBMIT_SETTINGS = Object.freeze({
  submitMode: 'immediate',
  autoSubmitResponses: true,
  batchSize: 5,
});

function normalizeHookCooldownMs(value, fallback = DEFAULT_HOOK_COOLDOWN_MS) {
  const raw = Number(value);
  const fallbackNum = Number(fallback);
  const base = Number.isFinite(raw)
    ? raw
    : (Number.isFinite(fallbackNum) ? fallbackNum : DEFAULT_HOOK_COOLDOWN_MS);
  return Math.max(0, Math.min(MAX_HOOK_COOLDOWN_MS, Math.floor(base)));
}

function normalizeBooleanConfig(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeQuestionSurfacingMode(value, fallback = DEFAULT_QUESTION_SURFACING_MODE) {
  const normalized = String(value || '').trim().toLowerCase();
  return QUESTION_SURFACING_MODES.has(normalized) ? normalized : fallback;
}

function validateQuestionSurfacingMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!QUESTION_SURFACING_MODES.has(normalized)) {
    return {
      ok: false,
      error: `questionSurfacingMode must be one of: ${[...QUESTION_SURFACING_MODES].join(', ')}.`,
    };
  }
  return { ok: true, mode: normalized };
}

function withHookConfigDefaults(config = {}) {
  const raw = config && typeof config === 'object' ? config : {};
  return {
    serverUrl: 'http://localhost:7391',
    ...raw,
    questionSurfacingMode: normalizeQuestionSurfacingMode(raw.questionSurfacingMode),
    ambientInterruptions: normalizeBooleanConfig(raw.ambientInterruptions, false),
    statuslineQuestionHints: normalizeBooleanConfig(raw.statuslineQuestionHints, true),
  };
}

// Hook config lives in the installed plugin state dir (shared with hook.mjs)
// The hook is installed at ~/.claude/plugins/contextEngine-cc/ — state must match
const HOOK_STATE_DIR = resolve(
  process.env.CE_CC_HOOK_STATE_DIR ||
  resolve(homedir(), '.claude', 'plugins', 'contextEngine-cc', '.state')
);
const HOOK_CONFIG_PATH = resolve(HOOK_STATE_DIR, 'config.json');
const HOOK_COOLDOWN_PATH = resolve(HOOK_STATE_DIR, 'last-ts');
const HOOK_DASHBOARD_PATH = resolve(HOOK_STATE_DIR, 'dashboard.json');
// Prevent concurrent routes from submitting the same local pending response twice.
const pendingResponseSubmissionLocks = new Set();

function loadHookConfig() {
  if (!existsSync(HOOK_CONFIG_PATH)) return withHookConfigDefaults();
  try { return withHookConfigDefaults(JSON.parse(readFileSync(HOOK_CONFIG_PATH, 'utf8'))); }
  catch { return withHookConfigDefaults(); }
}

function loadHookDashboardState() {
  if (!existsSync(HOOK_DASHBOARD_PATH)) return null;
  try { return JSON.parse(readFileSync(HOOK_DASHBOARD_PATH, 'utf8')); }
  catch { return null; }
}

function loadHookTimestamp(path) {
  if (!existsSync(path)) return null;
  const raw = Number(readFileSync(path, 'utf8').trim());
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function saveHookConfig(config) {
  mkdirSync(HOOK_STATE_DIR, { recursive: true });
  writeSecureFile(HOOK_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getSelectedHookSessions(config = {}) {
  return normalizeConfiguredSessions({
    selectedSessions: config.selectedSessions,
  });
}

function getConfiguredSessions(config = {}) {
  return normalizeConfiguredSessions({
    selectedSessions: config.selectedSessions,
    defaultSession: config.defaultSession,
  });
}

function getHookCooldownState(config = {}) {
  const totalMs = normalizeHookCooldownMs(config.cooldownMs);
  const lastShownAt = loadHookTimestamp(HOOK_COOLDOWN_PATH);
  const elapsedMs = lastShownAt ? Math.max(0, Date.now() - lastShownAt) : 0;
  const remainingMs = lastShownAt ? Math.max(0, totalMs - elapsedMs) : 0;
  return {
    totalMs,
    lastShownAt,
    remainingMs,
    active: remainingMs > 0,
  };
}

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return { ...DEFAULT_SUBMIT_SETTINGS };
  try {
    return normalizeSubmitSettings(JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')));
  } catch {
    return { ...DEFAULT_SUBMIT_SETTINGS };
  }
}

function saveSettings(settings) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeSecureFile(SETTINGS_PATH, JSON.stringify(normalizeSubmitSettings(settings), null, 2));
}

function normalizeSubmitSettings(settings = {}) {
  const explicitAutoSubmitResponses = typeof settings?.autoSubmitResponses === 'boolean'
    ? settings.autoSubmitResponses
    : null;
  const normalizedMode = settings?.submitMode === 'batch' ? 'batch' : 'immediate';
  const autoSubmitResponses = explicitAutoSubmitResponses == null
    ? normalizedMode !== 'batch'
    : explicitAutoSubmitResponses;

  return {
    submitMode: autoSubmitResponses ? 'immediate' : 'batch',
    autoSubmitResponses,
    batchSize: Math.max(1, Math.min(50, Number(settings?.batchSize) || DEFAULT_SUBMIT_SETTINGS.batchSize)),
  };
}

function applySubmitSettingsUpdate(current = loadSettings(), patch = {}) {
  const base = normalizeSubmitSettings(current);
  const next = {
    ...base,
  };

  if (patch?.batchSize !== undefined) {
    next.batchSize = patch.batchSize;
  }
  if (typeof patch?.autoSubmitResponses === 'boolean') {
    next.autoSubmitResponses = patch.autoSubmitResponses;
  } else if (patch?.submitMode !== undefined) {
    next.autoSubmitResponses = patch.submitMode !== 'batch';
  }

  return normalizeSubmitSettings(next);
}

function buildPublicSubmitSettings(settings = loadSettings()) {
  const normalized = normalizeSubmitSettings(settings);
  return {
    ...normalized,
    chainId: DEFAULT_CHAIN_ID,
    chainName: DEFAULT_CHAIN_METADATA.name,
    txExplorerTxBaseUrl: DEFAULT_CHAIN_METADATA.txExplorerTxBaseUrl,
  };
}

function buildPublicHookConfig(config = loadHookConfig()) {
  const { defaultConviction: _unusedDefaultConviction, ...publicConfig } = withHookConfigDefaults(config);
  return {
    ...publicConfig,
    chainId: DEFAULT_CHAIN_ID,
    chainName: DEFAULT_CHAIN_METADATA.name,
    txExplorerTxBaseUrl: DEFAULT_CHAIN_METADATA.txExplorerTxBaseUrl,
  };
}

function saveWorkerToken(slug, token) {
  mkdirSync(WORKER_TOKENS_DIR, { recursive: true });
  const file = resolve(WORKER_TOKENS_DIR, `${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}.jwt`);
  writeSecureFile(file, token);
}

function loadWorkerToken(slug) {
  const file = resolve(WORKER_TOKENS_DIR, `${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}.jwt`);
  if (!existsSync(file)) return null;
  try { return readFileSync(file, 'utf8').trim(); }
  catch { return null; }
}

function loadValidatedWorkerToken(slug, walletAddress = '') {
  const tokenStr = loadWorkerToken(slug);
  if (!tokenStr) return null;
  const validation = validateWorkerToken(tokenStr, {
    session: slug,
    walletAddress,
  });
  if (!validation.ok) {
    debug(`[auth] Ignoring invalid worker token for ${slug}: ${validation.error}`);
    return null;
  }
  return tokenStr;
}

function getWorkerTokenStatus(slug, walletAddress = '') {
  const tokenStr = loadWorkerToken(slug);
  if (!tokenStr) {
    return { session: slug, status: 'missing', expired: false };
  }

  const validation = validateWorkerToken(tokenStr, {
    session: slug,
    walletAddress,
  });
  if (!validation.ok) {
    const loweredError = String(validation.error || '').toLowerCase();
    const expired = loweredError.includes('expired');
    return {
      session: slug,
      status: expired ? 'expired' : 'invalid',
      expired,
      error: validation.error,
    };
  }

  return {
    session: slug,
    status: 'valid',
    expired: false,
    expiresAt: validation.payload?.exp
      ? new Date(Number(validation.payload.exp) * 1000).toISOString()
      : null,
  };
}

function summarizeWorkerTokenStatuses(slugs = [], walletAddress = '') {
  const sessions = (Array.isArray(slugs) ? slugs : []).map((slug) => getWorkerTokenStatus(slug, walletAddress));
  const validSessions = sessions.filter((entry) => entry.status === 'valid').map((entry) => entry.session);
  const missingSessions = sessions.filter((entry) => entry.status === 'missing').map((entry) => entry.session);
  const expiredSessions = sessions.filter((entry) => entry.status === 'expired').map((entry) => entry.session);
  const invalidSessions = sessions.filter((entry) => entry.status === 'invalid').map((entry) => entry.session);
  const needsAttentionCount = missingSessions.length + expiredSessions.length + invalidSessions.length;

  return {
    ready: needsAttentionCount === 0,
    total: sessions.length,
    validCount: validSessions.length,
    missingCount: missingSessions.length,
    expiredCount: expiredSessions.length,
    invalidCount: invalidSessions.length,
    needsAttentionCount,
    validSessions,
    missingSessions,
    expiredSessions,
    invalidSessions,
    sessions,
  };
}

function getResponseFilePath(slug, questionId) {
  return resolve(RESPONSES_DIR, slug, `${String(questionId || '').replace(/[^a-fA-F0-9x]/g, '_')}.json`);
}

function getAgentRequestFilePath(requestId) {
  const id = String(requestId || '').trim();
  if (!isValidApprovalRequestId(id)) return null;
  return resolve(AGENT_REQUESTS_DIR, `${id}.json`);
}

function getAgentGrantFilePath(grantId) {
  const id = String(grantId || '').trim();
  if (!isValidAgentGrantId(id)) return null;
  return resolve(AGENT_GRANTS_DIR, `${id}.json`);
}

function getTrustedAgentServerUrl() {
  const configured = loadHookConfig().serverUrl;
  const validation = validateLoopbackServerUrl(configured);
  return validation.ok ? validation.serverUrl : LOCAL_AUTH_ORIGIN;
}

function saveAgentRequest(record = {}) {
  const file = getAgentRequestFilePath(record.requestId);
  if (!file) throw new Error('Invalid agent request id.');
  mkdirSync(AGENT_REQUESTS_DIR, { recursive: true });
  writeSecureFile(file, JSON.stringify(record, null, 2));
  return record;
}

function loadAgentRequest(requestId) {
  const file = getAgentRequestFilePath(requestId);
  if (!file || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function loadAgentRequestsForWallet(walletAddress = '') {
  if (!existsSync(AGENT_REQUESTS_DIR)) return [];
  const wallet = normalizeAddressLower(walletAddress);
  return readdirSync(AGENT_REQUESTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try { return JSON.parse(readFileSync(resolve(AGENT_REQUESTS_DIR, file), 'utf8')); }
      catch { return null; }
    })
    .filter((entry) => entry && (!wallet || normalizeAddressLower(entry.requester) === wallet));
}

function loadAgentRequestByIdempotencyKey(walletAddress = '', idempotencyKey = '') {
  const normalizedKey = normalizeAgentIdempotencyKey(idempotencyKey);
  if (!normalizedKey) return null;
  return loadAgentRequestsForWallet(walletAddress)
    .find((entry) => normalizeAgentIdempotencyKey(entry?.idempotencyKey) === normalizedKey) || null;
}

function agentRequestMatchesSession(request = {}, sessionSlug = '') {
  const requestedSession = String(sessionSlug || '').trim().toLowerCase();
  if (!requestedSession) return true;
  if (String(request?.session || '').trim().toLowerCase() === requestedSession) return true;

  const requestedSessions = [
    ...(Array.isArray(request?.requestedSessions) ? request.requestedSessions : []),
    ...(Array.isArray(request?.payload?.requestedSessions) ? request.payload.requestedSessions : []),
  ];
  return requestedSessions.some((entry) => (
    String(entry || '').trim().toLowerCase() === requestedSession
  ));
}

function saveAgentGrant(record = {}) {
  const file = getAgentGrantFilePath(record.grantId);
  if (!file) throw new Error('Invalid agent grant id.');
  mkdirSync(AGENT_GRANTS_DIR, { recursive: true });
  writeSecureFile(file, JSON.stringify(normalizeAgentGrantLifecycle(record), null, 2));
  return normalizeAgentGrantLifecycle(record);
}

function loadAgentGrant(grantId) {
  const file = getAgentGrantFilePath(grantId);
  if (!file || !existsSync(file)) return null;
  try {
    return normalizeAgentGrantLifecycle(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

function loadAgentGrantsForWallet(walletAddress = '') {
  if (!existsSync(AGENT_GRANTS_DIR)) return [];
  const wallet = normalizeAddressLower(walletAddress);
  return readdirSync(AGENT_GRANTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try { return normalizeAgentGrantLifecycle(JSON.parse(readFileSync(resolve(AGENT_GRANTS_DIR, file), 'utf8'))); }
      catch { return null; }
    })
    .filter((entry) => entry && (!wallet || normalizeAddressLower(entry.humanPrincipal) === wallet));
}

function summarizeAgentGrantForRead(grant = {}) {
  return normalizeAgentGrantLifecycle(grant);
}

function summarizeAgentRequestForRead(request = {}) {
  const lifecycle = evaluateAgentRequestLifecycle(request);
  const normalized = { ...request };
  if (lifecycle.status) normalized.status = lifecycle.status;
  if (lifecycle.ok !== true || normalized.status !== 'pending_approval') {
    normalized.requiresApproval = false;
  }
  return {
    summary: summarizeRequestForAgent(normalized),
    lifecycle,
  };
}

function createAgentGrantIdFromConnectRequestId(requestId = '') {
  const suffix = String(requestId || '')
    .trim()
    .toLowerCase()
    .replace(/^agent_req_/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 96);
  return `agent_grant_${suffix || 'connect'}`;
}

function summarizeAgentConnectRequestForRead(request = {}) {
  const normalized = normalizeAgentConnectRequest(request);
  const lifecycle = evaluateAgentRequestLifecycle(normalized);
  if (lifecycle.status) normalized.status = lifecycle.status;
  return {
    connectRequest: {
      type: normalized.type,
      version: normalized.version,
      requestId: normalized.requestId,
      status: normalized.status,
      requiresApproval: normalized.status === AGENT_REQUEST_STATUS.PENDING_APPROVAL && lifecycle.ok,
      terminal: lifecycle.ok !== true || normalized.status !== AGENT_REQUEST_STATUS.PENDING_APPROVAL,
      approvalUrl: normalized.approvalUrl,
      humanPrincipal: normalized.humanPrincipal,
      agentId: normalized.agentId,
      subject: normalized.subject,
      requestedScopes: normalized.requestedScopes,
      requestedSessions: normalized.requestedSessions,
      requestedActions: normalized.requestedActions,
      riskCeiling: normalized.riskCeiling,
      executionPolicy: normalized.executionPolicy,
      auditRequired: normalized.auditRequired,
      idempotencyKey: normalized.idempotencyKey,
      fingerprint: normalized.fingerprint,
      grantId: normalized.grantId,
      expiresAt: normalized.expiresAt,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      approvedAt: normalized.approvedAt,
      deniedAt: normalized.deniedAt,
      signingAuthority: false,
      workerTokenAuthority: false,
      privateKeyAuthority: false,
      longLivedBearerAuthority: false,
    },
    lifecycle,
  };
}

function isAgentConnectApprovalOverrideAttempt(body = {}) {
  const forbiddenFields = [
    'agentId',
    'subject',
    'humanPrincipal',
    'principal',
    'requester',
    'requestedScopes',
    'scopes',
    'scope',
    'requestedSessions',
    'sessions',
    'session',
    'requestedActions',
    'allowedActions',
    'action',
    'riskCeiling',
    'executionPolicy',
    'auditRequired',
    'expiresAt',
    'fingerprint',
    'grantId',
    'signingAuthority',
    'workerTokenAuthority',
    'privateKeyAuthority',
    'longLivedBearerAuthority',
  ];
  return forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(body || {}, field));
}

function stableAgentHash(value, length = 16) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

function bodyContainsAgentSensitiveMaterial(value = {}) {
  return JSON.stringify(redactAgentSensitiveFields(value)) !== JSON.stringify(value);
}

function normalizeAgentWorkerDeploymentId(value) {
  const id = String(value || 'local-worker').trim().toLowerCase().replace(/[^a-z0-9._:-]/g, '-');
  return id.slice(0, 96) || 'local-worker';
}

function normalizeManagedTelegramPrincipal(body = {}) {
  const raw = String(
    body.principalId
    || body.integrationPrincipalId
    || body.telegramPrincipalId
    || (body.telegramUserId ? `telegram:${body.telegramUserId}` : '')
  ).trim().toLowerCase();
  const principalId = raw.startsWith('telegram:') ? raw : (raw ? `telegram:${raw}` : '');
  if (!/^telegram:[a-z0-9._:@-]{1,96}$/.test(principalId)) {
    return { ok: false, error: 'telegram principalId or telegramUserId is required.' };
  }
  return {
    ok: true,
    principalId,
    principalKind: 'telegram',
  };
}

function getAgentAccountFilePath(accountId) {
  const id = String(accountId || '').trim();
  if (!/^agent_account_[a-z0-9]{16,48}$/.test(id)) return null;
  return resolve(AGENT_ACCOUNTS_DIR, `${id}.json`);
}

function normalizeManagedAgentAccountContract({
  body = {},
  authPayload = {},
  createdAt = new Date().toISOString(),
  lifecycle = 'account_created',
} = {}) {
  const principal = normalizeManagedTelegramPrincipal(body);
  if (!principal.ok) return principal;
  const workerDeploymentId = normalizeAgentWorkerDeploymentId(body.workerDeploymentId);
  const accountKey = `${workerDeploymentId}|${principal.principalId}`;
  const accountId = `agent_account_${stableAgentHash(accountKey, 20)}`;
  const accountAddress = `0x${stableAgentHash(`managed-demo-account|${accountKey}`, 40)}`;
  const sessionValidation = validateAgentSessionSlug(body.session || 'general', {
    required: true,
  });
  if (!sessionValidation.ok) return { ok: false, error: sessionValidation.error };
  const metadata = normalizeAgentCreatedAccountMetadata({
    accountId,
    accountAddress,
    accountKind: 'managed_testnet_account_runtime',
    chainScope: body.chainScope || 'testnet',
    createdByAgentPrincipal: {
      kind: 'agent',
      principalId: 'context-engine-agent',
    },
    integrationPrincipal: {
      kind: principal.principalKind,
      principalId: principal.principalId,
    },
    session: sessionValidation.slug,
    signerBoundary: AGENT_ACCOUNT_SIGNER_BOUNDARIES.MANAGED_TESTNET_ACCOUNT_RUNTIME,
    createdAt,
  });
  return {
    ok: true,
    account: {
      ...metadata,
      workerDeploymentId,
      principalId: principal.principalId,
      humanPrincipal: normalizeAddressLower(authPayload?.sub || ''),
      lifecycle,
      recoveredAt: lifecycle === 'account_recovered' ? createdAt : null,
      updatedAt: createdAt,
      contractOnly: true,
      signingEnabled: false,
    },
  };
}

function saveAgentAccount(record = {}) {
  const file = getAgentAccountFilePath(record.accountId);
  if (!file) throw new Error('Invalid managed agent account id.');
  mkdirSync(AGENT_ACCOUNTS_DIR, { recursive: true });
  writeSecureFile(file, JSON.stringify(record, null, 2));
  return record;
}

function loadAgentAccount(accountId) {
  const file = getAgentAccountFilePath(accountId);
  if (!file || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveAgentBridgeEvent(event = {}) {
  mkdirSync(AGENT_EVENTS_DIR, { recursive: true });
  const eventId = String(event.eventId || `agent_event_${stableAgentHash(JSON.stringify(event), 18)}`).trim();
  const file = resolve(AGENT_EVENTS_DIR, `${eventId.replace(/[^a-z0-9._:-]/gi, '-')}.json`);
  writeSecureFile(file, JSON.stringify(event, null, 2));
  return event;
}

function buildAgentAccountEvent({ eventType, account = {}, request = null, createdAt = new Date().toISOString() } = {}) {
  return normalizeAgentBridgeEvent({
    eventType,
    accountPrincipal: {
      kind: 'ce_wallet',
      principalId: account.humanPrincipal,
    },
    agentPrincipal: {
      kind: 'agent',
      principalId: 'context-engine-agent',
    },
    integrationPrincipal: account.integrationPrincipal,
    session: account.session || 'general',
    actionRecordId: request?.requestId || account.accountId,
    summary: {
      accountId: account.accountId,
      accountAddress: account.accountAddress,
      accountKind: account.accountKind,
      lifecycle: account.lifecycle,
      workerDeploymentId: account.workerDeploymentId,
      requestId: request?.requestId || null,
      contractOnly: true,
      signingEnabled: false,
    },
    createdAt,
  });
}

function agentRouteError(res, httpStatus, errorMessage, {
  code = 'agent_error',
  agentStatus = 'error',
} = {}) {
  return json(res, httpStatus, buildAgentError(errorMessage, {
    status: agentStatus,
    code,
  }));
}

function agentAuthError(res, auth = {}) {
  const message = auth.error || 'Agent authorization failed.';
  const code = /missing/i.test(message) ? 'agent_auth_required' : 'agent_auth_failed';
  return agentRouteError(res, auth.status || 401, message, {
    code,
    agentStatus: 'auth_error',
  });
}

function agentServerError(res, err = {}) {
  return agentRouteError(res, 500, err?.message || 'Agent route failed.', {
    code: 'agent_internal_error',
    agentStatus: 'server_error',
  });
}

function buildPendingSubmissionLockKey(slug, response) {
  const normalizedSlug = String(slug ?? '').trim().toLowerCase();
  const questionId = String(response?.questionId || '').trim().toLowerCase();
  const respondent = String(response?.respondent || '').trim().toLowerCase();
  if (!questionId) return '';
  const lockSlug = normalizedSlug || '__default__';
  return `${lockSlug}:${respondent}:${questionId}`;
}

function acquirePendingSubmissionLease(slug, responses) {
  const input = Array.isArray(responses) ? responses : [];
  const acquiredKeys = [];
  const localKeys = new Set();
  const lockedResponses = [];

  input.forEach((response) => {
    const key = buildPendingSubmissionLockKey(slug, response);
    if (!key || localKeys.has(key) || pendingResponseSubmissionLocks.has(key)) return;
    localKeys.add(key);
    pendingResponseSubmissionLocks.add(key);
    acquiredKeys.push(key);
    lockedResponses.push(response);
  });

  return {
    responses: lockedResponses,
    release() {
      acquiredKeys.forEach((key) => pendingResponseSubmissionLocks.delete(key));
    },
  };
}

function loadPendingResponses(slug) {
  const validated = validateSessionSlug(slug);
  if (!validated.ok) return [];
  const dir = resolve(RESPONSES_DIR, validated.slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(resolve(dir, f), 'utf8')); }
      catch { return null; }
    })
    .filter(r => r && !r.submitted);
}

async function buildStatusSessionSummary(
  slug,
  walletAddress,
  {
    fetchQuestionIdsImpl = fetchQuestionIds,
    getMergedAnsweredQuestionIdsImpl = getMergedAnsweredQuestionIds,
  } = {}
) {
  const pending = filterResponsesByRespondent(loadPendingResponses(slug), walletAddress);
  try {
    const ids = await fetchQuestionIdsImpl(slug);
    const allIds = Array.isArray(ids) ? ids : [...(ids || [])];
    const answeredIds = allIds.length > 0
      ? await getMergedAnsweredQuestionIdsImpl(slug, allIds, walletAddress)
      : new Set();
    const total = allIds.length;
    const answered = answeredIds?.size || 0;
    return {
      slug,
      total,
      answered,
      remaining: Math.max(0, total - answered),
      pending: pending.length,
    };
  } catch (err) {
    return {
      slug,
      total: 0,
      answered: 0,
      remaining: 0,
      pending: pending.length,
      error: err.message,
    };
  }
}

const normalizeAddressLower = (value) => String(value || '').trim().toLowerCase();
const shortAddress = (value) => {
  const normalized = normalizeAddressLower(value);
  return normalized ? normalized.slice(0, 10) : 'unknown';
};
// Fail-closed: treat any non-explicitly-false value as encryption requested.
// Only false, 'false', 0, '', null, undefined are treated as 'no encryption'.
function isEncryptionRequested(value) {
  if (value == null || value === '' || value === 0) return false;
  if (value === false || value === 'false') return false;
  return true; // fail closed - unknown truthy values treated as 'yes, encrypt'
}

export function filterResponsesByRespondent(responses, respondentAddress = '') {
  const input = Array.isArray(responses) ? responses : [];
  const respondent = normalizeAddressLower(respondentAddress);
  if (!respondent) return input.slice();
  return input.filter((entry) => normalizeAddressLower(entry?.respondent) === respondent);
}

export function filterPendingResponsesForSubmission(
  responses,
  { respondentAddress = '', questionIds = [] } = {}
) {
  const filteredByRespondent = filterResponsesByRespondent(responses, respondentAddress);
  const ids = Array.isArray(questionIds)
    ? questionIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (!ids.length) return filteredByRespondent;
  const idSet = new Set(ids);
  return filteredByRespondent.filter((entry) => idSet.has(String(entry?.questionId || '').toLowerCase()));
}

async function saveAgentResponseDraft({ body = {}, authPayload = {} } = {}) {
  const {
    questionId,
    session,
    answer,
    questionType,
    conviction,
    importance,
    additional,
    encrypt,
    encryptAdditional,
    answerEncryptionAudience,
    answerEncryptionGateId,
    additionalEncryptionAudience,
    additionalEncryptionGateId,
  } = body || {};
  const questionValidation = validateQuestionId(questionId);
  if (!questionValidation.ok) {
    return {
      ok: false,
      status: 400,
      payload: buildAgentError(questionValidation.error, {
        status: 'bad_request',
        code: 'invalid_question_id',
      }),
    };
  }
  const canonicalQuestionId = questionValidation.questionId;
  const sessionValidation = validateAgentSessionSlug(session, {
    required: true,
  });
  if (!sessionValidation.ok) {
    return {
      ok: false,
      status: 400,
      payload: buildAgentError(sessionValidation.error, {
        status: 'bad_request',
        code: 'invalid_session',
      }),
    };
  }

  const normalizedQuestionType = String(questionType || 'unknown').toLowerCase().trim();
  let resolvedAnswer = answer;
  if (normalizedQuestionType === 'rating' && answer != null) {
    if (typeof answer === 'number') {
      resolvedAnswer = answer;
    } else {
      const str = String(answer).trim();
      const direct = Number(str);
      if (Number.isFinite(direct)) {
        resolvedAnswer = direct;
      } else {
        const match = str.match(/(\d+(?:\.\d+)?)/);
        resolvedAnswer = match ? Number(match[1]) : answer;
      }
    }
  }

  const isEmptyAnswer = resolvedAnswer == null
    || (typeof resolvedAnswer === 'string' && resolvedAnswer.trim() === '');
  const isInvalidRating = normalizedQuestionType === 'rating'
    && (resolvedAnswer == null || !Number.isFinite(Number(resolvedAnswer)) || Number(resolvedAnswer) < 0 || Number(resolvedAnswer) > 10);
  if (isEmptyAnswer || isInvalidRating) {
    return {
      ok: false,
      status: 400,
      payload: buildAgentError('questionId and answer are required.', {
        status: 'bad_request',
        code: 'invalid_response_draft',
      }),
    };
  }

  const storedAnswerResult = normalizeStoredResponseAnswer(answer, normalizedQuestionType, resolvedAnswer);
  if (!storedAnswerResult.ok) {
    return {
      ok: false,
      status: storedAnswerResult.status,
      payload: buildAgentError(storedAnswerResult.error, {
        status: 'bad_request',
        code: 'invalid_answer',
      }),
    };
  }

  const slug = sessionValidation.slug;
  const metadata = await getSessionMetadata(slug).catch(() => null);
  const audienceContext = deriveResponseGateOptionsFromMetadata(metadata, { isQuestionResponseFlow: true });
  const encryptionRequested = isEncryptionRequested(encrypt);
  const hasAdditionalText = String(additional ?? '').trim() !== '';
  const hasExplicitEncryptAdditional = Object.prototype.hasOwnProperty.call(body || {}, 'encryptAdditional');
  const encryptionAdditionalRequested = hasExplicitEncryptAdditional
    ? isEncryptionRequested(encryptAdditional)
    : (encryptionRequested && hasAdditionalText);
  const normalizedAudiences = normalizeResponseAudienceSelections({
    answerAudience: answerEncryptionAudience,
    answerGateId: answerEncryptionGateId,
    additionalAudience: additionalEncryptionAudience,
    additionalGateId: additionalEncryptionGateId,
    encryptRequested: encryptionRequested,
    encryptAdditionalRequested: hasExplicitEncryptAdditional ? encryptionAdditionalRequested : null,
    hasAdditionalText,
    gateOptions: audienceContext.gateOptions,
  });

  const dir = resolve(RESPONSES_DIR, slug);
  const rel = relative(resolve(RESPONSES_DIR), dir);
  if (rel.startsWith('..') || resolve(RESPONSES_DIR, rel) !== dir) {
    return {
      ok: false,
      status: 400,
      payload: buildAgentError('Invalid session slug.', {
        status: 'bad_request',
        code: 'invalid_session',
      }),
    };
  }
  mkdirSync(dir, { recursive: true });

  const response = {
    questionId: canonicalQuestionId,
    answer: storedAnswerResult.storedAnswer,
    conviction: conviction != null ? conviction : null,
    importance: importance != null ? importance : null,
    additional: additional || null,
    encrypt: isEncryptedAudience(normalizedAudiences.answerEncryptionAudience),
    encryptAdditional: hasAdditionalText
      ? isEncryptedAudience(normalizedAudiences.additionalEncryptionAudience)
      : false,
    answerEncryptionAudience: normalizedAudiences.answerEncryptionAudience,
    answerEncryptionGateId: normalizedAudiences.answerEncryptionGateId,
    additionalEncryptionAudience: normalizedAudiences.additionalEncryptionAudience,
    additionalEncryptionGateId: normalizedAudiences.additionalEncryptionGateId,
    additionalAudienceMode: normalizedAudiences.additionalAudienceMode,
    questionType: questionType || 'unknown',
    respondent: authPayload.sub,
    timestamp: new Date().toISOString(),
    submitted: false,
    agentDraft: true,
    source: 'agent-http',
  };
  const file = resolve(dir, `${canonicalQuestionId.replace(/[^a-fA-F0-9x]/g, '_')}.json`);
  writeSecureFile(file, JSON.stringify(response, null, 2));
  clearServed(questionId);

  return {
    ok: true,
    status: 200,
    response,
    payload: buildAgentOk({
      stored: true,
      submitted: false,
      draft: summarizePendingResponseForAgent(response, { session: slug }),
    }, { status: 'draft_saved' }),
  };
}

function validateSessionSlug(value, { required = false, allowExplicitEmpty = false } = {}) {
  const raw = value == null ? null : String(value).trim();
  if (raw == null) {
    if (required) return { ok: false, error: 'session required.' };
    return { ok: true, slug: '' };
  }
  if (!raw) {
    if (required && !allowExplicitEmpty) return { ok: false, error: 'session required.' };
    return { ok: true, slug: '' };
  }
  const slug = raw;
  if (slug.length > MAX_SESSION_SLUG_LENGTH || !SESSION_SLUG_RE.test(slug)) {
    return { ok: false, error: 'Invalid session slug.' };
  }
  return { ok: true, slug };
}

function validateAgentSessionSlug(value, { required = false } = {}) {
  const raw = value == null ? null : String(value).trim();
  if (raw === '') {
    return {
      ok: false,
      error: 'session must be a non-empty agent session slug; use "general" for the general session.',
    };
  }
  return validateSessionSlug(value, {
    required,
    allowExplicitEmpty: false,
  });
}

function validateConfigSessionSlug(value, fieldName, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    return { ok: false, error: `${fieldName} must be a string.` };
  }
  const slug = value.trim();
  if (!slug) {
    if (allowEmpty) {
      return { ok: true, slug: '' };
    }
    return { ok: false, error: `${fieldName} must be a non-empty session slug.` };
  }
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    return { ok: false, error: `${fieldName} must not contain path separators.` };
  }
  if (!CONFIG_SESSION_SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: `${fieldName} must be a lowercase slug matching /^[a-z0-9][a-z0-9_-]{0,63}$/.`,
    };
  }
  return { ok: true, slug };
}

function validateSelectedSessions(value) {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'selectedSessions must be an array of session slugs.' };
  }
  const selectedSessions = [];
  for (let index = 0; index < value.length; index += 1) {
    const entryValidation = validateConfigSessionSlug(value[index], `selectedSessions[${index}]`, {
      allowEmpty: true,
    });
    if (!entryValidation.ok) return entryValidation;
    selectedSessions.push(entryValidation.slug);
  }
  return { ok: true, selectedSessions };
}

function validateLoopbackServerUrl(value) {
  if (typeof value !== 'string') {
    return { ok: false, error: 'serverUrl must be a string URL.' };
  }
  const serverUrl = value.trim();
  if (!serverUrl) {
    return { ok: false, error: 'serverUrl must be a valid loopback URL.' };
  }
  let parsed;
  try {
    parsed = new URL(serverUrl);
  } catch {
    return { ok: false, error: 'serverUrl must be a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'serverUrl must use http:// or https://.' };
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
    return {
      ok: false,
      error: 'serverUrl must use a loopback host (localhost, 127.0.0.1, ::1, or 0.0.0.0).',
    };
  }
  return { ok: true, serverUrl };
}

function validateQuestionId(value) {
  const questionId = String(value || '').trim();
  if (!ethers.utils.isHexString(questionId, 32)) {
    return { ok: false, error: 'questionId must be a 32-byte hex string.' };
  }
  return { ok: true, questionId: questionId.toLowerCase() };
}

function normalizeStoredResponseAnswer(answer, normalizedQuestionType, resolvedAnswer) {
  if (Array.isArray(answer)) {
    if (normalizedQuestionType !== 'multichoice') {
      return { ok: false, status: 400, error: 'Invalid answer type' };
    }
    const normalizedChoices = [];
    for (const entry of answer) {
      const entryType = typeof entry;
      if (entryType !== 'string' && entryType !== 'number') {
        return { ok: false, status: 400, error: 'Invalid answer type' };
      }
      const normalizedEntry = String(entry).trim();
      if (!normalizedEntry) continue;
      if (normalizedEntry.length > MAX_ANSWER_LENGTH) {
        return { ok: false, status: 400, error: `Answer options must be ${MAX_ANSWER_LENGTH} characters or fewer.` };
      }
      normalizedChoices.push(normalizedEntry);
    }
    if (normalizedChoices.length === 0) {
      return { ok: false, status: 400, error: 'questionId and answer are required.' };
    }
    return { ok: true, storedAnswer: normalizedChoices };
  }

  const rawAnswerType = typeof answer;
  const isBinaryBoolean = normalizedQuestionType === 'binary' && rawAnswerType === 'boolean';
  if (rawAnswerType !== 'string' && rawAnswerType !== 'number' && !isBinaryBoolean) {
    return { ok: false, status: 400, error: 'Invalid answer type' };
  }

  const normalizedStoredAnswer = normalizedQuestionType === 'rating' ? resolvedAnswer : answer;
  if (typeof normalizedStoredAnswer === 'string' && normalizedStoredAnswer.length > MAX_ANSWER_LENGTH) {
    return { ok: false, status: 400, error: `Answer must be ${MAX_ANSWER_LENGTH} characters or fewer.` };
  }

  return { ok: true, storedAnswer: normalizedStoredAnswer };
}

function validateWorkerToken(workerToken, { session = '', walletAddress = '' } = {}) {
  const raw = String(workerToken || '').trim();
  if (!raw) return { ok: false, error: 'workerToken required.' };

  const payload = decodeTokenPayload(raw);
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid worker token.' };
  }

  const exp = Number(payload?.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0) {
    return { ok: false, error: 'Worker token missing exp.' };
  }
  if (Math.floor(Date.now() / 1000) >= exp) {
    return { ok: false, error: 'Worker token expired.' };
  }

  const normalizedSession = String(session || '').trim().toLowerCase();
  if (normalizedSession) {
    const tokenSlug = String(payload?.slug || '').trim().toLowerCase();
    if (!tokenSlug || tokenSlug !== normalizedSession) {
      return { ok: false, error: 'Worker token does not match session.' };
    }
  }

  const normalizedWallet = String(walletAddress || '').trim().toLowerCase();
  if (normalizedWallet) {
    const tokenSub = String(payload?.sub || '').trim();
    if (!ethers.utils.isAddress(tokenSub) || tokenSub.toLowerCase() !== normalizedWallet) {
      return { ok: false, error: 'Worker token does not match authenticated wallet.' };
    }
  }

  return { ok: true, payload };
}

export function buildHookResponseDefaults(config = {}) {
  return {
    encrypt: !!config?.encryptByDefault,
  };
}

function buildCompactHookQuestion(question, slug) {
  if (!question) return null;
  const storageRef = resolvePayloadStorageRef(question, { resource: 'questions' });
  const arweaveTxId = getLegacyArweaveTxId(question) || null;
  return {
    id: question.id || '',
    session: slug,
    sessionName: question.sessionName || slug,
    type: question.type || 'unknown',
    prompt: question.prompt || '(no prompt)',
    options: Array.isArray(question.options) ? question.options : [],
    singleSelect: question.singleSelect !== false,
    tags: Array.isArray(question.tags) ? question.tags : [],
    associatedSurveyId: question.associatedSurveyId || null,
    arweaveTxId,
    ...(storageRef ? { storageRef } : {}),
  };
}

function buildStorageRefFromResult(result, index, resource = 'responses') {
  const storageRefs = Array.isArray(result?.storageRefs) ? result.storageRefs : [];
  const directRef = storageRefs[index] || null;
  const arweaveTxId = Array.isArray(result?.arweaveTxIds)
    ? String(result.arweaveTxIds[index] || '').trim()
    : '';
  return resolvePayloadStorageRef({
    storageRef: directRef,
    arweaveTxId,
    resource,
  }, { resource });
}

function buildSurveyStorageRefFromResult(result) {
  return resolvePayloadStorageRef({
    storageRef: result?.surveyStorageRef,
    arweaveTxId: result?.surveyArweaveTxId,
    resource: 'responses',
  }, { resource: 'responses' });
}

function buildAutoSubmitStatus(kind, fields = {}) {
  switch (kind) {
    case 'submitted':
      return {
        status: 'submitted',
        alert: 'success',
        message: 'Auto-submit succeeded.',
        ...fields,
      };
    case 'worker-auth-required':
      return {
        status: 'worker-auth-required',
        alert: 'warning',
        message: 'Session sign-in is required before auto-submit can run.',
        ...fields,
      };
    case 'pending':
      return {
        status: 'pending',
        alert: 'info',
        message: 'Auto-submit is still in progress; the response remains pending locally.',
        ...fields,
      };
    case 'failed':
      return {
        status: 'failed',
        alert: 'error',
        message: 'Auto-submit failed; the response remains pending locally.',
        ...fields,
      };
    case 'disabled':
    default:
      return {
        status: 'disabled',
        alert: 'info',
        message: 'Auto-submit is disabled; the response was saved locally.',
        ...fields,
      };
  }
}

function buildTxExplorerUrl(txHash, baseUrl = DEFAULT_CHAIN_METADATA.txExplorerTxBaseUrl) {
  const safeHash = String(txHash || '').trim();
  const safeBaseUrl = String(baseUrl || '').trim();
  if (!safeHash || !safeBaseUrl) return '';
  try {
    return new URL(safeHash, safeBaseUrl).toString();
  } catch {
    return '';
  }
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function proxyUpstreamResponse(res, upstream) {
  const contentType = upstream.headers.get('content-type') || 'application/json';
  const bodyText = await upstream.text();
  res.writeHead(upstream.status, { 'Content-Type': contentType });
  res.end(bodyText);
}

function getFaucetProvider() {
  const rpcUrl = resolveRpcUrlsForChain(DEFAULT_CHAIN_ID)[0];
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

function resolveFaucetProvider(deps = {}) {
  return typeof deps.getFaucetProvider === 'function'
    ? deps.getFaucetProvider()
    : getFaucetProvider();
}

async function getFaucetBalanceStatus(address, deps = {}) {
  const provider = resolveFaucetProvider(deps);
  const balanceWei = await provider.getBalance(address);
  return {
    address,
    balanceWei,
    balanceEth: ethers.utils.formatEther(balanceWei),
    eligible: balanceWei.lt(FAUCET_THRESHOLD_WEI),
    thresholdEth: FAUCET_THRESHOLD_ETH,
  };
}

function buildFaucetWorkerRequestBody(recipientAddress, requestBody = {}) {
  const payload = {
    action: 'request_test_eth',
    to: recipientAddress,
  };
  const source = (requestBody && typeof requestBody === 'object') ? requestBody : {};
  ['amountEth', 'amount', 'sbtAddress', 'hashedPassword', 'groupPasswordHash', 'signature'].forEach((key) => {
    if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') {
      payload[key] = source[key];
    }
  });
  return payload;
}

async function requestFaucetWorkerTransfer({ slug, recipientAddress, requestBody = {} }, deps = {}) {
  const resolveWorkerUrl = typeof deps.getCorsWorkerUrl === 'function'
    ? deps.getCorsWorkerUrl
    : getCorsWorkerUrl;
  const fetchImpl = typeof deps.fetch === 'function' ? deps.fetch : fetch;
  const workerUrl = await resolveWorkerUrl(slug);
  const workerToken = loadValidatedWorkerToken(slug, recipientAddress);
  if (!workerUrl || !workerToken) {
    return {
      workerUrl,
      workerToken,
      workerResponse: null,
    };
  }

  const workerResponse = await fetchImpl(`${String(workerUrl).replace(/\/+$/, '')}/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${workerToken}`,
    },
    body: JSON.stringify(buildFaucetWorkerRequestBody(recipientAddress, requestBody)),
  });

  return {
    workerUrl,
    workerToken,
    workerResponse,
  };
}

function getStoredPrivateKeyFromFile() {
  const keyPath = resolve(DATA_DIR, 'wallet.key');
  if (!existsSync(keyPath)) return null;
  try {
    const decrypted = decryptFromFile(keyPath);
    if (decrypted) return decrypted.toString('utf8').trim() || null;

    if (isEncryptedFile(keyPath)) {
      warn(
        '[auth] Warning: wallet.key could not be decrypted on this machine. On-chain submission may fail until you re-authenticate with a private key.'
      );
      return null;
    }

    const legacy = readFileSync(keyPath, 'utf8').trim() || null;
    if (legacy) {
      try {
        migrateToEncrypted(keyPath);
      } catch (err) {
        warn(`[auth] Warning: failed to migrate wallet.key to encrypted storage (${err.message}).`);
      }
    }
    return legacy;
  }
  catch { return null; }
}

function isSkippableWorkerAuthError(err) {
  const message = String(err?.message || err || '').trim();
  return /^No worker URL for session /i.test(message);
}

async function authenticateWithWorker(slug, walletAddress, privateKey, deps = {}) {
  const resolveWorkerUrl = typeof deps.getCorsWorkerUrl === 'function' ? deps.getCorsWorkerUrl : getCorsWorkerUrl;
  const fetchImpl = typeof deps.fetch === 'function' ? deps.fetch : fetch;
  const workerUrl = await resolveWorkerUrl(slug);
  if (!workerUrl) throw new Error(`No worker URL for session "${slug}".`);
  const baseUrl = String(workerUrl).replace(/\/+$/, '');

  const nonceResp = await fetchImpl(`${baseUrl}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: LOCAL_AUTH_ORIGIN },
    body: JSON.stringify({ address: walletAddress, sessionSlug: slug }),
  });
  const nonceData = await nonceResp.json();
  if (!nonceResp.ok || !nonceData?.nonce) {
    throw new Error(`Failed to get worker nonce: ${nonceData?.error || nonceResp.status}`);
  }

  const wallet = new ethers.Wallet(privateKey);
  // SIWE spec requires EIP-55 checksummed address (not lowercase)
  const checksummedAddress = wallet.address;

  const chainId = DEFAULT_CHAIN_ID;
  const now = new Date();
  const exp = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const message = 'localhost:7391 wants you to sign in with your Ethereum account:\n'
    + checksummedAddress + '\n\nSign in to Context Engine.\n\n'
    + `URI: ${LOCAL_AUTH_ORIGIN}\nVersion: 1\nChain ID: ` + chainId
    + '\nNonce: ' + nonceData.nonce
    + '\nIssued At: ' + now.toISOString()
    + '\nExpiration Time: ' + exp.toISOString();

  const signature = await wallet.signMessage(message);

  const loginResp = await fetchImpl(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: LOCAL_AUTH_ORIGIN },
    body: JSON.stringify({ address: checksummedAddress, message, signature, sessionSlug: slug }),
  });
  const loginData = await loginResp.json();
  if (!loginResp.ok || !loginData?.token) {
    throw new Error(`Worker login failed: ${loginData?.error || loginResp.status}`);
  }

  saveWorkerToken(slug, loginData.token);
  debug(`[auth] Auto-authenticated with worker for session "${slug}"`);
  return loginData.token;
}

async function ensureWorkerToken(slug, walletAddress, deps = {}) {
  const existing = loadValidatedWorkerToken(slug, walletAddress);
  if (existing) return existing;
  const privateKey = getStoredPrivateKeyFromFile();
  if (!privateKey) return null;
  try {
    return await authenticateWithWorker(slug, walletAddress, privateKey, deps);
  } catch (err) {
    if (isSkippableWorkerAuthError(err)) {
      debug(`[auth] Auto worker-auth skipped for ${slug}: ${err.message}`);
      return null;
    }
    warn(`[auth] Auto worker-auth failed for ${slug}: ${err.message}`);
    return null;
  }
}

function findFirstSessionWithWorkerToken(slugs = [], walletAddress = '') {
  for (const slug of slugs) {
    if (loadValidatedWorkerToken(slug, walletAddress)) return slug;
  }
  return '';
}

async function autoRequestFaucetAfterAuth(walletAddress, hookConfig, deps = {}) {
  const selectedSessions = getConfiguredSessions(hookConfig);
  let slug = findFirstSessionWithWorkerToken(selectedSessions, walletAddress);
  if (!slug && selectedSessions.length > 0) {
    const privateKey = getStoredPrivateKeyFromFile();
    if (privateKey) {
      for (const s of selectedSessions) {
        try {
          await authenticateWithWorker(s, walletAddress, privateKey, deps);
          slug = s;
          break;
        } catch (err) {
          if (isSkippableWorkerAuthError(err)) {
            debug(`[auth] Auto worker-auth skipped for ${s} during faucet: ${err.message}`);
            continue;
          }
          warn(`[auth] Auto worker-auth failed for ${s} during faucet: ${err.message}`);
        }
      }
    }
  }
  if (!slug) {
    debug('[auth] Auto-faucet: skipped (no worker token and auto-auth failed)');
    return;
  }

  const balance = await getFaucetBalanceStatus(walletAddress, deps);
  if (!balance.eligible) {
    debug(`[auth] Auto-faucet: wallet above threshold (${balance.balanceEth} ETH)`);
    return;
  }

  const faucetRequest = await requestFaucetWorkerTransfer({ slug, recipientAddress: walletAddress }, deps);
  if (!faucetRequest.workerToken) {
    debug('[auth] Auto-faucet: skipped (no worker token)');
    return;
  }
  if (!faucetRequest.workerUrl) {
    throw new Error(`No worker URL for session "${slug}".`);
  }

  const responseText = await faucetRequest.workerResponse.text();
  let responseData = null;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = null;
  }

  if (!faucetRequest.workerResponse.ok) {
    const reason = String(responseData?.error || responseText || '').trim();
    throw new Error(reason || `Worker responded with ${faucetRequest.workerResponse.status}.`);
  }

  const amountEth = String(responseData?.amountEth || '').trim() || 'unknown';
  const txHash = String(responseData?.txHash || '').trim() || 'unknown';
  debug(`[auth] Auto-faucet: sent ${amountEth} ETH to ${walletAddress} (tx: ${txHash})`);
}

// TODO: Defer splitting this monolithic router into focused route modules for a later slice.
export async function handleRoute(req, res, { url, method, body }, deps = {}) {
  const path = url.pathname;
  const submitOnChainImpl = typeof deps.submitOnChain === 'function' ? deps.submitOnChain : submitOnChain;
  const canSubmitImpl = typeof deps.canSubmit === 'function' ? deps.canSubmit : canSubmit;
  const getRandomUnseenImpl = typeof deps.getRandomUnseen === 'function' ? deps.getRandomUnseen : getRandomUnseen;
  const formatQuestionForTerminalImpl = typeof deps.formatQuestionForTerminal === 'function'
    ? deps.formatQuestionForTerminal
    : formatQuestionForTerminal;

  // --- Auth: issue local JWT (for skip-SIWE flow) ---

  if (path === '/api/auth/local-jwt' && method === 'POST') {
    const trusted = isTrustedLocalRequest(req);
    if (!trusted.ok) {
      return json(res, 403, {
        error: 'Local JWT issuance is restricted to trusted local requests.',
        reason: trusted.reason,
      });
    }

    const walletAddressInput = String(body?.walletAddress || '').trim();
    if (!ethers.utils.isAddress(walletAddressInput)) {
      return json(res, 400, { error: 'Valid walletAddress required.' });
    }
    const walletAddress = walletAddressInput.toLowerCase();

    const privateKeyInput = String(body?.privateKey || '').trim();
    if (!privateKeyInput) {
      return json(res, 400, { error: 'privateKey is required to prove wallet ownership.' });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKeyInput)) {
      return json(res, 400, { error: 'privateKey must be a 32-byte hex string (0x...).' });
    }
    try {
      const derived = new ethers.Wallet(privateKeyInput).address.toLowerCase();
      if (derived !== walletAddress) {
        return json(res, 400, { error: 'privateKey does not match walletAddress.' });
      }
    } catch {
      return json(res, 400, { error: 'Invalid privateKey.' });
    }

    const keyPath = resolve(DATA_DIR, 'wallet.key');
    if (existsSync(keyPath)) {
      try {
        const storedPrivateKey = getStoredPrivateKeyFromFile();
        if (storedPrivateKey) {
          const storedAddress = new ethers.Wallet(storedPrivateKey).address.toLowerCase();
          if (storedAddress !== walletAddress) {
            rmSync(keyPath, { force: true });
            rmSync(RESPONSES_DIR, { recursive: true, force: true });
            mkdirSync(RESPONSES_DIR, { recursive: true });
            rmSync(WORKER_TOKENS_DIR, { recursive: true, force: true });
            mkdirSync(WORKER_TOKENS_DIR, { recursive: true });
            rmSync(CONFIRMED_SUBMISSIONS_DIR, { recursive: true, force: true });
            debug(
              `[auth] Cleaned up old credentials for wallet switch: ${shortAddress(storedAddress)} → ${shortAddress(walletAddress)}`
            );
          }
        }
      } catch (err) {
        warn(
          `[auth] Warning: existing wallet.key could not be derived (${err.message}). On-chain submission may fail until you re-authenticate with a private key.`
        );
      }
    }

    const token = signJwt({ sub: walletAddress, scope: 'claude-code' });

    // Store private key for server-side signing (testnet only)
    if (privateKeyInput) {
      mkdirSync(DATA_DIR, { recursive: true });
      encryptToFile(keyPath, privateKeyInput);
    }

    const hookConfig = loadHookConfig();
    const shouldAutoInstall = hookConfig.autoCli !== false;
    let autoInstalled = false;
    let autoInstallPath = resolve(HOOK_STATE_DIR, 'token.jwt');
    let autoInstallError = null;

    // Auto-install token to plugin state dir when enabled.
    if (shouldAutoInstall) {
      try {
        mkdirSync(HOOK_STATE_DIR, { recursive: true });
        writeSecureFile(autoInstallPath, token);
        autoInstalled = true;
        debug(`[auth] Auto-installed JWT to ${autoInstallPath}`);
      } catch (err) {
        autoInstallError = err.message;
        error(`[auth] Failed to auto-install JWT:`, err.message);
      }
    }
    json(res, 200, {
      token,
      autoInstallConfigured: shouldAutoInstall,
      autoInstalled,
      autoInstallPath,
      autoInstallError,
      walletAddress,
      privateKeyStored: !!privateKeyInput,
    });

    autoRequestFaucetAfterAuth(walletAddress, hookConfig, deps).then(() => {
      // fire-and-forget
    }).catch((err) => {
      error('[auth] Auto-faucet failed:', err.message);
    });
    return;
  }

  // --- Store worker tokens per session (for Arweave uploads) ---

  if (path === '/api/auth/worker-token' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const { session, workerToken } = body || {};
    const sessionValidation = validateSessionSlug(session, {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) {
      return json(res, 400, { error: sessionValidation.error });
    }
    if (!workerToken) {
      return json(res, 400, { error: 'session and workerToken required.' });
    }
    const tokenValidation = validateWorkerToken(workerToken, {
      session: sessionValidation.slug,
      walletAddress: auth.payload?.sub || '',
    });
    if (!tokenValidation.ok) {
      return json(res, 400, { error: tokenValidation.error });
    }
    try {
      const slug = sessionValidation.slug;
      const normalizedWorkerToken = String(workerToken).trim();
      const respondent = normalizeAddressLower(auth.payload?.sub || '');
      saveWorkerToken(slug, normalizedWorkerToken);

      (async () => {
        let pendingLease = null;
        try {
          const config = loadHookConfig();
          if (config.autoSubmitOnLogin === false || !respondent) return;

          const pending = filterResponsesByRespondent(loadPendingResponses(slug), respondent);
          if (!pending.length) return;
          pendingLease = acquirePendingSubmissionLease(slug, pending);
          const pendingToSubmit = pendingLease.responses;
          if (!pendingToSubmit.length) return;

          const result = await submitOnChainImpl(pendingToSubmit, slug, normalizedWorkerToken);
          if (!result.ok) {
            error(`[router] Auto-submit on login failed for ${slug}: ${result.error}`);
            return;
          }

          const submittedAt = new Date().toISOString();
          for (let i = 0; i < pendingToSubmit.length; i += 1) {
            const response = pendingToSubmit[i];
            const file = getResponseFilePath(slug, response.questionId);
            const stored = JSON.parse(readFileSync(file, 'utf8'));
            stored.submitted = true;
            stored.txHash = result.txHash;
            stored.blockNumber = result.blockNumber ?? null;
            const storageRef = buildStorageRefFromResult(result, i);
            const surveyStorageRef = buildSurveyStorageRefFromResult(result);
            stored.arweaveTxId = getLegacyArweaveTxId({
              storageRef,
              arweaveTxId: result.arweaveTxIds?.[i],
            }) || null;
            stored.storageRef = storageRef || null;
            stored.surveyArweaveTxId = getLegacyArweaveTxId({
              storageRef: surveyStorageRef,
              arweaveTxId: result.surveyArweaveTxId,
            }) || null;
            stored.surveyStorageRef = surveyStorageRef || null;
            stored.submittedAt = submittedAt;
            writeSecureFile(file, JSON.stringify(stored, null, 2));
          }

          debug(
            `[router] Auto-submitted ${pendingToSubmit.length} pending response${pendingToSubmit.length === 1 ? '' : 's'} on login for ${slug} → tx ${result.txHash}`
          );
        } catch (err) {
          error(`[router] Auto-submit on login error for ${slug}: ${err.message}`);
        } finally {
          pendingLease?.release();
        }
      })();

      return json(res, 200, { ok: true, session: sessionValidation.slug });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/auth/worker-tokens' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    // Return which sessions have stored worker tokens
    try {
      mkdirSync(WORKER_TOKENS_DIR, { recursive: true });
      const files = readdirSync(WORKER_TOKENS_DIR).filter(f => f.endsWith('.jwt'));
      const sessions = files.map(f => f.replace(/\.jwt$/, ''));
      return json(res, 200, { sessions });
    } catch (err) {
      return json(res, 200, { sessions: [] });
    }
  }

  // Check token freshness for selected sessions
  if (path === '/api/auth/check' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    try {
      const config = loadHookConfig();
      const selected = getConfiguredSessions(config);
      const workerTokenSummary = summarizeWorkerTokenStatuses(selected, auth.payload?.sub || '');
      const anyExpired = workerTokenSummary.expiredCount > 0 || workerTokenSummary.invalidCount > 0;
      return json(res, 200, {
        sessions: workerTokenSummary.sessions,
        anyExpired,
        needsAttention: workerTokenSummary.needsAttentionCount > 0,
        refreshUrl: config.serverUrl || 'http://localhost:7391',
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // --- Protected routes ---

  if (path === '/api/me' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    return json(res, 200, auth.payload);
  }

  if (path === '/api/agent/me' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const hookConfig = loadHookConfig();
    const sessions = getConfiguredSessions(hookConfig);
    const walletAddress = auth.payload?.sub || '';
    const workerTokenSummary = summarizeWorkerTokenStatuses(sessions, walletAddress);
    return json(res, 200, buildAgentOk({
      identity: auth.payload,
      wallet: walletAddress,
      auth: {
        type: 'local-jwt',
        scope: auth.payload?.scope || null,
      },
      capabilities: buildAgentCapabilities({
        wallet: walletAddress,
        sessions,
        workerTokenSummary,
        settings: loadSettings(),
        submitStatus: canSubmitImpl(),
      }),
    }));
  }

  if (path === '/api/sessions' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    try {
      const { scoped, all } = await listScopedSessions();
      for (const slug of scoped) {
        warmQuestionCache(slug);
      }
      return json(res, 200, {
        sessions: scoped,
        allSessions: all,
        scope: CE_SESSION_SCAN_SCOPE,
        scopeSlugs: CE_SESSION_SCAN_SLUGS,
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/agent/sessions' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    try {
      const { scoped, all } = await listScopedSessions();
      for (const slug of scoped) {
        warmQuestionCache(slug);
      }
      const hookConfig = loadHookConfig();
      return json(res, 200, buildAgentOk({
        sessions: scoped,
        allSessions: all,
        selectedSessions: getConfiguredSessions(hookConfig),
        scope: CE_SESSION_SCAN_SCOPE,
        scopeSlugs: CE_SESSION_SCAN_SLUGS,
      }));
    } catch (err) {
      return agentServerError(res, err);
    }
  }

  if (path === '/api/session/worker-url' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const sessionValidation = validateSessionSlug(url.searchParams.get('session'), {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const slug = sessionValidation.slug;
    try {
      const workerUrl = await getCorsWorkerUrl(slug);
      return json(res, 200, { workerUrl: workerUrl || null, slug });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/faucet/check' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const sessionValidation = validateSessionSlug(url.searchParams.get('session'), {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const address = String(auth.payload?.sub || '').trim().toLowerCase();
    try {
      const balance = await getFaucetBalanceStatus(address, deps);
      return json(res, 200, {
        address: balance.address,
        balanceEth: balance.balanceEth,
        eligible: balance.eligible,
        thresholdEth: balance.thresholdEth,
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/faucet' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const sessionValidation = validateSessionSlug(body?.session, {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const slug = sessionValidation.slug;

    const recipientAddress = String(auth.payload?.sub || '').trim().toLowerCase();
    if (!ethers.utils.isAddress(recipientAddress)) {
      return json(res, 400, { error: 'Valid recipient address required.' });
    }

    try {
      const workerToken = await ensureWorkerToken(slug, recipientAddress, deps);
      if (!workerToken) {
        return json(res, 401, { error: 'Session sign-in is missing. Re-authenticate in the local Context Engine UI.' });
      }
      const faucetRequest = await requestFaucetWorkerTransfer({
        slug,
        recipientAddress,
        requestBody: body,
      }, deps);
      if (!faucetRequest.workerUrl) return json(res, 400, { error: 'No worker URL for session' });
      return proxyUpstreamResponse(res, faucetRequest.workerResponse);
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/questions' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const sessionValidation = validateSessionSlug(url.searchParams.get('session'));
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const slug = sessionValidation.slug;
    const walletAddr = auth.payload?.sub || '';
    try {
      const hookConfig = loadHookConfig();
      const allowReanswer = hookConfig.allowReanswer === true || hookConfig.allowReanswer === 'true';
      const randomUnseen = await getRandomUnseenImpl(slug, { walletAddress: walletAddr, allowReanswer });
      const question = randomUnseen?.question || null;
      if (!question) return json(res, 200, { question: null, message: 'No questions available.', allowReanswer });
      const metadata = await getSessionMetadata(slug).catch(() => null);
      const audienceContext = deriveResponseGateOptionsFromMetadata(metadata, { isQuestionResponseFlow: true });
      return json(res, 200, {
        question,
        allowReanswer,
        gateOptions: audienceContext.gateOptions,
        defaultGateId: audienceContext.defaultGateId || '',
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/agent/questions' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const sessionValidation = validateAgentSessionSlug(url.searchParams.get('session'), {
      required: true,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }
    const slug = sessionValidation.slug;
    const walletAddr = auth.payload?.sub || '';
    try {
      const hookConfig = loadHookConfig();
      const allowReanswer = hookConfig.allowReanswer === true || hookConfig.allowReanswer === 'true';
      const randomUnseen = await getRandomUnseenImpl(slug, { walletAddress: walletAddr, allowReanswer });
      const question = randomUnseen?.question || null;
      const metadata = await getSessionMetadata(slug).catch(() => null);
      const audienceContext = deriveResponseGateOptionsFromMetadata(metadata, { isQuestionResponseFlow: true });
      return json(res, 200, normalizeAgentQuestionPayload({
        session: slug,
        question,
        fields: {
          message: question ? undefined : 'No questions available.',
          allowReanswer,
          gateOptions: audienceContext.gateOptions,
          defaultGateId: audienceContext.defaultGateId || '',
        },
      }));
    } catch (err) {
      return agentServerError(res, err);
    }
  }

  if (path === '/api/agent/inbox' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const sessionValidation = validateAgentSessionSlug(url.searchParams.get('session'), {
      required: false,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }
    try {
      const sessions = sessionValidation.slug
        ? [sessionValidation.slug]
        : getConfiguredSessions(loadHookConfig());
      const pendingResponses = sessions.flatMap((slug) => filterResponsesByRespondent(
        loadPendingResponses(slug),
        auth.payload?.sub || '',
      ).map((response) => summarizePendingResponseForAgent(response, { session: slug })));
      const requests = loadAgentRequestsForWallet(auth.payload?.sub || '')
        .filter((request) => agentRequestMatchesSession(request, sessionValidation.slug))
        .map((request) => summarizeAgentRequestForRead(request).summary);
      const requestStatusCounts = summarizeAgentRequestStatusCounts(requests);
      return json(res, 200, buildAgentOk({
        inbox: [
          ...pendingResponses,
          ...requests,
        ],
        pendingResponses,
        requests,
        requestStatusCounts,
        count: pendingResponses.length + requests.length,
      }));
    } catch (err) {
      return agentServerError(res, err);
    }
  }

  if (path === '/api/hook/question' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const sessionValidation = validateSessionSlug(url.searchParams.get('session'));
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const slug = sessionValidation.slug;
    const serverUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['host'] || 'localhost'}`;
    const walletAddr = auth.payload?.sub || '';
    const hookConfig = loadHookConfig();
    const presentation = String(url.searchParams.get('presentation') || '').trim().toLowerCase();
    const compactPresentation = presentation === 'compact' || presentation === 'model';
    const peek = url.searchParams.get('peek') === '1' || url.searchParams.get('peek') === 'true';
    const allowReanswer = hookConfig.allowReanswer === true || hookConfig.allowReanswer === 'true';
    const cooldownMs = normalizeHookCooldownMs(hookConfig.cooldownMs);
    const defaults = buildHookResponseDefaults(hookConfig);
    try {
      const metadata = await getSessionMetadata(slug).catch(() => null);
      const audienceContext = deriveResponseGateOptionsFromMetadata(metadata, { isQuestionResponseFlow: true });
      const audienceDefaults = {
        answerEncryptionAudience: defaults.encrypt
          ? (audienceContext.defaultGateId ? 'gate' : 'self')
          : 'none',
        answerEncryptionGateId: audienceContext.defaultGateId || null,
        additionalEncryptionAudience: 'follow',
        additionalEncryptionGateId: null,
      };
      const randomUnseen = await getRandomUnseenImpl(slug, { walletAddress: walletAddr, allowReanswer, peek });
      const question = randomUnseen?.question || null;
      const answeredCount = Number(randomUnseen?.answeredCount || 0);
      const totalCount = Number(randomUnseen?.totalCount || 0);
      const pending = filterResponsesByRespondent(loadPendingResponses(slug), walletAddr);
      const stats = {
        total: totalCount,
        answered: answeredCount,
        remaining: Math.max(0, totalCount - answeredCount),
        pending: pending.length,
      };
      if (!question) {
        const noQuestionResult = {
          ok: true,
          presentation: compactPresentation ? 'compact' : 'default',
          formatted: null,
          question: null,
          wallet: walletAddr,
          stats,
          allowReanswer,
          cooldownMs,
          defaults: {
            ...defaults,
            ...audienceDefaults,
          },
          gateOptions: audienceContext.gateOptions,
          defaultGateId: audienceContext.defaultGateId || '',
        };
        if (compactPresentation) delete noQuestionResult.formatted;
        return json(res, 200, noQuestionResult);
      }
      const formatted = formatQuestionForTerminalImpl(question, slug, serverUrl);

      // Include recent responses for AI-suggested freeform answers
      let recentResponses = null;
      const isFreeform = question.type === 'freeform' || (!['binary', 'multichoice', 'rating'].includes(question.type));
      if (!peek && isFreeform && hookConfig.aiSuggestFreeform !== false) {
        try {
          // Gather ALL responses across all sessions for this wallet
          const allSlugs = getConfiguredSessions(hookConfig);
          if (allSlugs.length === 0 && slug) allSlugs.push(String(slug).trim());
          const responses = [];
          for (const s of allSlugs) {
            const dir = resolve(RESPONSES_DIR, s);
            if (!existsSync(dir)) continue;
            for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
              try {
                const r = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
                if ((r.respondent || '').toLowerCase() === walletAddr.toLowerCase() && r.answer) {
                  responses.push({ type: r.questionType, answer: r.answer, ts: r.timestamp });
                }
              } catch { /* skip */ }
            }
          }
          // Sort by timestamp, take the last 10
          responses.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
          recentResponses = responses.slice(-10).reverse();
        } catch { /* best-effort */ }
      }

      const result = {
        ok: true,
        presentation: compactPresentation ? 'compact' : 'default',
        formatted,
        question: compactPresentation ? buildCompactHookQuestion(question, slug) : question,
        wallet: walletAddr,
        stats,
        allowReanswer,
        cooldownMs,
        defaults: {
          ...defaults,
          ...audienceDefaults,
        },
        gateOptions: audienceContext.gateOptions,
        defaultGateId: audienceContext.defaultGateId || '',
        showImportance: !!hookConfig.showImportance,
      };
      if (recentResponses && recentResponses.length > 0) {
        result.aiSuggestFreeform = true;
        if (compactPresentation) {
          result.recentResponseCount = recentResponses.length;
        } else {
          result.recentResponses = recentResponses;
        }
      }
      if (compactPresentation) {
        delete result.formatted;
      }
      return json(res, 200, result);
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/status' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const hookConfig = loadHookConfig();
    const sessions = getConfiguredSessions(hookConfig);
    const fetchQuestionIdsImpl = typeof deps.fetchQuestionIds === 'function'
      ? deps.fetchQuestionIds
      : fetchQuestionIds;
    const getMergedAnsweredQuestionIdsImpl = typeof deps.getMergedAnsweredQuestionIds === 'function'
      ? deps.getMergedAnsweredQuestionIds
      : getMergedAnsweredQuestionIds;

    try {
      const walletAddress = auth.payload?.sub || '';
      const sessionSummaries = await Promise.all(
        sessions.map((slug) => buildStatusSessionSummary(slug, walletAddress, {
          fetchQuestionIdsImpl,
          getMergedAnsweredQuestionIdsImpl,
        }))
      );
      const totals = sessionSummaries.reduce((acc, entry) => ({
        sessions: acc.sessions + 1,
        total: acc.total + Number(entry.total || 0),
        answered: acc.answered + Number(entry.answered || 0),
        remaining: acc.remaining + Number(entry.remaining || 0),
        pending: acc.pending + Number(entry.pending || 0),
      }), {
        sessions: 0,
        total: 0,
        answered: 0,
        remaining: 0,
        pending: 0,
      });
      const settings = loadSettings();
      const cooldown = getHookCooldownState(hookConfig);
      const submitStatus = canSubmitImpl();
      const workerTokenSummary = summarizeWorkerTokenStatuses(sessions, walletAddress);
      const dashboard = loadHookDashboardState();

      return json(res, 200, {
        wallet: walletAddress,
        config: {
          serverUrl: hookConfig.serverUrl || 'http://localhost:7391',
          defaultSession: String(hookConfig.defaultSession || '').trim(),
          selectedSessions: sessions,
          cooldownMs: normalizeHookCooldownMs(hookConfig.cooldownMs),
          allowReanswer: hookConfig.allowReanswer === true || hookConfig.allowReanswer === 'true',
          aiSuggestFreeform: hookConfig.aiSuggestFreeform !== false,
          showImportance: !!hookConfig.showImportance,
          questionSurfacingMode: normalizeQuestionSurfacingMode(hookConfig.questionSurfacingMode),
          ambientInterruptions: normalizeBooleanConfig(hookConfig.ambientInterruptions, false),
          statuslineQuestionHints: normalizeBooleanConfig(hookConfig.statuslineQuestionHints, true),
          chainId: DEFAULT_CHAIN_ID,
          chainName: DEFAULT_CHAIN_METADATA.name,
          txExplorerTxBaseUrl: DEFAULT_CHAIN_METADATA.txExplorerTxBaseUrl,
        },
        cooldown,
        dashboard,
        sessions: sessionSummaries,
        totals,
        submit: {
          ready: !!submitStatus.ready,
          hasKey: !!submitStatus.hasKey,
          hasContract: !!submitStatus.hasContract,
          autoSubmitResponses: settings.autoSubmitResponses,
          mode: settings.submitMode,
          batchSize: settings.batchSize,
          chainId: DEFAULT_CHAIN_ID,
          chainName: DEFAULT_CHAIN_METADATA.name,
          workerTokens: {
            ready: workerTokenSummary.ready,
            total: workerTokenSummary.total,
            validCount: workerTokenSummary.validCount,
            missingCount: workerTokenSummary.missingCount,
            expiredCount: workerTokenSummary.expiredCount,
            invalidCount: workerTokenSummary.invalidCount,
            needsAttentionCount: workerTokenSummary.needsAttentionCount,
            missingSessions: workerTokenSummary.missingSessions,
            expiredSessions: workerTokenSummary.expiredSessions,
            invalidSessions: workerTokenSummary.invalidSessions,
          },
        },
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // --- Response submission (store locally for later on-chain submission) ---

  if (path === '/api/agent/responses/draft' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    try {
      const result = await saveAgentResponseDraft({
        body,
        authPayload: auth.payload,
      });
      return json(res, result.status, result.payload);
    } catch (err) {
      return agentServerError(res, err);
    }
  }

  if (path === '/api/agent/responses/drafts' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const sessionValidation = validateAgentSessionSlug(url.searchParams.get('session'), {
      required: true,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }
    const slug = sessionValidation.slug;
    try {
      const drafts = filterResponsesByRespondent(
        loadPendingResponses(slug),
        auth.payload?.sub || '',
      );
      return json(res, 200, buildAgentOk({
        session: slug,
        drafts,
        summaries: drafts.map((response) => summarizePendingResponseForAgent(response, { session: slug })),
        count: drafts.length,
      }));
    } catch (err) {
      return agentServerError(res, err);
    }
  }

  if (path === '/api/agent/responses/submit-request' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);

    const { session, questionIds, questionId } = body || {};
    const sessionValidation = validateAgentSessionSlug(session, {
      required: true,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }

    const rawQuestionIds = Array.isArray(questionIds)
      ? questionIds
      : (questionId ? [questionId] : []);
    const normalizedQuestionIds = rawQuestionIds.map((value) => validateQuestionId(value));
    if (!normalizedQuestionIds.length || normalizedQuestionIds.some((entry) => !entry.ok)) {
      return agentRouteError(res, 400, 'questionIds must contain at least one 32-byte hex string.', {
        code: 'invalid_question_ids',
        agentStatus: 'bad_request',
      });
    }

    const requester = auth.payload?.sub || '';
    const requestQuestionIds = normalizedQuestionIds.map((entry) => entry.questionId);
    const requestFingerprint = buildAgentRequestFingerprint({
      type: AGENT_REQUEST_TYPES.RESPONSE_SUBMIT,
      requester,
      session: sessionValidation.slug,
      questionIds: requestQuestionIds,
    });
    const idempotencyKey = normalizeAgentIdempotencyKey(body?.idempotencyKey);
    const existingRequest = loadAgentRequestByIdempotencyKey(auth.payload?.sub || '', idempotencyKey);
    if (existingRequest) {
      const existingFingerprint = existingRequest.fingerprint || buildAgentRequestFingerprint(existingRequest);
      if (existingFingerprint !== requestFingerprint) {
        return json(res, 409, buildAgentError('idempotencyKey conflicts with an existing agent request.', {
          status: 'idempotency_conflict',
          code: 'idempotency_key_conflict',
        }));
      }
      const existingRead = summarizeAgentRequestForRead(existingRequest);
      if (existingRead.summary.requiresApproval !== true) {
        return json(res, 409, buildAgentError(
          'idempotencyKey refers to an agent request that is not pending approval.',
          {
            status: 'request_not_pending_approval',
            code: 'idempotency_key_not_pending_approval',
            fields: {
              request: existingRead.summary,
              lifecycle: existingRead.lifecycle,
            },
          },
        ));
      }
      const existingApproval = buildApprovalRequiredResponse({
        requestId: existingRequest.requestId,
        serverUrl: getTrustedAgentServerUrl(),
        fields: {
          capabilityMode: 'submit-request',
          idempotent: true,
        },
      });
      return json(res, 202, {
        ...existingApproval,
        request: summarizeAgentRequestForRead({
          ...existingRequest,
          approvalUrl: existingApproval.approvalUrl,
        }).summary,
      });
    }

    const requestId = createApprovalRequestId();
    const createdAt = new Date().toISOString();
    const serverUrl = getTrustedAgentServerUrl();
    const approval = buildApprovalRequiredResponse({
      requestId,
      serverUrl,
      fields: {
        capabilityMode: 'submit-request',
      },
    });
    const record = saveAgentRequest(buildAgentRequestRecord({
      type: AGENT_REQUEST_TYPES.RESPONSE_SUBMIT,
      requestId,
      status: approval.status,
      requiresApproval: true,
      approvalUrl: approval.approvalUrl,
      session: sessionValidation.slug,
      questionIds: normalizedQuestionIds.map((entry) => entry.questionId),
      requester,
      idempotencyKey,
      createdAt,
      updatedAt: createdAt,
      source: 'agent-http',
      payload: redactAgentSensitiveFields({
        session: sessionValidation.slug,
        questionIds: normalizedQuestionIds.map((entry) => entry.questionId),
        agentContext: body?.agentContext || null,
      }),
    }));

    return json(res, 202, {
      ...approval,
      request: summarizeAgentRequestForRead(record).summary,
    });
  }

  if (path === '/api/agent/responses/delegated-execute' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);

    const { session, questionIds, questionId, grantId, agentId } = body || {};
    const sessionValidation = validateAgentSessionSlug(session, {
      required: true,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }

    const rawQuestionIds = Array.isArray(questionIds)
      ? questionIds
      : (questionId ? [questionId] : []);
    const normalizedQuestionIds = rawQuestionIds.map((value) => validateQuestionId(value));
    if (!normalizedQuestionIds.length || normalizedQuestionIds.some((entry) => !entry.ok)) {
      return agentRouteError(res, 400, 'questionIds must contain at least one 32-byte hex string.', {
        code: 'invalid_question_ids',
        agentStatus: 'bad_request',
      });
    }

    const normalizedGrantId = String(grantId || '').trim();
    if (!isValidAgentGrantId(normalizedGrantId)) {
      return agentRouteError(res, 400, 'Invalid agent grant id.', {
        code: 'invalid_grant_id',
        agentStatus: 'bad_request',
      });
    }

    const requester = auth.payload?.sub || '';
    const grant = loadAgentGrant(normalizedGrantId);
    if (!grant || normalizeAddressLower(grant.humanPrincipal) !== normalizeAddressLower(requester)) {
      return agentRouteError(res, 404, 'Agent grant not found.', {
        code: 'agent_grant_not_found',
        agentStatus: 'not_found',
      });
    }

    const requestQuestionIds = normalizedQuestionIds.map((entry) => entry.questionId);
    const actionId = AGENT_ACTION_IDS.RESPONSE_DELEGATED_EXECUTE;
    const decision = evaluateScopedDelegatedExecutionGrant(grant, {
      requiredScope: AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
      session: sessionValidation.slug,
      actionId,
      riskLevel: AGENT_RISK_LEVELS.MEDIUM,
      humanPrincipal: requester,
      agentId,
      auditWillBeRecorded: true,
      exposesRemoteSigningAuthority: false,
      exposesRemoteWorkerAuthority: false,
    });
    if (!decision.ok) {
      return json(res, 403, buildAgentError('Scoped delegated grant denied.', {
        status: 'denied',
        code: 'agent_grant_denied',
        fields: {
          reason: decision.reason,
          grant: summarizeAgentGrantForRead(decision.grant),
        },
      }));
    }

    const requestFingerprint = buildAgentRequestFingerprint({
      type: AGENT_REQUEST_TYPES.RESPONSE_DELEGATED_EXECUTE,
      requester,
      session: sessionValidation.slug,
      actionId,
      grantId: normalizedGrantId,
      questionIds: requestQuestionIds,
    });
    const idempotencyKey = normalizeAgentIdempotencyKey(body?.idempotencyKey);
    const existingRequest = loadAgentRequestByIdempotencyKey(auth.payload?.sub || '', idempotencyKey);
    if (existingRequest) {
      const existingFingerprint = existingRequest.fingerprint || buildAgentRequestFingerprint(existingRequest);
      if (existingFingerprint !== requestFingerprint) {
        return json(res, 409, buildAgentError('idempotencyKey conflicts with an existing agent request.', {
          status: 'idempotency_conflict',
          code: 'idempotency_key_conflict',
        }));
      }
      const existingRead = summarizeAgentRequestForRead(existingRequest);
      return json(res, 202, buildAgentOk({
        executed: false,
        execution: {
          status: 'contract_only_deferred',
          reason: 'delegated_execution_already_recorded',
          productDecisionRequired: true,
        },
        idempotent: true,
        request: existingRead.summary,
        lifecycle: existingRead.lifecycle,
      }, { status: 'delegated_execution_deferred' }));
    }

    const requestId = createApprovalRequestId();
    const createdAt = new Date().toISOString();
    const record = saveAgentRequest(buildAgentRequestRecord({
      type: AGENT_REQUEST_TYPES.RESPONSE_DELEGATED_EXECUTE,
      requestId,
      status: AGENT_REQUEST_STATUS.APPROVED,
      requiresApproval: false,
      approvalUrl: null,
      session: sessionValidation.slug,
      questionIds: requestQuestionIds,
      requester,
      actionId,
      grantId: normalizedGrantId,
      idempotencyKey,
      createdAt,
      updatedAt: createdAt,
      source: 'agent-http',
      payload: redactAgentSensitiveFields({
        session: sessionValidation.slug,
        questionIds: requestQuestionIds,
        agentId,
        grantId: normalizedGrantId,
        actionId,
        executionPolicy: AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE,
        executionStatus: 'contract_only_deferred',
        agentContext: body?.agentContext || null,
      }),
    }));

    const requestRead = summarizeAgentRequestForRead(record);
    return json(res, 202, buildAgentOk({
      executed: false,
      execution: {
        status: 'contract_only_deferred',
        reason: 'delegated_execution_validated',
        productDecisionRequired: true,
      },
      grant: summarizeAgentGrantForRead(decision.grant),
      request: requestRead.summary,
      lifecycle: requestRead.lifecycle,
    }, { status: 'delegated_execution_deferred' }));
  }

  if (path === '/api/agent/connect-requests' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);

    const requester = auth.payload?.sub || '';
    const requestId = createApprovalRequestId();
    const createdAt = new Date().toISOString();
    const serverUrl = getTrustedAgentServerUrl();
    const validation = validateAgentConnectRequestForCreation({
      ...body,
      requestId,
      humanPrincipal: requester,
      requester,
      createdAt,
      updatedAt: createdAt,
      status: AGENT_REQUEST_STATUS.PENDING_APPROVAL,
    }, {
      humanPrincipal: requester,
    });
    if (!validation.ok) {
      return json(res, 400, buildAgentError('Invalid agent connect request.', {
        status: 'bad_request',
        code: 'invalid_connect_request',
        fields: {
          reason: validation.reason,
        },
      }));
    }

    const normalized = validation.request;
    const existingRequest = loadAgentRequestByIdempotencyKey(requester, normalized.idempotencyKey);
    if (existingRequest) {
      const existingConnect = normalizeAgentConnectRequest(existingRequest);
      if (existingConnect.fingerprint !== normalized.fingerprint) {
        return json(res, 409, buildAgentError('idempotencyKey conflicts with an existing agent connect request.', {
          status: 'idempotency_conflict',
          code: 'idempotency_key_conflict',
        }));
      }
      const existingRead = summarizeAgentConnectRequestForRead(existingConnect);
      if (existingRead.connectRequest.requiresApproval !== true) {
        return json(res, 409, buildAgentError(
          'idempotencyKey refers to an agent connect request that is not pending approval.',
          {
            status: 'request_not_pending_approval',
            code: 'idempotency_key_not_pending_approval',
            fields: existingRead,
          },
        ));
      }
      return json(res, 202, {
        ...buildApprovalRequiredResponse({
          requestId: existingConnect.requestId,
          approvalUrl: existingConnect.approvalUrl,
          serverUrl,
          reason: 'human_grant_approval_required',
          message: 'Human approval is required before this scoped agent grant can be created.',
          fields: {
            capabilityMode: 'connect-grant-request',
            idempotent: true,
          },
        }),
        ...existingRead,
      });
    }

    const approval = buildApprovalRequiredResponse({
      requestId,
      serverUrl,
      reason: 'human_grant_approval_required',
      message: 'Human approval is required before this scoped agent grant can be created.',
      fields: {
        capabilityMode: 'connect-grant-request',
      },
    });
    const record = saveAgentRequest({
      ...normalized,
      requestId,
      status: AGENT_REQUEST_STATUS.PENDING_APPROVAL,
      requiresApproval: true,
      requester,
      approvalUrl: approval.approvalUrl,
      createdAt,
      updatedAt: createdAt,
      payload: redactAgentSensitiveFields({
        agentId: normalized.agentId,
        requestedScopes: normalized.requestedScopes,
        requestedSessions: normalized.requestedSessions,
        requestedActions: normalized.requestedActions,
        riskCeiling: normalized.riskCeiling,
        executionPolicy: normalized.executionPolicy,
        auditRequired: normalized.auditRequired,
        expiresAt: normalized.expiresAt,
        agentContext: body?.agentContext || null,
      }),
    });
    return json(res, 202, {
      ...approval,
      ...summarizeAgentConnectRequestForRead(record),
    });
  }

  if (path === '/api/agent/connect-requests/approve' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    if (isAgentConnectApprovalOverrideAttempt(body)) {
      return json(res, 400, buildAgentError('Connect request approval cannot override scoped grant fields.', {
        status: 'bad_request',
        code: 'connect_request_scope_override_denied',
      }));
    }
    const requestId = String(body?.requestId || '').trim();
    if (!isValidApprovalRequestId(requestId)) {
      return agentRouteError(res, 400, 'Invalid agent request id.', {
        code: 'invalid_request_id',
        agentStatus: 'bad_request',
      });
    }
    const request = loadAgentRequest(requestId);
    const walletAddress = normalizeAddressLower(auth.payload?.sub || '');
    if (
      !request
      || request.type !== AGENT_REQUEST_TYPES.CONNECT_GRANT
      || normalizeAddressLower(request.humanPrincipal || request.requester) !== walletAddress
    ) {
      return agentRouteError(res, 404, 'Agent connect request not found.', {
        code: 'agent_connect_request_not_found',
        agentStatus: 'not_found',
      });
    }
    const decision = evaluateAgentConnectRequestApproval(request, {
      humanPrincipal: walletAddress,
    });
    if (!decision.ok) {
      return json(res, 409, buildAgentError('Agent connect request cannot be approved.', {
        status: 'not_approvable',
        code: 'connect_request_not_approvable',
        fields: {
          reason: decision.reason,
          ...summarizeAgentConnectRequestForRead(decision.request),
        },
      }));
    }
    const approvedAt = new Date().toISOString();
    const grantId = createAgentGrantIdFromConnectRequestId(requestId);
    const grant = saveAgentGrant(buildAgentGrantFromConnectRequest(decision.request, {
      grantId,
      approvedAt,
    }));
    const updated = saveAgentRequest({
      ...request,
      status: AGENT_REQUEST_STATUS.APPROVED,
      requiresApproval: false,
      grantId,
      approvedAt,
      updatedAt: approvedAt,
    });
    return json(res, 200, buildAgentOk({
      approved: true,
      grant: summarizeAgentGrantForRead(grant),
      ...summarizeAgentConnectRequestForRead(updated),
    }, { status: 'connect_request_approved' }));
  }

  if (path === '/api/agent/connect-requests/deny' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    if (isAgentConnectApprovalOverrideAttempt(body)) {
      return json(res, 400, buildAgentError('Connect request denial cannot override scoped grant fields.', {
        status: 'bad_request',
        code: 'connect_request_scope_override_denied',
      }));
    }
    const requestId = String(body?.requestId || '').trim();
    if (!isValidApprovalRequestId(requestId)) {
      return agentRouteError(res, 400, 'Invalid agent request id.', {
        code: 'invalid_request_id',
        agentStatus: 'bad_request',
      });
    }
    const request = loadAgentRequest(requestId);
    const walletAddress = normalizeAddressLower(auth.payload?.sub || '');
    if (
      !request
      || request.type !== AGENT_REQUEST_TYPES.CONNECT_GRANT
      || normalizeAddressLower(request.humanPrincipal || request.requester) !== walletAddress
    ) {
      return agentRouteError(res, 404, 'Agent connect request not found.', {
        code: 'agent_connect_request_not_found',
        agentStatus: 'not_found',
      });
    }
    const decision = evaluateAgentConnectRequestApproval(request, {
      humanPrincipal: walletAddress,
    });
    if (!decision.ok) {
      return json(res, 409, buildAgentError('Agent connect request cannot be denied.', {
        status: 'not_deniable',
        code: 'connect_request_not_deniable',
        fields: {
          reason: decision.reason,
          ...summarizeAgentConnectRequestForRead(decision.request),
        },
      }));
    }
    const deniedAt = new Date().toISOString();
    const updated = saveAgentRequest({
      ...request,
      status: AGENT_REQUEST_STATUS.REJECTED,
      requiresApproval: false,
      deniedAt,
      denialReason: String(body?.reason || '').trim() || null,
      updatedAt: deniedAt,
    });
    return json(res, 200, buildAgentOk({
      denied: true,
      ...summarizeAgentConnectRequestForRead(updated),
    }, { status: 'connect_request_denied' }));
  }

  if (path.startsWith('/api/agent/connect-requests/') && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const requestId = decodeURIComponent(path.slice('/api/agent/connect-requests/'.length));
    if (!isValidApprovalRequestId(requestId)) {
      return agentRouteError(res, 400, 'Invalid agent request id.', {
        code: 'invalid_request_id',
        agentStatus: 'bad_request',
      });
    }
    const request = loadAgentRequest(requestId);
    const walletAddress = normalizeAddressLower(auth.payload?.sub || '');
    if (
      !request
      || request.type !== AGENT_REQUEST_TYPES.CONNECT_GRANT
      || normalizeAddressLower(request.humanPrincipal || request.requester) !== walletAddress
    ) {
      return agentRouteError(res, 404, 'Agent connect request not found.', {
        code: 'agent_connect_request_not_found',
        agentStatus: 'not_found',
      });
    }
    return json(res, 200, buildAgentOk(summarizeAgentConnectRequestForRead(request)));
  }

  if (path === '/api/agent/accounts/create' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    if (bodyContainsAgentSensitiveMaterial(body)) {
      return json(res, 400, buildAgentError('Managed account requests must not include secrets or signing material.', {
        status: 'bad_request',
        code: 'account_secret_material_denied',
      }));
    }

    const createdAt = new Date().toISOString();
    const prepared = normalizeManagedAgentAccountContract({
      body,
      authPayload: auth.payload,
      createdAt,
      lifecycle: 'account_created',
    });
    if (!prepared.ok) {
      return json(res, 400, buildAgentError(prepared.error || 'Invalid managed account request.', {
        status: 'bad_request',
        code: 'invalid_managed_account_request',
      }));
    }

    const existing = loadAgentAccount(prepared.account.accountId);
    const account = existing
      ? {
        ...existing,
        lifecycle: 'account_recovered',
        recoveredAt: createdAt,
        updatedAt: createdAt,
        signingAuthority: false,
        workerTokenAuthority: false,
        privateKeyAuthority: false,
        longLivedBearerAuthority: false,
        rawKeyMaterialExportable: false,
        signingEnabled: false,
        contractOnly: true,
      }
      : prepared.account;
    const saved = saveAgentAccount(account);
    const eventType = existing
      ? AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_RECOVERED
      : AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED;
    const event = saveAgentBridgeEvent(buildAgentAccountEvent({
      eventType,
      account: saved,
      createdAt,
    }));
    return json(res, existing ? 200 : 201, buildAgentOk({
      account: saved,
      event,
      events: [event],
      signingEnabled: false,
      contractOnly: true,
    }, {
      status: existing ? 'account_recovered' : 'account_created',
    }));
  }

  if (path === '/api/agent/accounts/link-request' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    if (bodyContainsAgentSensitiveMaterial(body)) {
      return json(res, 400, buildAgentError('Account link requests must not include secrets or signing material.', {
        status: 'bad_request',
        code: 'account_secret_material_denied',
      }));
    }

    const accountId = String(body?.accountId || body?.managedAccountId || '').trim();
    const account = loadAgentAccount(accountId);
    const requester = normalizeAddressLower(auth.payload?.sub || '');
    if (!account || normalizeAddressLower(account.humanPrincipal) !== requester) {
      return agentRouteError(res, 404, 'Managed agent account not found.', {
        code: 'managed_agent_account_not_found',
        agentStatus: 'not_found',
      });
    }

    const idempotencyKey = normalizeAgentIdempotencyKey(body?.idempotencyKey);
    const requestFingerprint = buildAgentRequestFingerprint({
      type: AGENT_REQUEST_TYPES.ACCOUNT_LINK,
      requester,
      session: account.session || 'general',
      actionId: AGENT_ACTION_IDS.ACCOUNT_LINK_REQUEST,
      grantId: account.accountId,
    });
    const existingRequest = loadAgentRequestByIdempotencyKey(requester, idempotencyKey);
    if (existingRequest) {
      const existingFingerprint = existingRequest.fingerprint || buildAgentRequestFingerprint(existingRequest);
      if (existingFingerprint !== requestFingerprint) {
        return json(res, 409, buildAgentError('idempotencyKey conflicts with an existing account link request.', {
          status: 'idempotency_conflict',
          code: 'idempotency_key_conflict',
        }));
      }
      const existingRead = summarizeAgentRequestForRead(existingRequest);
      return json(res, 202, buildAgentOk({
        request: existingRead.summary,
        lifecycle: existingRead.lifecycle,
        account,
        idempotent: true,
        linked: false,
        signingEnabled: false,
        contractOnly: true,
      }, { status: 'account_link_requested' }));
    }

    const requestId = createApprovalRequestId();
    const createdAt = new Date().toISOString();
    const approval = buildApprovalRequiredResponse({
      requestId,
      serverUrl: getTrustedAgentServerUrl(),
      reason: 'account_link_approval_required',
      message: 'Human approval is required before this managed account can be linked.',
      fields: {
        capabilityMode: 'account-link-request',
      },
    });
    const request = saveAgentRequest(buildAgentRequestRecord({
      type: AGENT_REQUEST_TYPES.ACCOUNT_LINK,
      requestId,
      status: approval.status,
      requiresApproval: true,
      approvalUrl: approval.approvalUrl,
      session: account.session || 'general',
      requester,
      actionId: AGENT_ACTION_IDS.ACCOUNT_LINK_REQUEST,
      grantId: account.accountId,
      idempotencyKey,
      createdAt,
      updatedAt: createdAt,
      source: 'agent-http',
      payload: redactAgentSensitiveFields({
        accountId: account.accountId,
        accountAddress: account.accountAddress,
        targetPrincipal: body?.targetPrincipal || null,
        agentContext: body?.agentContext || null,
      }),
    }));
    const requestRead = summarizeAgentRequestForRead(request);
    const event = saveAgentBridgeEvent(buildAgentAccountEvent({
      eventType: AGENT_BRIDGE_EVENT_TYPES.LINK_REQUESTED,
      account,
      request,
      createdAt,
    }));
    return json(res, 202, {
      ...approval,
      account,
      request: requestRead.summary,
      lifecycle: requestRead.lifecycle,
      event,
      events: [event],
      linked: false,
      signingEnabled: false,
      contractOnly: true,
    });
  }

  if (path === '/api/agent/grants' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const sessionValidation = validateAgentSessionSlug(url.searchParams.get('session'), {
      required: false,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }
    const requestedSession = sessionValidation.slug.toLowerCase();
    const grants = loadAgentGrantsForWallet(auth.payload?.sub || '')
      .filter((grant) => (
        !requestedSession
        || grant.sessions.map((entry) => String(entry || '').toLowerCase()).includes(requestedSession)
      ))
      .map((grant) => summarizeAgentGrantForRead(grant));
    return json(res, 200, buildAgentOk({
      grants,
      count: grants.length,
    }));
  }

  if (path === '/api/agent/grants/revoke' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const grantId = String(body?.grantId || '').trim();
    if (!isValidAgentGrantId(grantId)) {
      return agentRouteError(res, 400, 'Invalid agent grant id.', {
        code: 'invalid_grant_id',
        agentStatus: 'bad_request',
      });
    }
    const grant = loadAgentGrant(grantId);
    if (!grant || normalizeAddressLower(grant.humanPrincipal) !== normalizeAddressLower(auth.payload?.sub || '')) {
      return agentRouteError(res, 404, 'Agent grant not found.', {
        code: 'agent_grant_not_found',
        agentStatus: 'not_found',
      });
    }
    const revokedAt = new Date().toISOString();
    const revoked = saveAgentGrant({
      ...grant,
      status: 'revoked',
      revokedAt: grant.revokedAt || revokedAt,
      updatedAt: revokedAt,
    });
    return json(res, 200, buildAgentOk({
      revoked: true,
      grant: summarizeAgentGrantForRead(revoked),
    }, { status: 'grant_revoked' }));
  }

  if (path.startsWith('/api/agent/grants/') && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const sessionValidation = validateAgentSessionSlug(url.searchParams.get('session'), {
      required: false,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }
    const grantId = decodeURIComponent(path.slice('/api/agent/grants/'.length));
    if (!isValidAgentGrantId(grantId)) {
      return agentRouteError(res, 400, 'Invalid agent grant id.', {
        code: 'invalid_grant_id',
        agentStatus: 'bad_request',
      });
    }
    const grant = loadAgentGrant(grantId);
    const requestedSession = sessionValidation.slug.toLowerCase();
    if (
      !grant
      || normalizeAddressLower(grant.humanPrincipal) !== normalizeAddressLower(auth.payload?.sub || '')
      || (
        requestedSession
        && !grant.sessions.map((entry) => String(entry || '').toLowerCase()).includes(requestedSession)
      )
    ) {
      return agentRouteError(res, 404, 'Agent grant not found.', {
        code: 'agent_grant_not_found',
        agentStatus: 'not_found',
      });
    }
    return json(res, 200, buildAgentOk({
      grant: summarizeAgentGrantForRead(grant),
    }));
  }

  if (path === '/api/respond' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const {
      questionId,
      session,
      answer,
      questionType,
      conviction,
      importance,
      additional,
      encrypt,
      encryptAdditional,
      answerEncryptionAudience,
      answerEncryptionGateId,
      additionalEncryptionAudience,
      additionalEncryptionGateId,
    } = body || {};
    const questionValidation = validateQuestionId(questionId);
    if (!questionValidation.ok) {
      return json(res, 400, { error: questionValidation.error });
    }
    const canonicalQuestionId = questionValidation.questionId;
    const encryptionRequested = isEncryptionRequested(encrypt);
    const hasAdditionalText = String(additional ?? '').trim() !== '';
    const hasExplicitEncryptAdditional = Object.prototype.hasOwnProperty.call(body || {}, 'encryptAdditional');
    const encryptionAdditionalRequested = hasExplicitEncryptAdditional
      ? isEncryptionRequested(encryptAdditional)
      : (encryptionRequested && hasAdditionalText);
    const normalizedQuestionType = String(questionType || 'unknown').toLowerCase().trim();
    // Normalize rating answers: extract first numeric value from label strings like '4-6 (Medium)'
    let resolvedAnswer = answer;
    if (normalizedQuestionType === 'rating' && answer != null) {
      if (typeof answer === 'number') {
        resolvedAnswer = answer;
      } else {
        const str = String(answer).trim();
        const direct = Number(str);
        if (Number.isFinite(direct)) {
          resolvedAnswer = direct;
        } else {
          const match = str.match(/(\d+(?:\.\d+)?)/);
          resolvedAnswer = match ? Number(match[1]) : answer;
        }
      }
    }
    const isEmptyAnswer = resolvedAnswer == null
      || (typeof resolvedAnswer === 'string' && resolvedAnswer.trim() === '');
    const isInvalidRating = normalizedQuestionType === 'rating'
      && (resolvedAnswer == null || !Number.isFinite(Number(resolvedAnswer)) || Number(resolvedAnswer) < 0 || Number(resolvedAnswer) > 10);
    if (isEmptyAnswer || isInvalidRating) {
      return json(res, 400, { error: 'questionId and answer are required.' });
    }
    const storedAnswerResult = normalizeStoredResponseAnswer(answer, normalizedQuestionType, resolvedAnswer);
    if (!storedAnswerResult.ok) {
      return json(res, storedAnswerResult.status, { error: storedAnswerResult.error });
    }
    try {
      const sessionValidation = validateSessionSlug(session, {
        required: true,
        allowExplicitEmpty: true,
      });
      if (!sessionValidation.ok) {
        return json(res, 400, { error: sessionValidation.error });
      }
      const slug = sessionValidation.slug;
      const metadata = await getSessionMetadata(slug).catch(() => null);
      const audienceContext = deriveResponseGateOptionsFromMetadata(metadata, { isQuestionResponseFlow: true });
      const normalizedAudiences = normalizeResponseAudienceSelections({
        answerAudience: answerEncryptionAudience,
        answerGateId: answerEncryptionGateId,
        additionalAudience: additionalEncryptionAudience,
        additionalGateId: additionalEncryptionGateId,
        encryptRequested: encryptionRequested,
        encryptAdditionalRequested: hasExplicitEncryptAdditional ? encryptionAdditionalRequested : null,
        hasAdditionalText,
        gateOptions: audienceContext.gateOptions,
      });
      const dir = resolve(RESPONSES_DIR, slug);
      // Path traversal guard (defense-in-depth): ensure resolved dir stays under RESPONSES_DIR
      const rel = relative(resolve(RESPONSES_DIR), dir);
      if (rel.startsWith('..') || resolve(RESPONSES_DIR, rel) !== dir) {
        return json(res, 400, { error: 'Invalid session slug.' });
      }
      mkdirSync(dir, { recursive: true });
      const response = {
        questionId: canonicalQuestionId,
        answer: storedAnswerResult.storedAnswer,
        conviction: conviction != null ? conviction : null,
        importance: importance != null ? importance : null,
        additional: additional || null,
        encrypt: isEncryptedAudience(normalizedAudiences.answerEncryptionAudience),
        encryptAdditional: hasAdditionalText
          ? isEncryptedAudience(normalizedAudiences.additionalEncryptionAudience)
          : false,
        answerEncryptionAudience: normalizedAudiences.answerEncryptionAudience,
        answerEncryptionGateId: normalizedAudiences.answerEncryptionGateId,
        additionalEncryptionAudience: normalizedAudiences.additionalEncryptionAudience,
        additionalEncryptionGateId: normalizedAudiences.additionalEncryptionGateId,
        additionalAudienceMode: normalizedAudiences.additionalAudienceMode,
        questionType: questionType || 'unknown',
        respondent: auth.payload.sub,
        timestamp: new Date().toISOString(),
        submitted: false, // not yet on-chain
      };
      const file = resolve(dir, `${canonicalQuestionId.replace(/[^a-fA-F0-9x]/g, '_')}.json`);
      writeSecureFile(file, JSON.stringify(response, null, 2));

      // Clear the "recently served" mark so it doesn't block the pool unnecessarily
      clearServed(questionId);

      // Auto-increment cooldown by 2 minutes after each response (bounded to max).
      try {
        const hookConfig = loadHookConfig();
        const currentCooldown = normalizeHookCooldownMs(hookConfig.cooldownMs);
        hookConfig.cooldownMs = normalizeHookCooldownMs(
          currentCooldown + RESPONSE_COOLDOWN_INCREMENT_MS
        );
        saveHookConfig(hookConfig);
        debug(`[router] Cooldown incremented: ${currentCooldown / 1000}s → ${hookConfig.cooldownMs / 1000}s`);
      } catch (err) {
        error(`[router] Failed to increment cooldown:`, err.message);
      }

      // Auto-submit if immediate mode is enabled. Await the submit attempt so
      // the HTTP response carries the actual outcome (or a timeout marker so
      // the caller knows the submit is still running in the background).
      const settings = loadSettings();
      if (settings.autoSubmitResponses && canSubmitImpl().ready) {
        const walletAddr = String(auth.payload?.sub || '').trim().toLowerCase();
        const submitPromise = (async () => {
          try {
            const workerToken = await ensureWorkerToken(slug, walletAddr, deps);
            if (!workerToken) {
              warn(
                `[submit] Auto-submit skipped for ${canonicalQuestionId}: no worker token stored or obtainable for session "${slug}"`
              );
              return { kind: 'no_worker_token' };
            }

            try {
              const balance = await getFaucetBalanceStatus(walletAddr, deps);
              if (balance.eligible && workerToken) {
                debug(`[submit] Balance low (${balance.balanceEth} ETH), requesting faucet funds...`);
                const faucetRequest = await requestFaucetWorkerTransfer({ slug, recipientAddress: walletAddr }, deps);
                if (faucetRequest.workerResponse?.ok) {
                  const faucetData = await faucetRequest.workerResponse.json().catch(() => ({}));
                  debug(
                    `[submit] Faucet funded: ${faucetData.amountEth || 'unknown'} ETH (tx: ${faucetData.txHash || 'unknown'})`
                  );
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                } else {
                  const errText = await faucetRequest.workerResponse?.text().catch(() => '');
                  warn(`[submit] Faucet request failed: ${errText}`);
                }
              }
            } catch (faucetErr) {
              warn(`[submit] Auto-faucet check failed: ${faucetErr.message}`);
            }

            const result = await submitOnChainImpl([response], slug, workerToken);
            if (result.ok) {
              const stored = JSON.parse(readFileSync(file, 'utf8'));
              stored.submitted = true;
              stored.txHash = result.txHash;
              stored.blockNumber = result.blockNumber ?? null;
              const storageRef = buildStorageRefFromResult(result, 0);
              const surveyStorageRef = buildSurveyStorageRefFromResult(result);
              stored.arweaveTxId = getLegacyArweaveTxId({
                storageRef,
                arweaveTxId: result.arweaveTxIds?.[0],
              }) || null;
              stored.storageRef = storageRef || null;
              stored.surveyArweaveTxId = getLegacyArweaveTxId({
                storageRef: surveyStorageRef,
                arweaveTxId: result.surveyArweaveTxId,
              }) || null;
              stored.surveyStorageRef = surveyStorageRef || null;
              stored.submittedAt = new Date().toISOString();
              writeSecureFile(file, JSON.stringify(stored, null, 2));
              debug(`[router] Auto-submitted response ${canonicalQuestionId} → tx ${result.txHash}`);
              return { kind: 'submitted', txHash: result.txHash, blockNumber: result.blockNumber ?? null };
            }
            error(`[router] Auto-submit failed for ${canonicalQuestionId}: ${result.error}`);
            return { kind: 'failed', error: String(result.error || 'submit failed') };
          } catch (err) {
            error(`[router] Auto-submit error for ${canonicalQuestionId}: ${err.message}`);
            return { kind: 'failed', error: err.message };
          }
        })();

        let timeoutId;
        const timeoutPromise = new Promise((resolveTimeout) => {
          timeoutId = nativeSetTimeout(
            () => resolveTimeout({ kind: 'timeout' }),
            getAutoSubmitAwaitTimeoutMs(),
          );
        });

        const outcome = await Promise.race([submitPromise, timeoutPromise]);
        nativeClearTimeout(timeoutId);
        // On timeout, do NOT cancel submitPromise — let it run so the
        // background `stored.submitted = true` write still happens.

        if (outcome.kind === 'submitted') {
          const txExplorerUrl = buildTxExplorerUrl(outcome.txHash);
          const autoSubmit = buildAutoSubmitStatus('submitted', {
            txHash: outcome.txHash,
            blockNumber: outcome.blockNumber,
            ...(txExplorerUrl ? { txExplorerUrl } : {}),
          });
          return json(res, 200, {
            ok: true,
            stored: true,
            submitted: true,
            txHash: outcome.txHash,
            blockNumber: outcome.blockNumber,
            ...(txExplorerUrl ? { txExplorerUrl } : {}),
            requiresWorkerAuth: false,
            autoSubmit,
            acknowledgement: 'Submitted securely. Auto-submit succeeded.',
            message: autoSubmit.message,
          });
        }
        if (outcome.kind === 'no_worker_token') {
          const autoSubmit = buildAutoSubmitStatus('worker-auth-required');
          return json(res, 200, {
            ok: true,
            stored: true,
            submitted: false,
            requiresWorkerAuth: true,
            autoSubmit,
            acknowledgement: 'Saved locally. Session sign-in is required before auto-submit can run.',
            message:
              'Session sign-in is required for this session before auto-submit can run; complete session sign-in at http://localhost:7391.',
          });
        }
        if (outcome.kind === 'timeout') {
          const autoSubmit = buildAutoSubmitStatus('pending');
          return json(res, 200, {
            ok: true,
            stored: true,
            submitted: false,
            pending: true,
            requiresWorkerAuth: false,
            autoSubmit,
            acknowledgement: 'Saved locally. Auto-submit is still in progress.',
            message: autoSubmit.message,
          });
        }
        const autoSubmit = buildAutoSubmitStatus('failed', {
          error: outcome.error,
        });
        return json(res, 200, {
          ok: true,
          stored: true,
          submitted: false,
          error: outcome.error,
          requiresWorkerAuth: false,
          autoSubmit,
          acknowledgement: 'Saved locally. Auto-submit failed.',
          message: `${autoSubmit.message} ${outcome.error || ''}`.trim(),
        });
      }

      const autoSubmit = buildAutoSubmitStatus('disabled');
      return json(res, 200, {
        ok: true,
        stored: true,
        submitted: false,
        autoSubmit,
        acknowledgement: 'Saved locally. Auto-submit is disabled.',
        message: autoSubmit.message,
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // --- On-chain submission endpoint ---

  if (path === '/api/responses/submit-onchain' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const { session, questionIds } = body || {};
    const sessionValidation = validateSessionSlug(session, {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const normalizedQuestionIds = Array.isArray(questionIds)
      ? questionIds.map((value) => validateQuestionId(value))
      : null;
    if (Array.isArray(normalizedQuestionIds) && normalizedQuestionIds.some((entry) => !entry.ok)) {
      return json(res, 400, { error: 'questionIds must contain only 32-byte hex strings.' });
    }
    const normalizedSession = sessionValidation.slug;

    const status = canSubmitImpl();
    if (!status.ready) {
      return json(res, 400, { error: `Not ready: hasKey=${status.hasKey}, hasContract=${status.hasContract}` });
    }

    try {
      // Load pending responses for this session
      let pending = loadPendingResponses(normalizedSession);
      pending = filterPendingResponsesForSubmission(pending, {
        respondentAddress: auth.payload?.sub || '',
        questionIds: Array.isArray(normalizedQuestionIds)
          ? normalizedQuestionIds.map((entry) => entry.questionId)
          : questionIds,
      });
      if (pending.length === 0) {
        return json(res, 200, { ok: true, count: 0, message: 'No pending responses to submit.' });
      }

      const pendingLease = acquirePendingSubmissionLease(normalizedSession, pending);
      const pendingToSubmit = pendingLease.responses;
      if (pendingToSubmit.length === 0) {
        return json(res, 200, { ok: true, count: 0, message: 'No pending responses to submit.' });
      }

      try {
        const walletAddress = String(auth.payload?.sub || '').trim().toLowerCase();
        const workerToken = await ensureWorkerToken(normalizedSession, walletAddress, deps);
        if (!workerToken) {
          return json(res, 401, { error: 'Session sign-in is missing. Re-authenticate in the local Context Engine UI.' });
        }
        const result = await submitOnChainImpl(pendingToSubmit, normalizedSession, workerToken);

        if (result.ok) {
          // submitResponses() now submits both encrypted and plaintext responses.
          // arweaveTxIds are returned in the same order as the input pending array.
          for (let i = 0; i < pendingToSubmit.length; i++) {
            const r = pendingToSubmit[i];
            const file = getResponseFilePath(normalizedSession, r.questionId);
            if (existsSync(file)) {
              const stored = JSON.parse(readFileSync(file, 'utf8'));
              stored.submitted = true;
              stored.txHash = result.txHash;
              stored.blockNumber = result.blockNumber ?? null;
              const storageRef = buildStorageRefFromResult(result, i);
              const surveyStorageRef = buildSurveyStorageRefFromResult(result);
              stored.arweaveTxId = getLegacyArweaveTxId({
                storageRef,
                arweaveTxId: result.arweaveTxIds?.[i],
              }) || null;
              stored.storageRef = storageRef || null;
              stored.surveyArweaveTxId = getLegacyArweaveTxId({
                storageRef: surveyStorageRef,
                arweaveTxId: result.surveyArweaveTxId,
              }) || null;
              stored.surveyStorageRef = surveyStorageRef || null;
              stored.submittedAt = new Date().toISOString();
              writeSecureFile(file, JSON.stringify(stored, null, 2));
            }
          }
        }

        return json(res, 200, result);
      } finally {
        pendingLease.release();
      }
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/submit/status' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    return json(res, 200, { ...canSubmitImpl(), settings: buildPublicSubmitSettings() });
  }

  // --- Pending responses ---

  if (path === '/api/responses/pending' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const sessionValidation = validateSessionSlug(url.searchParams.get('session'), {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const slug = sessionValidation.slug;
    try {
      let pending = loadPendingResponses(slug);
      // Filter by authenticated wallet address so different wallets see only their own
      pending = filterResponsesByRespondent(pending, auth.payload?.sub || '');
      return json(res, 200, { pending, count: pending.length });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path === '/api/responses/mark-submitted' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const { questionId, session, txHash, arweaveTxId, storageRef } = body || {};
    const questionValidation = validateQuestionId(questionId);
    if (!questionValidation.ok) return json(res, 400, { error: questionValidation.error });
    const sessionValidation = validateSessionSlug(session, {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    try {
      const slug = sessionValidation.slug;
      const canonicalQuestionId = questionValidation.questionId;
      const file = getResponseFilePath(slug, canonicalQuestionId);
      if (!existsSync(file)) {
        return json(res, 404, { error: 'Response not found.' });
      }
      const response = JSON.parse(readFileSync(file, 'utf8'));
      const respondent = String(response?.respondent || '').trim().toLowerCase();
      const walletAddress = String(auth.payload?.sub || '').trim().toLowerCase();
      if (respondent && walletAddress && respondent !== walletAddress) {
        return json(res, 404, { error: 'Response not found.' });
      }
      response.submitted = true;
      response.txHash = txHash || null;
      const compatibleStorage = attachStorageRefCompatibilityFields({
        arweaveTxId,
        storageRef,
        resource: 'responses',
      }, { resource: 'responses' });
      response.arweaveTxId = getLegacyArweaveTxId(compatibleStorage) || null;
      response.storageRef = compatibleStorage.storageRef || null;
      response.submittedAt = new Date().toISOString();
      writeSecureFile(file, JSON.stringify(response, null, 2));
      try {
        recordConfirmedSubmission({
          slug,
          walletAddress,
          txHash: txHash || null,
          questionIds: [canonicalQuestionId],
          arweaveTxIds: arweaveTxId ? [arweaveTxId] : [],
          storageRefs: compatibleStorage.storageRef ? [compatibleStorage.storageRef] : [],
          submittedAt: response.submittedAt,
        });
      } catch (stateErr) {
        error(`[router] Failed to record confirmed submission state for ${canonicalQuestionId}: ${stateErr.message}`);
      }
      return json(res, 200, { ok: true, submitted: true });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (path.startsWith('/api/agent/requests/') && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return agentAuthError(res, auth);
    const sessionValidation = validateAgentSessionSlug(url.searchParams.get('session'), {
      required: false,
    });
    if (!sessionValidation.ok) {
      return agentRouteError(res, 400, sessionValidation.error, {
        code: 'invalid_session',
        agentStatus: 'bad_request',
      });
    }
    const requestId = decodeURIComponent(path.slice('/api/agent/requests/'.length));
    if (!isValidApprovalRequestId(requestId)) {
      return agentRouteError(res, 400, 'Invalid agent request id.', {
        code: 'invalid_request_id',
        agentStatus: 'bad_request',
      });
    }
    const request = loadAgentRequest(requestId);
    const walletAddress = normalizeAddressLower(auth.payload?.sub || '');
    const requestedSession = sessionValidation.slug.toLowerCase();
    if (
      !request
      || (walletAddress && normalizeAddressLower(request.requester) !== walletAddress)
      || (requestedSession && String(request.session || '').trim().toLowerCase() !== requestedSession)
    ) {
      return agentRouteError(res, 404, 'Agent request not found.', {
        code: 'agent_request_not_found',
        agentStatus: 'not_found',
      });
    }
    const requestRead = summarizeAgentRequestForRead(request);
    return json(res, 200, buildAgentOk({
      request: requestRead.summary,
      lifecycle: requestRead.lifecycle,
    }));
  }

  // --- Question creation (on-chain) ---

  if (path === '/api/questions/create' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const { session, questions } = body || {};
    const sessionValidation = validateSessionSlug(session, {
      required: true,
      allowExplicitEmpty: true,
    });
    if (!sessionValidation.ok) return json(res, 400, { error: sessionValidation.error });
    const normalizedSession = sessionValidation.slug;
    if (!Array.isArray(questions) || questions.length === 0) {
      return json(res, 400, { error: 'questions array required (at least 1).' });
    }

    // Validate each question
    for (const q of questions) {
      if (!q.type || !q.prompt) {
        return json(res, 400, { error: 'Each question must have type and prompt.' });
      }
    }

    const status = canSubmitImpl();
    if (!status.ready) {
      return json(res, 400, { error: `Not ready: hasKey=${status.hasKey}, hasContract=${status.hasContract}` });
    }

    try {
      const walletAddress = String(auth.payload?.sub || '').trim().toLowerCase();
      const workerToken = await ensureWorkerToken(normalizedSession, walletAddress, deps);
      if (!workerToken) {
        return json(res, 401, { error: 'Session sign-in is missing. Re-authenticate in the local Context Engine UI.' });
      }
      const result = await submitQuestions(questions, normalizedSession, workerToken);
      return json(res, result.ok ? 200 : 500, result);
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // --- Settings (submit mode: immediate vs batch) ---

  if (path === '/api/settings' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    return json(res, 200, buildPublicSubmitSettings());
  }

  if (path === '/api/settings' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const current = loadSettings();
    const updated = applySubmitSettingsUpdate(current, body);
    saveSettings(updated);
    return json(res, 200, { ok: true, settings: buildPublicSubmitSettings(updated) });
  }

  // --- Hook config (session selection for CC hook) ---

  if (path === '/api/config' && method === 'GET') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    return json(res, 200, buildPublicHookConfig());
  }

  if (path === '/api/config' && method === 'POST') {
    const auth = requireAuth(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });
    const current = loadHookConfig();
    const updated = { ...current };
    delete updated.defaultConviction;
    // Merge provided fields
    if (body?.serverUrl !== undefined) {
      const serverUrlValidation = validateLoopbackServerUrl(body.serverUrl);
      if (!serverUrlValidation.ok) {
        return json(res, 400, { error: serverUrlValidation.error });
      }
      updated.serverUrl = serverUrlValidation.serverUrl;
    }
    if (body?.defaultSession !== undefined) {
      const defaultSessionValidation = validateConfigSessionSlug(
        body.defaultSession,
        'defaultSession',
        { allowEmpty: true },
      );
      if (!defaultSessionValidation.ok) {
        return json(res, 400, { error: defaultSessionValidation.error });
      }
      updated.defaultSession = defaultSessionValidation.slug;
    }
    if (body?.selectedSessions !== undefined) {
      const selectedSessionsValidation = validateSelectedSessions(body.selectedSessions);
      if (!selectedSessionsValidation.ok) {
        return json(res, 400, { error: selectedSessionsValidation.error });
      }
      updated.selectedSessions = selectedSessionsValidation.selectedSessions;
      // Keep defaultSession in sync with selectedSessions
      if (body.defaultSession === undefined) {
        updated.defaultSession = selectedSessionsValidation.selectedSessions.length > 0
          ? selectedSessionsValidation.selectedSessions[0]
          : '';
      }
    }
    // Hook timing settings (ms)
    if (body?.minTimeoutMs !== undefined) {
      updated.minTimeoutMs = Math.max(0, Math.min(300_000, Number(body.minTimeoutMs) || 20_000));
    }
    if (body?.cooldownMs !== undefined) {
      updated.cooldownMs = normalizeHookCooldownMs(body.cooldownMs);
    }
    // PWA preferences
    if (body?.autoCli !== undefined) {
      updated.autoCli = !!body.autoCli;
    }
    if (body?.encryptByDefault !== undefined) {
      updated.encryptByDefault = !!body.encryptByDefault;
    }
    if (body?.aiSuggestFreeform !== undefined) {
      updated.aiSuggestFreeform = !!body.aiSuggestFreeform;
    }
    if (body?.allowReanswer !== undefined) {
      updated.allowReanswer = body.allowReanswer === true || body.allowReanswer === 'true';
    }
    if (body?.showImportance !== undefined) {
      updated.showImportance = !!body.showImportance;
    }
    if (typeof body?.autoSubmitOnLogin === 'boolean') {
      updated.autoSubmitOnLogin = body.autoSubmitOnLogin;
    }
    if (body?.questionSurfacingMode !== undefined) {
      const surfacingModeValidation = validateQuestionSurfacingMode(body.questionSurfacingMode);
      if (!surfacingModeValidation.ok) {
        return json(res, 400, { error: surfacingModeValidation.error });
      }
      updated.questionSurfacingMode = surfacingModeValidation.mode;
    }
    if (body?.ambientInterruptions !== undefined) {
      updated.ambientInterruptions = normalizeBooleanConfig(body.ambientInterruptions, false);
    }
    if (body?.statuslineQuestionHints !== undefined) {
      updated.statuslineQuestionHints = normalizeBooleanConfig(body.statuslineQuestionHints, true);
    }
    saveHookConfig(updated);
    return json(res, 200, { ok: true, config: buildPublicHookConfig(updated) });
  }

  return null; // not handled — fall through to static files
}
