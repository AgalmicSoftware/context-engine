import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  fireEvent,
  openSetupSection,
  renderSessionWizard,
  rerenderSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  setCloudflareApiToken,
  waitFor,
  within,
} from './SessionWizard.workerPanel.testUtils';

const WORKER_URL = 'https://quick-path-worker.example.test';

// A deploy helper and a Session Worker that keep the written config.
const installQuickPathFetch = () => {
  let persistedConfig = null;
  let configWrites = 0;
  let finishVerification = () => {};
  const verificationHeld = new Promise((resolve) => {
    finishVerification = resolve;
  });
  const fetchMock = jest.fn(async (url, init = {}) => {
    const normalizedUrl = String(url);
    if (normalizedUrl.endsWith('/deploy')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          workerUrl: WORKER_URL,
          configVerified: true,
          writesSessionConfig: true,
          writesSessionSecrets: true,
        }),
      };
    }
    if (normalizedUrl.endsWith('/admin/set-config')) {
      persistedConfig = JSON.parse(String(init.body || '{}')).config;
      configWrites += 1;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (normalizedUrl.endsWith('/session-config') || normalizedUrl.includes('/session-config?')) {
      // The first write and read are the deploy's. The read after the publish's write is the last step.
      if (configWrites > 1) await verificationHeld;
      const { litCredentials: _privateLitDescriptor, ...publicConfig } = persistedConfig || {};
      if (publicConfig.ai) publicConfig.ai = { models: publicConfig.ai.models };
      return { ok: true, status: 200, json: async () => ({ config: publicConfig }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  global.fetch = fetchMock;
  return { fetchMock, finishVerification };
};

const callsTo = (fetchMock, suffix) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix));
const configReads = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url).includes('/session-config'));

describe('SessionWizard quick path', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    resetSessionWizardWorkerPanelTestState();
    window.history.replaceState({}, '', '/new');
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates a Worker-hosted session from a name, a Cloudflare token and an AI key after the passkey sign-in', async () => {
    const { fetchMock, finishVerification } = installQuickPathFetch();
    const toggleLoginModal = jest.fn();
    const view = renderSessionWizard({ account: '', loginComplete: false, toggleLoginModal });

    const createButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Quick Salon' } });
    const missing = screen.getByTestId('ce-setup-missing');
    expect(missing).toHaveTextContent('Enter your Cloudflare API token');
    expect(missing).toHaveTextContent('Enter the OpenAI key.');
    expect(createButton).toBeDisabled();

    // The two keys sit outside every More: Hosting's token and the AI key.
    setCloudflareApiToken('cf-quick-token');
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), { target: { value: 'sk-quick-key' } });
    expect(screen.queryByTestId('ce-setup-missing')).not.toBeInTheDocument();
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('ce-setup-create-stage')).toHaveTextContent('Confirm with your passkey');
    expect(callsTo(fetchMock, '/deploy')).toHaveLength(0);

    // Signing in resumes Create: the deploy helper, then the publish runtime.
    rerenderSessionWizard(view, { account: TEST_ADMIN_ADDRESS, loginComplete: true, toggleLoginModal });
    await waitFor(() => expect(callsTo(fetchMock, '/deploy')).toHaveLength(1), { timeout: 8000 });
    expect(JSON.parse(String(callsTo(fetchMock, '/deploy')[0][1].body)).apiToken).toBe('cf-quick-token');
    // URLs appear only once the session is verified and published. Hold the final check
    // open to see that: every mock answers at once, so it could otherwise already be done.
    await waitFor(() => expect(configReads(fetchMock).length).toBeGreaterThan(1), { timeout: 8000 });
    expect(callsTo(fetchMock, '/admin/set-config').length).toBeGreaterThan(1);
    expect(screen.queryByRole('link', { name: /\/session\/quick-salon/ })).not.toBeInTheDocument();

    finishVerification();
    await waitFor(() => expect(createButton).toHaveTextContent('Session created'), { timeout: 8000 });
    const finalWrite = JSON.parse(String(callsTo(fetchMock, '/admin/set-config').at(-1)[1].body));
    expect(finalWrite.config).toMatchObject({
      slug: 'quick-salon',
      sessionName: 'Quick Salon',
      sessionModeProfile: expect.objectContaining({ authority: { mode: 'worker_canonical' } }),
    });
    expect(finalWrite.config.configRevision).toEqual(expect.any(String));
    const sessionUrl = `${window.location.origin}/session/quick-salon?worker=${encodeURIComponent(WORKER_URL)}`;
    expect(screen.getByRole('link', { name: sessionUrl })).toHaveAttribute('href', sessionUrl);

    // Secrets are request-only: the token and key never reach browser storage.
    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage });
    expect(stored).not.toContain('cf-quick-token');
    expect(stored).not.toContain('sk-quick-key');
  }, 20000);

  it('blocks Create while a conflict remains and shows its plain message beside the option', async () => {
    renderSessionWizard({ account: TEST_ADMIN_ADDRESS, loginComplete: true, toggleLoginModal: jest.fn() });
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Rules' } });
    setCloudflareApiToken('cf-rules-token');
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), { target: { value: 'sk-rules' } });
    const createButton = screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    expect(createButton).toBeEnabled();

    openSetupSection('access');
    fireEvent.click(screen.getByLabelText('SBTs grant permissions'));
    const access = screen.getByTestId('ce-setup-section-access');
    expect(within(access).getByTestId('ce-setup-conflict-sbt_authorization_requires_condition')).toHaveTextContent(
      'SBT permissions need at least one SBT rule.',
    );
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('SBTs grant permissions'));
    expect(screen.queryByTestId('ce-setup-conflict-sbt_authorization_requires_condition')).not.toBeInTheDocument();
    expect(createButton).toBeEnabled();
  });
});
