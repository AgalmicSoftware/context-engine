import { encodeLinkJson } from '@ce-shared/linkPayload.mjs';
import { SESSION_TEMPLATE_FORMAT, validateSessionTemplate } from '@ce-shared/sessionTemplate.mjs';
import { encodeSessionTemplateLink } from '@ce-shared/sessionTemplateLink.mjs';
import { SESSION_SETUP_EXAMPLE } from './setup/sessionSetupKickoff';
import {
  E2E_TESTIDS,
  act,
  fireEvent,
  renderSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  waitFor,
  within,
} from './SessionWizard.workerPanel.testUtils';

const linkFor = async (fields) => {
  const { template } = validateSessionTemplate({ format: SESSION_TEMPLATE_FORMAT, ...fields });
  const encoded = await encodeSessionTemplateLink(template);
  return encoded.fragment;
};

describe('SessionWizard template links', () => {
  beforeEach(() => {
    resetSessionWizardWorkerPanelTestState();
    window.history.replaceState({}, '', '/new');
  });

  it('shows a link draft first, then applies it and offers to share it back with changes', async () => {
    const fragment = await linkFor({
      draftId: 'salon-draft',
      sessionName: 'Reverse Alignment',
      questions: [{ prompt: 'Adapting institutions deserves investment.', type: 'binary' }],
    });
    window.history.replaceState({}, '', `/new${fragment}`);
    renderSessionWizard();

    const notice = await screen.findByTestId('ce-template-link-notice', {}, { timeout: 8000 });
    expect(notice).toHaveTextContent('This draft came from a link');
    expect(within(notice).getByTestId('ce-template-changes')).toHaveTextContent(
      'sessionName: (empty) → Reverse Alignment',
    );
    // Nothing is used before the person accepts it, and the address bar no longer carries it.
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('');
    expect(window.location.hash).toBe('');

    await act(async () => {
      fireEvent.click(within(notice).getByTestId('ce-template-link-accept'));
    });
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('Reverse Alignment');
    expect(screen.queryByTestId('ce-template-link-notice')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId('ce-template-share')).toHaveTextContent('Copy link with my changes');
    expect(screen.getByTestId('ce-setup-summary-questions')).toHaveTextContent('1 question');

    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: 'Reverse Alignment II' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-template-share'));
    });
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const shared = String(writeText.mock.calls[0][0]);
    expect(shared).toContain('/new#template=');
    expect(shared).not.toMatch(/cf-|sk-/);
  });

  it('shows a link pasted into the open setup tab, where only the hash changes', async () => {
    renderSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME, {}, { timeout: 8000 });
    expect(screen.queryByTestId('ce-template-link-notice')).not.toBeInTheDocument();
    const fragment = await linkFor({ sessionName: 'Pasted in' });
    await act(async () => {
      window.history.replaceState({}, '', `/new${fragment}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const notice = await screen.findByTestId('ce-template-link-notice', {}, { timeout: 8000 });
    expect(within(notice).getByTestId('ce-template-changes')).toHaveTextContent('sessionName: (empty) → Pasted in');
  });

  it('lists every difference even when the open draft fails the template checks', async () => {
    renderSessionWizard();
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME, {}, { timeout: 8000 }), {
      target: { value: 'Mine' },
    });
    // A blank link row is enough to fail them.
    fireEvent.click(screen.getByTestId('ce-setup-more-context'));
    fireEvent.click(screen.getByTestId('ce-setup-context-add-link'));
    const fragment = await linkFor({ sessionName: 'Theirs' });
    await act(async () => {
      window.history.replaceState({}, '', `/new${fragment}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    const notice = await screen.findByTestId('ce-template-link-notice', {}, { timeout: 8000 });
    const changes = within(notice).getByTestId('ce-template-changes');
    expect(changes).toHaveTextContent('sessionName: Mine → Theirs');
    expect(changes).toHaveTextContent('sessionContext.links: 1 item → 0 items');
  });

  it('opens the link an AI writes (#setup=) for review, then creates nothing until Create', async () => {
    window.history.replaceState({}, '', `/new#setup=${encodeLinkJson(SESSION_SETUP_EXAMPLE)}`);
    renderSessionWizard();
    expect(screen.getByTestId('ce-setup-with-ai')).toHaveTextContent('Set up with your AI');
    const notice = await screen.findByTestId('ce-template-link-notice', {}, { timeout: 8000 });
    expect(window.location.hash).toBe('');
    expect(within(notice).getByTestId('ce-template-changes')).toHaveTextContent('sessionName: (empty) → Library hours');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('');
    await act(async () => {
      fireEvent.click(within(notice).getByTestId('ce-template-link-accept'));
    });
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('Library hours');
    expect(screen.getByTestId('ce-setup-summary-questions')).toHaveTextContent('2 questions');
    // Creating still waits for Create and the passkey.
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toHaveTextContent('Create session');
    expect(screen.queryByTestId(E2E_TESTIDS.SETUP_CREATE_STAGE)).not.toBeInTheDocument();
  });

  it('says when an AI link was cut off, and offers the paste instead', async () => {
    const link = `#setup=${encodeLinkJson(SESSION_SETUP_EXAMPLE)}`;
    window.history.replaceState({}, '', `/new${link.slice(0, -30)}`);
    renderSessionWizard();
    const notice = await screen.findByTestId('ce-template-link-notice', {}, { timeout: 8000 });
    expect(within(notice).getByTestId('ce-template-errors')).toHaveTextContent('cut off');
    expect(notice).toHaveTextContent('paste it under Import');
    expect(within(notice).queryByTestId('ce-template-link-accept')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('keeps the local draft when the link is dismissed', async () => {
    const fragment = await linkFor({ sessionName: 'Someone else' });
    window.history.replaceState({}, '', `/new${fragment}`);
    renderSessionWizard();
    fireEvent.click(await screen.findByTestId('ce-template-link-dismiss', {}, { timeout: 8000 }));
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('');
    expect(window.location.hash).toBe('');
  });
});
