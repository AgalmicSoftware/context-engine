import reducer from './sessionStateReducer';
import { readStoredGlobalSessionSelection } from '../utilities/session/globalSessionState.js';
import {
  CHANGE_ACTIVE_SESSION_SLUG,
  CHANGE_FOCUSED_TAB,
  FETCH_SESSION_STATE,
  LOGIN_IN_PROGRESS,
  TOGGLE_LOGIN_MODAL,
  UPDATE_GLOBAL_SESSION_SELECTION,
} from '../actions/types';

const loadReducer = () => {
  jest.resetModules();
  return require('./sessionStateReducer').default;
};

describe('sessionStateReducer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('returns the initial state', () => {
    // A Demo Mode preference left by an earlier version of the site adds nothing to the state.
    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(true));
    const initialSelection = readStoredGlobalSessionSelection();
    const reloadedReducer = loadReducer();

    expect(reloadedReducer(undefined, { type: '@@INIT' })).toEqual({
      focusedTab: 4,
      loginInProgress: false,
      loginComplete: false,
      explorerHistory: [],
      ETHUSDToggle: false,
      explainerMode: true,
      loginModalToggled: false,
      loginModalFocus: '',
      afterLoginModalToggled: false,
      primarySessionSlug: initialSelection.primarySessionSlug,
      primarySessionExplicit: initialSelection.primarySessionExplicit,
      activeSessionSlug: initialSelection.activeSessionSlug,
      selectedSessionScope: initialSelection.selectedSessionScope,
      selectedSessionSlugs: initialSelection.selectedSessionSlugs,
      onboardingStep: null,
      tooltipsEnabled: true,
    });
  });

  it('falls back when stored session preferences contain malformed JSON', () => {
    localStorage.setItem('ce:tooltipsEnabled', '{bad');
    const state = loadReducer()(undefined, { type: '@@INIT' });

    expect(state.tooltipsEnabled).toBe(true);
  });

  it('hydrates the canonical global session selection from localStorage', () => {
    localStorage.setItem('ce:primarySessionSlug', 'debate');
    localStorage.setItem('ce:selectedSessionScope', 'list');
    localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['general', 'edge']));

    jest.resetModules();
    const reloadedReducer = require('./sessionStateReducer').default;
    const state = reloadedReducer(undefined, { type: '@@INIT' });

    expect(state.primarySessionSlug).toBe('debate');
    expect(state.activeSessionSlug).toBe('debate');
    expect(state.selectedSessionScope).toBe('list');
    expect(state.selectedSessionSlugs).toEqual(['', 'edge']);
  });

  it('preserves an explicit general primary session in Redux state', () => {
    localStorage.setItem('ce:primarySessionSlug', '');
    localStorage.setItem('ce:primarySessionSlugExplicit', 'true');
    localStorage.setItem('ce:selectedSessionScope', 'list');
    localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['general', 'edge']));

    jest.resetModules();
    const reloadedReducer = require('./sessionStateReducer').default;
    const state = reloadedReducer(undefined, { type: '@@INIT' });

    expect(state.primarySessionSlug).toBe('');
    expect(state.primarySessionExplicit).toBe(true);
    expect(state.activeSessionSlug).toBe('');
    expect(state.selectedSessionScope).toBe('list');
    expect(state.selectedSessionSlugs).toEqual(['', 'edge']);
  });

  it('hydrates fetched session state into the current state shape', () => {
    const next = reducer(undefined, {
      type: FETCH_SESSION_STATE,
      payload: {
        focusedTab: 2,
        loginModalToggled: true,
        explorerHistory: ['/one', '/two'],
      },
    });

    expect(next.focusedTab).toBe(2);
    expect(next.loginModalToggled).toBe(true);
    expect(next.explorerHistory).toEqual(['/one', '/two']);
  });

  it('updates the focused tab', () => {
    const withTab = reducer(undefined, {
      type: CHANGE_FOCUSED_TAB,
      payload: 3,
    });
    expect(withTab.focusedTab).toBe(3);
  });

  it('toggles login modal for structured payloads', () => {
    const opened = reducer(undefined, {
      type: TOGGLE_LOGIN_MODAL,
      payload: { isOpen: true, focus: 'ai-config' },
    });

    expect(opened.loginModalToggled).toBe(true);
    expect(opened.loginModalFocus).toBe('ai-config');

    const closed = reducer(opened, {
      type: TOGGLE_LOGIN_MODAL,
      payload: { isOpen: false },
    });

    expect(closed.loginModalToggled).toBe(false);
    expect(closed.loginModalFocus).toBe('');
  });

  it('toggles login modal for legacy boolean payloads', () => {
    const opened = reducer(undefined, {
      type: TOGGLE_LOGIN_MODAL,
      payload: true,
    });
    expect(opened.loginModalToggled).toBe(true);

    const closed = reducer(opened, {
      type: TOGGLE_LOGIN_MODAL,
      payload: false,
    });
    expect(closed.loginModalToggled).toBe(false);
  });

  it('tracks login progress flags', () => {
    const pending = reducer(undefined, {
      type: LOGIN_IN_PROGRESS,
      payload: { loginInProgress: true, loginComplete: false },
    });

    expect(pending.loginInProgress).toBe(true);
    expect(pending.loginComplete).toBe(false);

    const done = reducer(pending, {
      type: LOGIN_IN_PROGRESS,
      payload: { loginInProgress: false, loginComplete: true },
    });

    expect(done.loginInProgress).toBe(false);
    expect(done.loginComplete).toBe(true);
  });

  it('updates the active route session without mutating the stored primary selection', () => {
    const base = reducer(undefined, {
      type: UPDATE_GLOBAL_SESSION_SELECTION,
      payload: {
        primarySessionSlug: 'edge',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['general', 'edge'],
      },
    });

    const debate = reducer(base, {
      type: CHANGE_ACTIVE_SESSION_SLUG,
      payload: 'debate',
    });
    expect(debate.activeSessionSlug).toBe('debate');
    expect(debate.primarySessionSlug).toBe('edge');
    expect(debate.selectedSessionScope).toBe('list');
    expect(debate.selectedSessionSlugs).toEqual(['', 'edge']);

    const cleared = reducer(debate, {
      type: CHANGE_ACTIVE_SESSION_SLUG,
      payload: 'general',
    });
    expect(cleared.activeSessionSlug).toBe('');
    expect(cleared.primarySessionSlug).toBe('edge');
  });

  it('updates the selected-session scope and list without collapsing list mode', () => {
    const next = reducer(undefined, {
      type: UPDATE_GLOBAL_SESSION_SELECTION,
      payload: {
        primarySessionSlug: '',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['general', 'edge', 'DEBATE'],
      },
    });

    expect(next.primarySessionSlug).toBe('');
    expect(next.activeSessionSlug).toBe('');
    expect(next.selectedSessionScope).toBe('list');
    expect(next.selectedSessionSlugs).toEqual(['', 'edge', 'DEBATE']);
  });

  it('sets and clears onboarding step', () => {
    const step1 = reducer(undefined, {
      type: 'SET_ONBOARDING_STEP',
      payload: 1,
    });
    expect(step1.onboardingStep).toBe(1);

    const step2 = reducer(step1, {
      type: 'SET_ONBOARDING_STEP',
      payload: 2,
    });
    expect(step2.onboardingStep).toBe(2);

    const cleared = reducer(step2, {
      type: 'SET_ONBOARDING_STEP',
      payload: null,
    });
    expect(cleared.onboardingStep).toBeNull();
  });

  it('ignores malformed handled actions and unknown actions', () => {
    const state = reducer(undefined, {
      type: CHANGE_FOCUSED_TAB,
      payload: 4,
    });

    expect(reducer(state, { type: FETCH_SESSION_STATE })).toBe(state);
    expect(reducer(state, { type: LOGIN_IN_PROGRESS })).toBe(state);
    expect(reducer(state, { type: LOGIN_IN_PROGRESS, payload: true })).toBe(state);
    expect(reducer(state, { type: UPDATE_GLOBAL_SESSION_SELECTION, payload: null })).toBe(state);
    expect(reducer(state, { type: 'UNKNOWN_ACTION', payload: true })).toBe(state);
  });
});

it('ignores the retired browser auto-advance preference during initialization and refresh', () => {
  localStorage.setItem('ce:pileAutoAdvanceEnabled', 'false');
  const initial = reducer(undefined, { type: '@@INIT' });
  expect(initial).not.toHaveProperty('pileAutoAdvanceEnabled');
  expect(reducer(initial, { type: FETCH_SESSION_STATE, payload: {} })).not.toHaveProperty('pileAutoAdvanceEnabled');
  localStorage.clear();
});
