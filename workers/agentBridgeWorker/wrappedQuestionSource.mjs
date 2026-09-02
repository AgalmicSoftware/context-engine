import { safeString } from './runtimePrimitives.mjs';
import { listCachedSessionQuestionsForBridge } from './sessionQuestions.mjs';
import { listTelegramProposedQuestionsForSession } from './telegramQuestionProposals.mjs';

export const WRAPPED_QUESTION_SOURCE_MODES = Object.freeze({
  CANONICAL_SESSION: 'canonical_session',
  AGENT_ONLY_PROPOSALS: 'agent_only_proposals',
});

function normalizedMode(value = '') {
  const mode = safeString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['agent_only', 'agent_only_proposal', 'agent_only_proposals', 'historical'].includes(mode)) {
    return WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS;
  }
  if (['canonical', 'canonical_session', 'session', 'session_questions'].includes(mode)) {
    return WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION;
  }
  return '';
}

function questionId(question = {}) {
  return safeString(question.questionId || question.id);
}

export function resolveWrappedQuestionSourceMode(loadedConfig = {}) {
  const config = loadedConfig?.config && typeof loadedConfig.config === 'object'
    ? loadedConfig.config
    : {};
  const explicit = normalizedMode(config.questionSourceMode);
  if (explicit) return explicit;

  // Config records that predate questionSourceMode own the historical Bridge-KV
  // proposal behavior. An absent record is the ordinary Wrapped product and uses
  // the session's canonical question source.
  if (safeString(loadedConfig?.source) === 'kv') {
    return WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS;
  }
  if (Array.isArray(config.enabledQuestionIds) && config.enabledQuestionIds.length > 0) {
    return WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS;
  }
  return WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION;
}

export async function loadWrappedQuestionSource({
  env = {},
  sessionSlug = '',
  loadedConfig = {},
  loadCanonicalQuestions = listCachedSessionQuestionsForBridge,
  loadProposalQuestions = listTelegramProposedQuestionsForSession,
} = {}) {
  const mode = resolveWrappedQuestionSourceMode(loadedConfig);
  if (mode === WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS) {
    const enabledQuestionIds = Array.isArray(loadedConfig?.config?.enabledQuestionIds)
      ? loadedConfig.config.enabledQuestionIds.map(safeString).filter(Boolean)
      : [];
    const proposals = await loadProposalQuestions(env, sessionSlug);
    const byId = new Map((Array.isArray(proposals) ? proposals : [])
      .map((question) => [questionId(question), question])
      .filter(([id]) => id));
    return {
      ok: true,
      mode,
      source: 'bridge_kv_agent_only_proposals',
      questions: enabledQuestionIds.map((id) => byId.get(id)).filter(Boolean),
    };
  }

  const canonical = await loadCanonicalQuestions({
    env,
    sessionSlug,
    questionLimit: 200,
  });
  if (canonical?.ok === false) {
    return {
      ok: false,
      status: 503,
      reason: safeString(canonical.reason) || 'wrapped_canonical_questions_unavailable',
      mode,
      source: 'canonical_session_questions',
      questions: [],
    };
  }
  const questions = Array.isArray(canonical?.questions) ? canonical.questions : [];
  if (!questions.length) {
    return {
      ok: false,
      status: 409,
      reason: 'wrapped_canonical_questions_empty',
      mode,
      source: safeString(canonical?.source) || 'canonical_session_questions',
      questions: [],
    };
  }
  return {
    ok: true,
    mode,
    source: safeString(canonical?.source) || 'canonical_session_questions',
    questions,
  };
}
