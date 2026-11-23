import React from 'react';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import { act, render, screen, waitFor } from '@testing-library/react';

import rootReducer from '../../reducers/index.js';
import { LOGIN_ACCOUNT, LOGIN_IN_PROGRESS, TOGGLE_LOGIN_MODAL } from '../../actions/types';
import AccountSection from './AccountSection';
import { forgetAgentLinkAccount, holdAgentLinkAccount } from '../../utilities/session/agentLinkAccount';
import { askForLoginFile } from '../../utilities/session/loginFileDue';

const PASSKEY_ADDRESS = '0x00000000000000000000000000000000000000aa';
const WALLET_ADDRESS = '0x00000000000000000000000000000000000000bb';
const mockRestorePasskeyWalletSession = jest.fn();
const mockLoginModalLoaded = jest.fn();

jest.mock('../../wallet/passkeyWallet.js', () => ({
  getPasskeyWalletChain: () => ({ id: 11155420, name: 'OP Sepolia' }),
  restorePasskeyWalletSession: (options: unknown) => mockRestorePasskeyWalletSession(options),
}));

const mockDueModal = jest.fn();
jest.mock('../Account/LoginFileDueModal', () => ({
  __esModule: true,
  default: (props: { account: string; onSignedIn: () => void; onClose: () => void }) => {
    mockDueModal(props.account);
    return (
      <div data-testid="login-file-due">
        <button type="button" onClick={props.onSignedIn}>
          file chosen
        </button>
        <button type="button" onClick={props.onClose}>
          close
        </button>
      </div>
    );
  },
}));

jest.mock('../Account/LoginAndSettingsModal', () => {
  mockLoginModalLoaded();
  return { __esModule: true, default: () => <div data-testid="login-modal" /> };
});

jest.mock('./AccountDisplay', () => ({
  AccountDisplayTorus: () => <div data-testid="account-display" />,
}));

jest.mock('components/Account/LoginButton', () => () => <button type="button">Log in</button>);

jest.mock('utilities/ui/blockieAvatars.js', () => ({
  generateBlockieDataUrl: () => '',
}));

const deferredRestore = () => {
  let resolve: (address: string | null) => void = () => undefined;
  mockRestorePasskeyWalletSession.mockImplementationOnce(
    () =>
      new Promise<string | null>((resolvePromise) => {
        resolve = resolvePromise;
      }),
  );
  return (address: string | null) => resolve(address);
};

const renderAccountSection = () => {
  const store = createStore(rootReducer, applyMiddleware(thunk));
  const view = render(
    <Provider store={store}>
      <AccountSection />
    </Provider>,
  );
  return { store, view };
};

