import reducer from './index';
import { CHANGE_ACTIVE_SESSION_SLUG, LOGIN_ACCOUNT } from '../actions/types';

describe('root reducer', () => {
  it('builds the expected slice keys on init', () => {
    const state = reducer(undefined, { type: '@@INIT' });

    expect(Object.keys(state).sort()).toEqual(['profile', 'sessionState']);
    expect(state.profile.account).toBe('');
    expect(state.sessionState.focusedTab).toBe(4);
  });

  it('routes actions to the correct reducer slice', () => {
    const initial = reducer(undefined, { type: '@@INIT' });

    const afterLogin = reducer(initial, {
      type: LOGIN_ACCOUNT,
      payload: { account: '0xabc', provider: 'wagmi' },
    });
    expect(afterLogin.profile.account).toBe('0xabc');
    expect(afterLogin.sessionState).toBe(initial.sessionState);

    const afterSession = reducer(afterLogin, {
      type: CHANGE_ACTIVE_SESSION_SLUG,
      payload: 'debate',
    });
    expect(afterSession.sessionState.activeSessionSlug).toBe('debate');
    expect(afterSession.profile).toBe(afterLogin.profile);
  });
});
