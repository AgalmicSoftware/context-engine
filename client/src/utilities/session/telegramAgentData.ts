import type { AgentClientLoginEnvelope } from './agentClientLogin';
import { buildAgentClientAuthHeaders } from './agentClientLogin';

type UnknownRecord = Record<string, unknown>;
export type TelegramPolisRow = { responder: string; questionId: string; response: string };
export type TelegramPolisAggregator = Record<string, TelegramPolisRow[]>;
export type TelegramPolisDataset = {
  participantCount: number;
  questionCount: number;
  responseCount: number;
  aggregator: TelegramPolisAggregator;
  hasData: boolean;
  synthesized: boolean;
};

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

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
  'agent_api_token_invalid',
  'session_worker_token_expired',
];

export const isTelegramAgentAuthFailure = ({ status, reason }: { status?: number; reason?: string } = {}): boolean =>
  Number(status) === 401 || TELEGRAM_AGENT_AUTH_REASONS.some((marker) => toStr(reason).includes(marker));

export type TelegramAgentQuestion = {
  questionId: string;
  id: string;
  questionType: string;
  type: string;
  prompt: string;
  questionText: string;
  options: string[];
  tags: string[];
  answeredByUser: boolean;
  answerable: boolean;
};

export const normalizeTelegramAgentQuestion = (input: unknown): TelegramAgentQuestion => {
  const question = toRecord(input);
  const questionId = toStr(question.questionId || question.id);
  const questionType = toStr(question.questionType || question.type) || 'freeform';
  const prompt = toStr(question.prompt || question.questionText || question.title);
  return {
    questionId,
    id: questionId,
    questionType,
    type: questionType,
    prompt,
    questionText: prompt,
    options: (Array.isArray(question.options) ? question.options : []).map(toStr).filter(Boolean),
    tags: (Array.isArray(question.tags) ? question.tags : []).map(toStr).filter(Boolean).slice(0, 8),
    answeredByUser: question.answeredByUser === true,
    answerable: question.answerable !== false,
  };
};

export type TelegramAgentQuestionsResult = {
  ok: boolean;
  status?: number;
  reason?: string;
  questions?: TelegramAgentQuestion[];
  answerState?: { answeredCount: number; unansweredCount: number; sort: string };
};

const resolveAgentBridgeUrl = (envelope: AgentClientLoginEnvelope | null, agentBridgeUrl?: unknown): string =>
  toStr(agentBridgeUrl || envelope?.agentBridgeUrl).replace(/\/+$/g, '');

