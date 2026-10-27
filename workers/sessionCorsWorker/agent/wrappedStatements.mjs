import { safeString, lower, stableJson, sanitizeSessionSlug, sha256Hex } from './runtimePrimitives.mjs';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';
import { loadWrappedQuestionSource } from './wrappedQuestionSource.mjs';
import { DEFAULT_AGENT_ONLY_TOKEN_TTL_SECONDS, normalizeQuestionId } from './wrappedCore.mjs';
import { loadAgentOnlyModeConfig } from './wrappedConfig.mjs';

export function agentOnlyTokenTtlSeconds() { return DEFAULT_AGENT_ONLY_TOKEN_TTL_SECONDS; }

export function normalizeStatementQuestionType(questionType = '') {
  const type = lower(questionType).replace(/_/g, '-');
  if (['binary', 'agree-disagree', 'agree-unsure-disagree', 'agree'].includes(type)) return 'binary';
  if (type === 'rating') return 'rating';
  if (['multichoice', 'multi-choice', 'multiple-choice'].includes(type)) return 'multichoice';
  if (type === 'quadratic') return 'quadratic';
  return 'freeform';
}

export async function statementFromQuestion(question = {}) {
  if (question.answerable === false || question.locked || question.encrypted) return null;
  const questionId = normalizeQuestionId(question.questionId || question.id);
  const text = String(question.prompt || question.questionText || question.title || '');
  if (!questionId || !text.trim()) return null;
  const schema = buildAgentQuestionAnswerSchema(question);
  const statement = {
    statement_id: questionId,
    text,
    question_type: normalizeStatementQuestionType(schema.questionType || question.questionType),
    answer_schema: schema.answerSchema,
  };
  return { ...statement, statement_version: await sha256Hex(stableJson(statement)) };
}

// Reading statements never writes shared research data. Each caller gets the
// current source filtered by their present access; accepted answers retain their
// own immutable statement wording and schema instead of a shared snapshot.
export async function loadWrappedStatements({ env = {}, sessionSlug = '', readabilityOnly = false, questionSourceMode = '' } = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const loaded = await loadAgentOnlyModeConfig({ env, sessionSlug: slug });
  const loadedConfig = questionSourceMode ? { ...loaded, config: { ...loaded.config, questionSourceMode } } : loaded;
  const source = await loadWrappedQuestionSource({ env, sessionSlug: slug, loadedConfig, readabilityOnly });
  if (!source.ok) return source;
  const statements = (await Promise.all(source.questions.map(statementFromQuestion))).filter(Boolean);
  return { ok: true, space: {
    sessionSlug: slug,
    questionSourceMode: source.mode,
    questionSource: source.source,
    statements,
    evalTypesByQuestionId: loaded.config.evalTypesByQuestionId || {},
  } };
}

export function compactStatementAnswerSchema(schema = {}) {
  const source = schema && typeof schema === 'object' && !Array.isArray(schema) ? schema : {};
  const kind = safeString(source.kind);
  const compact = kind ? { kind } : {};
  const compactValue = (value) => String(value ?? '').trim();
  if (Array.isArray(source.values)) compact.values = source.values.map(compactValue).filter(Boolean);
  if (Array.isArray(source.options)) compact.options = source.options.map(compactValue).filter(Boolean);
  const selectionMode = safeString(source.selectionMode || source.selection_mode);
  if (selectionMode) compact.selectionMode = selectionMode;
  for (const key of ['minSelections', 'maxSelections', 'min', 'max', 'step', 'maxChars', 'voiceCredits']) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') compact[key] = source[key];
  }
  return compact;
}

export function compactAgentOnlyStatement(statement = {}, absoluteIndex = 0) {
  return {
    index: absoluteIndex,
    statement_id: safeString(statement.statement_id),
    statement_version: statement.statement_version,
    question_type: normalizeStatementQuestionType(statement.question_type || statement.questionType),
    text: safeString(statement.text),
    answer_schema: compactStatementAnswerSchema(statement.answer_schema),
  };
}

export async function getAgentOnlyStatementsPage({ env = {}, sessionSlug = '', cursor = '', limit = 50, compact = false } = {}) {
  const loaded = await loadWrappedStatements({ env, sessionSlug });
  if (!loaded.ok) return loaded;
  const statements = loaded.space.statements;
  const page = await env.AGENT_SERVICES.paginate(statements, {
    cursor, limit: Math.max(1, Math.min(50, Math.floor(Number(limit)) || 50)),
    fingerprint: await sha256Hex(stableJson(statements)),
  });
  return {
    ok: true,
    statements: page.items.map(statement => compact
      ? compactAgentOnlyStatement(statement, statements.findIndex(q => q.statement_id === statement.statement_id))
      : statement),
    cursor: page.nextCursor,
  };
}
