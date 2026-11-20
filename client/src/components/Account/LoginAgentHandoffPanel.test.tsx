import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginAgentHandoffPanel from './LoginAgentHandoffPanel';
import { AgentDelegateKeyError } from '../../utilities/session/agentHandoff';
import { getInterviewCatalogTicket } from '../SurveyTool/interviewCatalogTicket';

jest.mock('../SurveyTool/interviewCatalogTicket', () => ({
  ...jest.requireActual<object>('../SurveyTool/interviewCatalogTicket'),
  getInterviewCatalogTicket: jest.fn(),
}));

const ticketMock = jest.mocked(getInterviewCatalogTicket);
const workerUrl = 'https://ce-salon.example.workers.dev';
const sessionUrl = `https://site.example/session/salon?worker=${encodeURIComponent(workerUrl)}`;
const key = {
  token: 'ceagt_secret',
  expiresAt: '2026-11-24T16:00:00.000Z',
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
beforeEach(() => {
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

const chooseSubmit = () => fireEvent.click(screen.getByRole('radio', { name: 'Full submit' }));

const expandSubmitPrompt = () => {
  const expand = screen.getByTestId('ce-agent-handoff-submit-prompt-expand');
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  // The caret half of the split Copy prompt button.
  expect(expand).toHaveAccessibleName('Read the whole prompt');
  expect(expand).toHaveAttribute('aria-controls', 'ce-agent-handoff-submit-prompt-text');
  fireEvent.click(expand);
  expect(expand).toHaveAttribute('aria-expanded', 'true');
};

const copySuggestPrompt = async () => {
  const button = await screen.findByTestId('ce-agent-handoff-suggest-copy');
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  await act(async () => fireEvent.click(button));
  return String(writeText.mock.calls.at(-1)?.[0] || '');
};

it('starts closed, with its explanation still at hand, and opens as a disclosure', () => {
  renderClosedPanel();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveAttribute('aria-controls', 'ce-agent-handoff-body');
  expect(document.getElementById('ce-agent-handoff-body')).not.toBeVisible();
  expect(screen.getByRole('region', { name: 'Your AI agent' })).toContainElement(toggle);
  // Nothing reads the session until the box is opened.
  expect(fetchMock).not.toHaveBeenCalled();

  expect(screen.queryByText('Your agent works for you in this session.')).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const lead = screen.getByText('Your agent works for you in this session.');
  expect(lead).toBeVisible();
  // It shares the title's row, not the body below it.
  expect(toggle.closest('h3')!.parentElement).toContainElement(lead);
});

it('offers one mode, on my behalf, as two choices in a radio group with the first chosen', () => {
  renderPanel();
  expect(screen.queryByRole('button', { name: 'As itself' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'On my behalf' })).not.toBeInTheDocument();
  expect(screen.queryByText(/claude mcp add/)).not.toBeInTheDocument();
  const group = screen.getByRole('group', { name: 'What should it do?' });
  const suggest = screen.getByRole('radio', { name: 'Predict responses' });
  const submit = screen.getByRole('radio', { name: 'Full submit' });
  expect(group).toContainElement(suggest);
  expect(group).toContainElement(submit);
  expect(suggest).toBeChecked();
  expect(suggest).toHaveAccessibleDescription(
    'Your agent drafts your answers. You review and submit them here, on Context Engine.',
  );
  expect(submit).toHaveAccessibleDescription(
    "Your agent submits as you. You don't need to come back to Context Engine.",
  );
  // The tick belongs to Full submit only.
  expect(screen.queryByRole('checkbox', { name: 'Ask me if I approve' })).not.toBeInTheDocument();
  // One name, so the browser moves between them with the arrow keys.
  expect(suggest).toHaveAttribute('name', submit.getAttribute('name'));
  chooseSubmit();
  expect(submit).toBeChecked();
  expect(suggest).not.toBeChecked();
});

it('keeps its choice when closed and opened again', () => {
  renderPanel();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  chooseSubmit();
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(screen.getByRole('radio', { name: 'Full submit' })).toBeChecked();
});

it('copies one prompt that suggests answers for this session, with no key and the MCP inside it', async () => {
  renderPanel();
  const prompt = await copySuggestPrompt();
  expect(screen.getByTestId('ce-agent-handoff-suggest-copy')).toHaveTextContent('Copied');
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  expect(prompt).toContain('It is only for the session "Salon" at https://site.example/session/salon');
  expect(prompt).toContain(`${workerUrl}/agent/interview-catalog?slug=salon`);
  expect(prompt).toContain('Nothing is submitted; I review editable drafts.');
  expect(prompt).not.toContain('ceagt_');
  expect(prompt).not.toContain('CE_AGENT_TOKEN');
  // The MCP is in the one prompt, not a box of its own.
  expect(prompt).toContain('add it with: claude mcp add --scope user context-engine -- npx');
  expect(screen.getByText(/claude mcp add/)).toBe(screen.getByTestId('ce-agent-handoff-suggest-prompt'));
  // Drafts come back to the session's page, not to wherever the dialog was opened.
  expect(prompt).toContain(`sessionUrl=${encodeURIComponent(sessionUrl)}`);
});

it("puts a signed-in person's private catalog link in their suggestions prompt", async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  renderPanel();
  const prompt = await copySuggestPrompt();
  expect(prompt).toContain('&ticket=ic1.mine');
  expect(prompt).toContain('The link is private to me');
  // On screen the ticket is masked, as the key is; only the copy holds it.
  fireEvent.click(screen.getByRole('button', { name: 'Read the whole prompt' }));
  const shown = screen.getByTestId('ce-agent-handoff-suggest-prompt');
  expect(shown).toHaveTextContent('&ticket=••••••••');
  expect(shown).not.toHaveTextContent('ic1.mine');
});

it('says so when the session has no Worker to suggest from', async () => {
  renderPanel({ workerUrl: '', sessionConfig: null });
  expect(await screen.findByTestId('ce-agent-handoff-suggest-off')).toHaveTextContent('Not available in Salon');
  expect(screen.queryByTestId('ce-agent-handoff-suggest-copy')).not.toBeInTheDocument();
});

it('puts the key into the one prompt, masked on screen, which names the session and its expiry', async () => {
  const requestKey = jest.fn(async () => key);
  renderPanel({ requestKey });
  chooseSubmit();
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  const prompt = await screen.findByTestId('ce-agent-handoff-submit-prompt');
  expect(requestKey).toHaveBeenCalledTimes(1);
  // Nothing of it shows until the caret opens it.
  expect(prompt).not.toBeVisible();
  expandSubmitPrompt();
  expect(prompt).toBeVisible();
  // One thing to copy: no terminal command, no MCP box.
  expect(screen.getAllByRole('button', { name: /^Copy/ })).toHaveLength(1);
  expect(screen.queryByText(/export CE_AGENT_TOKEN/)).not.toBeInTheDocument();
  expect(prompt).not.toHaveTextContent('ceagt_secret');
  expect(prompt).toHaveTextContent('Your key is ceagt_••••••••');
  expect(prompt).toHaveTextContent(`session "Salon" (${sessionUrl}, slug "salon")`);
  expect(prompt).toHaveTextContent(`until ${key.expiresAt}`);
  // Ticked by default: the agent asks in the chat before it submits.
  expect(screen.getByRole('checkbox', { name: 'Ask me if I approve' })).toBeChecked();
  expect(prompt).toHaveTextContent('show them to me here in the chat. Submit them as me only after I say yes here');
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(/^Your key works in Salon only, until /);
  expect(screen.queryByTestId('ce-agent-handoff-drafts-only')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  const copied = String(writeText.mock.calls.at(-1)?.[0]);
  expect(copied).toContain('Your key is ceagt_secret;');
  expect(copied).toContain('Never repeat or print it');
  expect(copied).toBe(prompt.textContent?.replace('ceagt_••••••••', 'ceagt_secret'));
  // Only the clipboard got the key: the page still shows it masked.
  expect(prompt).not.toHaveTextContent('ceagt_secret');
  fireEvent.click(screen.getByRole('button', { name: 'Show the key' }));
  expect(prompt).toHaveTextContent('Your key is ceagt_secret;');
  expect(screen.getByRole('button', { name: 'Show the key' })).toHaveTextContent('Hide');
  fireEvent.click(screen.getByRole('button', { name: 'Show the key' }));
  expect(prompt).not.toHaveTextContent('ceagt_secret');
  expect(screen.getByRole('button', { name: 'Show the key' })).toHaveTextContent('Show');
});

it("says when a session doesn't let agents submit, and the prompt asks for drafts only", async () => {
  renderPanel({ requestKey: jest.fn(async () => ({ ...key, submitAnswers: false })) });
  chooseSubmit();
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  expect(await screen.findByTestId('ce-agent-handoff-drafts-only')).toHaveTextContent(
    "Salon doesn't let agents submit, so your agent shows you drafts.",
  );
  expandSubmitPrompt();
  expect(screen.getByTestId('ce-agent-handoff-submit-prompt')).toHaveTextContent("doesn't let agents submit");
  expect(screen.getByTestId('ce-agent-handoff-submit-prompt')).not.toHaveTextContent('submit as me');
  // Asking first is moot there, so the tick goes.
  expect(screen.queryByRole('checkbox', { name: 'Ask me if I approve' })).not.toBeInTheDocument();
});

it('changes the copied prompt with the Ask me if I approve tick', async () => {
  renderPanel({ requestKey: jest.fn(async () => key) });
  chooseSubmit();
  const ask = screen.getByRole('checkbox', { name: 'Ask me if I approve' });
  expect(ask).toBeChecked();
  expect(ask).toHaveAccessibleDescription(/Ticked, your agent shows you its answers in the chat/);
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  const prompt = await screen.findByTestId('ce-agent-handoff-submit-prompt');
  expandSubmitPrompt();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Ask me if I approve' }));
  expect(screen.getByRole('checkbox', { name: 'Ask me if I approve' })).not.toBeChecked();
  expect(prompt).toHaveTextContent('submit them as me, without asking me again');
  expect(prompt).not.toHaveTextContent('only after I say yes');
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  expect(String(writeText.mock.calls.at(-1)?.[0])).toContain('without asking me again');
  expect(screen.getByTestId('ce-agent-handoff-submit-copy')).toHaveTextContent('Copied');
  // A change of tick changes the prompt, so the button no longer says it was copied.
  fireEvent.click(screen.getByRole('checkbox', { name: 'Ask me if I approve' }));
  expect(screen.getByTestId('ce-agent-handoff-submit-copy')).toHaveTextContent('Copy prompt');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Ask me if I approve' }));
  // Ticked again, the copy asks first again, with the same key.
  fireEvent.click(screen.getByRole('checkbox', { name: 'Ask me if I approve' }));
  fireEvent.click(screen.getByTestId('ce-agent-handoff-submit-copy'));
  await waitFor(() => expect(String(writeText.mock.calls.at(-1)?.[0])).toContain('only after I say yes here'));
  expect(String(writeText.mock.calls.at(-1)?.[0])).toContain('Your key is ceagt_secret;');
});

it('offers no key while the session has Agent HTTP off, and still offers suggestions', async () => {
  renderPanel({ agentHttpEnabled: false });
  expect(await screen.findByTestId('ce-agent-handoff-suggest-copy')).toBeInTheDocument();
  chooseSubmit();
  expect(screen.getByTestId('ce-agent-handoff-submit-off')).toHaveTextContent(/^Not on in Salon/);
  expect(screen.queryByRole('button', { name: 'Make a key' })).not.toBeInTheDocument();
});

it('copies from one split Copy prompt button, whose caret opens the whole prompt to read', async () => {
  renderPanel();
  chooseSubmit();
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  const prompt = await screen.findByTestId('ce-agent-handoff-submit-prompt');
  expect(prompt).not.toBeVisible();
  const button = screen.getByRole('button', { name: 'Copy prompt' });
  expect(button.querySelector('[data-icon="copy"]')).not.toBeNull();
  fireEvent.click(button);
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  const copied = String(writeText.mock.calls.at(-1)?.[0]);
  expect(copied).toContain('Your key is ceagt_secret;');
  expect(copied).toContain('This task does not need it.');
  // The icon turns from the clipboard to a tick.
  expect(button.querySelector('[data-icon="check"]')).not.toBeNull();
  expect(button).toHaveTextContent('Copied');
  // Still closed after copying; the caret opens all of it, masked, and closes it again.
  expect(prompt).not.toBeVisible();
  expandSubmitPrompt();
  expect(copied).toBe(prompt.textContent?.replace('ceagt_••••••••', 'ceagt_secret'));
  fireEvent.click(screen.getByTestId('ce-agent-handoff-submit-prompt-expand'));
  expect(prompt).not.toBeVisible();
  // Show (the key) opens it too, since the key is what it shows.
  fireEvent.click(screen.getByRole('button', { name: 'Show the key' }));
  expect(prompt).toBeVisible();
  expect(prompt).toHaveTextContent('Your key is ceagt_secret;');
});

it('shows nothing of the suggestions prompt until its caret opens it', async () => {
  renderPanel();
  const button = await screen.findByTestId('ce-agent-handoff-suggest-copy');
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  expect(button).toHaveTextContent('Copy prompt');
  const prompt = screen.getByTestId('ce-agent-handoff-suggest-prompt');
  expect(prompt).not.toBeVisible();
  await act(async () => fireEvent.click(button));
  const copied = String(writeText.mock.calls.at(-1)?.[0]);
  expect(copied).toContain(`${workerUrl}/agent/interview-catalog?slug=salon`);
  expect(button).toHaveTextContent('Copied');
  expect(button.querySelector('[data-icon="check"]')).not.toBeNull();
  const caret = screen.getByRole('button', { name: 'Read the whole prompt' });
  expect(caret).toHaveAttribute('aria-expanded', 'false');
  expect(caret).toHaveAttribute('aria-controls', 'ce-agent-handoff-suggest-prompt-text');
  fireEvent.click(caret);
  expect(caret).toHaveAttribute('aria-expanded', 'true');
  expect(prompt).toBeVisible();
  expect(prompt.textContent).toBe(copied);
});

it('turns the copy button to Copied for a moment', async () => {
  jest.useFakeTimers();
  try {
    renderPanel();
    chooseSubmit();
    fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
    const copyPrompt = await screen.findByTestId('ce-agent-handoff-submit-copy');
    fireEvent.click(copyPrompt);
    await screen.findByText('Copied the prompt.');
    expect(copyPrompt).toHaveTextContent('Copied');
    expect(copyPrompt.querySelector('[data-icon="check"]')).not.toBeNull();
    act(() => jest.advanceTimersByTime(1800));
    expect(copyPrompt).toHaveTextContent('Copy prompt');
  } finally {
    jest.useRealTimers();
  }
});

it('shows and selects the prompt with its key when copying is refused', async () => {
  writeText.mockImplementation(async () => {
    throw new Error('denied');
  });
  renderPanel();
  chooseSubmit();
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Copy prompt' }));
  await screen.findByText("Copying isn't allowed here, so the prompt is selected. Copy it yourself.");
  expect(screen.getByRole('button', { name: 'Show the key' })).toHaveAttribute('aria-pressed', 'true');
  // Opened, so the selection is something the person can see and copy.
  expect(screen.getByTestId('ce-agent-handoff-submit-prompt')).toBeVisible();
  expect(screen.getByTestId('ce-agent-handoff-submit-prompt-expand')).toHaveAttribute('aria-expanded', 'true');
  expect(window.getSelection()?.toString()).toContain('Your key is ceagt_secret;');
  window.getSelection()?.removeAllRanges();
});

it('gives a refused suggestions copy its own field, not the prompt twice', async () => {
  writeText.mockImplementation(async () => {
    throw new Error('denied');
  });
  renderPanel();
  const button = await screen.findByTestId('ce-agent-handoff-suggest-copy');
  // The caret waits for the checked prompt, as Copy prompt does.
  expect(screen.queryByRole('button', { name: 'Read the whole prompt' })).not.toBeInTheDocument();
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(screen.getByRole('button', { name: 'Read the whole prompt' }));
  expect(screen.getByTestId('ce-agent-handoff-suggest-prompt')).toBeVisible();
  await act(async () => fireEvent.click(button));
  const field = await screen.findByRole('textbox', { name: 'Memory augmentation prompt to copy' });
  expect(field).toHaveValue(String(writeText.mock.calls.at(-1)?.[0]));
  expect(screen.queryByTestId('ce-agent-handoff-suggest-prompt')).not.toBeInTheDocument();
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
    chooseSubmit();
    fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy prompt' }));
    expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('Your key is ceagt_secret;');
  } finally {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

it('says when a key cannot be made, and a new choice clears the message', async () => {
  renderPanel({ requestKey: jest.fn(async () => Promise.reject(new AgentDelegateKeyError('', 401))) });
  chooseSubmit();
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  await screen.findByText('Sign in again, then make a key.');
  expect(screen.getByRole('alert')).toHaveTextContent('Sign in again, then make a key.');
  fireEvent.click(screen.getByRole('radio', { name: 'Predict responses' }));
  expect(screen.getByRole('alert')).toBeEmptyDOMElement();
});

it("on the session's own page, sends drafts back to that page with its join link, whatever the slug's case", async () => {
  window.history.pushState({}, '', '/session/Salon?joinGroup=g1');
  try {
    renderPanel();
    const prompt = await copySuggestPrompt();
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
    const prompt = await copySuggestPrompt();
    expect(prompt).toContain(`sessionUrl=${encodeURIComponent(sessionUrl)}`);
  } finally {
    window.history.pushState({}, '', '/');
  }
});
