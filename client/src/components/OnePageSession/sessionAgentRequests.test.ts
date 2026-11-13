import { askSessionAgent, readSessionAgentStatus, setSessionAgentOptOut } from './sessionAgentRequests';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../../utilities/worker/workerAuth', () => ({ fetchWorkerWithAuth: jest.fn() }));

const workerUrl = jest.mocked(getCorsProxyUrlOrThrow);
const fetchWorker = jest.mocked(fetchWorkerWithAuth);

const OPTIONS = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '0xabc' };
const respond = (status: number, json: () => Promise<unknown>) =>
  fetchWorker.mockResolvedValueOnce({ ok: status < 400, status, json } as unknown as Response);
const reply = (status: number, body: unknown) => respond(status, async () => body);

describe('sessionAgentRequests', () => {
  beforeEach(() => {
    workerUrl.mockResolvedValue('https://worker.example/');
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('posts each call to the session’s Worker as the signed-in person', async () => {
    reply(200, { answer: 'An answer.', answers: 'detailed', read: { context: 3, results: true, answers: 4 } });
    await expect(askSessionAgent('Why?', OPTIONS)).resolves.toEqual({
      answer: 'An answer.',
      answers: 'detailed',
      read: { context: 3, results: true, answers: 4 },
      note: '',
    });
    const [url, init, auth] = fetchWorker.mock.calls[0];
    expect(url).toBe('https://worker.example/session-agent/ask');
    expect(init).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ question: 'Why?' }) }));
    expect(auth).toEqual(
      expect.objectContaining({
        sessionSlug: 'salon',
        sessionConfig: OPTIONS.sessionConfig,
        context: { account: '0xabc' },
        workerUrl: 'https://worker.example',
      }),
    );

    reply(200, { optedOut: true });
    await expect(setSessionAgentOptOut(true, OPTIONS)).resolves.toBe(true);
    expect(fetchWorker.mock.calls[1][0]).toBe('https://worker.example/session-agent/opt-out');
    expect(fetchWorker.mock.calls[1][1]?.body).toBe(JSON.stringify({ optedOut: true }));
  });

  it('reads how the Worker would answer, and nothing it doesn’t know', async () => {
    reply(200, { on: true, answers: 'general', audience: 0, optedOut: true });
    await expect(readSessionAgentStatus(OPTIONS)).resolves.toEqual({
      on: true,
      answers: 'general',
      audience: 0,
      optedOut: true,
    });
    expect(fetchWorker.mock.calls[0][0]).toBe('https://worker.example/session-agent/status');
    reply(200, { on: true, answers: 'everything', audience: 'owner' });
    await expect(readSessionAgentStatus(OPTIONS)).resolves.toEqual({
      on: true,
      answers: null,
      audience: null,
      optedOut: false,
    });
  });

  it('throws the Worker’s own sentence, or says which status failed', async () => {
    reply(429, { error: 'The session’s AI is busy. Try again shortly.' });
    await expect(askSessionAgent('Why?', OPTIONS)).rejects.toThrow('The session’s AI is busy. Try again shortly.');
    respond(502, async () => Promise.reject(new Error('html')));
    await expect(askSessionAgent('Why?', OPTIONS)).rejects.toThrow(
      'The Session Worker couldn’t answer (502). Try again.',
    );
  });
});
