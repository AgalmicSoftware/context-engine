export const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:8000/v1';
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_REPEATS = 10;
export const DEFAULT_IMPORTANCE_BUDGET = 100;
export const DEFAULT_IMPORTANCE_REPEATS = 1;
export const DEFAULT_CONCURRENCY = 1;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
export const DEFAULT_RETRY_BASE_DELAY_MS = 750;
export const HARNESS_VERSION = '0.5.0';
export const QUESTION_PROMPT_TEMPLATE_VERSION = 'aidb-question-v4';
export const IMPORTANCE_PROMPT_TEMPLATE_VERSION = 'aidb-importance-v1';

export const ANSWER_VALUES = Object.freeze(['Agree', 'Unsure', 'Disagree']);

export const ANSWER_SCORE = Object.freeze({
  Agree: 1,
  Unsure: 0,
  Disagree: -1,
});

export const REVERSED_ANSWER = Object.freeze({
  Agree: 'Disagree',
  Unsure: 'Unsure',
  Disagree: 'Agree',
});

export const PROVIDERS = Object.freeze(['mock', 'local', 'openrouter']);

export const DEFAULT_OUTPUT_SCHEMA_VERSION = 1;
