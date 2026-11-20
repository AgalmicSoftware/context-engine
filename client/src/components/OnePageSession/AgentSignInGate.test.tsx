import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { forgetAgentLinkAccount, holdAgentLinkAccount } from '../../utilities/session/agentLinkAccount';
import {
  dropAgentSignInCode,
  exchangeHeldAgentSignInCode,
  hasAgentSignInCodeFor,
  workerHasAgentSignIn,
} from '../../utilities/session/agentSignIn';
import {
  attachPasskeyHere,
  changeAgentAccess,
  enterAgentLinkAccount,
  enterThroughAttachedPasskey,
  isAttachedPasskeyKnown,
  leaveAgentLinkAccount,
  resumeAgentLinkAccount,
  staysOnOwnAccount,
} from '../../utilities/session/agentSignInAccount';
import { heldSessionToken } from '../../utilities/worker/workerAuthTokenCache.js';
import AgentSignInGate from './AgentSignInGate';

const WORKER = 'https://ce-salon.example.workers.dev';
const ACCOUNT = `0x${'a1'.repeat(20)}`;
const PASSKEY = `0x${'b2'.repeat(20)}`;
const OTHER = `0x${'c3'.repeat(20)}`;
const TARGET = { workerUrl: WORKER, sessionSlug: 'salon', sessionId: `0x${'3'.repeat(32)}` };

jest.mock('../../domains/worker/workerGroupAutoJoinContext', () => ({
  resolveWorkerGroupAutoJoinContext: jest.fn((config: unknown) =>
    config
      ? {
          workerUrl: 'https://ce-salon.example.workers.dev',
          sessionSlug: 'salon',
          sessionId: `0x${'3'.repeat(32)}`,
          chainId: 1,
        }
      : null,
  ),
}));
jest.mock('../../utilities/session/agentSignIn', () => ({
  dropAgentSignInCode: jest.fn(),
  exchangeHeldAgentSignInCode: jest.fn(),
  hasAgentSignInCodeFor: jest.fn(() => false),
  workerHasAgentSignIn: jest.fn(async () => true),
}));
jest.mock('../../utilities/session/agentSignInAccount', () => ({
  attachPasskeyHere: jest.fn(async () => null),
  changeAgentAccess: jest.fn(async () => null),
  enterAgentLinkAccount: jest.fn(),
  enterThroughAttachedPasskey: jest.fn(async () => null),
  isAttachedPasskeyKnown: jest.fn(() => false),
  leaveAgentLinkAccount: jest.fn(async () => undefined),
  removeAttachedPasskey: jest.fn(async () => undefined),
  resumeAgentLinkAccount: jest.fn(() => null),
  staysOnOwnAccount: jest.fn(() => false),
  switchToOwnPasskeyAccount: jest.fn(),
}));
jest.mock('../../utilities/worker/workerAuthTokenCache.js', () => ({
  heldSessionToken: jest.fn(() => 'held-sign-in'),
}));

const CONFIG = { slug: 'salon' };
const gate = (props: Partial<React.ComponentProps<typeof AgentSignInGate>> = {}) =>
  render(<AgentSignInGate sessionConfig={CONFIG} sessionSlug="salon" account="" provider="" {...props} />);
const held = (extra: Record<string, unknown> = {}) =>
  holdAgentLinkAccount({
    address: ACCOUNT,
    ...TARGET,
    via: 'agent_link',
    passkey: '',
    agentAccess: 'active',
    ...extra,
  });
const notice = () => screen.queryByTestId('ce-agent-sign-in-notice');

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  act(() => forgetAgentLinkAccount());
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(false);
  jest.mocked(workerHasAgentSignIn).mockResolvedValue(true);
  jest.mocked(heldSessionToken).mockReturnValue('held-sign-in');
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(false);
  jest.mocked(staysOnOwnAccount).mockReturnValue(false);
});

it('shows nothing on a page with no link, no agent’s account and no session', async () => {
  gate();
  await act(async () => {});
  expect(notice()).toBeNull();
  expect(resumeAgentLinkAccount).toHaveBeenCalledWith(TARGET);
  render(<AgentSignInGate sessionConfig={null} sessionSlug="salon" account="" provider="" />);
  expect(notice()).toBeNull();
});

it('signs in at once from a link when nobody is signed in', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  const reply = {
    token: 't',
    exp: 1,
    address: ACCOUNT,
    via: 'agent_link' as const,
    passkey: '',
    agentAccess: 'active' as const,
  };
  jest.mocked(exchangeHeldAgentSignInCode).mockResolvedValue(reply);
  gate();
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalledWith(TARGET, reply));
  expect(exchangeHeldAgentSignInCode).toHaveBeenCalledTimes(1);
});

it('asks before replacing a sign-in, and does nothing until answered', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest
    .mocked(exchangeHeldAgentSignInCode)
    .mockResolvedValue({ token: 't', exp: 1, address: ACCOUNT, via: 'agent_link', passkey: '', agentAccess: 'active' });
  gate({ account: OTHER, provider: 'passkey_eoa' });
  await waitFor(() => expect(notice()).not.toBeNull());
  expect(notice()?.textContent).toMatch(/in place of the account you are signed in as\s+now \(0xc3c3…c3c3\)/);
  expect(notice()?.textContent).toMatch(/Only switch if your own agent gave you the link/);
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();

  // Staying drops the code unused.
  fireEvent.click(screen.getByTestId('ce-agent-sign-in-stay'));
  expect(dropAgentSignInCode).toHaveBeenCalled();
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  expect(notice()).toBeNull();
});

