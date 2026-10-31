import {
  E2E_TESTIDS,
  fireEvent,
  getGateCreateSbtButton,
  mockPendingSbtAddress,
  openSetupSection,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  selectNormalModeCard,
  selectRegistryHosting,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard pending SBT modal rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('retargets the shared create-SBT button to the gate currently being edited', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectRegistryHosting();
    selectNormalModeCard('Privacy');

    const createButton = getGateCreateSbtButton();
    expect(createButton).toHaveAttribute('data-ce-sbt-target', 'gate-1');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_ADD_GATE));
    const secondGateAllButton = screen.getAllByRole('button', { name: 'ALL' })[1];
    fireEvent.mouseDown(secondGateAllButton);
    fireEvent.click(secondGateAllButton);

    await waitFor(() => {
      expect(createButton).toHaveAttribute('data-ce-sbt-target', 'gate-2');
    });

    fireEvent.click(createButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const gateOneSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-1',
      );
      const gateTwoSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-2',
      );

      expect(gateOneSelector).toHaveAttribute('data-selected-addresses', '');
      expect(gateTwoSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });
  });

  it('passes the latest slug and Arweave JWK into the inline create-SBT modal', async () => {
    renderLoggedInSessionWizard();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Inline Proof' },
    });
    selectRegistryHosting();
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA"}' },
    });
    openSetupSection('access');

    fireEvent.click(getGateCreateSbtButton());

    const modal = await screen.findByTestId('mock-create-sbt-group');
    expect(modal).toHaveAttribute('data-session-slug', 'inline-proof');
    expect(modal).toHaveAttribute('data-session-config-slug', 'inline-proof');
    expect(modal).toHaveAttribute('data-arweave-jwk', '{"kty":"RSA"}');
  });

  it('prefers the draft slug over a stale active session slug in the inline create-SBT modal', async () => {
    renderLoggedInSessionWizard({ activeSessionSlug: 'previous-session' });

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Draft Session Slug' },
    });
    selectRegistryHosting();
    openSetupSection('access');

    fireEvent.click(getGateCreateSbtButton());

    const modal = await screen.findByTestId('mock-create-sbt-group');
    expect(modal).toHaveAttribute('data-session-slug', 'draft-session-slug');
    expect(modal).toHaveAttribute('data-session-config-slug', 'draft-session-slug');
  });

  it('drops the worker Arweave JWK override from the inline create-SBT modal when require-pay is enabled', async () => {
    renderLoggedInSessionWizard();

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Inline Proof User Paid' },
    });
    selectRegistryHosting();
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
      target: { value: '{"kty":"RSA"}' },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY));
    openSetupSection('access');

    fireEvent.click(getGateCreateSbtButton());

    const modal = await screen.findByTestId('mock-create-sbt-group');
    expect(modal).toHaveAttribute('data-session-slug', 'inline-proof-user-paid');
    expect(modal).toHaveAttribute('data-session-config-slug', 'inline-proof-user-paid');
    expect(modal).toHaveAttribute('data-arweave-jwk', '');
  });
});
