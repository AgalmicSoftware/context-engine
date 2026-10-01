import { ethers } from 'ethers';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { buildArweaveUploadBootstrapAuth } from './contractArweaveUploadRuntime.js';

jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

const mockedGetCorsProxyUrlOrThrow = jest.mocked(getCorsProxyUrlOrThrow);

describe('buildArweaveUploadBootstrapAuth', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('keeps the canonical session id attached to the nonce and upload auth', async () => {
    const signer = ethers.Wallet.createRandom();
    const sessionId = '0xb822b3eca85bdc35cf83cb947bceb6b2';
    const sessionConfig = {
      slug: 'demo-sh',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      sessionIdHex: sessionId,
      networkChainId: 11155420,
      corsWorkerUrl: 'https://demo-sh-worker.example.test',
    };
    mockedGetCorsProxyUrlOrThrow.mockResolvedValue('https://demo-sh-worker.example.test');
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ nonce: 'nonce-1', sessionSlug: 'demo-sh', sessionId }),
    })) as unknown as typeof fetch;

    const result = await buildArweaveUploadBootstrapAuth({
      signer,
      sessionSlug: 'demo-sh',
      sessionConfig,
    });

    expect(result?.message).toContain(
      `Resources:\n- https://demo-sh-worker.example.test\n- urn:context-engine:session:id:${sessionId}`,
    );
    expect(mockedGetCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: 'demo-sh', sessionConfig }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://demo-sh-worker.example.test/auth/nonce',
      expect.objectContaining({
        body: JSON.stringify({
          address: signer.address,
          sessionSlug: 'demo-sh',
          sessionId,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        address: signer.address,
        sessionSlug: 'demo-sh',
        sessionId,
      }),
    );
  });
  it('binds registry uploads to the slug even when metadata contains an ID', async () => {
    const signer = ethers.Wallet.createRandom();
    mockedGetCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example.test');
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ nonce: 'nonce-1' }),
    })) as unknown as typeof fetch;
    const auth = await buildArweaveUploadBootstrapAuth({
      signer,
      sessionSlug: 'sample',
      sessionConfig: { sessionIdHex: '0x44444444444444444444444444444444', networkChainId: 11155420 },
    });
    expect(auth?.message).toContain('urn:context-engine:session:slug:sample');
    expect(auth).not.toHaveProperty('sessionId');
  });
});
