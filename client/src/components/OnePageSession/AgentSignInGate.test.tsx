import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  dismissAttachedPasskeyNotice,
  forgetAgentLinkAccount,
  forgetAgentLinkHints,
  holdAgentLinkAccount,
  noteAttachedPasskey,
  noteLinkedAgentAccount,
} from '../../utilities/session/agentLinkAccount';
import {
  detachAgentPasskey,
  dropAgentSignInCode,
  exchangeHeldAgentSignInCode,
  hasAgentSignInCodeFor,
  readAgentSignInState,
  workerHasAgentSignIn,
} from '../../utilities/session/agentSignIn';
import {
  attachPasskeyHere,
  changeAgentAccess,
  enterAgentLinkAccount,
  enterThroughAttachedPasskey,
  isAttachedPasskeyKnown,
  leaveAgentLinkAccount,
  liveAccount,
  resumeAgentLinkAccount,
  stayOnOwnAccount,
  staysOnOwnAccount,
  whoALinkWouldReplace,
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
// A link's code can arrive without a page load; the test says when one has.
const mockCodeListeners = new Set<() => void>();
let mockCodeArrivals = 0;
const codeArrives = () =>
  act(() => {
    mockCodeArrivals += 1;
    mockCodeListeners.forEach((listener) => listener());
  });
jest.mock('../../utilities/session/agentSignIn', () => ({
  readAgentSignInCodeArrivals: () => mockCodeArrivals,
  subscribeAgentSignInCode: (listener: () => void) => {
    mockCodeListeners.add(listener);
    return () => mockCodeListeners.delete(listener);
  },
  detachAgentPasskey: jest.fn(async () => undefined),
  dropAgentSignInCode: jest.fn(),
  exchangeHeldAgentSignInCode: jest.fn(),
  hasAgentSignInCodeFor: jest.fn(() => false),
  readAgentSignInState: jest.fn(async () => ({
    via: 'passkey_link',
    attachedPasskey: null,
    linkedAgentAccount: null,
    agentParticipation: true,
  })),
  workerHasAgentSignIn: jest.fn(async () => true),
}));
jest.mock('../../utilities/session/agentSignInAccount', () => ({
  attachPasskeyHere: jest.fn(async () => null),
  changeAgentAccess: jest.fn(async () => null),
  enterAgentLinkAccount: jest.fn(),
  enterThroughAttachedPasskey: jest.fn(async () => null),
  isAttachedPasskeyKnown: jest.fn(() => false),
  leaveAgentLinkAccount: jest.fn(async () => undefined),
  liveAccount: jest.fn(() => ''),
  removeAttachedPasskey: jest.fn(async () => undefined),
  resumeAgentLinkAccount: jest.fn(() => null),
  stayOnOwnAccount: jest.fn(),
  staysOnOwnAccount: jest.fn(() => false),
  whoALinkWouldReplace: jest.fn(async () => ''),
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
  act(() => dismissAttachedPasskeyNotice());
  act(() => forgetAgentLinkHints());
  jest.mocked(liveAccount).mockReturnValue('');
  jest.mocked(whoALinkWouldReplace).mockResolvedValue('');
  jest.mocked(enterThroughAttachedPasskey).mockResolvedValue(null);
  jest.mocked(readAgentSignInState).mockResolvedValue({
    via: 'agent_link',
    attachedPasskey: null,
    linkedAgentAccount: null,
    agentParticipation: true,
  });
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
  jest.mocked(whoALinkWouldReplace).mockResolvedValue(OTHER);
  gate({ account: OTHER, provider: 'passkey_eoa' });
  await waitFor(() => expect(notice()).not.toBeNull());
  expect(notice()?.textContent).toMatch(/in place of the account you use here\s+now \(0xc3c3…c3c3\)/);
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
  jest.mocked(whoALinkWouldReplace).mockResolvedValue(OTHER);
  jest.mocked(liveAccount).mockReturnValue(OTHER);
  gate({ account: OTHER, provider: 'passkey_eoa' });
  fireEvent.click(await screen.findByTestId('ce-agent-sign-in-switch'));
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalled());
});

const REPLY = {
  token: 't',
  exp: 1,
  address: ACCOUNT,
  via: 'agent_link' as const,
  passkey: '',
  agentAccess: 'active' as const,
};

it('asks on a reload that holds an agent’s account or a saved passkey, though nobody is signed in yet', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest.mocked(exchangeHeldAgentSignInCode).mockResolvedValue(REPLY);
  // Nothing in the page's state: the account this tab would open by itself is who the link replaces.
  jest.mocked(whoALinkWouldReplace).mockResolvedValue(OTHER);
  gate();
  await waitFor(() =>
    expect(notice()?.textContent).toMatch(/in place of the account you use here\s+now \(0xc3c3…c3c3\)/),
  );
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  expect(resumeAgentLinkAccount).not.toHaveBeenCalled();
  // Staying opens the held account again, as a reload without the link would have.
  fireEvent.click(screen.getByTestId('ce-agent-sign-in-stay'));
  expect(dropAgentSignInCode).toHaveBeenCalled();
  expect(resumeAgentLinkAccount).toHaveBeenCalledWith(TARGET);
  expect(enterAgentLinkAccount).not.toHaveBeenCalled();
});

