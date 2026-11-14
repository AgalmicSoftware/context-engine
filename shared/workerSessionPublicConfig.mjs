export const PUBLIC_WORKER_CONFIG_FIELDS = Object.freeze([
  'slug',
  'authzEpoch',
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'sessionName',
  'sessionInfo',
  'appearance',
  'sessionContext',
  'sessionHeaderImg',
  'sessionEndsAt',
  'interviewModeEnabled',
  'pileAutoAdvanceEnabled',
  'feedbackEnabled',
  'interviewMode',
  'defaultTags',
  'defaultGroupTags',
  'defaultSbtTags',
  'questionsGenPrompt',
  'agentInstructions',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
  'ignored_SBTs_LIST',
  'featured_SBTs_LIST',
  'adminAddress',
  'adminAddresses',
  'resultsAdminAddresses',
  'corsWorkerUrl',
  'allowOrigins',
  'sessionModeProfile',
  'responseFieldEncryption',
  'agentSessionWrapped',
  'agentHttp',
  'resultsExposure',
  'workerAuthority',
  'groupCreationPolicy',
  'groupMemberCeiling',
  'contextAdditionPolicy',
  'sessionAgent',
  'linkedWorkerGroups',
  'storageProfile',
  'ai',
  'limits',
  'scopes',
  'blockLimits',
  'contracts',
  'registryChainId',
  'networkChainId',
  'embeddedDeployHelperEnabled',
  'resultsAnalysis',
]);

// The non-secret parts of `ai` the public config shows; the rest of `ai`
// (provider endpoints and custom functions, for example) stays hidden.
export const PUBLIC_WORKER_AI_FIELDS = Object.freeze(['models', 'reasoningEffort', 'taskReasoningEffort']);

// Set by the Worker on every public config read (never stored): its
// set-config merges `ai` one level deep, so an editor that sees only the
// public parts of `ai` can save them without dropping the rest.
export const SET_CONFIG_MERGES_AI_FIELD = 'setConfigMergesAi';

// Set the same way: this Worker builds debate atlases and accepts
// resultsAdminAddresses, which older Workers refuse.
export const DEBATE_ATLAS_FIELD = 'debateAtlas';

// Set the same way: this Worker builds risk matrices.
export const RISK_MATRIX_FIELD = 'riskMatrix';

// Set the same way: this Worker shows every answer to signed-in members under
// the session_member_full results visibility, which older Workers refuse.
export const MEMBER_RESULTS_FIELD = 'memberResults';

// Set the same way: this Worker answers the Session Agent and accepts its
// `sessionAgent` setting, which older Workers refuse.
export const SESSION_AGENT_READY_FIELD = 'sessionAgentReady';

// Set the same way: this Worker takes one-use codes and group passwords for
// group joins and honours groupMemberCeiling, which older Workers refuse.
export const GROUP_JOIN_CHOICES_FIELD = 'groupJoinChoices';