describe('AccountSection passkey restore at app start', () => {
  beforeEach(() => {
    mockRestorePasskeyWalletSession.mockReset();
    mockLoginModalLoaded.mockClear();
  });

  it('restores a saved passkey account while the lazy login modal stays closed', async () => {
    mockRestorePasskeyWalletSession.mockResolvedValue(PASSKEY_ADDRESS);
    const { store } = renderAccountSection();

    expect(await screen.findByTestId('account-display')).toBeInTheDocument();
    expect(mockRestorePasskeyWalletSession).toHaveBeenCalledWith({ requireSigner: false });
    expect(store.getState().profile).toMatchObject({
      account: PASSKEY_ADDRESS,
      provider: 'passkey_eoa',
      network: expect.objectContaining({ chainId: 11155420, name: 'OP Sepolia (Passkey)' }),
    });
    expect(store.getState().sessionState).toMatchObject({
      loginComplete: true,
      loginInProgress: false,
      loginModalToggled: false,
    });
    expect(mockLoginModalLoaded).not.toHaveBeenCalled();
  });

  it('leaves a reload of the session this tab holds an agent’s account for to that account', async () => {
    mockRestorePasskeyWalletSession.mockResolvedValue(PASSKEY_ADDRESS);
    const held = {
      address: WALLET_ADDRESS,
      workerUrl: 'https://ce-salon.example.workers.dev',
      sessionSlug: 'salon',
      sessionId: `0x${'3'.repeat(32)}`,
      via: 'agent_link',
      passkey: '',
      agentAccess: 'active',
    };
    act(() => void holdAgentLinkAccount(held));
    window.history.replaceState({}, '', '/session/salon');
    const first = renderAccountSection();
    await act(async () => undefined);
    expect(mockRestorePasskeyWalletSession).not.toHaveBeenCalled();
    expect(first.store.getState().profile.account).toBe('');
    first.view.unmount();

    // Any other page restores the saved passkey as before.
    window.history.replaceState({}, '', '/session/another');
    const second = renderAccountSection();
    await waitFor(() => expect(second.store.getState().profile.account).toBe(PASSKEY_ADDRESS));
    second.view.unmount();
    act(() => forgetAgentLinkAccount());
    window.history.replaceState({}, '', '/');
  });

  it('stays logged out when no passkey account is saved', async () => {
    mockRestorePasskeyWalletSession.mockResolvedValue(null);
    const { store } = renderAccountSection();

    await waitFor(() => expect(mockRestorePasskeyWalletSession).toHaveBeenCalledTimes(1));
    await act(async () => undefined);

    expect(store.getState().sessionState.loginComplete).toBe(false);
    expect(store.getState().profile.account).toBe('');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('does not overwrite a wallet login that finishes while the saved account loads', async () => {
    const resolveRestore = deferredRestore();
    const { store } = renderAccountSection();
    await waitFor(() => expect(mockRestorePasskeyWalletSession).toHaveBeenCalledTimes(1));

    act(() => {
      store.dispatch({ type: LOGIN_ACCOUNT, payload: { account: WALLET_ADDRESS, provider: 'wagmi' } });
      store.dispatch({ type: LOGIN_IN_PROGRESS, payload: { loginInProgress: false, loginComplete: true } });
    });
    await act(async () => resolveRestore(PASSKEY_ADDRESS));

    expect(store.getState().profile).toMatchObject({ account: WALLET_ADDRESS, provider: 'wagmi' });
  });

  it('leaves the restore to the login modal once it opens', async () => {
    const resolveRestore = deferredRestore();
    const { store } = renderAccountSection();
    await waitFor(() => expect(mockRestorePasskeyWalletSession).toHaveBeenCalledTimes(1));

    act(() => {
      store.dispatch({ type: TOGGLE_LOGIN_MODAL, payload: true });
    });
    act(() => {
      store.dispatch({ type: TOGGLE_LOGIN_MODAL, payload: false });
    });
    await act(async () => resolveRestore(PASSKEY_ADDRESS));

    expect(store.getState().profile.account).toBe('');
    expect(store.getState().sessionState.loginComplete).toBe(false);
  });

  it('drops a restore that resolves after the navbar unmounts', async () => {
    const resolveRestore = deferredRestore();
    const { store, view } = renderAccountSection();
    await waitFor(() => expect(mockRestorePasskeyWalletSession).toHaveBeenCalledTimes(1));

    view.unmount();
    await act(async () => resolveRestore(PASSKEY_ADDRESS));

    expect(store.getState().profile.account).toBe('');
    expect(store.getState().sessionState.loginComplete).toBe(false);
  });
});

describe('AccountSection when a Submit finds the login file due again', () => {
  beforeEach(() => {
    mockRestorePasskeyWalletSession.mockReset();
    mockDueModal.mockClear();
  });

  const signedIn = async () => {
    mockRestorePasskeyWalletSession.mockResolvedValue(PASSKEY_ADDRESS);
    const rendered = renderAccountSection();
    await screen.findByTestId('account-display');
    return rendered;
  };
  // Asks as a Submit does, and notes the answer when it comes.
  const ask = () => {
    const heard: { answer: boolean | null } = { answer: null };
    act(() => {
      void askForLoginFile().then((answer) => {
        heard.answer = answer;
      });
    });
    return heard;
  };

  it('opens the window for the account the page shows, and answers the Submit once the file is back', async () => {
    await signedIn();
    expect(screen.queryByTestId('login-file-due')).not.toBeInTheDocument();
    const heard = ask();
    expect(await screen.findByTestId('login-file-due')).toBeInTheDocument();
    expect(mockDueModal).toHaveBeenLastCalledWith(PASSKEY_ADDRESS);
    expect(heard.answer).toBeNull();

    await act(async () => screen.getByRole('button', { name: 'file chosen' }).click());
    expect(heard.answer).toBe(true);
    expect(screen.queryByTestId('login-file-due')).not.toBeInTheDocument();
  });

  it('answers no when the window is closed', async () => {
    await signedIn();
    const heard = ask();
    await screen.findByTestId('login-file-due');
    await act(async () => screen.getByRole('button', { name: 'close' }).click());
    expect(screen.queryByTestId('login-file-due')).not.toBeInTheDocument();
    expect(heard.answer).toBe(false);
  });

  it('ends the window, answering no, when the person signs out while it is open', async () => {
    const { store } = await signedIn();
    const heard = ask();
    await screen.findByTestId('login-file-due');
    await act(async () => {
      store.dispatch({
        type: LOGIN_IN_PROGRESS,
        payload: { loginComplete: false, loginInProgress: false, provider: null },
      });
    });
    expect(screen.queryByTestId('login-file-due')).not.toBeInTheDocument();
    expect(heard.answer).toBe(false);
    // Signed in again later, nothing of it comes back.
    await act(async () => {
      store.dispatch({
        type: LOGIN_IN_PROGRESS,
        payload: { loginComplete: true, loginInProgress: false, provider: 'passkey_eoa' },
      });
    });
    expect(screen.queryByTestId('login-file-due')).not.toBeInTheDocument();
  });

  it('answers the earlier Submit no when a later one asks', async () => {
    await signedIn();
    const first = ask();
    await screen.findByTestId('login-file-due');
    const second = ask();
    await act(async () => undefined);
    expect(first.answer).toBe(false);
    expect(second.answer).toBeNull();
    await act(async () => screen.getByRole('button', { name: 'file chosen' }).click());
    expect(second.answer).toBe(true);
  });

  it('takes no request on a page that shows no account, so the Submit fails at once as before', async () => {
    mockRestorePasskeyWalletSession.mockResolvedValue(null);
    renderAccountSection();
    await act(async () => undefined);
    const heard = ask();
    await act(async () => undefined);
    expect(heard.answer).toBe(false);
    expect(screen.queryByTestId('login-file-due')).not.toBeInTheDocument();
  });
});
