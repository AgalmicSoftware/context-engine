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
import { clearSessionWizardPendingSbtDraftsCache } from './hooks/usePendingSbtDrafts';

describe('SessionWizard pending SBT tab-memory rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('keeps pending SBT drafts in mounted state without writing either browser storage', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    await waitFor(() => {
      const cachedRaw = sessionStorage.getItem('ce:sessionWizardDraft:v1') || '';
      expect(cachedRaw).not.toContain('claim-code-1');
      expect(cachedRaw).not.toContain('shared-secret');
      expect(JSON.parse(cachedRaw).pendingSbtDrafts).toEqual([]);
      expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
      expect(localStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
        'data-ce-sbt-address',
        mockPendingSbtAddress.toLowerCase(),
      );
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

  it('clears pending SBT drafts on simulated reload and purges a legacy sessionStorage payload', async () => {
    const firstRender = renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Privacy');

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();

    firstRender.unmount();
    clearSessionWizardPendingSbtDraftsCache();
    sessionStorage.setItem(
      'ce:sessionWizardPendingSbtDrafts:v1',
      JSON.stringify([{ predictedAddress: mockPendingSbtAddress, groupPassword: 'legacy-secret' }]),
    );
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
