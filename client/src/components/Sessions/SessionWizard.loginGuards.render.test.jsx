import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  deployVerifiedWorkerForCurrentDraft,
  fireEvent,
  rerenderSessionWizard,
  renderSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  enableAdvancedMode,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard login guard rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('prompts for login instead of attempting publish when publish is available but no wallet is connected', async () => {
    const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
    const originalGetProvider = cryptoUtils._getProvider.getMockImplementation();
    const providerRequest = jest.fn(async ({ method }) => {
      if (method === 'eth_accounts') return [];
      if (method === 'eth_chainId') return '0x14a34';
      if (method === 'net_version') return '84532';
      if (method === 'eth_requestAccounts') {
        throw new Error('publish should open the login modal instead of requesting wallet accounts');
      }
      return [];
    });
    cryptoUtils._getProvider.mockImplementation(() => ({
      request: providerRequest,
    }));
    const toggleLoginModal = jest.fn();
    try {
      const view = renderSessionWizard({
        account: TEST_ADMIN_ADDRESS,
        loginComplete: true,
        toggleLoginModal,
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      fireEvent.change(sessionNameInput, {
        target: { value: 'Login Required Publish Session' },
      });
      await deployVerifiedWorkerForCurrentDraft();
      rerenderSessionWizard(view, {
        account: '',
        loginComplete: false,
        toggleLoginModal,
      });
      enableAdvancedMode();

      fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));
      fireEvent.click(screen.getByLabelText('Advanced publish settings'));
      fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
        target: { value: 'ar://'.concat('a'.repeat(43)) },
      });

      const publishButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      await waitFor(() => {
        expect(publishButton).not.toBeDisabled();
      });

      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(toggleLoginModal).toHaveBeenCalledWith(true);
        expect(screen.getByText('Connect your wallet to publish this session.')).toBeInTheDocument();
      });
      expect(providerRequest.mock.calls.map(([payload]) => payload?.method)).not.toContain('eth_requestAccounts');
    } finally {
      cryptoUtils._getProvider.mockImplementation(originalGetProvider);
    }
  });

  it('prompts for login before direct worker deploy starts when no wallet session is active', async () => {
    const toggleLoginModal = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));

    try {
      renderSessionWizard({
        account: '',
        loginComplete: false,
        toggleLoginModal,
      });
      enableAdvancedMode();
      fireEvent.change(screen.getAllByRole('combobox')[0], {
        target: { value: '84532' },
      });

      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
      if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
      }

      fireEvent.change(sessionNameInput, {
        target: { value: 'Login Before Deploy Session' },
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
        target: { value: 'login-before-deploy-session' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(toggleLoginModal).toHaveBeenCalledWith(true);
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
          'Connect your wallet to set the admin address.',
        );
      });
      expect(global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'))).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
