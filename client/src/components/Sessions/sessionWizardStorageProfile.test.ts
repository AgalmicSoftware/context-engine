import {
  SESSION_STORAGE_BACKENDS,
  SESSION_STORAGE_CLOUDFLARE_PRIMITIVES,
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
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



  test('keeps lit-arweave available as a per-session storage backend', () => {
    const profile = normalizeSessionStorageProfileConfig({ backend: 'lit-arweave' });

    expect(profile.backend).toBe(SESSION_STORAGE_BACKENDS.LIT_ARWEAVE);
    expect(profile.resources.docsContext).toBe('active');
    expect(profile.resources.media).toBe('staged');
    expect(profile.resources.generatedArtifacts).toBe('staged');
    expect(profile.sbtGatedAccess.litRequired).toBe('payload_encrypted_only');
    expect(profile.cloudflare).toBeNull();
  });

  test('models explicit Cloudflare profile with worker-enforced payload access by default', () => {
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
    expect(profile.resources.questions).toBe('active');
    expect(profile.resources.surveys).toBe('active');
    expect(profile.resources.responses).toBe('active');
    expect(profile.payloadAccessControl.mode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE);
    expect(profile.payloadAccessControl.enforcement).toBe('session_worker_sbt_gate');
    expect(profile.payloadAccessControl.resources.docsContext).toBe('docUploads');
    expect(profile.payloadAccessControl.resources.questions).toBe('questionResponses');
    expect(profile.payloadAccessControl.resources.responses).toBe('questionResponses');
    expect(profile.payloadAccessControl.resources.surveys).toBe('surveyResponses');
    expect(profile.payloadAccessControl.resources.generatedArtifacts).toBe('surveyResponses');
    expect(profile.sbtGatedAccess.litRequired).toBe('not_required_worker_enforced');
    expect(profile.cloudflare.primitives).toEqual(SESSION_STORAGE_CLOUDFLARE_PRIMITIVES);
    expect(profile.cloudflare.payloadAccessMode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE);
    expect(profile.cloudflare.exposesAccountId).toBe(false);
    expect(profile.cloudflare.exposesBucketName).toBe(false);
    expect(profile.cloudflare.exposesWorkerToken).toBe(false);
    expect(profile.cloudflare.exposesRawStoragePath).toBe(false);
    expect(profile.cloudflare.exposesLongLivedUrl).toBe(false);
    expect(JSON.stringify(profile)).not.toMatch(new RegExp('bucket-name|cf-token|r2://', 'i'));
  });

  test('keeps lit_encrypted Cloudflare payload access as an explicit stronger mode scaffold', () => {
    const profile = normalizeSessionStorageProfileConfig({
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    });

    expect(profile.payloadAccessControl.mode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED);
    expect(profile.payloadAccessControl.enforcement).toBe('lit_access_control_conditions');
    expect(profile.payloadAccessControl.litRequired).toBe(true);
    expect(profile.sbtGatedAccess.litRequired).toBe('required_for_cloudflare_payload_encryption');
    expect(profile.cloudflare.payloadAccessMode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED);
  });

  test('models public_read Cloudflare payload access without Lit or SBT-gated reads', () => {
    const profile = normalizeSessionStorageProfileConfig({
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'public_read' },
    });

    expect(profile.payloadAccessControl.mode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ);
    expect(profile.payloadAccessControl.enforcement).toBe('session_worker_public_read');
    expect(profile.payloadAccessControl.litRequired).toBe(false);
    expect(profile.payloadAccessControl.label).toBe('Public-read Cloudflare payloads');
    expect(profile.sbtGatedAccess.litRequired).toBe('not_required_public_read');
    expect(profile.cloudflare.payloadAccessMode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ);
  });
});
