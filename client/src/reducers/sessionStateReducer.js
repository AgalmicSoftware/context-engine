// sessionStateReducer.js

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
import {
  normalizeGlobalPrimarySessionSlug,
  normalizeGlobalSessionSelection,
  readStoredGlobalSessionSelection,
} from '../utilities/session/globalSessionState.js';

const readStoredTooltipsEnabled = () => {
  try {
    const storedValue = localStorage.getItem('ce:tooltipsEnabled');
    return storedValue !== null ? JSON.parse(storedValue) : true;
  } catch (_) {
    return true;
  }
};

const normalizeDemoSurfaceMode = (value) => value === false ? false : true;

const readStoredDemoSurfaceMode = () => {
  try {
    const storedValue = localStorage.getItem('ce:demoSurfaceMode');
    return storedValue !== null ? normalizeDemoSurfaceMode(JSON.parse(storedValue)) : true;
  } catch (_) {
    return true;
  }
};

const persistDemoSurfaceMode = (value) => {
  try {
    localStorage.setItem('ce:demoSurfaceMode', JSON.stringify(normalizeDemoSurfaceMode(value)));
  } catch (_) {}
};

const getInitialState = () => ({
    ...readStoredGlobalSessionSelection(),
    metricsOptIn: false,       // Reserved for a persisted analytics preference.
    focusedTab: 4,            // Default home tab index (Tools). Keep Welcome opt-in.
    loginInProgress: false,   // True while wallet login is being processed.
    loginComplete: false,     // True once wallet login state is ready for gated actions.
    explorerHistory: [],
    ETHUSDToggle: false,      // Display preference: USD vs ETH denominations.
    explainerMode: true,      // Controls whether rules/help modals stay enabled.
    demoMode: { tools: false },
    demoSurfaceMode: readStoredDemoSurfaceMode(),
    // Modal state
    loginModalToggled: false,
    afterLoginModalToggled: false,
    settingsModalToggled: false,
    onboardingStep: null,
    tooltipsEnabled: readStoredTooltipsEnabled(),
});

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const resolvePrimarySessionExplicitInput = (state, payload = {}) => {
  if (hasOwn(payload, 'primarySessionExplicit')) return payload.primarySessionExplicit;
  if (
    hasOwn(payload, 'primarySessionSlug') ||
    hasOwn(payload, 'activeSessionSlug') ||
    hasOwn(payload, 'sessionSlug')
  ) {
    return undefined;
  }
  return state.primarySessionExplicit;
};

