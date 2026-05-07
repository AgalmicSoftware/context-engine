// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildTelegramCloudStoragePayload,
  buildTelegramSecureStorageGrant,
  createTelegramCallbackAction,
  normalizeTelegramUpdate,
  parseTelegramCallbackActionId,
  telegramInputToAgentDraft,
  validateTelegramMiniAppInitData,
} from './telegramContracts.mjs';

function signMiniAppInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('Telegram callback data uses only an opaque short action id', () => {
  const action = createTelegramCallbackAction({
    actionId: 'a1b2c3d4',
    action: 'approve',
    requestId: 'agent_req_request123',
  });

  assert.equal(action.callbackData, 'cecb_a1b2c3d4');
  assert.equal(action.callbackData.includes('agent_req_request123'), false);
  assert.equal(action.callbackData.includes('approve'), false);
  assert.deepEqual(parseTelegramCallbackActionId(action.callbackData), {
    ok: true,
    actionId: 'cecb_a1b2c3d4',
  });
});

test('Telegram callback action metadata rejects secret-shaped values', () => {
  assert.throws(
    () => createTelegramCallbackAction({
      actionId: 'eyJhbGciOi.fake.sig',
      action: 'approve',
      requestId: 'agent_req_request123',
    }),
    /must not contain secrets/,
  );
  assert.throws(
    () => createTelegramCallbackAction({
      actionId: 'a1b2c3d4',
      action: 'Bearer long-lived-token',
      requestId: 'agent_req_request123',
    }),
    /must not contain secrets/,
  );
});

test('Telegram callback parser rejects full payload-shaped callback data', () => {
  assert.equal(parseTelegramCallbackActionId('{"requestId":"agent_req_abc12345"}').ok, false);
  assert.equal(parseTelegramCallbackActionId('cecb_short').ok, false);
});

test('Telegram update normalization prefers private DM metadata for v1', () => {
  const normalized = normalizeTelegramUpdate({
    update_id: 7,
    message: {
      chat: { id: 11, type: 'private' },
      from: { id: 22, username: 'agent_user', language_code: 'en' },
      text: 'draft answer',
    },
  });

  assert.equal(normalized.kind, 'message');
  assert.equal(normalized.chat.isPrivate, true);
  assert.equal(normalized.text, 'draft answer');
  assert.equal(normalized.user.username, 'agent_user');
});

test('Telegram Mini App initData validation checks hash and auth_date freshness', () => {
  const botToken = '123456:ABCDEF';
  const nowMs = Date.parse('2026-05-06T12:00:00.000Z');
  const initData = signMiniAppInitData({
    auth_date: String(Math.floor(nowMs / 1000)),
    query_id: 'query-1',
    user: JSON.stringify({ id: 123, username: 'agent' }),
  }, botToken);

  const result = validateTelegramMiniAppInitData(initData, botToken, { nowMs });
  assert.equal(result.ok, true);
  assert.equal(result.params.user.id, 123);

  const tampered = initData.replace('query-1', 'query-2');
  assert.equal(validateTelegramMiniAppInitData(tampered, botToken, { nowMs }).ok, false);
  assert.equal(
    validateTelegramMiniAppInitData(initData, botToken, {
      nowMs: nowMs + (25 * 60 * 60 * 1000),
      maxAgeSeconds: 24 * 60 * 60,
    }).error,
    'initData expired.',
  );
  assert.equal(
    validateTelegramMiniAppInitData(initData, 'wrong-token', { nowMs }).error,
    'hash mismatch.',
  );
});

test('Telegram Mini App initData validation rejects auth_date too far in the future', () => {
  const botToken = '123456:ABCDEF';
  const nowMs = Date.parse('2026-05-06T12:00:00.000Z');
  const initData = signMiniAppInitData({
    auth_date: String(Math.floor(nowMs / 1000) + 600),
    query_id: 'query-future',
  }, botToken);

  assert.equal(
    validateTelegramMiniAppInitData(initData, botToken, { nowMs, maxFutureSeconds: 300 }).error,
    'auth_date is too far in the future.',
  );
});

