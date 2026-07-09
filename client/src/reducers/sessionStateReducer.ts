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
import {
  normalizeDemoSurfaceMode,
  persistDemoSurfaceMode,
  persistTooltipsEnabled,
  readStoredDemoSurfaceMode,
  readStoredTooltipsEnabled,
} from '../utilities/session/sessionPreferencesStorage.js';

export interface SessionState {
  primarySessionSlug: string;
  primarySessionExplicit: boolean | undefined;
  activeSessionSlug: string;
  selectedSessionScope: string;
  selectedSessionSlugs: string[];
  metricsOptIn: boolean;
  focusedTab: number;
  loginInProgress: boolean;
  loginComplete: boolean;
  explorerHistory: unknown[];
  ETHUSDToggle: boolean;
  explainerMode: boolean;
  demoMode: Record<string, boolean>;
  demoSurfaceMode: boolean;
  loginModalToggled: boolean;
  afterLoginModalToggled: boolean;
  onboardingStep: number | null;
  tooltipsEnabled: boolean;
}

type SessionSelectionPayload = {
  primarySessionSlug?: unknown;
  primarySessionExplicit?: unknown;
  activeSessionSlug?: unknown;
  sessionSlug?: unknown;
  selectedSessionScope?: unknown;
  selectedSessionSlugs?: unknown;
};
type FetchSessionStatePayload = SessionSelectionPayload &
  Partial<Pick<SessionState, 'focusedTab' | 'loginModalToggled' | 'explorerHistory'>>;
