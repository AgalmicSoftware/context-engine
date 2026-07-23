import {
  buildSessionWorkerBootstrapUrl,
  describeWorkerSessionBootstrapError,
  fetchWorkerCanonicalSessionBootstrap,
  findSecretLikeSessionWorkerBootstrapPath,
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
  parseSessionWorkerDiscoveryQuery,
  validateWorkerCanonicalSessionBootstrap,
  WorkerSessionBootstrapRequestError,
} from './sessionWorkerDiscovery';

const SESSION_ID = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const buildPayload = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  sessionSlug: 'session-a',
  config: {
    slug: 'session-a',
    sessionId: SESSION_ID,
    configRevision: 'revision-a',
    corsWorkerUrl: 'https://session-a.example.workers.dev',
    sessionModeProfile: {
      authority: { mode: 'worker_canonical' },
      encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    },
    workerAuthority: { participantScopes: ['ai', 'storage'] },
    ...overrides,
  },
});

describe('sessionWorkerDiscovery origin validation', () => {
  it('normalizes HTTPS origins without accepting path state', () => {
    expect(parseSessionWorkerDiscoveryOrigin('https://Worker.Example.COM:443/', { environment: 'production' })).toBe(
      'https://worker.example.com',
    );
    expect(parseSessionWorkerDiscoveryOrigin('https://8.8.8.8:8443', { environment: 'production' })).toBe(
      'https://8.8.8.8:8443',
    );
    expect(parseSessionWorkerDiscoveryOrigin('https://[2001:4860:4860::8888]', { environment: 'production' })).toBe(
      'https://[2001:4860:4860::8888]',
    );
  });

  it('accepts exactly one worker discovery query value', () => {
    expect(
      parseSessionWorkerDiscoveryQuery('?view=questions&worker=https%3A%2F%2Fworker.example.com', {
        environment: 'production',
      }),
    ).toBe('https://worker.example.com');
    expect(parseSessionWorkerDiscoveryQuery('?view=questions', { environment: 'production' })).toBe('');
    expect(() =>
      parseSessionWorkerDiscoveryQuery('?worker=&worker=https%3A%2F%2Fworker.example.com', {
        environment: 'production',
      }),
    ).toThrow(/exactly once/);
    expect(() => parseSessionWorkerDiscoveryQuery('?worker=', { environment: 'production' })).toThrow(/exactly once/);
  });

  it.each([
    'not-a-url',
    'ftp://worker.example.test',
    'https://user:password@127.0.0.1',
    'https://worker.example.test/path',
    'https://worker.example.test/%2e%2e',
    'https://worker.example.test?session=a',
    'https://worker.example.test/#fragment',
    'https://worker.example.test\\@127.0.0.1',
    ' http://localhost:8787',
  ])('rejects malformed or non-origin query value %s', (value) => {
    expect(() => parseSessionWorkerDiscoveryOrigin(value, { environment: 'production' })).toThrow();
  });

  it('allows HTTP loopback only outside production', () => {
    expect(parseSessionWorkerDiscoveryOrigin('http://localhost:8787', { environment: 'development' })).toBe(
      'http://localhost:8787',
    );
    expect(parseSessionWorkerDiscoveryOrigin('http://127.0.0.1:8787', { environment: 'test' })).toBe(
      'http://127.0.0.1:8787',
    );
    expect(parseSessionWorkerDiscoveryOrigin('http://[::1]:8787', { environment: 'test' })).toBe('http://[::1]:8787');
    expect(() => parseSessionWorkerDiscoveryOrigin('http://example.com', { environment: 'development' })).toThrow(
      /HTTPS/,
    );
    expect(() => parseSessionWorkerDiscoveryOrigin('http://localhost:8787', { environment: 'production' })).toThrow();
    expect(() => parseSessionWorkerDiscoveryOrigin('http://localhost:8787', { environment: 'Production' })).toThrow();
    expect(() => parseSessionWorkerDiscoveryOrigin('https://127.0.0.1', { environment: 'production' })).toThrow();
  });

  it.each([
    'https://0.0.0.0',
    'https://10.0.0.1',
    'https://100.64.0.1',
    'https://127.1',
    'https://0177.0.0.1',
    'https://0x7f000001',
    'https://2130706433',
    'https://168.63.129.16',
    'https://169.254.169.254',
    'https://172.16.0.1',
    'https://192.0.2.1',
    'https://192.168.1.1',
    'https://198.18.0.1',
    'https://198.51.100.1',
    'https://203.0.113.1',
    'https://224.0.0.1',
    'https://255.255.255.255',
    'https://[::]',
    'https://[::1]',
    'https://[::ffff:7f00:1]',
    'https://[::ffff:192.168.1.1]',
    'https://[fc00::1]',
    'https://[fe80::1]',
    'https://[ff02::1]',
    'https://[2001:db8::1]',
    'https://[2002:7f00:1::]',
    'https://metadata.google.internal',
    'https://instance-data.ec2.internal',
    'https://service.local',
    'https://single-label-host',
  ])('rejects private, loopback, link-local, reserved, or metadata target %s', (value) => {
    expect(() => parseSessionWorkerDiscoveryOrigin(value, { environment: 'production' })).toThrow(
      /local, private, or reserved/,
    );
  });
});

