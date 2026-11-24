import { act, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const account = '0x00000000000000000000000000000000000000aa';

type Engine = { setState: (patch: Record<string, unknown>) => void };
const check = () => screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);

// The real pile view, signed in on a session's page, just after a submit.
const submitted = (extra: Record<string, unknown> = {}): Engine => {
  let engine: Engine | null = null;
  const strategy = createPileViewRuntimeStrategy() as { render: (engine: never) => unknown };
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  renderSurveyPileViewMode({
    minifiedMode: 'pile',
    network: { id: 84532 },
    networkChainId: 84532,
    account,
    loginComplete: true,
    sessionSlug: 'rxc-ra-test-5',
    activeSessionSlug: 'rxc-ra-test-5',
    sessionConfig: {
      slug: 'rxc-ra-test-5',
      networkChainId: 84532,
      __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
    },
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'What matters?' }],
    ...extra,
  } as never);
  act(() => engine!.setState({ submittedSinceLastEdit: true }));
  return engine!;
};

afterEach(() => {
  jest.useRealTimers();
});

it('says the answers were submitted, without a link out of the questions', () => {
  submitted();
  expect(check()).toHaveTextContent('Submitted');
  expect(check()).not.toHaveAttribute('href');
});

it('shows the check for ten seconds after each submit', () => {
  jest.useFakeTimers();
  const engine = submitted();
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(check()).toHaveClass('pileSubmitDoneGone');
  // An edit brings back Submit, and the next submit its own check.
  act(() => engine.setState({ submittedSinceLastEdit: false }));
  expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeNull();
  act(() => engine.setState({ submittedSinceLastEdit: true }));
  expect(check()).not.toHaveClass('pileSubmitDoneGone');
});

// The page lifts its title to make room above the card while the band holds Submit or the check (see
// OnePageSessionStandardShell): once the check hides, the band is empty and the title comes back down.
it('holds the band above the card only while the check shows', () => {
  jest.useFakeTimers();
  const bandHeld = jest.fn();
  const engine = submitted({ onPileSubmitRailVisibilityChange: bandHeld });
  expect(bandHeld).toHaveBeenLastCalledWith(true);
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(bandHeld).toHaveBeenLastCalledWith(false);
  act(() => engine.setState({ submittedSinceLastEdit: false }));
  act(() => engine.setState({ submittedSinceLastEdit: true }));
  expect(bandHeld).toHaveBeenLastCalledWith(true);
});

it('hands focus to the question card when the check hides', () => {
  jest.useFakeTimers();
  submitted();
  // Submit had focus, so the check took it.
  expect(check()).toHaveFocus();
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(screen.getByTestId('ce-pile-active-question')).toHaveFocus();
});

it('leaves focus alone when the person is somewhere else', () => {
  jest.useFakeTimers();
  const elsewhere = document.createElement('button');
  document.body.append(elsewhere);
  elsewhere.focus();
  submitted();
  expect(elsewhere).toHaveFocus();
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(elsewhere).toHaveFocus();
  elsewhere.remove();
});

it('hands focus to the end of the set when the check hides there', () => {
  jest.useFakeTimers();
  const engine = submitted();
  act(() => engine.setState({ pileSetEndQuestionId: 'q1' }));
  expect(screen.getByTestId('ce-pile-end-of-set')).toBeInTheDocument();
  check().focus();
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(screen.getByTestId('ce-pile-end-of-set')).toHaveFocus();
});
