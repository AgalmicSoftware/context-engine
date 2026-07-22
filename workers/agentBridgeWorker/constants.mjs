export const AGENT_BRIDGE_WORKER_VERSION = 'agent-bridge-worker-private-v1';
export const AGENT_SESSION_WRAPPED_PROTOCOL_VERSION = 'agent-session-wrapped-v1';

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
  QUESTION_POSED: 'question_posed',
  SESSION_JOINED: 'session_joined',
  SBT_JOIN_REQUESTED: 'sbt_join_requested',
  SBT_JOINED: 'sbt_joined',
  SBT_GROUP_CREATE_REQUESTED: 'sbt_group_create_requested',
  ACCOUNT_VIEWED: 'account_viewed',
  PRIVATE_QUESTION_DECRYPT_REQUESTED: 'private_question_decrypt_requested',
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
  VIEW_RESULTS: 'view_results',
  ABOUT_CONTEXT_ENGINE: 'about_context_engine',
  VIEW_ADMIN_ACTIONS: 'view_admin_actions',
  VIEW_RESULTS_SETTINGS: 'view_results_settings',
  VIEW_QUESTION_QUEUE_SETTINGS: 'view_question_queue_settings',
  TOGGLE_RESULTS_EXPOSURE: 'toggle_results_exposure',
  CREATE_TELEGRAM_GROUP_APPROVAL_LINK: 'create_telegram_group_approval_link',
  APPROVE_TELEGRAM_GROUP: 'approve_telegram_group',
  EXPORT_ALL_RESPONSES: 'export_all_responses',
  MANAGE_RESPONSE_EXPORT_ACCESS: 'manage_response_export_access',
  LIST_SESSIONS: 'list_sessions',
  SELECT_QUESTION: 'select_question',
  POSE_QUESTION: 'pose_question',
  START_MENU: 'start_menu',
  START_PRIVATE: 'start_private',
  AGENT_ACTION_MENU: 'agent_action_menu',
  AGENT_ONBOARDING: 'agent_onboarding',
  VIEW_AGENT_ACTIVITY: 'view_agent_activity',
  CREATE_AGENT_ACCOUNT: 'create_agent_account',
  VIEW_AGENT_SETTINGS: 'view_agent_settings',
  EDIT_AGENT_SETTINGS: 'edit_agent_settings',
  UPDATE_AGENT_SETTINGS: 'update_agent_settings',
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
  VIEW_GROUPS: 'view_groups',
  SET_GROUP_SELECTION: 'set_group_selection',
  GENERATE_QUESTION: 'generate_question',
  SAVE_GENERATED_QUESTION: 'save_generated_question',
  LIST_DOCS: 'list_docs',
  VIEW_DOC_IMAGE: 'view_doc_image',
  SELECT_DOCS: 'select_docs',
  USE_DOCS_AS_ANSWER_CONTEXT: 'use_docs_as_answer_context',
  JOIN_SESSION: 'join_session',
  JOIN_SBT: 'join_sbt',
  VIEW_SBT_DETAILS: 'view_sbt_details',
  JOIN_PUBLIC_SBT: 'join_public_sbt',
  JOIN_PASSWORD_SBT: 'join_password_sbt',
  CREATE_SBT_GROUP: 'create_sbt_group',
  LINK_FULL_CE_ACCOUNT: 'link_full_ce_account',
  RETRY_SESSION_JOIN: 'retry_session_join',
  MY_ACCOUNT: 'my_account',
  CREATE_AGENT_TOKEN: 'create_agent_token',
  VIEW_JOINED_SBTS: 'view_joined_sbts',
  EXPORT_ACCOUNT: 'export_account',
  RESTORE_ACCOUNT: 'restore_account',
  REQUEST_PRIVATE_QUESTION_DECRYPT: 'request_private_question_decrypt',
  READ_PRIVATE_QUESTION: 'read_private_question',
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

export const SUPPORTED_DOC_TYPES = Object.freeze(['md', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'url']);

export const DOC_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  SESSION: 'session',
  SBT_GATED: 'sbt_gated',
});

export const SESSION_STORAGE_PROFILES = Object.freeze({
  ARWEAVE: 'arweave',
  CLOUDFLARE: 'cloudflare',
});

export const QUESTION_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
  SBT_GATED: 'sbt_gated',
  LIT_ENCRYPTED: 'lit_encrypted',
  PAYLOAD_UNAVAILABLE: 'payload_unavailable',
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
