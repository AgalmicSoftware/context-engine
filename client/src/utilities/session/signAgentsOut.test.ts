// Sign Agents Out, against the real token cache: the tab's sign-in to the session is ended at its Worker and
// forgotten here, and nothing is forgotten when the Worker could not be told.
import { clearWorkerSessionToken } from '../worker/workerAuth';
import { listHeldTokens } from '../worker/workerAuthTokenCache';
import { signAgentsOut } from './signAgentsOut';

jest.mock('../worker/workerAuth', () => ({ clearWorkerSessionToken: jest.fn(async () => undefined) }));
jest.mock('../worker/workerAuthTokenCache', () => ({ listHeldTokens: jest.fn() }));

const WORKER = 'https://ce-salon.example.workers.dev';
const fetchMock = jest.fn();
const session = { sessionSlug: 'salon', sessionConfig: { sessionName: 'Salon' }, context: { account: '0xabc' } };

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  jest.mocked(listHeldTokens).mockReturnValue([
    { workerUrl: WORKER, sessionSlug: 'salon', token: 'sign-in-here' },
    { workerUrl: 'https://ce-forum.example.workers.dev', sessionSlug: 'forum', token: 'another-session' },
  ]);
});

it('ends this tab’s sign-in to the session at its Worker, then forgets it, and leaves other sessions alone', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  await signAgentsOut(session);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(`${WORKER}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: 'Bearer sign-in-here', 'X-Group-Slug': 'salon' },
  });
  expect(clearWorkerSessionToken).toHaveBeenCalledWith(session);
});

it('counts a sign-in the Worker says has already ended as done', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  await expect(signAgentsOut(session)).resolves.toBeUndefined();
  expect(clearWorkerSessionToken).toHaveBeenCalledTimes(1);
});

it('says the agents are still signed in, and keeps the sign-in, when the Worker could not be told', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(signAgentsOut(session)).rejects.toThrow(/could not be reached, so your agents are still signed in/);
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
  await expect(signAgentsOut(session)).rejects.toThrow(/still signed in/);
  expect(clearWorkerSessionToken).not.toHaveBeenCalled();
});

it('has nothing to end at the Worker when the tab holds no sign-in to the session', async () => {
  jest.mocked(listHeldTokens).mockReturnValue([]);
  await signAgentsOut(session);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(clearWorkerSessionToken).toHaveBeenCalledTimes(1);
  await expect(signAgentsOut({ sessionSlug: '' })).rejects.toThrow('Open a session first.');
});
