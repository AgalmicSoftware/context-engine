import {
  changeAccount,
  fetchAccount,
} from './accountActions.js';
import {
  FETCH_ACCOUNT,
  LOGIN_ACCOUNT,
} from './types.js';
import store from '../store.js';

jest.mock('../store.js', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
  },
}));

jest.mock('../utilities/logging.js', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
  })),
}));

type DispatchableAction = {
  type: string;
  payload?: unknown;
};

type MockStore = {
  getState: jest.MockedFunction<() => unknown>;
};

const mockStore = store as unknown as MockStore;
const createDispatch = () => jest.fn<void, [DispatchableAction]>();

describe('accountActions', () => {
  beforeEach(() => {
    mockStore.getState.mockReset();
  });

  it('fetches the current profile slice and dispatches the existing payload shape', () => {
    const dispatch = createDispatch();
    mockStore.getState.mockReturnValue({
      profile: {
        account: '0xabc',
        provider: 'wagmi',
        network: { chainId: 84532, name: 'Base Sepolia' },
        userImageURL: 'https://example.com/user.png',
        ignoredField: 'not-dispatched',
      },
    });

    fetchAccount()(dispatch);

    expect(dispatch).toHaveBeenCalledWith({
      type: FETCH_ACCOUNT,
      payload: {
        account: '0xabc',
        provider: 'wagmi',
        network: { chainId: 84532, name: 'Base Sepolia' },
        userImageURL: 'https://example.com/user.png',
      },
    });
  });

  it('defaults missing profile data to the legacy undefined-field payload', () => {
    const dispatch = createDispatch();
    mockStore.getState.mockReturnValue({});

    fetchAccount()(dispatch);

    expect(dispatch).toHaveBeenCalledWith({
      type: FETCH_ACCOUNT,
      payload: {
        account: undefined,
        provider: undefined,
        network: undefined,
        userImageURL: undefined,
      },
    });
  });

  it('dispatches account changes unchanged', () => {
    const dispatch = createDispatch();
    const web3info = {
      account: '0xdef',
      provider: 'passkey_eoa',
      network: { chainId: 11155420, name: 'OP Sepolia' },
      userImageURL: null,
    };

    changeAccount(web3info)(dispatch);

    expect(dispatch).toHaveBeenCalledWith({
      type: LOGIN_ACCOUNT,
      payload: web3info,
    });
  });
});
