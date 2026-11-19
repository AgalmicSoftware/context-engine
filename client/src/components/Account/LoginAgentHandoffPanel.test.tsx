import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginAgentHandoffPanel from './LoginAgentHandoffPanel';
import { AgentDelegateKeyError } from '../../utilities/session/agentHandoff';

const sessionUrl = 'https://site.example/session/salon?worker=https%3A%2F%2Fce-salon.example.workers.dev';
const key = {
  token: 'ceagt_secret',
  expiresAt: '2026-11-24T16:00:00.000Z',
  sessionSlug: 'salon',
  workerUrl: 'https://ce-salon.example.workers.dev',
  submitAnswers: true,
};

let writeText: jest.Mock;
beforeEach(() => {
  writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

const renderClosedPanel = (props: Partial<React.ComponentProps<typeof LoginAgentHandoffPanel>> = {}) =>
  render(
    <LoginAgentHandoffPanel
      agentHttpEnabled
      sessionUrl={sessionUrl}
      sessionName="Salon"
      requestKey={jest.fn(async () => key)}
      {...props}
    />,
  );

const renderPanel = (props: Partial<React.ComponentProps<typeof LoginAgentHandoffPanel>> = {}) => {
  const view = renderClosedPanel(props);
  fireEvent.click(screen.getByRole('button', { name: 'Your AI agent' }));
  return view;
};

it('starts closed, with its explanation still at hand, and opens as a disclosure', () => {
  renderClosedPanel();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveAttribute('aria-controls', 'ce-agent-handoff-body');
  expect(document.getElementById('ce-agent-handoff-body')).not.toBeVisible();
  expect(screen.getByRole('button', { name: 'As itself', hidden: true })).not.toBeVisible();
  expect(screen.getByRole('region', { name: 'Your AI agent' })).toContainElement(toggle);

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'As itself' })).toBeVisible();
});

it('keeps its choices and name when closed and opened again', () => {
  renderPanel();
  const toggle = screen.getByRole('button', { name: 'Your AI agent' });
  const reopen = () => {
    fireEvent.click(toggle);
    fireEvent.click(toggle);
  };
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Audrey' } });
  reopen();
  expect(screen.getByLabelText('Your name')).toHaveValue('Audrey');
  fireEvent.click(screen.getByRole('button', { name: 'On my behalf' }));
  reopen();
  expect(screen.getByRole('button', { name: 'On my behalf' })).toHaveAttribute('aria-pressed', 'true');
});

