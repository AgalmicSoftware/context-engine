import { clearAllWorkerSessionTokens } from './workerAuth';
import { buildTokenCacheEnvelope, buildTokenCacheKey, readTokenCache, writeTokenCache } from './workerAuthTokenCache';

const ADDRESS = '0x00000000000000000000000000000000000000aa';
const SESSION_ID = '0x0123456789abcdef0123456789abcdef';

const hold = (workerUrl: string, slug: string, token: string, exp = Math.floor(Date.now() / 1000) + 3600) => {
  const key = buildTokenCacheKey({ workerUrl, slug, sessionId: SESSION_ID, address: ADDRESS });
  writeTokenCache(
    key,
    buildTokenCacheEnvelope({ token, exp, workerUrl, sessionId: SESSION_ID, sessionSlug: slug, address: ADDRESS }),
  );
  return key;
};

describe('signing out of Session Workers', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('asks each Worker to end the sign-in it issued, then forgets them all', () => {
    const fetchMock = jest.fn(() => Promise.resolve(new Response('{"ok":true}')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const first = hold('https://worker-a.example', 'session-a', 'token-a');
    const second = hold('https://worker-b.example', 'session-b', 'token-b');
    hold('https://worker-c.example', 'session-c', 'token-expired', Math.floor(Date.now() / 1000) - 10);

    clearAllWorkerSessionTokens();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([url]) => url).sort()).toEqual([
      'https://worker-a.example/auth/logout',
      'https://worker-b.example/auth/logout',
    ]);
    for (const [url, init] of calls) {
      expect(init.method).toBe('POST');
      expect(init.keepalive).toBe(true);
      const token = url.includes('worker-a') ? 'token-a' : 'token-b';
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    }
    expect(readTokenCache(first)).toBeNull();
    expect(readTokenCache(second)).toBeNull();
  });

  it('still forgets sign-ins when a Worker cannot be reached', () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const key = hold('https://worker-a.example', 'session-a', 'token-a');
    expect(() => clearAllWorkerSessionTokens()).not.toThrow();
    expect(readTokenCache(key)).toBeNull();
  });
});
