import {
  resolveSessionWizardPublishActionDisplayState,
  resolveSessionWizardPublishRequestDescriptor,
  resolveSessionWizardPublishMetadataIdentityState,
  resolveSessionWizardPublishMetadataDisplayState,
  resolveSessionWizardPublishReadiness,
  resolveSessionWizardPublishUiPlan,
  type SessionWizardPublishReadinessInput,
} from './sessionWizardPublishReadiness';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

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
  it('keeps a direct-token worker-canonical publish blocked after deploy capability sync failed', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: false,
        deployWorkerMatchesConfiguredUrl: false,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
    ).toEqual(
      expect.objectContaining({
        canPublishNow: false,
        hasManualMetadata: false,
        hasUploadedMetadata: false,
        readinessKind: 'blocked',
        showUploadBlockedReason: false,
      }),
    );
  });

  it('does not let stale Arweave metadata bypass worker-canonical deploy verification', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: false,
        deployWorkerMatchesConfiguredUrl: true,
        manualMetadataUrl: `ar://${txId}`,
        metadataUrl: `ar://${'b'.repeat(43)}`,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
    ).toEqual(
      expect.objectContaining({
        canPublishNow: false,
        readinessKind: 'blocked',
      }),
    );
  });

  it('does not trust a restored custom URL during the initial default-mode render', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'default',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: false,
        deployWorkerMatchesConfiguredUrl: false,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
    ).toEqual(expect.objectContaining({ canPublishNow: false, readinessKind: 'blocked' }));
  });

  it('accepts worker-canonical config persistence for verified custom and shared default workers', () => {
    const workerCanonicalProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: true,
        deployWorkerMatchesConfiguredUrl: true,
        sessionModeProfile: workerCanonicalProfile,
      }),
    ).toEqual(expect.objectContaining({ canPublishNow: true, readinessKind: 'worker-config' }));

    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        sessionModeProfile: workerCanonicalProfile,
      }),
    ).toEqual(expect.objectContaining({ canPublishNow: true, readinessKind: 'worker-config' }));
  });

  it('does not treat the shared default URL as verification while custom worker mode is selected', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: true,
        deployVerifiedInUi: false,
        deployWorkerMatchesConfiguredUrl: false,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        canPublishNow: false,
        readinessKind: 'blocked',
        uploadBlockedReason: 'Custom worker mode requires a successful deploy in this run before metadata upload.',
      }),
    );
  });

  it('allows default worker metadata upload to satisfy publish readiness', () => {
    expect(resolveSessionWizardPublishReadiness(baseInput)).toEqual({
      canUploadMetadataNow: true,
      uploadBlockedReason: 'Deploy the worker and ensure the worker URL is set before uploading metadata.',
      hasManualMetadata: false,
      hasUploadedMetadata: false,
      canPublishNow: true,
      readinessKind: 'worker-upload',
      showUploadBlockedReason: false,
    });
  });

  it('blocks custom worker upload until a matching deploy is verified', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: false,
        deployWorkerMatchesConfiguredUrl: false,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        uploadBlockedReason: 'Custom worker mode requires a successful deploy in this run before metadata upload.',
        canPublishNow: false,
        readinessKind: 'blocked',
        showUploadBlockedReason: true,
      }),
    );

    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: true,
        deployWorkerMatchesConfiguredUrl: false,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        uploadBlockedReason:
          'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.',
        canPublishNow: false,
        readinessKind: 'blocked',
      }),
    );

    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: true,
        deployWorkerMatchesConfiguredUrl: true,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: true,
        canPublishNow: true,
        readinessKind: 'worker-upload',
      }),
    );
  });

  it('lets manual or uploaded metadata satisfy publish readiness without worker upload readiness', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        resolvedWorkerBaseUrl: '',
        usesDefaultWorkerUrl: false,
        manualMetadataUrl: `ar://${txId}`,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        uploadBlockedReason: 'Set a worker URL before uploading metadata.',
        hasManualMetadata: true,
        hasUploadedMetadata: false,
        canPublishNow: true,
        readinessKind: 'manual-metadata',
      }),
    );

    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        resolvedWorkerBaseUrl: '',
        usesDefaultWorkerUrl: false,
        metadataUrl: `ar://${txId}`,
      }),
    ).toEqual(
      expect.objectContaining({
        hasManualMetadata: false,
        hasUploadedMetadata: true,
        canPublishNow: true,
        readinessKind: 'uploaded-metadata',
      }),
    );
  });

  it('keeps custom-worker metadata upload blocked while metadata fallbacks allow publish readiness', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: false,
        deployWorkerMatchesConfiguredUrl: false,
        manualMetadataUrl: `https://arweave.net/${txId}`,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        uploadBlockedReason: 'Custom worker mode requires a successful deploy in this run before metadata upload.',
        hasManualMetadata: true,
        hasUploadedMetadata: false,
        canPublishNow: true,
        readinessKind: 'manual-metadata',
      }),
    );

    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        workerMode: 'custom',
        usesDefaultWorkerUrl: false,
        deployVerifiedInUi: true,
        deployWorkerMatchesConfiguredUrl: false,
        metadataUrl: txId,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        uploadBlockedReason:
          'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.',
        hasManualMetadata: false,
        hasUploadedMetadata: true,
        canPublishNow: true,
        readinessKind: 'uploaded-metadata',
      }),
    );
  });

  it('allows sponsored auto-deploy publish readiness without upload readiness', () => {
    expect(
      resolveSessionWizardPublishReadiness({
        ...baseInput,
        resolvedWorkerBaseUrl: '',
        usesDefaultWorkerUrl: false,
        canUseSponsoredAutoDeployNow: true,
      }),
    ).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        hasManualMetadata: false,
        hasUploadedMetadata: false,
        canPublishNow: true,
        readinessKind: 'sponsored-auto-deploy',
      }),
    );
  });

  it('keeps no-worker no-metadata publish readiness blocked without execution ports', () => {
    const plan = resolveSessionWizardPublishUiPlan({
      ...baseInput,
      resolvedWorkerBaseUrl: '',
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: false,
      deployWorkerMatchesConfiguredUrl: false,
      canUseSponsoredAutoDeployNow: false,
      deployComplete: false,
      hasPendingDrafts: false,
      manualMetadataUrl: '',
      metadataUrl: '',
      publishBusy: false,
      publishStep: 0,
    });

    expect(plan.publishReadiness).toEqual({
      canUploadMetadataNow: false,
      uploadBlockedReason: 'Set a worker URL before uploading metadata.',
      hasManualMetadata: false,
      hasUploadedMetadata: false,
      canPublishNow: false,
      readinessKind: 'blocked',
      showUploadBlockedReason: true,
    });
    expect(plan.publishExecutionPlan).toEqual(
      expect.objectContaining({
        shouldAutoDeployWorker: false,
        shouldDeployPendingSbts: false,
        shouldUploadMetadata: false,
        shouldRegisterSession: true,
      }),
    );
    expect(plan.publishMetadataDisplayState).toEqual(
      expect.objectContaining({
        showArweaveTx: false,
        showManualMetadataUri: false,
        showMetadataUri: false,
      }),
    );
    expect(plan.publishActionDisplayState).toEqual({
      canPublishNow: false,
      displayMode: 'advanced',
      publishAdvancedOpen: false,
      publishBusy: false,
      publishButtonDisabled: true,
      publishButtonLabel: 'Publish',
      settingsButtonActive: false,
    });
  });

  it('builds a pure publish UI plan for default-worker metadata upload readiness', () => {
    const input = Object.freeze({
      ...baseInput,
      deployComplete: false,
      effectiveMetadataGatewayUrl: `https://arweave.net/${txId}`,
      effectiveMetadataTxId: txId,
      hasPendingDrafts: true,
      isNormalMode: true,
      metadataUrl: `ar://${txId}`,
      publishAdvancedOpen: true,
      publishBusy: true,
      publishStep: 2,
      publishStepElapsedMs: 1300,
      sbtsLabel: 'badges',
    });

    const plan = resolveSessionWizardPublishUiPlan(input);

    expect(plan.publishReadiness).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: true,
        hasManualMetadata: false,
        hasUploadedMetadata: true,
        canPublishNow: true,
        readinessKind: 'uploaded-metadata',
      }),
    );
    expect(plan.publishExecutionPlan).toEqual(
      expect.objectContaining({
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
      }),
    );
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
    expect(plan.publishMetadataDisplayState).toEqual({
      effectiveMetadataGatewayUrl: `https://arweave.net/${txId}`,
      effectiveMetadataTxId: txId,
      manualMetadataDisplayUri: '',
      metadataUri: `ar://${txId}`,
      metadataUriLabel: 'Metadata URI',
      showArweaveTx: true,
      showManualMetadataUri: false,
      showMetadataUri: true,
    });
    expect(plan.publishActionDisplayState).toEqual({
      canPublishNow: true,
      displayMode: 'normal',
      publishAdvancedOpen: true,
      publishBusy: true,
      publishButtonDisabled: true,
      publishButtonLabel: 'Deploy Session',
      settingsButtonActive: true,
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

    expect(plan.publishReadiness).toEqual(
      expect.objectContaining({
        hasManualMetadata: true,
        hasUploadedMetadata: false,
        canPublishNow: true,
        readinessKind: 'manual-metadata',
      }),
    );
    expect(plan.publishExecutionPlan).toEqual(
      expect.objectContaining({
        shouldUploadMetadata: false,
        shouldRegisterSession: true,
        steps: ['register-session', 'done'],
        stepNumbers: {
          'register-session': 1,
          done: 2,
        },
      }),
    );
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

    expect(plan.publishReadiness).toEqual(
      expect.objectContaining({
        canUploadMetadataNow: false,
        canPublishNow: true,
        readinessKind: 'sponsored-auto-deploy',
        uploadBlockedReason: 'Set a worker URL before uploading metadata.',
      }),
    );
    expect(plan.publishExecutionPlan).toEqual(
      expect.objectContaining({
        shouldAutoDeployWorker: true,
        shouldDeployPendingSbts: true,
        shouldUploadMetadata: true,
        shouldRegisterSession: true,
        steps: ['deploy-worker', 'deploy-sbts', 'upload-metadata', 'register-session', 'done'],
      }),
    );
    expect(Object.keys(plan)).toEqual([
      'publishActionDisplayState',
      'publishReadiness',
      'publishExecutionPlan',
      'publishMetadataDisplayState',
      'publishProgressDisplayState',
    ]);
    expect(plan.publishProgressDisplayState.activePublishProgressStepLabel).toBe('Deploy Worker');
  });

  it('describes uploaded and manual metadata fallback display without upload execution ports', () => {
    const buildGatewayUrl = jest.fn((metadataTxId: string) => `https://gateway.example/${metadataTxId}`);

    expect(
      resolveSessionWizardPublishMetadataIdentityState({
        buildGatewayUrl,
        manualMetadataUrl: `https://arweave.net/${txId}`,
        metadataUrl: 'https://example.test/ignored-uploaded-metadata.json',
      }),
    ).toEqual({
      effectiveMetadataGatewayUrl: `https://gateway.example/${txId}`,
      effectiveMetadataTxId: txId,
      effectiveMetadataUri: `ar://${txId}`,
    });
    expect(buildGatewayUrl).toHaveBeenCalledWith(txId);

    expect(
      resolveSessionWizardPublishMetadataIdentityState({
        buildGatewayUrl,
        manualMetadataUrl: '',
        metadataUrl: txId,
      }),
    ).toEqual({
      effectiveMetadataGatewayUrl: `https://gateway.example/${txId}`,
      effectiveMetadataTxId: txId,
      effectiveMetadataUri: txId,
    });

    expect(
      resolveSessionWizardPublishMetadataIdentityState({
        buildGatewayUrl,
        manualMetadataUrl: 'https://example.test/custom-metadata.json',
        metadataUrl: txId,
      }),
    ).toEqual({
      effectiveMetadataGatewayUrl: '',
      effectiveMetadataTxId: '',
      effectiveMetadataUri: 'https://example.test/custom-metadata.json',
    });

    expect(
      resolveSessionWizardPublishMetadataDisplayState({
        effectiveMetadataGatewayUrl: `https://arweave.net/${txId}`,
        effectiveMetadataTxId: txId,
        metadataUrl: `ar://${txId}`,
      }),
    ).toEqual({
      effectiveMetadataGatewayUrl: `https://arweave.net/${txId}`,
      effectiveMetadataTxId: txId,
      manualMetadataDisplayUri: '',
      metadataUri: `ar://${txId}`,
      metadataUriLabel: 'Metadata URI',
      showArweaveTx: true,
      showManualMetadataUri: false,
      showMetadataUri: true,
    });

    expect(
      resolveSessionWizardPublishMetadataDisplayState({
        manualMetadataUrl: `https://arweave.net/${txId}`,
        metadataUrl: txId,
      }),
    ).toEqual(
      expect.objectContaining({
        manualMetadataDisplayUri: `ar://${txId}`,
        metadataUri: `ar://${txId}`,
        metadataUriLabel: 'Uploaded metadata URI',
        showArweaveTx: false,
        showManualMetadataUri: true,
        showMetadataUri: true,
      }),
    );

    expect(
      resolveSessionWizardPublishMetadataDisplayState({
        effectiveMetadataTxId: txId,
        metadataUrl: `ar://${txId}`,
      }),
    ).toEqual(
      expect.objectContaining({
        effectiveMetadataGatewayUrl: '',
        effectiveMetadataTxId: txId,
        showArweaveTx: false,
      }),
    );

    expect(resolveSessionWizardPublishMetadataDisplayState()).toEqual({
      effectiveMetadataGatewayUrl: '',
      effectiveMetadataTxId: '',
      manualMetadataDisplayUri: '',
      metadataUri: '',
      metadataUriLabel: '',
      showArweaveTx: false,
      showManualMetadataUri: false,
      showMetadataUri: false,
    });
  });

  it('lets the publish UI plan derive metadata tx links without parent Arweave branching', () => {
    const plan = resolveSessionWizardPublishUiPlan({
      ...baseInput,
      buildMetadataGatewayUrl: (metadataTxId: string) => `https://gateway.example/${metadataTxId}`,
      manualMetadataUrl: '',
      metadataUrl: txId,
    });

    expect(plan.publishMetadataDisplayState).toEqual(
      expect.objectContaining({
        effectiveMetadataGatewayUrl: `https://gateway.example/${txId}`,
        effectiveMetadataTxId: txId,
        metadataUri: `ar://${txId}`,
        showArweaveTx: true,
        showMetadataUri: true,
      }),
    );
  });

  it('describes publish action controls without execution callbacks', () => {
    expect(
      resolveSessionWizardPublishActionDisplayState({
        canPublishNow: true,
        isNormalMode: true,
        publishAdvancedOpen: true,
        publishBusy: false,
      }),
    ).toEqual({
      canPublishNow: true,
      displayMode: 'normal',
      publishAdvancedOpen: true,
      publishBusy: false,
      publishButtonDisabled: false,
      publishButtonLabel: 'Deploy Session',
      settingsButtonActive: true,
    });

    expect(
      resolveSessionWizardPublishActionDisplayState({
        canPublishNow: false,
        isNormalMode: false,
        publishAdvancedOpen: false,
        publishBusy: true,
      }),
    ).toEqual({
      canPublishNow: false,
      displayMode: 'advanced',
      publishAdvancedOpen: false,
      publishBusy: true,
      publishButtonDisabled: true,
      publishButtonLabel: 'Publish',
      settingsButtonActive: false,
    });

    expect(
      resolveSessionWizardPublishActionDisplayState({
        canPublishNow: true,
        isNormalMode: true,
        publishCompleted: true,
      }),
    ).toEqual(
      expect.objectContaining({
        publishBusy: false,
        publishButtonDisabled: true,
        publishButtonLabel: 'Session Created',
      }),
    );
  });
});

