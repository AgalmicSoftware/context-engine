// What the page does with an agent's account, against the real held-account module and a small store: who a
// link's sign-in would replace, that the tab holds one account at a time, and what is left behind when a step fails.
import store from '../../store';
import * as passkeyWallet from '../../wallet/passkeyWallet';
import { heldSessionToken } from '../worker/workerAuthTokenCache.js';
import { forgetAgentLinkAccount, holdAgentLinkAccount, readAgentLinkAccount } from './agentLinkAccount';
import { attachPasskeyToAgentAccount, setAgentAccess } from './agentSignIn';
import {
  attachPasskeyHere,
  changeAgentAccess,
  enterThroughAttachedPasskey,
  liveAccount,
  switchToOwnPasskeyAccount,
  whoALinkWouldReplace,
} from './agentSignInAccount';
import { logoutClientAuth } from './clientAuthLogout';

jest.mock('../../store', () => {
  let state = { profile: { account: '', provider: '' } };
  const listeners = new Set<() => void>();
  return {
    __esModule: true,
    default: {
      getState: () => state,
      dispatch: (action: { type: string; payload?: { account?: string; provider?: string } }) => {
        if (action.type === 'account') state = { profile: { account: '', provider: '', ...action.payload } };
        listeners.forEach((listener) => listener());
        return action;
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
});
jest.mock('../../actions/accountActions.js', () => ({
  changeAccount: (payload: { account?: string; provider?: string }) => (dispatch: (action: unknown) => unknown) =>
    dispatch({ type: 'account', payload: { account: payload.account || '', provider: payload.provider || '' } }),
}));
jest.mock('../../actions/sessionStateActions.js', () => ({
  updateLoginInfo: () => (dispatch: (action: unknown) => unknown) => dispatch({ type: 'login-info' }),
}));
jest.mock('../../wallet/passkeyWallet', () => {
  const client = { getAddress: jest.fn(() => null), isUnlocked: jest.fn(() => false), signMessage: jest.fn() };
  return {
    createPasskeyWallet: jest.fn(),
    unlockPasskeyWallet: jest.fn(),
    restorePasskeyWalletSession: jest.fn(async () => null),
    logoutPasskeyWallet: jest.fn(async () => undefined),
    getPasskeyWalletClient: () => client,
  };
});
jest.mock('../worker/workerAuth.js', () => ({ buildSiweMessage: jest.fn(() => 'a sign-in message') }));
jest.mock('../worker/workerAuthTokenCache.js', () => ({
  buildTokenCacheEnvelope: jest.fn((value: unknown) => value),
  buildTokenCacheKey: jest.fn(() => 'key'),
  heldSessionToken: jest.fn(() => 'held-sign-in'),
  writeTokenCache: jest.fn(),
}));
jest.mock('./agentSignIn', () => ({
  ...jest.requireActual('./agentSignIn'),
  attachPasskeyToAgentAccount: jest.fn(),
  detachAgentPasskey: jest.fn(async () => undefined),
  setAgentAccess: jest.fn(),
  signInThroughAttachedPasskey: jest.fn(),
}));
jest.mock('./clientAuthLogout', () => ({ logoutClientAuth: jest.fn(async () => undefined) }));

const ACCOUNT = `0x${'a1'.repeat(20)}`;
const PASSKEY = `0x${'b2'.repeat(20)}`;
const OTHER = `0x${'c3'.repeat(20)}`;
const TARGET = {
  workerUrl: 'https://ce-salon.example.workers.dev',
  sessionSlug: 'salon',
  sessionId: `0x${'3'.repeat(32)}`,
};
const hold = (extra: Record<string, unknown> = {}) =>
  holdAgentLinkAccount({
    address: ACCOUNT,
    ...TARGET,
    via: 'agent_link',
    passkey: '',
    agentAccess: 'active',
    ...extra,
  });
const signInAs = (account: string, provider: string) =>
  store.dispatch({ type: 'account', payload: { account, provider } } as never);
const client = passkeyWallet.getPasskeyWalletClient() as unknown as {
  getAddress: jest.Mock;
  isUnlocked: jest.Mock;
  signMessage: jest.Mock;
};
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  forgetAgentLinkAccount();
  signInAs('', '');
  jest.mocked(heldSessionToken).mockReturnValue('held-sign-in');
  jest.mocked(passkeyWallet.restorePasskeyWalletSession).mockResolvedValue(null);
  client.getAddress.mockReturnValue(null);
  client.isUnlocked.mockReturnValue(false);
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
});

describe('who a link’s sign-in would replace', () => {
  it('is nobody in a fresh tab, and the saved passkey where this browser would sign one back in', async () => {
    expect(await whoALinkWouldReplace()).toBe('');
    jest.mocked(passkeyWallet.restorePasskeyWalletSession).mockResolvedValue(PASSKEY.toUpperCase() as never);
    expect(await whoALinkWouldReplace()).toBe(PASSKEY);
    expect(passkeyWallet.restorePasskeyWalletSession).toHaveBeenLastCalledWith({ requireSigner: false });
    jest.mocked(passkeyWallet.restorePasskeyWalletSession).mockRejectedValue(new Error('no storage'));
    expect(await whoALinkWouldReplace()).toBe('');
  });

  it('is whoever is signed in at that moment, read from the page’s state and not from an earlier look', async () => {
    const asked = whoALinkWouldReplace();
    expect(await asked).toBe('');
    signInAs(OTHER, 'wagmi');
    expect(liveAccount()).toBe(OTHER);
    expect(await whoALinkWouldReplace()).toBe(OTHER);
  });

  it('is an agent’s account the tab still holds a sign-in for, though a reload has not opened it yet', async () => {
    hold();
    expect(liveAccount()).toBe('');
    expect(await whoALinkWouldReplace()).toBe(ACCOUNT);
  });

  it('is nobody when the held agent’s account has no sign-in left: its person came back for a new link', async () => {
    hold();
    jest.mocked(heldSessionToken).mockReturnValue('');
    expect(await whoALinkWouldReplace()).toBe('');
    // Also once the page shows that ended account.
    signInAs(ACCOUNT, 'agent_link');
    expect(await whoALinkWouldReplace()).toBe('');
    // The same address under its own key is somebody.
    forgetAgentLinkAccount();
    signInAs(ACCOUNT, 'passkey_eoa');
    expect(await whoALinkWouldReplace()).toBe(ACCOUNT);
  });
});

describe('the one account a tab holds', () => {
  it('forgets the agent’s account once the tab is anyone else, and keeps it while it is that account or nobody', () => {
    hold();
    signInAs('', '');
    expect(readAgentLinkAccount()?.address).toBe(ACCOUNT);
    signInAs(ACCOUNT, 'agent_link');
    expect(readAgentLinkAccount()?.address).toBe(ACCOUNT);
    // A wallet connects, or a passkey signs in: the held account does not linger to come back later.
    signInAs(OTHER, 'wagmi');
    expect(readAgentLinkAccount()).toBeNull();
    expect(window.sessionStorage.getItem('ce:agentLinkAccount:v1')).toBeNull();
    hold();
    signInAs(ACCOUNT, 'passkey_eoa');
    expect(readAgentLinkAccount()).toBeNull();
  });

  it('goes back to the address this browser’s passkey holds, never one a Worker named', async () => {
    hold({ via: 'passkey_link', passkey: OTHER });
    signInAs(ACCOUNT, 'agent_link');
    client.getAddress.mockReturnValue(PASSKEY);
    await switchToOwnPasskeyAccount(TARGET);
    expect(store.getState().profile).toMatchObject({ account: PASSKEY, provider: 'passkey_eoa' });
    expect(readAgentLinkAccount()).toBeNull();
    expect(logoutClientAuth).not.toHaveBeenCalled();
  });

  it('signs out where this browser holds no passkey to go back to', async () => {
    hold({ via: 'passkey_link', passkey: OTHER });
    signInAs(ACCOUNT, 'agent_link');
    await switchToOwnPasskeyAccount(TARGET);
    expect(logoutClientAuth).toHaveBeenCalledTimes(1);
    expect(store.getState().profile.account).not.toBe(OTHER);
  });
});

describe('what a failed step leaves behind', () => {
  it('does not leave a passkey made for the account as this browser’s saved sign-in when the Worker refuses it', async () => {
    hold();
    signInAs(ACCOUNT, 'agent_link');
    jest.mocked(passkeyWallet.createPasskeyWallet).mockResolvedValue(PASSKEY as never);
    jest.mocked(attachPasskeyToAgentAccount).mockRejectedValue(new Error('Refused.'));
    await expect(attachPasskeyHere({ useExisting: false })).rejects.toThrow('Refused.');
    expect(passkeyWallet.logoutPasskeyWallet).toHaveBeenCalledTimes(1);
    expect(readAgentLinkAccount()).toMatchObject({ address: ACCOUNT, via: 'agent_link' });
    // A passkey the person already had is theirs, and is left as it was.
    jest.mocked(passkeyWallet.unlockPasskeyWallet).mockResolvedValue(PASSKEY as never);
    await expect(attachPasskeyHere({ useExisting: true })).rejects.toThrow('Refused.');
    expect(passkeyWallet.unlockPasskeyWallet).toHaveBeenCalledWith({ selectCredential: true });
    expect(passkeyWallet.logoutPasskeyWallet).toHaveBeenCalledTimes(1);
  });

  it('does not report the agent’s access as changed when the Worker’s answer leaves it as it was', async () => {
    hold({ via: 'passkey_link', passkey: PASSKEY });
    jest.mocked(setAgentAccess).mockResolvedValue('active');
    await expect(changeAgentAccess('cancelled')).rejects.toMatchObject({ reason: 'unchanged' });
    expect(readAgentLinkAccount()?.agentAccess).toBe('active');
    jest.mocked(setAgentAccess).mockResolvedValue('cancelled');
    await expect(changeAgentAccess('cancelled')).resolves.toMatchObject({ agentAccess: 'cancelled' });
  });

  it('has the passkey sign nothing when the Worker’s nonce could add a line to the message', async () => {
    client.getAddress.mockReturnValue(PASSKEY);
    client.isUnlocked.mockReturnValue(true);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nonce: 'abc12345\nURI: https://evil.example' }),
    });
    await expect(enterThroughAttachedPasskey(TARGET, PASSKEY, { prompt: false })).rejects.toMatchObject({
      reason: 'unreadable',
    });
    expect(client.signMessage).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