it('does not replace an account that signed in while the Worker was answering: the sign-in is held and it asks', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  let answer: (reply: typeof REPLY) => void = () => undefined;
  jest.mocked(exchangeHeldAgentSignInCode).mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  gate();
  await waitFor(() => expect(exchangeHeldAgentSignInCode).toHaveBeenCalledTimes(1));
  expect(notice()?.textContent).toMatch(/Signing you in from your agent’s link/);
  // A saved passkey, or a wallet, signs in before the answer comes back.
  jest.mocked(liveAccount).mockReturnValue(OTHER);
  await act(async () => answer(REPLY));
  expect(enterAgentLinkAccount).not.toHaveBeenCalled();
  expect(notice()?.textContent).toMatch(/now \(0xc3c3…c3c3\)/);
  expect(notice()?.textContent).toMatch(/The link has been used/);
  // Saying yes uses the sign-in already made: the code works once.
  fireEvent.click(screen.getByTestId('ce-agent-sign-in-switch'));
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalledWith(TARGET, REPLY));
  expect(exchangeHeldAgentSignInCode).toHaveBeenCalledTimes(1);
});

it('drops a held sign-in when the person stays, and enters the same account without asking', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest.mocked(exchangeHeldAgentSignInCode).mockResolvedValue(REPLY);
  jest.mocked(liveAccount).mockReturnValue(OTHER);
  const { unmount } = gate();
  fireEvent.click(await screen.findByTestId('ce-agent-sign-in-stay'));
  expect(notice()).toBeNull();
  expect(enterAgentLinkAccount).not.toHaveBeenCalled();
  unmount();
  // The link is for the very account that is here already: nothing to ask.
  jest.mocked(liveAccount).mockReturnValue(ACCOUNT);
  gate();
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalledWith(TARGET, REPLY));
});

it('uses a link pasted into a tab that is already on the session, with no page load', async () => {
  jest.mocked(exchangeHeldAgentSignInCode).mockResolvedValue(REPLY);
  gate();
  await act(async () => {});
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  codeArrives();
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalledWith(TARGET, REPLY));
});

it('says so, and drops the code, where the Worker can’t sign in from a link, or the link is spent', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest.mocked(workerHasAgentSignIn).mockResolvedValue(false);
  const { unmount } = gate();
  await waitFor(() => expect(notice()?.textContent).toMatch(/can’t sign you in from an agent’s link yet/));
  expect(dropAgentSignInCode).toHaveBeenCalled();
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  unmount();

  // Switched off in the session's own settings: said so, with the code dropped unused.
  jest.mocked(workerHasAgentSignIn).mockResolvedValue(true);
  const offGate = render(
    <AgentSignInGate
      sessionConfig={{ slug: 'salon', agentSignInLinksEnabled: false }}
      sessionSlug="salon"
      account=""
      provider=""
    />,
  );
  await waitFor(() => expect(notice()?.textContent).toMatch(/sign-in links from agents switched off/));
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  offGate.unmount();

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
  expect(notice()).toBeNull();
  jest.mocked(staysOnOwnAccount).mockReturnValue(false);
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(false);
  gate({ account: OTHER, provider: 'passkey_eoa' });
  gate({ account: PASSKEY, provider: 'wagmi' });
  await act(async () => {});
  expect(enterThroughAttachedPasskey).not.toHaveBeenCalled();
});

it('says so in the passkey’s own account when the agent’s account could not be opened quietly, and opens it when asked', async () => {
  // As after a reload: the passkey is known to be attached, but locked, so nothing can be signed without asking.
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(true);
  jest.mocked(liveAccount).mockReturnValue(PASSKEY);
  const { unmount } = gate({ account: PASSKEY, provider: 'passkey_eoa' });
  await waitFor(() =>
    expect(notice()?.textContent).toMatch(/This passkey is also attached to an account your AI agent set up/),
  );
  expect(notice()?.textContent).toMatch(/what you answer here is kept under it, not under\s+the agent’s account/);
  expect(enterThroughAttachedPasskey).toHaveBeenCalledTimes(1);
  expect(enterThroughAttachedPasskey).toHaveBeenLastCalledWith(TARGET, PASSKEY, { prompt: false, passkeyToken: '' });
  fireEvent.click(screen.getByTestId('ce-agent-offer-open'));
  await waitFor(() => expect(enterThroughAttachedPasskey).toHaveBeenLastCalledWith(TARGET, PASSKEY, { prompt: true }));
  unmount();
  gate({ account: PASSKEY, provider: 'passkey_eoa' });
  fireEvent.click(await screen.findByTestId('ce-agent-offer-stay'));
  expect(stayOnOwnAccount).toHaveBeenCalledWith(TARGET);
  expect(notice()).toBeNull();
});

