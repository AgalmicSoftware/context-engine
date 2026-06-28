import {
  E2E_TESTIDS,
  act,
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

const seedVerifiedWorkerCache = (workerUrl = 'https://worker.example.test', overrides = {}) => {
  const draft = {
    corsWorkerUrl: workerUrl,
    ...(overrides.draft || {}),
  };
  localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({
    ...overrides,
    draft,
    deployComplete: true,
    deployWorkerUrl: workerUrl,
  }));
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

  it('keeps blank manual metadata blocked and inert without upload or registry execution', async () => {
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Blank Manual Metadata Boundary Session' },
    });
    await chooseCustomWorkerWithoutDeploy();

    const publishButton = await openPublishSection();
    await waitFor(() => {
      expect(publishButton).toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('Advanced publish settings'));
    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: '   ' },
    });

    await waitFor(() => {
      expect(publishButton).toBeDisabled();
    });
    expect(screen.getByText('Set a worker URL before uploading metadata.')).toBeInTheDocument();

    fireEvent.click(publishButton);

    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
    expect(arweaveScripts.uploadDataToArweave).not.toHaveBeenCalled();
  });

  it('renders parent-derived register progress during manual metadata publish', async () => {
    const manualMetadataUri = `ar://${'c'.repeat(43)}`;
    let resolveRegister = () => {};
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    mockRegisterSessionOnChain.mockImplementation(async () => registerPromise);

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Manual Metadata Progress Boundary Session' },
    });
    await chooseCustomWorkerWithoutDeploy();

    const publishButton = await openPublishSection();
    fireEvent.click(screen.getByLabelText('Advanced publish settings'));
    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: manualMetadataUri },
    });

    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    const progressCard = await screen.findByTestId('ce-wizard-publish-progress');
    expect(progressCard).toHaveTextContent('Register On-chain');
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('Register On-chain')
    );
    expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRegister({ txs: [] });
      await registerPromise;
    });
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });
  });

  it('passes manual metadata through the register boundary with pinned register args', async () => {
    const manualMetadataUri = `ar://${'b'.repeat(43)}`;
    mockRegisterSessionOnChain.mockImplementation(async (args) => {
      args.onTxHash({ action: 'createSession', hash: '0xregister-start' });
      return { txs: [{ action: 'createSession', hash: '0xregister-final' }] };
    });

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Manual Metadata Register Boundary Session' },
    });
    await chooseCustomWorkerWithoutDeploy();

    const publishButton = await openPublishSection();
    await waitFor(() => {
      expect(publishButton).toBeDisabled();
    });

    fireEvent.click(screen.getByLabelText('Advanced publish settings'));
    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: manualMetadataUri },
    });

    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1);
    });
    const registerArgs = mockRegisterSessionOnChain.mock.calls[0][0];
    expect(Object.keys(registerArgs)).toEqual([
      'providerLike',
      'chainId',
      'registryAddress',
      'slug',
      'sessionId',
      'sessionChainId',
      'metadataURI',
      'encryptedMetadataURI',
      'gateSelections',
      'sessionFields',
      'gasLimitOverride',
      'gasPriceGwei',
      'maxFeePerGasGwei',
      'maxPriorityFeePerGasGwei',
      'onTxHash',
    ]);
    expect(registerArgs).toEqual(expect.objectContaining({
      providerLike: undefined,
      chainId: 11155420,
      registryAddress: expect.any(String),
      slug: 'manual-metadata-register-boundary-session',
      sessionId: expect.any(String),
      sessionChainId: 11155420,
      metadataURI: manualMetadataUri,
      encryptedMetadataURI: '',
      gateSelections: expect.objectContaining({
        default: expect.objectContaining({
          chainId: 11155420,
          mode: 'all',
          sbts: [],
        }),
      }),
      sessionFields: expect.any(Object),
      gasLimitOverride: '1200000',
      gasPriceGwei: '',
      maxFeePerGasGwei: '',
      maxPriorityFeePerGasGwei: '',
      onTxHash: expect.any(Function),
    }));
  });

  it('passes uploaded metadata through the register boundary without custom deploy execution', async () => {
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');
    const uploadedTxId = 'd'.repeat(43);
    arweaveScripts.uploadDataToArweave.mockResolvedValue(uploadedTxId);
    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    seedVerifiedWorkerCache();

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Uploaded Metadata Register Boundary Session' },
    });

    const publishButton = await openPublishSection();
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(arweaveScripts.uploadDataToArweave).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1);
    });

    const [metadataPayload, uploadFormat, uploadOptions] = arweaveScripts.uploadDataToArweave.mock.calls[0];
    expect(metadataPayload).toEqual(expect.objectContaining({
      sessionName: 'Uploaded Metadata Register Boundary Session',
      slug: 'uploaded-metadata-register-boundary-session',
    }));
    expect(uploadFormat).toBe('json');
    expect(uploadOptions).toEqual(expect.objectContaining({
      sessionSlug: 'uploaded-metadata-register-boundary-session',
      workerUrl: expect.any(String),
    }));

    const registerArgs = mockRegisterSessionOnChain.mock.calls[0][0];
    expect(registerArgs).toEqual(expect.objectContaining({
      slug: 'uploaded-metadata-register-boundary-session',
      metadataURI: `ar://${uploadedTxId}`,
      sessionFields: expect.any(Object),
    }));
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_URI)).toHaveTextContent(`ar://${uploadedTxId}`);
  });

  it('blocks cached secret field gates before metadata upload', async () => {
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');
    seedVerifiedWorkerCache('https://worker.example.test', {
      encryptedFieldGates: {
        'arweave.jwk': 'gate-1',
      },
    });

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Secret Gate Boundary Session' },
    });

    const publishButton = await openPublishSection();
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(screen.getByText(
        'Worker secret fields cannot be locked in public metadata: arweave.jwk. Store secrets in the Worker panel instead.'
      )).toBeInTheDocument();
    });
    expect(arweaveScripts.uploadDataToArweave).not.toHaveBeenCalled();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  });

  it('resets progress and keeps publish retryable after metadata upload failure', async () => {
    const { arweaveScripts } = require('../../utilities/arweave/arweaveScripts.js');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let rejectUpload = () => {};
    const uploadPromise = new Promise((_, reject) => {
      rejectUpload = reject;
    });
    arweaveScripts.uploadDataToArweave.mockReturnValue(uploadPromise);
    seedVerifiedWorkerCache();

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Upload Failure Boundary Session' },
    });

    const publishButton = await openPublishSection();
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    expect(await screen.findByTestId('ce-wizard-publish-progress')).toHaveTextContent('Upload Arweave');

    await act(async () => {
      rejectUpload(new Error('Metadata upload failed upstream.'));
      try {
        await uploadPromise;
      } catch (err) {
        void err;
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Metadata upload failed upstream.')).toBeInTheDocument();
    });

    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ce-wizard-publish-progress')).not.toBeInTheDocument();
    expect(publishButton).not.toBeDisabled();
    consoleErrorSpy.mockRestore();
  });
});
