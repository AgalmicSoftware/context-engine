import {
  askSessionAgent,
  readSessionAgentStatus,
  setSessionAgentOptOut,
  setSessionAgentUnattributed,
} from './sessionAgentRequests';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { forgetGroupReadHeader, saveGroupReadHeader } from '../../utilities/worker/workerGroupReadProof';

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
      sources: null,
      questions: [],
      questionsFrom: 'answers',
      note: '',
      stored: null,
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

    reply(200, { unattributed: true });
    await expect(setSessionAgentUnattributed(true, OPTIONS)).resolves.toBe(true);
    expect(fetchWorker.mock.calls[2][0]).toBe('https://worker.example/session-agent/attribution');
    expect(fetchWorker.mock.calls[2][1]?.body).toBe(JSON.stringify({ unattributed: true }));
    reply(200, { unattributed: false });
    await expect(setSessionAgentUnattributed(false, OPTIONS)).resolves.toBe(false);
  });

  it('reads what an answer drew on, keeping only what it can show and only web addresses as links', async () => {
    reply(200, {
      answer: 'An answer.',
      answers: 'general',
      read: { context: 4, results: true, answers: 0 },
      sources: [
        { kind: 'session-link', title: 'Charter', url: 'https://example.org/charter' },
        { kind: 'session-note', title: 'A note.' },
        { kind: 'link', title: 'Sneaky', url: 'javascript:alert(1)' },
        { kind: 'file', title: 'report.pdf', readByAi: true, uploader: '0xabc' },
        { kind: 'file', title: '  ' },
        { kind: 'something-new', title: 'Unknown kind' },
        'not an item',
      ],
      questions: [
        { id: '0xq1', question: 'Shorter meetings?' },
        { id: '', question: 'No id' },
        { id: '0xq2' },
        // An id goes into a link's path: one that could change the link is dropped.
        { id: '0xq3?session=other', question: 'Sneaky id' },
        { id: '../admin', question: 'Another' },
        null,
      ],
      questionsFrom: 'results',
    });
    const answer = await askSessionAgent('Why?', OPTIONS);
    expect(answer.sources).toEqual([
      { kind: 'session-link', title: 'Charter', url: 'https://example.org/charter', readByAi: false },
      { kind: 'session-note', title: 'A note.', url: '', readByAi: false },
      { kind: 'link', title: 'Sneaky', url: '', readByAi: false },
      { kind: 'file', title: 'report.pdf', url: '', readByAi: true },
    ]);
    expect(answer.questions).toEqual([{ id: '0xq1', question: 'Shorter meetings?' }]);
    expect(answer.questionsFrom).toBe('results');
    // A Worker that lists nothing for this asker gives no list at all, which is not an empty one.
    reply(200, { answer: 'An answer.', answers: 'general', read: { context: 2 }, sources: [] });
    expect((await askSessionAgent('Why?', OPTIONS)).sources).toEqual([]);
    reply(200, { answer: 'An answer.', answers: 'general', read: { context: 2 } });
    expect((await askSessionAgent('Why?', OPTIONS)).sources).toBeNull();
  });

  it('reads how the Worker would answer, and nothing it doesn’t know', async () => {
    reply(200, { on: true, answers: 'general', audience: 0, optedOut: true, unattributed: true, closed: 'never' });
    await expect(readSessionAgentStatus(OPTIONS)).resolves.toEqual({
      on: true,
      answers: 'general',
      audience: 0,
      optedOut: true,
      unattributed: true,
      closed: null,
      recording: false,
      signedOut: false,
    });
    expect(fetchWorker.mock.calls[0][0]).toBe('https://worker.example/session-agent/status');
    reply(200, { on: true, answers: 'everything', audience: 'owner' });
    await expect(readSessionAgentStatus(OPTIONS)).resolves.toEqual({
      on: true,
      answers: null,
      audience: null,
      optedOut: false,
      // A Session Worker that doesn't say has no such switch for this person.
      unattributed: null,
      closed: null,
      recording: false,
      signedOut: false,
    });
    reply(200, {
      on: true,
      answers: null,
      audience: null,
      optedOut: false,
      unattributed: false,
      closed: 'session_ended',
    });
    await expect(readSessionAgentStatus(OPTIONS)).resolves.toEqual(
      expect.objectContaining({ closed: 'session_ended' }),
    );
  });

  it('says what to keep of a chat only where the session stores chats', async () => {
    reply(200, { on: true, answers: 'general', audience: 0, optedOut: false, unattributed: false, recording: true });
    await expect(readSessionAgentStatus(OPTIONS)).resolves.toEqual(expect.objectContaining({ recording: true }));
    const sent = () => JSON.parse(String(fetchWorker.mock.calls.at(-1)?.[1]?.body));
    reply(200, { answer: 'A.', answers: 'general', read: {}, stored: true });
    await expect(askSessionAgent('Why?', OPTIONS, { attribution: 'address', name: 'Sam' })).resolves.toEqual(
      expect.objectContaining({ stored: true }),
    );
    expect(sent()).toEqual({ question: 'Why?', store: true, attribution: 'address', name: 'Sam' });
    reply(200, { answer: 'A.', answers: 'general', read: {}, stored: true });
    await askSessionAgent('Why?', OPTIONS, { attribution: 'anonymous', name: '' });
    expect(sent()).toEqual({ question: 'Why?', store: true, attribution: 'anonymous' });
    reply(200, { answer: 'A.', answers: 'general', read: {}, stored: false });
    await expect(askSessionAgent('Why?', OPTIONS, null)).resolves.toEqual(expect.objectContaining({ stored: false }));
    expect(sent()).toEqual({ question: 'Why?', store: false });
    // Without it, as in a session that stores none, the question goes alone.
    reply(200, { answer: 'A.', answers: 'general', read: {} });
    await askSessionAgent('Why?', OPTIONS);
    expect(sent()).toEqual({ question: 'Why?' });
  });

  it('asks without a sign-in for someone signed out, naming the session, and never asks for a signature', async () => {
    const signedOut = { ...OPTIONS, account: '' };
    const fetchMock = jest.fn();
    const realFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const answer = (status: number, body: unknown) =>
        fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body } as unknown as Response);
      answer(200, { on: true, answers: 'general', audience: 0, optedOut: false, recording: true, signedOut: true });
      await expect(readSessionAgentStatus(signedOut)).resolves.toEqual(
        expect.objectContaining({ answers: 'general', recording: true, signedOut: true, unattributed: null }),
      );
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://worker.example/session-agent/status?slug=salon');
      expect(init).toEqual(
        expect.objectContaining({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' }),
      );
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

      answer(200, { answer: 'A.', answers: 'general', read: {}, stored: true });
      await askSessionAgent('Why?', signedOut, { attribution: 'anonymous', name: 'A visitor' });
      expect(fetchMock.mock.calls[1][0]).toBe('https://worker.example/session-agent/ask?slug=salon');
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        question: 'Why?',
        store: true,
        attribution: 'anonymous',
        name: 'A visitor',
      });

      // The Worker asks for a sign-in, as one from before signed-out asking does: the dialog says so, with no error.
      answer(401, { error: 'Sign in to ask the Session Agent.', reason: 'session_agent_sign_in_required' });
      await expect(readSessionAgentStatus(signedOut)).resolves.toEqual(
        expect.objectContaining({ on: true, answers: null, signedOut: true }),
      );
      answer(401, {});
      await expect(askSessionAgent('Why?', signedOut)).rejects.toThrow('Sign in to ask the Session Agent.');
      answer(429, { error: 'The Session Agent has answered all it can today for people who aren’t signed in.' });
      await expect(askSessionAgent('Why?', signedOut)).rejects.toThrow('answered all it can today');
      expect(fetchWorker).not.toHaveBeenCalled();
    } finally {
      global.fetch = realFetch;
    }
  });

  it('sends a private session’s invite proof with a signed-out question', async () => {
    const header = `rxc:0x${'ab'.repeat(65)}`;
    saveGroupReadHeader({
      workerUrl: 'https://worker.example',
      sessionSlug: 'salon',
      sessionId: `0x${'2a'.repeat(16)}`,
      header,
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ on: true }) });
    const realFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await readSessionAgentStatus({ ...OPTIONS, account: '' });
      expect(fetchMock.mock.calls[0][1].headers).toEqual({
        'Content-Type': 'application/json',
        'X-CE-Group-Invite': header,
      });
    } finally {
      global.fetch = realFetch;
      forgetGroupReadHeader('https://worker.example', 'salon');
    }
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
