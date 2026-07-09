import {
  createInitialSessionPublishState,
  type SessionPublishState,
} from '../../domains/sessions/publish/sessionPublishReducer';
import {
  resolveSessionWizardPublishReducerUiPlan,
  resolveSessionWizardPublishReducerUiState,
} from './sessionWizardPublishReducerUiState';

const stepNumbers = {
  'deploy-worker': 1,
  'deploy-sbts': 2,
  'upload-metadata': 3,
  'register-session': 4,
  done: 5,
};

const state = (overrides: Partial<SessionPublishState>): SessionPublishState =>
  createInitialSessionPublishState({
    status: 'editing',
    ...overrides,
  });

describe('resolveSessionWizardPublishReducerUiState', () => {
  it.each([
    ['idle', state({ status: 'idle' }), { publishBusy: false, publishStep: 0 }],
    ['editing', state({ status: 'editing' }), { publishBusy: false, publishStep: 0 }],
    [
      'checkingRequirements',
      state({ status: 'checkingRequirements', currentEffect: 'checkRequirements' }),
      { publishBusy: true, publishStep: 0 },
    ],
    [
      'deployingWorker',
      state({ status: 'deployingWorker', currentEffect: 'deployWorker' }),
      { publishBusy: true, publishStep: 1 },
    ],
    [
      'deployingPendingSbts',
      state({ status: 'deployingPendingSbts', currentEffect: 'deployPendingSbts' }),
      { publishBusy: true, publishStep: 2 },
    ],
    [
      'uploadingMetadata',
      state({ status: 'uploadingMetadata', currentEffect: 'uploadMetadata' }),
      { publishBusy: true, publishStep: 3 },
    ],
    [
      'registerSession',
      state({ status: 'registeringOnChain', currentEffect: 'registerSession' }),
      { publishBusy: true, publishStep: 4 },
    ],
    [
      'refreshRegistryCache',
      state({ status: 'registeringOnChain', currentEffect: 'refreshRegistryCache' }),
      { publishBusy: true, publishStep: 4 },
    ],
    ['published', state({ status: 'published' }), { publishBusy: false, publishStep: 5 }],
    [
      'failedRecoverable',
      state({
        status: 'failedRecoverable',
        error: { effect: 'uploadMetadata', message: 'Upload failed.', recoverable: true },
      }),
      { publishBusy: false, publishStep: 0 },
    ],
    [
      'failedTerminal',
      state({
        status: 'failedTerminal',
        error: { effect: 'registerSession', message: 'Registration failed.', recoverable: false },
      }),
      { publishBusy: false, publishStep: 0 },
    ],
  ])('maps %s to the legacy publish progress inputs', (_label, inputState, expected) => {
    expect(
      resolveSessionWizardPublishReducerUiState({
        state: inputState,
        stepNumbers,
      }),
    ).toEqual(expected);
  });

  it('keeps unknown or missing step numbers at the legacy preparing state', () => {
    expect(
      resolveSessionWizardPublishReducerUiState({
        state: state({ status: 'uploadingMetadata', currentEffect: 'uploadMetadata' }),
        stepNumbers: {},
      }),
    ).toEqual({
      publishBusy: true,
      publishStep: 0,
    });
  });

  it('builds the publish ui plan from reducer state without changing copy or step labels', () => {
    const plan = resolveSessionWizardPublishReducerUiPlan({
      state: state({
        status: 'uploadingMetadata',
        currentEffect: 'uploadMetadata',
      }),
      resolvedWorkerBaseUrl: 'https://worker.example.test',
      workerMode: 'default',
      usesDefaultWorkerUrl: true,
      deployVerifiedInUi: false,
      deployWorkerMatchesConfiguredUrl: false,
      canUseSponsoredAutoDeployNow: false,
      manualMetadataUrl: '',
      metadataUrl: '',
      buildMetadataGatewayUrl: (txId) => `https://gateway.example/${txId}`,
      deployComplete: false,
      hasPendingDrafts: true,
      isNormalMode: true,
      publishAdvancedOpen: false,
      publishStepElapsedMs: 1300,
      sbtsLabel: 'Groups',
    });

    expect(plan.publishActionDisplayState).toEqual(
      expect.objectContaining({
        publishBusy: true,
        publishButtonDisabled: true,
        publishButtonLabel: 'Deploy Session',
      }),
    );
    expect(plan.publishProgressDisplayState).toEqual(
      expect.objectContaining({
        activePublishProgressStepLabel: 'Upload Arweave',
        publishProgressEyebrow: 'Publishing Session',
        publishStep: 2,
        showPublishProgress: true,
      }),
    );
    expect(plan.publishProgressDisplayState.publishProgressSteps).toEqual([
      { key: 'deploy-sbts', label: 'Deploy Groups', state: 'complete' },
      { key: 'upload-metadata', label: 'Upload Arweave', state: 'active' },
      { key: 'register-session', label: 'Register On-chain', state: 'pending' },
      { key: 'done', label: 'Done', state: 'pending' },
    ]);
  });
});