describe('resolveSessionWizardPublishRequestDescriptor', () => {
  it('pins publish request identity without deploy, upload, register, or route ports', () => {
    const pendingDraftSnapshot = Object.freeze([
      Object.freeze({ id: 'already-deployed', deployed: true }),
      Object.freeze({ id: 'needs-deploy', deployed: false }),
      Object.freeze({ id: 'missing-flag' }),
    ]);

    const descriptor = resolveSessionWizardPublishRequestDescriptor({
      pendingDraftSnapshot,
      manualMetadataUrl: ` https://arweave.net/${txId} `,
      workerMode: 'custom',
      sponsoredAutoDeployReady: true,
      deployComplete: false,
      canUploadMetadataNow: true,
    });

    expect(descriptor).toEqual({
      pendingDraftSnapshot,
      hasPendingDrafts: true,
      hasManualMetadata: true,
      publishExecutionPlan: {
        shouldAutoDeployWorker: true,
        shouldDeployPendingSbts: true,
        shouldUploadMetadata: false,
        shouldPersistWorkerConfig: false,
        shouldRegisterSession: true,
        shouldRefreshRegistryCache: true,
        steps: ['deploy-worker', 'deploy-sbts', 'register-session', 'done'],
        stepNumbers: {
          'deploy-worker': 1,
          'deploy-sbts': 2,
          'register-session': 3,
          done: 4,
        },
      },
    });
  });

  it('keeps uploaded metadata fallback behavior aligned with the existing upload plan', () => {
    const descriptor = resolveSessionWizardPublishRequestDescriptor({
      pendingDraftSnapshot: [],
      manualMetadataUrl: '',
      workerMode: 'default',
      sponsoredAutoDeployReady: false,
      deployComplete: false,
      canUploadMetadataNow: true,
    });

    expect(descriptor).toEqual(
      expect.objectContaining({
        pendingDraftSnapshot: [],
        hasPendingDrafts: false,
        hasManualMetadata: false,
        publishExecutionPlan: expect.objectContaining({
          shouldAutoDeployWorker: false,
          shouldDeployPendingSbts: false,
          shouldUploadMetadata: true,
          shouldRegisterSession: true,
          steps: ['upload-metadata', 'register-session', 'done'],
        }),
      }),
    );
  });
});
