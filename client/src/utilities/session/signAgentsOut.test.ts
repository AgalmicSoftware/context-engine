// Sign Agents Out, against the real token cache: the tab's sign-in to the session is ended at its Worker and
// forgotten here, and nothing is forgotten when the Worker could not be told.
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  heldSessionToken,
  writeTokenCache,
} from '../worker/workerAuthTokenCache';
import { signAgentsOut } from './signAgentsOut';

const WORKER = 'https://ce-salon.example.workers.dev';
const FORUM = 'https://ce-forum.example.workers.dev';
const ADDRESS = `0x${'a1'.repeat(20)}`;
const fetchMock = jest.fn();
const hold = (workerUrl: string, sessionSlug: string, token: string) =>
  writeTokenCache(
    buildTokenCacheKey({ workerUrl, slug: sessionSlug, address: ADDRESS }),
    buildTokenCacheEnvelope({
      token,
      exp: Math.floor(Date.now() / 1000) + 3600,
      workerUrl,
      sessionSlug,
      address: ADDRESS,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  clearAllTokenCaches();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  hold(WORKER, 'salon', 'sign-in-here');
  hold(FORUM, 'forum', 'another-session');
  expect(heldSessionToken(WORKER, 'salon')).toBe('sign-in-here');
});

it('ends this tab’s sign-in to the session at its Worker, then forgets it, and leaves other sessions alone', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  await signAgentsOut('salon');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(`${WORKER}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: 'Bearer sign-in-here', 'X-Group-Slug': 'salon' },
  });
  expect(heldSessionToken(WORKER, 'salon')).toBe('');
  expect(heldSessionToken(FORUM, 'forum')).toBe('another-session');
});

it('counts a sign-in the Worker says has already ended as done', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  await expect(signAgentsOut('salon')).resolves.toBeUndefined();
  expect(heldSessionToken(WORKER, 'salon')).toBe('');
});

it('says the agents are still signed in, and keeps the sign-in, when the Worker could not be told', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(signAgentsOut('salon')).rejects.toThrow(/could not be reached, so your agents are still signed in/);
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
  await expect(signAgentsOut('salon')).rejects.toThrow(/still signed in/);
  expect(heldSessionToken(WORKER, 'salon')).toBe('sign-in-here');
});

it('has nothing to end at the Worker when the tab holds no sign-in to the session', async () => {
  clearAllTokenCaches();
  await signAgentsOut('salon');
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(signAgentsOut('')).rejects.toThrow('Open a session first.');
});
