import {
  clearAgentClientLoginEnvelope,
  exchangeAgentClientLogin,
  extractAgentClientToken,
  readAgentClientLoginEnvelope,
  writeAgentClientLoginEnvelope,
} from './agentClientLogin';

const TOKEN = 'ceagt_abcdefghijklmnopqrstuvwxyz123456';
const origin = 'https://session-worker.example';
const sessionId = '0x1234567890abcdef1234567890abcdef';
const expiresAt = '2035-01-01T00:00:00.000Z';
const target = { sessionSlug: 'alpha', sessionId, workerUrl: origin, agentWorkerUrl: origin };
const envelope = () => ({
  v: 3 as const,
  ...target,
  expiresAt,
  address: '0x1111111111111111111111111111111111111111',
  capabilities: { readQuestions: true, readGroups: true },
  agentCredential: { kind: 'session_agent_browser_token', token: 'ceagt_browser-fixture-token', expiresAt },
  workerCredential: { kind: 'session_worker_jwt', token: 'participant-fixture-token', expiresAt },
});
const capability = () => ({ features: ['agent_http_v1'], agentHttp: { ready: true }, agentSessionWrapped: { origin } });
const mockFetch = (body: unknown = envelope(), status = 200, caps: unknown = capability()) =>
  jest.fn(
    async (url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(String(url).includes('/capabilities?') ? caps : body), {
        status: String(url).includes('/capabilities?') ? 200 : status,
      }),
  );
const exchange = (fetchImpl: typeof fetch, extra = {}) =>
  exchangeAgentClientLogin({ ...target, tokenOrLink: TOKEN, fetchImpl, ...extra });

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  clearAgentClientLoginEnvelope('alpha');
});

test('accepts only raw credentials, never bearer links', () => {
  expect(extractAgentClientToken(TOKEN)).toEqual({ ok: true, token: TOKEN });
  for (const value of ['', `${TOKEN}\nsecond`, `https://example.test?token=${TOKEN}`])
    expect(extractAgentClientToken(value).ok).toBe(false);
});
test('verifies one Worker origin before exchange and keeps both credential purposes only in memory', async () => {
  const fetchImpl = mockFetch();
  const result = await exchange(fetchImpl);
  expect(fetchImpl).toHaveBeenNthCalledWith(1, `${origin}/capabilities?slug=alpha`, { cache: 'no-store' });
  expect(fetchImpl).toHaveBeenNthCalledWith(
    2,
    `${origin}/api/agent/client-login/exchange`,
    expect.objectContaining({ method: 'POST', body: expect.stringContaining(TOKEN) }),
  );
  expect(result.agentCredential.kind).toBe('session_agent_browser_token');
  expect(result.workerCredential.kind).toBe('session_worker_jwt');
  expect(readAgentClientLoginEnvelope(target)).toMatchObject(envelope());
  expect(window.sessionStorage.length).toBe(0);
  expect(window.localStorage.length).toBe(0);
  expect(window.location.href).not.toContain(TOKEN);
});
test('purges historic envelopes without restoring or migrating credentials', () => {
  window.sessionStorage.setItem('ce:agentClientLogin:v2:alpha', JSON.stringify(envelope()));
  expect(readAgentClientLoginEnvelope(target)).toBeNull();
  expect(window.sessionStorage.length).toBe(0);
});
test('refuses mismatched origins before sending any credential', async () => {
  const fetchImpl = mockFetch();
  await expect(exchange(fetchImpl, { agentWorkerUrl: 'https://old-bridge.example' })).rejects.toThrow(
    'origin_mismatch',
  );
  expect(fetchImpl).not.toHaveBeenCalled();
});
test('does not exchange with an unready Worker or an advertised foreign origin', async () => {
  for (const caps of [
    {},
    { ...capability(), agentHttp: { ready: false } },
    { ...capability(), agentSessionWrapped: { origin: 'https://foreign.example' } },
  ]) {
    const fetchImpl = mockFetch(envelope(), 200, caps);
    await expect(exchange(fetchImpl)).rejects.toThrow('worker_not_ready');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  }
});
test('rejects exchanged session and Worker identity mismatches', async () => {
  for (const patch of [
    { sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { workerUrl: 'https://foreign.example' },
    { sessionSlug: 'beta' },
  ]) {
    await expect(exchange(mockFetch({ ...envelope(), ...patch }))).rejects.toThrow(/session_(identity_)?mismatch/);
  }
  await expect(exchange(mockFetch({ ...envelope(), sessionId: '' }))).rejects.toThrow('session_identity_missing');
});
test('does not echo source credentials from successful or failed replies', async () => {
  await expect(exchange(mockFetch({ ...envelope(), debug: TOKEN }))).rejects.toThrow('echoed_source_token');
  await expect(exchange(mockFetch({ reason: `invalid ${TOKEN}` }, 401))).rejects.toThrow(
    'agent_client_login_failed_401',
  );
  expect(readAgentClientLoginEnvelope(target)).toBeNull();
});
test('requires finite unexpired lifetimes for both credential purposes', async () => {
  for (const value of ['', 'invalid', '2020-01-01T00:00:00.000Z']) {
    const result = envelope();
    result.agentCredential.expiresAt = value;
    await expect(exchange(mockFetch(result))).rejects.toThrow('expired');
  }
});
test('does not restore credentials across a same-slug identity change', () => {
  writeAgentClientLoginEnvelope(envelope());
  expect(readAgentClientLoginEnvelope({ ...target, sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })).toBeNull();
  expect(readAgentClientLoginEnvelope(target)).toMatchObject(envelope());
});
