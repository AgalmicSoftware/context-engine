/**
 * @file telegramAgentData.ts — browser fetchers for telegram/cloudflare-backed
 * session data (questions + aggregate results) from the agent bridge worker.
 * Used only by the telegram-only session panels; normal on-chain sessions never
 * call these. Reads the stored ceagt_ delegation token silently via
 * getTelegramAgentBridgeCredentials — the token must never be rendered/logged.
 */
import { getTelegramAgentBridgeCredentials } from '../worker/workerAuth.js';

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const toStr = (value: unknown): string => String(value ?? '').trim();
const toNum = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const TELEGRAM_AGENT_AUTH_REASONS = [
  'agent_token_not_found',
  'refresh_user_agent_token',
  'agent_token_scope_denied',
  'agent_token_required',
];

export const isTelegramAgentAuthFailure = ({ status, reason }: { status?: number; reason?: string } = {}): boolean => (
  Number(status) === 401 ||
  TELEGRAM_AGENT_AUTH_REASONS.some((marker) => toStr(reason).includes(marker))
);

export type TelegramAgentQuestion = {
  questionId: string;
  questionType: string;
  prompt: string;
  options: string[];
  tags: string[];
  answeredByUser: boolean;
  answerable: boolean;
};

export const normalizeTelegramAgentQuestion = (input: unknown): TelegramAgentQuestion => {
  const question = toRecord(input);
  return {
    questionId: toStr(question.questionId || question.id),
    questionType: toStr(question.questionType || question.type) || 'freeform',
    prompt: toStr(question.prompt || question.questionText),
    options: (Array.isArray(question.options) ? question.options : []).map(toStr).filter(Boolean),
    tags: (Array.isArray(question.tags) ? question.tags : []).map(toStr).filter(Boolean).slice(0, 8),
    answeredByUser: question.answeredByUser === true,
    answerable: question.answerable !== false,
  };
};

const resolveCredentials = ({ sessionSlug, agentBridgeUrl }: { sessionSlug?: unknown; agentBridgeUrl?: unknown }) => (
  getTelegramAgentBridgeCredentials({
    slug: toStr(sessionSlug),
    agentBridgeUrl: toStr(agentBridgeUrl) || undefined,
  })
);

export type TelegramAgentQuestionsResult = {
  ok: boolean;
  status?: number;
  reason?: string;
  questions?: TelegramAgentQuestion[];
  answerState?: { answeredCount: number; unansweredCount: number; sort: string };
};

