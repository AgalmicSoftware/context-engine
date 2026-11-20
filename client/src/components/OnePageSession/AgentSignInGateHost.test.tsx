import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import {
  forgetAgentLinkAccount,
  forgetAgentLinkHints,
  holdAgentLinkAccount,
  noteAttachedPasskey,
  noteBrowserAttachedAPasskey,
  noteLinkedAgentAccount,
} from '../../utilities/session/agentLinkAccount';
import { dropAgentSignInCode, removeAgentSignInCodeFromAddress } from '../../utilities/session/agentSignIn';
import AgentSignInGateHost from './AgentSignInGateHost';

// The notice's file: this records the moment the page asks for it.
const mockGateRequested = jest.fn();
jest.mock('./AgentSignInGate', () => {
  mockGateRequested();
  return { __esModule: true, default: () => <div data-testid="the-notice" /> };
});
jest.mock('../../utilities/worker/workerCapabilities', () => ({ readWorkerCapabilities: jest.fn() }));

const WORKER = 'https://ce-salon.example.workers.dev';
const ACCOUNT = `0x${'a1'.repeat(20)}`;
const PASSKEY = `0x${'b2'.repeat(20)}`;
const target = { workerUrl: WORKER, sessionSlug: 'salon', sessionId: `0x${'3'.repeat(32)}` };
const host = (provider: unknown = '', account: unknown = '') =>
  render(
    <AgentSignInGateHost sessionConfig={{ slug: 'salon' }} sessionSlug="salon" account={account} provider={provider} />,
  );
const shown = () => waitFor(() => expect(screen.getByTestId('the-notice')).toBeTruthy());

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  act(() => forgetAgentLinkAccount());
  act(() => forgetAgentLinkHints());
  dropAgentSignInCode();
  window.history.replaceState({}, '', '/session/salon');
});

// First, while nothing has asked for the file yet in this test run.
it('never asks for the notice’s file on an ordinary page load, signed out or signed in', async () => {
  const signedOut = host();
  await act(async () => {});
  signedOut.unmount();
  for (const provider of ['passkey_eoa', 'wagmi']) {
    const signedIn = host(provider, PASSKEY);
    await act(async () => {});
    expect(screen.queryByTestId('the-notice')).toBeNull();
    signedIn.unmount();
  }
  expect(mockGateRequested).not.toHaveBeenCalled();
});

it('asks for it when a link’s sign-in code was taken from the address, at start-up or later', async () => {
  window.history.replaceState(
    {},
    '',
    `/session/salon?worker=${encodeURIComponent(WORKER)}#agentSignIn=cesi_${'A'.repeat(43)}`,
  );
  removeAgentSignInCodeFromAddress();
  const atStart = host();
  await shown();
  expect(mockGateRequested).toHaveBeenCalledTimes(1);
  atStart.unmount();
  dropAgentSignInCode();

  // A link pasted into a tab that is already open.
  host();
  await act(async () => {});
  expect(screen.queryByTestId('the-notice')).toBeNull();
  window.history.replaceState(
    {},
    '',
    `/session/salon?worker=${encodeURIComponent(WORKER)}#agentSignIn=cesi_${'B'.repeat(43)}`,
  );
  act(() => removeAgentSignInCodeFromAddress());
  await shown();
});

it('asks for it when the tab is in an agent’s account, or holds one from before a reload', async () => {
  const inAccount = host('agent_link', ACCOUNT);
  await shown();
  inAccount.unmount();
  host();
  await act(async () => {});
  expect(screen.queryByTestId('the-notice')).toBeNull();
  act(
    () =>
      void holdAgentLinkAccount({ address: ACCOUNT, ...target, via: 'agent_link', passkey: '', agentAccess: 'active' }),
  );
  await shown();
  // It stays once shown, whatever the tab becomes: the notice decides what to say.
  act(() => forgetAgentLinkAccount());
  expect(screen.getByTestId('the-notice')).toBeTruthy();
});

it('asks for it when a sign-in says a passkey is attached to an account, or is one attached to an agent’s account', async () => {
  const first = host('passkey_eoa', PASSKEY);
  await act(async () => {});
  expect(screen.queryByTestId('the-notice')).toBeNull();
  act(() =>
    noteLinkedAgentAccount({ ...target, passkey: PASSKEY, linked: { address: ACCOUNT }, token: 'passkey-sign-in' }),
  );
  await shown();
  first.unmount();
  act(() => forgetAgentLinkHints());
  host('wagmi', ACCOUNT);
  await act(async () => {});
  expect(screen.queryByTestId('the-notice')).toBeNull();
  act(() => noteAttachedPasskey({ ...target, account: ACCOUNT, attached: { address: PASSKEY } }));
  await shown();
});

// Last: a browser that has attached a passkey stays one for the page's life.
it('asks for it in a browser that has attached a passkey to an agent’s account before', async () => {
  host('passkey_eoa', PASSKEY);
  await act(async () => {});
  expect(screen.queryByTestId('the-notice')).toBeNull();
  act(() => noteBrowserAttachedAPasskey());
  await shown();
});
