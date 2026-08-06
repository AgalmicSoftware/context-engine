import {
  E2E_TESTIDS,
  fireEvent,
  renderSessionWizard,
  screen,
  waitFor,
  within,
  enableAdvancedMode,
  mockDecryptWithPassword,
  buildMockSponsoredBundle,
  NEW_SESSION_BANNER_DISMISSED_KEY,
  resetSessionWizardWorkerPanelTestState,
} from './SessionWizard.workerPanel.testUtils';

const expectSponsoredStatusText = async (expectedText) => {
  await waitFor(() => {
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SPONSORED_STATUS)).toHaveTextContent(expectedText);
  });
};

describe('SessionWizard new-session requirements banner', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it.each(['/new', '/session/new'])('shows the new-session requirements banner on %s', async (pathname) => {
    window.history.replaceState({}, '', pathname);

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('shows the new-session requirements banner on PUBLIC_URL-prefixed new-session routes', async () => {
    process.env.PUBLIC_URL = '/ce/';
    window.history.replaceState({}, '', '/ce/session/new');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('offers native Cloudflare deployment without a token from the Fast & Cheap onboarding banner', async () => {
    window.history.replaceState({}, '', '/session/new');

    renderSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await selectCloudflarePreset();

    expect(screen.getByRole('link', { name: 'Cloudflare account' })).toHaveAttribute(
      'href',
      'https://dash.cloudflare.com/',
    );
    expect(screen.queryByText(/does not ask for a Cloudflare API token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Worker step deploys the full Session Worker/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_ONBOARDING_LINK)).not.toBeInTheDocument();
  });

  it('adds the Wrapped token without replacing the Cloudflare account or AI key', async () => {
    window.history.replaceState({}, '', '/session/new');

    renderSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await selectCloudflarePreset();
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: 'Worker deployment & secrets' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Agent Session Wrapped' }));

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_ONBOARDING_LINK)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Cloudflare account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI provider key' })).toBeInTheDocument();
  });

  it('renders the decentralized requirements copy and contact link on /session/new', async () => {
    window.history.replaceState({}, '', '/session/new');

    renderSessionWizard({ network: null });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.getByRole('link', { name: 'OpenAI API key' })).toHaveAttribute(
      'href',
      'https://platform.openai.com/api-keys',
    );
    expect(screen.getByText(/for text and transcription/i)).toBeInTheDocument();
    expect(screen.getByText(/compatible Session Worker provides the web runtime/i)).toHaveTextContent(
      'the EVM registry and Arweave remain canonical',
    );
    expect(screen.queryByRole('link', { name: 'Lit API key' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Arweave wallet (JWK)' })).toHaveAttribute(
      'href',
      'https://docs.arweave.org/developers/wallets/arweave-wallet',
    );
    expect(screen.getByRole('link', { name: 'OP Sepolia ETH for on-chain registration' })).toHaveAttribute(
      'href',
      'https://console.optimism.io/faucet',
    );
    expect(screen.getByText('(Optional) A faucet private key for sponsoring user gas')).toBeInTheDocument();
    expect(screen.getByText('A turnkey tool for bundling these resources is in development.')).toBeInTheDocument();
    expect(screen.getByText(/in the meantime, you can get a sponsored session url by contacting/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contextengine@protonmail.com' })).toHaveAttribute(
      'href',
      'mailto:contextengine@protonmail.com',
    );
  });

  it('updates the new-session requirements chain label when the selected deploy chain changes', async () => {
    window.history.replaceState({}, '', '/session/new');

    renderSessionWizard({ network: null });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.getByText('OP Sepolia ETH for on-chain registration')).toBeInTheDocument();

    enableAdvancedMode();

    const chainSelectorWrap = screen.getByText('Network:').parentElement;
    expect(chainSelectorWrap).toBeTruthy();
    fireEvent.change(within(chainSelectorWrap).getByRole('combobox'), {
      target: { value: '31337' },
    });

    await waitFor(() => {
      expect(screen.getByText('Anvil ETH for on-chain registration')).toBeInTheDocument();
    });
    expect(screen.queryByText('OP Sepolia ETH for on-chain registration')).not.toBeInTheDocument();
  });

  it('does not show the new-session requirements banner when a sponsored bundle covers setup requirements', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await expectSponsoredStatusText(
      'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit API key, deploy access.',
    );
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });

  it('keeps Cloudflare requirements visible when sponsored setup is missing deploy access', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
    const sponsoredBundleWithoutDeployAccess = buildMockSponsoredBundle();
    delete sponsoredBundleWithoutDeployAccess.deployGrantToken;
    mockDecryptWithPassword.mockResolvedValueOnce(sponsoredBundleWithoutDeployAccess);

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await expectSponsoredStatusText(
      'Sponsored resources applied: OpenAI key, Arweave wallet, faucet funding, Lit API key.',
    );
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('keeps the new-session requirements banner visible for partial sponsored bundles', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
    mockDecryptWithPassword.mockResolvedValueOnce({
      openaiKey: 'sponsored-openai',
      meta: {
        label: 'Partial bundle',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
        sourceSessionSlug: 'source-session',
        sourceWorkerUrl: 'https://source-worker.example.test',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await expectSponsoredStatusText('Sponsored resources applied: OpenAI key.');
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('keeps the new-session requirements hidden while waiting for the separate sponsored key', async () => {
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: '',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await expectSponsoredStatusText('Enter the sponsored bundle decryption key to continue.');
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });

  it('dismisses the new-session requirements banner and keeps it hidden after remount', async () => {
    window.history.replaceState({}, '', '/session/new');

    const firstRender = renderSessionWizard();

    await screen.findByRole('heading', { name: /to create a session you'll need:/i });

    fireEvent.click(screen.getByRole('button', { name: /dismiss session setup requirements/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(NEW_SESSION_BANNER_DISMISSED_KEY)).toBe('true');

    firstRender.unmount();
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });

  it('shows the requirements banner for manual sponsored fallback even after plain /new was dismissed', async () => {
    window.history.replaceState({}, '', '/session/new');

    const firstRender = renderSessionWizard();

    await screen.findByRole('heading', { name: /to create a session you'll need:/i });
    fireEvent.click(screen.getByRole('button', { name: /dismiss session setup requirements/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(NEW_SESSION_BANNER_DISMISSED_KEY)).toBe('true');

    firstRender.unmount();
    window.history.replaceState({}, '', '/session/new?sponsored=sponsor-tx-id');
    mockDecryptWithPassword.mockResolvedValueOnce({
      openaiKey: 'sponsored-openai',
      meta: {
        label: 'Partial bundle',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
        sourceSessionSlug: 'source-session',
        sourceWorkerUrl: 'https://source-worker.example.test',
      },
    });

    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor-tx-id',
      initialSponsoredBundleKey: 'sponsor-secret',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await expectSponsoredStatusText('Sponsored resources applied: OpenAI key.');
    expect(screen.getByRole('heading', { name: /to create a session you'll need:/i })).toBeInTheDocument();
  });

  it('does not show the new-session requirements banner outside the new-session routes', async () => {
    window.history.replaceState({}, '', '/');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByRole('heading', { name: /to create a session you'll need:/i })).not.toBeInTheDocument();
  });
});
