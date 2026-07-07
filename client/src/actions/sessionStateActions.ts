import {
  FETCH_SESSION_STATE,
  CHANGE_METRICS_CHOICE,
  CHANGE_FOCUSED_TAB,
  TOGGLE_LOGIN_MODAL,
  TOGGLE_TOOLTIPS,
  SET_DEMO_SURFACE_MODE,
  LOGIN_IN_PROGRESS,
  TOGGLE_DEMO_MODE,
  CHANGE_ACTIVE_SESSION_SLUG,
  UPDATE_GLOBAL_SESSION_SELECTION,
  SET_ONBOARDING_STEP,
} from '../actions/types';
import store from '../store.js';
import { writeGlobalSessionSelection } from '../utilities/session/globalSessionState.js';

type SessionStateSnapshot = {
  focusedTab?: unknown;
  loginModalToggled?: unknown;
  explorerHistory?: unknown;
  primarySessionSlug?: unknown;
  primarySessionExplicit?: unknown;
  selectedSessionScope?: unknown;
  selectedSessionSlugs?: unknown;
};

type RootStateSnapshot = {
  sessionState: SessionStateSnapshot;
};

type SessionStateAction = {
  type: string;
  payload?: unknown;
};

type SessionStateDispatch = (action: SessionStateAction) => void;
type SessionStateThunk = (dispatch: SessionStateDispatch) => void;

const getCurrentSessionState = (): SessionStateSnapshot => (store.getState() as RootStateSnapshot).sessionState;

export const fetchSessionState = (): SessionStateThunk => (dispatch) => {
  const sessionState = getCurrentSessionState();

  const sessionInfo = {
    focusedTab: sessionState.focusedTab,
    loginModalToggled: sessionState.loginModalToggled,
    explorerHistory: sessionState.explorerHistory,
    primarySessionSlug: sessionState.primarySessionSlug,
    primarySessionExplicit: sessionState.primarySessionExplicit,
    selectedSessionScope: sessionState.selectedSessionScope,
    selectedSessionSlugs: sessionState.selectedSessionSlugs,
  };

  dispatch({
    type: FETCH_SESSION_STATE,
    payload: sessionInfo,
  });
};

export const changeFocusedTab =
  (newTabIndex: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: CHANGE_FOCUSED_TAB,
      payload: newTabIndex,
    });
  };

export const toggleLoginModal =
  (modalIsOpen: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: TOGGLE_LOGIN_MODAL,
      payload: modalIsOpen,
    });
  };

export const toggleTooltips = (): SessionStateThunk => (dispatch) => {
  dispatch({
    type: TOGGLE_TOOLTIPS,
  });
};

export const setDemoSurfaceMode =
  (newDemoSurfaceMode: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: SET_DEMO_SURFACE_MODE,
      payload: newDemoSurfaceMode,
    });
  };

export const updateLoginInfo =
  (pendingLogin: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: LOGIN_IN_PROGRESS,
      payload: pendingLogin,
    });
  };

export const changeMetricsChoice =
  (newMetricsChoice: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: CHANGE_METRICS_CHOICE,
      payload: newMetricsChoice,
    });
  };

export const toggleDemoMode =
  (newDemoMode: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: TOGGLE_DEMO_MODE,
      payload: newDemoMode,
    });
  };

export const changeActiveSessionSlug =
  (slug: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: CHANGE_ACTIVE_SESSION_SLUG,
      payload: slug,
    });
  };

export const updateGlobalSessionSelection =
  (selection: unknown = {}): SessionStateThunk =>
  (dispatch) => {
    const persistedSelection = writeGlobalSessionSelection(selection);
    dispatch({
      type: UPDATE_GLOBAL_SESSION_SELECTION,
      payload: persistedSelection,
    });
  };

export const setOnboardingStep =
  (step: unknown): SessionStateThunk =>
  (dispatch) => {
    dispatch({
      type: SET_ONBOARDING_STEP,
      payload: step,
    });
  };
