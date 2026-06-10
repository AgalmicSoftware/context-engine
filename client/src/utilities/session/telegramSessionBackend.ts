import {
  buildTelegramPolisDataset,
  fetchTelegramAgentQuestions,
  fetchTelegramAgentResults,
  isTelegramAgentAuthFailure,
  normalizeTelegramBucketCards,
  type TelegramAgentQuestion,
  type TelegramAgentQuestionsResult,
  type TelegramAgentResultsResult,
  type TelegramBucketCard,
} from './telegramAgentData';
import { getTelegramAgentBridgeCredentials } from '../worker/workerAuth.js';

type UnknownRecord = Record<string, unknown>;

export type TelegramAnswerInput = {
  value?: unknown;
  values?: unknown[];
  text?: unknown;
  comments?: unknown;
};

export type TelegramSubmitAnswerResult = {
  ok: boolean;
  status?: number;
  reason?: string;
  submittedCount?: number;
  reviewRequired?: boolean;
  body?: UnknownRecord;
};

export type TelegramResultsDataset = TelegramAgentResultsResult & {
  polisDataset: ReturnType<typeof buildTelegramPolisDataset>;
  approximate: boolean;
};

const toRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const toStr = (value: unknown): string => String(value ?? '').trim();

const normalizeAnswerValue = (value: unknown): string => {
  const raw = toStr(value);
  const lower = raw.toLowerCase();
  if (lower === 'yes' || lower === 'true') return 'agree';
  if (lower === 'no' || lower === 'false') return 'disagree';
  if (lower === 'maybe' || lower === 'unknown' || lower === 'depends') return 'unsure';
  return lower || raw;
};

export const buildTelegramPreferenceAnswer = (
  question: TelegramAgentQuestion,
  answer: TelegramAnswerInput | string | number | string[]
): UnknownRecord => {
  const source = Array.isArray(answer)
    ? { values: answer }
    : (answer && typeof answer === 'object' ? answer as TelegramAnswerInput : { value: answer });
  const questionType = toStr(question.questionType || 'freeform').toLowerCase();
  const comments = toStr(source.comments);
  if (questionType === 'binary') {
    return { questionType: 'binary', value: normalizeAnswerValue(source.value), comments };
  }
  if (questionType === 'rating') {
    return { questionType: 'rating', value: Number(source.value), comments };
  }
  if (questionType === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(toStr).filter(Boolean)
      : [source.value].map(toStr).filter(Boolean);
    return { questionType: 'multichoice', values, comments };
  }
  return { questionType: 'freeform', text: toStr(source.text || source.value), comments };
};

export const loadTelegramQuestions = async (args: Parameters<typeof fetchTelegramAgentQuestions>[0] = {}): Promise<TelegramAgentQuestionsResult> => (
  fetchTelegramAgentQuestions(args)
);

export const loadTelegramResultsDataset = async (
  args: Parameters<typeof fetchTelegramAgentResults>[0] = {}
): Promise<TelegramResultsDataset> => {
  const result = await fetchTelegramAgentResults(args);
  const polisDataset = buildTelegramPolisDataset(result.views || {});
  return {
    ...result,
    polisDataset,
    approximate: polisDataset.synthesized === true,
  };
};

export const loadTelegramBucketCards = (buckets: unknown): TelegramBucketCard[] => (
  normalizeTelegramBucketCards(buckets)
);

export const submitTelegramAnswer = async ({
  sessionSlug,
  agentBridgeUrl,
  question,
  answer,
  fetchImpl = fetch,
}: {
  sessionSlug?: unknown;
  agentBridgeUrl?: unknown;
  question: TelegramAgentQuestion;
  answer: TelegramAnswerInput | string | number | string[];
  fetchImpl?: typeof fetch;
}): Promise<TelegramSubmitAnswerResult> => {
  const credentials = getTelegramAgentBridgeCredentials({
    slug: toStr(sessionSlug),
    agentBridgeUrl: toStr(agentBridgeUrl) || undefined,
  });
  if (!credentials?.token || !credentials?.agentBridgeUrl) {
    return { ok: false, status: 0, reason: 'telegram_agent_credentials_missing' };
  }
  const questionId = toStr(question.questionId);
  if (!questionId) return { ok: false, status: 0, reason: 'telegram_question_id_missing' };

  const url = `${credentials.agentBridgeUrl.replace(/\/+$/g, '')}/telegram/agent/api/preferences`;
  const payload = {
    sessionSlug: credentials.sessionSlug || toStr(sessionSlug),
    preferences: [{
      questionId,
      answer: buildTelegramPreferenceAnswer(question, answer),
    }],
    submit: true,
    humanApproved: true,
  };

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
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
        reason: toStr(body.reason) || `telegram_answer_submit_failed_${response.status}`,
        body,
      };
    }
    return {
      ok: Number(body.submittedCount || 0) > 0,
      status: response.status,
      submittedCount: Number(body.submittedCount || 0),
      reviewRequired: body.reviewRequired === true,
      reason: Number(body.submittedCount || 0) > 0 ? '' : 'telegram_answer_not_submitted',
      body,
    };
  } catch (_) {
    return { ok: false, status: 0, reason: 'telegram_answer_submit_network_error' };
  }
};

export { isTelegramAgentAuthFailure };
