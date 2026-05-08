import { RISK_CEILINGS, RISK_RANK, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';

const SESSION_SLUG_RE = /^[a-z0-9_-]{1,128}$/i;

function safeString(value) {
  return String(value || '').trim();
}

function normalizeRisk(value = RISK_CEILINGS.READ) {
  const risk = safeString(value).toLowerCase();
  return Object.hasOwn(RISK_RANK, risk) ? risk : RISK_CEILINGS.READ;
}

function riskAllows(requested, ceiling) {
  return RISK_RANK[normalizeRisk(requested)] <= RISK_RANK[normalizeRisk(ceiling)];
}

export function normalizeSessionPolicy(input = {}) {
  const sessions = Array.isArray(input.sessions)
    ? input.sessions
    : (Array.isArray(input.linkedSessions) ? input.linkedSessions : []);
  const linkedSessions = sessions.map((session) => ({
    sessionSlug: safeString(session.sessionSlug || session.slug || session.name).toLowerCase(),
    sessionName: safeString(session.sessionName || session.name || session.slug),
    default: session.default === true,
    telegramBridgeEnabled: session.telegramBridgeEnabled !== false,
    managedAccountSubmitAllowed: session.managedAccountSubmitAllowed === true,
    sponsoredAiAllowed: session.sponsoredAiAllowed === true,
    sponsoredRpcAllowed: session.sponsoredRpcAllowed === true,
    sponsoredFaucetAllowed: session.sponsoredFaucetAllowed === true,
    sbtJoinModes: Array.isArray(session.sbtJoinModes) ? session.sbtJoinModes.slice() : ['public'],
    docLibraryEnabled: session.docLibraryEnabled === true,
    defaultGroupChatId: safeString(session.defaultGroupChatId || input.defaultGroupChatId) || null,
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
