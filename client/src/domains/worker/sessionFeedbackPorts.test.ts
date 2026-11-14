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

const WORKER_RUN = { slug: 'salon', sessionModeProfile: { authority: { mode: 'worker_canonical' } } };
const SIGNED_IN = { sessionSlug: 'salon', sessionConfig: WORKER_RUN, account: '0xabc' };
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
  sessionConfig: { slug: 'salon' },
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
    await expect(
      feedbackOffered({ ...SIGNED_IN, sessionConfig: { ...WORKER_RUN, feedbackEnabled: false } }),
    ).resolves.toBe(false);
    // An on-chain session's admins have nowhere to read feedback, so it is never offered there.
    const onChain = { slug: 'salon', sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } } };
    await expect(feedbackOffered({ ...SIGNED_IN, sessionConfig: onChain })).resolves.toBe(false);
    await expect(feedbackOffered({ ...SIGNED_IN, sessionConfig: { slug: 'salon' } })).resolves.toBe(false);
    // Turned off or on chain, the Worker isn't even asked.
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
    // Nor one a gate turns away before the route is reached.
    fetchWorker.mockResolvedValueOnce(response(403, { error: 'Not a member of the required group.' }));
    await sendFeedback(DRAFT, SIGNED_IN);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The feedback route's own refusal is final: it is shown, not sent again another way.
    fetchWorker.mockResolvedValueOnce(
      response(403, { error: 'This session isn’t taking feedback.', reason: 'feedback_off' }),
    );
    await expect(sendFeedback(DRAFT, SIGNED_IN)).rejects.toThrow('This session isn’t taking feedback.');
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it('reads every page of messages with the admin’s sign-in, newest first as the Worker gives them', async () => {
    fetchWorker
      .mockResolvedValueOnce(response(200, { messages: [stored('b'), stored('a')], cursor: 'a' }))
      .mockResolvedValueOnce(
        response(200, {
          messages: [{ ...stored('0'), contact: { address: '0xdef', reachMe: '@sam' } }, {}],
        }),
      );
    const messages = await listFeedback(ADMIN);
    expect(messages.map((message) => message.id)).toEqual(['b', 'a', '0']);
    // Nothing that would name a sender is read, whatever a row holds.
    expect(messages[2]).not.toHaveProperty('contact');
    expect(fetchWorker.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['https://worker.example/admin/feedback?slug=salon&limit=100', 'GET'],
      ['https://worker.example/admin/feedback?slug=salon&limit=100&cursor=a', 'GET'],
    ]);
    expect(fetchWorker.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        sessionSlug: 'salon',
        sessionConfig: ADMIN.sessionConfig,
        context: { account: '0xabc' },
      }),
    );
    // No page is a signed admin action: a person may sign only a few of those a minute.
    expect(adminPost).not.toHaveBeenCalled();
  });

  it('stops reading at what the Worker can store, whatever cursor it keeps giving', async () => {
    fetchWorker.mockImplementation(async () => response(200, { messages: [stored('a')], cursor: 'again' }));
    await expect(listFeedback(ADMIN)).resolves.toHaveLength(20);
    expect(fetchWorker).toHaveBeenCalledTimes(20);
  });

  it('says in the Worker’s words why the list can’t be read', async () => {
    fetchWorker.mockResolvedValueOnce(response(403, { error: 'Only this session’s admins can read feedback.' }));
    await expect(listFeedback(ADMIN)).rejects.toThrow('Only this session’s admins can read feedback.');
    fetchWorker.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => Promise.reject(new Error('html')),
    } as never);
    await expect(listFeedback(ADMIN)).rejects.toThrow('The Session Worker couldn’t list the feedback (502).');
  });

  it('deletes named messages, or everything up to one, in a single signed call', async () => {
    adminPost.mockResolvedValue({ data: { deleted: 1 } } as never);
    await deleteFeedback(ADMIN, { ids: ['b'] });
    await deleteFeedback(ADMIN, { through: 'c' });
    expect(adminPost.mock.calls.map(([args]) => [args.path, args.body])).toEqual([
      ['/admin/feedback/delete', { ids: ['b'], sessionId: '0x01' }],
      ['/admin/feedback/delete', { through: 'c', sessionId: '0x01' }],
    ]);
  });

  it('writes a CSV a spreadsheet opens as text, whatever was typed', () => {
    const csv = feedbackCsv([
      {
        ...stored('a'),
        text: 'Said "no", then\nleft',
      } as FeedbackMessage,
      { ...stored('b'), text: '=HYPERLINK("https://evil.example")', signedIn: false } as FeedbackMessage,
    ]);
    const [header, first] = csv.split('\r\n');
    expect(header).toBe('Sent,Feedback,View,Theme,Screen,App release,Worker release,Signed in');
    // A quoted cell keeps its line break; a cell that would run as a formula starts with an apostrophe.
    expect(first).toBe('2026-11-24T10:00:00.000Z,"Said ""no"", then\nleft",questions,civic,desktop,0.9.8,0.9.8,yes');
    expect(csv).toContain(
      '\r\n2026-11-24T10:00:00.000Z,"\'=HYPERLINK(""https://evil.example"")",questions,civic,desktop,0.9.8,0.9.8,no\r\n',
    );
  });
});
