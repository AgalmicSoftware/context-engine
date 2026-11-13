import {
  deleteFeedback,
  feedbackCsv,
  feedbackOffered,
  listFeedback,
  sendFeedback,
  type FeedbackAdmin,
  type FeedbackDraft,
  type FeedbackMessage,
} from './sessionFeedbackPorts';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';

jest.mock('../../utilities/worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../../utilities/worker/workerAuth', () => ({
  fetchWorkerWithAuth: jest.fn(),
  buildSignedAdminActionAuth: jest.fn(),
}));
jest.mock('../../utilities/worker/signedAdminWorkerRequest', () => ({ postSignedAdminWorkerRequest: jest.fn() }));
jest.mock('../../utilities/worker/workerCapabilities', () => ({ readWorkerCapabilities: jest.fn() }));

const workerUrl = jest.mocked(getCorsProxyUrlOrThrow);
const fetchWorker = jest.mocked(fetchWorkerWithAuth);
const adminPost = jest.mocked(postSignedAdminWorkerRequest);
const capabilities = jest.mocked(readWorkerCapabilities);

const SIGNED_IN = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '0xabc' };
const VISITOR = { ...SIGNED_IN, account: '' };
const DRAFT: FeedbackDraft = {
  text: 'The map was hard to read.',
  view: 'results:debateAtlas',
  theme: 'civic',
  screen: 'phone',
  appRelease: '0.9.8',
};
const ADMIN: FeedbackAdmin = {
  workerOrigin: 'https://worker.example',
  sessionSlug: 'salon',
  sessionIdHex: '0x01',
  account: '0xabc',
  chainId: 1,
};
const response = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const stored = (id: string, extra: Partial<FeedbackMessage> = {}) => ({
  id,
  text: `Message ${id}`,
  createdAt: '2026-11-24T10:00:00.000Z',
  view: 'questions',
  theme: 'civic',
  screen: 'desktop',
  appRelease: '0.9.8',
  workerRelease: '0.9.8',
  signedIn: true,
  ...extra,
});

