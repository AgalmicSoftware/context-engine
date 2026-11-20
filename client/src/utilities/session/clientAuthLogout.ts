import { forgetAgentLinkAccount } from './agentLinkAccount';
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

/**
 * Unsent answers are kept per account (see buildSurveyDraftStorageKey:
 * dg:surveyDraft:<session>:<network>:<account>:<scope>), so another account never
 * sees them. Only a deliberate log-out removes them, for every session; a wallet
 * that locks or disconnects must never cost the person their answers.
 */
export const clearSurveyDraftsForAccount = (account: unknown): void => {
  const owner = String(account || '')
    .trim()
    .toLowerCase();
  if (!owner || owner === 'anon' || typeof sessionStorage === 'undefined') return;
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('dg:surveyDraft:') && key.split(':')[4] === owner)
      .forEach((key) => sessionStorage.removeItem(key));
  } catch (_) {
    // Storage can be unavailable; there is then nothing stored to clear.
  }
};

export const logoutClientAuth = async ({
  disconnectWallet = disconnect,
}: { disconnectWallet?: () => void | Promise<void> } = {}): Promise<void> => {
  // Mark before any reset or asynchronous disconnect: a still-connected bridge
  // must not rehydrate the account while the wallet finishes disconnecting.
  markUserExplicitlyDisconnected();
  clearSurveyDraftsForAccount(store.getState().profile?.account);
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
  // Signed in to an agent's account from its link: signing out forgets which account that was.
  forgetAgentLinkAccount();
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
