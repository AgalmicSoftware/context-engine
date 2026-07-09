import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  act,
  ethers,
  fireEvent,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  enableAdvancedMode,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard deploy payload rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('includes a cached Cloudflare account id in the deploy-helper payload', async () => {
    const originalFetch = global.fetch;
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const web3ProviderSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(() => ({
      getSigner: () => ({
        getAddress: jest.fn().mockResolvedValue(TEST_ADMIN_ADDRESS),
        signMessage: jest.fn().mockResolvedValue('0xsigned-admin-request'),
      }),
    }));
    const verifyMessageSpy = jest.spyOn(ethers.utils, 'verifyMessage').mockReturnValue(TEST_ADMIN_ADDRESS);
    localStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        deployForm: {
          accountId: 'cf-account-1',
        },
      }),
    );
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => {
      const trimmed = String(value || '').trim();
      return trimmed || 'https://deploy-helper.example.test';
    });
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
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard({
        provider: {
          request: jest.fn(async ({ method }) => (method === 'eth_accounts' ? [TEST_ADMIN_ADDRESS] : [])),
        },
        toggleLoginModal: jest.fn(),
      });
      enableAdvancedMode();

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Deploy Account Id Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'deploy-account-id-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const deployHelperInput = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL);
      fireEvent.change(deployHelperInput, {
        target: { value: 'https://deploy-helper.example.test' },
      });
      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-latest' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"abc"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      let deployCall;
      await waitFor(() => {
        deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
        expect(deployCall).toBeTruthy();
      });

      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.accountId).toBe('cf-account-1');
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/account'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
      web3ProviderSpy.mockRestore();
      verifyMessageSpy.mockRestore();
    }
  });
});
