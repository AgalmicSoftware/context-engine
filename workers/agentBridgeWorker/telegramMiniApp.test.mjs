import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  __test__telegramMiniApp,
  validateTelegramMiniAppInitData,
} from './telegramMiniApp.mjs';

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

test('Mini App renders agree-style controls in client order with client colors', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();
  const agreeIndex = html.indexOf("['agree', 'Agree']");
  const unsureIndex = html.indexOf("['unsure', 'Unsure']");
  const disagreeIndex = html.indexOf("['disagree', 'Disagree']");

  assert.notEqual(agreeIndex, -1);
  assert.notEqual(unsureIndex, -1);
  assert.notEqual(disagreeIndex, -1);
  assert.ok(agreeIndex < unsureIndex);
  assert.ok(unsureIndex < disagreeIndex);
  assert.match(html, /\.segment\.agree \{[\s\S]*border-color: #4caf50;[\s\S]*color: #81c784;/);
  assert.match(html, /\.segment\.unsure \{[\s\S]*border-color: #fdd835;[\s\S]*color: #fff176;/);
  assert.match(html, /\.segment\.disagree \{[\s\S]*border-color: #f44336;[\s\S]*color: #e57373;/);
  assert.match(html, /\.segment\.agree\.selected \{[\s\S]*background: #4caf50;[\s\S]*color: #ffffff;/);
  assert.match(html, /\.segment\.unsure\.selected \{[\s\S]*background: #ffeb3b;[\s\S]*color: #202458;/);
  assert.match(html, /\.segment\.disagree\.selected \{[\s\S]*background: #f44336;[\s\S]*color: #ffffff;/);
});

test('Mini App keeps primary actions visible while retrying unavailable questions', () => {
  const html = __test__telegramMiniApp.telegramMiniAppHtml();

  assert.match(html, /<title>Context Engine<\/title>/);
  assert.match(html, /<h1>Context Engine<\/h1>/);
  assert.equal(html.includes('<h1>CE Agent</h1>'), false);
  assert.match(html, /id="showSettings"[^>]*aria-label="Settings"/);
  assert.match(html, /viewBox="0 0 512 512"/);
  assert.equal(html.includes('id="showSettings" type="button">Settings</button>'), false);
  assert.match(html, /footer \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  assert.equal(html.includes("setStatus(submit ? 'Submitting...' : 'Saving draft...');"), false);
  assert.match(html, /button\.textContent = isBusy \? 'Submitting\.\.\.' : 'Submit';/);
  assert.match(html, /const QUESTION_RETRY_DELAY_MS = 4000;/);
  assert.match(html, /data\?\.sourceOk === false/);
  assert.match(html, /Number\(data\?\.questionCount \|\| 0\) === 0/);
  assert.match(html, /questions\.some\(\(question\) => question\.payloadUnavailable === true\)/);
  assert.match(html, /window\.setTimeout\(\(\) => \{[\s\S]*load\(\{ retry: true \}\);[\s\S]*\}, QUESTION_RETRY_DELAY_MS\);/);
});

test('Mini App distinguishes encrypted questions from unavailable payloads', async () => {
  const sbtAddress = '0x1111111111111111111111111111111111111111';
  const encrypted = await __test__telegramMiniApp.miniQuestionFromRecord({
    sessionSlug: 'alpha',
    question: {
      questionId: `0x${'12'.repeat(32)}`,
      questionType: 'freeform',
      visibility: 'lit_encrypted',
      encrypted: true,
      requiredSbtAddresses: [sbtAddress],
      prompt: 'Private prompt must not leak',
    },
  });
  const unavailable = await __test__telegramMiniApp.miniQuestionFromRecord({
    sessionSlug: 'alpha',
    question: {
      questionId: `0x${'34'.repeat(32)}`,
      questionType: 'unknown',
      payloadUnavailable: true,
      visibility: 'payload_unavailable',
    },
  });

  assert.equal(encrypted.title, 'Encrypted question');
  assert.equal(encrypted.encrypted, true);
  assert.equal(encrypted.payloadUnavailable, false);
  assert.equal(encrypted.canAnswer, false);
  assert.match(encrypted.lockMessage, /This question is encrypted/);
  assert.match(encrypted.lockMessage, /0x1111\.\.\.1111/);
  assert.equal(JSON.stringify(encrypted).includes('Private prompt must not leak'), false);

  assert.equal(unavailable.title, 'Question unavailable');
  assert.equal(unavailable.encrypted, false);
  assert.equal(unavailable.payloadUnavailable, true);
  assert.match(unavailable.lockMessage, /not available yet/);
});
