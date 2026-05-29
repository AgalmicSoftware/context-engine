import { assertNoSecretShape } from './redaction.mjs';
import { evaluateTelegramGroupSessionAccess } from './sessionPolicy.mjs';

export const TELEGRAM_GROUP_APPROVAL_KV_PREFIX = 'telegram:group-approval:';

function safeString(value) {
  return String(value || '').trim();
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function telegramGroupApprovalKey({
  sessionSlug = '',
  chatId = '',
} = {}) {
  const slug = safeString(sessionSlug);
  const groupChatId = safeString(chatId);
  return slug && groupChatId
    ? `${TELEGRAM_GROUP_APPROVAL_KV_PREFIX}${slug}:${groupChatId}`
    : '';
}

export async function readTelegramGroupApproval({
  env = {},
  sessionSlug = '',
  chatId = '',
} = {}) {
  const key = telegramGroupApprovalKey({ sessionSlug, chatId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (safeString(parsed.sessionSlug) !== safeString(sessionSlug)) return null;
  if (safeString(parsed.chatId) !== safeString(chatId)) return null;
  assertNoSecretShape(parsed, 'Telegram group approvals must not serialize secrets.');
  return { ...parsed, key };
}

export async function persistTelegramGroupApproval({
  env = {},
  session = {},
  normalized = {},
  approvedByTelegramUserId = '',
  approvedByAccountAddress = '',
  approvalTokenId = '',
  createdAt = null,
} = {}) {
  const sessionSlug = safeString(session.sessionSlug || session.slug);
  const chatId = safeString(normalized.chat?.chatId);
  const key = telegramGroupApprovalKey({ sessionSlug, chatId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'action_kv_unavailable' };
  }
  const record = {
    version: 1,
    type: 'telegram_group_approval',
    sessionSlug,
    sessionName: safeString(session.sessionName || session.name || sessionSlug),
    chatId,
    chatTitle: safeString(normalized.chat?.title),
    approvedAt: createdAt,
    approvedByTelegramUserId: safeString(approvedByTelegramUserId),
    approvedByAccountAddress: safeString(approvedByAccountAddress).toLowerCase(),
    approvalTokenId: safeString(approvalTokenId),
  };
  assertNoSecretShape(record, 'Telegram group approvals must not serialize secrets.');
  await kv.put(key, JSON.stringify(record));
  return { ok: true, key, record };
}

export async function deleteTelegramGroupApproval({
  env = {},
  sessionSlug = '',
  chatId = '',
} = {}) {
  const key = telegramGroupApprovalKey({ sessionSlug, chatId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.delete !== 'function') {
    return { ok: false, revoked: false, reason: 'action_kv_unavailable' };
  }
  const existing = await readTelegramGroupApproval({ env, sessionSlug, chatId });
  await kv.delete(key);
  return { ok: true, revoked: !!existing, key };
}

export async function evaluateTelegramGroupSessionAccessForEnv({
  env = {},
  session = {},
  normalized = {},
  chatId = '',
} = {}) {
  const staticAccess = evaluateTelegramGroupSessionAccess(session, { normalized, chatId });
  if (staticAccess.ok) return staticAccess;
  const groupChatId = safeString(chatId || normalized.chat?.chatId || normalized.groupChatId);
  const sessionSlug = safeString(session.sessionSlug || session.slug);
  const approval = await readTelegramGroupApproval({
    env,
    sessionSlug,
    chatId: groupChatId,
  });
  if (approval) {
    return {
      ok: true,
      reason: 'telegram_group_access_dynamic_approval',
      groupChatId,
      approvedTelegramGroupChatIds: staticAccess.approvedTelegramGroupChatIds || [],
      telegramGroupApprovalRequired: staticAccess.telegramGroupApprovalRequired === true,
      telegramGroupOpenAccess: staticAccess.telegramGroupOpenAccess === true,
      approval,
    };
  }
  return staticAccess;
}
