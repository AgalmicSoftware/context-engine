import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  act,
  ethers,
  fireEvent,
  getSessionWizardPublishProgressPercent,
  mockDecryptWithPassword,
  mockRegisterSessionOnChain,
  mockSelectorSourceFactory,
  mockSelectorSourceStartBlock,
  renderLoggedInSessionWizard,
  renderSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  resolveSessionWizardChipotleHookConfig,
  resolveSessionWizardWorkerBaseUrl,
  screen,
  selectNormalModeCard,
  createPublicWorkerVerificationResponder,
  enableAdvancedMode,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard worker panel rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps the privacy panel usable in advanced mode after queuing an SBT draft in normal mode', async () => {
    renderLoggedInSessionWizard({
      initialSessionId: '0x11111111111111111111111111111111',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();

    enableAdvancedMode();

    const privacyToggle = await screen.findByRole('button', { name: /groups allowed to decrypt locked fields/i });
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();

    fireEvent.click(privacyToggle);
    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
    });

    fireEvent.click(privacyToggle);
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
  });

  it('shows the embedded deploy-helper toggle in advanced custom-worker mode and lets the user disable it', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

    const embeddedToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED);
    expect(embeddedToggle).toBeChecked();

    fireEvent.click(embeddedToggle);
    expect(embeddedToggle).not.toBeChecked();
  });

  it('hydrates the embedded deploy-helper toggle from the default-session source config', async () => {
    const contractScriptsModule = require('../../utilities/web3/chainGateway.js');
    const originalStrictConfig = contractScriptsModule.getSessionConfigBySlugOrDefault.getMockImplementation();

    contractScriptsModule.getSessionConfigBySlugOrDefault.mockImplementation((slug = '') => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized) return null;
      return {
        slug: '',
        sessionName: 'Context Engine',
        networkChainId: 84532,
        contracts: {},
        embeddedDeployHelperEnabled: false,
      };
    });

    try {
      renderSessionWizard({ activeSessionSlug: '' });

      await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      selectNormalModeCard('Worker');

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).not.toBeChecked();
      });
    } finally {
      contractScriptsModule.getSessionConfigBySlugOrDefault.mockImplementation(originalStrictConfig);
    }
  });

  it('does not refetch default sponsored SBT metadata after unrelated draft edits once seeded', async () => {
    const contractScriptsModule = require('../../utilities/web3/chainGateway.js');
    const sponsoredAddress = ethers.utils.getAddress('0x1111111111111111111111111111111111111111');
    const getSbtMetadataMock = contractScriptsModule.default.getSbtMetadata;
    getSbtMetadataMock.mockResolvedValue({
      address: sponsoredAddress,
      name: 'Loop Guard SBT',
      symbol: 'LGSBT',
      admin: TEST_ADMIN_ADDRESS,
    });

    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          slug: 'guard-session',
          sessionName: 'Guard Session',
          networkChainId: 84532,
          contracts: {
            sbtFactory: {
              address: mockSelectorSourceFactory,
              chainId: 84532,
            },
          },
          __registry: {
            chainId: 84532,
            registryChainId: 84532,
          },
          sponsored: {
            defaultGateId: 'gate-1',
            gates: {
              'gate-1': {
                sbtAddress: sponsoredAddress,
                sbtAddresses: [sponsoredAddress],
                chainId: 84532,
                mode: 'any',
              },
            },
          },
        },
      }),
    );

    renderSessionWizard({ activeSessionSlug: 'guard-session' });

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await waitFor(() => {
      expect(getSbtMetadataMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(sessionNameInput, { target: { value: 'Guard Session Updated' } });
    await waitFor(() => {
      expect(sessionNameInput).toHaveValue('Guard Session Updated');
    });
    await waitFor(() => {
      expect(getSbtMetadataMock).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps an empty cached worker URL editable without marking it verified', async () => {
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          corsWorkerUrl: '',
        },
        deployComplete: false,
        deployWorkerUrl: '',
      }),
    );

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('');
    expect(
      screen.queryByText('Worker URL appears here after a successful custom worker deploy.'),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      const cachedRaw = sessionStorage.getItem('ce:sessionWizardDraft:v1') || '{}';
      expect(JSON.parse(cachedRaw).draft.corsWorkerUrl).toBe('');
    });
  });

  it('does not resurrect a stale cached deploy URL after deploy verification was cleared', async () => {
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          corsWorkerUrl: '',
        },
        deployComplete: false,
        deployWorkerUrl: 'https://deployed.example.test',
      }),
    );

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('');
    expect(
      screen.queryByText('Worker URL appears here after a successful custom worker deploy.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Step 3: Session Worker/i })).toHaveClass('normalModeCardPending');
  });

  it('does not trust a cached deploy URL as verified after reload', async () => {
    const deployedWorkerUrl = 'https://deployed.example.test';
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          corsWorkerUrl: deployedWorkerUrl,
        },
        deployComplete: true,
        deployWorkerUrl: deployedWorkerUrl,
      }),
    );

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue(deployedWorkerUrl);
    expect(
      screen.queryByText('Worker URL appears here after a successful custom worker deploy.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Step 3: Session Worker/i })).toHaveClass('normalModeCardPending');
    expect(screen.queryByText('Custom worker ready')).not.toBeInTheDocument();
  });

  it('keeps the verified worker URL and publish readiness after a normal-mode deploy in /new', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed;
    });
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      const publicVerificationResponse = respondToPublicWorkerVerification(normalizedUrl, options);
      if (publicVerificationResponse) return publicVerificationResponse;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      fireEvent.change(sessionNameInput, {
        target: { value: 'Normal Mode Deploy Session' },
      });

      selectNormalModeCard('Worker');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();

      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL)).not.toBeInTheDocument();

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      expect(reactPropsKey).toBeTruthy();
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleText).toBeUndefined();
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('https://deployed.example.test');

      selectNormalModeCard('Deploy Session');

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).not.toBeDisabled();
      });
      expect(
        screen.queryByText('Custom worker mode requires a successful deploy in this run before metadata upload.'),
      ).not.toBeInTheDocument();

      selectNormalModeCard('Worker');
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('https://deployed.example.test');
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('surfaces worker activation details after deploy-helper succeeds', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
            subdomain: 'tenant-subdomain',
            subdomainStatus: 'active',
            scriptSubdomainEnabled: true,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      const publicVerificationResponse = respondToPublicWorkerVerification(normalizedUrl, options);
      if (publicVerificationResponse) return publicVerificationResponse;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      fireEvent.change(sessionNameInput, {
        target: { value: 'Workers Dev Status Session' },
      });

      selectNormalModeCard('Worker');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL)).not.toBeInTheDocument();

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-workers-dev-status' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"workers-dev"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          /Worker deployed\..*account active \(tenant-subdomain\); script enabled\./,
        );
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleText).toBeUndefined();
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toHaveValue('https://deployed.example.test');
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('only falls back to the shared worker URL when the wizard is explicitly in default mode', () => {
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());

    expect(
      resolveSessionWizardWorkerBaseUrl({
        configuredWorkerUrl: '',
        deployWorkerUrl: '',
        fallbackWorkerUrl: 'https://shared.example.test',
        workerMode: 'custom',
      }),
    ).toBe('');

    expect(
      resolveSessionWizardWorkerBaseUrl({
        configuredWorkerUrl: '',
        deployWorkerUrl: '',
        fallbackWorkerUrl: 'https://shared.example.test',
        workerMode: 'default',
      }),
    ).toBe('https://shared.example.test');
  });

  it('fills publish progress gradually within an active step and completes at 100 after done', () => {
    expect(
      getSessionWizardPublishProgressPercent({
        publishStep: 2,
        publishBusy: true,
        totalSteps: 5,
        elapsedMs: 0,
      }),
    ).toBeGreaterThan(20);
    expect(
      getSessionWizardPublishProgressPercent({
        publishStep: 2,
        publishBusy: true,
        totalSteps: 5,
        elapsedMs: 2600,
      }),
    ).toBeGreaterThan(35);
    expect(
      getSessionWizardPublishProgressPercent({
        publishStep: 5,
        publishBusy: false,
        totalSteps: 5,
        elapsedMs: 0,
      }),
    ).toBe(100);
  });
});
