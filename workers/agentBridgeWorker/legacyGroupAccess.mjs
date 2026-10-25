import { safeString, safeJsonParse } from './runtimePrimitives.mjs';

import { assertNoSecretShape } from './redaction.mjs';

import { evaluateLegacyGroupSessionAccess } from './sessionPolicy.mjs';

const LEGACY_GROUP_APPROVAL_KV_PREFIX = 'telegram:group-approval:';

function legacyGroupApprovalKey({
  sessionSlug = '',
  chatId = '',
} = {}) {
  const slug = safeString(sessionSlug);
  const groupChatId = safeString(chatId);
  return slug && groupChatId
    ? `${LEGACY_GROUP_APPROVAL_KV_PREFIX}${slug}:${groupChatId}`
    : '';
}

async function readLegacyGroupApproval({
  env = {},
  sessionSlug = '',
  chatId = '',
} = {}) {
  const key = legacyGroupApprovalKey({ sessionSlug, chatId });
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const parsed = safeJsonParse(await kv.get(key).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (safeString(parsed.sessionSlug) !== safeString(sessionSlug)) return null;
  if (safeString(parsed.chatId) !== safeString(chatId)) return null;
  assertNoSecretShape(parsed, 'Telegram group approvals must not serialize secrets.');
  return { ...parsed, key };
}

async function evaluateLegacyGroupSessionAccessForEnv({
  env = {},
  session = {},
  normalized = {},
  chatId = '',
} = {}) {
  const staticAccess = evaluateLegacyGroupSessionAccess(session, { normalized, chatId });
  if (staticAccess.ok) return staticAccess;
  const groupChatId = safeString(chatId || normalized.chat?.chatId || normalized.groupChatId);
  const sessionSlug = safeString(session.sessionSlug || session.slug);
  const approval = await readLegacyGroupApproval({
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

export {
  LEGACY_GROUP_APPROVAL_KV_PREFIX,
  legacyGroupApprovalKey,
  readLegacyGroupApproval,
  evaluateLegacyGroupSessionAccessForEnv,
};
