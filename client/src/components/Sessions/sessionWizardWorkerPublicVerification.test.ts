import { verifySessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';

const SESSION_ID = '0x00000000000000000000000000000001';
const ADMIN = '0x00000000000000000000000000000000000000aa';

describe('verifySessionWizardWorkerPublicDeployment', () => {
  it('writes and reads a legacy/registry Worker through credentialless browser-origin requests', async () => {
    const config = {
      slug: 'registry-session',
      sessionId: SESSION_ID,
      corsWorkerUrl: 'https://worker.example.test',
      allowOrigins: ['https://app.example.test'],
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ config }), { status: 200 }));
    const signAdminAction = jest.fn(async () => ({ address: ADMIN, signature: '0xsigned' }));

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: 'https://worker.example.test',
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config,
        isWorkerCanonical: false,
        signAdminAction,
        fetchImpl,
        browserOrigin: 'https://app.example.test',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        workerOrigin: 'https://worker.example.test',
        publicConfig: config,
      }),
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://worker.example.test/session-config?slug=registry-session',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it.each([
    [
      'slug',
      {
        slug: 'other-session',
        sessionId: SESSION_ID,
        corsWorkerUrl: 'https://worker.example.test',
        allowOrigins: ['https://app.example.test'],
      },
      /another session slug/i,
    ],
    [
      'session ID',
      {
        slug: 'registry-session',
        sessionId: '0x00000000000000000000000000000002',
        corsWorkerUrl: 'https://worker.example.test',
        allowOrigins: ['https://app.example.test'],
      },
      /another session ID/i,
    ],
    [
      'Worker origin',
      {
        slug: 'registry-session',
        sessionId: SESSION_ID,
        corsWorkerUrl: 'https://other-worker.example.test',
        allowOrigins: ['https://app.example.test'],
      },
      /another Worker origin/i,
    ],
    [
      'browser origin',
      {
        slug: 'registry-session',
        sessionId: SESSION_ID,
        corsWorkerUrl: 'https://worker.example.test',
        allowOrigins: ['https://other-app.example.test'],
      },
      /current browser origin/i,
    ],
  ])('rejects a mismatched public %s readback', async (_label, publicConfig, expectedError) => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ config: publicConfig }), { status: 200 }));

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: 'https://worker.example.test',
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config: publicConfig,
        isWorkerCanonical: false,
        signAdminAction: async () => ({ address: ADMIN, signature: '0xsigned' }),
        fetchImpl,
        browserOrigin: 'https://app.example.test',
      }),
    ).rejects.toThrow(expectedError);
  });
});
