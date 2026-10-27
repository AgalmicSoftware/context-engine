import { fetchAgentQuestions } from './agentSessionData';
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