it('switches only when the person says so', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest
    .mocked(exchangeHeldAgentSignInCode)
    .mockResolvedValue({ token: 't', exp: 1, address: ACCOUNT, via: 'agent_link', passkey: '', agentAccess: 'active' });
  gate({ account: OTHER, provider: 'passkey_eoa' });
  fireEvent.click(await screen.findByTestId('ce-agent-sign-in-switch'));
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalled());
});

it('says so, and drops the code, where the Worker can’t sign in from a link, or the link is spent', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest.mocked(workerHasAgentSignIn).mockResolvedValue(false);
  const { unmount } = gate();
  await waitFor(() => expect(notice()?.textContent).toMatch(/can’t sign you in from an agent’s link yet/));
  expect(dropAgentSignInCode).toHaveBeenCalled();
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  unmount();

  jest.mocked(workerHasAgentSignIn).mockResolvedValue(true);
  jest
    .mocked(exchangeHeldAgentSignInCode)
    .mockRejectedValue(new Error('This sign-in link has expired or was already used. Ask your agent for a new one.'));
  gate();
  await waitFor(() => expect(notice()?.textContent).toMatch(/expired or was already used/));
  expect(enterAgentLinkAccount).not.toHaveBeenCalled();
});

it('keeps a notice on the page while signed in from a link: whose account, who else can use it, and a way out', async () => {
  act(() => void held());
  gate({ account: ACCOUNT, provider: 'agent_link' });
  const text = notice()?.textContent || '';
  expect(text).toMatch(/You are signed in as 0xa1a1…a1a1, the account your AI agent set up/);
  expect(text).toMatch(/Whoever runs the agent that set this account up can see and change what you answer here/);
  expect(text).toMatch(/If the link did not come from your own agent, sign out/);
  // No way to close it; a passkey, or out.
  expect(screen.queryByText('Dismiss')).toBeNull();
  expect(screen.getByTestId('ce-agent-account-add-passkey')).toBeTruthy();
  expect(screen.getByTestId('ce-agent-account-use-passkey')).toBeTruthy();
  expect(screen.queryByTestId('ce-agent-account-cancel')).toBeNull();
  fireEvent.click(screen.getByTestId('ce-agent-account-add-passkey'));
  await waitFor(() => expect(attachPasskeyHere).toHaveBeenCalledWith({ useExisting: false }));
  fireEvent.click(screen.getByTestId('ce-agent-account-sign-out'));
  await waitFor(() => expect(leaveAgentLinkAccount).toHaveBeenCalled());
});

it('offers Cancel all agent authorizations only once a passkey is attached, and says while the agent still has access', async () => {
  act(() => void held({ via: 'passkey_link', passkey: PASSKEY }));
  gate({ account: ACCOUNT, provider: 'agent_link' });
  expect(notice()?.textContent).toMatch(
    /with your passkey\. Your agent can still use it, and see and\s+change what you answer here/,
  );
  expect(screen.queryByTestId('ce-agent-account-add-passkey')).toBeNull();
  fireEvent.click(screen.getByTestId('ce-agent-account-cancel'));
  await waitFor(() => expect(changeAgentAccess).toHaveBeenCalledWith('cancelled'));

  act(() => void held({ via: 'passkey_link', passkey: PASSKEY, agentAccess: 'cancelled' }));
  expect(notice()?.textContent).toMatch(/Your agent’s access is ended/);
  expect(screen.queryByTestId('ce-agent-account-cancel')).toBeNull();
  expect(screen.queryByTestId('ce-agent-account-remove-passkey')).toBeNull();
  fireEvent.click(screen.getByTestId('ce-agent-account-allow'));
  await waitFor(() => expect(changeAgentAccess).toHaveBeenCalledWith('active'));
});

it('says when a sign-in from a link has ended, and shows the notice for no other account', () => {
  act(() => void held());
  jest.mocked(heldSessionToken).mockReturnValue('');
  const { unmount } = gate({ account: ACCOUNT, provider: 'agent_link' });
  expect(notice()?.textContent).toMatch(/has ended\. Ask your agent for a new link/);
  unmount();
  jest.mocked(heldSessionToken).mockReturnValue('held-sign-in');
  // Signed in as someone else, or with another kind of wallet: nothing of the agent's account is shown.
  gate({ account: OTHER, provider: 'passkey_eoa' });
  expect(notice()).toBeNull();
});

it('opens the agent’s account for a passkey this browser attached, quietly, unless the person chose their own', async () => {
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(true);
  const { unmount } = gate({ account: PASSKEY, provider: 'passkey_eoa' });
  await waitFor(() =>
    expect(enterThroughAttachedPasskey).toHaveBeenCalledWith(TARGET, PASSKEY, { prompt: false, passkeyToken: '' }),
  );
  unmount();
  jest.clearAllMocks();
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(true);
  jest.mocked(staysOnOwnAccount).mockReturnValue(true);
  gate({ account: PASSKEY, provider: 'passkey_eoa' });
  await act(async () => {});
  expect(enterThroughAttachedPasskey).not.toHaveBeenCalled();
  // Never for another kind of wallet, or a passkey nothing is known of.
  jest.mocked(staysOnOwnAccount).mockReturnValue(false);
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(false);
  gate({ account: OTHER, provider: 'passkey_eoa' });
  gate({ account: PASSKEY, provider: 'wagmi' });
  await act(async () => {});
  expect(enterThroughAttachedPasskey).not.toHaveBeenCalled();
});
