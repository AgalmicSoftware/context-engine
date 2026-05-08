import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const CALLBACK_ACTION_RE = /^cecb_[a-z0-9_-]{8,48}$/;
const PRIVATE_START_ACTION_RE = /^cetg_[a-z0-9_-]{8,48}$/;
const PUBLIC_SESSION_RE = /^[a-z0-9_-]+$/i;
const MAX_PUBLIC_SESSION_LENGTH = 128;
const SENSITIVE_KEY_RE = /(?:privatekey|private_key|jwt|token|secret|signature|bearer|authorization|mnemonic|seed|password)/i;
const SENSITIVE_VALUE_RE = /(?:bearer\s+[a-z0-9._-]+|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64})/i;
const SAFE_HASH_VALUE_KEYS = new Set(['questionid', 'contenthash', 'hash', 'txhash']);
const SAFE_FALSE_AUTHORITY_KEYS = new Set([
  'privatekeyauthority',
  'workertokenauthority',
  'longlivedbearerauthority',
]);
const TELEGRAM_SECURE_GRANT_SCOPE_RE = /^agent:(read|draft|submit-request|delegated-execute|create-question-request|decrypt-request|revoke-grant)$/;
const TELEGRAM_SECURE_GRANT_MAX_TTL_SECONDS = 24 * 60 * 60;
const TELEGRAM_BRIDGE_CONTRACT_VERSION = 'ce-telegram-bridge-contract-v1';
const TELEGRAM_START_PAYLOAD_MAX_BYTES = 64;

const safeString = (value) => String(value || '').trim();
const lower = (value) => safeString(value).toLowerCase();

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function hasSensitiveKeyOrValue(value, path = []) {
  if (Array.isArray(value)) {
    return value.some((entry, index) => hasSensitiveKeyOrValue(entry, [...path, String(index)]));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, entry]) => (
      (SENSITIVE_KEY_RE.test(key) && !(SAFE_FALSE_AUTHORITY_KEYS.has(lower(key)) && entry === false))
      || hasSensitiveKeyOrValue(entry, [...path, key])
    ));
  }
  if (typeof value === 'string') {
    const key = lower(path[path.length - 1]);
    return !SAFE_HASH_VALUE_KEYS.has(key) && SENSITIVE_VALUE_RE.test(value);
  }
  return false;
}

function normalizeTelegramOpaqueId(value, {
  prefix,
  pattern,
  fallback = randomUUID(),
} = {}) {
  const suffix = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  const id = `${prefix}${suffix}`;
  if (!pattern.test(id)) {
    throw new Error('Invalid Telegram opaque action id.');
  }
  return id;
}

function normalizeTelegramSession(session) {
  return normalizePublicAgentSession(session);
}

function normalizeTelegramQuestionId(questionId) {
  return safeString(questionId);
}

function normalizeTelegramPrincipalSummary(principal = {}) {
  const update = principal.update ? normalizeTelegramUpdate(principal.update) : null;
  const user = principal.user || update?.user || principal;
  const userId = safeString(user.telegramUserId || user.userId || user.id);
  return {
    type: 'telegram_principal_summary',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    principalKind: 'telegram',
    principalId: userId ? `telegram:${userId}` : 'telegram:unknown',
    username: safeString(user.username || user.handle) || null,
    languageCode: safeString(user.languageCode || user.language_code) || null,
  };
}

function normalizeTelegramGroupChat(group = {}) {
  const update = group.update ? normalizeTelegramUpdate(group.update) : null;
  const chat = group.chat || update?.chat || group;
  return {
    type: 'telegram_group_summary',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    groupChatId: safeString(chat.groupChatId || chat.chatId || chat.id),
    chatType: safeString(chat.chatType || chat.type) || 'group',
    title: safeString(chat.title) || null,
  };
}

function normalizeTelegramAccountAddress(address) {
  return safeString(address);
}

function assertTelegramBridgeRecordSafe(record) {
  if (hasSensitiveKeyOrValue(record)) {
    throw new Error('Telegram bridge records must not serialize secrets or bearer credentials.');
  }
  return record;
}

