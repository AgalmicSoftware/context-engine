import {
  __test__agentClientStorageKey,
  clearAgentClientLoginEnvelope,
  exchangeAgentClientLogin,
  extractAgentClientToken,
  readAgentClientLoginEnvelope,
  writeAgentClientLoginEnvelope,
} from './agentClientLogin';

const RAW_TOKEN = 'ceagt_abcdefghijklmnopqrstuvwxyz123456';
const SESSION_ID = '0x1234567890abcdef1234567890abcdef';
const WORKER_URL = 'https://session-worker.example';
const BRIDGE_URL = 'https://bridge.example';

describe('agentClientLogin', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAgentClientLoginEnvelope('alpha');
    window.history.replaceState({}, '', '/session/alpha');
  });

  it('accepts only raw tokens so bearer credentials never enter URLs', () => {
    expect(extractAgentClientToken(RAW_TOKEN)).toEqual({ ok: true, token: RAW_TOKEN });
    expect(extractAgentClientToken(`https://bot.example/login?token=${RAW_TOKEN}`)).toMatchObject({
      ok: false,
      reason: 'unsupported_format',
    });
    expect(extractAgentClientToken('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(extractAgentClientToken(`${RAW_TOKEN}\nsecond-line`)).toMatchObject({ ok: false, reason: 'multiline' });
    expect(extractAgentClientToken('https://example.test/no-token')).toMatchObject({
      ok: false,
      reason: 'unsupported_format',
    });
  });

  it('exchanges a raw token once and reuses the exact envelope only from page memory', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            accountAddress: '0x1111111111111111111111111111111111111111',
            workerUrl: 'https://session-worker.example',
            bridgeCredential: {
              kind: 'agent_bridge_browser_token',
              token: 'bridge-browser-token',
            },
            workerCredential: {
              kind: 'session_worker_jwt',
              token: 'jwt-session-token',
            },
            capabilities: {
              readQuestions: true,
              readResults: true,
              submitAnswers: false,
              admin: false,
              export: false,
              readGroups: true,
            },
            expiresAt: '2027-07-05T00:00:00.000Z',
            buckets: {
              categories: [{ categoryId: 'role', label: 'Role', options: [{ optionId: 'builder', label: 'Builder' }] }],
              selections: { role: ['builder'] },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ) as unknown as jest.MockedFunction<typeof fetch>;

    const envelope = await exchangeAgentClientLogin({
      agentBridgeUrl: `${BRIDGE_URL}/`,
      sessionId: SESSION_ID,
      sessionSlug: 'alpha',
      tokenOrLink: RAW_TOKEN,
      workerUrl: WORKER_URL,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bridge.example/api/agent/client-login/exchange',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(RAW_TOKEN),
      }),
    );
    expect(envelope).toMatchObject({
      sessionId: SESSION_ID,
      sessionSlug: 'alpha',
      bridgeCredential: {
        kind: 'agent_bridge_browser_token',
        token: 'bridge-browser-token',
      },
      workerCredential: {
        kind: 'session_worker_jwt',
        token: 'jwt-session-token',
      },
      capabilities: {
        readQuestions: true,
        readResults: true,
        submitAnswers: false,
        admin: false,
        export: false,
        readGroups: true,
      },
    });
    expect(envelope.buckets).toBeTruthy();

    expect(JSON.stringify(window.localStorage)).not.toContain(RAW_TOKEN);
    expect(window.location.href).not.toContain(RAW_TOKEN);
    const persistedValues = Object.values(window.sessionStorage);
    expect(persistedValues.join('\n')).not.toContain(RAW_TOKEN);
    expect(persistedValues.join('\n')).not.toContain('bridge-browser-token');
    expect(persistedValues.join('\n')).not.toContain('jwt-session-token');
    expect(window.sessionStorage.length).toBe(0);
    expect(
      readAgentClientLoginEnvelope({
        sessionSlug: 'alpha',
        sessionId: SESSION_ID,
        workerUrl: WORKER_URL,
        agentBridgeUrl: BRIDGE_URL,
      }),
    ).toMatchObject({
      sessionId: SESSION_ID,
      sessionSlug: 'alpha',
      capabilities: { readGroups: true },
      buckets: null,
    });
  });

  it('never copies an echoed bearer credential into client-login error text', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, reason: `invalid credential ${RAW_TOKEN}` }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as jest.MockedFunction<typeof fetch>;

    let message = '';
    try {
      await exchangeAgentClientLogin({
        agentBridgeUrl: BRIDGE_URL,
        sessionId: SESSION_ID,
        sessionSlug: 'alpha',
        tokenOrLink: RAW_TOKEN,
        workerUrl: WORKER_URL,
        fetchImpl,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe('telegram_client_login_failed_401');
    expect(message).not.toContain(RAW_TOKEN);
  });

  it('purges and ignores a still-live exact envelope left by a previous client version', () => {
    const target = {
      sessionSlug: 'alpha',
      sessionId: SESSION_ID,
      workerUrl: WORKER_URL,
      agentBridgeUrl: BRIDGE_URL,
    };
    window.sessionStorage.setItem(
      __test__agentClientStorageKey(target),
      JSON.stringify({
        v: 2,
        ...target,
        expiresAt: '2027-07-05T00:00:00.000Z',
        address: '0x1111111111111111111111111111111111111111',
        capabilities: { readGroups: true },
        bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'persisted-bridge-token' },
        workerCredential: { kind: 'session_worker_jwt', token: 'persisted-worker-token' },
      }),
    );

    expect(readAgentClientLoginEnvelope(target)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('rejects a groups-capable exchanged envelope without an exact canonical session identity', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionSlug: 'alpha',
            accountAddress: '0x1111111111111111111111111111111111111111',
            bridgeCredential: {
              kind: 'agent_bridge_browser_token',
              token: 'bridge-browser-token',
            },
            workerCredential: {
              kind: 'session_worker_jwt',
              token: 'jwt-session-token',
            },
            capabilities: {
              readQuestions: true,
              readGroups: true,
            },
            expiresAt: '2027-07-05T00:00:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(
      exchangeAgentClientLogin({
        agentBridgeUrl: BRIDGE_URL,
        sessionId: SESSION_ID,
        sessionSlug: 'alpha',
        tokenOrLink: RAW_TOKEN,
        workerUrl: WORKER_URL,
        fetchImpl,
      }),
    ).rejects.toThrow('telegram_client_login_session_identity_missing');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears a stored groups-capable envelope whose canonical session identity is missing', () => {
    window.sessionStorage.setItem(
      'ce:agentClientLogin:v2:alpha',
      JSON.stringify({
        v: 2,
        sessionSlug: 'alpha',
        expiresAt: '2027-07-05T00:00:00.000Z',
        address: '0x1111111111111111111111111111111111111111',
        capabilities: { readGroups: true },
        bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'bridge-browser-token' },
        workerCredential: { kind: 'session_worker_jwt', token: 'jwt-session-token' },
      }),
    );

    expect(readAgentClientLoginEnvelope('alpha')).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('preserves legacy non-groups envelopes without a canonical session identity', () => {
    writeAgentClientLoginEnvelope({
      v: 2,
      sessionSlug: 'alpha',
      expiresAt: '2027-07-05T00:00:00.000Z',
      address: '0x1111111111111111111111111111111111111111',
      capabilities: { readQuestions: true, readResults: true },
      bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'legacy-bridge-token' },
      workerCredential: { kind: 'session_worker_jwt', token: 'legacy-worker-token' },
    });

    expect(readAgentClientLoginEnvelope('alpha')).toMatchObject({
      sessionSlug: 'alpha',
      capabilities: { readQuestions: true, readResults: true },
    });
    expect(readAgentClientLoginEnvelope('alpha')?.sessionId).toBeUndefined();
  });

  it('does not restore a groups credential after the same slug moves to another Worker identity', () => {
    writeAgentClientLoginEnvelope({
      v: 2,
      sessionId: SESSION_ID,
      sessionSlug: 'alpha',
      expiresAt: '2027-07-05T00:00:00.000Z',
      address: '0x1111111111111111111111111111111111111111',
      capabilities: { readGroups: true },
      bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'old-bridge-token' },
      workerCredential: { kind: 'session_worker_jwt', token: 'old-worker-token' },
      workerUrl: WORKER_URL,
      agentBridgeUrl: BRIDGE_URL,
    });

    expect(
      readAgentClientLoginEnvelope({
        sessionSlug: 'alpha',
        sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        workerUrl: 'https://replacement-worker.example',
        agentBridgeUrl: BRIDGE_URL,
      }),
    ).toBeNull();
    expect(
      readAgentClientLoginEnvelope({
        sessionSlug: 'alpha',
        sessionId: SESSION_ID,
        workerUrl: WORKER_URL,
        agentBridgeUrl: BRIDGE_URL,
      }),
    ).toMatchObject({ workerCredential: { token: 'old-worker-token' } });
  });

  it('rejects responses that echo the source token as the exchanged credential', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionSlug: 'alpha',
            workerToken: RAW_TOKEN,
            expiresAt: '2027-07-05T00:00:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(
      exchangeAgentClientLogin({
        agentBridgeUrl: 'https://bridge.example',
        sessionSlug: 'alpha',
        tokenOrLink: RAW_TOKEN,
        fetchImpl,
      }),
    ).rejects.toThrow('telegram_client_login_echoed_source_token');
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain(RAW_TOKEN);
  });

  it('rejects responses that echo the source token anywhere in the envelope body', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionSlug: 'alpha',
            workerToken: 'jwt-session-token',
            expiresAt: '2027-07-05T00:00:00.000Z',
            buckets: { debugEcho: RAW_TOKEN },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(
      exchangeAgentClientLogin({
        agentBridgeUrl: 'https://bridge.example',
        sessionSlug: 'alpha',
        tokenOrLink: RAW_TOKEN,
        fetchImpl,
      }),
    ).rejects.toThrow('telegram_client_login_echoed_source_token');
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain(RAW_TOKEN);
  });

  it('clears expired stored envelopes into the re-paste flow', () => {
    writeAgentClientLoginEnvelope({
      v: 1,
      sessionSlug: 'alpha',
      expiresAt: '2020-01-01T00:00:00.000Z',
      address: '0x1111111111111111111111111111111111111111',
      capabilities: { readQuestions: true },
      credential: { kind: 'session_worker_jwt', token: 'expired-jwt' },
    });

    expect(readAgentClientLoginEnvelope('alpha')).toBeNull();
    clearAgentClientLoginEnvelope('alpha');
    expect(window.sessionStorage.length).toBe(0);
  });
});
