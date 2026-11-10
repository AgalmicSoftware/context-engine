import { disconnect } from 'wagmi/actions';
import { markUserExplicitlyDisconnected } from '../web3/wagmiDisconnectState';
import { createLogger } from '../logging';
import store from '../../store';
import { changeAccount } from '../../actions/accountActions';
import { updateLoginInfo } from '../../actions/sessionStateActions';
import { clearAllWorkerSessionTokens } from '../worker/workerAuth';
import { logoutPasskeyWallet } from '../../wallet/passkeyWallet';
import { clearAllAgentClientLoginEnvelopes } from './agentClientLogin';

export const CLIENT_AUTH_LOGOUT_EVENT = 'ce-client-auth-logout';

const accountLog = createLogger('account');

export const logoutClientAuth = async ({
  disconnectWallet = disconnect,
}: { disconnectWallet?: () => void | Promise<void> } = {}): Promise<void> => {
  // Mark before any reset or asynchronous disconnect: a still-connected bridge
  // must not rehydrate the account while the wallet finishes disconnecting.
  markUserExplicitlyDisconnected();
  let walletDisconnected = Promise.resolve();
  try {
    walletDisconnected = Promise.resolve(disconnectWallet()).catch((error) => {
      accountLog.error('wagmiDisconnect failed:', error);
    });
  } catch (error) {
    accountLog.error('wagmiDisconnect failed:', error);
  }
  clearAllWorkerSessionTokens();
  clearAllAgentClientLoginEnvelopes();
  // The wallet's disconnect invalidates pending signer operations synchronously,
  // while its queued storage write finishes after mounted consumers are reset.
  let disconnected: Promise<void>;
  try {
    disconnected = logoutPasskeyWallet();
  } finally {
    updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null })(store.dispatch);
    changeAccount({})(store.dispatch);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLIENT_AUTH_LOGOUT_EVENT));
  }
  await Promise.all([walletDisconnected, disconnected]);
};
