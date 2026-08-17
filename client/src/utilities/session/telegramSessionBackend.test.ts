import {
  buildTelegramPreferenceAnswer,
  envelopeAllowsSubmit,
  loadGroups,
  loadResultsDataset,
  submitAnswer,
} from './telegramSessionBackend';
import type { AgentClientLoginEnvelope } from './agentClientLogin';

const envelope: AgentClientLoginEnvelope = {
  v: 2,
  sessionSlug: 'alpha',
  expiresAt: '2026-07-05T00:00:00.000Z',
  address: '0x1111111111111111111111111111111111111111',
  capabilities: { readQuestions: true, readResults: true, submitAnswers: true },
  bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'bridge-browser-token' },
  workerCredential: { kind: 'session_worker_jwt', token: 'jwt-session-token' },
  agentBridgeUrl: 'https://bridge.example',
  buckets: {
    categories: [{ categoryId: 'role', label: 'Role', options: [{ optionId: 'builder', label: 'Builder' }] }],
    selections: { role: ['builder'] },
  },
};

describe('telegramSessionBackend', () => {
  it('gates submit on both envelope capability and session-meta readiness', () => {
    expect(envelopeAllowsSubmit(envelope, { clientSubmitReady: true })).toBe(true);
    expect(
      envelopeAllowsSubmit({ ...envelope, capabilities: { submitAnswers: false } }, { clientSubmitReady: true }),
    ).toBe(false);
    expect(envelopeAllowsSubmit(envelope, { clientSubmitReady: false })).toBe(false);
  });

  it('normalizes answers by question type', () => {
    expect(
      buildTelegramPreferenceAnswer(
        {
          questionId: 'q1',
          id: 'q1',
          questionType: 'binary',
          type: 'binary',
          prompt: 'Prompt?',
          questionText: 'Prompt?',
          options: [],
          tags: [],
          answeredByUser: false,
          answerable: true,
        },
        { value: 'Yes' },
      ),
    ).toEqual({ questionType: 'binary', value: 'agree', comments: '' });
  });

  it('maps buckets to SBT-card compatible category cards and preserves null restore gap', () => {
    expect(loadGroups(envelope)).toEqual([
      {
        categoryId: 'role',
        categoryLabel: 'Role',
        options: [{ optionId: 'builder', label: 'Builder', selected: true }],
      },
    ]);
    expect(loadGroups({ ...envelope, buckets: null })).toBeNull();
  });

  it('submits answers with the exchanged envelope credential', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, submittedCount: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as jest.Mock;

    const result = await submitAnswer({
      envelope,
      question: {
        questionId: 'q1',
        id: 'q1',
        questionType: 'freeform',
        type: 'freeform',
        prompt: 'Prompt?',
        questionText: 'Prompt?',
        options: [],
        tags: [],
        answeredByUser: false,
        answerable: true,
      },
      answer: { text: 'Answer' },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bridge.example/api/agent/preferences',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer bridge-browser-token' }),
      }),
    );
  });

  it('synthesizes deterministic Polis data from aggregate rows', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      const parsed = new URL(url);
      const view = parsed.searchParams.get('view');
      if (view === 'consensus') {
        return new Response(
          JSON.stringify({
            ok: true,
            questions: [
              {
                questionId: 'q1',
                prompt: 'Should we keep the default?',
                participants: 3,
                counts: [
                  { label: 'Agree', count: 2 },
                  { label: 'Disagree', count: 1 },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as jest.Mock;

    const first = await loadResultsDataset({ envelope, fetchImpl });
    const second = await loadResultsDataset({ envelope, fetchImpl });

    expect(first.approximate).toBe(true);
    expect(first.polisDataset.hasData).toBe(true);
    expect(first.polisDataset).toEqual(second.polisDataset);
  });
});
