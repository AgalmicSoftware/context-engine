import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { signAgentsOut } from '../../utilities/session/signAgentsOut';
import SignAgentsOutControl from './SignAgentsOutControl';

jest.mock('../../utilities/session/signAgentsOut', () => ({ signAgentsOut: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
});

it('signs the agents out, says how to let one in again, and tells its place so a dead key can go', async () => {
  jest.mocked(signAgentsOut).mockResolvedValue(undefined);
  const onDone = jest.fn();
  render(<SignAgentsOutControl provider="passkey_eoa" sessionSlug="salon" onDone={onDone} />);
  const button = screen.getByTestId('ce-sign-agents-out');
  expect(button.textContent).toBe('Sign Agents Out');
  // What it reaches, and what it does not, is behind the button and not on the page.
  expect(button.getAttribute('title')).toMatch(/You stay signed in\..*another tab or on another device/);
  fireEvent.click(button);
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(signAgentsOut).toHaveBeenCalledWith('salon');
  const said = screen.getByTestId('ce-sign-agents-out-said');
  expect(said.getAttribute('role')).toBe('status');
  expect(said.textContent).toBe('Agents signed out. To let one in again, copy a new prompt from Your AI agent.');
});

it('says so, and reports nothing done, when the agents could not be signed out', async () => {
  jest.mocked(signAgentsOut).mockRejectedValue(new Error('The session could not be reached.'));
  const onDone = jest.fn();
  render(<SignAgentsOutControl provider="wagmi" sessionSlug="salon" onDone={onDone} />);
  fireEvent.click(screen.getByTestId('ce-sign-agents-out'));
  const said = await screen.findByTestId('ce-sign-agents-out-said');
  expect(said.getAttribute('role')).toBe('alert');
  expect(said.textContent).toBe('The session could not be reached.');
  expect(onDone).not.toHaveBeenCalled();
});

it('is not offered in an account an AI agent set up, where the Worker has no such sign-out', () => {
  render(<SignAgentsOutControl provider="agent_link" sessionSlug="salon" />);
  expect(screen.queryByTestId('ce-sign-agents-out')).toBeNull();
});
