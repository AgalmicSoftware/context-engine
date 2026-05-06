export const AGENT_CAPABILITY_MODES = Object.freeze({
  READ: 'read',
  DRAFT: 'draft',
  SUBMIT_REQUEST: 'submit-request',
  HUMAN_APPROVAL: 'human-approval',
  TRUSTED_LOCAL_AUTO_SUBMIT: 'trusted-local-auto-submit',
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
      [AGENT_CAPABILITY_MODES.HUMAN_APPROVAL]: true,
      [AGENT_CAPABILITY_MODES.TRUSTED_LOCAL_AUTO_SUBMIT]: autoSubmitResponses && localSubmitReady,
    },
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
