import {
  SESSION_STORAGE_BACKENDS,
  SESSION_STORAGE_CLOUDFLARE_PRIMITIVES,
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
  SESSION_STORAGE_PROFILE_DISPLAY_COPY,
  buildSessionStorageProfileDisplayDescriptor,
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
      generatedArtifacts: 'staged',
      media: 'staged',
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
    expect(profile.payloadAccessControl.gate).toBe('sbt_gate');
    expect(profile.payloadAccessControl.encryption).toBe('none');
    expect(profile.payloadAccessControl.mode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE);
    expect(profile.payloadAccessControl.enforcement).toBe('session_worker_sbt_gate');
    expect(profile.payloadAccessControl.resources.docsContext).toBe('docUploads');
    expect(profile.payloadAccessControl.resources.questions).toBe('questionResponses');
    expect(profile.payloadAccessControl.resources.responses).toBe('questionResponses');
    expect(profile.payloadAccessControl.resources.surveys).toBe('surveyResponses');
    expect(profile.payloadAccessControl.resources.generatedArtifacts).toBe('surveyResponses');
    expect(profile.sbtGatedAccess.litRequired).toBe('not_required_worker_enforced');
    expect(SESSION_STORAGE_CLOUDFLARE_PRIMITIVES).toEqual({
      r2: [
        'session_context_payloads',
        'question_payloads',
        'survey_payloads',
        'response_payloads',
        'media_blob_payloads',
      ],
      kv: [
        'metadata_indexes',
        'audit_events',
        'short_lived_action_ids',
        'webhook_replay_cache',
        'ephemeral_start_params',
      ],
      durableObjects: ['signer_runtime_coordination_only', 'coordination_locks'],
    });
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
    expect(profile.payloadAccessControl.gate).toBe('none');
    expect(profile.payloadAccessControl.encryption).toBe('lit');
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
    expect(profile.payloadAccessControl.gate).toBe('none');
    expect(profile.payloadAccessControl.encryption).toBe('none');
    expect(profile.payloadAccessControl.enforcement).toBe('session_worker_public_read');
    expect(profile.payloadAccessControl.litRequired).toBe(false);
    expect(profile.payloadAccessControl.label).toBe('Public-read Cloudflare payloads');
    expect(profile.sbtGatedAccess.litRequired).toBe('not_required_public_read');
    expect(profile.cloudflare.payloadAccessMode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ);
  });

  test('normalizes v2 worker_envelope payload access while keeping the legacy display mode', () => {
    const accessConditions = {
      match: 'any',
      conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }],
    };
    const profile = normalizeSessionStorageProfileConfig({
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope', accessConditions },
    });

    expect(profile.payloadAccessControl.gate).toBe('sbt_gate');
    expect(profile.payloadAccessControl.encryption).toBe('worker_envelope');
    expect(profile.payloadAccessControl.mode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE);
    expect(profile.payloadAccessControl.enforcement).toBe('session_worker_envelope_conditions');
    expect(profile.payloadAccessControl.label).toBe('Worker-envelope encrypted Cloudflare payloads');
    expect(profile.payloadAccessControl.accessConditions).toEqual(accessConditions);
    expect(profile.payloadAccessControl.litRequired).toBe(false);
    expect(profile.sbtGatedAccess.litRequired).toBe('not_required_worker_enforced');
    expect(profile.cloudflare.payloadAccessMode).toBe(SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE);
  });

  test('describes backend display options and helper copy', () => {
    const litArweave = buildSessionStorageProfileDisplayDescriptor({ backend: 'lit-arweave' });

    expect(litArweave.backendOptions).toEqual([
      { backend: SESSION_STORAGE_BACKENDS.ARWEAVE, label: 'Arweave', selected: false },
      { backend: SESSION_STORAGE_BACKENDS.LIT_ARWEAVE, label: 'Lit-Arweave', selected: true },
      { backend: SESSION_STORAGE_BACKENDS.CLOUDFLARE, label: 'Cloudflare', selected: false },
    ]);
    expect(litArweave.backendHelperText).toBe(SESSION_STORAGE_PROFILE_DISPLAY_COPY.litArweave);
    expect(litArweave.showCloudflarePayloadAccessControls).toBe(false);
    expect(litArweave.cloudflarePayloadAccessOptions).toEqual([]);
  });

  test('describes Cloudflare payload access mode display options and helper copy', () => {
    const publicRead = buildSessionStorageProfileDisplayDescriptor({
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'public_read' },
    });
    const litEncrypted = buildSessionStorageProfileDisplayDescriptor({
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    });
    const workerSbtGate = buildSessionStorageProfileDisplayDescriptor({
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'worker_sbt_gate' },
    });

    expect(publicRead.backendHelperText).toBe(SESSION_STORAGE_PROFILE_DISPLAY_COPY.cloudflare);
    expect(publicRead.showCloudflarePayloadAccessControls).toBe(true);
    expect(publicRead.cloudflarePayloadAccessOptions).toEqual([
      { mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ, label: 'Public read', selected: true },
      { mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE, label: 'Worker SBT gate', selected: false },
      { mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED, label: 'Lit encrypted', selected: false },
    ]);
    expect(publicRead.cloudflarePayloadAccessHelperText).toBe(SESSION_STORAGE_PROFILE_DISPLAY_COPY.publicRead);
    expect(litEncrypted.cloudflarePayloadAccessHelperText).toBe(SESSION_STORAGE_PROFILE_DISPLAY_COPY.litEncrypted);
    expect(workerSbtGate.cloudflarePayloadAccessHelperText).toBe(SESSION_STORAGE_PROFILE_DISPLAY_COPY.workerSbtGate);
  });
});