it('opens the agent’s account when the Worker says, after the page settled, that this passkey is attached to one', async () => {
  const hint = { ...TARGET, passkey: PASSKEY, linked: { address: ACCOUNT }, token: 'passkey-sign-in' };
  gate({ account: PASSKEY, provider: 'passkey_eoa' });
  await act(async () => {});
  expect(enterThroughAttachedPasskey).not.toHaveBeenCalled();
  // Said by another Worker, or for another session of the same name: the passkey's sign-in goes nowhere.
  act(() => noteLinkedAgentAccount({ ...hint, workerUrl: 'https://impostor.example' }));
  act(() => noteLinkedAgentAccount({ ...hint, sessionId: `0x${'4'.repeat(32)}` }));
  await act(async () => {});
  expect(enterThroughAttachedPasskey).not.toHaveBeenCalled();
  act(() => noteLinkedAgentAccount(hint));
  await waitFor(() =>
    expect(enterThroughAttachedPasskey).toHaveBeenCalledWith(TARGET, PASSKEY, {
      prompt: false,
      passkeyToken: 'passkey-sign-in',
    }),
  );
  expect(enterThroughAttachedPasskey).toHaveBeenCalledTimes(1);
});

it('tells someone signed in from a link when a passkey can already open the account', async () => {
  act(() => void held());
  jest.mocked(readAgentSignInState).mockResolvedValue({
    via: 'agent_link',
    attachedPasskey: { address: PASSKEY, agentAccess: 'active' },
    linkedAgentAccount: null,
    agentParticipation: true,
  });
  gate({ account: ACCOUNT, provider: 'agent_link' });
  await waitFor(() =>
    expect(notice()?.textContent).toMatch(
      /A passkey \(0xb2b2…b2b2\) is already attached to this\s+account: whoever holds it can sign in here as this account/,
    ),
  );
});

it('takes the Worker’s word for whether the agent still has access', async () => {
  act(() => void held({ via: 'passkey_link', passkey: PASSKEY }));
  jest.mocked(readAgentSignInState).mockResolvedValue({
    via: 'passkey_link',
    attachedPasskey: { address: PASSKEY, agentAccess: 'cancelled' },
    linkedAgentAccount: null,
    agentParticipation: true,
  });
  gate({ account: ACCOUNT, provider: 'agent_link' });
  expect(notice()?.textContent).toMatch(/Your agent can still use it/);
  // Ended from another tab or device: the notice follows.
  await waitFor(() => expect(notice()?.textContent).toMatch(/Your agent’s access is ended/));
  expect(readAgentSignInState).toHaveBeenCalledWith(TARGET, 'held-sign-in');
});

it('tells a person signed in with their own key that a passkey is attached to their account, and lets them remove it', async () => {
  gate({ account: OTHER, provider: 'passkey_eoa' });
  expect(notice()).toBeNull();
  act(() => noteAttachedPasskey({ ...TARGET, account: OTHER, attached: { address: PASSKEY } }));
  expect(notice()?.textContent).toMatch(
    /A passkey \(0xb2b2…b2b2\) is attached to your account in this\s+session: whoever holds it can sign in here as you/,
  );
  fireEvent.click(screen.getByTestId('ce-agent-attached-remove'));
  await waitFor(() => expect(detachAgentPasskey).toHaveBeenCalledWith(TARGET, 'held-sign-in'));
  await waitFor(() => expect(notice()).toBeNull());
  // Their own passkey, attached on purpose: said once, then left alone.
  act(() => noteAttachedPasskey({ ...TARGET, account: OTHER, attached: { address: PASSKEY } }));
  fireEvent.click(screen.getByTestId('ce-agent-attached-keep'));
  expect(notice()).toBeNull();
  // Said of another session, or by another Worker for a session of the same name, it is not shown here.
  for (const elsewhere of [
    { sessionSlug: 'another' },
    { workerUrl: 'https://impostor.example' },
    { sessionId: `0x${'4'.repeat(32)}` },
  ]) {
    act(() => noteAttachedPasskey({ ...TARGET, ...elsewhere, account: OTHER, attached: { address: PASSKEY } }));
    expect(notice()).toBeNull();
  }
});
