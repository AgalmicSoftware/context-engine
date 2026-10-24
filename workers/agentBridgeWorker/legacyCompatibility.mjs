import { safeString } from './runtimePrimitives.mjs';

import { LEGACY_TRANSPORT_LANES } from './constants.mjs';

import { assertNoSecretShape } from './redaction.mjs';

function normalizeLegacyManagedContext(update = {}) {
  const message = update.message || null;
  const callback = update.callback_query || null;
  const miniApp = update.web_app_data || message?.web_app_data || null;
  const chat = update.chat || message?.chat || callback?.message?.chat || {};
  const from = update.from || message?.from || callback?.from || {};
  const chatType = safeString(chat.type || update.chatType || 'private') || 'private';
  const isPrivate = chatType === 'private';
  const normalized = {
    type: 'telegram_mock_update',
    updateId: update.update_id ?? update.updateId ?? null,
    kind: callback ? 'callback' : (miniApp ? 'mini_app' : (message || update.text ? 'message' : 'unknown')),
    lane: isPrivate ? LEGACY_TRANSPORT_LANES.PRIVATE_ACCOUNT : LEGACY_TRANSPORT_LANES.GROUP_LOBBY,
    chat: {
      chatId: safeString(chat.id || update.chatId),
      chatType,
      title: safeString(chat.title) || null,
      isPrivate,
    },
    user: {
      telegramUserId: safeString(from.id || update.telegramUserId || update.userId),
      username: safeString(from.username || update.username) || null,
      languageCode: safeString(from.language_code || from.languageCode || update.languageCode) || null,
    },
    text: safeString(update.text || message?.text || miniApp?.data) || null,
    callbackData: safeString(callback?.data || update.callbackData) || null,
    startPayload: safeString(update.startPayload || null) || null,
  };
  assertNoSecretShape(normalized, 'Telegram mock updates must not contain secrets.');
  return normalized;
}

function normalizeLegacyManagedPrincipal(updateOrPrincipal = {}) {
  const update = updateOrPrincipal.type === 'telegram_mock_update'
    ? updateOrPrincipal
    : normalizeLegacyManagedContext(updateOrPrincipal.update ? updateOrPrincipal.update : updateOrPrincipal);
  const user = update.user || {};
  const telegramUserId = safeString(user.telegramUserId || updateOrPrincipal.telegramUserId || updateOrPrincipal.id);
  return {
    type: 'telegram_principal',
    principalKind: 'telegram',
    principalId: telegramUserId ? `telegram:${telegramUserId}` : 'telegram:unknown',
    telegramUserId,
    username: safeString(user.username || updateOrPrincipal.username) || null,
    languageCode: safeString(user.languageCode || updateOrPrincipal.languageCode) || null,
  };
}

export {
  normalizeLegacyManagedPrincipal,
};
