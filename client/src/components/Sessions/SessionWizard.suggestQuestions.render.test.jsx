import {
  E2E_TESTIDS,
  TEST_ADMIN_ADDRESS,
  fireEvent,
  openSetupSection,
  renderSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

const OPENAI_RESPONSES = 'https://api.openai.com/v1/responses';
const drafts = [
  { prompt: 'Branches should share one catalogue.', questionType: 'binary', options: [], voiceCredits: null, tags: [] },
  {
    prompt: 'Which should come first?',
    questionType: 'multichoice',
    options: ['Longer hours', 'More books'],
    voiceCredits: null,
    tags: [],
  },
];

describe('SessionWizard Suggest questions', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    resetSessionWizardWorkerPanelTestState();
    window.history.replaceState({}, '', '/new');
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('drafts questions from the page’s context with the typed OpenAI key and adds them to the list', async () => {
    const fetchMock = jest.fn(async (url) =>
      String(url) === OPENAI_RESPONSES
        ? { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ questions: drafts }) }) }
        : { ok: true, status: 200, json: async () => ({ ok: true }) },
    );
    global.fetch = fetchMock;
    renderSessionWizard({ account: TEST_ADMIN_ADDRESS, loginComplete: true, toggleLoginModal: jest.fn() });
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Library' } });

    openSetupSection('questions');
    const suggest = screen.getByRole('button', { name: 'Suggest questions' });
    expect(suggest).toBeDisabled();
    expect(screen.getByTestId('ce-setup-suggest-status')).toHaveTextContent(
      'Add an OpenAI key under AI to get suggestions.',
    );
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), { target: { value: 'sk-suggest' } });
    expect(screen.getByTestId('ce-setup-suggest-status')).toHaveTextContent('Add some context first');

    openSetupSection('context');
    fireEvent.click(screen.getByTestId('ce-setup-context-add-paragraph'));
    fireEvent.change(screen.getByLabelText('Paragraph 1'), { target: { value: 'Members want longer hours.' } });
    fireEvent.change(screen.getByTestId('ce-setup-question-prompt'), { target: { value: 'Open on Sundays.' } });
    fireEvent.click(screen.getByTestId('ce-setup-question-add'));
    expect(suggest).toBeEnabled();

    fireEvent.click(suggest);
    await waitFor(() => expect(screen.getAllByTestId('ce-setup-question')).toHaveLength(3));
    expect(screen.getByLabelText('Question 1')).toHaveValue('Open on Sundays.');
    expect(screen.getByLabelText('Question 2')).toHaveValue('Branches should share one catalogue.');
    expect(screen.getByLabelText('Question 3')).toHaveValue('Which should come first?');
    expect(screen.getByLabelText('Question 3 options, one per line')).toHaveValue('Longer hours\nMore books');
    expect(screen.getByTestId('ce-setup-suggest-status')).toHaveTextContent('Added 2 drafts.');

    const calls = fetchMock.mock.calls.filter(([url]) => String(url) === OPENAI_RESPONSES);
    expect(calls).toHaveLength(1);
    expect(calls[0][1].headers.authorization).toBe('Bearer sk-suggest');
    const prompt = JSON.parse(calls[0][1].body).input[0].content.at(-1).text;
    expect(prompt).toContain('Members want longer hours.');
    expect(prompt).toContain('- Open on Sundays.');
  }, 20000);
});
