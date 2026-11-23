import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginAgentHandoffPanel from './LoginAgentHandoffPanel';
import { AgentDelegateKeyError, buildAgentKeyHandover } from '../../utilities/session/agentHandoff';
import { getInterviewCatalogTicket } from '../SurveyTool/interviewCatalogTicket';
import { QUIET_RETRY_DELAYS_MS } from '../../utilities/session/useAgentKey';

jest.mock('../SurveyTool/interviewCatalogTicket', () => ({
  ...jest.requireActual<object>('../SurveyTool/interviewCatalogTicket'),
  getInterviewCatalogTicket: jest.fn(),
}));

const ticketMock = jest.mocked(getInterviewCatalogTicket);
const workerUrl = 'https://ce-salon.example.workers.dev';
const sessionUrl = `https://site.example/session/salon?worker=${encodeURIComponent(workerUrl)}`;
const key = {
  token: 'ceagt_secret',
  // Still good whenever the tests run.
  expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  sessionSlug: 'salon',
  workerUrl,
  submitAnswers: true,
};
const catalog = () =>
  new Response(
    JSON.stringify({
      type: 'context-engine.interview-question-catalog',
      version: 1,
      sessionSlug: 'salon',
      prefillPromptVersion: 'ce-interview-brief-v6',
    }),
  );

// The prefill check remembers whom it asked for as long as the page is open, so each test signs in anew.
let people = 0;
let writeText: jest.Mock;
const spyOnFetch = () => jest.spyOn(globalThis, 'fetch').mockImplementation(async () => catalog());
let fetchMock: ReturnType<typeof spyOnFetch>;
// A quiet try for the key that fails is not tried again here, except where a test sets the waits.
const RETRY_DELAYS = [...QUIET_RETRY_DELAYS_MS];
afterAll(() => void QUIET_RETRY_DELAYS_MS.splice(0, QUIET_RETRY_DELAYS_MS.length, ...RETRY_DELAYS));
beforeEach(() => {
  QUIET_RETRY_DELAYS_MS.length = 0;
  people += 1;
  ticketMock.mockReset();
  ticketMock.mockRejectedValue(new Error('Declined'));
  writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  fetchMock = spyOnFetch();
});
afterEach(() => fetchMock.mockRestore());

const renderClosedPanel = (props: Partial<React.ComponentProps<typeof LoginAgentHandoffPanel>> = {}) =>
  render(
    <LoginAgentHandoffPanel
      agentHttpEnabled
      sessionUrl={sessionUrl}
      sessionName="Salon"
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      context={{ account: `0x${String(people).padStart(40, '0')}` }}
      workerUrl={workerUrl}
      requestKey={jest.fn(async () => key)}
      {...props}
    />,
  );

const renderPanel = (props: Partial<React.ComponentProps<typeof LoginAgentHandoffPanel>> = {}) => {
  const view = renderClosedPanel(props);
  fireEvent.click(screen.getByRole('button', { name: 'Your AI agent' }));
  return view;
};

const copyPrompt = async () => {
  // Looked up afresh each time: the row puts a new button in place when its prompt becomes the short one.
  await waitFor(() => expect(screen.getByTestId('ce-agent-handoff-copy')).toHaveAttribute('aria-disabled', 'false'));
  await act(async () => fireEvent.click(screen.getByTestId('ce-agent-handoff-copy')));
  return String(writeText.mock.calls.at(-1)?.[0] || '');
};
const KEY_LINE = `The key is ${key.token};`;
// A quiet try that would need a fresh sign-in; a try the person asked for gets the key.
const needsSignIn = () =>
  jest.fn(async ({ prompt }: { prompt: boolean }) => {
    if (!prompt) throw new Error('sign in to this session first');
    return key;
  });

it('starts closed, with its explanation still at hand, and opens as a disclosure', () => {
  const requestKey = jest.fn(async () => key);
  renderClosedPanel({ requestKey });
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveAttribute('aria-controls', 'ce-agent-handoff-body');
  expect(document.getElementById('ce-agent-handoff-body')).not.toBeVisible();
  expect(screen.getByRole('region', { name: 'Your AI agent' })).toContainElement(toggle);
  // Nothing reads the session, and no key is made, until the box is opened.
  expect(fetchMock).not.toHaveBeenCalled();
  expect(requestKey).not.toHaveBeenCalled();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('ce-agent-handoff-body')).toBeVisible();
});

