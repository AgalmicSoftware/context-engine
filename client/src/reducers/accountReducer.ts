import { FETCH_ACCOUNT, LOGIN_ACCOUNT, CHANGE_NETWORK } from '../actions/types';

export type AccountState = {
  account: string;
  provider: string;
  network: unknown;
  alerts: unknown[];
  userImageURL: string | null;
};
type AccountPayload = {
  account?: string;
  provider?: string;
  network?: unknown;
  userImageURL?: string | null;
};
type ChangeNetworkPayload = Pick<AccountPayload, 'network'>;
type AccountReducerAction =
  | { type: typeof LOGIN_ACCOUNT; payload?: AccountPayload }
  | { type: typeof FETCH_ACCOUNT; payload?: AccountPayload }
  | { type: typeof CHANGE_NETWORK; payload?: ChangeNetworkPayload }
  | { type?: string; payload?: unknown };

const initialState: AccountState = {
  account: '',          // ETH address connected to site
  provider: 'none',     // 'none' | 'wagmi' | 'web3auth' | 'passkey_eoa'
  network: null,
  alerts: [],
  userImageURL: null,
};

const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isEmptyObject = (value: unknown): boolean =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
const ACCOUNT_PAYLOAD_FIELDS: Array<keyof AccountPayload> = ['account', 'provider', 'network', 'userImageURL'];

const mergeAccountPayload = (state: AccountState, payload: unknown): AccountState => {
  if (!isRecord(payload)) return state;
  const nextState = { ...state };
  ACCOUNT_PAYLOAD_FIELDS.forEach((key) => {
    if (hasOwn(payload, key)) {
      (nextState as Record<keyof AccountPayload, unknown>)[key] = payload[key];
    }
  });
  return nextState as AccountState;
};

export default function accountReducer(state: AccountState = initialState, action: AccountReducerAction): AccountState {
  switch (action.type) {
    case LOGIN_ACCOUNT:
      if (isEmptyObject(action.payload)) {
        return { ...initialState };
      }
      if (
        isRecord(action.payload) &&
        hasOwn(action.payload, 'account') &&
        String(action.payload.account).toLowerCase() !== String(state.account).toLowerCase()
      ) {
        return mergeAccountPayload(initialState, action.payload);
      }
      return mergeAccountPayload(state, action.payload);
    case FETCH_ACCOUNT:
      return mergeAccountPayload(state, action.payload);
    case CHANGE_NETWORK:
      if (!isRecord(action.payload) || !hasOwn(action.payload, 'network')) {
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