test('Telegram storage helpers reject secrets in CloudStorage and scoped grant payloads', () => {
  const nowMs = Date.parse('2026-05-06T12:00:00.000Z');
  assert.deepEqual(buildTelegramCloudStoragePayload({ theme: 'dark', lastSession: 'alpha' }), {
    kind: 'ce_telegram_preferences_v1',
    preferences: { theme: 'dark', lastSession: 'alpha' },
  });
  assert.throws(
    () => buildTelegramCloudStoragePayload({ jwt: 'eyJhbGciOi.fake.sig' }),
    /must not contain secrets/,
  );
  assert.throws(
    () => buildTelegramCloudStoragePayload({ nested: { workerToken: 'local-token' } }),
    /must not contain secrets/,
  );
  assert.deepEqual(buildTelegramSecureStorageGrant({
    grantId: 'grant-short',
    scope: 'agent:draft',
    refreshHandle: 'refresh-handle-short',
    expiresAt: '2026-05-06T13:00:00.000Z',
    nowMs,
  }), {
    kind: 'ce_telegram_scoped_grant_v1',
    grantId: 'grant-short',
    scope: 'agent:draft',
    refreshHandle: 'refresh-handle-short',
    expiresAt: '2026-05-06T13:00:00.000Z',
  });
  assert.throws(
    () => buildTelegramSecureStorageGrant({
      scope: 'agent:sign',
      refreshHandle: 'refresh-handle-short',
      expiresAt: '2026-05-06T13:00:00.000Z',
      nowMs,
    }),
    /scoped agent grant/,
  );
  assert.throws(
    () => buildTelegramSecureStorageGrant({
      scope: 'agent:draft',
      refreshHandle: 'refresh-handle-short',
      expiresAt: '2026-05-06T11:59:00.000Z',
      nowMs,
    }),
    /short-lived and unexpired/,
  );
  assert.throws(
    () => buildTelegramSecureStorageGrant({
      scope: 'agent:draft',
      refreshHandle: 'refresh-handle-short',
      expiresAt: '2026-05-08T12:00:00.000Z',
      nowMs,
    }),
    /short-lived and unexpired/,
  );
  assert.throws(
    () => buildTelegramSecureStorageGrant({
      scope: 'agent:draft',
      refreshHandle: 'Bearer long-lived-token',
      expiresAt: '2026-05-06T13:00:00.000Z',
      nowMs,
    }),
    /must not contain signing or bearer secrets/,
  );
});

test('Telegram text input normalizes into canonical agent draft shape', () => {
  const draft = telegramInputToAgentDraft({
    session: 'alpha',
    questionId: '0xabc',
    update: {
      update_id: 9,
      message: {
        chat: { id: 1, type: 'private' },
        text: 'answer from DM',
      },
    },
  });

  assert.equal(draft.session, 'alpha');
  assert.equal(draft.questionId, '0xabc');
  assert.equal(draft.answer, 'answer from DM');
  assert.deepEqual(draft.agentContext, {
    source: 'telegram',
    updateId: 9,
    chatType: 'private',
    privateDm: true,
  });
});

test('Telegram draft normalization preserves general and rejects empty public session', () => {
  const update = {
    message: {
      chat: { id: 1, type: 'private' },
      text: 'answer from general',
    },
  };

  assert.equal(telegramInputToAgentDraft({
    session: ' general ',
    questionId: '0xabc',
    update,
  }).session, 'general');
  assert.throws(
    () => telegramInputToAgentDraft({ session: '', questionId: '0xabc', update }),
    /use "general"/,
  );
  assert.throws(
    () => telegramInputToAgentDraft({ session: '../outside', questionId: '0xabc', update }),
    /Invalid Telegram agent public session slug/,
  );
});
