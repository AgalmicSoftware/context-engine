import { safeString, lower, envFlagDisabled } from './runtimePrimitives.mjs';

function normalizeGroupIdSet(...values) {
  const out = new Set();
  for (const value of values) {
    const items = Array.isArray(value) ? value : safeString(value).split(',');
    for (const item of items) {
      const normalized = safeString(item);
      if (normalized) out.add(normalized);
    }
  }
  return out;
}

export function questionAuthoringPermissionMode(env = {}, session = {}) {
  return lower(
    session.questionAuthoringPermissionMode ||
    session.telegramQuestionAuthoringPermissionMode ||
    env.AGENT_BRIDGE_QUESTION_AUTHORING_PERMISSION_MODE ||
    'telegram_native'
  ).replace(/-/g, '_') || 'telegram_native';
}

export function evaluateTelegramQuestionAuthoringPermission({
  env = {},
  normalized = {},
  session = {},
  groupBinding = null,
  privateBinding = null,
  requestedSessionSlug = '',
} = {}) {
  const mode = questionAuthoringPermissionMode(env, session);
  if (mode === 'disabled' || mode === 'off') {
    return { ok: false, mode, reason: 'question_authoring_disabled' };
  }
  if (mode !== 'telegram_native') {
    return {
      ok: false,
      mode,
      reason: 'question_authoring_permission_mode_not_implemented',
      detail: 'Telegram-native group membership is the current default. SBT or CE resource-gated authoring is documented but not wired yet.',
    };
  }

  const sessionSlug = safeString(requestedSessionSlug || session.sessionSlug || session.slug).toLowerCase();
  const chatId = safeString(normalized.chat?.chatId || normalized.chatId);
  const isPrivate = normalized.chat?.isPrivate === true || lower(normalized.chat?.type) === 'private';
  const sourceChatId = safeString(privateBinding?.sourceChatId || normalized.sourceChatId);
  const effectiveGroupChatId = isPrivate ? sourceChatId : chatId;
  const configuredGroups = normalizeGroupIdSet(
    env.AGENT_BRIDGE_AUTHORING_GROUP_CHAT_IDS,
    session.authoringGroupChatIds,
    session.telegramAuthoringGroupChatIds
  );
  const defaultGroupChatId = safeString(session.defaultGroupChatId || env.AGENT_BRIDGE_DEFAULT_GROUP_CHAT_ID);
  const privateSessionMatches = isPrivate && privateBinding?.sessionSlug && (
    !sessionSlug || lower(privateBinding.sessionSlug) === sessionSlug
  );
  const privateBoundAuthoringDisabled = envFlagDisabled(env.AGENT_BRIDGE_AUTHORING_ALLOW_PRIVATE_BOUND_USERS);
  const telegramOnlyPrivateParticipant = isPrivate &&
    session.telegramOnly === true &&
    privateSessionMatches &&
    !privateBoundAuthoringDisabled;
  const delegatedPrivateParticipant = isPrivate &&
    privateBinding?.source === 'agent_credential' &&
    privateSessionMatches &&
    !privateBoundAuthoringDisabled;

  if (!effectiveGroupChatId) {
    if (telegramOnlyPrivateParticipant || delegatedPrivateParticipant) {
      return {
        ok: true,
        mode,
        groupChatId: '',
        privateBound: true,
        reason: delegatedPrivateParticipant
          ? 'agent_credential_allowed'
          : 'telegram_only_private_participant_allowed',
      };
    }
    return {
      ok: false,
      mode,
      reason: isPrivate ? 'telegram_group_binding_required' : 'telegram_group_required',
    };
  }
  if (configuredGroups.size && !configuredGroups.has(effectiveGroupChatId)) {
    return { ok: false, mode, reason: 'telegram_group_not_allowed', groupChatId: effectiveGroupChatId };
  }
  if (defaultGroupChatId && defaultGroupChatId !== effectiveGroupChatId) {
    return { ok: false, mode, reason: 'telegram_group_not_allowed', groupChatId: effectiveGroupChatId };
  }
  if (!configuredGroups.size && !defaultGroupChatId && !isPrivate && !groupBinding?.sessionSlug) {
    return { ok: false, mode, reason: 'telegram_group_session_binding_required' };
  }
  if (!isPrivate && groupBinding?.sessionSlug && sessionSlug && lower(groupBinding.sessionSlug) !== sessionSlug) {
    return { ok: false, mode, reason: 'telegram_group_session_mismatch' };
  }
  if (isPrivate) {
    if (privateBoundAuthoringDisabled) {
      return { ok: false, mode, reason: 'private_bound_authoring_disabled' };
    }
    if (privateBinding?.sessionSlug && sessionSlug && lower(privateBinding.sessionSlug) !== sessionSlug) {
      return { ok: false, mode, reason: 'telegram_private_session_mismatch' };
    }
  }

  return {
    ok: true,
    mode,
    groupChatId: effectiveGroupChatId,
    privateBound: isPrivate,
  };
}

export const __test__telegramAuthoringPermissions = {
  normalizeGroupIdSet,
};