export const fetchTelegramAgentQuestions = async ({
  envelope,
  sessionSlug,
  agentBridgeUrl,
  limit = 30,
  fetchImpl = fetch,
}: {
  envelope: AgentClientLoginEnvelope | null;
  sessionSlug?: unknown;
  agentBridgeUrl?: unknown;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<TelegramAgentQuestionsResult> => {
  const base = resolveAgentBridgeUrl(envelope, agentBridgeUrl);
  if (!envelope?.credential?.token || !base) {
    return { ok: false, status: 0, reason: 'telegram_agent_credentials_missing' };
  }
  const url = new URL(`${base}/api/agent/questions`);
  url.searchParams.set('sessionSlug', toStr(envelope.sessionSlug || sessionSlug));
  if (Number(limit) > 0) url.searchParams.set('limit', String(Number(limit)));
  try {
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: buildAgentClientAuthHeaders(envelope),
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
    polis: TelegramAgentResultViewState;
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
        questionId: toStr(record.questionId || record.id),
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
          return {
            label: toStr(item.label),
            prompt: toStr(item.prompt),
            cluster: toRecord(item.cluster),
            overall: toRecord(item.overall),
            differenceScore: toNum(item.differenceScore),
          };
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

const POLIS_BINARY_VALUES = new Set(['Agree', 'Disagree', 'Unsure']);
const POLIS_BINARY_KEYS: Array<'agree' | 'disagree' | 'unsure'> = ['agree', 'disagree', 'unsure'];
const POLIS_LABEL_TO_VALUE: Record<string, 'Agree' | 'Disagree' | 'Unsure'> = {
  agree: 'Agree',
  disagree: 'Disagree',
  unsure: 'Unsure',
};

const emptyPolisDataset = (synthesized = false): TelegramPolisDataset => ({
  participantCount: 0,
  questionCount: 0,
  responseCount: 0,
  aggregator: {},
  hasData: false,
  synthesized,
});

const normalizeBinaryValue = (value: unknown): 'Agree' | 'Disagree' | 'Unsure' | '' => {
  const raw = toStr(value);
  if (POLIS_BINARY_VALUES.has(raw)) return raw as 'Agree' | 'Disagree' | 'Unsure';
  return POLIS_LABEL_TO_VALUE[raw.toLowerCase()] || '';
};

const buildPolisResponse = (prompt: string, value: 'Agree' | 'Disagree' | 'Unsure') =>
  JSON.stringify({ type: 'binary', prompt, answer: { value } });

const appendPolisVote = (
  aggregator: TelegramPolisAggregator,
  questionId: string,
  prompt: string,
  responder: string,
  value: 'Agree' | 'Disagree' | 'Unsure',
) => {
  if (!questionId || !prompt || !responder || !value) return;
  if (!aggregator[questionId]) aggregator[questionId] = [];
  aggregator[questionId].push({ responder, questionId, response: buildPolisResponse(prompt, value) });
};

const normalizePromptKey = (value: unknown): string => toStr(value).replace(/\s+/g, ' ').toLowerCase();

const aggregateRowsFromViews = (views: UnknownRecord) => {
  const rowsByQuestionId = new Map<string, UnknownRecord>();
  const rowsByPrompt = new Map<string, UnknownRecord>();
  ['consensus', 'difference'].forEach((viewKey) => {
    const view = toRecord(views[viewKey]);
    if (view.status !== 'ready') return;
    const data = toRecord(view.data);
    (Array.isArray(data.questions) ? data.questions : []).forEach((row) => {
      const record = toRecord(row);
      const questionId = toStr(record.questionId || record.id);
      const prompt = toStr(record.prompt);
      if (!prompt) return;
      const existingByPrompt = rowsByPrompt.get(normalizePromptKey(prompt));
      const normalized = { ...record, questionId: questionId || toStr(existingByPrompt?.questionId), prompt };
      if (questionId && !rowsByQuestionId.has(questionId)) rowsByQuestionId.set(questionId, normalized);
      if (!existingByPrompt || (!toStr(existingByPrompt.questionId) && toStr(normalized.questionId))) {
        rowsByPrompt.set(normalizePromptKey(prompt), normalized);
      }
    });
  });
  return {
    rows: Array.from(rowsByQuestionId.values()).concat(
      Array.from(rowsByPrompt.values()).filter((row) => !toStr(row.questionId)),
    ),
    rowsByPrompt,
  };
};

const binaryCountsFromAggregateRow = (row: UnknownRecord): Record<'Agree' | 'Disagree' | 'Unsure', number> | null => {
  const counts: Record<'Agree' | 'Disagree' | 'Unsure', number> = { Agree: 0, Disagree: 0, Unsure: 0 };
  let total = 0;
  let sawRecognized = false;
  let sawUnrecognizedPositive = false;
  (Array.isArray(row.counts) ? row.counts : []).forEach((entry) => {
    const item = toRecord(entry);
    const value = normalizeBinaryValue(item.label);
    const count = Math.max(0, Math.floor(toNum(item.count)));
    if (!value) {
      if (count > 0) sawUnrecognizedPositive = true;
      return;
    }
    sawRecognized = true;
    counts[value] += count;
    total += count;
  });
  if (!sawRecognized || sawUnrecognizedPositive || total <= 0) return null;
  return counts;
};

const voteCountsFromCluster = (cluster: UnknownRecord, groupSize: number) => {
  const counts = {
    Agree: Math.max(0, Math.floor(toNum(cluster.agree))),
    Disagree: Math.max(0, Math.floor(toNum(cluster.disagree))),
    Unsure: Math.max(0, Math.floor(toNum(cluster.unsure))),
  };
  const responded = Math.max(0, Math.floor(toNum(cluster.responded)));
  const explicitTotal = counts.Agree + counts.Disagree + counts.Unsure;
  if (responded > explicitTotal) counts.Unsure += responded - explicitTotal;
  const overage = Math.max(0, counts.Agree + counts.Disagree + counts.Unsure - groupSize);
  if (overage > 0) counts.Unsure = Math.max(0, counts.Unsure - overage);
  return counts;
};

const summarizePolisAggregator = (
  aggregator: TelegramPolisAggregator,
  participantFallback = 0,
  synthesized = true,
): TelegramPolisDataset => {
  const responders = new Set<string>();
  let responseCount = 0;
  Object.values(aggregator).forEach((rows) => {
    rows.forEach((row) => {
      responders.add(row.responder);
      responseCount += 1;
    });
  });
  return {
    participantCount: Math.max(participantFallback, responders.size),
    questionCount: Object.keys(aggregator).length,
    responseCount,
    aggregator,
    hasData: responseCount > 0,
    synthesized,
  };
};

const normalizePolisDataset = (body: UnknownRecord): UnknownRecord => {
  const promptByQuestionId = new Map<string, string>();
  (Array.isArray(body.questions) ? body.questions : []).forEach((question) => {
    const record = toRecord(question);
    const questionId = toStr(record.questionId);
    const prompt = toStr(record.prompt);
    if (questionId && prompt) promptByQuestionId.set(questionId, prompt);
  });
  const aggregator: TelegramPolisAggregator = {};
  Object.entries(toRecord(body.responses)).forEach(([questionId, rows]) => {
    const prompt = promptByQuestionId.get(questionId);
    if (!prompt) return;
    const normalizedRows = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const record = toRecord(row);
        const responder = toStr(record.responder);
        const value = toStr(record.value);
        if (!responder || !POLIS_BINARY_VALUES.has(value)) return null;
        return {
          responder,
          questionId,
          response: buildPolisResponse(prompt, value as 'Agree' | 'Disagree' | 'Unsure'),
        };
      })
      .filter(Boolean) as TelegramPolisRow[];
    if (normalizedRows.length > 0) aggregator[questionId] = normalizedRows;
  });
  return {
    participantCount: toNum(body.participantCount),
    questionCount: toNum(body.questionCount),
    responseCount: toNum(body.responseCount),
    aggregator,
    hasData: Object.keys(aggregator).length > 0,
  };
};

export const buildTelegramPolisDataset = (viewsInput: unknown): TelegramPolisDataset => {
  const views = toRecord(viewsInput);
  const polisView = toRecord(views.polis);
  const polisData = toRecord(polisView.data);
  if (
    polisView.status === 'ready' &&
    polisData.hasData === true &&
    Object.keys(toRecord(polisData.aggregator)).length > 0
  ) {
    return {
      participantCount: toNum(polisData.participantCount),
      questionCount: toNum(polisData.questionCount),
      responseCount: toNum(polisData.responseCount),
      aggregator: toRecord(polisData.aggregator) as TelegramPolisAggregator,
      hasData: true,
      synthesized: false,
    };
  }

  const { rows, rowsByPrompt } = aggregateRowsFromViews(views);
  const groupsView = toRecord(views.groups);
  const groupsData = toRecord(groupsView.data);
  const groups = groupsView.status === 'ready' && Array.isArray(groupsData.groups) ? groupsData.groups : [];
  if (groups.length > 0) {
    const aggregator: TelegramPolisAggregator = {};
    let participantFallback = 0;
    groups.forEach((groupInput, groupIndex) => {
      const group = toRecord(groupInput);
      const groupSize = Math.max(0, Math.floor(toNum(group.size)));
      if (groupSize <= 0) return;
      participantFallback += groupSize;
      const responders = Array.from({ length: groupSize }, (_, index) => `G${groupIndex + 1}-P${index + 1}`);
      (Array.isArray(group.topStatements) ? group.topStatements : []).forEach((statementInput) => {
        const statement = toRecord(statementInput);
        const prompt = toStr(statement.prompt);
        const matchingRow = rowsByPrompt.get(normalizePromptKey(prompt));
        const questionId = toStr(matchingRow?.questionId);
        if (!questionId || !prompt) return;
        const counts = voteCountsFromCluster(toRecord(statement.cluster), groupSize);
        let cursor = 0;
        (
          [
            ['Agree', counts.Agree],
            ['Disagree', counts.Disagree],
            ['Unsure', counts.Unsure],
          ] as Array<['Agree' | 'Disagree' | 'Unsure', number]>
        ).forEach(([value, count]) => {
          const capped = Math.min(count, Math.max(0, groupSize - cursor));
          for (let index = 0; index < capped; index += 1) {
            appendPolisVote(aggregator, questionId, prompt, responders[cursor], value);
            cursor += 1;
          }
        });
      });
    });
    const dataset = summarizePolisAggregator(aggregator, participantFallback, true);
    if (dataset.hasData) return dataset;
  }

  const binaryRows = rows
    .map((row) => ({ row, counts: binaryCountsFromAggregateRow(row) }))
    .filter((item) => item.counts && toStr(item.row.questionId) && toStr(item.row.prompt)) as Array<{
    row: UnknownRecord;
    counts: Record<'Agree' | 'Disagree' | 'Unsure', number>;
  }>;
  if (binaryRows.length === 0) return emptyPolisDataset(true);
  const poolSize = Math.max(0, ...binaryRows.map(({ row }) => Math.max(toNum(row.participants), toNum(row.total))));
  if (poolSize <= 0) return emptyPolisDataset(true);

  const aggregator: TelegramPolisAggregator = {};
  const responders = Array.from({ length: poolSize }, (_, index) => `P${index + 1}`);
  binaryRows.forEach(({ row, counts }, rowIndex) => {
    const questionId = toStr(row.questionId);
    const prompt = toStr(row.prompt);
    let cursor = (rowIndex * 7) % poolSize;
    POLIS_BINARY_KEYS.forEach((key) => {
      const value = key === 'agree' ? 'Agree' : key === 'disagree' ? 'Disagree' : 'Unsure';
      for (let index = 0; index < counts[value]; index += 1) {
        appendPolisVote(aggregator, questionId, prompt, responders[cursor % poolSize], value);
        cursor += 1;
      }
    });
  });
  return summarizePolisAggregator(aggregator, poolSize, true);
};

const TELEGRAM_RESULT_VIEW_REQUESTS: Array<{
  key: 'consensus' | 'difference' | 'groups' | 'topicMap' | 'polis';
  view: string;
}> = [
  { key: 'polis', view: 'polis' },
  { key: 'consensus', view: 'consensus' },
  { key: 'difference', view: 'difference' },
  { key: 'groups', view: 'groups' },
  { key: 'topicMap', view: 'topic-map' },
];

export const fetchTelegramAgentResults = async ({
  envelope,
  sessionSlug,
  agentBridgeUrl,
  fetchImpl = fetch,
}: {
  envelope: AgentClientLoginEnvelope | null;
  sessionSlug?: unknown;
  agentBridgeUrl?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<TelegramAgentResultsResult> => {
  const base = resolveAgentBridgeUrl(envelope, agentBridgeUrl);
  if (!envelope?.credential?.token || !base) {
    return { ok: false, status: 0, reason: 'telegram_agent_credentials_missing' };
  }
  const fetchView = async ({ key, view }: { key: string; view: string }): Promise<TelegramAgentResultViewState> => {
    const url = new URL(`${base}/api/agent/results`);
    url.searchParams.set('sessionSlug', toStr(envelope.sessionSlug || sessionSlug));
    url.searchParams.set('view', view);
    try {
      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: buildAgentClientAuthHeaders(envelope),
        cache: 'no-store',
      });
      const body = toRecord(await response.json().catch(() => ({})));
      if (response.ok && body.ok === true) {
        if (key === 'polis') return { status: 'ready', data: normalizePolisDataset(body) };
        if (key === 'groups') return { status: 'ready', data: normalizeGroups(body) };
        if (key === 'topicMap') return { status: 'ready', data: normalizeTopicMap(body) };
        return { status: 'ready', data: normalizeAggregateRows(body) };
      }
      const reason = toStr(body.reason) || `telegram_results_failed_${response.status}`;
      if (isTelegramAgentAuthFailure({ status: response.status, reason })) return { status: 'auth', reason };
      if (response.status === 403) return { status: 'disabled', reason };
      return { status: 'error', reason };
    } catch (_) {
      return { status: 'error', reason: 'telegram_results_network_error' };
    }
  };
  const [polis, consensus, difference, groups, topicMap] = await Promise.all(
    TELEGRAM_RESULT_VIEW_REQUESTS.map(fetchView),
  );
  return { ok: true, views: { polis, consensus, difference, groups, topicMap } };
};

export type TelegramBucketCard = {
  categoryId: string;
  categoryLabel: string;
  options: Array<{ optionId: string; label: string; selected: boolean }>;
};

export const normalizeTelegramBucketCards = (buckets: unknown): TelegramBucketCard[] => {
  const record = toRecord(buckets);
  const selections = toRecord(record.selections);
  const categories = Array.isArray(record.categories) ? record.categories : [];
  return categories
    .map((category) => {
      const cat = toRecord(category);
      const categoryId = toStr(cat.categoryId || cat.id);
      const selectedIds = new Set(
        (Array.isArray(selections[categoryId]) ? (selections[categoryId] as unknown[]) : []).map(toStr),
      );
      return {
        categoryId,
        categoryLabel: toStr(cat.label) || categoryId,
        options: (Array.isArray(cat.options) ? cat.options : [])
          .map((option) => {
            const opt = toRecord(option);
            const optionId = toStr(opt.optionId || opt.id);
            return { optionId, label: toStr(opt.label) || optionId, selected: selectedIds.has(optionId) };
          })
          .filter((option) => option.optionId),
      };
    })
    .filter((card) => card.categoryId && card.options.length > 0);
};
