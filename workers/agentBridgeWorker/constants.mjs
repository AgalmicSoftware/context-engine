export const AGENT_BRIDGE_WORKER_VERSION = 'agent-bridge-worker-private-v1';

export const AGENT_BRIDGE_EVENT_TYPES = Object.freeze({
  GROUP_CARD_POSTED: 'group_card_posted',
  PRIVATE_START_OPENED: 'private_start_opened',
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_RECOVERED: 'account_recovered',
  ACCOUNT_KEY_EXPORTED: 'account_key_exported',
  ACCOUNT_KEY_RECOVERED: 'account_key_recovered',
  QUESTION_LISTED: 'question_listed',
  QUESTION_DELIVERED: 'question_delivered',
  RESPONSE_SUGGESTED: 'response_suggested',
  DRAFT_SAVED: 'draft_saved',
  SUBMIT_REQUESTED: 'submit_requested',
  DIRECT_SUBMITTED: 'direct_submitted',
  SIGNED_ENVELOPE_CREATED: 'signed_envelope_created',
  DOC_LISTED: 'doc_listed',
  DOC_SELECTED: 'doc_selected',
  QUESTION_GENERATION_REQUESTED: 'question_generation_requested',
  SESSION_JOINED: 'session_joined',
  FAILED: 'failed',
});

export const TELEGRAM_CHAT_LANES = Object.freeze({
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

export const TELEGRAM_BRIDGE_ACTIONS = Object.freeze({
  VIEW_QUESTIONS: 'view_questions',
  SELECT_QUESTION: 'select_question',
  START_PRIVATE: 'start_private',
  CREATE_MANAGED_ACCOUNT: 'create_managed_account',
  RECOVER_MANAGED_ACCOUNT: 'recover_managed_account',
  START_ONBOARDING: 'start_onboarding',
  EXPORT_DEMO_KEY: 'export_demo_key',
  RECOVER_DEMO_KEY: 'recover_demo_key',
  SUGGEST_RESPONSE: 'suggest_response',
  DRAFT_RESPONSE: 'draft_response',
  EDIT_RESPONSE: 'edit_response',
  SUBMIT_RESPONSE: 'submit_response',
  DIRECT_SUBMIT_RESPONSE: 'direct_submit_response',
  ADD_QUESTION: 'add_question',
  GENERATE_QUESTION: 'generate_question',
  LIST_DOCS: 'list_docs',
  SELECT_DOCS: 'select_docs',
  USE_DOCS_AS_ANSWER_CONTEXT: 'use_docs_as_answer_context',
  JOIN_SESSION: 'join_session',
  JOIN_SBT: 'join_sbt',
  ADDITIONAL_COMMENTS: 'additional_comments',
  MICROPHONE_INPUT: 'microphone_input',
  DOC_CONTEXT: 'doc_context',
});

export const ACCOUNT_MODES = Object.freeze({
  MANAGED_TELEGRAM_DEMO: 'managed_telegram_demo',
  PASSKEY: 'passkey',
  PORTO: 'porto',
  CE_CC_LOCAL: 'ce_cc_local',
  LINKED_EXTERNAL_WALLET: 'linked_external_wallet',
  PRODUCTION: 'production',
});

export const SUPPORTED_DOC_TYPES = Object.freeze(['md', 'pdf', 'png', 'jpg', 'jpeg', 'webp']);

export const DOC_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  SESSION: 'session',
  SBT_GATED: 'sbt_gated',
});

export const QUESTION_TYPES = Object.freeze({
  FREEFORM: 'freeform',
  AGREE_UNSURE_DISAGREE: 'agree_unsure_disagree',
  RATING: 'rating',
  MULTICHOICE: 'multichoice',
});

export const DEFAULT_RATING_SCALE = Object.freeze({
  min: 0,
  max: 10,
  step: 1,
});

export const SAFE_PUBLIC_TEXT_FIELDS = Object.freeze([
  'questionText',
  'docTitle',
  'answerLabel',
  'aggregateCount',
  'sessionName',
  'sessionSlug',
]);
