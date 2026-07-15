import {
  E2E_TESTIDS,
  act,
  fireEvent,
  mockRegisterSessionOnChain,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  waitFor,
  within,
  enableAdvancedMode,
} from './SessionWizard.workerPanel.testUtils';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { getSessionWizardWorkerSettlementStorageKey } from './sessionWizardWorkerSettlement';

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
  sessionStorage.setItem(
    'ce:sessionWizardDraft:v1',
    JSON.stringify({
      ...overrides,
      draft,
      deployComplete: true,
      deployWorkerUrl: workerUrl,
    }),
  );
};

const enableGeneralInfoLogging = () => {
  const previousLogging = window.CE_LOGGING;
  window.CE_LOGGING = {
    ...(previousLogging || {}),
    enabled: true,
    categories: {
      ...(previousLogging?.categories || {}),
      general: true,
    },
    levels: {
      ...(previousLogging?.levels || {}),
      log: false,
      info: true,
      debug: false,
      warn: false,
      error: false,
    },
  };
  return () => {
    if (previousLogging === undefined) {
      delete window.CE_LOGGING;
      return;
    }
    window.CE_LOGGING = previousLogging;
  };
};

const readWizardCache = () => JSON.parse(sessionStorage.getItem('ce:sessionWizardDraft:v1') || '{}');

