import { validateQuadraticAllocation } from '../../../../shared/questions/quadraticAllocation.mjs';
import type { AgentClientLoginEnvelope } from './agentClientLogin';
import { buildAgentBridgeAuthHeaders } from './agentClientLogin';
import {
  buildAgentPolisDataset,
  fetchAgentQuestions,
  fetchAgentResults,
  isAgentAuthFailure,
  normalizeAgentBucketCards,
  type AgentQuestion,
  type AgentQuestionsResult,
  type AgentResultsResult,
  type AgentBucketCard,
  type AgentPolisDataset,
} from './agentSessionData';
import type { AgentSessionMeta } from './sessionBackendKind';

type UnknownRecord = Record<string, unknown>;

export type AgentAnswerInput = {
  value?: unknown;
  values?: unknown[];
  text?: unknown;
  comments?: unknown;
};

export type AgentSubmitAnswerResult = {
  ok: boolean;
  status?: number;
  reason?: string;
  submittedCount?: number;
  reviewRequired?: boolean;
  body?: UnknownRecord;
};

export type AgentResultsDataset = AgentResultsResult & {
  polisDataset: AgentPolisDataset;
  approximate: boolean;
};

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toStr = (value: unknown): string => String(value ?? '').trim();

const normalizeAnswerValue = (value: unknown): string => {
  const raw = toStr(value);
  const lower = raw.toLowerCase();
  if (lower === 'yes' || lower === 'true') return 'agree';
  if (lower === 'no' || lower === 'false') return 'disagree';
  if (lower === 'maybe' || lower === 'unknown' || lower === 'depends') return 'unsure';
  return lower || raw;
};

const resolveAgentBridgeUrl = (envelope: AgentClientLoginEnvelope | null, agentBridgeUrl?: unknown): string =>
  toStr(agentBridgeUrl || envelope?.agentBridgeUrl).replace(/\/+$/g, '');

export const buildAgentPreferenceAnswer = (
  question: AgentQuestion,
  answer: AgentAnswerInput | string | number | string[],
): UnknownRecord => {
  const source = Array.isArray(answer)
    ? { values: answer }
    : answer && typeof answer === 'object'
      ? (answer as AgentAnswerInput)
      : { value: answer };
  const questionType = toStr(question.questionType || 'freeform').toLowerCase();
  const comments = toStr(source.comments);
  if (questionType === 'binary') return { questionType: 'binary', value: normalizeAnswerValue(source.value), comments };
  if (questionType === 'rating') return { questionType: 'rating', value: Number(source.value), comments };
  if (questionType === 'quadratic') {
    const value = source.value ?? source.values;
    const error = validateQuadraticAllocation(value, question);
    if (error) throw new Error(error);
    return { questionType, value, comments };
  }
  if (questionType === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(toStr).filter(Boolean)
      : [source.value].map(toStr).filter(Boolean);
    return { questionType: 'multichoice', values, comments };
  }
  return { questionType: 'freeform', text: toStr(source.text || source.value), comments };
};

export const envelopeAllowsSubmit = (
  envelope: AgentClientLoginEnvelope | null,
  sessionMeta: AgentSessionMeta | null,
): boolean => envelope?.capabilities?.submitAnswers === true && sessionMeta?.clientSubmitReady === true;

export const loadQuestions = async (args: Parameters<typeof fetchAgentQuestions>[0]): Promise<AgentQuestionsResult> =>
  fetchAgentQuestions(args);

export const loadResultsDataset = async (
  args: Parameters<typeof fetchAgentResults>[0],
): Promise<AgentResultsDataset> => {
  const result = await fetchAgentResults(args);
  const polisDataset = buildAgentPolisDataset(result.views || {});
  return { ...result, polisDataset, approximate: polisDataset.synthesized === true };
};

export const loadGroups = (envelope: AgentClientLoginEnvelope | null): AgentBucketCard[] | null => {
  if (!envelope || envelope.buckets == null) return null;
  return normalizeAgentBucketCards(envelope.buckets);
};

export const submitAnswer = async ({
  envelope,
  agentBridgeUrl,
  question,
  answer,
  fetchImpl = fetch,
}: {
  envelope: AgentClientLoginEnvelope | null;
  agentBridgeUrl?: unknown;
  question: AgentQuestion;
  answer: AgentAnswerInput | string | number | string[];
  fetchImpl?: typeof fetch;
}): Promise<AgentSubmitAnswerResult> => {
  const base = resolveAgentBridgeUrl(envelope, agentBridgeUrl);
  if (!envelope?.bridgeCredential?.token || !base) return { ok: false, status: 0, reason: 'agent_credentials_missing' };
  const questionId = toStr(question.questionId);
  if (!questionId) return { ok: false, status: 0, reason: 'agent_question_id_missing' };
  const url = `${base}/api/agent/preferences`;
  const payload = {
    sessionSlug: envelope.sessionSlug,
    preferences: [
      {
        questionId,
        answer: buildAgentPreferenceAnswer(question, answer),
      },
    ],
    submit: true,
    humanApproved: true,
  };
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        ...buildAgentBridgeAuthHeaders(envelope),
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const body = toRecord(await response.json().catch(() => ({})));
    if (!response.ok || body.ok !== true) {
      return {
        ok: false,
        status: response.status,
        reason: toStr(body.reason) || `agent_answer_submit_failed_${response.status}`,
        body,
      };
    }
    return {
      ok: Number(body.submittedCount || 0) > 0,
      status: response.status,
      submittedCount: Number(body.submittedCount || 0),
      reviewRequired: body.reviewRequired === true,
      reason: Number(body.submittedCount || 0) > 0 ? '' : 'agent_answer_not_submitted',
      body,
    };
  } catch (_) {
    return { ok: false, status: 0, reason: 'agent_answer_submit_network_error' };
  }
};

export { isAgentAuthFailure };
