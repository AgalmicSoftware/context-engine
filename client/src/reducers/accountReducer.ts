import { FETCH_ACCOUNT, LOGIN_ACCOUNT, CHANGE_NETWORK } from '../actions/types';

export type AccountState = {
  account: string;
  provider: string;
  network: any;
  alerts: any[];
  userImageURL: string | null;
};
type ReducerAction = { type?: string; payload?: any };

const initialState = {
  account: '',          // ETH address connected to site
  provider: 'none',     // 'none' | 'wagmi' | 'web3auth' | 'porto_passkey'
  network: null,
  alerts: [],
  userImageURL: null,
};

const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const isEmptyObject = (value: unknown): boolean => (
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === 0
);
const ACCOUNT_PAYLOAD_FIELDS = [
  'account',
  'provider',
  'network',
  'userImageURL',
];

const mergeAccountPayload = (state: AccountState, payload: any): AccountState => {
  if (!payload || typeof payload !== 'object') return state;
  const nextState: Record<string, any> = { ...state };
  ACCOUNT_PAYLOAD_FIELDS.forEach((key) => {
    if (hasOwn(payload, key)) nextState[key] = payload[key];
  });
  return nextState as AccountState;
};

export default function accountReducer(state: AccountState = initialState, action: ReducerAction): AccountState {
  switch (action.type) {
    case LOGIN_ACCOUNT:
      if (isEmptyObject(action.payload)) {
        return { ...initialState };
      }
      if (
        action.payload &&
        typeof action.payload === 'object' &&
        hasOwn(action.payload, 'account') &&
        String(action.payload.account).toLowerCase() !== String(state.account).toLowerCase()
      ) {
        return mergeAccountPayload(initialState, action.payload);
      }
      return mergeAccountPayload(state, action.payload);
    case FETCH_ACCOUNT:
      return mergeAccountPayload(state, action.payload);
    case CHANGE_NETWORK:
      if (!action.payload || typeof action.payload !== 'object' || !hasOwn(action.payload, 'network')) {
        return state;
      }
      return {
        ...state,
        network: action.payload.network,
      };

    default:
      return state;
  }
}
