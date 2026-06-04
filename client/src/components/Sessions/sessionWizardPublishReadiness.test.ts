import {
  resolveSessionWizardPublishReadiness,
  type SessionWizardPublishReadinessInput,
} from './sessionWizardPublishReadiness';

const txId = 'a'.repeat(43);

const baseInput: SessionWizardPublishReadinessInput = {
  resolvedWorkerBaseUrl: 'https://worker.example',
  workerMode: 'default',
  usesDefaultWorkerUrl: true,
  deployVerifiedInUi: false,
  deployWorkerMatchesConfiguredUrl: false,
  canUseSponsoredAutoDeployNow: false,
  manualMetadataUrl: '',
  metadataUrl: '',
};

describe('resolveSessionWizardPublishReadiness', () => {
  it('allows default worker metadata upload to satisfy publish readiness', () => {
    expect(resolveSessionWizardPublishReadiness(baseInput)).toEqual({
      canUploadMetadataNow: true,
      uploadBlockedReason: 'Deploy the worker and ensure the worker URL is set before uploading metadata.',
      hasManualMetadata: false,
      hasUploadedMetadata: false,
      canPublishNow: true,
    });
  });

  it('blocks custom worker upload until a matching deploy is verified', () => {
    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: false,
      deployWorkerMatchesConfiguredUrl: false,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      uploadBlockedReason: 'Custom worker mode requires a successful deploy in this run before metadata upload.',
      canPublishNow: false,
    }));

    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: true,
      deployWorkerMatchesConfiguredUrl: false,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      uploadBlockedReason: 'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.',
      canPublishNow: false,
    }));

    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: true,
      deployWorkerMatchesConfiguredUrl: true,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: true,
      canPublishNow: true,
    }));
  });

  it('lets manual or uploaded metadata satisfy publish readiness without worker upload readiness', () => {
    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      resolvedWorkerBaseUrl: '',
      usesDefaultWorkerUrl: false,
      manualMetadataUrl: `ar://${txId}`,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      uploadBlockedReason: 'Set a worker URL before uploading metadata.',
      hasManualMetadata: true,
      hasUploadedMetadata: false,
      canPublishNow: true,
    }));

    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      resolvedWorkerBaseUrl: '',
      usesDefaultWorkerUrl: false,
      metadataUrl: `ar://${txId}`,
    })).toEqual(expect.objectContaining({
      hasManualMetadata: false,
      hasUploadedMetadata: true,
      canPublishNow: true,
    }));
  });

  it('keeps custom-worker metadata upload blocked while metadata fallbacks allow publish readiness', () => {
    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: false,
      deployWorkerMatchesConfiguredUrl: false,
      manualMetadataUrl: `https://arweave.net/${txId}`,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      uploadBlockedReason: 'Custom worker mode requires a successful deploy in this run before metadata upload.',
      hasManualMetadata: true,
      hasUploadedMetadata: false,
      canPublishNow: true,
    }));

    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: true,
      deployWorkerMatchesConfiguredUrl: false,
      metadataUrl: txId,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      uploadBlockedReason: 'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.',
      hasManualMetadata: false,
      hasUploadedMetadata: true,
      canPublishNow: true,
    }));
  });

  it('allows sponsored auto-deploy publish readiness without upload readiness', () => {
    expect(resolveSessionWizardPublishReadiness({
      ...baseInput,
      resolvedWorkerBaseUrl: '',
      usesDefaultWorkerUrl: false,
      canUseSponsoredAutoDeployNow: true,
    })).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      hasManualMetadata: false,
      hasUploadedMetadata: false,
      canPublishNow: true,
    }));
  });
});
