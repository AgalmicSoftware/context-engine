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

export const fetchSessionState = () => (dispatch: any) => {
    // Check redux store for state (TODO: safe?)
    var currFocusedTab = (store.getState() as any).sessionState.focusedTab;
    var currLoginModalToggle = (store.getState() as any).sessionState.loginModalToggled;
    var currExplorerHistory = (store.getState() as any).sessionState.explorerHistory
    var currPrimarySessionSlug = (store.getState() as any).sessionState.primarySessionSlug;
    var currPrimarySessionExplicit = (store.getState() as any).sessionState.primarySessionExplicit;
    var currSelectedSessionScope = (store.getState() as any).sessionState.selectedSessionScope;
    var currSelectedSessionSlugs = (store.getState() as any).sessionState.selectedSessionSlugs;

    const sessionInfo = {
      focusedTab: currFocusedTab,
      loginModalToggled: currLoginModalToggle,
      explorerHistory: currExplorerHistory,
      primarySessionSlug: currPrimarySessionSlug,
      primarySessionExplicit: currPrimarySessionExplicit,
      selectedSessionScope: currSelectedSessionScope,
      selectedSessionSlugs: currSelectedSessionSlugs,
    };

    dispatch({
      type: FETCH_SESSION_STATE,
      payload: sessionInfo,
    });
};

export const changeFocusedTab = (newTabIndex: any) => (dispatch: any) => {
  dispatch({
    type: CHANGE_FOCUSED_TAB,
    payload: newTabIndex,
  });
}

export const toggleLoginModal = (modalIsOpen: any) => (dispatch: any) => {
  dispatch({
    type: TOGGLE_LOGIN_MODAL,
    payload: modalIsOpen,
  });
}

export const toggleTooltips = () => (dispatch: any) => {
  dispatch({
    type: TOGGLE_TOOLTIPS,
  });
}

export const setDemoSurfaceMode = (newDemoSurfaceMode: any) => (dispatch: any) => {
  dispatch({
    type: SET_DEMO_SURFACE_MODE,
    payload: newDemoSurfaceMode,
  });
}

export const updateLoginInfo = (pendingLogin: any) => (dispatch: any) => {
  dispatch({
    type: LOGIN_IN_PROGRESS,
    payload: pendingLogin,
  });
}

export const changeMetricsChoice = (newMetricsChoice: any) => (dispatch: any) => {
  dispatch({
    type: CHANGE_METRICS_CHOICE,
    payload: newMetricsChoice,
  });
}

export const toggleDemoMode = (newDemoMode: any) => (dispatch: any) => {
  dispatch({
    type: TOGGLE_DEMO_MODE,
    payload: newDemoMode,
  });
}

export const changeActiveSessionSlug = (slug: any) => (dispatch: any) => {
  dispatch({
    type: CHANGE_ACTIVE_SESSION_SLUG,
    payload: slug,
  });
};

export const updateGlobalSessionSelection = (selection: any = {}) => (dispatch: any) => {
  const persistedSelection = writeGlobalSessionSelection(selection);
  dispatch({
    type: UPDATE_GLOBAL_SESSION_SELECTION,
    payload: persistedSelection,
  });
};

export const setOnboardingStep = (step: any) => (dispatch: any) => {
  dispatch({
    type: SET_ONBOARDING_STEP,
    payload: step,
  });
};