describe('SessionWizard publish boundary rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps advanced publish disabled and inert when metadata upload has no verified worker', async () => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');

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
    expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
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
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');

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
    expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
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
      expect.stringContaining('Register On-chain'),
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

  it('ignores same-tick publish re-entry while registration is already in flight', async () => {
    const manualMetadataUri = `ar://${'e'.repeat(43)}`;
    let resolveRegister = () => {};
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    mockRegisterSessionOnChain.mockImplementation(async () => registerPromise);

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Manual Metadata Reentry Boundary Session' },
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
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveRegister({ txs: [] });
      await registerPromise;
    });
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });
  });

  it('keeps stale legacy shared residue isolated from tab autosave after decentralized completion', async () => {
    const manualMetadataUri = `ar://${'f'.repeat(43)}`;
    let resolveRegister = () => {};
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    mockRegisterSessionOnChain.mockImplementation(async () => registerPromise);

    renderLoggedInSessionWizard();
    enableAdvancedMode();
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Published Tab Session' },
    });
    await chooseCustomWorkerWithoutDeploy();
    const publishButton = await openPublishSection();
    fireEvent.click(screen.getByLabelText('Advanced publish settings'));
    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: manualMetadataUri },
    });
    await waitFor(() => {
      expect(readWizardCache().draft?.slug).toBe('published-tab-session');
      expect(publishButton).not.toBeDisabled();
    });
    const publishedSessionId = readWizardCache().sessionId;
    expect(publishedSessionId).toEqual(expect.any(String));

    fireEvent.click(publishButton);
    await waitFor(() => expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1));
    const foreignDraft = {
      sessionId: '0x00112233445566778899aabbccddeeff',
      draft: { slug: 'foreign-tab-session', sessionName: 'Keep this foreign draft' },
    };
    localStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify(foreignDraft));

    await act(async () => {
      resolveRegister({ txs: [] });
      await registerPromise;
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('ce:sessionWizardDraft:v1') || '{}')).toEqual(foreignDraft);
      const nextTabDraft = readWizardCache();
      expect(nextTabDraft.sessionId).toEqual(expect.any(String));
      expect(nextTabDraft.sessionId).not.toBe(publishedSessionId);
    });

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Next Tab Session' },
    });

    await waitFor(() => {
      const currentTabDraft = readWizardCache();
      expect(currentTabDraft.sessionId).toEqual(expect.any(String));
      expect(currentTabDraft.sessionId).not.toBe(publishedSessionId);
      expect(currentTabDraft.draft).toEqual(expect.objectContaining({ sessionName: 'Next Tab Session' }));
      expect(JSON.parse(localStorage.getItem('ce:sessionWizardDraft:v1') || '{}')).toEqual(foreignDraft);
    });
  });

  it('locks a completed worker-canonical session against a second publish to the same worker', async () => {
    const originalFetch = global.fetch;
    const workerUrl = 'https://single-session-worker.example.test';
    let persistedConfig = null;
    window.history.replaceState({}, '', '/new');
    global.fetch = jest.fn(async (url, init = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/admin/set-config')) {
        persistedConfig = JSON.parse(String(init.body || '{}')).config;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (normalizedUrl.endsWith('/session-config')) {
        const { litCredentials: _privateLitDescriptor, ...publicConfig } = persistedConfig || {};
        if (publicConfig.ai) publicConfig.ai = { models: publicConfig.ai.models };
        return { ok: true, status: 200, json: async () => ({ config: publicConfig }) };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        sessionId: '0x00112233445566778899aabbccddeeff',
        deployComplete: true,
        deployWorkerUrl: workerUrl,
        workerSecretsEnabled: false,
        draft: {
          slug: 'single-worker-session',
          sessionName: 'Single Worker Session',
          sessionInfo: 'One canonical session per worker.',
          corsWorkerUrl: workerUrl,
          storageProfile: { backend: 'cloudflare' },
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        },
      }),
    );

    try {
      const firstView = renderLoggedInSessionWizard();
      enableAdvancedMode();
      const publishButton = await openPublishSection();

      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/set-config'))).toHaveLength(1);
        expect(publishButton).toBeDisabled();
      });
      expect(publishButton).toHaveTextContent('Session Created');
      expect(screen.getByRole('button', { name: 'Create another session' })).toBeInTheDocument();
      const expectedSettlement = {
        workerUrl,
        slug: 'single-worker-session',
        sessionId: '0x00112233445566778899aabbccddeeff',
      };
      expect(readWizardCache()).toEqual({
        terminalWorkerSettlement: expect.objectContaining(expectedSettlement),
      });
      expect(
        JSON.parse(localStorage.getItem(getSessionWizardWorkerSettlementStorageKey(expectedSettlement)) || '{}'),
      ).toEqual(expect.objectContaining(expectedSettlement));

      fireEvent.click(publishButton);
      expect(global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/set-config'))).toHaveLength(1);

      firstView.unmount();
      renderLoggedInSessionWizard();
      enableAdvancedMode();
      const reloadedPublishButton = await openPublishSection();
      await waitFor(() => {
        expect(reloadedPublishButton).toBeDisabled();
      });
      const restoredSessionUrl = `${window.location.origin}/session/single-worker-session?worker=${encodeURIComponent(workerUrl)}`;
      const restoredAdminUrl = `${window.location.origin}/admin?sessionId=0x00112233445566778899aabbccddeeff&sessionSlug=single-worker-session&worker=${encodeURIComponent(workerUrl)}`;
      expect(screen.getByRole('link', { name: restoredSessionUrl })).toHaveAttribute('href', restoredSessionUrl);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_ADMIN_URL)).toHaveAttribute('href', restoredAdminUrl);
      fireEvent.click(reloadedPublishButton);
      expect(global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/admin/set-config'))).toHaveLength(1);
      expect(readWizardCache()).toEqual({
        terminalWorkerSettlement: expect.objectContaining(expectedSettlement),
      });
      expect(screen.getByRole('button', { name: 'Create another session' })).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
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
    expect(registerArgs).toEqual(
      expect.objectContaining({
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
      }),
    );
  });

  it('passes uploaded metadata through the register boundary without custom deploy execution', async () => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const uploadedTxId = 'd'.repeat(43);
    const uploadEvents = [];
    const restoreLogging = enableGeneralInfoLogging();
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args) => {
      const message = args.find((arg) => typeof arg === 'string' && arg.includes('[arweave][ui]'));
      const payload = args.find((arg) => arg && typeof arg === 'object' && arg.requestId);
      if (message) {
        uploadEvents.push(`log:${message}:${payload?.requestId || ''}`);
      }
    });
    arweaveClient.uploadDataToArweave.mockImplementation(async (_payload, format, uploadOptions = {}) => {
      uploadEvents.push(`upload:${format}:${uploadOptions.requestId || ''}`);
      return uploadedTxId;
    });
    let resolveRegister = () => {};
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    mockRegisterSessionOnChain.mockImplementation(async () => registerPromise);
    seedVerifiedWorkerCache('https://worker.example.test', {
      persistWorkerSecrets: false,
      workerSecretsEnabled: false,
      workerSecrets: {
        arweaveJwk: '{"kty":"cached"}',
      },
    });

    try {
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
        expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1);
      });

      const [metadataPayload, uploadFormat, uploadOptions] = arweaveClient.uploadDataToArweave.mock.calls[0];
      expect(metadataPayload).toEqual(
        expect.objectContaining({
          sessionName: 'Uploaded Metadata Register Boundary Session',
          slug: 'uploaded-metadata-register-boundary-session',
        }),
      );
      expect(uploadFormat).toBe('json');
      expect(uploadOptions).toEqual(
        expect.objectContaining({
          requestId: expect.stringMatching(/^arw_meta_/),
          sessionSlug: 'uploaded-metadata-register-boundary-session',
          forceDirectArweaveUpload: true,
        }),
      );
      const metadataLogIndex = uploadEvents.indexOf(
        `log:[arweave][ui] metadata upload start:${uploadOptions.requestId}`,
      );
      const metadataUploadIndex = uploadEvents.indexOf(`upload:json:${uploadOptions.requestId}`);
      expect(metadataLogIndex).toBeGreaterThanOrEqual(0);
      expect(metadataUploadIndex).toBeGreaterThan(metadataLogIndex);

      const registerArgs = mockRegisterSessionOnChain.mock.calls[0][0];
      expect(registerArgs).toEqual(
        expect.objectContaining({
          slug: 'uploaded-metadata-register-boundary-session',
          metadataURI: `ar://${uploadedTxId}`,
          sessionFields: expect.any(Object),
        }),
      );
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_URI)).toHaveTextContent(`ar://${uploadedTxId}`);
      await waitFor(() => {
        expect(readWizardCache().workerSecrets?.arweaveJwk).toBe('');
      });
      await act(async () => {
        resolveRegister({ txs: [] });
        await registerPromise;
      });
    } finally {
      consoleInfoSpy.mockRestore();
      restoreLogging();
    }
  });

  it('uploads a session header before metadata with request-scoped logs', async () => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const headerTxId = 'h'.repeat(43);
    const metadataTxId = 'm'.repeat(43);
    const uploadEvents = [];
    const restoreLogging = enableGeneralInfoLogging();
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args) => {
      const message = args.find((arg) => typeof arg === 'string' && arg.includes('[arweave][ui]'));
      const payload = args.find((arg) => arg && typeof arg === 'object' && arg.requestId);
      if (message) {
        uploadEvents.push(`log:${message}:${payload?.requestId || ''}`);
      }
    });
    arweaveClient.uploadDataToArweave.mockImplementation(async (_payload, format, uploadOptions = {}) => {
      uploadEvents.push(`upload:${format}:${uploadOptions.requestId || ''}`);
      return format === 'json' ? metadataTxId : headerTxId;
    });
    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    seedVerifiedWorkerCache();

    try {
      const view = renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Header Upload Boundary Session' },
      });
      const imageBar = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR);
      fireEvent.click(within(imageBar).getByRole('button', { name: 'Upload image' }));
      const fileInput = imageBar.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
      fireEvent.change(fileInput, {
        target: { files: [new File(['header-image'], 'header.png', { type: 'image/png' })] },
      });
      enableAdvancedMode();

      const publishButton = await openPublishSection();
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });

      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(mockRegisterSessionOnChain).toHaveBeenCalledTimes(1);
      });

      const [headerPayload, headerFormat, headerOptions] = arweaveClient.uploadDataToArweave.mock.calls[0];
      const [metadataPayload, metadataFormat, metadataOptions] = arweaveClient.uploadDataToArweave.mock.calls[1];
      expect(headerPayload).toEqual(expect.any(File));
      expect(headerFormat).toBe('png');
      expect(headerOptions).toEqual(
        expect.objectContaining({
          requestId: expect.stringMatching(/^arw_header_/),
          sessionSlug: 'header-upload-boundary-session',
        }),
      );
      expect(metadataPayload).toEqual(
        expect.objectContaining({
          sessionHeaderImg: `ar://${headerTxId}`,
          slug: 'header-upload-boundary-session',
        }),
      );
      expect(metadataFormat).toBe('json');
      expect(metadataOptions).toEqual(
        expect.objectContaining({
          requestId: expect.stringMatching(/^arw_meta_/),
          sessionSlug: 'header-upload-boundary-session',
        }),
      );
      const headerLogIndex = uploadEvents.indexOf(`log:[arweave][ui] header upload start:${headerOptions.requestId}`);
      const headerUploadIndex = uploadEvents.indexOf(`upload:png:${headerOptions.requestId}`);
      const metadataUploadIndex = uploadEvents.indexOf(`upload:json:${metadataOptions.requestId}`);
      expect(headerLogIndex).toBeGreaterThanOrEqual(0);
      expect(headerUploadIndex).toBeGreaterThan(headerLogIndex);
      expect(metadataUploadIndex).toBeGreaterThan(headerUploadIndex);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_URI)).toHaveTextContent(`ar://${metadataTxId}`);
      view.unmount();
    } finally {
      consoleInfoSpy.mockRestore();
      restoreLogging();
    }
  });

  it('blocks cached secret field gates before metadata upload', async () => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
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
      expect(
        screen.getByText(
          'Worker secret fields cannot be locked in public metadata: arweave.jwk. Store secrets in the Worker panel instead.',
        ),
      ).toBeInTheDocument();
    });
    expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  });

  it('resets progress and keeps publish retryable after metadata upload failure', async () => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let rejectUpload = () => {};
    const uploadPromise = new Promise((_, reject) => {
      rejectUpload = reject;
    });
    arweaveClient.uploadDataToArweave.mockReturnValue(uploadPromise);
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
