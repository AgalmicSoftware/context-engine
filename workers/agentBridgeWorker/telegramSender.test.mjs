import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  sendTelegramDocument,
  sendTelegramMessage,
  telegramBotApiRequest,
} from './telegramSender.mjs';

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('sendTelegramMessage calls Telegram Bot API through injected fetch', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return jsonResponse({ ok: true, result: { message_id: 123 } });
  };

  const result = await sendTelegramMessage({
    botToken: '123456:test-token',
    chatId: '-10055',
    text: 'Hello',
    replyMarkup: { inline_keyboard: [[{ text: 'Open', callback_data: 'cecb_0000000000' }]] },
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/sendMessage');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    chat_id: '-10055',
    text: 'Hello',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: 'Open', callback_data: 'cecb_0000000000' }]] },
  });
});

test('editTelegramMessageText wraps editMessageText with injected fetch', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return jsonResponse({ ok: true, result: { message_id: 456 } });
  };

  const result = await editTelegramMessageText({
    botToken: '123456:test-token',
    chatId: '-10055',
    messageId: 456,
    text: 'Updated',
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/editMessageText');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    chat_id: '-10055',
    message_id: 456,
    text: 'Updated',
    disable_web_page_preview: true,
  });
});

test('sendTelegramDocument uploads zip bytes through sendDocument', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return jsonResponse({ ok: true, result: { message_id: 789 } });
  };

  const result = await sendTelegramDocument({
    botToken: '123456:test-token',
    chatId: '42',
    caption: 'Export ready',
    document: {
      bytes: Uint8Array.from([80, 75, 3, 4]),
      filename: 'responses.zip',
      contentType: 'application/zip',
    },
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/sendDocument');
  const form = calls[0][1].body;
  assert.equal(form.get('chat_id'), '42');
  assert.equal(form.get('caption'), 'Export ready');
  const file = form.get('document');
  assert.equal(file.name, 'responses.zip');
  assert.equal(file.type, 'application/zip');
});

test('answerTelegramCallbackQuery stops inline button spinners without leaking callback context', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return jsonResponse({ ok: true, result: true });
  };

  const result = await answerTelegramCallbackQuery({
    botToken: '123456:test-token',
    callbackQueryId: 'callback-123',
    text: 'Updated',
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/answerCallbackQuery');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    callback_query_id: 'callback-123',
    show_alert: false,
    cache_time: 0,
    text: 'Updated',
  });
});

test('Telegram API errors redact token and omit request payload', async () => {
  const fetchMock = async () => jsonResponse({
    ok: false,
    error_code: 400,
    description: 'Bad Request: chat not found for bot123456:test-token',
  }, { status: 400 });

  const result = await telegramBotApiRequest({
    botToken: '123456:test-token',
    method: 'sendMessage',
    payload: {
      chat_id: '-10055',
      text: 'private request text must not be echoed',
    },
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.match(result.error, /Bad Request/);
  assert.equal(JSON.stringify(result).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(result).includes('private request text'), false);
});

test('fetch failures redact Telegram bot token embedded in thrown URLs', async () => {
  const fetchMock = async () => {
    throw new Error('POST https://api.telegram.org/bot123456:test-token/sendMessage failed');
  };

  const result = await telegramBotApiRequest({
    botToken: '123456:test-token',
    method: 'sendMessage',
    payload: { chat_id: '1', text: 'hello' },
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(result).includes('123456:test-token'), false);
  assert.equal(JSON.stringify(result).includes('bot[redacted-token]'), true);
});
