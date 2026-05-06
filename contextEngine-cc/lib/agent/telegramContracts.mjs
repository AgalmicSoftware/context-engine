import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const CALLBACK_ACTION_RE = /^cecb_[a-z0-9_-]{8,48}$/;
const SENSITIVE_KEY_RE = /(?:jwt|token|private|secret|signature|bearer|authorization|mnemonic|seed|password)/i;
const SENSITIVE_VALUE_RE = /(?:bearer\s+[a-z0-9._-]+|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64})/i;

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
      SENSITIVE_KEY_RE.test(key) || hasSensitiveKeyOrValue(entry, [...path, key])
    ));
  }
  if (typeof value === 'string') {
    return SENSITIVE_VALUE_RE.test(value);
  }
  return false;
}

export function createTelegramCallbackAction({ actionId = randomUUID(), action = '', requestId = '', expiresAt = null } = {}) {
  const id = `cecb_${String(actionId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48)}`;
  if (!CALLBACK_ACTION_RE.test(id)) {
    throw new Error('Invalid Telegram callback action id.');
  }
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

export function parseTelegramCallbackActionId(callbackData) {
  const actionId = String(callbackData || '').trim();
  if (!CALLBACK_ACTION_RE.test(actionId)) {
    return { ok: false, error: 'Invalid Telegram callback action id.' };
  }
  return { ok: true, actionId };
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
} = {}) {
  const payload = {
    kind: 'ce_telegram_scoped_grant_v1',
    grantId: String(grantId || '').trim(),
    scope: String(scope || '').trim(),
    refreshHandle: String(refreshHandle || '').trim(),
    expiresAt: String(expiresAt || '').trim(),
  };
  if (hasSensitiveKeyOrValue(payload)) {
    throw new Error('Telegram SecureStorage grant must be scoped and must not contain signing or bearer secrets.');
  }
  return payload;
}

export function telegramInputToAgentDraft({ update = {}, session = '', questionId = '', questionType = 'freeform' } = {}) {
  const normalized = normalizeTelegramUpdate(update);
  return {
    session,
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
