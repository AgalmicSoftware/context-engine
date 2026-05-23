const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

function safeString(value) {
  return String(value || '').trim();
}

function redactTelegramErrorText(value = '', botToken = '') {
  const token = safeString(botToken);
  let text = safeString(value);
  if (!text) return 'Telegram API request failed.';
  if (token) {
    text = text.split(token).join('[redacted-token]');
    text = text.split(`bot${token}`).join('bot[redacted-token]');
  }
  return text.replace(/https:\/\/api\.telegram\.org\/bot[^/\s]+/gi, 'https://api.telegram.org/bot[redacted-token]');
}

function buildTelegramApiUrl(botToken = '', method = '') {
  const token = safeString(botToken);
  const methodName = safeString(method);
  if (!token) throw new Error('telegram_bot_token_missing');
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(methodName)) {
    throw new Error('invalid_telegram_api_method');
  }
  return `${TELEGRAM_API_BASE_URL}/bot${token}/${methodName}`;
}

async function readTelegramResponseBody(response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { description: text };
  }
}

export async function telegramBotApiRequest({
  botToken = '',
  method = '',
  payload = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  let url;
  try {
    url = buildTelegramApiUrl(botToken, method);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: safeString(error?.message || error) || 'invalid_telegram_api_request',
    };
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload || {}),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: redactTelegramErrorText(error?.message || error, botToken),
    };
  }

  const body = await readTelegramResponseBody(response);
  if (!response.ok || body?.ok === false) {
    const description = safeString(body?.description || `Telegram API error (${response.status})`);
    return {
      ok: false,
      status: response.status || Number(body?.error_code || 0) || 502,
      error: redactTelegramErrorText(description, botToken),
      telegramErrorCode: Number(body?.error_code || 0) || null,
    };
  }

  return {
    ok: true,
    status: response.status || 200,
    result: body?.result ?? body,
  };
}

export async function telegramBotApiFormDataRequest({
  botToken = '',
  method = '',
  formData = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  let url;
  try {
    url = buildTelegramApiUrl(botToken, method);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: safeString(error?.message || error) || 'invalid_telegram_api_request',
    };
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: redactTelegramErrorText(error?.message || error, botToken),
    };
  }

  const body = await readTelegramResponseBody(response);
  if (!response.ok || body?.ok === false) {
    const description = safeString(body?.description || `Telegram API error (${response.status})`);
    return {
      ok: false,
      status: response.status || Number(body?.error_code || 0) || 502,
      error: redactTelegramErrorText(description, botToken),
      telegramErrorCode: Number(body?.error_code || 0) || null,
    };
  }

  return {
    ok: true,
    status: response.status || 200,
    result: body?.result ?? body,
  };
}

export async function sendTelegramMessage({
  botToken = '',
  chatId = '',
  text = '',
  replyMarkup = null,
  parseMode = '',
  disableWebPagePreview = true,
  fetchImpl = globalThis.fetch,
} = {}) {
  const payload = {
    chat_id: chatId,
    text: safeString(text),
    disable_web_page_preview: disableWebPagePreview === true,
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (safeString(parseMode)) payload.parse_mode = safeString(parseMode);
  return telegramBotApiRequest({
    botToken,
    method: 'sendMessage',
    payload,
    fetchImpl,
  });
}

export async function sendTelegramPhoto({
  botToken = '',
  chatId = '',
  photo = null,
  caption = '',
  replyMarkup = null,
  parseMode = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const form = new FormData();
  form.append('chat_id', safeString(chatId));
  const photoBytes = photo?.bytes instanceof Uint8Array ? photo.bytes : null;
  if (photoBytes) {
    form.append('photo', new Blob([photoBytes], { type: safeString(photo.contentType) || 'image/png' }), safeString(photo.filename) || 'results.png');
  } else {
    form.append('photo', safeString(photo?.url || photo));
  }
  const captionText = safeString(caption).slice(0, 1024);
  if (captionText) form.append('caption', captionText);
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  if (safeString(parseMode)) form.append('parse_mode', safeString(parseMode));
  return telegramBotApiFormDataRequest({
    botToken,
    method: 'sendPhoto',
    formData: form,
    fetchImpl,
  });
}

export async function editTelegramMessageText({
  botToken = '',
  chatId = '',
  messageId = '',
  text = '',
  replyMarkup = null,
  parseMode = '',
  disableWebPagePreview = true,
  fetchImpl = globalThis.fetch,
} = {}) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: safeString(text),
    disable_web_page_preview: disableWebPagePreview === true,
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (safeString(parseMode)) payload.parse_mode = safeString(parseMode);
  return telegramBotApiRequest({
    botToken,
    method: 'editMessageText',
    payload,
    fetchImpl,
  });
}

export async function answerTelegramCallbackQuery({
  botToken = '',
  callbackQueryId = '',
  text = '',
  showAlert = false,
  cacheTime = 0,
  fetchImpl = globalThis.fetch,
} = {}) {
  const payload = {
    callback_query_id: safeString(callbackQueryId),
    show_alert: showAlert === true,
    cache_time: Math.max(0, Math.floor(Number(cacheTime || 0) || 0)),
  };
  if (safeString(text)) payload.text = safeString(text);
  return telegramBotApiRequest({
    botToken,
    method: 'answerCallbackQuery',
    payload,
    fetchImpl,
  });
}

export { buildTelegramApiUrl, redactTelegramErrorText };
