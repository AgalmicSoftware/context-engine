import {
  SESSION_STORAGE_BACKENDS,
  SESSION_STORAGE_CLOUDFLARE_PRIMITIVES,
  buildDefaultSessionStorageProfile,
  normalizeSessionStorageProfileConfig,
} from './sessionWizardStorageProfile';

describe('sessionWizardStorageProfile', () => {
  test('defaults new sessions to Arweave with docs/context active first', () => {
    const profile = buildDefaultSessionStorageProfile();

    expect(profile.backend).toBe(SESSION_STORAGE_BACKENDS.ARWEAVE);
    expect(profile.sessionOwned).toBe(true);
    expect(profile.telegramOwned).toBe(false);
    expect(profile.resources).toEqual({
      docsContext: 'active',
      questions: 'staged',
      surveys: 'staged',
      responses: 'staged',
      images: 'staged',
    });
    expect(profile.sbtGatedAccess.litRequired).toBe('payload_encrypted_only');
    expect(profile.cloudflare).toBeNull();
  });

  test('models explicit Cloudflare profile with R2 D1 KV and Durable Object primitives', () => {
    const profile = normalizeSessionStorageProfileConfig({
      backend: 'cloudflare',
      sbtGatedAccess: {
        uploads: 'session_worker_gate',
        downloads: 'session_worker_gate',
      },
    });

    expect(profile.backend).toBe(SESSION_STORAGE_BACKENDS.CLOUDFLARE);
    expect(profile.sessionOwned).toBe(true);
    expect(profile.telegramOwned).toBe(false);
    expect(profile.resources.docsContext).toBe('active');
    expect(profile.sbtGatedAccess.litRequired).toBe('payload_encrypted_only');
    expect(profile.cloudflare.primitives).toEqual(SESSION_STORAGE_CLOUDFLARE_PRIMITIVES);
    expect(profile.cloudflare.exposesAccountId).toBe(false);
    expect(profile.cloudflare.exposesBucketName).toBe(false);
    expect(profile.cloudflare.exposesWorkerToken).toBe(false);
    expect(profile.cloudflare.exposesRawStoragePath).toBe(false);
    expect(profile.cloudflare.exposesLongLivedUrl).toBe(false);
    expect(JSON.stringify(profile)).not.toMatch(new RegExp('bucket-name|cf-token|r2://', 'i'));
  });
});