type LoginProgressPayload = Partial<Pick<SessionState, 'loginInProgress' | 'loginComplete'>>;
type LoginModalPayload = boolean | { isOpen?: unknown };
type DemoModePayload = boolean | Partial<SessionState['demoMode']>;
type SessionReducerAction =
  | { type: typeof FETCH_SESSION_STATE; payload?: FetchSessionStatePayload }
  | { type: typeof CHANGE_METRICS_CHOICE; payload?: SessionState['metricsOptIn'] }
  | { type: typeof CHANGE_FOCUSED_TAB; payload?: SessionState['focusedTab'] }
  | { type: typeof TOGGLE_LOGIN_MODAL; payload?: LoginModalPayload }
  | { type: typeof TOGGLE_TOOLTIPS }
  | { type: typeof SET_DEMO_SURFACE_MODE; payload?: unknown }
  | { type: typeof LOGIN_IN_PROGRESS; payload?: LoginProgressPayload }
  | { type: typeof TOGGLE_DEMO_MODE; payload?: DemoModePayload }
  | { type: typeof CHANGE_ACTIVE_SESSION_SLUG; payload?: unknown }
  | { type: typeof UPDATE_GLOBAL_SESSION_SELECTION; payload?: SessionSelectionPayload }
  | { type: typeof SET_ONBOARDING_STEP; payload?: SessionState['onboardingStep'] }
  | { type?: string; payload?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getInitialState = (): SessionState => ({
  ...readStoredGlobalSessionSelection(),
  metricsOptIn: false, // Reserved for a persisted analytics preference.
  focusedTab: 4, // Default home tab index (Tools). Keep Welcome opt-in.
  loginInProgress: false, // True while wallet login is being processed.
  loginComplete: false, // True once wallet login state is ready for gated actions.
  explorerHistory: [],
  ETHUSDToggle: false, // Display preference: USD vs ETH denominations.
  explainerMode: true, // Controls whether rules/help modals stay enabled.
  demoMode: { tools: false },
  demoSurfaceMode: readStoredDemoSurfaceMode(),
  // Modal state
  loginModalToggled: false,
  afterLoginModalToggled: false,
  onboardingStep: null,
  tooltipsEnabled: readStoredTooltipsEnabled(),
});

const hasOwn = (value: unknown, key: string): boolean => Object.prototype.hasOwnProperty.call(value || {}, key);
const resolvePrimarySessionExplicitInput = (
  state: SessionState,
  payload: SessionSelectionPayload | Record<string, unknown> = {},
): unknown => {
  if (hasOwn(payload, 'primarySessionExplicit')) return payload.primarySessionExplicit;
  if (hasOwn(payload, 'primarySessionSlug') || hasOwn(payload, 'activeSessionSlug') || hasOwn(payload, 'sessionSlug')) {
    return undefined;
  }
  return state.primarySessionExplicit;
};

export default function sessionStateReducer(
  state: SessionState = getInitialState(),
  action: SessionReducerAction,
): SessionState {
  switch (action.type) {
    case FETCH_SESSION_STATE:
      if (!isRecord(action.payload)) return state;
      {
        const { payload } = action;
        const nextSelection = normalizeGlobalSessionSelection({
          primarySessionSlug: hasOwn(payload, 'primarySessionSlug')
            ? payload.primarySessionSlug
            : state.primarySessionSlug,
          primarySessionExplicit: resolvePrimarySessionExplicitInput(state, payload),
          activeSessionSlug: hasOwn(payload, 'activeSessionSlug') ? payload.activeSessionSlug : state.activeSessionSlug,
          selectedSessionScope: hasOwn(payload, 'selectedSessionScope')
            ? payload.selectedSessionScope
            : state.selectedSessionScope,
          selectedSessionSlugs: hasOwn(payload, 'selectedSessionSlugs')
            ? payload.selectedSessionSlugs
            : state.selectedSessionSlugs,
        });
        return {
          ...state,
          ...nextSelection,
          ...(hasOwn(payload, 'focusedTab') ? { focusedTab: payload.focusedTab as SessionState['focusedTab'] } : {}),
          ...(hasOwn(payload, 'loginModalToggled')
            ? { loginModalToggled: payload.loginModalToggled as SessionState['loginModalToggled'] }
            : {}),
          ...(hasOwn(payload, 'explorerHistory')
            ? { explorerHistory: payload.explorerHistory as SessionState['explorerHistory'] }
            : {}),
          demoSurfaceMode: readStoredDemoSurfaceMode(),
          tooltipsEnabled: readStoredTooltipsEnabled(),
        };
      }
    case CHANGE_METRICS_CHOICE:
      if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
      return {
        ...state,
        metricsOptIn: action.payload as SessionState['metricsOptIn'],
      };
    case CHANGE_FOCUSED_TAB:
      if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
      return {
        ...state,
        focusedTab: action.payload as SessionState['focusedTab'],
      };
    case TOGGLE_LOGIN_MODAL: {
      const p = action.payload;
      // Support both legacy boolean and structured payloads.
      if (isRecord(p)) {
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
      if (!isRecord(action.payload)) return state;
      return {
        ...state,
        ...(hasOwn(action.payload, 'loginInProgress')
          ? { loginInProgress: action.payload.loginInProgress as SessionState['loginInProgress'] }
          : {}),
        ...(hasOwn(action.payload, 'loginComplete')
          ? { loginComplete: action.payload.loginComplete as SessionState['loginComplete'] }
          : {}),
      };
    case TOGGLE_DEMO_MODE:
      if (!hasOwn(action, 'payload') || action.payload === undefined) return state;
      if (typeof action.payload === 'boolean') {
        return { ...state, demoMode: { tools: action.payload } };
      }
      if (!isRecord(action.payload)) {
        return { ...state, demoMode: { ...state.demoMode } };
      }
      return {
        ...state,
        demoMode: {
          ...state.demoMode,
          ...(hasOwn(action.payload, 'tools')
            ? { tools: action.payload.tools as SessionState['demoMode']['tools'] }
            : {}),
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
      if (!hasOwn(action, 'payload') || !isRecord(action.payload)) return state;
      const selection = normalizeGlobalSessionSelection({
        primarySessionSlug: hasOwn(action.payload, 'primarySessionSlug')
          ? action.payload.primarySessionSlug
          : state.primarySessionSlug,
        primarySessionExplicit: resolvePrimarySessionExplicitInput(state, action.payload),
        activeSessionSlug: hasOwn(action.payload, 'activeSessionSlug')
          ? action.payload.activeSessionSlug
          : state.activeSessionSlug,
        selectedSessionScope: hasOwn(action.payload, 'selectedSessionScope')
          ? action.payload.selectedSessionScope
          : state.selectedSessionScope,
        selectedSessionSlugs: hasOwn(action.payload, 'selectedSessionSlugs')
          ? action.payload.selectedSessionSlugs
          : state.selectedSessionSlugs,
      });
      return {
        ...state,
        ...selection,
      };
    }
    case SET_ONBOARDING_STEP:
      return {
        ...state,
        onboardingStep: action.payload as SessionState['onboardingStep'],
      };
    case TOGGLE_TOOLTIPS: {
      const nextTooltipsEnabled = !state.tooltipsEnabled;
      persistTooltipsEnabled(nextTooltipsEnabled);
      return {
        ...state,
        tooltipsEnabled: nextTooltipsEnabled,
      };
    }
    default:
      return state;
  }
}
