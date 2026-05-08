// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildTelegramAnswerAction,
  buildTelegramCloudStoragePayload,
  buildTelegramGroupBinding,
  buildTelegramManagedAccountSummary,
  buildTelegramSecureStorageGrant,
  createTelegramPrivateStartAction,
  createTelegramCallbackAction,
  normalizeTelegramUpdate,
  parseTelegramCallbackActionId,
  parseTelegramPrivateStartPayload,
  resolveTelegramPrivateStartAction,
  summarizeTelegramGroupSafeAction,
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

test('Telegram group-to-private bridge uses opaque deep-link payloads only', () => {
  const questionId = `0x${'11'.repeat(32)}`;
  const groupBinding = buildTelegramGroupBinding({
    bindingId: 'cetg_groupalpha1',
    group: { id: '-100123', type: 'supergroup', title: 'Alpha lobby' },
    session: 'alpha',
    questionId,
    workerDeploymentId: 'worker-demo-1',
    createdAt: '2026-05-07T00:00:00.000Z',
  });
  const startAction = createTelegramPrivateStartAction({
    actionId: 'privateanswer1',
    groupBinding,
    botUsername: 'ce_demo_bot',
    createdAt: '2026-05-07T00:01:00.000Z',
  });

  assert.equal(startAction.deepLinkPayload, 'cetg_privateanswer1');
  assert.equal(Buffer.byteLength(startAction.deepLinkPayload, 'utf8') <= 64, true);
  assert.equal(startAction.deepLinkPayload.includes('alpha'), false);
  assert.equal(startAction.deepLinkPayload.includes(questionId), false);
  assert.equal(startAction.deepLinkUrl, 'https://t.me/ce_demo_bot?start=cetg_privateanswer1');
  assert.deepEqual(parseTelegramPrivateStartPayload(startAction.deepLinkPayload), {
    ok: true,
    actionId: 'cetg_privateanswer1',
  });
});

test('Telegram private start resolves group context server-side and routes unknown participants to setup', () => {
  const questionId = `0x${'22'.repeat(32)}`;
  const groupBinding = buildTelegramGroupBinding({
    bindingId: 'cetg_groupalpha2',
    group: { id: '-100456', type: 'group', title: 'Alpha lobby' },
    session: 'alpha',
    questionId,
    workerDeploymentId: 'worker-demo-1',
  });
  const startAction = createTelegramPrivateStartAction({
    actionId: 'recoverctx2',
    groupBinding,
  });

  const unknown = resolveTelegramPrivateStartAction({
    startAction,
    groupBinding,
    participant: { id: 555, username: 'new_user' },
    knownParticipant: false,
  });
  assert.equal(unknown.ok, true);
  assert.equal(unknown.resolution.requiresPrivateAccountSetup, true);
  assert.equal(unknown.resolution.nextStep, 'private_account_setup');
  assert.equal(unknown.resolution.serverResolvedContext.session, 'alpha');
  assert.equal(unknown.resolution.serverResolvedContext.questionId, questionId);
  assert.equal(unknown.resolution.telegramPrincipal.principalId, 'telegram:555');

  const known = resolveTelegramPrivateStartAction({
    startAction,
    groupBinding,
    participant: { id: 555, username: 'new_user' },
    knownParticipant: true,
  });
  assert.equal(known.resolution.requiresPrivateAccountSetup, false);
  assert.equal(known.resolution.nextStep, 'answer_question');
});

test('Telegram group-safe summaries omit account state and answers', () => {
  const questionId = `0x${'33'.repeat(32)}`;
  const groupBinding = buildTelegramGroupBinding({
    bindingId: 'cetg_groupsafe3',
    group: { id: '-100789', type: 'supergroup' },
    session: 'alpha',
    questionId,
  });
  const startAction = createTelegramPrivateStartAction({ actionId: 'safeanswer3', groupBinding });
  const resolution = resolveTelegramPrivateStartAction({
    startAction,
    groupBinding,
    participant: { id: 777 },
    knownParticipant: true,
  }).resolution;
  const account = buildTelegramManagedAccountSummary({
    participant: { id: 777 },
    accountAddress: '0xabc123',
    privateKey: `0x${'44'.repeat(32)}`,
    workerToken: 'Bearer local-token',
    lifecycle: 'account_created',
  });
  const answerAction = buildTelegramAnswerAction({
    resolution,
    managedAccount: account,
    answerRef: {
      refId: 'answer-ref-1',
      contentHash: `0x${'55'.repeat(32)}`,
    },
    draftRequestId: 'agent_req_draft1234',
    submitRequestId: 'agent_req_submit1234',
    answer: 'full answer text must not serialize',
  });
  const summary = summarizeTelegramGroupSafeAction(answerAction);

  assert.equal(Object.hasOwn(summary, 'account'), false);
  assert.equal(JSON.stringify(summary).includes('0xabc123'), false);
  assert.equal(JSON.stringify(summary).includes('full answer text'), false);
  assert.equal(Object.hasOwn(answerAction, 'answer'), false);
  assert.equal(answerAction.account.signingAuthority, false);
  assert.equal(answerAction.account.privateKeyAuthority, false);
  assert.equal(JSON.stringify(answerAction).includes('Bearer local-token'), false);
});

test('Telegram duplicate callbacks resolve idempotently by opaque action id', () => {
  const groupBinding = buildTelegramGroupBinding({
    bindingId: 'cetg_groupidem4',
    group: { id: '-100888', type: 'group' },
    session: 'alpha',
    questionId: `0x${'66'.repeat(32)}`,
  });
  const startAction = createTelegramPrivateStartAction({ actionId: 'idemanswer4', groupBinding });
  const first = resolveTelegramPrivateStartAction({
    startAction,
    groupBinding,
    participant: { id: 888 },
    knownParticipant: true,
  }).resolution;
  const second = resolveTelegramPrivateStartAction({
    startAction,
    groupBinding,
    participant: { id: 888 },
    knownParticipant: true,
  }).resolution;

  assert.equal(first.actionId, second.actionId);
  assert.deepEqual(first.serverResolvedContext, second.serverResolvedContext);
  assert.equal(first.telegramPrincipal.principalId, second.telegramPrincipal.principalId);
});

test('Telegram bridge records reject serializable secret material', () => {
  assert.throws(
    () => buildTelegramGroupBinding({
      group: { id: '-100999', title: 'Bearer local-token' },
      session: 'alpha',
      questionId: `0x${'77'.repeat(32)}`,
      workerDeploymentId: 'worker-demo-1',
    }),
    /must not serialize secrets/,
  );
  assert.throws(
    () => createTelegramPrivateStartAction({
      actionId: 'secretcase1',
      action: 'Bearer local-token',
      groupBinding: {
        group: { id: '-100999' },
        session: 'alpha',
        questionId: `0x${'88'.repeat(32)}`,
      },
    }),
    /must not serialize secrets/,
  );
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
