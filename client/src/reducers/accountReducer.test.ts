import reducer from './accountReducer';
import {
  CHANGE_NETWORK,
  FETCH_ACCOUNT,
  LOGIN_ACCOUNT,
} from '../actions/types';

const buildAccountPayload = (overrides = {}) => ({
  account: '0xabc',
  provider: 'wagmi',
  network: { chainId: 84532, name: 'Base Sepolia' },
  userImageURL: 'https://example.com/user.png',
  ...overrides,
});

describe('accountReducer', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      account: '',
      provider: 'none',
      network: null,
      alerts: [],
      userImageURL: null,
    });
  });

  it('hydrates account state for login and fetch actions', () => {
    const loggedIn = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });
    expect(loggedIn).toMatchObject(buildAccountPayload());

    const fetched = reducer(loggedIn, {
      type: FETCH_ACCOUNT,
      payload: buildAccountPayload({
        account: '0xdef',
        provider: 'passkey_eoa',
        userImageURL: 'https://example.com/other.png',
      }),
    });

    expect(fetched.account).toBe('0xdef');
    expect(fetched.provider).toBe('passkey_eoa');
    expect(fetched.userImageURL).toBe('https://example.com/other.png');
    expect(fetched.alerts).toEqual([]);
  });

  it('merges fetched account fields without clearing untouched account data', () => {
    const state = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });

    const next = reducer(state, {
      type: FETCH_ACCOUNT,
      payload: {
        userImageURL: 'https://example.com/updated.png',
      },
    });

    expect(next.userImageURL).toBe('https://example.com/updated.png');
    expect(next.account).toBe('0xabc');
    expect(next.provider).toBe('wagmi');
  });

  it('resets account state when logout dispatches an empty login payload', () => {
    const state = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });

    const next = reducer(state, {
      type: LOGIN_ACCOUNT,
      payload: {},
    });

    expect(next).toEqual({
      account: '',
      provider: 'none',
      network: null,
      alerts: [],
      userImageURL: null,
    });
  });

  it('resets omitted profile fields when LOGIN_ACCOUNT switches to a different wallet', () => {
    const walletAState = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });

    const walletBPayload = {
      account: '0xdef',
      provider: 'web3auth',
      network: { chainId: 8453, name: 'Base' },
    };

    const next = reducer(walletAState, {
      type: LOGIN_ACCOUNT,
      payload: walletBPayload,
    });

    expect(next.account).toBe('0xdef');
    expect(next.provider).toBe('web3auth');
    expect(next.network).toEqual({ chainId: 8453, name: 'Base' });
    expect(next.userImageURL).toBeNull();
  });

  it('preserves account state when LOGIN_ACCOUNT reconnects the same wallet with different casing', () => {
    const state = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });

    const next = reducer(state, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload({
        account: '0xAbC',
        provider: 'web3auth',
      }),
    });

    expect(next.account).toBe('0xAbC');
    expect(next.provider).toBe('web3auth');
    expect(next.userImageURL).toBe('https://example.com/user.png');
  });

  it('stores passkey EOA as the canonical embedded-wallet provider value', () => {
    const next = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload({
        provider: 'passkey_eoa',
      }),
    });

    expect(next.provider).toBe('passkey_eoa');
    expect(next.account).toBe('0xabc');
  });

  it('changes only the network field for CHANGE_NETWORK', () => {
    const state = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });

    const next = reducer(state, {
      type: CHANGE_NETWORK,
      payload: { network: { chainId: 8453, name: 'Base' } },
    });

    expect(next.network).toEqual({ chainId: 8453, name: 'Base' });
    expect(next.account).toBe('0xabc');
    expect(next.provider).toBe('wagmi');
  });

  it('ignores malformed handled actions and unknown actions', () => {
    const state = reducer(undefined, {
      type: LOGIN_ACCOUNT,
      payload: buildAccountPayload(),
    });

    expect(reducer(state, { type: LOGIN_ACCOUNT })).toBe(state);
    expect(reducer(state, { type: FETCH_ACCOUNT, payload: null })).toBe(state);
    expect(reducer(state, { type: LOGIN_ACCOUNT, payload: 'bad-payload' })).toBe(state);
    expect(reducer(state, { type: CHANGE_NETWORK, payload: {} })).toBe(state);
    expect(reducer(state, { type: 'UNKNOWN_ACTION', payload: buildAccountPayload() })).toBe(state);
  });
});
