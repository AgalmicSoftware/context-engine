import {
  changeActiveSessionSlug,
  changeFocusedTab,
  changeMetricsChoice,
  fetchSessionState,
  setDemoSurfaceMode,
  setOnboardingStep,
  toggleDemoMode,
  toggleLoginModal,
  toggleTooltips,
  updateGlobalSessionSelection,
  updateLoginInfo,
} from './sessionStateActions.js';
import {
  CHANGE_ACTIVE_SESSION_SLUG,
  CHANGE_FOCUSED_TAB,
  CHANGE_METRICS_CHOICE,
  FETCH_SESSION_STATE,
  LOGIN_IN_PROGRESS,
  SET_DEMO_SURFACE_MODE,
  SET_ONBOARDING_STEP,
  TOGGLE_DEMO_MODE,
  TOGGLE_LOGIN_MODAL,
  TOGGLE_TOOLTIPS,
  UPDATE_GLOBAL_SESSION_SELECTION,
} from './types.js';
import store from '../store.js';
import { writeGlobalSessionSelection } from '../utilities/session/globalSessionState.js';

jest.mock('../store.js', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
  },
}));

jest.mock('../utilities/session/globalSessionState.js', () => ({
  writeGlobalSessionSelection: jest.fn(),
}));

type DispatchableAction = {
  type: string;
  payload?: unknown;
};

type MockStore = {
  getState: jest.MockedFunction<() => unknown>;
};

type WriteSelection = (selection?: unknown) => unknown;

const mockStore = store as unknown as MockStore;
const mockWriteGlobalSessionSelection = writeGlobalSessionSelection as jest.MockedFunction<WriteSelection>;
const createDispatch = () => jest.fn<void, [DispatchableAction]>();

describe('sessionStateActions', () => {
  beforeEach(() => {
    mockStore.getState.mockReset();
    mockWriteGlobalSessionSelection.mockReset();
  });

  it('fetches the current session slice and dispatches the existing payload shape', () => {
    const dispatch = createDispatch();
    mockStore.getState.mockReturnValue({
      sessionState: {
        focusedTab: 2,
        loginModalToggled: true,
        explorerHistory: ['/one', '/two'],
        primarySessionSlug: 'edge',
        primarySessionExplicit: true,
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['', 'edge'],
        ignoredField: 'not-dispatched',
      },
    });

    fetchSessionState()(dispatch);

    expect(dispatch).toHaveBeenCalledWith({
      type: FETCH_SESSION_STATE,
      payload: {
        focusedTab: 2,
        loginModalToggled: true,
        explorerHistory: ['/one', '/two'],
        primarySessionSlug: 'edge',
        primarySessionExplicit: true,
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['', 'edge'],
      },
    });
  });

  it('dispatches simple session action payloads unchanged', () => {
    const cases: Array<{
      run: (dispatch: ReturnType<typeof createDispatch>) => void;
      action: DispatchableAction;
    }> = [
      {
        run: (dispatch) => changeFocusedTab(3)(dispatch),
        action: { type: CHANGE_FOCUSED_TAB, payload: 3 },
      },
      {
        run: (dispatch) => toggleLoginModal({ isOpen: true })(dispatch),
        action: { type: TOGGLE_LOGIN_MODAL, payload: { isOpen: true } },
      },
      {
        run: (dispatch) => setDemoSurfaceMode(false)(dispatch),
        action: { type: SET_DEMO_SURFACE_MODE, payload: false },
      },
      {
        run: (dispatch) => updateLoginInfo({ loginInProgress: true })(dispatch),
        action: { type: LOGIN_IN_PROGRESS, payload: { loginInProgress: true } },
      },
      {
        run: (dispatch) => changeMetricsChoice(true)(dispatch),
        action: { type: CHANGE_METRICS_CHOICE, payload: true },
      },
      {
        run: (dispatch) => toggleDemoMode({ tools: true })(dispatch),
        action: { type: TOGGLE_DEMO_MODE, payload: { tools: true } },
      },
      {
        run: (dispatch) => changeActiveSessionSlug('debate')(dispatch),
        action: { type: CHANGE_ACTIVE_SESSION_SLUG, payload: 'debate' },
      },
      {
        run: (dispatch) => setOnboardingStep(null)(dispatch),
        action: { type: SET_ONBOARDING_STEP, payload: null },
      },
    ];

    cases.forEach(({ run, action }) => {
      const dispatch = createDispatch();
      run(dispatch);
      expect(dispatch).toHaveBeenCalledWith(action);
    });
  });

  it('dispatches tooltip toggles without a payload', () => {
    const dispatch = createDispatch();

    toggleTooltips()(dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: TOGGLE_TOOLTIPS });
  });

  it('persists global session selection before dispatching the persisted payload', () => {
    const dispatch = createDispatch();
    const selection = {
      primarySessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['', 'edge'],
    };
    const persistedSelection = {
      ...selection,
      primarySessionExplicit: true,
    };
    mockWriteGlobalSessionSelection.mockReturnValue(persistedSelection);

    updateGlobalSessionSelection(selection)(dispatch);

    expect(mockWriteGlobalSessionSelection).toHaveBeenCalledWith(selection);
    expect(dispatch).toHaveBeenCalledWith({
      type: UPDATE_GLOBAL_SESSION_SELECTION,
      payload: persistedSelection,
    });
  });

  it('defaults global session selection persistence input to an empty object', () => {
    const dispatch = createDispatch();
    const persistedSelection = {
      primarySessionSlug: '',
      selectedSessionScope: 'active',
      selectedSessionSlugs: [''],
    };
    mockWriteGlobalSessionSelection.mockReturnValue(persistedSelection);

    updateGlobalSessionSelection()(dispatch);

    expect(mockWriteGlobalSessionSelection).toHaveBeenCalledWith({});
    expect(dispatch).toHaveBeenCalledWith({
      type: UPDATE_GLOBAL_SESSION_SELECTION,
      payload: persistedSelection,
    });
  });
});
