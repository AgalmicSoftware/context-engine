import { RISK_CEILINGS, RISK_RANK, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';

const SESSION_SLUG_RE = /^[a-z0-9_-]{1,128}$/i;
const PUBLIC_SBT_JOIN_MODES = new Set(['public', 'open']);
const PRIVATE_CREDENTIAL_SBT_JOIN_MODES = new Set(['password', 'invite']);
const FULL_CE_ACCOUNT_SBT_JOIN_MODES = new Set([
  'linked-wallet',
  'wallet',
  'wallet-proof',
  'passkey',
  'non-public',
  'private',
]);

function safeString(value) {
  return String(value || '').trim();
}

function normalizeBool(value = false) {
  if (value === true) return true;
  const normalized = safeString(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizeRisk(value = RISK_CEILINGS.READ) {
  const risk = safeString(value).toLowerCase();
  return Object.hasOwn(RISK_RANK, risk) ? risk : RISK_CEILINGS.READ;
}

function riskAllows(requested, ceiling) {
  return RISK_RANK[normalizeRisk(requested)] <= RISK_RANK[normalizeRisk(ceiling)];
}

function normalizeJoinMode(value = 'public') {
  return safeString(value || 'public').toLowerCase().replace(/_/g, '-');
}

function normalizeRequiredSbtGroup(input = {}) {
  const joinMode = normalizeJoinMode(input.joinMode || input.mode || input.claimMode || input.gateMode);
  const sbtAddress = safeString(input.sbtAddress || input.address);
  const groupId = safeString(input.groupId || input.sbtGroupId || input.groupSlug || input.slug);
  const shareLink = safeString(input.shareLink || input.link || input.url);
  const sbtId = safeString(input.sbtId || input.id || sbtAddress || groupId || shareLink);
  if (!sbtId) return null;
  return {
    sbtId,
    sbtAddress: sbtAddress || null,
    groupId: groupId || null,
    shareLink: shareLink || null,
    name: safeString(input.name || input.title) || 'Required SBT',
    description: safeString(input.description || input.summary) || null,
    joinMode,
    credentialRequired: PRIVATE_CREDENTIAL_SBT_JOIN_MODES.has(joinMode),
    credentialType: PRIVATE_CREDENTIAL_SBT_JOIN_MODES.has(joinMode) ? joinMode : null,
    requiresFullCeAccount: FULL_CE_ACCOUNT_SBT_JOIN_MODES.has(joinMode) || input.requiresFullCeAccount === true,
    publicCommandTargetAllowed: Boolean(sbtAddress || groupId || shareLink),
  };
}

export function normalizeRequiredSbtGroups(session = {}) {
  const candidates = Array.isArray(session.requiredSbtGroups)
    ? session.requiredSbtGroups
    : (
      Array.isArray(session.requiredSbts)
        ? session.requiredSbts
        : (Array.isArray(session.sbtGates) ? session.sbtGates : [])
    );
  return candidates
    .map(normalizeRequiredSbtGroup)
    .filter(Boolean);
}

function buildJoinedSbtLookup(joinedSbtIds = []) {
  return new Set((Array.isArray(joinedSbtIds) ? joinedSbtIds : [])
    .map((value) => safeString(value).toLowerCase())
    .filter(Boolean));
}

function isRequiredSbtJoined(group = {}, joinedLookup = new Set()) {
  return [group.sbtId, group.sbtAddress, group.groupId, group.shareLink]
    .map((value) => safeString(value).toLowerCase())
    .filter(Boolean)
    .some((value) => joinedLookup.has(value));
}

export function normalizeSessionPolicy(input = {}) {
  const sessions = Array.isArray(input.sessions)
    ? input.sessions
    : (Array.isArray(input.linkedSessions) ? input.linkedSessions : []);
  const linkedSessions = sessions.map((session) => ({
    sessionMode: safeString(session.sessionMode || session.mode || session.telegramMode || session.telegram?.mode).toLowerCase(),
    sessionSlug: safeString(session.sessionSlug || session.slug || session.name).toLowerCase(),
    sessionName: safeString(session.sessionName || session.name || session.slug),
    default: session.default === true,
    telegramBridgeEnabled: session.telegramBridgeEnabled !== false,
    telegramOnly: (
      normalizeBool(session.telegramOnly) ||
      normalizeBool(session.telegram_only) ||
      normalizeBool(session.telegram?.only) ||
      safeString(session.sessionMode || session.mode || session.telegramMode || session.telegram?.mode).toLowerCase() === 'telegram_only'
    ),
    managedAccountSubmitAllowed: session.managedAccountSubmitAllowed === true,
    sponsoredAiAllowed: session.sponsoredAiAllowed === true,
    sponsoredRpcAllowed: session.sponsoredRpcAllowed === true,
    sponsoredFaucetAllowed: session.sponsoredFaucetAllowed === true,
    sbtJoinModes: Array.isArray(session.sbtJoinModes) ? session.sbtJoinModes.slice() : ['public'],
    requiredSbtGroups: normalizeRequiredSbtGroups(session),
    docLibraryEnabled: session.docLibraryEnabled === true,
    questions: Array.isArray(session.questions)
      ? session.questions.slice()
      : (Array.isArray(session.telegramQuestions) ? session.telegramQuestions.slice() : []),
    storageProfile: (
      session.storageProfile && typeof session.storageProfile === 'object' && !Array.isArray(session.storageProfile)
        ? { ...session.storageProfile }
        : null
    ),
    defaultGroupChatId: safeString(session.defaultGroupChatId || input.defaultGroupChatId) || null,
    sessionWorkerUrl: safeString(
      session.sessionWorkerUrl ||
      session.workerUrl ||
      session.corsWorkerUrl ||
      session.ceSessionWorkerBaseUrl ||
      session.CE_SESSION_WORKER_BASE_URL ||
      input.sessionWorkerUrl ||
      input.workerUrl ||
      input.corsWorkerUrl ||
      input.ceSessionWorkerBaseUrl ||
      input.CE_SESSION_WORKER_BASE_URL
    ) || null,
    workerSessionSlug: safeString(
      session.workerSessionSlug ||
      session.sessionWorkerSlug ||
      session.ceSessionWorkerSessionSlug ||
      session.sessionWorkerSessionSlug ||
      input.workerSessionSlug ||
      input.sessionWorkerSlug ||
      input.ceSessionWorkerSessionSlug ||
      input.sessionWorkerSessionSlug
    ).toLowerCase() || null,
    workerLoginOrigin: safeString(
      session.workerLoginOrigin ||
      session.sessionWorkerLoginOrigin ||
      session.ceSessionWorkerLoginOrigin ||
      session.loginOrigin ||
      input.workerLoginOrigin ||
      input.sessionWorkerLoginOrigin ||
      input.ceSessionWorkerLoginOrigin ||
      input.loginOrigin
    ) || null,
    allowOrigins: (Array.isArray(session.allowOrigins)
      ? session.allowOrigins
      : (Array.isArray(input.allowOrigins) ? input.allowOrigins : []))
      .map(safeString)
      .filter(Boolean),
    surveysAddress: safeString(
      session.surveysAddress ||
      session.surveyAddress ||
      session.surveysContractAddress ||
      session.surveyContractAddress ||
      input.surveysAddress ||
      input.surveyAddress ||
      input.surveysContractAddress ||
      input.surveyContractAddress
    ) || null,
    chainId: safeString(session.chainId || input.chainId || input.defaultChainId) || null,
  })).filter((session) => SESSION_SLUG_RE.test(session.sessionSlug));
  return {
    type: 'agent_bridge_session_policy',
    linkedSessions,
    defaultSessionSlug: safeString(input.defaultSessionSlug || linkedSessions.find((session) => session.default)?.sessionSlug || linkedSessions[0]?.sessionSlug).toLowerCase(),
    riskCeiling: normalizeRisk(input.riskCeiling || RISK_CEILINGS.READ),
    allowQuestionGeneration: input.allowQuestionGeneration === true,
    allowAddQuestion: input.allowAddQuestion === true,
    allowGenerateQuestion: input.allowGenerateQuestion === true || input.allowQuestionGeneration === true,
  };
}

export function resolveSessionInvocation(policyInput = {}, sessionNameOrSlug = '') {
  const policy = normalizeSessionPolicy(policyInput);
  const lookup = safeString(sessionNameOrSlug || policy.defaultSessionSlug).toLowerCase();
  const session = policy.linkedSessions.find((entry) => (
    entry.sessionSlug === lookup || entry.sessionName.toLowerCase() === lookup
  ));
  if (!session) return { ok: false, reason: 'session_not_linked', sessionSlug: lookup };
  if (session.telegramBridgeEnabled !== true) return { ok: false, reason: 'telegram_bridge_disabled', sessionSlug: session.sessionSlug };
  return { ok: true, session, policy };
}

export function evaluateSbtJoinPolicy(session = {}, {
  mode = 'public',
  password = '',
  linkedWalletEligible = false,
} = {}) {
  const modes = Array.isArray(session.sbtJoinModes) ? session.sbtJoinModes : [];
  if (modes.includes('public') || modes.includes('open')) {
    return { ok: true, reason: 'sbt_public_open_join_allowed', requiresPassword: false };
  }
  if (modes.includes('linked-wallet') && linkedWalletEligible) {
    return { ok: true, reason: 'linked_wallet_sbt_join_allowed', requiresPassword: false };
  }
  if (modes.includes('password')) {
    return password
      ? { ok: true, reason: 'sbt_password_join_allowed', requiresPassword: true }
      : { ok: false, reason: 'sbt_password_required', requiresPassword: true };
  }
  if (modes.includes('invite')) {
    return { ok: false, reason: 'sbt_invite_required', requiresInvite: true };
  }
  return { ok: false, reason: 'sbt_join_not_allowed' };
}

export function evaluateSessionSbtGateJoin(session = {}, {
  joinedSbtIds = [],
} = {}) {
  const requiredSbtGroups = normalizeRequiredSbtGroups(session);
  const joinedLookup = buildJoinedSbtLookup(joinedSbtIds);
  const groups = requiredSbtGroups.map((group) => ({
    ...group,
    joined: isRequiredSbtJoined(group, joinedLookup),
  }));
  const allSatisfied = groups.every((group) => group.joined === true);
  if (groups.length === 0) {
    return {
      ok: true,
      status: 'no_sbt_gate_required',
      requiredSbtGroups: [],
      allSatisfied: true,
      nextStep: TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION,
    };
  }
  return {
    ok: allSatisfied,
    status: allSatisfied ? 'ready_to_retry_session_join' : 'sbt_gate_required',
    requiredSbtGroups: groups,
    allSatisfied,
    nextStep: allSatisfied
      ? TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN
      : 'join_required_sbt',
  };
}

export function evaluateSponsoredResourceEligibility(session = {}, {
  resource = 'ai',
  requestedRisk = RISK_CEILINGS.SPONSORED,
  riskCeiling = RISK_CEILINGS.SPONSORED,
} = {}) {
  if (!riskAllows(requestedRisk, riskCeiling)) {
    return { ok: false, reason: 'risk_ceiling_exceeded', resource };
  }
  const resourceAllowed = {
    ai: session.sponsoredAiAllowed === true,
    rpc: session.sponsoredRpcAllowed === true,
    faucet: session.sponsoredFaucetAllowed === true,
  }[resource] === true;
  return resourceAllowed
    ? { ok: true, reason: `sponsored_${resource}_allowed`, resource, secretExposed: false }
    : { ok: false, reason: `sponsored_${resource}_not_allowed`, resource, secretExposed: false };
}

export function evaluateResponseActionPolicy({
  account = {},
  grant = {},
  session = {},
  action = TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE,
} = {}) {
  if (action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE) {
    if (account.accountMode !== 'managed_telegram_demo') {
      return { ok: false, reason: 'direct_submit_managed_demo_only' };
    }
    if (session.managedAccountSubmitAllowed !== true) {
      return { ok: false, reason: 'session_direct_submit_not_allowed' };
    }
    if (!Array.isArray(grant.allowedActions) || !grant.allowedActions.includes(action)) {
      return { ok: false, reason: 'grant_direct_submit_not_allowed' };
    }
    if (!riskAllows(RISK_CEILINGS.SUBMIT, grant.riskCeiling || RISK_CEILINGS.READ)) {
      return { ok: false, reason: 'risk_ceiling_exceeded' };
    }
    return { ok: true, reason: 'direct_submit_allowed' };
  }
  if (action === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE) {
    return { ok: true, reason: 'submit_request_requires_policy_approval', requiresApproval: true };
  }
  if (action === TELEGRAM_BRIDGE_ACTIONS.SUGGEST_RESPONSE) {
    return { ok: true, reason: 'suggest_response_ephemeral', persisted: false };
  }
  if (action === TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE) {
    return { ok: true, reason: 'draft_response_saved', persisted: true };
  }
  return { ok: false, reason: 'unknown_response_action' };
}

export function evaluateTelegramNormalSessionSubmit({
  account = {},
  grant = {},
  session = {},
  action = TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  joinedSbtIds = [],
  fallbackWhenDirectDenied = true,
} = {}) {
  const gate = evaluateSessionSbtGateJoin(session, { joinedSbtIds });
  if (!gate.ok) {
    return {
      ok: false,
      reason: 'session_sbt_gate_required',
      gate,
      effectiveAction: null,
    };
  }

  const direct = evaluateResponseActionPolicy({
    account,
    grant,
    session,
    action,
  });
  if (direct.ok) {
    return {
      ...direct,
      ok: true,
      mode: action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE ? 'direct_submit' : action,
      effectiveAction: action,
      directSubmitAllowed: action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
      gate,
    };
  }

  if (action !== TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE || fallbackWhenDirectDenied !== true) {
    return { ...direct, gate, effectiveAction: null };
  }

  const allowedActions = Array.isArray(grant.allowedActions) ? grant.allowedActions : [];
  const fallbackAction = allowedActions.includes(TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE)
    ? TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE
    : TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE;
  const fallback = evaluateResponseActionPolicy({
    account,
    grant,
    session,
    action: fallbackAction,
  });
  return {
    ...fallback,
    ok: fallback.ok === true,
    reason: fallbackAction === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE
      ? 'direct_submit_denied_submit_request_created'
      : 'direct_submit_denied_draft_created',
    deniedDirectSubmitReason: direct.reason,
    directSubmitAllowed: false,
    fallbackCreated: true,
    effectiveAction: fallbackAction,
    mode: fallbackAction === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE ? 'submit_request' : 'draft',
    gate,
  };
}
