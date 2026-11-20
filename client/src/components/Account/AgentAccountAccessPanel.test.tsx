// The panel as the account dialog shows it: nobody tells it whether the account has a passkey, so it asks.
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import { forgetAgentLinkAccount, holdAgentLinkAccount } from '../../utilities/session/agentLinkAccount';
import { heldAccountHasPasskey } from '../../utilities/session/agentSignInAccount';
import AgentAccountAccessPanel from './AgentAccountAccessPanel';

jest.mock('../../utilities/session/agentSignInAccount', () => ({
  attachPasskeyHere: jest.fn(async () => null),
  changeAgentAccess: jest.fn(async () => null),
  heldAccountHasPasskey: jest.fn(),
  removeAttachedPasskey: jest.fn(async () => undefined),
}));

const ACCOUNT = `0x${'a1'.repeat(20)}`;
const PASSKEY = `0x${'b2'.repeat(20)}`;
const hold = (extra: Record<string, unknown> = {}) =>
  holdAgentLinkAccount({
    address: ACCOUNT,
    workerUrl: 'https://ce-salon.example.workers.dev',
    sessionSlug: 'salon',
    sessionId: `0x${'3'.repeat(32)}`,
    via: 'agent_link',
    passkey: '',
    agentAccess: 'active',
    ...extra,
  });

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  act(() => forgetAgentLinkAccount());
});

it('offers Create passkey in the account dialog once the Worker says the account has none', async () => {
  act(() => void hold());
  jest.mocked(heldAccountHasPasskey).mockResolvedValue(false);
  render(<AgentAccountAccessPanel provider="agent_link" />);
  // Not before the Worker has answered.
  expect(screen.queryByTestId('ce-agent-account-add-passkey')).toBeNull();
  expect((await screen.findByTestId('ce-agent-account-add-passkey')).textContent).toBe('Create passkey');
});

it('does not offer it where a passkey is already attached, and offers it where the Worker can’t be asked', async () => {
  act(() => void hold());
  jest.mocked(heldAccountHasPasskey).mockResolvedValue(true);
  const attached = render(<AgentAccountAccessPanel provider="agent_link" />);
  await waitFor(() => expect(heldAccountHasPasskey).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.queryByTestId('ce-agent-account-add-passkey')).toBeNull();
  attached.unmount();
  // The Worker refuses a second passkey itself, so not knowing is no reason to hide the way to the first.
  jest.mocked(heldAccountHasPasskey).mockResolvedValue(null);
  render(<AgentAccountAccessPanel provider="agent_link" />);
  await screen.findByTestId('ce-agent-account-add-passkey');
});

it('asks nothing when signed in through the passkey, or when told, and shows nothing for another account', async () => {
  act(() => void hold({ via: 'passkey_link', passkey: PASSKEY }));
  const through = render(<AgentAccountAccessPanel provider="agent_link" />);
  expect(screen.getByTestId('ce-agent-account-remove-passkey')).toBeTruthy();
  expect(screen.queryByTestId('ce-agent-account-add-passkey')).toBeNull();
  through.unmount();
  act(() => void hold());
  const told = render(<AgentAccountAccessPanel provider="agent_link" offerPasskey={false} />);
  expect(screen.queryByTestId('ce-agent-account-add-passkey')).toBeNull();
  told.unmount();
  const { container } = render(<AgentAccountAccessPanel provider="passkey_eoa" />);
  expect(container.innerHTML).toBe('');
  expect(heldAccountHasPasskey).not.toHaveBeenCalled();
});
