import store from '../../store';
import { changeAccount } from '../../actions/accountActions';
import { updateLoginInfo } from '../../actions/sessionStateActions';
import { clearAllWorkerSessionTokens } from '../worker/workerAuth';
import { logoutPasskeyWallet } from '../../wallet/passkeyWallet';
import { clearAllAgentClientLoginEnvelopes } from './agentClientLogin';

export const CLIENT_AUTH_LOGOUT_EVENT = 'ce-client-auth-logout';

export const logoutClientAuth = async (): Promise<void> => {
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
  await disconnected;
};
