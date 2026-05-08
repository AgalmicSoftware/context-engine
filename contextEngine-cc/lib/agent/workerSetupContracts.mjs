import { AGENT_BRIDGE_EVENT_TYPES, redactAgentBridgeSecrets } from './bridgePrimitives.mjs';

export const WORKER_SETUP_CONTRACT_VERSION = 'agent-worker-setup-contract-v1';
export const WORKER_SETUP_CLIENT_ROUTE = '/worker-setup';

export const WORKER_SETUP_ROUTE_INVENTORY = Object.freeze([
  {
    method: 'GET',
    path: WORKER_SETUP_CLIENT_ROUTE,
    owner: 'agent-worker-setup',
    status: 'private_contract_only',
    purpose: 'Temporary private setup surface for Telegram/OpenClaw demo readiness.',
  },
  {
    method: 'GET',
    path: '/api/agent/worker-setup',
    owner: 'agent',
    status: 'contract_only',
    purpose: 'Future normalized setup-state read endpoint.',
  },
]);

export const WORKER_SETUP_STEPS = Object.freeze({
  WORKER_REACHABLE: 'worker_reachable',
  TELEGRAM_WEBHOOK_SET: 'telegram_webhook_set',
  START_RECEIVED: 'start_received',
  GROUP_DEEP_LINK_ACTION_RESOLVED: 'group_deep_link_action_resolved',
  TELEGRAM_PRINCIPAL_NORMALIZED: 'telegram_principal_normalized',
  MANAGED_ACCOUNT_CREATED: 'managed_account_created',
  MANAGED_ACCOUNT_RECOVERED: 'managed_account_recovered',
  CE_SESSIONS_FETCHED: 'ce_sessions_fetched',
  QUESTION_FETCHED: 'question_fetched',
  ONBOARDING_SKIPPED: 'onboarding_skipped',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  RESPONSE_ACTION_CREATED: 'response_action_created',
  DRAFT_SUBMIT_REQUEST_CREATED: 'draft_submit_request_created',
  EVENT_LOG_UPDATED: 'event_log_updated',
});

export const WORKER_SETUP_STEP_STATUS = Object.freeze({
  PENDING: 'pending',
  READY: 'ready',
  SKIPPED: 'skipped',
  FAILED: 'failed',
});

export const WORKER_SETUP_EVENT_TYPES = Object.freeze([
  AGENT_BRIDGE_EVENT_TYPES.GROUP_CARD_POSTED,
  AGENT_BRIDGE_EVENT_TYPES.PRIVATE_START_OPENED,
  AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
  AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_RECOVERED,
  AGENT_BRIDGE_EVENT_TYPES.QUESTION_DELIVERED,
  AGENT_BRIDGE_EVENT_TYPES.RESPONSE_ACTION_CREATED,
  AGENT_BRIDGE_EVENT_TYPES.DRAFT_SAVED,
  AGENT_BRIDGE_EVENT_TYPES.SUBMIT_REQUESTED,
  AGENT_BRIDGE_EVENT_TYPES.DELEGATED_EXECUTE_DEFERRED,
  AGENT_BRIDGE_EVENT_TYPES.DELEGATED_EXECUTE_EXECUTED,
  AGENT_BRIDGE_EVENT_TYPES.APPROVED,
  AGENT_BRIDGE_EVENT_TYPES.SUBMITTED,
  AGENT_BRIDGE_EVENT_TYPES.FAILED,
]);

const QUESTION_TYPES = new Set(['text', 'single_choice', 'multi_choice', 'rating', 'boolean']);
const RETENTION_POLICIES = new Set(['none', 'session', 'demo_ephemeral', 'user_managed']);

const safeString = (value) => String(value || '').trim();
const lower = (value) => safeString(value).toLowerCase();

function normalizeStepStatus(status) {
  const normalized = lower(status);
  return Object.values(WORKER_SETUP_STEP_STATUS).includes(normalized)
    ? normalized
    : WORKER_SETUP_STEP_STATUS.PENDING;
}

function normalizeSetupStepRecord(step, input = {}) {
  return {
    type: 'agent_worker_setup_step',
    version: WORKER_SETUP_CONTRACT_VERSION,
    step,
    status: normalizeStepStatus(input.status),
    summary: redactAgentBridgeSecrets(input.summary || {}),
    refs: redactAgentBridgeSecrets(input.refs || {}),
    updatedAt: input.updatedAt || null,
  };
}

function normalizeOnboardingQuestion(question = {}, index = 0) {
  const questionType = lower(question.questionType || question.type || 'text');
  return {
    questionId: safeString(question.questionId || question.id || `onboarding_${index + 1}`),
    prompt: safeString(question.prompt),
    questionType: QUESTION_TYPES.has(questionType) ? questionType : 'text',
    required: question.required === true,
  };
}

export function normalizeWorkerSetupOnboardingConfig(config = {}) {
  const questions = Array.isArray(config.questions)
    ? config.questions.slice(0, 10).map(normalizeOnboardingQuestion)
    : [];
  const retentionPolicy = lower(config.retentionPolicy || config.retention || 'demo_ephemeral');
  return {
    type: 'agent_worker_setup_onboarding_config',
    version: WORKER_SETUP_CONTRACT_VERSION,
    enabled: config.enabled === true,
    introCopy: safeString(config.introCopy || config.intro || ''),
    questions,
    questionCount: questions.length,
    skippable: config.required === true ? false : config.skippable !== false,
    predictiveAnswer: {
      enabled: config.predictiveAnswer?.enabled === true || config.predictiveAnswerEnabled === true,
    },
    retentionPolicy: RETENTION_POLICIES.has(retentionPolicy) ? retentionPolicy : 'demo_ephemeral',
  };
}

export function normalizeWorkerSetupState(input = {}) {
  const providedSteps = input.steps && typeof input.steps === 'object' ? input.steps : {};
  const steps = Object.fromEntries(Object.values(WORKER_SETUP_STEPS).map((step) => [
    step,
    normalizeSetupStepRecord(step, providedSteps[step] || {}),
  ]));
  return {
    type: 'agent_worker_setup_state',
    version: WORKER_SETUP_CONTRACT_VERSION,
    clientRoute: WORKER_SETUP_CLIENT_ROUTE,
    routeInventory: WORKER_SETUP_ROUTE_INVENTORY,
    onboarding: normalizeWorkerSetupOnboardingConfig(input.onboarding || {}),
    steps,
    events: Array.isArray(input.events)
      ? input.events.map((event) => ({
        eventType: WORKER_SETUP_EVENT_TYPES.includes(event.eventType) ? event.eventType : AGENT_BRIDGE_EVENT_TYPES.FAILED,
        summary: redactAgentBridgeSecrets(event.summary || {}),
        refs: redactAgentBridgeSecrets(event.refs || {}),
        createdAt: event.createdAt || null,
      }))
      : [],
    updatedAt: input.updatedAt || null,
  };
}

export function applyWorkerSetupStep(state = {}, step, patch = {}) {
  const normalized = normalizeWorkerSetupState(state);
  if (!Object.values(WORKER_SETUP_STEPS).includes(step)) {
    return normalized;
  }
  return normalizeWorkerSetupState({
    ...normalized,
    steps: {
      ...normalized.steps,
      [step]: {
        ...normalized.steps[step],
        ...patch,
      },
    },
    updatedAt: patch.updatedAt || normalized.updatedAt,
  });
}
