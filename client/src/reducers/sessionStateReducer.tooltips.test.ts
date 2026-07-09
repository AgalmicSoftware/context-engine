import reducer from './sessionStateReducer';
import { FETCH_SESSION_STATE, TOGGLE_TOOLTIPS } from '../actions/types';

describe('sessionStateReducer tooltip preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates the tooltip preference from localStorage on init and fetch', () => {
    localStorage.setItem('ce:tooltipsEnabled', JSON.stringify(false));

    const initial = reducer(undefined, { type: '@@INIT' });
    expect(initial.tooltipsEnabled).toBe(false);

    const fetched = reducer({ ...initial, tooltipsEnabled: true }, { type: FETCH_SESSION_STATE, payload: {} });
    expect(fetched.tooltipsEnabled).toBe(false);
  });

  it('toggles and persists the tooltip preference', () => {
    const initial = reducer(undefined, { type: '@@INIT' });
    expect(initial.tooltipsEnabled).toBe(true);

    const disabled = reducer(initial, { type: TOGGLE_TOOLTIPS });
    expect(disabled.tooltipsEnabled).toBe(false);
    expect(JSON.parse(localStorage.getItem('ce:tooltipsEnabled') || 'null')).toBe(false);

    const enabled = reducer(disabled, { type: TOGGLE_TOOLTIPS });
    expect(enabled.tooltipsEnabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('ce:tooltipsEnabled') || 'null')).toBe(true);
  });
});