export function createTelegramCallbackAction({ actionId = randomUUID(), action = '', requestId = '', expiresAt = null } = {}) {
  if (hasSensitiveKeyOrValue({ actionId, action, requestId })) {
    throw new Error('Telegram callback action metadata must not contain secrets.');
  }
  const id = normalizeTelegramOpaqueId(actionId, {
    prefix: 'cecb_',
    pattern: CALLBACK_ACTION_RE,
  });
  return {
    callbackData: id,
    record: {
      actionId: id,
      action: String(action || '').trim(),
      requestId: String(requestId || '').trim(),
      expiresAt,
    },
  };
}

export function createTelegramPrivateStartPayload(actionId = randomUUID()) {
  const payload = normalizeTelegramOpaqueId(actionId, {
    prefix: 'cetg_',
    pattern: PRIVATE_START_ACTION_RE,
  });
  if (Buffer.byteLength(payload, 'utf8') > TELEGRAM_START_PAYLOAD_MAX_BYTES) {
    throw new Error('Telegram private start payload exceeds Telegram start-parameter constraints.');
  }
  return payload;
}

export function parseTelegramCallbackActionId(callbackData) {
  const actionId = String(callbackData || '').trim();
  if (!CALLBACK_ACTION_RE.test(actionId)) {
    return { ok: false, error: 'Invalid Telegram callback action id.' };
  }
  return { ok: true, actionId };
}

export function parseTelegramPrivateStartPayload(payload) {
  const actionId = safeString(payload);
  if (!PRIVATE_START_ACTION_RE.test(actionId)) {
    return { ok: false, error: 'Invalid Telegram private start action id.' };
  }
  return { ok: true, actionId };
}

export function buildTelegramGroupBinding({
  bindingId = '',
  group = {},
  session = '',
  questionId = '',
  workerDeploymentId = '',
  createdAt = null,
} = {}) {
  const normalizedSession = normalizeTelegramSession(session);
  const groupSummary = normalizeTelegramGroupChat(group);
  const normalizedQuestionId = normalizeTelegramQuestionId(questionId);
  const record = {
    type: 'TelegramGroupBinding',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    bindingId: safeString(bindingId) || createTelegramPrivateStartPayload(`${groupSummary.groupChatId}_${normalizedSession}_${normalizedQuestionId}`),
    group: groupSummary,
    session: normalizedSession,
    questionId: normalizedQuestionId,
    workerDeploymentId: safeString(workerDeploymentId) || null,
    publicLobby: true,
    createdAt,
  };
  return assertTelegramBridgeRecordSafe(record);
}

export function createTelegramPrivateStartAction({
  actionId = randomUUID(),
  groupBinding = {},
  botUsername = '',
  action = 'answer_question',
  expiresAt = null,
  createdAt = null,
} = {}) {
  const binding = buildTelegramGroupBinding(groupBinding);
  const payload = createTelegramPrivateStartPayload(actionId);
  const username = safeString(botUsername).replace(/^@/, '');
  const record = {
    type: 'TelegramPrivateStartAction',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    actionId: payload,
    action: safeString(action) || 'answer_question',
    deepLinkPayload: payload,
    deepLinkUrl: username ? `https://t.me/${encodeURIComponent(username)}?start=${encodeURIComponent(payload)}` : null,
    groupBindingId: binding.bindingId,
    serverContextRef: {
      groupBindingId: binding.bindingId,
      actionId: payload,
    },
    createdAt,
    expiresAt,
  };
  return assertTelegramBridgeRecordSafe(record);
}

export function resolveTelegramPrivateStartAction({
  startAction = {},
  groupBinding = {},
  participant = {},
  knownParticipant = false,
  resolvedAt = null,
} = {}) {
  const actionId = safeString(startAction.actionId || startAction.deepLinkPayload || startAction);
  const parsed = parseTelegramPrivateStartPayload(actionId);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const binding = buildTelegramGroupBinding(groupBinding);
  const principal = normalizeTelegramPrincipalSummary(participant);
  const record = {
    type: 'TelegramActionResolution',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    actionId: parsed.actionId,
    groupBindingId: binding.bindingId,
    telegramPrincipal: principal,
    serverResolvedContext: {
      group: binding.group,
      session: binding.session,
      questionId: binding.questionId,
      workerDeploymentId: binding.workerDeploymentId,
    },
    knownParticipant: knownParticipant === true,
    requiresPrivateAccountSetup: knownParticipant !== true,
    nextStep: knownParticipant === true ? 'answer_question' : 'private_account_setup',
    resolvedAt,
  };
  return { ok: true, resolution: assertTelegramBridgeRecordSafe(record) };
}