it('signed in, gives one prompt to copy with the AI key already in it, and one line saying so', async () => {
  const requestKey = jest.fn(async (_options: { prompt: boolean }) => key);
  renderPanel({ requestKey });
  // Nothing about the key shows until the prompt holding it has been copied.
  await waitFor(() => expect(screen.getByTestId('ce-agent-handoff-copy')).toHaveAttribute('aria-disabled', 'false'));
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  const prompt = await copyPrompt();
  // Made without asking the person anything, once.
  expect(requestKey).toHaveBeenCalledTimes(1);
  expect(requestKey).toHaveBeenCalledWith({ prompt: false });
  expect(screen.getByTestId('ce-agent-handoff-copy')).toHaveTextContent('Copied');
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(
    /^Whoever gets this prompt can answer as you here until /,
  );
  // No setting to choose: the AI asks whether to draft or submit, and shows its answers before it submits.
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.getAllByTestId('ce-agent-handoff-copy')).toHaveLength(1);
  expect(prompt).toContain(KEY_LINE);
  expect(prompt).toContain('I have an account in this session: make no other. This prompt holds my AI key');
  expect(prompt).toContain('submit them as me only after I say yes here');
  expect(prompt).toContain('Shall I submit your answers for you, or shall we go through them together first?');
  // The same prompt says how to draft, for an AI that can't use the key.
  expect(prompt).toContain('It is only for the session "Salon" at https://site.example/session/salon');
  expect(prompt).toContain(`${workerUrl}/agent/interview-catalog?slug=salon`);
  expect(prompt).not.toMatch(/no MCP|This task does not need it|without asking me again/);
  // Drafts come back to the session's page, not to wherever the dialog was opened.
  expect(prompt).toContain(`sessionUrl=${encodeURIComponent(sessionUrl)}`);
});

it('hides the key on screen until Show key, and the ticket always', async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  // A private session lists its questions only with a ticket.
  fetchMock.mockImplementation(async (input) =>
    new URL(String(input)).searchParams.get('ticket')
      ? catalog()
      : new Response(JSON.stringify({ reason: 'private_session_invite_required' }), { status: 403 }),
  );
  renderPanel();
  const prompt = await copyPrompt();
  expect(prompt).toContain('&ticket=ic1.mine');
  expect(prompt).toContain('The link is private to me');
  const expand = screen.getByTestId('ce-agent-handoff-prompt-expand');
  expect(expand).toHaveAccessibleName('Show prompt: Your AI agent');
  expect(expand).toHaveAttribute('aria-controls', 'ce-agent-handoff-prompt-text');
  fireEvent.click(expand);
  const shown = screen.getByTestId('ce-agent-handoff-prompt');
  expect(shown).toHaveTextContent('The key is ceagt_••••••••;');
  expect(shown).not.toHaveTextContent('ceagt_secret');
  expect(shown).toHaveTextContent('&ticket=••••••••');
  expect(shown).not.toHaveTextContent('ic1.mine');
  const show = screen.getByRole('button', { name: 'Show the key' });
  expect(show).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(show);
  expect(screen.getByTestId('ce-agent-handoff-prompt')).toHaveTextContent(KEY_LINE);
  expect(screen.getByTestId('ce-agent-handoff-prompt')).not.toHaveTextContent('ic1.mine');
});

it("leaves the ticket out of a signed-in person's prompt on a public session", async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  renderPanel();
  const prompt = await copyPrompt();
  expect(prompt).not.toContain('ticket=');
  expect(prompt).not.toContain('The link is private to me');
  expect(ticketMock).not.toHaveBeenCalled();
});

it('says so when the session has no Worker to read its questions from', async () => {
  renderPanel({ workerUrl: '', sessionConfig: null });
  expect(await screen.findByTestId('ce-agent-handoff-off')).toHaveTextContent('Not available in Salon');
  expect(screen.queryByTestId('ce-agent-handoff-copy')).not.toBeInTheDocument();
});

