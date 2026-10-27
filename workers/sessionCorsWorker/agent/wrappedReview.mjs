import { formatQuadraticAllocation } from '../../../shared/questions/quadraticAllocation.mjs';
import { safeString, lower } from './runtimePrimitives.mjs';
import { answerScalarString, semanticFingerprintForAgentOnlyAnswer } from './wrappedAnswers.mjs';

export function answerLabelForSchema(answer = {}, schema = {}) {
  if (!answer || typeof answer !== 'object') return '';
  if (schema.kind === 'quadratic') return formatQuadraticAllocation(answer.value, schema.options);
  if (schema.kind === 'multichoice') return (Array.isArray(answer.values) ? answer.values : []).map(safeString).filter(Boolean).join(', ');
  if (schema.kind === 'text') return safeString(answer.text);
  const value = answer.value;
  const text = answerScalarString(value);
  if (lower(text) === 'agree') return 'Agree';
  if (lower(text) === 'disagree') return 'Disagree';
  if (lower(text) === 'unsure') return 'Unsure';
  return text;
}

export async function reviewSemanticFingerprint(review = {}, schema = {}) {
  if (!review || typeof review !== 'object') return '';
  return safeString(review.semanticFingerprint)
    || (review.answer ? await semanticFingerprintForAgentOnlyAnswer(review.answer, schema) : '');
}

export async function reviewStatusForCurrentAgentAnswer({
  entry = {},
} = {}) {
  const kind = safeString(entry?.human?.kind);
  if (!kind) return '';
  if (kind === 'edit') return 'edit';
  if (kind !== 'confirm') return kind;
  const schema = entry?.agent?.statement?.answer_schema || {};
  const agentFingerprint = safeString(entry?.agent?.semanticFingerprint)
    || (entry?.agent?.answer ? await semanticFingerprintForAgentOnlyAnswer(entry.agent.answer, schema) : '');
  const humanFingerprint = await reviewSemanticFingerprint(entry.human, schema);
  return agentFingerprint && humanFingerprint === agentFingerprint ? 'confirm' : 'stale_confirm';
}
