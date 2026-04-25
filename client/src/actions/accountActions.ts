import { FETCH_ACCOUNT, LOGIN_ACCOUNT } from './types';
import store from '../store.js';
import { createLogger } from '../utilities/logging.js';

const accountLog = createLogger('account');


export const fetchAccount = () => (dispatch: any) => {
  const profile = (store.getState() as any).profile || {};

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

export const changeAccount = (web3info: any) => (dispatch: any) => {
  accountLog.log('account changed to ' + web3info.account + ' provided by ' + web3info.provider);

  dispatch({
    type: LOGIN_ACCOUNT,
    payload: web3info,
  });
};
