import React from 'react';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import thunk from 'redux-thunk';
import { act, render, screen, waitFor } from '@testing-library/react';

import rootReducer from '../../reducers/index.js';
import { LOGIN_ACCOUNT, LOGIN_IN_PROGRESS, TOGGLE_LOGIN_MODAL } from '../../actions/types';
import AccountSection from './AccountSection';

const PASSKEY_ADDRESS = '0x00000000000000000000000000000000000000aa';
const WALLET_ADDRESS = '0x00000000000000000000000000000000000000bb';
const mockRestorePasskeyWalletSession = jest.fn();
const mockLoginModalLoaded = jest.fn();

jest.mock('../../wallet/passkeyWallet.js', () => ({
  getPasskeyWalletChain: () => ({ id: 11155420, name: 'OP Sepolia' }),
  restorePasskeyWalletSession: (options: unknown) => mockRestorePasskeyWalletSession(options),
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
