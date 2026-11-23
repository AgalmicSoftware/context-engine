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
const canSubmit = () => screen.getByRole('checkbox', { name: 'AI can submit for me' });
// Opens the row and ticks "AI can submit for me", which is what puts a key in the prompt.
const renderKeyPanel = (props: Partial<React.ComponentProps<typeof LoginAgentHandoffPanel>> = {}) => {
  const view = renderPanel(props);
  fireEvent.click(canSubmit());
  return view;
};
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

it('starts with "AI can submit for me" unticked: no key is made or copied until the person ticks it', async () => {
  const requestKey = jest.fn(async (_options: { prompt: boolean }) => key);
  renderPanel({ requestKey });
  expect(canSubmit()).not.toBeChecked();
  const draft = await copyPrompt();
  expect(draft).not.toContain('ceagt_');
  expect(draft).toContain('I have an account in this session: make no other. This prompt holds no AI key, so draft.');
  expect(requestKey).not.toHaveBeenCalled();
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  expect(screen.getAllByTestId('ce-agent-handoff-copy')).toHaveLength(1);

  // Ticked, the key is made without asking the person anything more, once, and goes into the prompt.
  fireEvent.click(canSubmit());
  expect(canSubmit()).toBeChecked();
  const prompt = await copyPrompt();
  expect(requestKey).toHaveBeenCalledTimes(1);
  expect(requestKey).toHaveBeenCalledWith({ prompt: false });
  expect(screen.getByTestId('ce-agent-handoff-copy')).toHaveTextContent('Copied');
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(/^Key can answer as you until /);
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

  // Unticked again, the key leaves the prompt. The line stays, since the key that was copied still works.
  fireEvent.click(canSubmit());
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(/^Key can answer as you until /);
  expect(requestKey).toHaveBeenCalledTimes(1);
  // The page kept no key: ticked again, it asks for a new one.
  fireEvent.click(canSubmit());
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(requestKey).toHaveBeenCalledTimes(2);
  expect(canSubmit()).toHaveAccessibleDescription(
    'If checked, the prompt can hold a key and the AI can act on your behalf.',
  );
});

it('takes no key that arrives after the box is unticked again', async () => {
  let resolve: (value: typeof key) => void = () => {};
  const requestKey = jest.fn(() => new Promise<typeof key>((done) => (resolve = done)));
  renderKeyPanel({ requestKey });
  await waitFor(() => expect(requestKey).toHaveBeenCalledTimes(1));
  fireEvent.click(canSubmit());
  await act(async () => resolve(key));
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
});

it('tries quietly again shortly, as right after a sign-in, before giving up on the key', async () => {
  QUIET_RETRY_DELAYS_MS.push(20, 20);
  const requestKey = jest.fn().mockRejectedValueOnce(new Error('the page is still signing in')).mockResolvedValue(key);
  renderKeyPanel({ requestKey });
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(requestKey).toHaveBeenCalledTimes(2);
  expect(requestKey).toHaveBeenLastCalledWith({ prompt: false });
});

