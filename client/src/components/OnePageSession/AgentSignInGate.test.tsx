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
  whoALinkWouldReplace: jest.fn(async () => ''),
}));
jest.mock('../../utilities/worker/workerAuthTokenCache.js', () => ({
  heldSessionToken: jest.fn(() => 'held-sign-in'),
}));

// A session whose admin has turned sign-in links on; they are off until then.
const CONFIG = { slug: 'salon', agentSignInLinksEnabled: true };
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
// The question a link raises when it would replace the account in use: a dialog, not part of the notice.
const askBody = () => screen.queryByTestId('ce-agent-sign-in-ask-body');

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
  await waitFor(() => expect(askBody()).not.toBeNull());
  // Which account is here now, which the link leads to, and the two choices.
  expect(askBody()?.textContent).toMatch(/Now: you are signed in here as 0xc3c3…c3c3, your own account/);
  expect(askBody()?.textContent).toMatch(
    /The link: it signs this tab in to a different account, one that an AI agent set up/,
  );
  expect(askBody()?.textContent).toMatch(/Switch only if your own agent gave you this link/);
  expect(screen.getByTestId('ce-agent-sign-in-ask-confirm').textContent).toBe('Switch to the agent’s account');
  expect(screen.getByTestId('ce-agent-sign-in-ask-cancel').textContent).toBe('Stay in my account');
  // It is a dialog that must be answered, and nothing of it sits in a banner.
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(notice()).toBeNull();
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();

  // Staying drops the code unused.
  fireEvent.click(screen.getByTestId('ce-agent-sign-in-ask-cancel'));
  expect(dropAgentSignInCode).toHaveBeenCalled();
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  expect(notice()).toBeNull();
  await waitFor(() => expect(askBody()).toBeNull());
});

it('switches only when the person says so', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest
    .mocked(exchangeHeldAgentSignInCode)
    .mockResolvedValue({ token: 't', exp: 1, address: ACCOUNT, via: 'agent_link', passkey: '', agentAccess: 'active' });
  jest.mocked(whoALinkWouldReplace).mockResolvedValue(OTHER);
  jest.mocked(liveAccount).mockReturnValue(OTHER);
  gate({ account: OTHER, provider: 'passkey_eoa' });
  fireEvent.click(await screen.findByTestId('ce-agent-sign-in-ask-confirm'));
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
  await waitFor(() => expect(askBody()?.textContent).toMatch(/you are signed in here as 0xc3c3…c3c3/));
  expect(exchangeHeldAgentSignInCode).not.toHaveBeenCalled();
  expect(resumeAgentLinkAccount).not.toHaveBeenCalled();
  // Staying opens the held account again, as a reload without the link would have.
  fireEvent.click(screen.getByTestId('ce-agent-sign-in-ask-cancel'));
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
  expect(askBody()?.textContent).toMatch(/you are signed in here as 0xc3c3…c3c3/);
  // The sign-in is in hand, so the dialog can name the account the link leads to.
  expect(askBody()?.textContent).toMatch(/a different account, 0xa1a1…a1a1, one that an AI agent set up/);
  expect(askBody()?.textContent).toMatch(/The link has now been used/);
  // Saying yes uses the sign-in already made: the code works once.
  fireEvent.click(screen.getByTestId('ce-agent-sign-in-ask-confirm'));
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalledWith(TARGET, REPLY));
  expect(exchangeHeldAgentSignInCode).toHaveBeenCalledTimes(1);
});

