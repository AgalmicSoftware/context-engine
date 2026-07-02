import {
  bindAdminWorkerPorts,
  type AdminWorkerAuthModule,
  type AdminWorkerCorsOriginsModule,
  type AdminWorkerCorsProxyModule,
} from './adminWorkerPorts';

describe('admin worker ports', () => {
  it('resolves worker URLs and CORS origins with call-time module lookup', async () => {
    const firstCorsProxy: AdminWorkerCorsProxyModule = {
      resolveCorsProxyUrl: jest.fn(async () => ({ url: 'https://first.worker.test' })),
    };
    const secondCorsProxy: AdminWorkerCorsProxyModule = {
      resolveCorsProxyUrl: jest.fn(async () => ({ url: 'https://second.worker.test' })),
    };
    const firstOrigins: AdminWorkerCorsOriginsModule = {
      buildWorkerAllowOrigins: jest.fn(() => ['https://first.example']),
    };
    const secondOrigins: AdminWorkerCorsOriginsModule = {
      buildWorkerAllowOrigins: jest.fn(() => ['https://second.example']),
    };
    let corsProxy = firstCorsProxy;
    let corsOrigins = firstOrigins;
    const ports = bindAdminWorkerPorts({
      corsProxy: () => corsProxy,
      corsOrigins: () => corsOrigins,
      workerAuth: () => ({
        normalizeWorkerUrl: jest.fn((value) => `normalized:${value}`),
        buildSignedBootstrapAdminAuth: jest.fn(),
        buildSignedAdminActionAuth: jest.fn(),
        buildSiweMessage: jest.fn(),
        fetchWorkerWithAuth: jest.fn(),
      }),
      fetchImpl: () => jest.fn(),
    });

    await expect(ports.workerUrl.resolveCorsProxyUrl({
      sessionSlug: 'edge',
      sessionConfig: { slug: 'edge' },
      context: { account: '' },
    })).resolves.toEqual({ url: 'https://first.worker.test' });

    corsProxy = secondCorsProxy;
    corsOrigins = secondOrigins;

    expect(ports.workerUrl.buildWorkerAllowOrigins({
      currentOrigin: 'https://app.example',
      extraOrigins: ['https://extra.example'],
    })).toEqual(['https://second.example']);
    expect(ports.workerUrl.normalizeWorkerUrl(' https://worker.example.test/ '))
      .toBe('normalized: https://worker.example.test/ ');

    expect(firstCorsProxy.resolveCorsProxyUrl).toHaveBeenCalledWith({
      sessionSlug: 'edge',
      sessionConfig: { slug: 'edge' },
      context: { account: '' },
    });
    expect(secondOrigins.buildWorkerAllowOrigins).toHaveBeenCalledWith({
      currentOrigin: 'https://app.example',
      extraOrigins: ['https://extra.example'],
    });
  });

  it('routes signed admin actions and worker fetches through late workerAuth lookup', async () => {
    const firstWorkerAuth: AdminWorkerAuthModule = {
      normalizeWorkerUrl: jest.fn(),
      buildSignedBootstrapAdminAuth: jest.fn(async () => ({ signature: '0xfirstBootstrap' })),
      buildSignedAdminActionAuth: jest.fn(async () => ({ signature: '0xfirst' })),
      buildSiweMessage: jest.fn(() => 'first-message'),
      fetchWorkerWithAuth: jest.fn(async () => ({ ok: true, status: 200 })),
    };
    const secondWorkerAuth: AdminWorkerAuthModule = {
      normalizeWorkerUrl: jest.fn(),
      buildSignedBootstrapAdminAuth: jest.fn(async () => ({ signature: '0xsecondBootstrap' })),
      buildSignedAdminActionAuth: jest.fn(async () => ({ signature: '0xsecond' })),
      buildSiweMessage: jest.fn(() => 'second-message'),
      fetchWorkerWithAuth: jest.fn(async () => ({ ok: true, status: 201 })),
    };
    let workerAuth = firstWorkerAuth;
    const ports = bindAdminWorkerPorts({
      corsProxy: () => ({ resolveCorsProxyUrl: jest.fn() }),
      corsOrigins: () => ({ buildWorkerAllowOrigins: jest.fn() }),
      workerAuth: () => workerAuth,
      fetchImpl: () => jest.fn(),
    });
    const authInput = {
      action: 'set-config',
      slug: 'edge',
      body: { allowOrigins: ['https://app.example'] },
      workerUrl: 'https://worker.example.test',
      context: { account: '0xabc' },
    };

    await expect(ports.adminAuth.buildSignedAdminActionAuth(authInput))
      .resolves.toEqual({ signature: '0xfirst' });
    await expect(ports.adminAuth.buildSignedBootstrapAdminAuth({
      slug: 'edge',
      workerUrl: 'https://worker.example.test',
      context: { account: '0xabc' },
    })).resolves.toEqual({ signature: '0xfirstBootstrap' });

    workerAuth = secondWorkerAuth;

    await expect(ports.adminAuth.fetchWorkerWithAuth(
      'https://worker.example.test/ai',
      { method: 'POST' },
      { sessionSlug: 'edge', workerUrl: 'https://worker.example.test' }
    )).resolves.toEqual({ ok: true, status: 201 });

    expect(firstWorkerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(authInput);
    expect(firstWorkerAuth.buildSignedBootstrapAdminAuth).toHaveBeenCalledWith({
      slug: 'edge',
      workerUrl: 'https://worker.example.test',
      context: { account: '0xabc' },
    });
    expect(secondWorkerAuth.fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.test/ai',
      { method: 'POST' },
      { sessionSlug: 'edge', workerUrl: 'https://worker.example.test' }
    );
  });

  it('prepares SIWE login by fetching the nonce and returning the exact workerAuth message', async () => {
    const buildSiweMessage = jest.fn(() => 'byte-exact-siwe-message');
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ nonce: ' nonce-123 ' }),
    }));
    const ports = bindAdminWorkerPorts({
      corsProxy: () => ({ resolveCorsProxyUrl: jest.fn() }),
      corsOrigins: () => ({ buildWorkerAllowOrigins: jest.fn() }),
      workerAuth: () => ({
        normalizeWorkerUrl: jest.fn(),
        buildSignedBootstrapAdminAuth: jest.fn(),
        buildSignedAdminActionAuth: jest.fn(),
        buildSiweMessage,
        fetchWorkerWithAuth: jest.fn(),
      }),
      fetchImpl: () => fetchImpl,
    });

    await expect(ports.siweLogin.prepareSiweLogin({
      workerUrl: 'https://worker.example.test',
      address: '0x00000000000000000000000000000000000000aa',
      sessionSlug: 'edge',
      chainId: 84532,
      statement: 'Sign in to Context Engine.',
    })).resolves.toEqual({
      nonce: ' nonce-123 ',
      nonceData: { nonce: ' nonce-123 ' },
      message: 'byte-exact-siwe-message',
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example.test/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: '0x00000000000000000000000000000000000000aa',
        sessionSlug: 'edge',
      }),
    });
    expect(buildSiweMessage).toHaveBeenCalledWith({
      address: '0x00000000000000000000000000000000000000aa',
      nonce: ' nonce-123 ',
      chainId: 84532,
      statement: 'Sign in to Context Engine.',
    });
  });

  it('surfaces nonce request failures without signing a message', async () => {
    const buildSiweMessage = jest.fn(() => 'should-not-run');
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'nonce unavailable' }),
    }));
    const ports = bindAdminWorkerPorts({
      corsProxy: () => ({ resolveCorsProxyUrl: jest.fn() }),
      corsOrigins: () => ({ buildWorkerAllowOrigins: jest.fn() }),
      workerAuth: () => ({
        normalizeWorkerUrl: jest.fn(),
        buildSignedBootstrapAdminAuth: jest.fn(),
        buildSignedAdminActionAuth: jest.fn(),
        buildSiweMessage,
        fetchWorkerWithAuth: jest.fn(),
      }),
      fetchImpl: () => fetchImpl,
    });

    await expect(ports.siweLogin.prepareSiweLogin({
      workerUrl: 'https://worker.example.test',
      address: '0x00000000000000000000000000000000000000aa',
      sessionSlug: 'edge',
      chainId: 84532,
    })).rejects.toThrow('nonce unavailable');
    expect(buildSiweMessage).not.toHaveBeenCalled();
  });
});
