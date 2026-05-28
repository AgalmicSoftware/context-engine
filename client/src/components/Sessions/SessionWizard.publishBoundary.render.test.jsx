import {
  E2E_TESTIDS,
  fireEvent,
  mockRegisterSessionOnChain,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  waitFor,
  enableAdvancedMode,
} from './SessionWizard.workerPanel.testUtils';

const chooseCustomWorkerWithoutDeploy = async () => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
  fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));
};

const openPublishSection = async () => {
  fireEvent.click(screen.getByText('Publish').closest('button'));
  return screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
};

describe('SessionWizard publish boundary rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps advanced publish disabled and inert when metadata upload has no verified worker', async () => {
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Blocked Publish Boundary Session' },
    });
    await chooseCustomWorkerWithoutDeploy();

    const publishButton = await openPublishSection();

    await waitFor(() => {
      expect(publishButton).toBeDisabled();
    });
    expect(screen.getByText('Set a worker URL before uploading metadata.')).toBeInTheDocument();

    fireEvent.click(publishButton);

    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
    expect(arweaveScripts.uploadDataToArweave).not.toHaveBeenCalled();
  });

  it('lets manual metadata satisfy publish readiness without firing from settings controls', async () => {
    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Manual Metadata Publish Boundary Session' },
    });
    await chooseCustomWorkerWithoutDeploy();

    const publishButton = await openPublishSection();
    await waitFor(() => {
      expect(publishButton).toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('Advanced publish settings'));

    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: `ar://${'a'.repeat(43)}` },
    });

    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });
    expect(screen.queryByText('Set a worker URL before uploading metadata.')).not.toBeInTheDocument();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  });
});
