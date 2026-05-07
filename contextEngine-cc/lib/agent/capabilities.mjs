export const AGENT_CAPABILITY_MODES = Object.freeze({
  READ: 'read',
  DRAFT: 'draft',
  SUBMIT_REQUEST: 'submit-request',
  CREATE_QUESTION_REQUEST: 'create-question-request',
  DECRYPT_REQUEST: 'decrypt-request',
  REVOKE_GRANT_REQUEST: 'revoke-grant-request',
  HUMAN_APPROVAL: 'human-approval',
  TRUSTED_LOCAL_AUTO_SUBMIT: 'trusted-local-auto-submit',
});

export const AGENT_CAPABILITY_MODE_METADATA = Object.freeze({
  [AGENT_CAPABILITY_MODES.READ]: Object.freeze({
    risky: false,
    requiresApproval: false,
    remoteAllowed: true,
  }),
  [AGENT_CAPABILITY_MODES.DRAFT]: Object.freeze({
    risky: false,
    requiresApproval: false,
    remoteAllowed: true,
  }),
  [AGENT_CAPABILITY_MODES.SUBMIT_REQUEST]: Object.freeze({
    risky: true,
    requiresApproval: true,
    remoteAllowed: true,
  }),
  [AGENT_CAPABILITY_MODES.CREATE_QUESTION_REQUEST]: Object.freeze({
    risky: true,
    requiresApproval: true,
    remoteAllowed: true,
  }),
  [AGENT_CAPABILITY_MODES.DECRYPT_REQUEST]: Object.freeze({
    risky: true,
    requiresApproval: true,
    remoteAllowed: true,
  }),
  [AGENT_CAPABILITY_MODES.REVOKE_GRANT_REQUEST]: Object.freeze({
    risky: true,
    requiresApproval: true,
    remoteAllowed: true,
  }),
  [AGENT_CAPABILITY_MODES.HUMAN_APPROVAL]: Object.freeze({
    risky: true,
    requiresApproval: false,
    remoteAllowed: false,
  }),
  [AGENT_CAPABILITY_MODES.TRUSTED_LOCAL_AUTO_SUBMIT]: Object.freeze({
    risky: true,
    requiresApproval: false,
    remoteAllowed: false,
  }),
});

export const AGENT_TRUST_TIERS = Object.freeze({
  LOCAL_JWT: 'local-jwt',
  TRUSTED_LOCAL: 'trusted-local',
  REMOTE_AGENT: 'remote-agent',
  HUMAN_OPERATOR: 'human-operator',
});

export function buildAgentCapabilities({
  wallet = '',
  sessions = [],
  workerTokenSummary = {},
  settings = {},
  submitStatus = {},
} = {}) {
  const selectedSessions = Array.isArray(sessions)
    ? sessions.map((session) => String(session || '').trim()).filter(Boolean)
    : [];
  const autoSubmitResponses = settings?.autoSubmitResponses === true;
  const localSubmitReady = !!submitStatus?.ready && workerTokenSummary?.ready === true;

  return {
    version: 'agent-contract-v1',
    wallet: String(wallet || '').trim(),
    trustTier: AGENT_TRUST_TIERS.LOCAL_JWT,
    modes: {
      [AGENT_CAPABILITY_MODES.READ]: true,
      [AGENT_CAPABILITY_MODES.DRAFT]: true,
      [AGENT_CAPABILITY_MODES.SUBMIT_REQUEST]: true,
      [AGENT_CAPABILITY_MODES.CREATE_QUESTION_REQUEST]: false,
      [AGENT_CAPABILITY_MODES.DECRYPT_REQUEST]: false,
      [AGENT_CAPABILITY_MODES.REVOKE_GRANT_REQUEST]: false,
      [AGENT_CAPABILITY_MODES.HUMAN_APPROVAL]: true,
      [AGENT_CAPABILITY_MODES.TRUSTED_LOCAL_AUTO_SUBMIT]: autoSubmitResponses && localSubmitReady,
    },
    modeMetadata: AGENT_CAPABILITY_MODE_METADATA,
    submission: {
      remoteAutoSubmit: false,
      submitRequestsRequireApproval: true,
      trustedLocalAutoSubmit: autoSubmitResponses && localSubmitReady,
      workerTokenReady: workerTokenSummary?.ready === true,
      selectedSessionCount: selectedSessions.length,
    },
    constraints: [
      'Remote agents may draft responses but must request human approval for submission.',
      'Local JWT auth is not a worker token and does not grant signing authority.',
      'Telegram and OpenClaw adapters must forward through this HTTP contract or its MCP wrapper.',
    ],
  };
}

export function hasAgentCapability(capabilities, mode) {
  const normalizedMode = String(mode || '').trim();
  return !!capabilities?.modes?.[normalizedMode];
}

export function isRemoteAgentCapabilityMode(mode) {
  const normalizedMode = String(mode || '').trim();
  return AGENT_CAPABILITY_MODE_METADATA[normalizedMode]?.remoteAllowed === true;
}

export function evaluateAgentCapabilityRequest({
  capabilities = {},
  mode = '',
  trustTier = AGENT_TRUST_TIERS.REMOTE_AGENT,
} = {}) {
  const normalizedMode = String(mode || '').trim();
  const metadata = AGENT_CAPABILITY_MODE_METADATA[normalizedMode] || null;
  if (!metadata) {
    return { ok: false, status: 'denied', reason: 'unknown_capability', mode: normalizedMode };
  }
  if (!hasAgentCapability(capabilities, normalizedMode)) {
    return { ok: false, status: 'denied', reason: 'capability_disabled', mode: normalizedMode };
  }
  if (trustTier === AGENT_TRUST_TIERS.REMOTE_AGENT && metadata.remoteAllowed !== true) {
    return { ok: false, status: 'denied', reason: 'local_only_capability', mode: normalizedMode };
  }
  return {
    ok: true,
    status: metadata.requiresApproval ? 'approval_required' : 'allowed',
    reason: metadata.requiresApproval ? 'human_approval_required' : 'capability_allowed',
    mode: normalizedMode,
    requiresApproval: metadata.requiresApproval,
    risky: metadata.risky,
    remoteAllowed: metadata.remoteAllowed,
  };
}
