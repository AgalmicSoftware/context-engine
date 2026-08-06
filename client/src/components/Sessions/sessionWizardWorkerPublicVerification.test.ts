import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { verifySessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';

const SESSION_ID = '0x00000000000000000000000000000001';
const ADMIN = '0x00000000000000000000000000000000000000aa';
const WORKER_URL = 'https://worker.example.test';
const BROWSER_ORIGIN = 'https://app.example.test';

const buildRegistryWorkerConfig = (overrides: Record<string, unknown> = {}) => ({
  slug: 'registry-session',
  sessionId: SESSION_ID,
  adminAddress: ADMIN,
  corsWorkerUrl: WORKER_URL,
  allowOrigins: [BROWSER_ORIGIN],
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  ...overrides,
});

describe('verifySessionWizardWorkerPublicDeployment', () => {
  it('accepts the exact signed registry config without using Worker-canonical discovery', async () => {
    const config = buildRegistryWorkerConfig();
    const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const signAdminAction = jest.fn(async () => ({
      address: ADMIN,
      signature: '0xsigned',
      sessionSlug: 'must-not-override-the-signed-body',
      config: { slug: 'must-not-override-the-signed-body' },
    }));

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: WORKER_URL,
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config,
        isWorkerCanonical: false,
        signAdminAction,
        fetchImpl,
        browserOrigin: BROWSER_ORIGIN,
      }),
    ).resolves.toEqual({
      workerOrigin: WORKER_URL,
      configRevision: '',
      publicConfig: config,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${WORKER_URL}/admin/set-config`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body || '{}'));
    expect(requestBody).toEqual(
      expect.objectContaining({
        sessionSlug: 'registry-session',
        adminAddress: ADMIN,
        config,
        signature: '0xsigned',
      }),
    );
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('/session-config');
  });

  it.each([
    ['slug', { slug: 'other-session' }, /prepared Worker config.*session slug/i],
    ['session ID', { sessionId: '0x00000000000000000000000000000002' }, /prepared Worker config.*session ID/i],
    [
      'admin address',
      { adminAddress: '0x00000000000000000000000000000000000000bb' },
      /prepared Worker config.*admin/i,
    ],
    ['Worker origin', { corsWorkerUrl: 'https://other-worker.example.test' }, /prepared Worker config.*origin/i],
    ['browser origin', { allowOrigins: ['https://other-app.example.test'] }, /current browser origin/i],
    ['empty browser allowlist', { allowOrigins: [] }, /must allow the current browser origin/i],
    ['wildcard browser allowlist', { allowOrigins: ['*'] }, /exact browser origins/i],
    ['wildcard host allowlist', { allowOrigins: ['https://*.example.test'] }, /exact browser origins/i],
    [
      'authority profile',
      { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
      /must not claim a Worker-canonical or non-runtime profile/i,
    ],
    [
      'missing authority profile',
      { sessionModeProfile: {} },
      /must claim a selected non-Worker-canonical runtime profile/i,
    ],
  ])('rejects a mismatched prepared public %s before signing or transport', async (_label, overrides, expectedError) => {
    const fetchImpl = jest.fn();
    const signAdminAction = jest.fn(async () => ({ address: ADMIN, signature: '0xsigned' }));

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: WORKER_URL,
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config: buildRegistryWorkerConfig(overrides),
        isWorkerCanonical: false,
        signAdminAction,
        fetchImpl,
        browserOrigin: BROWSER_ORIGIN,
      }),
    ).rejects.toThrow(expectedError);

    expect(signAdminAction).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when config transport returns success without signed-write acceptance', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'projection pending' }), { status: 200 }));

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: WORKER_URL,
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config: buildRegistryWorkerConfig(),
        isWorkerCanonical: false,
        signAdminAction: async () => ({ address: ADMIN, signature: '0xsigned' }),
        fetchImpl,
        browserOrigin: BROWSER_ORIGIN,
      }),
    ).rejects.toThrow(/did not confirm acceptance/i);
  });

  it('rejects an empty Worker-canonical browser allowlist before signing', async () => {
    const signAdminAction = jest.fn(async () => ({ address: ADMIN, signature: '0xsigned' }));
    const fetchImpl = jest.fn();

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: WORKER_URL,
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config: buildRegistryWorkerConfig({
          allowOrigins: [],
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        }),
        isWorkerCanonical: true,
        signAdminAction,
        fetchImpl,
        browserOrigin: BROWSER_ORIGIN,
      }),
    ).rejects.toThrow(/must allow the current browser origin/i);

    expect(signAdminAction).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a malformed signer result before transport', async () => {
    const fetchImpl = jest.fn();

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: WORKER_URL,
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config: buildRegistryWorkerConfig(),
        isWorkerCanonical: false,
        signAdminAction: async () => null as unknown as Record<string, unknown>,
        fetchImpl,
        browserOrigin: BROWSER_ORIGIN,
      }),
    ).rejects.toThrow(/invalid authorization payload/i);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a signer that does not match the session admin before transport', async () => {
    const fetchImpl = jest.fn();

    await expect(
      verifySessionWizardWorkerPublicDeployment({
        workerUrl: WORKER_URL,
        slug: 'registry-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN,
        config: buildRegistryWorkerConfig(),
        isWorkerCanonical: false,
        signAdminAction: async () => ({
          address: '0x00000000000000000000000000000000000000bb',
          signature: '0xsigned',
        }),
        fetchImpl,
        browserOrigin: BROWSER_ORIGIN,
      }),
    ).rejects.toThrow(/signer.*session admin/i);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
