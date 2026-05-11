import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateTelegramMiniAppInitData } from './telegramMiniApp.mjs';

function signInitData(fields = {}, botToken = '') {
  const dataCheckString = Object.entries(fields)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey === rightKey
        ? String(leftValue).localeCompare(String(rightValue))
        : leftKey.localeCompare(rightKey)
    ))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

test('validateTelegramMiniAppInitData accepts current Telegram HMAC init data', async () => {
  const nowSeconds = 1_800_000_000;
  const botToken = '123456:test-token';
  const initData = signInitData({
    auth_date: String(nowSeconds),
    query_id: 'mini-query-1',
    user: JSON.stringify({ id: 42, username: 'participant', first_name: 'Pat' }),
  }, botToken);

  const result = await validateTelegramMiniAppInitData(initData, {
    TELEGRAM_BOT_TOKEN: botToken,
  }, {
    nowMs: nowSeconds * 1000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.authMode, 'telegram');
  assert.equal(result.user.telegramUserId, '42');
  assert.equal(result.user.username, 'participant');
  assert.equal(result.queryId, 'mini-query-1');
});

test('validateTelegramMiniAppInitData rejects tampered and expired init data', async () => {
  const nowSeconds = 1_800_000_000;
  const botToken = '123456:test-token';
  const valid = signInitData({
    auth_date: String(nowSeconds),
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);

  const tampered = valid.replace('participant', 'attacker');
  const tamperedResult = await validateTelegramMiniAppInitData(tampered, {
    TELEGRAM_BOT_TOKEN: botToken,
  }, {
    nowMs: nowSeconds * 1000,
  });

  assert.equal(tamperedResult.ok, false);
  assert.equal(tamperedResult.reason, 'telegram_init_hash_invalid');

  const expired = signInitData({
    auth_date: String(nowSeconds - 90_000),
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);
  const expiredResult = await validateTelegramMiniAppInitData(expired, {
    TELEGRAM_BOT_TOKEN: botToken,
  }, {
    nowMs: nowSeconds * 1000,
  });

  assert.equal(expiredResult.ok, false);
  assert.equal(expiredResult.reason, 'telegram_init_data_expired');
});
