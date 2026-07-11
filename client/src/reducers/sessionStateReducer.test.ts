import reducer from './sessionStateReducer';
import { readStoredGlobalSessionSelection } from '../utilities/session/globalSessionState.js';
import {
  CHANGE_ACTIVE_SESSION_SLUG,
  CHANGE_FOCUSED_TAB,
  CHANGE_METRICS_CHOICE,
  FETCH_SESSION_STATE,
  LOGIN_IN_PROGRESS,
  SET_DEMO_SURFACE_MODE,
  TOGGLE_DEMO_MODE,
  TOGGLE_LOGIN_MODAL,
  UPDATE_GLOBAL_SESSION_SELECTION,
} from '../actions/types';

const DEMO_SURFACE_MODE_ENV_KEY = 'REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT';
const env = process.env as Record<string, string | undefined>;
const ORIGINAL_DEMO_SURFACE_MODE_ENV = env[DEMO_SURFACE_MODE_ENV_KEY];

const restoreDemoSurfaceModeEnv = () => {
  if (typeof ORIGINAL_DEMO_SURFACE_MODE_ENV === 'undefined') {
    delete env[DEMO_SURFACE_MODE_ENV_KEY];
    return;
  }

  env[DEMO_SURFACE_MODE_ENV_KEY] = ORIGINAL_DEMO_SURFACE_MODE_ENV;
};

const loadReducerWithDemoSurfaceModeDefault = (value?: string) => {
  if (typeof value === 'undefined') {
    delete env[DEMO_SURFACE_MODE_ENV_KEY];
  } else {
    env[DEMO_SURFACE_MODE_ENV_KEY] = value;
  }

  jest.resetModules();
  return require('./sessionStateReducer').default;
};

describe('sessionStateReducer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    restoreDemoSurfaceModeEnv();
    jest.resetModules();
  });

  afterAll(() => {
    restoreDemoSurfaceModeEnv();
  });

  it('returns the initial state', () => {
    const initialSelection = readStoredGlobalSessionSelection();
    const reloadedReducer = loadReducerWithDemoSurfaceModeDefault();

    expect(reloadedReducer(undefined, { type: '@@INIT' })).toEqual({
      metricsOptIn: false,
      focusedTab: 4,
      loginInProgress: false,
      loginComplete: false,
      explorerHistory: [],
      ETHUSDToggle: false,
      explainerMode: true,
      demoMode: { tools: false },
      demoSurfaceMode: false,
      loginModalToggled: false,
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

  it('treats legacy null demoSurfaceMode storage as enabled', () => {
    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(null));
    const reloadedReducer = loadReducerWithDemoSurfaceModeDefault('false');

    expect(reloadedReducer(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(true);
  });

  it('falls back when stored session preferences contain malformed JSON', () => {
    localStorage.setItem('ce:demoSurfaceMode', '{bad');
    localStorage.setItem('ce:tooltipsEnabled', '{bad');
    const reloadedReducer = loadReducerWithDemoSurfaceModeDefault('false');
    const state = reloadedReducer(undefined, { type: '@@INIT' });

    expect(state.demoSurfaceMode).toBe(false);
    expect(state.tooltipsEnabled).toBe(true);
  });

  describe('demoSurfaceMode default precedence', () => {
    it('uses stored false regardless of the env default', () => {
      localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(false));

      expect(loadReducerWithDemoSurfaceModeDefault('true')(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(false);

      expect(loadReducerWithDemoSurfaceModeDefault('false')(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(false);
    });

    it('uses stored true regardless of the env default', () => {
      localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(true));

      expect(loadReducerWithDemoSurfaceModeDefault('false')(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(true);

      expect(loadReducerWithDemoSurfaceModeDefault('true')(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(true);
    });

    it('uses the env default when no demoSurfaceMode preference is stored and the default is true', () => {
      const reloadedReducer = loadReducerWithDemoSurfaceModeDefault('true');

      expect(reloadedReducer(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(true);
    });

    it('uses the env default when no demoSurfaceMode preference is stored and the default is false', () => {
      const reloadedReducer = loadReducerWithDemoSurfaceModeDefault('false');

      expect(reloadedReducer(undefined, { type: '@@INIT' }).demoSurfaceMode).toBe(false);
    });
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
    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(false));

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
    expect(next.demoSurfaceMode).toBe(false);
  });

  it('hydrates demoSurfaceMode from localStorage and keeps it independent from legacy demoMode', () => {
    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(true));

    jest.resetModules();
    const reloadedReducer = require('./sessionStateReducer').default;
    const initial = reloadedReducer(undefined, { type: '@@INIT' });

    expect(initial.demoSurfaceMode).toBe(true);
    expect(initial.demoMode).toEqual({ tools: false });

    const updated = reloadedReducer(
      {
        ...initial,
        demoMode: { tools: true },
      },
      {
        type: SET_DEMO_SURFACE_MODE,
        payload: false,
      },
    );

    expect(updated.demoSurfaceMode).toBe(false);
    expect(updated.demoMode).toEqual({ tools: true });
    expect(JSON.parse(localStorage.getItem('ce:demoSurfaceMode') || 'null')).toBe(false);
  });

  it('updates tab, metrics choice, and demo mode independently', () => {
    const withMetrics = reducer(undefined, {
      type: CHANGE_METRICS_CHOICE,
      payload: true,
    });
    expect(withMetrics.metricsOptIn).toBe(true);

    const withTab = reducer(withMetrics, {
      type: CHANGE_FOCUSED_TAB,
      payload: 3,
    });
    expect(withTab.focusedTab).toBe(3);

    const withDemoMode = reducer(withTab, {
      type: TOGGLE_DEMO_MODE,
      payload: true,
    });
    expect(withDemoMode.demoMode).toEqual({
      tools: true,
    });

    const withPartialDemoMode = reducer(
      {
        ...withTab,
        demoMode: {
          tools: false,
        },
      },
      {
        type: TOGGLE_DEMO_MODE,
        payload: { tools: true, futureTab: true, votes: true },
      },
    );
    expect(withPartialDemoMode.demoMode).toEqual({
      tools: true,
    });
  });

  it('toggles login modal for structured payloads', () => {
    const opened = reducer(undefined, {
      type: TOGGLE_LOGIN_MODAL,
      payload: { isOpen: true },
    });

    expect(opened.loginModalToggled).toBe(true);

    const closed = reducer(opened, {
      type: TOGGLE_LOGIN_MODAL,
      payload: { isOpen: false },
    });

    expect(closed.loginModalToggled).toBe(false);
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
