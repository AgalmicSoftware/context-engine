import {
  clearAgentClientLoginEnvelope,
  exchangeAgentClientLogin,
  extractAgentClientToken,
  readAgentClientLoginEnvelope,
  writeAgentClientLoginEnvelope,
} from './agentClientLogin';

const RAW_TOKEN = 'ceagt_abcdefghijklmnopqrstuvwxyz123456';

describe('agentClientLogin', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/session/alpha');
  });

  it('validates raw tokens and token links without accepting unrelated input', () => {
    expect(extractAgentClientToken(RAW_TOKEN)).toEqual({ ok: true, token: RAW_TOKEN });
    expect(extractAgentClientToken(`https://bot.example/login?token=${RAW_TOKEN}`)).toEqual({
      ok: true,
      token: RAW_TOKEN,
    });
    expect(extractAgentClientToken('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(extractAgentClientToken(`${RAW_TOKEN}\nsecond-line`)).toMatchObject({ ok: false, reason: 'multiline' });
    expect(extractAgentClientToken('https://example.test/no-token')).toMatchObject({ ok: false, reason: 'unsupported_format' });
  });

  it('exchanges a raw token once and persists only the short-lived envelope in sessionStorage', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      tokenType: 'session_worker_jwt',
      sessionSlug: 'alpha',
      accountAddress: '0x1111111111111111111111111111111111111111',
      workerUrl: 'https://session-worker.example',
      workerToken: 'jwt-session-token',
      expiresAt: '2027-07-05T00:00:00.000Z',
      buckets: {
        categories: [{ categoryId: 'role', label: 'Role', options: [{ optionId: 'builder', label: 'Builder' }] }],
        selections: { role: ['builder'] },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as jest.Mock;

    const envelope = await exchangeAgentClientLogin({
      agentBridgeUrl: 'https://bridge.example/',
      sessionSlug: 'alpha',
      tokenOrLink: RAW_TOKEN,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bridge.example/api/agent/client-login/exchange',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(RAW_TOKEN),
      }),
    );
    expect(envelope.credential.token).toBe('jwt-session-token');
    expect(envelope.buckets).toBeTruthy();

    expect(JSON.stringify(window.localStorage)).not.toContain(RAW_TOKEN);
    expect(window.location.href).not.toContain(RAW_TOKEN);
    const persistedValues = Object.values(window.sessionStorage);
    expect(persistedValues.join('\n')).not.toContain(RAW_TOKEN);
    expect(persistedValues.join('\n')).toContain('jwt-session-token');
    expect(readAgentClientLoginEnvelope('alpha')?.buckets).toBeNull();
  });

  it('rejects responses that echo the source token as the exchanged credential', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      sessionSlug: 'alpha',
      workerToken: RAW_TOKEN,
      expiresAt: '2027-07-05T00:00:00.000Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(exchangeAgentClientLogin({
      agentBridgeUrl: 'https://bridge.example',
      sessionSlug: 'alpha',
      tokenOrLink: RAW_TOKEN,
      fetchImpl,
    })).rejects.toThrow('telegram_client_login_echoed_source_token');
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain(RAW_TOKEN);
  });

  it('rejects responses that echo the source token anywhere in the envelope body', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      ok: true,
      sessionSlug: 'alpha',
      workerToken: 'jwt-session-token',
      expiresAt: '2027-07-05T00:00:00.000Z',
      buckets: { debugEcho: RAW_TOKEN },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(exchangeAgentClientLogin({
      agentBridgeUrl: 'https://bridge.example',
      sessionSlug: 'alpha',
      tokenOrLink: RAW_TOKEN,
      fetchImpl,
    })).rejects.toThrow('telegram_client_login_echoed_source_token');
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
