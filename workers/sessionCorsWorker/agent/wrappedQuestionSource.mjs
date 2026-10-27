import { loadWorkerQuestionsForSession } from './agentSessionRuntime.mjs';
import { safeString } from './runtimePrimitives.mjs';
import { listCachedSessionQuestions } from './sessionQuestions.mjs';
import { listAgentProposedQuestionsForSession } from './agentQuestionProposals.mjs';

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

  return WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION;
}

export async function loadWrappedQuestionSource({
  env = {},
  sessionSlug = '',
  loadedConfig = {},
  readabilityOnly = false,
  loadCanonicalQuestions = async args => await loadWorkerQuestionsForSession(args.env, args.sessionSlug, args) || listCachedSessionQuestions(args),
  loadProposalQuestions = listAgentProposedQuestionsForSession,
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
      source: 'session_agent_proposals',
      questions: (readabilityOnly ? [...byId.values()] : enabledQuestionIds.map((id) => byId.get(id))).filter(question => question && question.answerable !== false && !question.locked && !question.encrypted),
    };
  }

  const canonical = await loadCanonicalQuestions({
    env,
    sessionSlug,
    questionLimit: 200,
  });
  if (canonical?.ok === false || canonical?.complete === false) {
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
  if (!questions.length && !readabilityOnly) {
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