export function buildTelegramManagedAccountSummary({
  participant = {},
  accountAddress = '',
  accountId = '',
  workerDeploymentId = '',
  accountKind = 'managed_testnet_account',
  chainScope = 'testnet',
  lifecycle = 'account_created',
  createdAt = null,
  recoveredAt = null,
} = {}) {
  const record = {
    type: 'TelegramManagedAccountSummary',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    telegramPrincipal: normalizeTelegramPrincipalSummary(participant),
    accountId: safeString(accountId) || lower(normalizeTelegramAccountAddress(accountAddress)),
    accountAddress: normalizeTelegramAccountAddress(accountAddress) || null,
    accountKind: lower(accountKind) || 'managed_testnet_account',
    chainScope: safeString(chainScope) || 'testnet',
    workerDeploymentId: safeString(workerDeploymentId) || null,
    lifecycle: lifecycle === 'account_recovered' ? 'account_recovered' : 'account_created',
    signerBoundary: 'managed_demo_account_contract_only',
    rawKeyMaterialExportable: false,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
    createdAt,
    recoveredAt,
  };
  return assertTelegramBridgeRecordSafe(record);
}

export function buildTelegramAnswerAction({
  resolution = {},
  managedAccount = {},
  actionId = '',
  answerRef = null,
  draftRequestId = '',
  submitRequestId = '',
  status = 'draft_ready',
  createdAt = null,
} = {}) {
  const resolved = resolution.type === 'TelegramActionResolution'
    ? resolution
    : resolveTelegramPrivateStartAction(resolution).resolution;
  const account = managedAccount.type === 'TelegramManagedAccountSummary'
    ? managedAccount
    : buildTelegramManagedAccountSummary(managedAccount);
  const record = {
    type: 'TelegramAnswerAction',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    actionId: safeString(actionId) || resolved?.actionId || createTelegramPrivateStartPayload(),
    telegramPrincipal: resolved?.telegramPrincipal || account.telegramPrincipal,
    account: {
      accountId: account.accountId,
      accountAddress: account.accountAddress,
      accountKind: account.accountKind,
      chainScope: account.chainScope,
      workerDeploymentId: account.workerDeploymentId,
      rawKeyMaterialExportable: false,
      signingAuthority: false,
      workerTokenAuthority: false,
      privateKeyAuthority: false,
      longLivedBearerAuthority: false,
    },
    session: resolved?.serverResolvedContext?.session || '',
    questionId: resolved?.serverResolvedContext?.questionId || '',
    answerRef: answerRef ? {
      refId: safeString(answerRef.refId || answerRef.id || answerRef),
      contentHash: safeString(answerRef.contentHash || answerRef.hash) || null,
    } : null,
    draftRequestId: safeString(draftRequestId) || null,
    submitRequestId: safeString(submitRequestId) || null,
    status: safeString(status) || 'draft_ready',
    createdAt,
  };
  return assertTelegramBridgeRecordSafe(record);
}

export function summarizeTelegramGroupSafeAction(record = {}) {
  const action = record.resolution || record;
  return assertTelegramBridgeRecordSafe({
    type: 'TelegramGroupSafeSummary',
    version: TELEGRAM_BRIDGE_CONTRACT_VERSION,
    actionId: safeString(action.actionId),
    groupBindingId: safeString(action.groupBindingId),
    session: safeString(action.serverResolvedContext?.session || action.session),
    questionId: safeString(action.serverResolvedContext?.questionId || action.questionId),
    status: safeString(action.status || action.nextStep || 'recorded'),
    publicLobby: true,
  });
}

export function normalizeTelegramUpdate(update = {}) {
  const message = update.message || update.edited_message || null;
  const callback = update.callback_query || null;
  const webAppData = message?.web_app_data || null;
  const chat = message?.chat || callback?.message?.chat || null;
  const from = message?.from || callback?.from || null;
  return {
    source: 'telegram',
    updateId: update.update_id ?? null,
    kind: callback ? 'callback' : (webAppData ? 'web_app_data' : (message ? 'message' : 'unknown')),
    chat: chat ? {
      id: chat.id,
      type: chat.type || null,
      isPrivate: chat.type === 'private',
    } : null,
    user: from ? {
      id: from.id,
      username: from.username || null,
      languageCode: from.language_code || null,
    } : null,
    text: message?.text || webAppData?.data || null,
    callbackActionId: callback?.data || null,
    miniAppInitData: update.mini_app_init_data || null,
  };
}

