import { resolveSessionWizardWorkerVerificationUiState } from './sessionWizardWorkerState';

describe('SessionWizard worker verification UI state', () => {
  it('keeps the verified deploy URL authoritative while deployComplete is still true', () => {
    expect(
      resolveSessionWizardWorkerVerificationUiState({
        configuredWorkerUrl: '',
        deployWorkerUrl: 'https://deployed.example.test',
        defaultWorkerUrl: 'https://shared.example.test',
        deployComplete: true,
        normalModeRequiresCustomWorker: true,
      }),
    ).toEqual({
      deployVerifiedInUi: true,
      effectiveConfiguredWorkerUrl: 'https://deployed.example.test',
    });
  });

  it('does not re-verify a cached deploy URL after deployComplete was cleared', () => {
    expect(
      resolveSessionWizardWorkerVerificationUiState({
        configuredWorkerUrl: '',
        deployWorkerUrl: 'https://deployed.example.test',
        defaultWorkerUrl: 'https://shared.example.test',
        deployComplete: false,
        normalModeRequiresCustomWorker: true,
      }),
    ).toEqual({
      deployVerifiedInUi: false,
      effectiveConfiguredWorkerUrl: '',
    });
  });

  it('preserves a manual custom worker URL instead of overwriting it with stale deploy state', () => {
    expect(
      resolveSessionWizardWorkerVerificationUiState({
        configuredWorkerUrl: 'https://custom.example.test',
        deployWorkerUrl: 'https://deployed.example.test',
        defaultWorkerUrl: 'https://shared.example.test',
        deployComplete: false,
        normalModeRequiresCustomWorker: true,
      }),
    ).toEqual({
      deployVerifiedInUi: false,
      effectiveConfiguredWorkerUrl: 'https://custom.example.test',
    });
  });
});
