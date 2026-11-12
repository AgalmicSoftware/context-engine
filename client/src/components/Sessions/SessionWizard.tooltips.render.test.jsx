import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  enableAdvancedMode,
  fireEvent,
  renderSessionWizardWithTooltipStore,
  resetSessionWizardWorkerPanelTestState,
  screen,
} from './SessionWizard.workerPanel.testUtils';

// Read-only fields show a value rather than offer a choice.
const CONTROLS = 'input:not([type="hidden"]):not([readonly]), select, textarea:not([readonly])';
const HELP = '[role="button"][aria-label^="About "], [role="button"][aria-label$=" info"]';

// A radio or checkbox group shares one "?", so it counts as one option.
const optionOf = (control) => control.closest('[role="radiogroup"], [role="group"]') || control;

const nameOf = (option) =>
  option.labels?.[0]?.textContent.trim() ||
  option.getAttribute('aria-label') ||
  (option.getAttribute('aria-labelledby') || '')
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent.trim())
    .join(' ') ||
  option.getAttribute('data-testid') ||
  option.outerHTML.slice(0, 80);

// Each option needs a "?" in a container that holds no other option, so the
// help can't belong to a neighbour.
const optionsWithoutHelp = () => {
  const options = [
    ...new Set([...document.querySelectorAll(CONTROLS)].filter((el) => !el.closest('[hidden]')).map(optionOf)),
  ];
  return options
    .filter((option) => {
      let node = option;
      while (node && !node.querySelector(HELP)) node = node.parentElement;
      if (!node) return true;
      const sharing = new Set([...node.querySelectorAll(CONTROLS)].map(optionOf));
      return sharing.size > 1;
    })
    .map(nameOf);
};

const renderNewSession = async () => {
  resetSessionWizardWorkerPanelTestState();
  window.history.replaceState({}, '', '/new');
  renderSessionWizardWithTooltipStore({
    props: { account: TEST_ADMIN_ADDRESS, loginComplete: true, toggleLoginModal: jest.fn() },
  });
  await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
  enableAdvancedMode();
};

describe('every option on /new has its own "?"', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('on a Centralized session, with the options that appear once others are set', async () => {
    await renderNewSession();
    fireEvent.click(screen.getByTestId('ce-setup-context-add-paragraph'));
    fireEvent.click(screen.getByTestId('ce-setup-context-add-link'));
    fireEvent.click(screen.getByTestId('ce-setup-appearance-toggle'));
    fireEvent.click(screen.getByLabelText('Hide small groups in summaries'));
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.SETUP_ENCRYPTION), { target: { value: 'worker_envelope' } });
    fireEvent.click(screen.getByLabelText('Default access rules'));
    fireEvent.click(screen.getByRole('button', { name: 'Add SBT holders' }));
    fireEvent.change(screen.getByLabelText('Generation mode'), { target: { value: 'automatic' } });
    fireEvent.change(screen.getByLabelText('Opening question'), { target: { value: 'owner' } });
    fireEvent.click(screen.getByLabelText('Check for new session questions during interviews'));
    fireEvent.click(screen.getByLabelText('Suggest groups to join'));
    fireEvent.click(screen.getByLabelText('Show “How well AIs predicted people” in Results'));
    for (const label of ['Owner opening question', 'Question growth threshold (%)', 'Distinct participant threshold']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('SBT contract address')).toBeInTheDocument();
    expect(optionsWithoutHelp()).toEqual([]);
  }, 30000);

  it('on a Decentralized session', async () => {
    await renderNewSession();
    fireEvent.click(screen.getByRole('radio', { name: 'Decentralized' }));
    enableAdvancedMode();
    expect(optionsWithoutHelp()).toEqual([]);
  }, 30000);
});
