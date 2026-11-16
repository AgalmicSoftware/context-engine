import { buildAgentPolisDataset, fetchAgentQuestions, normalizeAgentQuestion } from './agentSessionData';
import type { AgentClientLoginEnvelope } from './agentClientLogin';
const envelope = {
  v: 3,
  sessionSlug: 'fixture',
  workerUrl: 'https://session.example',
  agentWorkerUrl: 'https://session.example',
  agentCredential: { token: 'ceagt_fixture', kind: 'session_agent_browser_token' },
} as AgentClientLoginEnvelope;
const question = (id: string) => ({ questionId: id, prompt: `Fixture ${id}?`, questionType: 'binary' });
const page = (questions: unknown[], total: number, nextCursor = '') =>
  new Response(
    JSON.stringify({
      ok: true,
      questions,
      total,
      hasMore: !!nextCursor,
      nextCursor,
      answerState: { answeredCount: 0, unansweredCount: total },
    }),
  );

test('loads all bounded pages using only the exchanged same-origin credential', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(page([question('q1')], 2, 'opaque-page-two'))
    .mockResolvedValueOnce(page([question('q2')], 2));
  const result = await fetchAgentQuestions({ envelope, fetchImpl, limit: 1 });
  expect(result.ok).toBe(true);
  expect(result.questions?.map((q) => q.id)).toEqual(['q1', 'q2']);
  expect(new URL(fetchImpl.mock.calls[1][0]).searchParams.get('cursor')).toBe('opaque-page-two');
  expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer ceagt_fixture');
});
test('does not present partial questions as complete after a stale cursor or truncated page', async () => {
  for (const last of [
    new Response(JSON.stringify({ ok: false, reason: 'agent_cursor_invalid_or_stale' }), { status: 400 }),
    page([], 2),
  ]) {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(page([question('q1')], 2, 'next'))
      .mockResolvedValueOnce(last);
    const result = await fetchAgentQuestions({ envelope, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.questions).toBeUndefined();
  }
});
test('rejects a repeated cursor and foreign worker override before exposing partial data', async () => {
  const fetchImpl = jest.fn().mockImplementation(async () => page([question('q1')], 3, 'same'));
  expect((await fetchAgentQuestions({ envelope, fetchImpl })).ok).toBe(false);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  fetchImpl.mockClear();
  expect((await fetchAgentQuestions({ envelope, fetchImpl, agentWorkerUrl: 'https://foreign.example' })).ok).toBe(
    false,
  );
  expect(fetchImpl).not.toHaveBeenCalled();
});

describe('normalizeAgentQuestion', () => {
  const base = { questionId: 'q1', prompt: 'A question?' };

  it('keeps the scale a rating question is answered on', () => {
    const scale = { min: -0.5, max: 0.5, step: 0.1, minLabel: 'Less', maxLabel: 'More' };
    expect(normalizeAgentQuestion({ ...base, questionType: 'rating', scale }).scale).toEqual(scale);
    // A released Worker may send no scale; such a question is the default 0 to 10.
    expect(normalizeAgentQuestion({ ...base, questionType: 'rating' }).scale).toEqual({
      min: 0,
      max: 10,
      step: 1,
      minLabel: '0',
      maxLabel: '10',
    });
    expect(normalizeAgentQuestion({ ...base, questionType: 'binary', scale })).not.toHaveProperty('scale');
  });

  it('keeps whether a choice question takes one option', () => {
    const options = ['One', 'Two'];
    expect(
      normalizeAgentQuestion({ ...base, questionType: 'multichoice', options, singleSelect: true }).singleSelect,
    ).toBe(true);
    expect(normalizeAgentQuestion({ ...base, questionType: 'multichoice', options })).not.toHaveProperty(
      'singleSelect',
    );
  });
});

describe('buildAgentPolisDataset', () => {
  // A rating and a yes/no question with the same wording, and the raw Polis read unavailable.
  const views = (statement: Record<string, unknown>) => ({
    polis: { status: 'error' },
    consensus: {
      status: 'ready',
      data: {
        questions: [
          { questionId: 'rating', prompt: 'Is it fair?', counts: [{ label: '7', count: 2 }], participants: 2 },
          { questionId: 'yes-no', prompt: 'Is it  fair?', counts: [{ label: 'Agree', count: 2 }], participants: 2 },
        ],
      },
    },
    groups: {
      status: 'ready',
      data: {
        groups: [
          { size: 2, topStatements: [{ prompt: 'Is it fair?', cluster: { agree: 2, responded: 2 }, ...statement }] },
        ],
      },
    },
  });

  it('never gives a rating the votes of a yes/no question that shares its wording', () => {
    expect(Object.keys(buildAgentPolisDataset(views({})).aggregator)).toEqual(['yes-no']);
  });

  it('places a group statement on the question its id names', () => {
    const dataset = buildAgentPolisDataset(views({ questionId: 'yes-no' }));
    expect(Object.keys(dataset.aggregator)).toEqual(['yes-no']);
    expect(dataset.aggregator['yes-no'].map((vote) => vote.responder)).toEqual(['G1-P1', 'G1-P2']);
  });
});