it('drops a held sign-in when the person stays, and enters the same account without asking', async () => {
  jest.mocked(hasAgentSignInCodeFor).mockReturnValue(true);
  jest.mocked(exchangeHeldAgentSignInCode).mockResolvedValue(REPLY);
  jest.mocked(liveAccount).mockReturnValue(OTHER);
  const { unmount } = gate();
  fireEvent.click(await screen.findByTestId('ce-agent-sign-in-ask-cancel'));
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

  // Whether links are on is the Worker's to say when the link is used, not this page's copy of the settings,
  // which may be from before an admin turned them on: the page asks, and a link for a session with them on works.
  jest.mocked(workerHasAgentSignIn).mockResolvedValue(true);
  jest
    .mocked(exchangeHeldAgentSignInCode)
    .mockResolvedValue({ token: 't', exp: 1, address: ACCOUNT, via: 'agent_link', passkey: '', agentAccess: 'active' });
  const staleGate = render(
    <AgentSignInGate sessionConfig={{ slug: 'salon' }} sessionSlug="salon" account="" provider="" />,
  );
  await waitFor(() => expect(enterAgentLinkAccount).toHaveBeenCalled());
  staleGate.unmount();
  jest.mocked(enterAgentLinkAccount).mockClear();
  // Where the Worker says they are not on, the page says so in its own words, and that the link is unused.
  jest.mocked(exchangeHeldAgentSignInCode).mockRejectedValue(
    Object.assign(new Error('This session doesn’t sign people in from an agent’s link.'), {
      reason: 'sign_in_links_off',
    }),
  );
  const offGate = gate();
  await waitFor(() => expect(notice()?.textContent).toMatch(/doesn’t have sign-in links from agents switched on/));
  expect(notice()?.textContent).toMatch(
    /The link has not been used: open it again once an organiser has turned them on/,
  );
  expect(enterAgentLinkAccount).not.toHaveBeenCalled();
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
  // Short: who the account is, and nothing more.
  expect(text).not.toMatch(/Whoever runs the agent|did not come from your own agent/);
  expect(notice()?.className).toMatch(/noticeLarge/);
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

it('says in the Worker’s words why a passkey that already took part here was not attached, and offers no second account', async () => {
  act(() => void held());
  jest
    .mocked(attachPasskeyHere)
    .mockRejectedValue(
      new Error(
        'That passkey already has its own account in this session, so it can’t be added to this one. Create a new passkey instead.',
      ),
    );
  gate({ account: ACCOUNT, provider: 'agent_link' });
  expect(screen.getByTestId('ce-agent-account-use-passkey').getAttribute('title')).toMatch(
    /has an account of its own and can’t be attached: create a new passkey/,
  );
  fireEvent.click(screen.getByTestId('ce-agent-account-use-passkey'));
  await waitFor(() => expect(attachPasskeyHere).toHaveBeenCalledWith({ useExisting: true }));
  await waitFor(() =>
    expect(notice()?.textContent).toMatch(/That passkey already has its own account in this session/),
  );
  expect(notice()?.textContent).toMatch(/Create a new passkey instead/);
  // The refusal is its own message, apart from the notice's standing words.
  const alert = screen.getByTestId('ce-agent-sign-in-alert');
  expect(alert.getAttribute('role')).toBe('alert');
  expect(alert.textContent).toBe(
    'That passkey already has its own account in this session, so it can’t be added to this one. Create a new passkey instead.',
  );
  expect(alert.closest('p')?.className).not.toBe(notice()?.querySelector('p')?.className);
  expect(notice()?.querySelector('p')?.textContent).not.toMatch(/already has its own account/);
  // Still signed in from the link, with the main way on offer.
  expect(screen.getByTestId('ce-agent-account-add-passkey').textContent).toBe('Create passkey');
  expect(screen.queryByTestId('ce-agent-account-own-account')).toBeNull();
  act(() => void held({ via: 'passkey_link', passkey: PASSKEY }));
  expect(screen.queryByTestId('ce-agent-account-own-account')).toBeNull();
});

it('makes Create passkey the main button, and says what is now so once, not twice', async () => {
  act(() => void held());
  jest.mocked(attachPasskeyHere).mockResolvedValue(null);
  gate({ account: ACCOUNT, provider: 'agent_link' });
  const create = screen.getByTestId('ce-agent-account-add-passkey');
  const existing = screen.getByTestId('ce-agent-account-use-passkey');
  const signOut = screen.getByTestId('ce-agent-account-sign-out');
  expect(create.className).toBe('primaryButton');
  expect([existing.className, signOut.className]).toEqual(['secondaryButton', 'secondaryButton']);
  // First in order too.
  expect(notice()?.querySelector('button')).toBe(create);
  // A step that worked changes what the notice says; it adds no second sentence saying the same.
  fireEvent.click(create);
  await waitFor(() => expect(attachPasskeyHere).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.queryByTestId('ce-agent-sign-in-alert')).toBeNull();
  expect(notice()?.textContent).not.toMatch(/Your passkey is attached to this account/);

  act(() => void held({ via: 'passkey_link', passkey: PASSKEY }));
  jest.mocked(changeAgentAccess).mockImplementation(async (access) => {
    act(() => void held({ via: 'passkey_link', passkey: PASSKEY, agentAccess: access }));
    return null;
  });
  fireEvent.click(screen.getByTestId('ce-agent-account-cancel'));
  await waitFor(() =>
    expect(notice()?.textContent).toMatch(
      /Agent access ended\. Your agent can no longer sign in to 0xa1a1…a1a1; only your passkey can/,
    ),
  );
  expect(notice()?.textContent?.match(/Agent access ended/g)).toHaveLength(1);
  expect(screen.getByTestId('ce-agent-account-allow').textContent).toBe('Restore agent access');
  // What goes wrong is still said, by itself.
  jest.mocked(changeAgentAccess).mockRejectedValue(new Error('The session did not make that change. Try again.'));
  fireEvent.click(screen.getByTestId('ce-agent-account-allow'));
  await waitFor(() =>
    expect(screen.getByTestId('ce-agent-sign-in-alert').textContent).toBe(
      'The session did not make that change. Try again.',
    ),
  );
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
  expect(notice()?.textContent).toMatch(
    /Agent access ended\. Your agent can no longer sign in to 0xa1a1…a1a1; only your passkey can/,
  );
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

it('opens the agent’s account for a passkey this browser attached, quietly, and for no other wallet', async () => {
  jest.mocked(isAttachedPasskeyKnown).mockReturnValue(true);
  const { unmount } = gate({ account: PASSKEY, provider: 'passkey_eoa' });
  await waitFor(() =>
    expect(enterThroughAttachedPasskey).toHaveBeenCalledWith(TARGET, PASSKEY, { prompt: false, passkeyToken: '' }),
  );
  unmount();
  jest.clearAllMocks();
  // Never for another kind of wallet, or a passkey nothing is known of.
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
  // There is no staying: a passkey attached here has no account of its own in this session to stay in.
  expect(screen.queryByTestId('ce-agent-offer-stay')).toBeNull();
  unmount();
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
  await waitFor(() =>
    expect(notice()?.textContent).toMatch(
      /Agent access ended\. Your agent can no longer sign in to 0xa1a1…a1a1; only your passkey can/,
    ),
  );
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
