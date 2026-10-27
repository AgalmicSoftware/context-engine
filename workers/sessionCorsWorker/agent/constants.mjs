export const SESSION_AGENT_VERSION = 'session-agent-v1';


export const AGENT_EVENT_TYPES = Object.freeze({
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_RECOVERED: 'account_recovered',
});

export const LEGACY_TRANSPORT_LANES = Object.freeze({
  GROUP_LOBBY: 'telegram_group_lobby',
  PRIVATE_ACCOUNT: 'telegram_private_account',
  MINI_APP: 'telegram_mini_app',
});

export const RISK_CEILINGS = Object.freeze({
  READ: 'read',
  DRAFT: 'draft',
  SUBMIT: 'submit',
  SPONSORED: 'sponsored',
  ACCOUNT: 'account',
  ADMIN: 'admin',
});

export const RISK_RANK = Object.freeze({
  [RISK_CEILINGS.READ]: 0,
  [RISK_CEILINGS.DRAFT]: 1,
  [RISK_CEILINGS.SUBMIT]: 2,
  [RISK_CEILINGS.SPONSORED]: 3,
  [RISK_CEILINGS.ACCOUNT]: 4,
  [RISK_CEILINGS.ADMIN]: 5,
});

export const AGENT_ACTIONS = Object.freeze({
  SUBMIT_RESPONSE: 'submit_response',
  DIRECT_SUBMIT_RESPONSE: 'direct_submit_response',
});

export const ACCOUNT_MODES = Object.freeze({
  MANAGED_SESSION: 'managed_session',
});

export const QUESTION_TYPES = Object.freeze({
  FREEFORM: 'freeform',
  AGREE_UNSURE_DISAGREE: 'agree_unsure_disagree',
  RATING: 'rating',
  MULTICHOICE: 'multichoice',
  QUADRATIC: 'quadratic',
});

export const DEFAULT_RATING_SCALE = Object.freeze({
  min: 0,
  max: 10,
  step: 1,
});
