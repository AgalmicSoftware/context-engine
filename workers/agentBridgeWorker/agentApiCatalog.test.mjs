import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalAgentRequest,
  describeTelegramAgentApiCatalog,
  getAgentApiCapability,
  listAgentApiCapabilities,
} from './agentApiCatalog.mjs';
import { TELEGRAM_CHAT_LANES } from './constants.mjs';

test('Telegram agent API catalog exposes canonical /api/agent capabilities by lane', () => {
  const groupCapabilities = listAgentApiCapabilities({ lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY });
  const miniAppCapabilities = listAgentApiCapabilities({ lane: TELEGRAM_CHAT_LANES.MINI_APP, includeGroupUnsafe: true });
  const settingsUpdate = getAgentApiCapability('agent.settings.update');
  const accountCreate = getAgentApiCapability('agent.account.create');
  const nextQuestion = getAgentApiCapability('agent.telegram.questions.next');
  const queueAdmin = getAgentApiCapability('agent.telegram.question_queue.manage');

  assert.equal(groupCapabilities.every((capability) => capability.groupSafe === true), true);
  assert.equal(groupCapabilities.some((capability) => capability.id === 'agent.actions.list'), true);
  assert.equal(groupCapabilities.some((capability) => capability.id === 'agent.settings.update'), false);
  assert.equal(miniAppCapabilities.some((capability) => capability.id === 'agent.settings.update'), true);
  assert.equal(settingsUpdate.path, '/api/agent/settings/update-request');
  assert.deepEqual(settingsUpdate.requiredFields, ['agentAccountRef', 'settingsPatchRef', 'idempotencyKey']);
  assert.equal(accountCreate.path, '/api/agent/accounts/create');
  assert.deepEqual(accountCreate.requiredFields, ['telegramPrincipalId', 'accountMode', 'idempotencyKey']);
  assert.equal(nextQuestion.path, '/telegram/agent/api/questions/next');
  assert.equal(nextQuestion.safeTelegramLanes.includes(TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT), true);
  assert.equal(queueAdmin.path, '/telegram/agent/api/question-queue');
  assert.deepEqual(queueAdmin.requiredFields, ['telegramUserId', 'sessionSlug']);
  assert.equal(queueAdmin.groupSafe, false);
});

test('canonical request envelopes include catalog metadata and required field gaps', () => {
  const request = buildCanonicalAgentRequest({
    capabilityId: 'agent.settings.update',
    body: {
      agentAccountRef: 'telegram_managed_agent_ref',
      settingsPatchRef: 'telegram_settings_patch_ref',
      settingsPatchSummary: { draftStyle: 'concise' },
      idempotencyKey: 'ceab_settingsdemo',
    },
  });
  const incomplete = buildCanonicalAgentRequest({
    capabilityId: 'agent.responses.submit_request',
    body: {
      session: 'alpha',
      questionId: 'q-1',
    },
  });

  assert.equal(request.type, 'canonical_ce_agent_api_request');
  assert.equal(request.catalogVersion, 1);
  assert.equal(request.method, 'POST');
  assert.equal(request.path, '/api/agent/settings/update-request');
  assert.equal(request.status, 'pending_canonical_handoff');
  assert.deepEqual(request.missingRequiredFields, []);
  assert.deepEqual(incomplete.missingRequiredFields, ['answerRef', 'idempotencyKey']);
});

test('catalog descriptions stay group safe and reject secret-shaped envelopes', () => {
  const catalog = describeTelegramAgentApiCatalog({ lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY });

  assert.equal(catalog.canonicalBoundary, '/api/agent/*');
  assert.equal(JSON.stringify(catalog).includes('private-key'), false);
  assert.throws(() => buildCanonicalAgentRequest({
    capabilityId: 'agent.settings.update',
    body: {
      agentAccountRef: 'telegram_managed_agent_ref',
      settingsPatchRef: 'telegram_settings_patch_ref',
      idempotencyKey: 'ceab_settingsdemo',
      privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    },
  }), /Canonical agent request envelopes/);
});
