import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import {
  buildInitialAgentState,
  createOnePageSessionAgentActions,
  type OnePageSessionAgentState,
} from './onePageSessionAgentActions';

const buildEnvelope = (sessionSlug: string): AgentClientLoginEnvelope => ({
  v: 2,
  sessionId: '0x11111111111111111111111111111111',
  sessionSlug,
  address: '0x0000000000000000000000000000000000000001',
  bridgeCredential: { kind: 'agent_bridge_browser_token', token: `bridge-${sessionSlug}` },
  workerCredential: { kind: 'session_worker_jwt', token: `worker-${sessionSlug}` },
  agentBridgeUrl: 'https://bridge.example',
  workerUrl: 'https://worker.example',
  capabilities: { submitAnswers: true },
  expiresAt: '2030-01-01T00:00:00.000Z',
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createHarness = () => {
  let slug = 'alpha';
  let agentMode = true;
  let state: OnePageSessionAgentState = buildInitialAgentState('alpha', () => buildEnvelope('alpha'));
  const setState = jest.fn((patch, callback) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    callback?.();
  });
  const loadQuestions = jest.fn();
  const fetchImpl = jest.fn();
  const actions = createOnePageSessionAgentActions({
    getState: () => state,
    isAgentBackendMode: () => agentMode,
    ports: {
      clearStoredEnvelope: jest.fn(),
      envelopeAllowsSubmit: jest.fn(() => true),
      fetchImpl,
      isAuthFailure: jest.fn(() => false),
      loadQuestions,
      loadResultsDataset: jest.fn(async () => ({
        ok: true as const,
        polisDataset: {
          participantCount: 0,
          questionCount: 0,
          responseCount: 0,
          aggregator: {},
          hasData: false,
          synthesized: false,
        },
        approximate: false,
      })),
      readStoredEnvelope: jest.fn(() => buildEnvelope(slug)),
      submitAnswer: jest.fn(),
    },
    resolveCurrentSessionConfig: () => ({
      slug,
      sessionMode: agentMode ? 'telegram_only' : 'standard',
      agentBridgeUrl: 'https://bridge.example',
    }),
    resolveCurrentSessionSlug: () => slug,
    resolveSessionAgentBridgeUrl: () => 'https://bridge.example',
    setState,
  });

  return {
    actions,
    fetchImpl,
    getState: () => state,
    loadQuestions,
    setSlug: (nextSlug: string, nextAgentMode = agentMode) => {
      slug = nextSlug;
      agentMode = nextAgentMode;
    },
    setState,
  };
};

describe('onePageSessionAgentActions request lifecycle', () => {
  it('loads submit readiness without binding native fetch to the ports object', async () => {
    const harness = createHarness();
    harness.fetchImpl.mockImplementation(function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            sessionSlug: 'alpha',
            authorityMode: 'worker_canonical',
            agentHttpEnabled: true,
            clientSubmitReady: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    const metadata = await harness.actions.loadAgentSessionMeta();
    expect(metadata?.clientSubmitReady).toBe(true);
    expect(harness.getState().agentSessionMetaStatus).toBe('ready');
  });

  it('ignores a deferred question response after the session identity changes', async () => {
    const harness = createHarness();
    const pending = deferred<any>();
    harness.loadQuestions.mockReturnValueOnce(pending.promise);

    const request = harness.actions.loadAgentQuestions(true);
    expect(harness.getState().agentQuestionsStatus).toBe('loading');

    harness.setSlug('beta', false);
    harness.actions.handleAgentComponentDidUpdate({ slugChanged: true, loginJustCompleted: false });
    pending.resolve({
      ok: true,
      questions: [{ questionId: 'alpha-question', prompt: 'Old session question' }],
      answerState: null,
    });
    await request;

    expect(harness.getState().agentQuestionsStatus).toBe('idle');
    expect(harness.getState().agentQuestions).toEqual([]);
  });

  it('lets only the newest overlapping question request settle loading and data', async () => {
    const harness = createHarness();
    const first = deferred<any>();
    const second = deferred<any>();
    harness.loadQuestions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const firstRequest = harness.actions.loadAgentQuestions(true);
    const secondRequest = harness.actions.loadAgentQuestions(true);
    first.resolve({
      ok: true,
      questions: [{ questionId: 'old-question', prompt: 'Old question' }],
      answerState: null,
    });
    await firstRequest;

    expect(harness.getState().agentQuestionsStatus).toBe('loading');
    expect(harness.getState().agentQuestions).toEqual([]);

    second.resolve({
      ok: true,
      questions: [{ questionId: 'new-question', prompt: 'New question' }],
      answerState: null,
    });
    await secondRequest;

    expect(harness.getState().agentQuestionsStatus).toBe('ready');
    expect(harness.getState().agentQuestions).toEqual([expect.objectContaining({ questionId: 'new-question' })]);
  });

  it('does not write session metadata after disposal during an await', async () => {
    const harness = createHarness();
    const pending = deferred<Response>();
    harness.fetchImpl.mockReturnValueOnce(pending.promise);

    const request = harness.actions.loadAgentSessionMeta();
    const writesBeforeDispose = harness.setState.mock.calls.length;
    harness.actions.disposeAgentActions();
    pending.resolve(
      new Response(JSON.stringify({ ok: true, sessionSlug: 'alpha' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await request;

    expect(harness.setState).toHaveBeenCalledTimes(writesBeforeDispose);
    expect(harness.getState().agentSessionMetaStatus).toBe('loading');
  });
});
