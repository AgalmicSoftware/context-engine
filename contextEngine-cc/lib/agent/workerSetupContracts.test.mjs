// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKER_SETUP_CLIENT_ROUTE,
  WORKER_SETUP_EVENT_TYPES,
  WORKER_SETUP_ROUTE_INVENTORY,
  WORKER_SETUP_STEPS,
  applyWorkerSetupStep,
  normalizeWorkerSetupOnboardingConfig,
  normalizeWorkerSetupState,
} from './workerSetupContracts.mjs';

test('worker setup route inventory stays private and contract-only', () => {
  assert.equal(WORKER_SETUP_CLIENT_ROUTE, '/worker-setup');
  assert.deepEqual(WORKER_SETUP_ROUTE_INVENTORY.map((entry) => entry.path), [
    '/worker-setup',
    '/api/agent/worker-setup',
  ]);
  assert.equal(WORKER_SETUP_ROUTE_INVENTORY.every((entry) => entry.status.includes('contract')), true);
});

test('worker setup state includes the Telegram demo readiness checkpoints', () => {
  const state = normalizeWorkerSetupState({
    steps: {
      [WORKER_SETUP_STEPS.WORKER_REACHABLE]: {
        status: 'ready',
        summary: { url: 'http://127.0.0.1:7391' },
      },
      [WORKER_SETUP_STEPS.TELEGRAM_WEBHOOK_SET]: {
        status: 'ready',
      },
      [WORKER_SETUP_STEPS.GROUP_DEEP_LINK_ACTION_RESOLVED]: {
        status: 'ready',
        refs: { actionId: 'cetg_action123' },
      },
      [WORKER_SETUP_STEPS.MANAGED_ACCOUNT_CREATED]: {
        status: 'ready',
        summary: { accountAddress: '0xabc123' },
      },
      [WORKER_SETUP_STEPS.ONBOARDING_SKIPPED]: {
        status: 'skipped',
      },
      [WORKER_SETUP_STEPS.RESPONSE_ACTION_CREATED]: {
        status: 'ready',
      },
      [WORKER_SETUP_STEPS.EVENT_LOG_UPDATED]: {
        status: 'ready',
      },
    },
  });

  for (const step of Object.values(WORKER_SETUP_STEPS)) {
    assert.equal(state.steps[step].type, 'agent_worker_setup_step', step);
  }
  assert.equal(state.steps.worker_reachable.status, 'ready');
  assert.equal(state.steps.onboarding_skipped.status, 'skipped');
  assert.equal(state.steps.managed_account_recovered.status, 'pending');
});

test('onboarding config defaults off and caps configured questions', () => {
  assert.deepEqual(normalizeWorkerSetupOnboardingConfig(), {
    type: 'agent_worker_setup_onboarding_config',
    version: 'agent-worker-setup-contract-v1',
    enabled: false,
    introCopy: '',
    questions: [],
    questionCount: 0,
    skippable: true,
    predictiveAnswer: { enabled: false },
    retentionPolicy: 'demo_ephemeral',
  });

  const config = normalizeWorkerSetupOnboardingConfig({
    enabled: true,
    introCopy: 'A short setup prompt.',
    questions: Array.from({ length: 12 }, (_, index) => ({
      id: `q${index + 1}`,
      prompt: `Question ${index + 1}?`,
      questionType: index === 0 ? 'rating' : 'unknown',
      required: index === 0,
    })),
    required: true,
    predictiveAnswerEnabled: true,
    retentionPolicy: 'session',
  });
  assert.equal(config.enabled, true);
  assert.equal(config.questionCount, 10);
  assert.equal(config.questions[0].questionType, 'rating');
  assert.equal(config.questions[1].questionType, 'text');
  assert.equal(config.skippable, false);
  assert.equal(config.predictiveAnswer.enabled, true);
  assert.equal(config.retentionPolicy, 'session');
});

test('worker setup events and summaries redact secrets while keeping safe refs', () => {
  const state = normalizeWorkerSetupState({
    events: [
      {
        eventType: 'group_card_posted',
        summary: {
          actionId: 'cetg_action123',
          workerToken: 'must-redact',
          note: 'Bearer local-token',
        },
        refs: {
          payloadRef: 'payload-1',
        },
      },
      {
        eventType: 'unknown_event',
        summary: {
          ok: true,
        },
      },
    ],
  });

  assert.equal(WORKER_SETUP_EVENT_TYPES.includes('group_card_posted'), true);
  assert.equal(WORKER_SETUP_EVENT_TYPES.includes('private_start_opened'), true);
  assert.equal(WORKER_SETUP_EVENT_TYPES.includes('account_created'), true);
  assert.equal(WORKER_SETUP_EVENT_TYPES.includes('account_recovered'), true);
  assert.equal(WORKER_SETUP_EVENT_TYPES.includes('response_action_created'), true);
  assert.equal(state.events[0].summary.workerToken, '[redacted]');
  assert.equal(state.events[0].summary.note, '[redacted]');
  assert.equal(state.events[0].refs.payloadRef, 'payload-1');
  assert.equal(state.events[1].eventType, 'failed');
});

test('worker setup step updates are additive and normalize unknown steps away', () => {
  const initial = normalizeWorkerSetupState();
  const updated = applyWorkerSetupStep(initial, WORKER_SETUP_STEPS.QUESTION_FETCHED, {
    status: 'ready',
    refs: { questionId: `0x${'11'.repeat(32)}` },
    updatedAt: '2026-05-07T00:00:00.000Z',
  });
  assert.equal(updated.steps.question_fetched.status, 'ready');
  assert.equal(updated.steps.question_fetched.refs.questionId, `0x${'11'.repeat(32)}`);
  assert.equal(updated.updatedAt, '2026-05-07T00:00:00.000Z');
  assert.deepEqual(applyWorkerSetupStep(updated, 'not_a_step', { status: 'ready' }), updated);
});
