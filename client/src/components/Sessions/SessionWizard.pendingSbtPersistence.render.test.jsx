import {
  E2E_TESTIDS,
  fireEvent,
  mockPendingSbtAddress,
  renderLoggedInSessionWizard,
  renderSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  selectNormalModeCard,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard pending SBT persistence rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps pending SBT drafts out of localStorage while persisting them in sessionStorage for refresh recovery', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const cachedRaw = localStorage.getItem('ce:sessionWizardDraft:v1') || '';
      expect(cachedRaw).not.toContain('claim-code-1');
      expect(cachedRaw).not.toContain('shared-secret');
      expect(JSON.parse(cachedRaw).pendingSbtDrafts).toEqual([]);
      const sessionRaw = sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1') || '';
      expect(sessionRaw).toContain('claim-code-1');
      expect(sessionRaw).toContain('shared-secret');
      expect(JSON.parse(sessionRaw)).toEqual([
        expect.objectContaining({
          predictedAddress: mockPendingSbtAddress,
          displayName: 'Pending SBT',
        }),
      ]);
    });
  });

  it('does not restore cached pending SBT drafts from localStorage', async () => {
    localStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        pendingSbtDrafts: [
          {
            predictedAddress: mockPendingSbtAddress,
            displayName: 'Cached Pending SBT',
            passwordList: ['claim-code-1'],
            groupPassword: 'shared-secret',
          },
        ],
      }),
    );

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    expect(screen.queryByText('Cached Pending SBT')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).not.toBeInTheDocument();
  });

  it('restores pending SBT drafts from sessionStorage after a refresh', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toContain(mockPendingSbtAddress);
    });

    firstRender.unmount();
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase(),
    );
    expect(screen.getByText(mockPendingSbtAddress)).toBeInTheDocument();
  });
});
