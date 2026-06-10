/** @file telegramAgentData.test.ts */
import {
  buildTelegramPolisDataset,
  fetchTelegramAgentQuestions,
  fetchTelegramAgentResults,
  isTelegramAgentAuthFailure,
  normalizeTelegramAgentQuestion,
  normalizeTelegramBucketCards,
} from './telegramAgentData';
import { getTelegramAgentBridgeCredentials } from '../worker/workerAuth.js';

jest.mock('../worker/workerAuth.js', () => ({
  getTelegramAgentBridgeCredentials: jest.fn(),
}));

const mockedCredentials = getTelegramAgentBridgeCredentials as jest.Mock;

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const errJson = (status: number, body: unknown = {}) => ({ ok: false, status, json: async () => body });

describe('telegramAgentData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCredentials.mockReturnValue({
      token: `ceagt_${'A'.repeat(32)}`,
      agentBridgeUrl: 'https://bridge.example',
      sessionSlug: 'edge',
    });
  });

  it('detects auth failures by status and reason markers', () => {
    expect(isTelegramAgentAuthFailure({ status: 401 })).toBe(true);
    expect(isTelegramAgentAuthFailure({ status: 403, reason: 'agent_token_scope_denied' })).toBe(true);
    expect(isTelegramAgentAuthFailure({ status: 400, reason: 'agent_token_not_found' })).toBe(true);
    expect(isTelegramAgentAuthFailure({ status: 403, reason: 'anonymized_groups_admin_disabled' })).toBe(false);
  });

  it('normalizes questions and drops locked (empty-prompt) entries', () => {
    expect(normalizeTelegramAgentQuestion({
      questionId: 'q1',
      questionType: 'binary',
      prompt: '  Fund the proposal?  ',
      options: ['Yes', 'No', ''],
      tags: ['governance'],
      answeredByUser: true,
    })).toEqual({
      questionId: 'q1',
      questionType: 'binary',
      prompt: 'Fund the proposal?',
      options: ['Yes', 'No'],
      tags: ['governance'],
      answeredByUser: true,
      answerable: true,
    });
  });

  it('fetches questions with the stored token and session slug', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okJson({
      ok: true,
      sessionSlug: 'edge',
      answerState: { answeredCount: 2, unansweredCount: 3, sort: 'unanswered_first' },
      questions: [
        { questionId: 'q1', questionType: 'binary', prompt: 'Visible?' },
        { questionId: 'q2', questionType: 'freeform', prompt: '' },
      ],
    }));

    const result = await fetchTelegramAgentQuestions({ sessionSlug: 'edge', fetchImpl: fetchImpl as never });
    expect(result.ok).toBe(true);
    expect(result.questions).toHaveLength(1);
    expect(result.questions?.[0].prompt).toBe('Visible?');
    expect(result.answerState).toEqual({ answeredCount: 2, unansweredCount: 3, sort: 'unanswered_first' });

    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain('https://bridge.example/telegram/agent/api/questions');
    expect(calledUrl).toContain('sessionSlug=edge');
    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers.Authorization).toContain('Bearer ceagt_');
  });

  it('reports credential and request failures without throwing', async () => {
    mockedCredentials.mockReturnValueOnce(null);
    await expect(fetchTelegramAgentQuestions({ sessionSlug: 'edge' })).resolves.toEqual({
      ok: false,
      status: 0,
      reason: 'telegram_agent_credentials_missing',
    });

    const failingFetch = jest.fn().mockResolvedValue(errJson(401, { ok: false, reason: 'agent_token_not_found' }));
    const failed = await fetchTelegramAgentQuestions({ sessionSlug: 'edge', fetchImpl: failingFetch as never });
    expect(failed.ok).toBe(false);
    expect(failed.status).toBe(401);
    expect(isTelegramAgentAuthFailure(failed)).toBe(true);

    const throwingFetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchTelegramAgentQuestions({ sessionSlug: 'edge', fetchImpl: throwingFetch as never }))
      .resolves.toMatchObject({ ok: false, reason: 'telegram_questions_network_error' });
  });

  it('fetches all result views independently with per-view status', async () => {
    const fetchImpl = jest.fn(async (urlIn: string) => {
      const url = String(urlIn);
      if (url.includes('view=consensus')) {
        return okJson({
          ok: true,
          questionCount: 1,
          responseCount: 4,
          questions: [{ prompt: 'Agree?', total: 4, participants: 4, agreementScore: 0.75, differenceScore: 0.1, counts: [{ label: 'Yes', count: 3 }] }],
        });
      }
      if (url.includes('view=difference')) {
        return errJson(403, { ok: false, reason: 'level_3_aggregate_results_admin_disabled' });
      }
      if (url.includes('view=groups')) {
        return okJson({
          ok: true,
          groupCount: 1,
          suppressedGroupCount: 1,
          participantCount: 6,
          questionCount: 3,
          minGroupSize: 2,
          groups: [{ groupId: 'g1', label: 'Group A', theme: 'Builders', size: 3, averageScore: 0.5, topStatements: [{ prompt: 'Build more', differenceScore: 0.4 }] }],
        });
      }
      return okJson({ ok: true, available: false, unavailableReason: 'not_enough_responses', counts: { questions: 3 } });
    });

    const result = await fetchTelegramAgentResults({ sessionSlug: 'edge', fetchImpl: fetchImpl as never });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(result.views?.consensus.status).toBe('ready');
    expect((result.views?.consensus.data as any).questions[0].prompt).toBe('Agree?');
    expect(result.views?.difference).toEqual({ status: 'disabled', reason: 'level_3_aggregate_results_admin_disabled' });
    expect(result.views?.groups.status).toBe('ready');
    expect((result.views?.groups.data as any).groups[0].label).toBe('Group A');
    expect((result.views?.topicMap.data as any).available).toBe(false);
  });

  it('normalizes the polis view into a PolisReport aggregator', async () => {
    const fetchImpl = jest.fn(async (urlIn: string) => {
      const view = new URL(String(urlIn)).searchParams.get('view');
      if (view === 'polis') {
        return okJson({
          ok: true,
          participantCount: 2,
          questionCount: 1,
          responseCount: 2,
          questions: [{ questionId: 'q1', prompt: 'Fund it?', questionType: 'binary' }],
          responses: {
            q1: [
              { responder: 'P1', value: 'Agree' },
              { responder: 'P2', value: 'Banana' },
            ],
            'q-unknown': [{ responder: 'P1', value: 'Agree' }],
          },
        });
      }
      return errJson(403, { ok: false, reason: 'level_3_aggregate_results_admin_disabled' });
    });

    const result = await fetchTelegramAgentResults({ sessionSlug: 'edge', fetchImpl: fetchImpl as never });
    const polis = result.views?.polis;
    expect(polis?.status).toBe('ready');
    const data = polis?.data as any;
    expect(data.hasData).toBe(true);
    expect(data.participantCount).toBe(2);
    // Invalid values and unknown question ids are dropped.
    expect(Object.keys(data.aggregator)).toEqual(['q1']);
    expect(data.aggregator.q1).toHaveLength(1);
    const row = data.aggregator.q1[0];
    expect(row).toMatchObject({ responder: 'P1', questionId: 'q1' });
    expect(JSON.parse(row.response)).toEqual({
      type: 'binary',
      prompt: 'Fund it?',
      answer: { value: 'Agree' },
    });
  });

  it('marks expired-token result views as auth failures', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(errJson(401, { ok: false, reason: 'agent_token_not_found' }));
    const result = await fetchTelegramAgentResults({ sessionSlug: 'edge', fetchImpl: fetchImpl as never });
    expect(result.ok).toBe(true);
    expect(result.views?.consensus.status).toBe('auth');
    expect(result.views?.groups.status).toBe('auth');
  });

  it('normalizes bucket cards with selection state', () => {
    const cards = normalizeTelegramBucketCards({
      categories: [
        {
          categoryId: 'events_attended',
          label: 'Attendance',
          options: [
            { optionId: 'week_1', label: 'Week 1' },
            { optionId: 'week_2', label: 'Week 2' },
          ],
        },
        { categoryId: 'empty_cat', label: 'Empty', options: [] },
      ],
      selections: { events_attended: ['week_1'] },
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].categoryLabel).toBe('Attendance');
    expect(cards[0].options).toEqual([
      { optionId: 'week_1', label: 'Week 1', selected: true },
      { optionId: 'week_2', label: 'Week 2', selected: false },
    ]);
    expect(normalizeTelegramBucketCards(null)).toEqual([]);
  });

  it('prefers real polis vectors when available', () => {
    const dataset = buildTelegramPolisDataset({
      polis: {
        status: 'ready',
        data: {
          hasData: true,
          participantCount: 2,
          questionCount: 1,
          responseCount: 2,
          aggregator: {
            q1: [
              {
                responder: 'P1',
                questionId: 'q1',
                response: JSON.stringify({ type: 'binary', prompt: 'Keep going?', answer: { value: 'Agree' } }),
              },
            ],
          },
        },
      },
      consensus: { status: 'ready', data: { questions: [] } },
    });

    expect(dataset.synthesized).toBe(false);
    expect(dataset.hasData).toBe(true);
    expect(dataset.aggregator.q1[0].responder).toBe('P1');
  });

  it('synthesizes polis vectors from anonymized groups when available', () => {
    const dataset = buildTelegramPolisDataset({
      polis: { status: 'error', reason: 'unsupported_results_view' },
      consensus: {
        status: 'ready',
        data: {
          questions: [
            {
              questionId: 'q1',
              prompt: 'Should agents disclose themselves?',
              total: 3,
              participants: 3,
              counts: [
                { label: 'Agree', count: 2 },
                { label: 'Disagree', count: 1 },
              ],
            },
          ],
        },
      },
      difference: { status: 'ready', data: { questions: [] } },
      groups: {
        status: 'ready',
        data: {
          participantCount: 3,
          groups: [
            {
              groupId: 'g1',
              label: 'Group 1',
              size: 3,
              topStatements: [
                {
                  prompt: 'Should agents disclose themselves?',
                  cluster: { agree: 2, disagree: 1, unsure: 0, responded: 3 },
                },
              ],
            },
          ],
        },
      },
    });

    expect(dataset.synthesized).toBe(true);
    expect(dataset.hasData).toBe(true);
    expect(dataset.participantCount).toBe(3);
    expect(dataset.aggregator.q1.map((row) => row.responder)).toEqual(['G1-P1', 'G1-P2', 'G1-P3']);
    expect(dataset.aggregator.q1.map((row) => JSON.parse(row.response).answer.value)).toEqual([
      'Agree',
      'Agree',
      'Disagree',
    ]);
  });

  it('synthesizes deterministic aggregate-only polis vectors and filters non-binary labels', () => {
    const views = {
      polis: { status: 'error', reason: 'unsupported_results_view' },
      consensus: {
        status: 'ready',
        data: {
          questions: [
            {
              questionId: 'q1',
              prompt: 'Fund prototypes?',
              total: 4,
              participants: 4,
              counts: [
                { label: 'Agree', count: 2 },
                { label: 'Disagree', count: 1 },
                { label: 'Unsure', count: 1 },
              ],
            },
            {
              questionId: 'q-ignore',
              prompt: 'Do you like this?',
              total: 3,
              participants: 3,
              counts: [
                { label: 'Yes', count: 2 },
                { label: 'No', count: 1 },
              ],
            },
          ],
        },
      },
      difference: {
        status: 'ready',
        data: {
          questions: [
            {
              questionId: 'q2',
              prompt: 'Agents should act overnight?',
              total: 4,
              participants: 4,
              counts: [
                { label: 'Agree', count: 1 },
                { label: 'Disagree', count: 2 },
                { label: 'Unsure', count: 1 },
              ],
            },
          ],
        },
      },
      groups: { status: 'disabled', reason: 'anonymized_groups_admin_disabled' },
    };

    const first = buildTelegramPolisDataset(views);
    const second = buildTelegramPolisDataset(views);

    expect(first).toEqual(second);
    expect(first.synthesized).toBe(true);
    expect(Object.keys(first.aggregator).sort()).toEqual(['q1', 'q2']);
    expect(first.aggregator.q1).toHaveLength(4);
    expect(first.aggregator.q2).toHaveLength(4);
    expect(JSON.parse(first.aggregator.q1[0].response)).toMatchObject({
      type: 'binary',
      prompt: 'Fund prototypes?',
      answer: { value: 'Agree' },
    });
  });
});
