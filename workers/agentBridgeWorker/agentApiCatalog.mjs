import { TELEGRAM_CHAT_LANES } from './constants.mjs';
import { assertNoSecretShape, sanitizeForGroup } from './redaction.mjs';

export const AGENT_API_CATALOG_VERSION = 1;

export const AGENT_API_HANDOFF_STATUS = Object.freeze({
  IMPLEMENTED: 'implemented',
  WORKER_LOCAL_UNTIL_CANONICAL: 'worker_local_until_canonical_endpoint',
  PENDING_CANONICAL_HANDOFF: 'pending_canonical_handoff',
  PLANNED_CONTRACT_ONLY: 'planned_contract_only',
  CATALOG_ONLY: 'catalog_scaffold',
});

const safeString = (value) => String(value || '').trim();

const freezeEntry = (entry) => Object.freeze({
  ...entry,
  requiredFields: Object.freeze([...(entry.requiredFields || [])]),
  optionalFields: Object.freeze([...(entry.optionalFields || [])]),
  safeTelegramLanes: Object.freeze([...(entry.safeTelegramLanes || [])]),
  botCommands: Object.freeze([...(entry.botCommands || [])]),
  miniAppRoutes: Object.freeze([...(entry.miniAppRoutes || [])]),
  notes: Object.freeze([...(entry.notes || [])]),
});

