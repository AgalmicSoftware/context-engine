import { FETCH_ACCOUNT, LOGIN_ACCOUNT } from './types';
import store from '../store.js';
import { createLogger } from '../utilities/logging.js';

const accountLog = createLogger('account');

type AccountSnapshot = {
  account?: unknown;
  provider?: unknown;
  network?: unknown;
  userImageURL?: unknown;
};

type RootStateSnapshot = {
  profile?: AccountSnapshot;
};

type AccountAction = {
  type: string;
  payload?: AccountSnapshot;
};

type AccountDispatch = (action: AccountAction) => void;
type AccountThunk = (dispatch: AccountDispatch) => void;

const getCurrentProfile = (): AccountSnapshot => (store.getState() as RootStateSnapshot).profile || {};

export const fetchAccount = (): AccountThunk => (dispatch) => {
  const profile = getCurrentProfile();

  const web3info = {
    account: profile.account,
    provider: profile.provider,
    network: profile.network,
    userImageURL: profile.userImageURL,
  };

  dispatch({
    type: FETCH_ACCOUNT,
    payload: web3info,
  });
};

export const changeAccount =
  (web3info: AccountSnapshot): AccountThunk =>
  (dispatch) => {
    accountLog.log('account changed to ' + web3info.account + ' provided by ' + web3info.provider);

    dispatch({
      type: LOGIN_ACCOUNT,
      payload: web3info,
    });
  };