it('shows the prompt with stand-ins where its key and private link are, never the values', async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  // A private session lists its questions only with a ticket.
  fetchMock.mockImplementation(async (input) =>
    new URL(String(input)).searchParams.get('ticket')
      ? catalog()
      : new Response(JSON.stringify({ reason: 'private_session_invite_required' }), { status: 403 }),
  );
  renderKeyPanel();
  const prompt = await copyPrompt();
  expect(prompt).toContain('&ticket=ic1.mine');
  expect(prompt).toContain('The link is private to me');
  expect(prompt).toContain(KEY_LINE);
  const caret = screen.getByTestId('ce-agent-handoff-prompt-expand');
  expect(caret).toHaveAccessibleName('Read the AI prompt');
  fireEvent.click(caret);
  const shown = screen.getByTestId('ce-agent-handoff-prompt');
  expect(caret).toHaveAttribute('aria-controls', shown.id);
  expect(shown).toHaveTextContent('The key is <AIKey>;');
  expect(shown).toHaveTextContent('To draft, fetch this URL with a plain HTTP GET: <QuestionsAddress>');
  expect(shown).toHaveTextContent('It is only for the session <SessionName> at <SessionLink>.');
  expect(shown).not.toHaveTextContent('ceagt_secret');
  expect(shown).not.toHaveTextContent('ic1.mine');
  // Nothing on screen reveals the key: the copy is the only place it is.
  expect(screen.queryByRole('button', { name: 'Show the key' })).not.toBeInTheDocument();
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
  renderKeyPanel({ requestKey: jest.fn(async () => ({ ...key, submitAnswers: false })) });
  const prompt = await copyPrompt();
  expect(prompt).not.toContain('ceagt_');
  expect(prompt).toContain('This prompt holds no AI key, so draft.');
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
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

it('copies the prompt without a key where the key needs a fresh sign-in or has already ended, and says so', async () => {
  const requestKey = needsSignIn();
  const view = renderKeyPanel({ requestKey });
  const without = await copyPrompt();
  expect(without).not.toContain('ceagt_');
  expect(without).toContain('I can copy the prompt again in the session with "AI can submit for me" ticked');
  expect(requestKey).toHaveBeenCalledTimes(1);
  // No signing prompt was raised; the row says the prompt has no key and offers the one tap that adds it.
  expect(screen.getByTestId('ce-agent-handoff-key-missing')).toHaveTextContent('The prompt has no AI key yet.');
  expect(screen.getByRole('button', { name: 'Add my AI key' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  view.unmount();
  const ended = jest.fn(async () => ({ ...key, expiresAt: new Date(Date.now() - 1000).toISOString() }));
  renderKeyPanel({ requestKey: ended, context: { account: `0x${'6'.repeat(40)}` } });
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(ended).toHaveBeenCalledTimes(1);
});

it('holds the copy while the key is made, so the prompt copied is the one with it', async () => {
  let resolve: (value: typeof key) => void = () => {};
  renderKeyPanel({ requestKey: jest.fn(() => new Promise<typeof key>((done) => (resolve = done))) });
  expect(await screen.findByText('Adding your AI key…')).toBeInTheDocument();
  const copy = await screen.findByTestId('ce-agent-handoff-copy');
  // Unclickable, with a spinner, until the key is in the prompt.
  expect(copy).toHaveAttribute('aria-disabled', 'true');
  expect(copy.querySelector('[data-icon="spinner"]')).not.toBeNull();
  await act(async () => fireEvent.click(copy));
  expect(writeText).not.toHaveBeenCalled();
  await act(async () => resolve(key));
  expect(await copyPrompt()).toContain(KEY_LINE);
});

it('copies from one split button, whose caret points down and opens the whole prompt, then up', async () => {
  renderPanel();
  const copy = await screen.findByTestId('ce-agent-handoff-copy');
  expect(copy).toHaveAccessibleName('Copy AI prompt');
  await waitFor(() => expect(copy).toHaveAttribute('aria-disabled', 'false'));
  const caret = screen.getByRole('button', { name: 'Read the AI prompt' });
  expect(caret).toHaveAttribute('aria-expanded', 'false');
  expect(caret.querySelector('[data-icon="caret-down"]')).not.toBeNull();
  expect(screen.queryByTestId('ce-agent-handoff-prompt')).not.toBeInTheDocument();
  fireEvent.click(caret);
  expect(caret).toHaveAccessibleName('Hide the AI prompt');
  expect(caret.querySelector('[data-icon="caret-up"]')).not.toBeNull();
  expect(screen.getByTestId('ce-agent-handoff-prompt')).toHaveTextContent(/^AI Prompt/);
  // No second way in: the caret is the only control that opens the prompt.
  expect(screen.queryByRole('button', { name: /Expand|Show prompt|Read prompt/ })).not.toBeInTheDocument();
});

it('gives a refused copy its own field with the whole prompt, key included, not the prompt twice', async () => {
  writeText.mockImplementation(async () => {
    throw new Error('denied');
  });
  renderKeyPanel();
  const button = await screen.findByTestId('ce-agent-handoff-copy');
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(screen.getByRole('button', { name: 'Read the AI prompt' }));
  expect(screen.getByTestId('ce-agent-handoff-prompt')).toBeVisible();
  await act(async () => fireEvent.click(button));
  const field = await screen.findByRole('textbox', { name: 'AI prompt to copy' });
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
    renderKeyPanel();
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
  fireEvent.click(canSubmit());
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

  // Reopened, it is back on drafting only; ticked, the prompt gets a new key.
  fireEvent.click(toggle);
  expect(canSubmit()).not.toBeChecked();
  expect(await copyPrompt()).not.toContain('ceagt_');
  fireEvent.click(canSubmit());
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
  fireEvent.click(canSubmit());
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
    // Signed out there is no key to choose, so nothing to tick.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('signed in, copies a short prompt that hands over the key, with the button in the middle', async () => {
    const requestKey = jest.fn(async () => key);
    renderClosedPanel({ promptRequested: true, requestKey });
    const prompt = await copyPrompt();
    expect(requestKey).toHaveBeenCalledTimes(1);
    // The button sits in the middle of the row.
    expect(screen.getByTestId('ce-agent-handoff-copy').parentElement).toHaveClass('aiPromptCopyCentered');
    // The AI that sent the person here has the steps and the questions already: this is the key and its rules.
    expect(prompt).toBe(buildAgentKeyHandover({ key, sessionName: 'Salon', sessionUrl }));
    expect(prompt).toContain(`Here is my AI key for the Context Engine session "Salon" (${sessionUrl}).`);
    expect(prompt).toContain(KEY_LINE);
    expect(prompt).toContain('submit them as me only after I say yes here');
    expect(prompt).not.toContain('interview-catalog');
    expect(prompt.length).toBeLessThan(1400);
    // On screen the key is hidden, as in the long prompt.
    fireEvent.click(screen.getByRole('button', { name: 'Read the AI prompt' }));
    expect(screen.getByTestId('ce-agent-handoff-prompt')).toHaveTextContent('The key is <AIKey>;');
    expect(screen.getByTestId('ce-agent-handoff-prompt')).not.toHaveTextContent('ceagt_secret');
  });

  it('starts ticked for a person sent for their key; unticked, it copies the full prompt without one', async () => {
    const requestKey = jest.fn(async () => key);
    renderClosedPanel({ promptRequested: true, requestKey });
    expect(canSubmit()).toBeChecked();
    expect(await copyPrompt()).toContain(KEY_LINE);
    fireEvent.click(canSubmit());
    const draft = await copyPrompt();
    expect(draft).not.toContain('ceagt_');
    expect(draft).toContain('interview-catalog');
    expect(requestKey).toHaveBeenCalledTimes(1);
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

  it('says why when that key cannot be made, and offers nothing to copy until there is one', async () => {
    const requestKey = jest.fn(async ({ prompt }: { prompt: boolean }) => {
      throw prompt ? new AgentDelegateKeyError('', 401) : new Error('sign in to this session first');
    });
    renderClosedPanel({ promptRequested: true, requestKey });
    const add = await screen.findByRole('button', { name: 'Add my AI key' });
    // Their AI asked for the key: the long prompt without one is not offered in its place.
    expect(screen.getByTestId('ce-agent-handoff-key-missing')).toHaveTextContent('The prompt has no AI key yet.');
    expect(screen.queryByTestId('ce-agent-handoff-copy')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(add));
    expect(await screen.findByTestId('ce-agent-handoff-error')).toHaveTextContent(
      'Sign in again to let your AI submit.',
    );
    // It stops there: no key is asked for again unasked, and the button stays for another try.
    expect(requestKey).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Add my AI key' })).toBeInTheDocument();
    expect(screen.queryByTestId('ce-agent-handoff-copy')).not.toBeInTheDocument();
    // Unticked, the row is the ordinary one: the full prompt, which drafts.
    fireEvent.click(canSubmit());
    const prompt = await copyPrompt();
    expect(prompt).not.toContain('ceagt_');
    expect(prompt).toContain('interview-catalog');
    expect(screen.queryByRole('button', { name: 'Add my AI key' })).not.toBeInTheDocument();
  });
});

it('by the link, keeps the line about a copied key while it works, though nothing is offered to copy', async () => {
  let fail = false;
  const requestKey = jest.fn(async () => {
    if (fail) throw new Error('sign in to this session first');
    return key;
  });
  renderClosedPanel({ promptRequested: true, requestKey });
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(/^Key can answer as you until /);
  // Unticked and ticked again, and this time no key can be added: the copied one still works.
  fail = true;
  fireEvent.click(canSubmit());
  fireEvent.click(canSubmit());
  expect(await screen.findByRole('button', { name: 'Add my AI key' })).toBeInTheDocument();
  expect(screen.queryByTestId('ce-agent-handoff-copy')).not.toBeInTheDocument();
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(/^Key can answer as you until /);
});

it('says so when the box is ticked and no key could be added, and offers to add it', async () => {
  const requestKey = jest.fn(async ({ prompt }: { prompt: boolean }) => {
    if (!prompt) throw new Error('sign in to this session first');
    return key;
  });
  renderKeyPanel({ requestKey });
  // The prompt can still be copied, to draft with; the line says it has no key.
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(screen.getByTestId('ce-agent-handoff-key-missing')).toHaveTextContent('The prompt has no AI key yet.');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add my AI key' })));
  expect(requestKey).toHaveBeenLastCalledWith({ prompt: true });
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(screen.queryByTestId('ce-agent-handoff-key-missing')).not.toBeInTheDocument();
});

it('says a session that only lets an AI draft gives no key', async () => {
  renderKeyPanel({ requestKey: jest.fn(async () => ({ ...key, submitAnswers: false })) });
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(screen.getByTestId('ce-agent-handoff-key-missing')).toHaveTextContent(
    'This session lets an AI draft only, so the prompt has no key.',
  );
  expect(screen.queryByRole('button', { name: 'Add my AI key' })).not.toBeInTheDocument();
});

it('goes back to drafting only at Sign Agents Out, and makes a key again only when ticked', async () => {
  const requestKey = jest.fn(async () => key);
  renderKeyPanel({ requestKey });
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(requestKey).toHaveBeenCalledTimes(1);
  act(() => void window.dispatchEvent(new Event('ce-agents-signed-out')));
  // The dead key is gone from the prompt, the copied one no longer works, and the box is unticked again.
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(screen.queryByTestId('ce-agent-handoff-expiry')).not.toBeInTheDocument();
  expect(canSubmit()).not.toBeChecked();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(await copyPrompt()).not.toContain('ceagt_');
  expect(requestKey).toHaveBeenCalledTimes(1);
  fireEvent.click(canSubmit());
  expect(await copyPrompt()).toContain(KEY_LINE);
  expect(requestKey).toHaveBeenCalledTimes(2);
});
