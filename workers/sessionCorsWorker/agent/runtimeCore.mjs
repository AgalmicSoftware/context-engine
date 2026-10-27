import { safeString } from './runtimePrimitives.mjs';

export const ANSWER_DRAFT_KV_PREFIX = 'telegram:answer-draft:';

export const ANSWER_DRAFT_VIEW_KV_PREFIX = 'telegram:answer-draft-view:';

export const AGENT_SKILL_UPDATE_KV_KEY = 'telegram:agent-skill-update:v1';

export const DEFAULT_GROUP_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

// Every listed row costs a payload read (a subrequest), so a load lists at
// most 10 pages (1,000 rows) and reports itself incomplete beyond that.
export const MAX_WORKER_QUESTION_LIST_PAGES = 10;

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function safeAnswerString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function firstAnswerValue(...values) {
  return values.find((value) => safeAnswerString(value) !== '');
}

export function questionText(question = {}) {
  return safeString(question.questionText || question.prompt || question.title || 'Untitled question');
}

export function questionId(question = {}) {
  return safeString(question.questionId || question.id);
}

export function shortQuestionId(value = '') {
  const text = safeString(value);
  if (/^0x[0-9a-fA-F]{64}$/.test(text)) return `${text.slice(0, 10)}...${text.slice(-6)}`;
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-6)}` : text;
}

export function questionIdSeedPart(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{64}$/.test(text) ? `${text.slice(2, 10)}${text.slice(-6)}` : text;
}

export function shortAddress(value = '') {
  const text = safeString(value);
  return ADDRESS_RE.test(text) ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
}

export const CANONICAL_ANSWER_KINDS = Object.freeze({
  quadratic: 'quadratic',
  quadratic_allocation: 'quadratic',
  binary: 'binary',
  agree_unsure_disagree: 'binary',
  rating: 'rating',
  rating_button: 'rating',
  multichoice: 'multichoice',
  multi_select_toggle: 'multichoice',
  single_select: 'multichoice',
  freeform: 'freeform',
  freeform_text: 'freeform',
});
