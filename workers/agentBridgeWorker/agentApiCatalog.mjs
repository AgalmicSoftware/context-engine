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
    botCommands: ['/agent'],
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
    optionalFields: ['limit', 'count', 'topN'],
  }),
  freezeEntry({
    id: 'agent.telegram.questions.next',
    category: 'questions',
    label: 'Get Next Telegram Question',
    canonicalActionId: 'agent.telegram.questions.next',
    method: 'POST',
    path: '/telegram/agent/api/questions/next',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug'],
    optionalFields: ['groupChatId', 'criteria', 'preferences', 'queueKey', 'advance', 'resetQueue'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Returns one answerable question for scheduled agent prompts, serving admin-sponsored question ids first before falling back to preference-ranked active questions.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.question_queue.manage',
    category: 'questions',
    label: 'Manage Sponsored Question Queue',
    canonicalActionId: 'agent.telegram.question_queue.manage',
    method: 'POST',
    path: '/telegram/agent/api/question-queue',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug'],
    optionalFields: ['sponsoredQuestionIds', 'questionIds', 'operation', 'clear'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Requires the shared service token plus a Telegram account whose managed wallet is a configured session admin; ordinary ceagt_ user tokens cannot change admin queues.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.admin.status',
    category: 'admin',
    label: 'Check Telegram Admin Status',
    canonicalActionId: 'agent.telegram.admin.status',
    method: 'GET',
    path: '/telegram/agent/api/admin/status',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['sessionSlug'],
    optionalFields: ['telegramUserId'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'A user-scoped ceagt_ token can check whether its Telegram managed wallet has session admin capabilities such as sponsored-question management.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.question_queue.plan',
    category: 'questions',
    label: 'Plan Sponsored Questions',
    canonicalActionId: 'agent.telegram.question_queue.plan',
    method: 'POST',
    path: '/telegram/agent/api/question-queue/plan',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['sessionSlug'],
    optionalFields: ['references', 'instruction', 'createQuestions', 'newQuestions'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Admin-only planning route for natural-language sponsored-question refs and draft questions. It does not write until the admin approves the apply step.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.question_queue.apply',
    category: 'questions',
    label: 'Apply Sponsored Questions',
    canonicalActionId: 'agent.telegram.question_queue.apply',
    method: 'POST',
    path: '/telegram/agent/api/question-queue/apply',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['sessionSlug', 'approved or approvalText'],
    optionalFields: ['references', 'instruction', 'createQuestions', 'newQuestions', 'replace'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Admin-only write route. Agents must show the plan to the admin first and call this endpoint only after explicit approval.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.preferences.draft',
    category: 'responses',
    label: 'Draft Telegram Preferences',
    canonicalActionId: 'agent.telegram.preferences.draft',
    method: 'POST',
    path: '/telegram/agent/api/preferences',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug', 'preferences.answersByQuestionId'],
    optionalFields: ['groupChatId', 'submit', 'humanApproved'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Writes drafts by default. When the user explicitly authorizes the agent to answer on their behalf, submit=true plus humanApproved=true submits the same answers without requiring Mini App finalization.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.question_votes.recommend',
    category: 'questions',
    label: 'Recommend Question Votes',
    canonicalActionId: 'agent.telegram.question_votes.recommend',
    method: 'POST',
    path: '/telegram/agent/api/question-votes/recommend',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug', 'preferences'],
    optionalFields: ['groupChatId', 'autoApply', 'agent', 'metadata'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Returns meta-question recommendations for question up/down votes; auto-apply is gated by the account/session Mini App setting.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.question_votes.apply',
    category: 'questions',
    label: 'Apply Question Votes',
    canonicalActionId: 'agent.telegram.question_votes.apply',
    method: 'POST',
    path: '/telegram/agent/api/question-votes/apply',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug', 'decisions or approvalText'],
    optionalFields: ['groupChatId', 'recommendations', 'agent', 'metadata'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Records human-approved or overridden agent question-vote decisions with non-secret research metadata.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.actions.list',
    category: 'agent',
    label: 'List Agent Activity',
    canonicalActionId: 'agent.telegram.actions.list',
    method: 'GET',
    path: '/telegram/agent/api/actions',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug'],
    optionalFields: ['groupChatId', 'limit'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Returns this user’s mutation history and pending agent suggestions for the token-scoped session.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.mini_app_launch.create',
    category: 'launcher',
    label: 'Create Mini App Question Link',
    canonicalActionId: 'agent.telegram.mini_app_launch.create',
    method: 'POST',
    path: '/telegram/agent/api/mini-app-launch',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['sessionSlug', 'questionIds'],
    optionalFields: ['skippedQuestionIds', 'draftAnswersByQuestionId'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Mints an expiring Mini App launch record for an ordered question series with editable prefilled drafts.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.results.topic_map',
    category: 'results',
    label: 'Read Telegram Topic Map Results',
    canonicalActionId: 'agent.telegram.results.topic_map',
    method: 'GET',
    path: '/telegram/agent/api/results',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['sessionSlug'],
    optionalFields: ['view=topic-map', 'demo'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Returns the cached aggregate topic-map data contract for answered questions. It exposes counts, topic circles, and question bubbles, never raw response records.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.results.topic_map_image',
    category: 'results',
    label: 'Render Telegram Topic Map Image',
    canonicalActionId: 'agent.telegram.results.topic_map_image',
    method: 'GET',
    path: '/telegram/agent/api/results-image',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['sessionSlug', 'view=topic-map'],
    optionalFields: ['demo'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Returns a PNG rendering of the topic map when enough aggregate data exists, or when demo preview is requested.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.questions.pose',
    category: 'questions',
    label: 'Pose Telegram Question',
    canonicalActionId: 'agent.telegram.questions.pose',
    method: 'POST',
    path: '/telegram/agent/api/questions/pose',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug', 'questionId or prompt'],
    optionalFields: ['groupChatId', 'questionType', 'send'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
    ],
    groupSafe: false,
    notes: [
      'Uses Telegram-native group membership or session binding for permission until CE parity gates are standardized.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.groups.list',
    category: 'groups',
    label: 'List Telegram Groups',
    canonicalActionId: 'agent.telegram.groups.list',
    method: 'GET',
    path: '/telegram/agent/api/groups',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug'],
    optionalFields: ['groupChatId'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Lists Cloudflare-managed lightweight group categories and the user membership selections for Telegram-only sessions.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.groups.propose',
    category: 'groups',
    label: 'Propose Telegram Group',
    canonicalActionId: 'agent.telegram.groups.propose',
    method: 'POST',
    path: '/telegram/agent/api/groups/propose',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug', 'category'],
    optionalFields: ['groupChatId', 'targetTelegramUserId', 'message', 'optionIds'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Creates or updates a Cloudflare-only group category and records a user-decision prompt. It never auto-joins the user.',
    ],
  }),
  freezeEntry({
    id: 'agent.telegram.sessions.child_create',
    category: 'sessions',
    label: 'Create Telegram Child Session',
    canonicalActionId: 'agent.telegram.sessions.child_create',
    method: 'POST',
    path: '/telegram/agent/api/sessions/child',
    handoffStatus: AGENT_API_HANDOFF_STATUS.WORKER_LOCAL_UNTIL_CANONICAL,
    requiredFields: ['telegramUserId', 'sessionSlug', 'sessionName'],
    optionalFields: ['groupChatId', 'childSessionSlug', 'questions', 'groups'],
    safeTelegramLanes: [
      TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      TELEGRAM_CHAT_LANES.MINI_APP,
    ],
    groupSafe: false,
    notes: [
      'Creates a worker-local Telegram-only child-session record until canonical session-registry parity is available.',
    ],
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
