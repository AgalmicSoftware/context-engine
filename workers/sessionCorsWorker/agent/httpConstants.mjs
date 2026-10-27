


export const DEFAULT_AGENT_RAW_SKILL_URL =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/workers/sessionCorsWorker/agent/skills/ce-agent-access/SKILL.md';

export const CE_AGENT_ACCESS_SKILL_VERSION = '2026-10-27 (v45)';

export const DEFAULT_SESSION_WRAPPED_RAW_SKILL_URL =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/workers/sessionCorsWorker/agent/skills/ce-session-wrapped/SKILL.md';

export const CE_SESSION_WRAPPED_SKILL_VERSION = '2026-10-27 (session-wrapped-v1.5)';

export const QUESTION_VOTE_KV_PREFIX = 'telegram:mini-app-question-vote:v1:';

export const AGENT_QUESTION_VOTE_DECISION_KV_PREFIX = 'telegram:agent-question-vote-decision:v1:';

export const ANSWER_DRAFT_KV_PREFIX = 'telegram:answer-draft:';

export const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';

export const LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX = 'telegram:lightweight-group-proposal:';

export const ADMIN_METRICS_CACHE_KV_PREFIX = 'telegram:admin-metrics-cache:v1:';

export const ADMIN_METRICS_CACHE_TTL_SECONDS = 60;

export const ADMIN_METRICS_SUBMIT_ENTRY_LIMIT = 100000;

export const RESULT_VIEW_CACHE_KV_PREFIX = 'telegram:result-view-cache:v1:';

export const RESULT_VIEW_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export const RESULT_VIEW_VALUE_MAX_CHARS = 8000;

export const RESULT_VIEW_GENERIC_MAX_ARRAY_ITEMS = 200;

export const RESULT_VIEW_GENERIC_MAX_OBJECT_KEYS = 200;

export const RESULT_VIEW_GENERIC_MAX_DEPTH = 6;

export const RESULT_VIEW_CACHE_MAX_BYTES = 512 * 1024;

export const ADMIN_QUESTIONS_DELETE_MAX_IDS = 50;

export const AGENT_ONBOARDING_QUESTIONS = Object.freeze([
  {
    id: 'preference_tailoring',
    prompt: 'Can I use your Edge profile, interests, and calendar info to surface relevant CE questions?',
  },
  {
    id: 'demographic_link_opt_in',
    prompt:
      'Can I use non-identifying Edge profile fields for research buckets: bio keywords, age bucket, country/region, role, and attendance week?',
  },
  {
    id: 'draft_responses',
    prompt: 'Can your agent draft question responses for you based on your activity and user file?',
  },
  {
    id: 'draft_divergence_research',
    prompt: 'Can CE store privacy-preserving draft-edit metrics for research?',
  },
  {
    id: 'auto_apply_question_votes',
    prompt: 'Can your agent upvote questions it thinks you will find relevant?',
  },
  {
    id: 'edge_daily_digest',
    prompt: 'Want CE questions in your morning or evening Edge brief?',
  },
]);
