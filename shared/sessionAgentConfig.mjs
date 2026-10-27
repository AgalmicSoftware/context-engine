const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const booleanFields = new Set(['managedAccountSubmitAllowed', 'asyncSubmitEnabled', 'sponsoredAiAllowed',
  'sponsoredRpcAllowed', 'sponsoredFaucetAllowed', 'allowQuestionGeneration', 'allowAddQuestion', 'allowGenerateQuestion']);
const fields = new Set([...booleanFields, 'questionAuthoringPermissionMode', 'submitMaxAttempts',
  'submitRetryDelaySeconds', 'wrapped', 'invites', 'riskCeiling']);

export const validSessionAgentConfig = config => {
  if (config.agentHttp === undefined) return true;
  const value = config.agentHttp;
  if (!record(value) || Object.keys(value).some(key => !fields.has(key))) return false;
  for (const key of booleanFields) if (value[key] !== undefined && typeof value[key] !== 'boolean') return false;
  if (value.questionAuthoringPermissionMode !== undefined && !['session_policy', 'disabled'].includes(value.questionAuthoringPermissionMode)) return false;
  if (value.riskCeiling !== undefined && !['read', 'draft', 'sponsored', 'submit', 'account', 'admin'].includes(value.riskCeiling)) return false;
  if (value.submitMaxAttempts !== undefined && (!Number.isSafeInteger(value.submitMaxAttempts) || value.submitMaxAttempts < 1 || value.submitMaxAttempts > 4)) return false;
  if (value.submitRetryDelaySeconds !== undefined && (!Number.isSafeInteger(value.submitRetryDelaySeconds) || value.submitRetryDelaySeconds < 1 || value.submitRetryDelaySeconds > 300)) return false;
  if (value.wrapped !== undefined && (!record(value.wrapped) || Object.keys(value.wrapped).some(key => !['posterEnabled', 'posterRenderer'].includes(key)) ||
      value.wrapped.posterEnabled !== undefined && typeof value.wrapped.posterEnabled !== 'boolean' ||
      value.wrapped.posterRenderer !== undefined && !['local', 'openai'].includes(value.wrapped.posterRenderer))) return false;
  if (value.invites !== undefined && (!Array.isArray(value.invites) || value.invites.length > 100 || value.invites.some(invite =>
    !record(invite) || Object.keys(invite).some(key => !['tokenHash', 'enabled', 'label', 'source'].includes(key)) ||
    !/^[a-f0-9]{64}$/.test(invite.tokenHash || '') || invite.enabled !== undefined && typeof invite.enabled !== 'boolean' ||
    ['label', 'source'].some(key => invite[key] !== undefined && (typeof invite[key] !== 'string' || invite[key].length > 160))))) return false;
  return true;
};

export const projectPublicAgentConfig = value => {
  if (!record(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'invites' && fields.has(key)));
};