function buildTelegramDataCheckString(params) {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function validateTelegramMiniAppInitData(initData, botToken, {
  nowMs = Date.now(),
  maxAgeSeconds = 24 * 60 * 60,
  maxFutureSeconds = 300,
} = {}) {
  const token = String(botToken || '').trim();
  if (!token) return { ok: false, error: 'botToken required.' };
  const params = new URLSearchParams(String(initData || ''));
  const receivedHash = String(params.get('hash') || '').trim().toLowerCase();
  if (!receivedHash) return { ok: false, error: 'hash missing.' };

  const authDate = Number(params.get('auth_date') || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: 'auth_date missing.' };
  }
  const ageSeconds = Math.floor(nowMs / 1000) - authDate;
  if (maxFutureSeconds >= 0 && ageSeconds < -maxFutureSeconds) {
    return { ok: false, error: 'auth_date is too far in the future.' };
  }
  if (maxAgeSeconds > 0 && ageSeconds > maxAgeSeconds) {
    return { ok: false, error: 'initData expired.' };
  }

  const dataCheckString = buildTelegramDataCheckString(params);
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, error: 'hash mismatch.' };
  }

  return {
    ok: true,
    params: Object.fromEntries([...params.entries()].map(([key, value]) => [key, parseJsonMaybe(value)])),
    authDate,
  };
}

export function buildTelegramCloudStoragePayload(preferences = {}) {
  if (hasSensitiveKeyOrValue(preferences)) {
    throw new Error('Telegram CloudStorage payload must not contain secrets or bearer credentials.');
  }
  return {
    kind: 'ce_telegram_preferences_v1',
    preferences: { ...preferences },
  };
}

export function buildTelegramSecureStorageGrant({
  grantId = '',
  scope = '',
  refreshHandle = '',
  expiresAt = '',
  nowMs = Date.now(),
  maxTtlSeconds = TELEGRAM_SECURE_GRANT_MAX_TTL_SECONDS,
} = {}) {
  const payload = {
    kind: 'ce_telegram_scoped_grant_v1',
    grantId: String(grantId || '').trim(),
    scope: String(scope || '').trim(),
    refreshHandle: String(refreshHandle || '').trim(),
    expiresAt: String(expiresAt || '').trim(),
  };
  if (!TELEGRAM_SECURE_GRANT_SCOPE_RE.test(payload.scope)) {
    throw new Error('Telegram SecureStorage grants must use a scoped agent grant.');
  }
  const expiryMs = Date.parse(payload.expiresAt);
  const maxTtlMs = Math.max(0, Number(maxTtlSeconds) || 0) * 1000;
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs || (maxTtlMs > 0 && expiryMs - nowMs > maxTtlMs)) {
    throw new Error('Telegram SecureStorage grants must be short-lived and unexpired.');
  }
  if (hasSensitiveKeyOrValue(payload)) {
    throw new Error('Telegram SecureStorage grant must be scoped and must not contain signing or bearer secrets.');
  }
  return payload;
}

function normalizePublicAgentSession(session) {
  const normalized = String(session || '').trim();
  if (!normalized) {
    throw new Error('Telegram agent drafts require an explicit session; use "general" for the general session.');
  }
  if (normalized.length > MAX_PUBLIC_SESSION_LENGTH || !PUBLIC_SESSION_RE.test(normalized)) {
    throw new Error('Invalid Telegram agent public session slug.');
  }
  return normalized;
}

export function telegramInputToAgentDraft({ update = {}, session = '', questionId = '', questionType = 'freeform' } = {}) {
  const normalized = normalizeTelegramUpdate(update);
  return {
    session: normalizePublicAgentSession(session),
    questionId,
    questionType,
    answer: normalized.text || '',
    agentContext: {
      source: 'telegram',
      updateId: normalized.updateId,
      chatType: normalized.chat?.type || null,
      privateDm: normalized.chat?.isPrivate === true,
    },
  };
}