it('sets up the MCP as itself, named after its person', async () => {
  renderPanel();
  expect(screen.getByRole('button', { name: 'As itself' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Audrey' } });
  expect(screen.getByTestId('ce-agent-handoff-mcp')).toHaveTextContent('CE_MCP_DISPLAY_NAME="Audrey\'s Agent"');
  fireEvent.click(screen.getByRole('button', { name: 'Copy the prompt' }));
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`${sessionUrl} with join_session`));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Set your display name to "Audrey\'s Agent".'));
});

it('copies with an icon in each box, which shows a tick for a moment', async () => {
  jest.useFakeTimers();
  try {
    renderPanel();
    const copyCommand = screen.getByRole('button', { name: 'Copy the MCP command' });
    const copyPrompt = screen.getByRole('button', { name: 'Copy the prompt' });
    expect(copyCommand).toHaveTextContent('');
    expect(screen.queryByRole('button', { name: /^Copy$/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-agent-handoff-mcp').parentElement).toContainElement(copyCommand);
    fireEvent.click(copyPrompt);
    await screen.findByText('Copied the prompt.');
    expect(copyPrompt).toHaveAttribute('title', 'Copied');
    expect(copyPrompt.querySelector('[data-icon="check"]')).not.toBeNull();
    expect(copyCommand.querySelector('[data-icon="copy"]')).not.toBeNull();
    act(() => jest.advanceTimersByTime(1800));
    expect(copyPrompt).toHaveAttribute('title', 'Copy the prompt');
    expect(copyPrompt.querySelector('[data-icon="copy"]')).not.toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('selects the text, without a tick, when copying is refused', async () => {
  writeText.mockImplementation(async () => {
    throw new Error('denied');
  });
  renderPanel();
  const copyPrompt = screen.getByRole('button', { name: 'Copy the prompt' });
  fireEvent.click(copyPrompt);
  await screen.findByText("Copying isn't allowed here, so the prompt is selected. Copy it yourself.");
  expect(copyPrompt.querySelector('[data-icon="check"]')).toBeNull();
  expect(window.getSelection()?.toString()).toBe(screen.getByTestId('ce-agent-handoff-join').textContent);
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy the MCP command' }));
    expect(await screen.findByText('Copied the command.')).toBeInTheDocument();
    expect(copied).toEqual([screen.getByTestId('ce-agent-handoff-mcp').textContent]);
  } finally {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

it('shows and selects a hidden key when copying it is refused', async () => {
  writeText.mockImplementation(async () => {
    throw new Error('denied');
  });
  renderPanel();
  fireEvent.click(screen.getByRole('button', { name: 'On my behalf' }));
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Copy the key command' }));
  await screen.findByText("Copying isn't allowed here, so the command is selected. Copy it yourself.");
  expect(screen.getByRole('button', { name: 'Show the key' })).toHaveAttribute('aria-pressed', 'true');
  expect(window.getSelection()?.toString()).toContain(key.token);
  window.getSelection()?.removeAllRanges();
});

it('hands over a key on my behalf without showing it or putting it in the prompt', async () => {
  const requestKey = jest.fn(async () => key);
  renderPanel({ requestKey });
  fireEvent.click(screen.getByRole('button', { name: 'On my behalf' }));
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  const command = await screen.findByTestId('ce-agent-handoff-key');
  expect(requestKey).toHaveBeenCalledTimes(1);
  expect(command).not.toHaveTextContent('ceagt_secret');
  expect(screen.getByTestId('ce-agent-handoff-behalf-prompt')).not.toHaveTextContent('ceagt_');
  expect(screen.getByText(/^Works until/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Copy the key command' }));
  expect(await screen.findByText('Copied the command.')).toBeInTheDocument();
  expect(writeText).toHaveBeenLastCalledWith("export CE_AGENT_TOKEN='ceagt_secret'");
  fireEvent.click(screen.getByRole('button', { name: 'Show the key' }));
  expect(command).toHaveTextContent('ceagt_secret');
});

it('says when a key cannot be made', async () => {
  renderPanel({ requestKey: jest.fn(async () => Promise.reject(new AgentDelegateKeyError('', 401))) });
  fireEvent.click(screen.getByRole('button', { name: 'On my behalf' }));
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  await screen.findByText('Sign in again, then make a key.');
  expect(screen.getByRole('alert')).toHaveTextContent('Sign in again, then make a key.');
});

it('announces each copy anew, and a new choice clears the last message', async () => {
  renderPanel({ requestKey: jest.fn(async () => Promise.reject(new AgentDelegateKeyError('', 401))) });
  const status = screen.getByRole('status');
  fireEvent.click(screen.getByRole('button', { name: 'Copy the prompt' }));
  const first = await screen.findByText('Copied the prompt.');
  fireEvent.click(screen.getByRole('button', { name: 'Copy the prompt' }));
  await waitFor(() => expect(screen.getByText('Copied the prompt.')).not.toBe(first));
  expect(status).toContainElement(screen.getByText('Copied the prompt.'));

  fireEvent.click(screen.getByRole('button', { name: 'On my behalf' }));
  fireEvent.click(screen.getByRole('button', { name: 'Make a key' }));
  await screen.findByText('Sign in again, then make a key.');
  fireEvent.click(screen.getByRole('button', { name: 'As itself' }));
  expect(screen.getByRole('alert')).toBeEmptyDOMElement();
});

it('offers no key while the session has Agent HTTP off', () => {
  renderPanel({ agentHttpEnabled: false });
  fireEvent.click(screen.getByRole('button', { name: 'On my behalf' }));
  expect(screen.getByText(/^Not on in Salon/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Make a key' })).not.toBeInTheDocument();
});
