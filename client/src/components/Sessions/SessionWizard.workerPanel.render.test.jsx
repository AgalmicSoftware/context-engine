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
  enableAdvancedMode,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard worker panel rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps the normal-mode worker step focused on bring-your-own worker setup while defaulting to the release bundle URL', async () => {
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(await screen.findByText('Bring your own worker')).toBeInTheDocument();
    expect((await screen.findAllByText('Cloudflare API token')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Upload bundle file')).not.toBeInTheDocument();
    expect(screen.queryByText('Using Default Worker')).not.toBeInTheDocument();
    expect(screen.queryByText('Use My Own')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Most sessions can stay on the shared default worker. Only switch to your own worker if you want to manage the infrastructure yourself.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('How should this session run?')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared hosted worker')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker secrets')).not.toBeInTheDocument();
    expect(screen.queryByText('Dev: keep secrets on refresh')).not.toBeInTheDocument();
    expect(screen.queryByText('Require users to pay for usage')).not.toBeInTheDocument();
    expect(screen.queryByText('Resource gates (on-chain)')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
    expect(screen.queryByText('Deploy-helper URL')).not.toBeInTheDocument();
    expect(screen.getByText('Worker bundle URL (release asset)')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');
    expect(
      screen.getByText(
        'Normal mode deploys use the GitHub-hosted worker bundle automatically. If a retry needs a different source, keep this Git URL as the default and add a manual bundle URL or upload below after a fetch failure.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Worker name')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Passing a Cloudflare API token to a deploy-helper requires trust.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
  });

  it('defaults advanced custom-worker deploys to the configured release bundle URL', async () => {
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_URL)).toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_UPLOAD)).not.toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
  });

  it('builds Chipotle worker config for global Lit hooks when Lit v3 worker secrets are present', () => {
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') =>
      String(value || '')
        .trim()
        .replace(/\/+$/, ''),
    );
    try {
      expect(
        resolveSessionWizardChipotleHookConfig({
          workerSecretsEnabled: true,
          resolvedWorkerUrl: 'https://chipotle-worker.example.test/',
          draft: {
            slug: 'chipotle-hook-session',
            sessionName: 'Chipotle Hook Session',
          },
          workerSecrets: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: '21',
            litPkpId: '0xaeb338631a7cb716c7ac2effd22b7b69ebcd137b',
            litActionCid: 'QmYyLDMz1AQYo3mPeHbBLTyfae8fhK5muXyqPhnAedJbr4',
          },
        }),
      ).toEqual(
        expect.objectContaining({
          enabled: true,
          workerUrl: 'https://chipotle-worker.example.test',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: 'QmYyLDMz1AQYo3mPeHbBLTyfae8fhK5muXyqPhnAedJbr4',
            litGroupId: '21',
            litPkpId: '0xaeb338631a7cb716c7ac2effd22b7b69ebcd137b',
          },
          sessionConfig: {
            slug: 'chipotle-hook-session',
            sessionName: 'Chipotle Hook Session',
            corsWorkerUrl: 'https://chipotle-worker.example.test',
            litCredentials: {
              litApiBase: 'https://api.chipotle.litprotocol.com',
              litActionCid: 'QmYyLDMz1AQYo3mPeHbBLTyfae8fhK5muXyqPhnAedJbr4',
              litGroupId: '21',
              litPkpId: '0xaeb338631a7cb716c7ac2effd22b7b69ebcd137b',
            },
          },
        }),
      );

      expect(
        resolveSessionWizardChipotleHookConfig({
          workerSecretsEnabled: true,
          resolvedWorkerUrl: 'https://chipotle-worker.example.test',
          workerSecrets: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
          },
          draft: {
            slug: 'chipotle-hook-session',
          },
        }),
      ).toBeNull();
    } finally {
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('restores the configured release bundle URL after returning from advanced mode to normal mode', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url) => {
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
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Bundle Reset' },
      });

      enableAdvancedMode();
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const advancedBundleUrlInput = screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL);
      fireEvent.change(advancedBundleUrlInput, {
        target: { value: 'https://bundles.example.test/custom-sessionCorsWorker.bundle.js' },
      });
      await waitFor(() => {
        expect(advancedBundleUrlInput).toHaveValue('https://bundles.example.test/custom-sessionCorsWorker.bundle.js');
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL));
      selectNormalModeCard('Worker');

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-reset' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal-reset"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleUrl).not.toBe('https://bundles.example.test/custom-sessionCorsWorker.bundle.js');
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('keeps the embedded deploy-helper toggle out of Step 1 in normal /new mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).not.toBeInTheDocument();
    expect(screen.queryByText('Enable embedded deploy-helper on this worker')).not.toBeInTheDocument();
  });

  it('shows the embedded deploy-helper toggle in the normal-mode worker step and lets the user disable it', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    const embeddedToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED);
    expect(embeddedToggle).toBeChecked();

    fireEvent.click(embeddedToggle);
    expect(embeddedToggle).not.toBeChecked();
  });
});
