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
  const readQuestions = getAgentApiCapability('agent.read.questions');
  const nextQuestion = getAgentApiCapability('agent.telegram.questions.next');
  const queueAdmin = getAgentApiCapability('agent.telegram.question_queue.manage');
  const adminStatus = getAgentApiCapability('agent.telegram.admin.status');
  const queuePlan = getAgentApiCapability('agent.telegram.question_queue.plan');
  const queueApply = getAgentApiCapability('agent.telegram.question_queue.apply');
  const topicMap = getAgentApiCapability('agent.telegram.results.topic_map');

  assert.equal(groupCapabilities.every((capability) => capability.groupSafe === true), true);
  assert.equal(groupCapabilities.some((capability) => capability.id === 'agent.actions.list'), true);
  assert.equal(groupCapabilities.some((capability) => capability.id === 'agent.settings.update'), false);
  assert.equal(miniAppCapabilities.some((capability) => capability.id === 'agent.settings.update'), true);
  assert.equal(settingsUpdate.path, '/api/agent/settings/update-request');
  assert.deepEqual(settingsUpdate.requiredFields, ['agentAccountRef', 'settingsPatchRef', 'idempotencyKey']);
  assert.equal(accountCreate.path, '/api/agent/accounts/create');
  assert.deepEqual(accountCreate.requiredFields, ['telegramPrincipalId', 'accountMode', 'idempotencyKey']);
  assert.deepEqual(readQuestions.optionalFields, ['limit', 'count', 'topN']);
  assert.equal(nextQuestion.path, '/telegram/agent/api/questions/next');
  assert.equal(nextQuestion.safeTelegramLanes.includes(TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT), true);
  assert.equal(queueAdmin.path, '/telegram/agent/api/question-queue');
  assert.deepEqual(queueAdmin.requiredFields, ['telegramUserId', 'sessionSlug']);
  assert.equal(queueAdmin.groupSafe, false);
  assert.equal(adminStatus.path, '/telegram/agent/api/admin/status');
  assert.deepEqual(adminStatus.requiredFields, ['sessionSlug']);
  assert.equal(adminStatus.groupSafe, false);
  assert.equal(queuePlan.path, '/telegram/agent/api/question-queue/plan');
  assert.equal(queuePlan.requiredFields.includes('sessionSlug'), true);
  assert.equal(queuePlan.groupSafe, false);
  assert.equal(queueApply.path, '/telegram/agent/api/question-queue/apply');
  assert.equal(queueApply.requiredFields.includes('approved or approvalText'), true);
  assert.equal(queueApply.groupSafe, false);
  assert.equal(topicMap.path, '/telegram/agent/api/results');
  assert.equal(topicMap.requiredFields.includes('sessionSlug'), true);
  assert.equal(topicMap.groupSafe, false);
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