const CAPABILITIES = Object.freeze([
  freezeEntry({
    id: 'agent.actions.list',
    category: 'launcher',
    label: 'Action Menu',
    canonicalActionId: 'agent.actions.list',
    method: 'GET',
    path: '/api/agent/actions',
    handoffStatus: AGENT_API_HANDOFF_STATUS.CATALOG_ONLY,
    requiredFields: ['lane'],
    optionalFields: ['session'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: true,
    botCommands: ['/actions', '/agent'],
    miniAppRoutes: ['agent/actions'],
    notes: [
      'Group chat may show only action labels and private/Mini App launch controls.',
    ],
  }),
  freezeEntry({
    id: 'agent.account.create',
    category: 'account',
    label: 'Managed Account',
    canonicalActionId: 'agent.account.create',
    method: 'POST',
    path: '/api/agent/accounts/create',
    handoffStatus: AGENT_API_HANDOFF_STATUS.IMPLEMENTED,
    requiredFields: ['telegramPrincipalId', 'accountMode', 'idempotencyKey'],
    optionalFields: ['session', 'deploymentRef'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    botCommands: ['/create_agent'],
    miniAppRoutes: ['agent/account/create'],
    notes: [
      'The bridge can derive a managed demo account locally, but canonical account creation remains an /api/agent/* request.',
    ],
  }),
  freezeEntry({
    id: 'agent.account.summary',
    category: 'account',
    label: 'Account Summary',
    canonicalActionId: 'agent.account.summary',
    method: 'GET',
    path: '/api/agent/accounts/me',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['agentAccountRef'],
    optionalFields: ['session'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    botCommands: ['/me', '/account'],
    miniAppRoutes: ['agent/account'],
  }),
  freezeEntry({
    id: 'agent.settings.read',
    category: 'settings',
    label: 'Settings',
    canonicalActionId: 'agent.settings.read',
    method: 'GET',
    path: '/api/agent/settings',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY,
    requiredFields: ['agentAccountRef'],
    optionalFields: ['session'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    botCommands: ['/settings'],
    miniAppRoutes: ['agent/settings'],
  }),
  freezeEntry({
    id: 'agent.settings.update',
    category: 'settings',
    label: 'Update Settings',
    canonicalActionId: 'agent.settings.update_request',
    method: 'POST',
    path: '/api/agent/settings/update-request',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PENDING_CANONICAL_HANDOFF,
    requiredFields: ['agentAccountRef', 'settingsPatchRef', 'idempotencyKey'],
    optionalFields: ['settingsPatchSummary', 'session'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    botCommands: ['/settings'],
    miniAppRoutes: ['agent/settings/edit'],
    notes: [
      'The scaffold accepts safe enum/boolean settings only; freeform private inputs should be stored behind opaque refs.',
    ],
  }),
  freezeEntry({
    id: 'agent.read.questions',
    category: 'questions',
    label: 'View Questions',
    canonicalActionId: 'agent.read.questions',
    method: 'GET',
    path: '/api/agent/questions',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['session'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: true,
    botCommands: ['/questions'],
    miniAppRoutes: ['questions'],
  }),
  freezeEntry({
    id: 'agent.responses.submit_request',
    category: 'responses',
    label: 'Submit Response',
    canonicalActionId: 'agent.response.submit_request',
    method: 'POST',
    path: '/api/agent/responses/submit-request',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PENDING_CANONICAL_HANDOFF,
    requiredFields: ['session', 'questionId', 'answerRef', 'idempotencyKey'],
    optionalFields: ['questionRef'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    miniAppRoutes: ['questions/answer'],
  }),
  freezeEntry({
    id: 'agent.sbt_group.claim_request',
    category: 'sbt',
    label: 'Join SBT',
    canonicalActionId: 'agent.sbt_group.claim_request',
    method: 'POST',
    path: '/api/agent/sbt-groups/claim-request',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY,
    requiredFields: ['session', 'joinMode'],
    optionalFields: ['sbtAddress', 'groupId', 'shareLink', 'credentialRef'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    botCommands: ['/join_sbt'],
    miniAppRoutes: ['sbt/claim'],
  }),
  freezeEntry({
    id: 'agent.sbt_group.create_request',
    category: 'sbt',
    label: 'Create SBT Group',
    canonicalActionId: 'agent.sbt_group.create_request',
    method: 'POST',
    path: '/api/agent/sbt-groups/create-request',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY,
    requiredFields: ['session', 'name', 'joinMode'],
    optionalFields: ['description', 'image', 'visibility', 'credentialRef'],
    safeTelegramLanes: [TELEGRAM_CHAT_LANES.MINI_APP],
    groupSafe: false,
    botCommands: ['/create_sbt_group'],
    miniAppRoutes: ['sbt/create'],
  }),
  freezeEntry({
    id: 'agent.decrypt.request',
    category: 'access',
    label: 'Decrypt Request',
    canonicalActionId: 'agent.decrypt.request',
    method: 'POST',
    path: '/api/agent/decrypt/request',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY,
    requiredFields: ['session', 'resourceType'],
    optionalFields: ['questionId', 'accountAddress', 'storageProfile'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    miniAppRoutes: ['access/decrypt'],
  }),
  freezeEntry({
    id: 'agent.session_storage.access_request',
    category: 'storage',
    label: 'Storage Access',
    canonicalActionId: 'agent.session_storage.access_request',
    method: 'POST',
    path: '/api/agent/session-storage/access-request',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY,
    requiredFields: ['session', 'storageProfile', 'resource'],
    optionalFields: ['payloadEncrypted'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    miniAppRoutes: ['storage/access'],
  }),
  freezeEntry({
    id: 'agent.events.forward_openclaw',
    category: 'events',
    label: 'Forward Event',
    canonicalActionId: 'agent.events.forward_openclaw',
    method: 'POST',
    path: '/api/agent/events/forward-openclaw',
    handoffStatus: AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY,
    requiredFields: ['eventRef'],
    optionalFields: ['session', 'requestId'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    miniAppRoutes: ['events/forward'],
  }),
]);

const CAPABILITY_BY_ID = new Map(CAPABILITIES.map((capability) => [capability.id, capability]));
const CAPABILITY_BY_ACTION_ID = new Map(CAPABILITIES.map((capability) => [capability.canonicalActionId, capability]));
const CAPABILITY_BY_PATH = new Map(CAPABILITIES.map((capability) => [capability.path, capability]));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasRequiredField(body = {}, field = '') {
  const parts = safeString(field).split('.').filter(Boolean);
  if (!parts.length) return false;
  let cursor = body;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object' || !Object.hasOwn(cursor, part)) return false;
    cursor = cursor[part];
  }
  if (Array.isArray(cursor)) return cursor.length > 0;
  return cursor !== null && cursor !== undefined && safeString(cursor) !== '';
}

export function getAgentApiCapability(id = '') {
  const capability = CAPABILITY_BY_ID.get(safeString(id));
  return capability ? clone(capability) : null;
}

export function listAgentApiCapabilities({
  lane = '',
  category = '',
  includeGroupUnsafe = false,
} = {}) {
  const normalizedLane = safeString(lane);
  const normalizedCategory = safeString(category);
  return CAPABILITIES
    .filter((capability) => !normalizedLane || capability.safeTelegramLanes.includes(normalizedLane))
    .filter((capability) => !normalizedCategory || capability.category === normalizedCategory)
    .filter((capability) => includeGroupUnsafe || capability.groupSafe === true || normalizedLane !== TELEGRAM_CHAT_LANES.GROUP_LOBBY)
    .map(clone);
}

export function describeTelegramAgentApiCatalog({
  lane = '',
  includeGroupUnsafe = true,
} = {}) {
  return sanitizeForGroup({
    type: 'telegram_agent_api_capability_catalog',
    version: AGENT_API_CATALOG_VERSION,
    canonicalBoundary: '/api/agent/*',
    capabilities: listAgentApiCapabilities({ lane, includeGroupUnsafe }),
    safety: {
      callbackData: 'opaque_cecb_only',
      deepLinks: 'opaque_cetg_or_cecb_only',
      groupMessages: 'safe_summaries_only',
      privateInputs: 'private_chat_or_mini_app_only',
    },
  });
}

export function buildCanonicalAgentRequest({
  capabilityId = '',
  method = '',
  path = '',
  actionId = '',
  status = '',
  body = {},
} = {}) {
  const capability = CAPABILITY_BY_ID.get(safeString(capabilityId))
    || CAPABILITY_BY_ACTION_ID.get(safeString(actionId))
    || CAPABILITY_BY_PATH.get(safeString(path));
  const normalizedBody = body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
  assertNoSecretShape(normalizedBody, 'Canonical agent request envelopes must not contain secrets.');
  const requiredFields = capability?.requiredFields ? [...capability.requiredFields] : [];
  const request = {
    type: 'canonical_ce_agent_api_request',
    catalogVersion: AGENT_API_CATALOG_VERSION,
    capabilityId: capability?.id || safeString(capabilityId) || null,
    method: safeString(method || capability?.method || 'POST'),
    path: safeString(path || capability?.path),
    actionId: safeString(actionId || capability?.canonicalActionId || capability?.id),
    status: safeString(status || capability?.handoffStatus || AGENT_API_HANDOFF_STATUS.PLANNED_CONTRACT_ONLY),
    requiredFields,
    missingRequiredFields: requiredFields.filter((field) => !hasRequiredField(normalizedBody, field)),
    safeTelegramLanes: capability?.safeTelegramLanes ? [...capability.safeTelegramLanes] : [],
    body: normalizedBody,
    authority: 'canonical_ce_agent_session_api',
  };
  assertNoSecretShape(request, 'Canonical agent request envelopes must not contain secrets.');
  return sanitizeForGroup(request);
}