export const fetchTelegramAgentQuestions = async ({
  sessionSlug,
  agentBridgeUrl,
  limit = 30,
  fetchImpl = fetch,
}: {
  sessionSlug?: unknown;
  agentBridgeUrl?: unknown;
  limit?: number;
  fetchImpl?: typeof fetch;
} = {}): Promise<TelegramAgentQuestionsResult> => {
  const credentials = resolveCredentials({ sessionSlug, agentBridgeUrl });
  if (!credentials?.token || !credentials?.agentBridgeUrl) {
    return { ok: false, status: 0, reason: 'telegram_agent_credentials_missing' };
  }
  const url = new URL(`${credentials.agentBridgeUrl}/telegram/agent/api/questions`);
  url.searchParams.set('sessionSlug', credentials.sessionSlug || toStr(sessionSlug));
  if (Number(limit) > 0) url.searchParams.set('limit', String(Number(limit)));
  try {
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${credentials.token}` },
      cache: 'no-store',
    });
    const body = toRecord(await response.json().catch(() => ({})));
    if (!response.ok || body.ok !== true) {
      return {
        ok: false,
        status: response.status,
        reason: toStr(body.reason) || `telegram_questions_failed_${response.status}`,
      };
    }
    const answerState = toRecord(body.answerState);
    return {
      ok: true,
      questions: (Array.isArray(body.questions) ? body.questions : [])
        .map(normalizeTelegramAgentQuestion)
        // Locked/encrypted questions arrive with empty prompts — drop them.
        .filter((question) => question.prompt),
      answerState: {
        answeredCount: toNum(answerState.answeredCount),
        unansweredCount: toNum(answerState.unansweredCount),
        sort: toStr(answerState.sort),
      },
    };
  } catch (_) {
    return { ok: false, status: 0, reason: 'telegram_questions_network_error' };
  }
};

export type TelegramAgentResultViewState = {
  status: 'ready' | 'disabled' | 'error' | 'auth';
  reason?: string;
  data?: UnknownRecord;
};

export type TelegramAgentResultsResult = {
  ok: boolean;
  status?: number;
  reason?: string;
  views?: {
    consensus: TelegramAgentResultViewState;
    difference: TelegramAgentResultViewState;
    groups: TelegramAgentResultViewState;
    topicMap: TelegramAgentResultViewState;
  };
};

const normalizeAggregateRows = (body: UnknownRecord): UnknownRecord => ({
  questionCount: toNum(body.questionCount),
  responseCount: toNum(body.responseCount),
  questions: (Array.isArray(body.questions) ? body.questions : [])
    .map((row) => {
      const record = toRecord(row);
      return {
        prompt: toStr(record.prompt),
        total: toNum(record.total),
        participants: toNum(record.participants),
        agreementScore: toNum(record.agreementScore),
        differenceScore: toNum(record.differenceScore),
        counts: (Array.isArray(record.counts) ? record.counts : []).map((entry) => {
          const item = toRecord(entry);
          return { label: toStr(item.label), count: toNum(item.count) };
        }),
      };
    })
    .filter((row) => row.prompt),
});

const normalizeGroups = (body: UnknownRecord): UnknownRecord => ({
  groupCount: toNum(body.groupCount),
  suppressedGroupCount: toNum(body.suppressedGroupCount),
  participantCount: toNum(body.participantCount),
  questionCount: toNum(body.questionCount),
  minGroupSize: toNum(body.minGroupSize),
  groups: (Array.isArray(body.groups) ? body.groups : []).map((group) => {
    const record = toRecord(group);
    return {
      groupId: toStr(record.groupId),
      label: toStr(record.label),
      theme: toStr(record.theme),
      size: toNum(record.size),
      averageScore: toNum(record.averageScore),
      topStatements: (Array.isArray(record.topStatements) ? record.topStatements : [])
        .map((statement) => {
          const item = toRecord(statement);
          return { prompt: toStr(item.prompt), differenceScore: toNum(item.differenceScore) };
        })
        .filter((statement) => statement.prompt)
        .slice(0, 5),
    };
  }),
});

const normalizeTopicMap = (body: UnknownRecord): UnknownRecord => {
  const counts = toRecord(body.counts);
  const numericCounts: Record<string, number> = {};
  Object.entries(counts).forEach(([key, value]) => {
    const num = Number(value);
    if (Number.isFinite(num)) numericCounts[key] = num;
  });
  return {
    available: body.available === true,
    unavailableReason: toStr(body.unavailableReason),
    counts: numericCounts,
  };
};

const TELEGRAM_RESULT_VIEW_REQUESTS: Array<{ key: 'consensus' | 'difference' | 'groups' | 'topicMap'; view: string }> = [
  { key: 'consensus', view: 'consensus' },
  { key: 'difference', view: 'difference' },
  { key: 'groups', view: 'groups' },
  { key: 'topicMap', view: 'topic-map' },
];

export const fetchTelegramAgentResults = async ({
  sessionSlug,
  agentBridgeUrl,
  fetchImpl = fetch,
}: {
  sessionSlug?: unknown;
  agentBridgeUrl?: unknown;
  fetchImpl?: typeof fetch;
} = {}): Promise<TelegramAgentResultsResult> => {
  const credentials = resolveCredentials({ sessionSlug, agentBridgeUrl });
  if (!credentials?.token || !credentials?.agentBridgeUrl) {
    return { ok: false, status: 0, reason: 'telegram_agent_credentials_missing' };
  }
  const fetchView = async ({ key, view }: { key: string; view: string }): Promise<TelegramAgentResultViewState> => {
    const url = new URL(`${credentials.agentBridgeUrl}/telegram/agent/api/results`);
    url.searchParams.set('sessionSlug', credentials.sessionSlug || toStr(sessionSlug));
    url.searchParams.set('view', view);
    try {
      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${credentials.token}` },
        cache: 'no-store',
      });
      const body = toRecord(await response.json().catch(() => ({})));
      if (response.ok && body.ok === true) {
        if (key === 'groups') return { status: 'ready', data: normalizeGroups(body) };
        if (key === 'topicMap') return { status: 'ready', data: normalizeTopicMap(body) };
        return { status: 'ready', data: normalizeAggregateRows(body) };
      }
      const reason = toStr(body.reason) || `telegram_results_failed_${response.status}`;
      if (isTelegramAgentAuthFailure({ status: response.status, reason })) {
        return { status: 'auth', reason };
      }
      if (response.status === 403) {
        return { status: 'disabled', reason };
      }
      return { status: 'error', reason };
    } catch (_) {
      return { status: 'error', reason: 'telegram_results_network_error' };
    }
  };
  const [consensus, difference, groups, topicMap] = await Promise.all(
    TELEGRAM_RESULT_VIEW_REQUESTS.map(fetchView)
  );
  return { ok: true, views: { consensus, difference, groups, topicMap } };
};

export type TelegramBucketCard = {
  categoryId: string;
  categoryLabel: string;
  options: Array<{ optionId: string; label: string; selected: boolean }>;
};

// Buckets arrive with the client-login exchange payload (telegramClientAuth.buckets);
// no network call is needed to render them.
export const normalizeTelegramBucketCards = (buckets: unknown): TelegramBucketCard[] => {
  const record = toRecord(buckets);
  const selections = toRecord(record.selections);
  const categories = Array.isArray(record.categories) ? record.categories : [];
  return categories
    .map((category) => {
      const cat = toRecord(category);
      const categoryId = toStr(cat.categoryId || cat.id);
      const selectedIds = new Set(
        (Array.isArray(selections[categoryId]) ? selections[categoryId] as unknown[] : []).map(toStr)
      );
      return {
        categoryId,
        categoryLabel: toStr(cat.label) || categoryId,
        options: (Array.isArray(cat.options) ? cat.options : [])
          .map((option) => {
            const opt = toRecord(option);
            const optionId = toStr(opt.optionId || opt.id);
            return {
              optionId,
              label: toStr(opt.label) || optionId,
              selected: selectedIds.has(optionId),
            };
          })
          .filter((option) => option.optionId),
      };
    })
    .filter((card) => card.categoryId && card.options.length > 0);
};