it("keeps the key out of the prompt where the session doesn't let an AI submit", async () => {
  renderPanel({ requestKey: jest.fn(async () => ({ ...key, submitAnswers: false })) });
  const prompt = await copyPrompt();
  expect(prompt).not.toContain('ceagt_');
  expect(prompt).toContain('This prompt holds no AI key, so draft.');
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('asks for no key while the session has Agent HTTP off, or while signed out', async () => {
  const requestKey = jest.fn(async () => key);
  const view = renderPanel({ agentHttpEnabled: false, requestKey });
  const off = await copyPrompt();
  expect(off).toContain('I have an account in this session: make no other. This prompt holds no AI key, so draft.');
  expect(off).not.toContain('If I want you to submit as me');
  view.unmount();
  renderPanel({ context: {}, requestKey });
  const signedOut = await copyPrompt();
  expect(signedOut).toContain('\nThis prompt holds no AI key.\n');
  expect(requestKey).not.toHaveBeenCalled();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('copies the prompt without a key where the key needs a fresh sign-in or has already ended, with nothing to tick', async () => {
  const requestKey = needsSignIn();
  const view = renderPanel({ requestKey });
  const without = await copyPrompt();
  expect(without).not.toContain('ceagt_');
  expect(without).toContain('If I want you to submit as me, I can copy the prompt again in the session with my AI key');
  expect(requestKey).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  view.unmount();
  const ended = jest.fn(async () => ({ ...key, expiresAt: new Date(Date.now() - 1000).toISOString() }));
  renderPanel({ requestKey: ended, context: { account: `0x${'6'.repeat(40)}` } });
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(ended).toHaveBeenCalledTimes(1);
});

it('holds the copy while the key is made, so the prompt copied is the one with it', async () => {
  let resolve: (value: typeof key) => void = () => {};
  renderPanel({ requestKey: jest.fn(() => new Promise<typeof key>((done) => (resolve = done))) });
  expect(await screen.findByText('Adding your AI key…')).toBeInTheDocument();
  const copy = await screen.findByTestId('ce-agent-handoff-copy');
  expect(copy).toHaveAttribute('aria-disabled', 'true');
  await act(async () => fireEvent.click(copy));
  expect(writeText).not.toHaveBeenCalled();
  await act(async () => resolve(key));
  expect(await copyPrompt()).toContain(KEY_LINE);
});

it('copies from one split Copy prompt button, whose caret opens the whole prompt to read', async () => {
  renderPanel();
  const copy = await screen.findByTestId('ce-agent-handoff-copy');
  expect(copy).toHaveAccessibleName('Copy AI prompt');
  // The caret waits for the checked prompt, as Copy prompt does.
  expect(screen.queryByRole('button', { name: 'Show prompt: Your AI agent' })).not.toBeInTheDocument();
  await waitFor(() => expect(copy).toHaveAttribute('aria-disabled', 'false'));
  const show = screen.getByRole('button', { name: 'Show prompt: Your AI agent' });
  expect(screen.getByTestId('ce-agent-handoff-prompt')).not.toBeVisible();
  expect(show.querySelector('[data-icon="caret-right"]')).not.toBeNull();
  fireEvent.click(show);
  expect(show.querySelector('[data-icon="caret-down"]')).not.toBeNull();
  expect(screen.getByTestId('ce-agent-handoff-prompt')).toBeVisible();
});

it('gives a refused copy its own field with the whole prompt, key included, not the prompt twice', async () => {
  writeText.mockImplementation(async () => {
    throw new Error('denied');
  });
  renderPanel();
  const button = await screen.findByTestId('ce-agent-handoff-copy');
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(screen.getByRole('button', { name: 'Show prompt: Your AI agent' }));
  expect(screen.getByTestId('ce-agent-handoff-prompt')).toBeVisible();
  await act(async () => fireEvent.click(button));
  const field = await screen.findByRole('textbox', { name: 'Memory augmentation prompt to copy' });
  expect(field).toHaveValue(String(writeText.mock.calls.at(-1)?.[0]));
  expect((field as HTMLTextAreaElement).value).toContain(KEY_LINE);
  expect(screen.queryByTestId('ce-agent-handoff-prompt')).not.toBeInTheDocument();
});

it('copies with the older copy command where the clipboard is missing', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  const copied: string[] = [];
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => copied.push((document.activeElement as HTMLTextAreaElement).value) > 0,
  });
  try {
    renderPanel();
    const button = await screen.findByTestId('ce-agent-handoff-copy');
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
    await act(async () => fireEvent.click(button));
    expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain(KEY_LINE);
  } finally {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

it("on the session's own page, sends drafts back to that page with its join link, whatever the slug's case", async () => {
  window.history.pushState({}, '', '/session/Salon?joinGroup=g1');
  try {
    renderPanel();
    const prompt = await copyPrompt();
    expect(prompt).toContain(
      `sessionUrl=${encodeURIComponent(`${window.location.origin}/session/Salon?joinGroup=g1`)}`,
    );
  } finally {
    window.history.pushState({}, '', '/');
  }
});

it('treats a malformed page path as off the session page, without failing', async () => {
  window.history.pushState({}, '', '/session/%E0');
  try {
    renderPanel();
    const prompt = await copyPrompt();
    expect(prompt).toContain(`sessionUrl=${encodeURIComponent(sessionUrl)}`);
  } finally {
    window.history.pushState({}, '', '/');
  }
});

it('enlarges an open prompt to read, and Minimize or Escape makes it small before the dialog closes', async () => {
  // Stands in for the dialog, which closes on Escape.
  const closeDialog = jest.fn();
  render(
    <div onKeyUp={(event) => event.key === 'Escape' && closeDialog()}>
      <LoginAgentHandoffPanel
        agentHttpEnabled
        sessionUrl={sessionUrl}
        sessionName="Salon"
        sessionSlug="salon"
        workerUrl={workerUrl}
        requestKey={jest.fn(async () => key)}
      />
    </div>,
  );
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  fireEvent.click(toggle);
  fireEvent.click(await screen.findByRole('button', { name: 'Show prompt: Your AI agent' }));
  const box = screen.getByTestId('ce-agent-handoff-prompt-box');
  expect(box).not.toHaveClass('agentHandoffPromptLarge');

  fireEvent.click(screen.getByRole('button', { name: 'Expand prompt: Your AI agent' }));
  expect(box).toHaveClass('agentHandoffPromptLarge');
  const minimize = screen.getByRole('button', { name: 'Minimize prompt: Your AI agent' });
  expect(minimize).toHaveTextContent('Minimize');
  // Still the text to read and select, whole.
  expect(screen.getByTestId('ce-agent-handoff-prompt')).toHaveTextContent('Help me take part in a Context Engine');

  fireEvent.click(minimize);
  expect(box).not.toHaveClass('agentHandoffPromptLarge');

  fireEvent.click(screen.getByRole('button', { name: 'Expand prompt: Your AI agent' }));
  fireEvent.keyUp(minimize, { key: 'Escape' });
  expect(box).not.toHaveClass('agentHandoffPromptLarge');
  expect(closeDialog).not.toHaveBeenCalled();
  // Small again, the next Escape is the dialog's.
  fireEvent.keyUp(minimize, { key: 'Escape' });
  expect(closeDialog).toHaveBeenCalledTimes(1);

  // Focus moving out of it, as by Tab to the rows it covers, makes it small.
  fireEvent.click(screen.getByRole('button', { name: 'Expand prompt: Your AI agent' }));
  expect(box).toHaveClass('agentHandoffPromptLarge');
  act(() => screen.getByRole('button', { name: 'Minimize prompt: Your AI agent' }).focus());
  expect(box).toHaveClass('agentHandoffPromptLarge');
  act(() => toggle.focus());
  expect(box).not.toHaveClass('agentHandoffPromptLarge');
});

it('holds Sign Agents Out under the prompt; after it, drops the dead key and closes, keeping its message', async () => {
  const props = {
    agentHttpEnabled: true,
    sessionUrl,
    sessionName: 'Salon',
    sessionSlug: 'salon',
    workerUrl,
    context: { account: `0x${'7'.repeat(40)}` },
    requestKey: jest.fn(async () => key),
    signAgentsOut: <span role="status">Agents signed out.</span>,
  };
  const { rerender } = render(<LoginAgentHandoffPanel {...props} agentsSignedOut={0} />);
  const signOut = screen.getByText('Agents signed out.');
  expect(signOut).not.toBeVisible();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  fireEvent.click(toggle);
  expect(signOut).toBeVisible();
  expect(await copyPrompt()).toContain(KEY_LINE);
  const expiry = screen.getByTestId('ce-agent-handoff-expiry');
  expect(expiry.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  rerender(<LoginAgentHandoffPanel {...props} agentsSignedOut={1} />);
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  // Closed, so the session is checked again only when it is reopened; the same message stays in view.
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('ce-agent-handoff-copy')).not.toBeInTheDocument();
  expect(screen.getByText('Agents signed out.')).toBe(signOut);
  expect(signOut).toBeVisible();
  expect(props.requestKey).toHaveBeenCalledTimes(1);

  // Reopened, the prompt gets a new key.
  fireEvent.click(toggle);
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(props.requestKey).toHaveBeenCalledTimes(2);
  fireEvent.click(toggle);
  expect(signOut).not.toBeVisible();
});

it('shows no key asked for before Sign Agents Out', async () => {
  let resolve: (value: typeof key) => void = () => {};
  const props = {
    agentHttpEnabled: true,
    sessionUrl,
    sessionName: 'Salon',
    sessionSlug: 'salon',
    workerUrl,
    context: { account: `0x${'8'.repeat(40)}` },
    requestKey: jest.fn(() => new Promise<typeof key>((done) => (resolve = done))),
    signAgentsOut: <span>Sign Agents Out</span>,
  };
  const { rerender } = render(<LoginAgentHandoffPanel {...props} agentsSignedOut={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Your AI agent' }));
  await waitFor(() => expect(props.requestKey).toHaveBeenCalledTimes(1));
  rerender(<LoginAgentHandoffPanel {...props} agentsSignedOut={1} />);
  await act(async () => resolve(key));
  // Closed, with the earlier request's key dropped.
  expect(screen.getByRole('button', { name: 'Your AI agent' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
});

describe('opened by a link for the AI prompt', () => {
  it('opens at once; signed out, it asks for no key', async () => {
    const requestKey = jest.fn(async () => key);
    renderClosedPanel({ promptRequested: true, context: {}, requestKey });
    expect(screen.getByRole('button', { name: 'Your AI agent' })).toHaveAttribute('aria-expanded', 'true');
    expect(await copyPrompt()).not.toContain('ceagt_');
    expect(requestKey).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-agent-handoff-panel')).not.toHaveClass('agentHandoffArrived');
  });

  it('signed in, copies a short prompt that hands over the key, with the button in the middle', async () => {
    const requestKey = jest.fn(async () => key);
    renderClosedPanel({ promptRequested: true, requestKey });
    const prompt = await copyPrompt();
    expect(requestKey).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ce-agent-handoff-panel')).toHaveClass('agentHandoffArrived');
    // The AI that sent the person here has the steps and the questions already: this is the key and its rules.
    expect(prompt).toBe(buildAgentKeyHandover({ key, sessionName: 'Salon', sessionUrl }));
    expect(prompt).toContain(`Here is my AI key for the Context Engine session "Salon" (${sessionUrl}).`);
    expect(prompt).toContain(KEY_LINE);
    expect(prompt).toContain('submit them as me only after I say yes here');
    expect(prompt).not.toContain('interview-catalog');
    expect(prompt.length).toBeLessThan(1400);
    // On screen the key is hidden, as in the long prompt.
    fireEvent.click(screen.getByRole('button', { name: 'Show prompt: Your AI agent' }));
    expect(screen.getByTestId('ce-agent-handoff-prompt')).toHaveTextContent('The key is ceagt_••••••••;');
  });

  it('raises no signing prompt by itself where the key needs a fresh sign-in: the person adds the key', async () => {
    const requestKey = needsSignIn();
    renderClosedPanel({ promptRequested: true, requestKey });
    const add = await screen.findByRole('button', { name: 'Add my AI key' });
    // A link alone asks the session for nothing that would prompt the person.
    expect(requestKey).toHaveBeenCalledTimes(1);
    expect(requestKey).toHaveBeenCalledWith({ prompt: false });
    await act(async () => fireEvent.click(add));
    expect(requestKey).toHaveBeenLastCalledWith({ prompt: true });
    const prompt = await copyPrompt();
    expect(prompt).toBe(buildAgentKeyHandover({ key, sessionName: 'Salon', sessionUrl }));
    expect(screen.queryByRole('button', { name: 'Add my AI key' })).not.toBeInTheDocument();
  });

  it('says why when that key cannot be made, and gives the full prompt without one', async () => {
    const requestKey = jest.fn(async ({ prompt }: { prompt: boolean }) => {
      throw prompt ? new AgentDelegateKeyError('', 401) : new Error('sign in to this session first');
    });
    renderClosedPanel({ promptRequested: true, requestKey });
    const add = await screen.findByRole('button', { name: 'Add my AI key' });
    await act(async () => fireEvent.click(add));
    expect(await screen.findByTestId('ce-agent-handoff-error')).toHaveTextContent(
      'Sign in again to let your AI submit.',
    );
    // It stops there: no key is asked for again unasked.
    expect(requestKey).toHaveBeenCalledTimes(2);
    const prompt = await copyPrompt();
    expect(prompt).not.toContain('ceagt_');
    expect(prompt).toContain('interview-catalog');
  });

  it('offers no such button outside the link: there the prompt simply goes without a key', async () => {
    renderPanel({ requestKey: needsSignIn() });
    expect(await copyPrompt()).not.toContain('ceagt_');
    expect(screen.queryByRole('button', { name: 'Add my AI key' })).not.toBeInTheDocument();
  });
});

it('makes no new key straight after Sign Agents Out; opening the row again does', async () => {
  const requestKey = jest.fn(async () => key);
  renderPanel({ requestKey });
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(requestKey).toHaveBeenCalledTimes(1);
  act(() => void window.dispatchEvent(new Event('ce-agents-signed-out')));
  // The dead key is gone from the prompt, and nothing asks for another.
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(requestKey).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(requestKey).toHaveBeenCalledTimes(2);
});
