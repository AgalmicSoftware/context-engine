import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  act,
  buildMockSponsoredBundle,
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

const createPublicWorkerVerificationResponder = () => {
  let publicConfig = {};

  return (normalizedUrl, options = {}) => {
    if (normalizedUrl.endsWith('/admin/set-config')) {
      const payload = JSON.parse(options.body || '{}');
      publicConfig = payload.config || publicConfig;
      return { ok: true, json: async () => ({ ok: true }) };
    }
    if (normalizedUrl.includes('/session-config?slug=')) {
      const requestedSlug = new URL(normalizedUrl).searchParams.get('slug') || '';
      return {
        ok: true,
        json: async () => ({
          config: {
            ...publicConfig,
            slug: publicConfig.slug || requestedSlug,
          },
        }),
      };
    }
    return null;
  };
};

describe('SessionWizard worker panel rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps sponsored publish on the hosted bundle URL after a prior hosted-bundle fetch failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalUploadDataToArweave = arweaveClient.uploadDataToArweave.getMockImplementation();
    const originalRegisterSessionOnChain = mockRegisterSessionOnChain.getMockImplementation();
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    let resolveSponsoredBundle;
    const sponsoredBundleReady = new Promise((resolve) => {
      resolveSponsoredBundle = resolve;
    });

    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    arweaveClient.uploadDataToArweave.mockResolvedValue('a'.repeat(43));
    workerAuth.buildSignedBootstrapAdminAuth.mockClear();
    mockDecryptWithPassword.mockReturnValueOnce(sponsoredBundleReady);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();

    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/sponsored/redeem-deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.deployPayload.bundleText).toBeUndefined();
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://sponsored-deployed.example.test',
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
      if (normalizedUrl.endsWith('/admin/set-config') || normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            networkChainId: 84532,
            blockLimits: {
              start: mockSelectorSourceStartBlock,
              end: null,
            },
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
          },
        }),
      );
      renderLoggedInSessionWizard({
        initialSponsoredBundleId: 'sponsor-tx-id',
        initialSponsoredBundleKey: 'sponsor-secret',
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Sponsored Publish Retry Session' },
      });

      selectNormalModeCard('Worker');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-sponsored-normal-failure' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"sponsored-normal-failure"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();

      await act(async () => {
        resolveSponsoredBundle(buildMockSponsoredBundle());
        await sponsoredBundleReady;
      });

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
          'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit API key, deploy access.',
        );
      });

      selectNormalModeCard('Deploy Session');

      const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE)).toBeInTheDocument();
      expect(screen.getByText('Worker bundle fallback (optional)')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Sponsored publish still defaults to the GitHub-hosted bundle. Retry with a manual bundle URL or upload a bundle file. Optional fallback: Run nvm use 20 && npm run worker:bundle from the repo root, then choose /dist/sessionCorsWorker.bundle.js.',
        ),
      ).toBeInTheDocument();

      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/sponsored/redeem-deploy'))).toBe(true);
      });
      expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/worker/sessionCorsWorker.bundle.js'))).toBe(
        false,
      );
      await waitFor(() => {
        expect(arweaveClient.uploadDataToArweave).toHaveBeenCalled();
      });
      expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledWith(
        expect.anything(),
        'json',
        expect.objectContaining({
          forceDirectArweaveUpload: true,
          arweaveJwk: '{"kty":"RSA","n":"sponsored"}',
        }),
      );
      expect(workerAuth.buildSignedBootstrapAdminAuth).not.toHaveBeenCalled();
      expect(screen.queryByText('Upload a worker bundle file before deploy.')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      if (originalUploadDataToArweave) {
        arweaveClient.uploadDataToArweave.mockImplementation(originalUploadDataToArweave);
      } else {
        arweaveClient.uploadDataToArweave.mockReset();
      }
      if (originalRegisterSessionOnChain) {
        mockRegisterSessionOnChain.mockImplementation(originalRegisterSessionOnChain);
      } else {
        mockRegisterSessionOnChain.mockReset();
      }
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('retries sponsored publish with an uploaded fallback bundle file after a hosted-bundle fetch failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalUploadDataToArweave = arweaveClient.uploadDataToArweave.getMockImplementation();
    const originalRegisterSessionOnChain = mockRegisterSessionOnChain.getMockImplementation();
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const bundleFile = {
      name: 'sessionCorsWorker.bundle.js',
      type: 'text/javascript',
      text: async () => 'export default { async fetch() { return new Response("publish-ok"); } };',
    };
    let resolveSponsoredBundle;
    const sponsoredBundleReady = new Promise((resolve) => {
      resolveSponsoredBundle = resolve;
    });

    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    arweaveClient.uploadDataToArweave.mockResolvedValue('a'.repeat(43));
    workerAuth.buildSignedBootstrapAdminAuth.mockClear();
    mockDecryptWithPassword.mockReturnValueOnce(sponsoredBundleReady);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();

    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/sponsored/redeem-deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.deployPayload.bundleUrl).toBeUndefined();
        expect(payload.deployPayload.bundleText).toContain('new Response("publish-ok")');
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://sponsored-file-deployed.example.test',
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
      if (normalizedUrl.endsWith('/admin/set-config') || normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            networkChainId: 84532,
            blockLimits: {
              start: mockSelectorSourceStartBlock,
              end: null,
            },
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
          },
        }),
      );
      renderLoggedInSessionWizard({
        initialSponsoredBundleId: 'sponsor-tx-id',
        initialSponsoredBundleKey: 'sponsor-secret',
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Sponsored Publish Bundle File Retry' },
      });

      selectNormalModeCard('Worker');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-sponsored-file-retry' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"sponsored-file-retry"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });

      await act(async () => {
        resolveSponsoredBundle(buildMockSponsoredBundle());
        await sponsoredBundleReady;
      });

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
          'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit API key, deploy access.',
        );
      });

      selectNormalModeCard('Deploy Session');

      const publishBundleClearButton = screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH);
      expect(publishBundleClearButton).toBeDisabled();

      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT), {
        target: { files: [bundleFile] },
      });

      expect(publishBundleClearButton).not.toBeDisabled();

      const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/sponsored/redeem-deploy'))).toBe(true);
      });
      await waitFor(() => {
        expect(arweaveClient.uploadDataToArweave).toHaveBeenCalled();
      });
      expect(workerAuth.buildSignedBootstrapAdminAuth).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      if (originalUploadDataToArweave) {
        arweaveClient.uploadDataToArweave.mockImplementation(originalUploadDataToArweave);
      } else {
        arweaveClient.uploadDataToArweave.mockReset();
      }
      if (originalRegisterSessionOnChain) {
        mockRegisterSessionOnChain.mockImplementation(originalRegisterSessionOnChain);
      } else {
        mockRegisterSessionOnChain.mockReset();
      }
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('retries sponsored publish with a manual bundle URL override after a hosted-bundle fetch failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalUploadDataToArweave = arweaveClient.uploadDataToArweave.getMockImplementation();
    const originalRegisterSessionOnChain = mockRegisterSessionOnChain.getMockImplementation();
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const manualBundleUrl = 'https://assets.example.test/sponsored-sessionCorsWorker.bundle.js';
    let resolveSponsoredBundle;
    const sponsoredBundleReady = new Promise((resolve) => {
      resolveSponsoredBundle = resolve;
    });

    mockRegisterSessionOnChain.mockResolvedValue({ txs: [] });
    arweaveClient.uploadDataToArweave.mockResolvedValue('a'.repeat(43));
    workerAuth.buildSignedBootstrapAdminAuth.mockClear();
    mockDecryptWithPassword.mockReturnValueOnce(sponsoredBundleReady);
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();

    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/sponsored/redeem-deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.deployPayload.bundleUrl).toBe(manualBundleUrl);
        expect(payload.deployPayload.bundleText).toBeUndefined();
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://sponsored-deployed.example.test',
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
      if (normalizedUrl.endsWith('/admin/set-config') || normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
      sessionStorage.setItem(
        'ce:sessionWizardDraft:v1',
        JSON.stringify({
          draft: {
            networkChainId: 84532,
            blockLimits: {
              start: mockSelectorSourceStartBlock,
              end: null,
            },
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
          },
        }),
      );
      renderLoggedInSessionWizard({
        initialSponsoredBundleId: 'sponsor-tx-id',
        initialSponsoredBundleKey: 'sponsor-secret',
      });

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Sponsored Publish Manual URL Retry' },
      });

      selectNormalModeCard('Worker');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-sponsored-url-retry' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"sponsored-url-retry"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });

      await act(async () => {
        resolveSponsoredBundle(buildMockSponsoredBundle());
        await sponsoredBundleReady;
      });

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(
          'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit API key, deploy access.',
        );
      });

      selectNormalModeCard('Deploy Session');

      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE), {
        target: { value: manualBundleUrl },
      });

      const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/sponsored/redeem-deploy'))).toBe(true);
      });
      await waitFor(() => {
        expect(arweaveClient.uploadDataToArweave).toHaveBeenCalled();
      });
      expect(workerAuth.buildSignedBootstrapAdminAuth).not.toHaveBeenCalled();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE)).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      if (originalUploadDataToArweave) {
        arweaveClient.uploadDataToArweave.mockImplementation(originalUploadDataToArweave);
      } else {
        arweaveClient.uploadDataToArweave.mockReset();
      }
      if (originalRegisterSessionOnChain) {
        mockRegisterSessionOnChain.mockImplementation(originalRegisterSessionOnChain);
      } else {
        mockRegisterSessionOnChain.mockReset();
      }
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });
});
