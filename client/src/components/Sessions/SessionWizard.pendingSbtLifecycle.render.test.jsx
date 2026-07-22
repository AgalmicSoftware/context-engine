import {
  E2E_TESTIDS,
  enableAdvancedMode,
  fireEvent,
  mockPendingSbtAddress,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  selectNormalModeCard,
  waitFor,
  within,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard pending SBT lifecycle rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('opens the inline create-SBT modal and records a pending draft', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    expect(await screen.findByText('Add Group to Session')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase(),
    );
    await waitFor(() => {
      expect(screen.queryByTestId('mock-create-sbt-group')).not.toBeInTheDocument();
    });
  });

  it('clears pending SBT drafts when the deploy network changes', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const gateOneSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-1',
      );
      expect(gateOneSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });

    enableAdvancedMode();

    const chainSelectorWrap = screen.getByText('Network:').parentElement;
    expect(chainSelectorWrap).toBeTruthy();
    const chainSelect = within(chainSelectorWrap).getByRole('combobox');
    const alternateOption = Array.from(chainSelect.querySelectorAll('option')).find(
      (option) => option.value && option.value !== chainSelect.value,
    );
    expect(alternateOption).toBeTruthy();

    fireEvent.change(chainSelect, { target: { value: alternateOption.value } });

    await waitFor(() => {
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
    });
  });

  it('keeps pending privacy-gate SBT drafts selected when session scope is list mode', async () => {
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['general', 'edge']));

    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const selectors = screen.getAllByTestId('mock-wizard-sbt-selector');
      const gateOneSelector = selectors.find(
        (node) => node.getAttribute('data-selector-id') === 'encryption-gate-gate-1',
      );
      expect(gateOneSelector).toHaveAttribute('data-selected-addresses', mockPendingSbtAddress);
    });
  });
});