describe('sessionWorkerDiscovery bootstrap validation', () => {
  it('accepts an exact, secret-free worker-canonical response', () => {
    expect(
      validateWorkerCanonicalSessionBootstrap(buildPayload(), {
        expectedSlug: 'session-a',
        workerOrigin: 'https://session-a.example.workers.dev',
        environment: 'production',
      }),
    ).toEqual(
      expect.objectContaining({
        configRevision: 'revision-a',
        sessionId: SESSION_ID,
        sessionSlug: 'session-a',
        workerOrigin: 'https://session-a.example.workers.dev',
      }),
    );
  });

  it('canonicalizes UUID session identity to bytes16 hex and rejects conflicting identity fields', () => {
    const uuid = '3b241101-e2bb-4255-8caf-4136c566a962';
    expect(
      validateWorkerCanonicalSessionBootstrap(buildPayload({ sessionId: uuid }), {
        expectedSlug: 'session-a',
        workerOrigin: 'https://session-a.example.workers.dev',
        environment: 'production',
      }).sessionId,
    ).toBe('0x3b241101e2bb42558caf4136c566a962');
    expect(() =>
      validateWorkerCanonicalSessionBootstrap(
        buildPayload({ sessionId: uuid, sessionIdHex: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
        {
          expectedSlug: 'session-a',
          workerOrigin: 'https://session-a.example.workers.dev',
          environment: 'production',
        },
      ),
    ).toThrow(/conflicting session IDs/);
  });

  it('normalizes only non-zero bytes16 or UUID session identities', () => {
    expect(normalizeWorkerCanonicalSessionIdHex(SESSION_ID)).toBe(SESSION_ID);
    expect(normalizeWorkerCanonicalSessionIdHex('3b241101-e2bb-4255-8caf-4136c566a962')).toBe(
      '0x3b241101e2bb42558caf4136c566a962',
    );
    expect(normalizeWorkerCanonicalSessionIdHex('00000000-0000-0000-0000-000000000000')).toBe('');
    expect(normalizeWorkerCanonicalSessionIdHex('not-an-id')).toBe('');
  });

  it.each([
    ['envelope slug', { sessionSlug: 'session-b' }],
    ['config slug', { config: { ...buildPayload().config, slug: 'session-b' } }],
    ['session id', { config: { ...buildPayload().config, sessionId: 'not-an-id' } }],
    ['revision', { config: { ...buildPayload().config, configRevision: '' } }],
    ['oversized revision', { config: { ...buildPayload().config, configRevision: 'a'.repeat(129) } }],
    [
      'authority',
      {
        config: {
          ...buildPayload().config,
          sessionModeProfile: { authority: { mode: 'evm_registry_canonical' } },
        },
      },
    ],
    ['worker origin', { config: { ...buildPayload().config, corsWorkerUrl: 'https://other.example.workers.dev' } }],
  ])('rejects invalid %s', (_label, patch) => {
    expect(() =>
      validateWorkerCanonicalSessionBootstrap(
        { ...buildPayload(), ...patch },
        {
          expectedSlug: 'session-a',
          workerOrigin: 'https://session-a.example.workers.dev',
          environment: 'production',
        },
      ),
    ).toThrow();
  });

  it.each([
    ['secrets', { openaiKey: 'secret' }],
    ['storage.cloudflare.apiToken', { storage: { cloudflare: { apiToken: 'secret' } } }],
    ['storage.cloudflare.apiTokenPreview', { storage: { cloudflare: { apiTokenPreview: 'secret' } } }],
    ['items.0.litCredentials', { items: [{ litCredentials: { group: 'secret' } }] }],
    ['rpcUrlsByChainId', { rpcUrlsByChainId: { 1: ['https://rpc.example'] } }],
    ['faucet', { faucet: { enabled: false } }],
  ])('rejects recursive secret-like field %s', (_label, secretPatch) => {
    expect(findSecretLikeSessionWorkerBootstrapPath(secretPatch)).not.toBe('');
    expect(() =>
      validateWorkerCanonicalSessionBootstrap(buildPayload(secretPatch), {
        expectedSlug: 'session-a',
        workerOrigin: 'https://session-a.example.workers.dev',
        environment: 'production',
      }),
    ).toThrow(/secret-like field/);
  });

  it('rejects secret-like response-envelope fields outside config', () => {
    expect(() =>
      validateWorkerCanonicalSessionBootstrap(
        { ...buildPayload(), accessToken: 'must-not-be-accepted' },
        {
          expectedSlug: 'session-a',
          workerOrigin: 'https://session-a.example.workers.dev',
          environment: 'production',
        },
      ),
    ).toThrow(/response\.accessToken/);
  });

  it('keeps worker-envelope keyProvider and public AI model config valid', () => {
    expect(
      findSecretLikeSessionWorkerBootstrapPath({
        sessionModeProfile: { encryption: { keyProvider: 'worker_secret' } },
        storageProfile: {
          cloudflare: {
            credentialSource: 'worker_secret_or_cloudflare_binding',
            exposesWorkerToken: false,
          },
        },
        ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
      }),
    ).toBe('');
  });
});

describe('sessionWorkerDiscovery bootstrap fetch', () => {
  it('keeps the exported bootstrap URL builder on the same origin and slug validation boundary', () => {
    expect(
      buildSessionWorkerBootstrapUrl('https://worker.example.test/', 'session-a', { environment: 'production' }),
    ).toBe('https://worker.example.test/session-config?slug=session-a');
    expect(() =>
      buildSessionWorkerBootstrapUrl('https://127.0.0.1', 'session-a', { environment: 'production' }),
    ).toThrow();
    expect(() =>
      buildSessionWorkerBootstrapUrl('https://worker.example.test', '../session-a', { environment: 'production' }),
    ).toThrow();
  });

  it('uses an origin-scoped, credentialless, no-redirect request with exact slug in query and header', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify(buildPayload()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const result = await fetchWorkerCanonicalSessionBootstrap({
      fetchImpl,
      sessionSlug: 'session-a',
      workerQueryValue: 'https://session-a.example.workers.dev/',
      environment: 'production',
    });

    expect(buildSessionWorkerBootstrapUrl(result.workerOrigin, result.sessionSlug)).toBe(
      'https://session-a.example.workers.dev/session-config?slug=session-a',
    );
    expect(fetchImpl as jest.Mock).toHaveBeenCalledWith(
      'https://session-a.example.workers.dev/session-config?slug=session-a',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        mode: 'cors',
        referrerPolicy: 'no-referrer',
        headers: {
          Accept: 'application/json',
          'X-Session-Slug': 'session-a',
        },
      }),
    );
    expect(result.sessionId).toBe(SESSION_ID);
  });

  it('fails before fetch for unsafe origins and rejects HTTP or JSON failures', async () => {
    const unusedFetch = jest.fn();
    await expect(
      fetchWorkerCanonicalSessionBootstrap({
        fetchImpl: unusedFetch,
        sessionSlug: 'session-a',
        workerQueryValue: 'https://127.0.0.1',
        environment: 'production',
      }),
    ).rejects.toThrow();
    expect(unusedFetch).not.toHaveBeenCalled();

    await expect(
      fetchWorkerCanonicalSessionBootstrap({
        fetchImpl: jest.fn(async () => new Response('no', { status: 404 })),
        sessionSlug: 'session-a',
        workerQueryValue: 'https://session-a.example.workers.dev',
        environment: 'production',
      }),
    ).rejects.toThrow(/status 404/);

    await expect(
      fetchWorkerCanonicalSessionBootstrap({
        fetchImpl: jest.fn(async () => new Response('not-json', { status: 200 })),
        sessionSlug: 'session-a',
        workerQueryValue: 'https://session-a.example.workers.dev',
        environment: 'production',
      }),
    ).rejects.toThrow(/valid JSON/);
  });

  it('marks every server failure retryable while keeping client failures permanent', async () => {
    const request = (status: number) =>
      fetchWorkerCanonicalSessionBootstrap({
        fetchImpl: jest.fn(async () => new Response('no', { status })),
        sessionSlug: 'session-a',
        workerQueryValue: 'https://session-a.example.workers.dev',
        environment: 'production',
      });

    for (const status of [404, 408, 425, 429, 500, 503, 598, 599]) {
      const transient = await request(status).catch((error) => error);
      expect(transient).toBeInstanceOf(WorkerSessionBootstrapRequestError);
      expect(transient).toMatchObject({
        name: 'WorkerSessionBootstrapRequestError',
        retryable: true,
        status,
      });
    }
    for (const status of [400, 401, 403, 409]) {
      const permanent = await request(status).catch((error) => error);
      expect(permanent).toBeInstanceOf(WorkerSessionBootstrapRequestError);
      expect(permanent).toMatchObject({
        name: 'WorkerSessionBootstrapRequestError',
        retryable: false,
        status,
      });
    }
  });

  it('classifies CORS, reachability, missing config, and identity mismatch without exposing raw responses', async () => {
    const corsFetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const corsError = await fetchWorkerCanonicalSessionBootstrap({
      fetchImpl: corsFetch,
      sessionSlug: 'session-a',
      workerQueryValue: 'https://session-a.example.workers.dev',
      environment: 'production',
    }).catch((error) => error);
    expect(describeWorkerSessionBootstrapError(corsError)).toEqual(
      expect.objectContaining({ kind: 'cors', title: 'Browser origin not allowed', canRetry: true }),
    );

    const unreachableFetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const unreachableError = await fetchWorkerCanonicalSessionBootstrap({
      fetchImpl: unreachableFetch,
      sessionSlug: 'session-a',
      workerQueryValue: 'https://session-a.example.workers.dev',
      environment: 'production',
    }).catch((error) => error);
    expect(describeWorkerSessionBootstrapError(unreachableError)).toEqual(
      expect.objectContaining({ kind: 'unreachable', title: 'Session Worker unreachable', canRetry: true }),
    );

    const missingError = await fetchWorkerCanonicalSessionBootstrap({
      fetchImpl: jest.fn(async () => new Response('missing', { status: 404 })),
      sessionSlug: 'session-a',
      workerQueryValue: 'https://session-a.example.workers.dev',
      environment: 'production',
    }).catch((error) => error);
    expect(describeWorkerSessionBootstrapError(missingError)).toEqual(
      expect.objectContaining({ kind: 'missing_config', title: 'Canonical Worker config missing', canRetry: true }),
    );

    const identityError = await fetchWorkerCanonicalSessionBootstrap({
      fetchImpl: jest.fn(
        async () =>
          new Response(JSON.stringify({ ...buildPayload(), sessionSlug: 'other-session' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
      sessionSlug: 'session-a',
      workerQueryValue: 'https://session-a.example.workers.dev',
      environment: 'production',
    }).catch((error) => error);
    expect(describeWorkerSessionBootstrapError(identityError)).toEqual(
      expect.objectContaining({ kind: 'identity_mismatch', title: 'Worker identity mismatch', canRetry: false }),
    );
  });
});
