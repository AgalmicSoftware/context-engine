import {
  E2E_TESTIDS,
  createPendingFeaturedDraft,
  enableAdvancedMode,
  ensureGateASelectorVisible,
  expectSelectorAddresses,
  fireEvent,
  mockPendingSbtAddress,
  mockReplacementSbtAddress,
  openAdvancedMoreOptions,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  waitFor,
  within,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard pending featured SBT rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('auto-links a featured pending SBT draft into Gate A when created from the step-1 featured button', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();

    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
    await ensureGateASelectorVisible();
    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress]);
  });

  it('restores the auto-linked Gate A pending draft after a refresh while the pending draft still exists', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();

    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
    await ensureGateASelectorVisible();
    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress]);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();

    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
    await ensureGateASelectorVisible();
    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress]);
  });

  it('stops re-adding the auto-linked Gate A draft after the user removes it from Gate A', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    fireEvent.click(
      screen.getByRole('button', {
        name: `Mock remove ${mockPendingSbtAddress} from encryption-gate-gate-1`,
      }),
    );

    await expectSelectorAddresses('encryption-gate-gate-1', []);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('encryption-gate-gate-1', []);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
  });

  it('removing the featured pending draft from Step 1 also clears the auto-linked Gate A selector', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    fireEvent.click(
      screen.getByRole('button', {
        name: `Mock remove ${mockPendingSbtAddress} from default-featured-sbts`,
      }),
    );

    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);
  });

  it('disables the Gate A auto-link after the user replaces it with another SBT', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Mock add encryption-gate-gate-1 SBT' }));

    await expectSelectorAddresses('encryption-gate-gate-1', [mockPendingSbtAddress, mockReplacementSbtAddress]);

    fireEvent.click(
      screen.getByRole('button', {
        name: `Mock remove ${mockPendingSbtAddress} from encryption-gate-gate-1`,
      }),
    );

    await expectSelectorAddresses('encryption-gate-gate-1', [mockReplacementSbtAddress]);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('encryption-gate-gate-1', [mockReplacementSbtAddress]);
    await expectSelectorAddresses('default-featured-sbts', [mockPendingSbtAddress]);
  });

  it('clears the pending featured draft, Gate A auto-link, and selectors when the pending draft is deleted', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await createPendingFeaturedDraft();
    await ensureGateASelectorVisible();

    const pendingCard = await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT);
    fireEvent.click(within(pendingCard).getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
    });
    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await openAdvancedMoreOptions();
    await ensureGateASelectorVisible();

    await expectSelectorAddresses('default-featured-sbts', []);
    await expectSelectorAddresses('encryption-gate-gate-1', []);
  });

  it('prunes pending featured SBT selections after a refresh when no live sessionStorage draft exists', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    const featuredCreateButton = await waitFor(() => {
      const button = screen
        .getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT)
        .find((node) => node.getAttribute('data-ce-sbt-target') === 'defaultFeaturedSBTs');
      expect(button).toBeTruthy();
      return button;
    });

    fireEvent.click(featuredCreateButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const featuredSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'default-featured-sbts',
      );
      expect(featuredSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });

    firstRender.unmount();
    sessionStorage.removeItem('ce:sessionWizardPendingSbtDrafts:v1');
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: /more options/i }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const featuredSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'default-featured-sbts',
      );
      expect(featuredSelector).toHaveAttribute('data-selected-addresses', '');
    });
  });
});
