import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import {
  buildInitialTelegramState,
  createOnePageSessionTelegramActions,
  type OnePageSessionTelegramState,
} from './onePageSessionTelegramActions';

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
  let telegramMode = true;
  let state: OnePageSessionTelegramState = buildInitialTelegramState('alpha', () => buildEnvelope('alpha'));
  const setState = jest.fn((patch, callback) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    callback?.();
  });
  const loadQuestions = jest.fn();
  const fetchImpl = jest.fn();
  const actions = createOnePageSessionTelegramActions({
    getState: () => state,
    isTelegramBackendMode: () => telegramMode,
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
      sessionMode: telegramMode ? 'telegram_only' : 'standard',
      agentBridgeUrl: 'https://bridge.example',
    }),
    resolveCurrentSessionSlug: () => slug,
    resolveTelegramAgentBridgeUrl: () => 'https://bridge.example',
    setState,
  });

  return {
    actions,
    fetchImpl,
    getState: () => state,
    loadQuestions,
    setSlug: (nextSlug: string, nextTelegramMode = telegramMode) => {
      slug = nextSlug;
      telegramMode = nextTelegramMode;
    },
    setState,
  };
};

describe('onePageSessionTelegramActions request lifecycle', () => {
  it('ignores a deferred question response after the session identity changes', async () => {
    const harness = createHarness();
    const pending = deferred<any>();
    harness.loadQuestions.mockReturnValueOnce(pending.promise);

    const request = harness.actions.loadTelegramAgentQuestions(true);
    expect(harness.getState().telegramAgentQuestionsStatus).toBe('loading');

    harness.setSlug('beta', false);
    harness.actions.handleTelegramComponentDidUpdate({ slugChanged: true, loginJustCompleted: false });
    pending.resolve({
      ok: true,
      questions: [{ questionId: 'alpha-question', prompt: 'Old session question' }],
      answerState: null,
    });
    await request;

    expect(harness.getState().telegramAgentQuestionsStatus).toBe('idle');
    expect(harness.getState().telegramAgentQuestions).toEqual([]);
  });

  it('lets only the newest overlapping question request settle loading and data', async () => {
    const harness = createHarness();
    const first = deferred<any>();
    const second = deferred<any>();
    harness.loadQuestions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const firstRequest = harness.actions.loadTelegramAgentQuestions(true);
    const secondRequest = harness.actions.loadTelegramAgentQuestions(true);
    first.resolve({
      ok: true,
      questions: [{ questionId: 'old-question', prompt: 'Old question' }],
      answerState: null,
    });
    await firstRequest;

    expect(harness.getState().telegramAgentQuestionsStatus).toBe('loading');
    expect(harness.getState().telegramAgentQuestions).toEqual([]);

    second.resolve({
      ok: true,
      questions: [{ questionId: 'new-question', prompt: 'New question' }],
      answerState: null,
    });
    await secondRequest;

    expect(harness.getState().telegramAgentQuestionsStatus).toBe('ready');
    expect(harness.getState().telegramAgentQuestions).toEqual([
      expect.objectContaining({ questionId: 'new-question' }),
    ]);
  });

  it('does not write session metadata after disposal during an await', async () => {
    const harness = createHarness();
    const pending = deferred<Response>();
    harness.fetchImpl.mockReturnValueOnce(pending.promise);

    const request = harness.actions.loadTelegramSessionMeta();
    const writesBeforeDispose = harness.setState.mock.calls.length;
    harness.actions.disposeTelegramActions();
    pending.resolve(
      new Response(JSON.stringify({ ok: true, sessionSlug: 'alpha' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await request;

    expect(harness.setState).toHaveBeenCalledTimes(writesBeforeDispose);
    expect(harness.getState().telegramSessionMetaStatus).toBe('loading');
  });
});
