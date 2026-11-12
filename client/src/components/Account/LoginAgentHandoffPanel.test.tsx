import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const renderPanel = (props: Partial<React.ComponentProps<typeof LoginAgentHandoffPanel>> = {}) =>
  render(
    <LoginAgentHandoffPanel
      agentHttpEnabled
      sessionUrl={sessionUrl}
      requestKey={jest.fn(async () => key)}
      {...props}
    />,
  );

it('sets up the MCP as itself, named after its person', async () => {
  renderPanel();
  expect(screen.getByRole('button', { name: 'As itself' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Audrey' } });
  expect(screen.getByTestId('ce-agent-handoff-mcp')).toHaveTextContent('CE_MCP_DISPLAY_NAME="Audrey\'s Kami"');
  fireEvent.click(screen.getByRole('button', { name: 'Copy the prompt' }));
  expect(await screen.findByText('Copied the prompt.')).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`${sessionUrl} with join_session`));
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
  expect(screen.getByText(/^Not on in this session/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Make a key' })).not.toBeInTheDocument();
});
