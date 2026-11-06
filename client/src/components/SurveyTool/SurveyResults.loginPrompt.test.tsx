import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { applyMiddleware, combineReducers, createStore } from 'redux';
import thunk from 'redux-thunk';
import { fireEvent, render, screen } from '@testing-library/react';

import sessionStateReducer from '../../reducers/sessionStateReducer';
import ConnectedSurveyResults from './SurveyResults';
import type { SurveyResultsProps } from './SurveyResults';
import {
  WALLET_ACCOUNT,
  mountSurveyResults,
  resetSurveyResultsExportControlsHarness,
  seedWorkerSession,
} from './SurveyResults.exportControlsHarness';

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('./QuestionFilter', () => () => null);
jest.mock('../PolisReport/PolisReport', () => () => null);
jest.mock('./SingleQuestionResponse', () => () => null);
jest.mock('../../utilities/sessionResultsExport', () => ({
  ...(jest.requireActual('../../utilities/sessionResultsExport') as object),
  downloadSessionResultsHtmlReport: jest.fn(),
  downloadSessionResultsPdfReport: jest.fn(),
}));
jest.mock('../../utilities/ai/aiClient.js', () => ({ callAI: jest.fn() }));

const PROMPT = 'Log in to see your answers.';

// The real profile of a Worker-hosted session whose Results aren't public.
const privateSession = () => seedWorkerSession({ slug: 'pilot' }).mountProps;

const publicSession = (): SurveyResultsProps => {
  const props = privateSession();
  const { sessionModeProfile } = props.sessionConfig as {
    sessionModeProfile: { results: { visibility: string } };
  };
  sessionModeProfile.results.visibility = 'public_full_if_storage_public';
  return props;
};

describe('SurveyResults log-in prompt', () => {
  beforeEach(() => {
    resetSurveyResultsExportControlsHarness();
  });

  it('asks a signed-out visitor to log in when only signed-in people can read answers', async () => {
    const toggleLoginModal = jest.fn();
    mountSurveyResults({ ...privateSession(), toggleLoginModal });

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
  });

  it('still asks a wallet that has not finished logging in', async () => {
    mountSurveyResults({ ...privateSession(), account: WALLET_ACCOUNT, loginComplete: false });

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  it('says nothing to someone logged in', async () => {
    mountSurveyResults({ ...privateSession(), account: WALLET_ACCOUNT, loginComplete: true });

    await screen.findByText('Question Results');
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('says nothing on a session with public Results', async () => {
    mountSurveyResults({ ...publicSession(), account: '', loginComplete: false });

    await screen.findByText('Question Results');
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('opens the login dialog through the store', async () => {
    const store = createStore(
      combineReducers({
        profile: (state = { account: '', network: { id: 84532 } }) => state,
        sessionState: sessionStateReducer,
      }),
      applyMiddleware(thunk),
    );
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ConnectedSurveyResults
            {...privateSession()}
            filterState={{}}
            isOpen
            isQuestionCacheReady
            isResponsesCacheReady
            isSBTCacheReady
            preventUrlChange
            sessionSlugPinned
          />
        </MemoryRouter>
      </Provider>,
    );

    await screen.findByText(PROMPT);
    expect(store.getState().sessionState.loginModalToggled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(store.getState().sessionState.loginModalToggled).toBe(true);
  });
});