export default function sessionStateReducer(state = getInitialState(), action) {
    switch (action.type) {
      case FETCH_SESSION_STATE:
        if (!action.payload || typeof action.payload !== 'object') return state;
        {
          const nextSelection = normalizeGlobalSessionSelection({
            primarySessionSlug: (
              hasOwn(action.payload, 'primarySessionSlug')
                ? action.payload.primarySessionSlug
                : state.primarySessionSlug
            ),
            primarySessionExplicit: resolvePrimarySessionExplicitInput(state, action.payload),
            activeSessionSlug: (
              hasOwn(action.payload, 'activeSessionSlug')
                ? action.payload.activeSessionSlug
                : state.activeSessionSlug
            ),
            selectedSessionScope: (
              hasOwn(action.payload, 'selectedSessionScope')
                ? action.payload.selectedSessionScope
                : state.selectedSessionScope
            ),
            selectedSessionSlugs: (
              hasOwn(action.payload, 'selectedSessionSlugs')
                ? action.payload.selectedSessionSlugs
                : state.selectedSessionSlugs
            ),
          });
        return {
          ...state,
          ...nextSelection,
          ...(hasOwn(action.payload, 'focusedTab') ? { focusedTab: action.payload.focusedTab } : {}),
          ...(hasOwn(action.payload, 'loginModalToggled') ? { loginModalToggled: action.payload.loginModalToggled } : {}),
          ...(hasOwn(action.payload, 'explorerHistory') ? { explorerHistory: action.payload.explorerHistory } : {}),
          demoSurfaceMode: readStoredDemoSurfaceMode(),
          tooltipsEnabled: readStoredTooltipsEnabled(),
        };
        }
      case CHANGE_METRICS_CHOICE:
        if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
        return {
          ...state,
          metricsOptIn: action.payload
        };
      case CHANGE_FOCUSED_TAB:
        if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
        return {
          ...state,
          focusedTab: action.payload
        };
        case TOGGLE_LOGIN_MODAL: {
          const p = action.payload;
          // Support both legacy boolean and structured payloads.
          if (typeof p === 'object' && p !== null) {
            const isOpen = !!p.isOpen;
            return {
              ...state,
              loginModalToggled: isOpen,
            };
          } else {
            const isOpen = !!p;
            return {
              ...state,
              loginModalToggled: isOpen,
            };
          }
        }

      case LOGIN_IN_PROGRESS:
          if (!action.payload || typeof action.payload !== 'object') return state;
          return {
            ...state,
            ...(hasOwn(action.payload, 'loginInProgress') ? { loginInProgress: action.payload.loginInProgress } : {}),
            ...(hasOwn(action.payload, 'loginComplete') ? { loginComplete: action.payload.loginComplete } : {}),
        };
      case TOGGLE_DEMO_MODE:
        if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
        if (typeof action.payload === 'boolean') {
          return { ...state, demoMode: { tools: action.payload } };
        }
        return {
          ...state,
          demoMode: {
            ...state.demoMode,
            ...(hasOwn(action.payload, 'tools') ? { tools: action.payload.tools } : {}),
          },
        };
      case SET_DEMO_SURFACE_MODE: {
        if (!hasOwn(action, 'payload')) return state;
        const nextDemoSurfaceMode = normalizeDemoSurfaceMode(action.payload);
        persistDemoSurfaceMode(nextDemoSurfaceMode);
        return {
          ...state,
          demoSurfaceMode: nextDemoSurfaceMode,
        };
      }
      case CHANGE_ACTIVE_SESSION_SLUG: {
        if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
        return {
          ...state,
          activeSessionSlug: normalizeGlobalPrimarySessionSlug(action.payload),
        };
      }
      case UPDATE_GLOBAL_SESSION_SELECTION: {
        if (!hasOwn(action, 'payload') || !action.payload || typeof action.payload !== 'object') return state;
        const selection = normalizeGlobalSessionSelection({
          primarySessionSlug: (
            hasOwn(action.payload, 'primarySessionSlug')
              ? action.payload.primarySessionSlug
              : state.primarySessionSlug
          ),
          primarySessionExplicit: resolvePrimarySessionExplicitInput(state, action.payload),
          activeSessionSlug: (
            hasOwn(action.payload, 'activeSessionSlug')
              ? action.payload.activeSessionSlug
              : state.activeSessionSlug
          ),
          selectedSessionScope: (
            hasOwn(action.payload, 'selectedSessionScope')
              ? action.payload.selectedSessionScope
              : state.selectedSessionScope
          ),
          selectedSessionSlugs: (
            hasOwn(action.payload, 'selectedSessionSlugs')
              ? action.payload.selectedSessionSlugs
              : state.selectedSessionSlugs
          ),
        });
        return {
          ...state,
          ...selection,
        };
      }
      case SET_ONBOARDING_STEP:
        return {
          ...state,
          onboardingStep: action.payload,
        };
      case TOGGLE_TOOLTIPS: {
        const nextTooltipsEnabled = !state.tooltipsEnabled;
        try {
          localStorage.setItem('ce:tooltipsEnabled', JSON.stringify(nextTooltipsEnabled));
        } catch (_) {}
        return {
          ...state,
          tooltipsEnabled: nextTooltipsEnabled,
        };
      }
      default:
        return state;
    }
  }
