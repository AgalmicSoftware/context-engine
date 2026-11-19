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

const chooseSubmit = () => fireEvent.click(screen.getByRole('radio', { name: 'Answer and submit for me' }));

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

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Your agent works for you in this session.')).toBeVisible();
});

it('offers one mode, on my behalf, as two choices in a radio group with the first chosen', () => {
  renderPanel();
  expect(screen.queryByRole('button', { name: 'As itself' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'On my behalf' })).not.toBeInTheDocument();
  expect(screen.queryByText(/claude mcp add/)).not.toBeInTheDocument();
  const group = screen.getByRole('group', { name: 'What should it do?' });
  const suggest = screen.getByRole('radio', { name: 'Suggest answers for me to review' });
  const submit = screen.getByRole('radio', { name: 'Answer and submit for me' });
  expect(group).toContainElement(suggest);
  expect(group).toContainElement(submit);
  expect(suggest).toBeChecked();
  expect(suggest).toHaveAccessibleDescription(
    'You get a link with its suggestions filled in. Nothing is submitted until you submit.',
  );
  expect(submit).toHaveAccessibleDescription('Your agent submits as you.');
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
  expect(screen.getByRole('radio', { name: 'Answer and submit for me' })).toBeChecked();
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
  expect(screen.queryByText(/claude mcp add/)).not.toBeInTheDocument();
  // Drafts come back to the session's page, not to wherever the dialog was opened.
  expect(prompt).toContain(`sessionUrl=${encodeURIComponent(sessionUrl)}`);
});

it("puts a signed-in person's private catalog link in their suggestions prompt", async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  renderPanel();
  const prompt = await copySuggestPrompt();
  expect(prompt).toContain('&ticket=ic1.mine');
  expect(prompt).toContain('The link is private to me');
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
  // One thing to copy: no terminal command, no MCP box.
  expect(screen.getAllByRole('button', { name: /^Copy/ })).toHaveLength(1);
  expect(screen.queryByText(/export CE_AGENT_TOKEN/)).not.toBeInTheDocument();
  expect(prompt).not.toHaveTextContent('ceagt_secret');
  expect(prompt).toHaveTextContent('Your key is ceagt_••••••••');
  expect(prompt).toHaveTextContent(`session "Salon" (${sessionUrl}, slug "salon")`);
  expect(prompt).toHaveTextContent(`until ${key.expiresAt}`);
  expect(prompt).toHaveTextContent('submit as me only the ones I approve');
  expect(screen.getByTestId('ce-agent-handoff-expiry')).toHaveTextContent(/^Your key works in Salon only, until /);
  expect(screen.queryByTestId('ce-agent-handoff-drafts-only')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Copy the prompt' }));
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
  expect(screen.getByTestId('ce-agent-handoff-submit-prompt')).toHaveTextContent("doesn't let agents submit");
  expect(screen.getByTestId('ce-agent-handoff-submit-prompt')).not.toHaveTextContent('submit as me');
});

it('offers no key while the session has Agent HTTP off, and still offers suggestions', async () => {
  renderPanel({ agentHttpEnabled: false });
  expect(await screen.findByTestId('ce-agent-handoff-suggest-copy')).toBeInTheDocument();
  chooseSubmit();
  expect(screen.getByTestId('ce-agent-handoff-submit-off')).toHaveTextContent(/^Not on in Salon/);
  expect(screen.queryByRole('button', { name: 'Make a key' })).not.toBeInTheDocument();
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
    expect(copyPrompt).toHaveTextContent('Copy the prompt');
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
  fireEvent.click(await screen.findByRole('button', { name: 'Copy the prompt' }));
  await screen.findByText("Copying isn't allowed here, so the prompt is selected. Copy it yourself.");
  expect(screen.getByRole('button', { name: 'Show the key' })).toHaveAttribute('aria-pressed', 'true');
  expect(window.getSelection()?.toString()).toContain('Your key is ceagt_secret;');
  window.getSelection()?.removeAllRanges();
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
    fireEvent.click(await screen.findByRole('button', { name: 'Copy the prompt' }));
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
  fireEvent.click(screen.getByRole('radio', { name: 'Suggest answers for me to review' }));
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