describe('sessionFeedbackPorts', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    workerUrl.mockResolvedValue('https://worker.example/');
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('offers feedback only where the Worker takes it and the setting is on', async () => {
    capabilities.mockResolvedValue({ legacy: false, features: ['worker_groups', 'session_feedback'] });
    await expect(feedbackOffered(SIGNED_IN)).resolves.toBe(true);
    expect(capabilities).toHaveBeenCalledWith('https://worker.example', 'salon');

    capabilities.mockResolvedValue({ legacy: false, features: ['worker_groups'] });
    await expect(feedbackOffered(SIGNED_IN)).resolves.toBe(false);

    capabilities.mockClear();
    capabilities.mockResolvedValue({ legacy: false, features: ['session_feedback'] });
    await expect(feedbackOffered({ ...SIGNED_IN, sessionConfig: { feedbackEnabled: false } })).resolves.toBe(false);
    // Turned off, the Worker isn't even asked.
    expect(capabilities).not.toHaveBeenCalled();

    workerUrl.mockRejectedValue(new Error('no Worker'));
    await expect(feedbackOffered(SIGNED_IN)).resolves.toBe(false);
  });

  it('sends a signed-in person’s message with their sign-in, and nothing that names them', async () => {
    fetchWorker.mockResolvedValue(response(200, { ok: true }));
    await sendFeedback(DRAFT, SIGNED_IN);
    const [url, init, auth] = fetchWorker.mock.calls[0];
    expect(url).toBe('https://worker.example/feedback');
    expect(JSON.parse(String(init?.body))).toEqual(DRAFT);
    // Send never asks for a signature, and the page's address, which can carry an invite, isn't sent as referrer.
    expect(auth).toEqual(
      expect.objectContaining({ sessionSlug: 'salon', workerUrl: 'https://worker.example', prompt: false }),
    );
    expect(init).toEqual(expect.objectContaining({ referrerPolicy: 'no-referrer' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends as a visitor when the page holds no sign-in for the Worker: sign-in trouble is feedback too', async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }));
    // No token, and none may be asked for.
    fetchWorker.mockRejectedValueOnce(new Error('User rejected the request.'));
    await sendFeedback(DRAFT, SIGNED_IN);
    expect(fetchMock.mock.calls[0][0]).toBe('https://worker.example/feedback?slug=salon');
    // A sign-in the Worker no longer takes.
    fetchWorker.mockResolvedValueOnce(response(401, { error: 'Worker login failed (401).' }));
    await sendFeedback(DRAFT, SIGNED_IN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The feedback route's own refusal is final: it is shown, not sent again another way.
    fetchWorker.mockResolvedValueOnce(
      response(403, { error: 'This session isn’t taking feedback.', reason: 'feedback_off' }),
    );
    await expect(sendFeedback(DRAFT, SIGNED_IN)).rejects.toThrow('This session isn’t taking feedback.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends a visitor’s message without a sign-in, naming the session in the address', async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }));
    await sendFeedback(DRAFT, VISITOR);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://worker.example/feedback?slug=salon');
    expect(init).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' }),
    );
    expect(fetchWorker).not.toHaveBeenCalled();
  });

  it('sends how to reach them only when they asked to be contacted', async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }));
    await sendFeedback({ ...DRAFT, reachMe: 'sam on Signal' }, VISITOR);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      ...DRAFT,
      contact: { reachMe: 'sam on Signal' },
    });
    await sendFeedback(DRAFT, VISITOR);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).not.toHaveProperty('contact');
  });

  it('gives the Worker’s own sentence for a refusal, and a plain one for anything else', async () => {
    fetchMock.mockResolvedValueOnce(
      response(429, { error: 'You’ve sent 5 today. Thanks! Try again tomorrow.', reason: 'feedback_person_limit' }),
    );
    await expect(sendFeedback(DRAFT, VISITOR)).rejects.toThrow('You’ve sent 5 today. Thanks! Try again tomorrow.');
    // An error that isn't the feedback route's own may hold anything, so it isn't shown.
    fetchMock.mockResolvedValueOnce(response(500, { error: 'TypeError: cannot read properties of undefined' }));
    await expect(sendFeedback(DRAFT, VISITOR)).rejects.toThrow('Not sent. Try again.');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => Promise.reject(new Error('html')) });
    await expect(sendFeedback(DRAFT, VISITOR)).rejects.toThrow('Not sent. Try again.');
    // Nor is the browser's own wording for a request that never arrived.
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(sendFeedback(DRAFT, VISITOR)).rejects.toThrow('Not sent. Try again.');
    workerUrl.mockRejectedValueOnce(new Error('Worker URL is encrypted and locked'));
    await expect(sendFeedback(DRAFT, VISITOR)).rejects.toThrow('Not sent. Try again.');
  });

  it('reads every page of messages for an admin, newest first as the Worker gives them', async () => {
    adminPost
      .mockResolvedValueOnce({ data: { messages: [stored('b'), stored('a')], cursor: 'next' } } as never)
      .mockResolvedValueOnce({
        data: { messages: [stored('0', { contact: { address: '0xdef', displayName: '', reachMe: '@sam' } }), {}] },
      } as never);
    const messages = await listFeedback(ADMIN);
    expect(messages.map((message) => message.id)).toEqual(['b', 'a', '0']);
    expect(messages[0].contact).toBeNull();
    expect(messages[2].contact).toEqual({ address: '0xdef', displayName: '', reachMe: '@sam' });
    expect(adminPost.mock.calls.map(([args]) => [args.path, args.body])).toEqual([
      ['/admin/feedback/list', { sessionId: '0x01', limit: 100 }],
      ['/admin/feedback/list', { sessionId: '0x01', limit: 100, cursor: 'next' }],
    ]);
  });

  it('stops reading at what the Worker can store, whatever cursor it keeps giving', async () => {
    adminPost.mockResolvedValue({ data: { messages: [stored('a')], cursor: 'again' } } as never);
    await expect(listFeedback(ADMIN)).resolves.toHaveLength(20);
    expect(adminPost).toHaveBeenCalledTimes(20);
  });

  it('deletes the named messages, a hundred to a call, and never asks for all', async () => {
    adminPost.mockResolvedValue({ data: { deleted: 1 } } as never);
    const ids = Array.from({ length: 150 }, (_, index) => `m${index}`);
    await deleteFeedback(ADMIN, ids);
    expect(adminPost.mock.calls.map(([args]) => args.path)).toEqual([
      '/admin/feedback/delete',
      '/admin/feedback/delete',
    ]);
    expect(adminPost.mock.calls.map(([args]) => (args.body?.ids as string[]).length)).toEqual([100, 50]);
    // "All" on the Worker would take messages that arrived after the list was read, unread.
    expect(adminPost.mock.calls.some(([args]) => 'all' in (args.body || {}))).toBe(false);
  });

  it('writes a CSV a spreadsheet opens as text, whatever was typed', () => {
    const csv = feedbackCsv([
      {
        ...stored('a'),
        text: 'Said "no", then\nleft',
        contact: { address: '0xdef', displayName: 'Sam', reachMe: '=HYPERLINK("https://evil.example")' },
      } as FeedbackMessage,
      { ...stored('b'), text: '+1 for the map', signedIn: false, contact: null } as FeedbackMessage,
    ]);
    const [header, first] = csv.split('\r\n');
    expect(header).toBe('Sent,Feedback,View,Theme,Screen,App release,Worker release,Signed in,Reach me,Address,Name');
    // A quoted cell keeps its line break; a cell that would run as a formula starts with an apostrophe.
    expect(first).toBe(
      '2026-11-24T10:00:00.000Z,"Said ""no"", then\nleft",questions,civic,desktop,0.9.8,0.9.8,yes,"\'=HYPERLINK(""https://evil.example"")",0xdef,Sam',
    );
    expect(csv).toContain("\r\n2026-11-24T10:00:00.000Z,'+1 for the map,questions,civic,desktop,0.9.8,0.9.8,no,,,\r\n");
  });
});
