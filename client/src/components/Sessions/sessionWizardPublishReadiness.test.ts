import {
  resolveSessionWizardPublishReadiness,
  resolveSessionWizardPublishUiPlan,
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

  it('builds a pure publish UI plan for default-worker metadata upload readiness', () => {
    const input = Object.freeze({
      ...baseInput,
      deployComplete: false,
      hasPendingDrafts: true,
      publishBusy: true,
      publishStep: 2,
      publishStepElapsedMs: 1300,
      sbtsLabel: 'badges',
    });

    const plan = resolveSessionWizardPublishUiPlan(input);

    expect(plan.publishReadiness).toEqual(expect.objectContaining({
      canUploadMetadataNow: true,
      hasManualMetadata: false,
      hasUploadedMetadata: false,
      canPublishNow: true,
    }));
    expect(plan.publishExecutionPlan).toEqual(expect.objectContaining({
      shouldAutoDeployWorker: false,
      shouldDeployPendingSbts: true,
      shouldUploadMetadata: true,
      shouldRegisterSession: true,
      steps: ['deploy-sbts', 'upload-metadata', 'register-session', 'done'],
      stepNumbers: {
        'deploy-sbts': 1,
        'upload-metadata': 2,
        'register-session': 3,
        done: 4,
      },
    }));
    expect(plan.publishProgressDisplayState).toMatchObject({
      activePublishProgressStepLabel: 'Upload Arweave',
      publishProgressPercentRounded: expect.any(Number),
      showPublishProgress: true,
      publishProgressSteps: [
        { key: 'deploy-sbts', label: 'Deploy badges' },
        { key: 'upload-metadata', label: 'Upload Arweave' },
        { key: 'register-session', label: 'Register On-chain' },
        { key: 'done', label: 'Done' },
      ],
    });
    expect(plan.publishProgressDisplayState.publishProgressPercent).toBeGreaterThan(25);
    expect(plan.publishProgressDisplayState.publishProgressPercent).toBeLessThan(50);
  });

  it('keeps manual metadata selection out of upload side-effect planning', () => {
    const plan = resolveSessionWizardPublishUiPlan({
      ...baseInput,
      manualMetadataUrl: `ar://${txId}`,
      metadataUrl: '',
      deployComplete: false,
      hasPendingDrafts: false,
      publishBusy: false,
      publishStep: 1,
    });

    expect(plan.publishReadiness).toEqual(expect.objectContaining({
      hasManualMetadata: true,
      hasUploadedMetadata: false,
      canPublishNow: true,
    }));
    expect(plan.publishExecutionPlan).toEqual(expect.objectContaining({
      shouldUploadMetadata: false,
      shouldRegisterSession: true,
      steps: ['register-session', 'done'],
      stepNumbers: {
        'register-session': 1,
        done: 2,
      },
    }));
    expect(plan.publishProgressDisplayState).toMatchObject({
      activePublishProgressStepLabel: 'Register On-chain',
      showPublishProgress: true,
    });
  });

  it('plans sponsored custom-worker readiness without worker, storage, wallet, deploy, or Arweave ports', () => {
    const plan = resolveSessionWizardPublishUiPlan({
      ...baseInput,
      resolvedWorkerBaseUrl: '',
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: false,
      deployWorkerMatchesConfiguredUrl: false,
      canUseSponsoredAutoDeployNow: true,
      deployComplete: false,
      hasPendingDrafts: true,
      publishBusy: true,
      publishStep: 1,
      publishStepElapsedMs: 500,
    });

    expect(plan.publishReadiness).toEqual(expect.objectContaining({
      canUploadMetadataNow: false,
      canPublishNow: true,
      uploadBlockedReason: 'Set a worker URL before uploading metadata.',
    }));
    expect(plan.publishExecutionPlan).toEqual(expect.objectContaining({
      shouldAutoDeployWorker: true,
      shouldDeployPendingSbts: true,
      shouldUploadMetadata: true,
      shouldRegisterSession: true,
      steps: ['deploy-worker', 'deploy-sbts', 'upload-metadata', 'register-session', 'done'],
    }));
    expect(Object.keys(plan)).toEqual([
      'publishReadiness',
      'publishExecutionPlan',
      'publishProgressDisplayState',
    ]);
    expect(plan.publishProgressDisplayState.activePublishProgressStepLabel).toBe('Deploy Worker');
  });
});
