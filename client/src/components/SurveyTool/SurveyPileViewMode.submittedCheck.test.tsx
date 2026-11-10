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
const submitted = (): Engine => {
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
  } as never);
  act(() => engine!.setState({ submittedSinceLastEdit: true }));
  return engine!;
};

afterEach(() => {
  jest.useRealTimers();
});

it('links the check after a submit to your profile in this session', () => {
  submitted();
  expect(check()).toHaveAttribute('href', `/u/${account}?session=rxc-ra-test-5`);
});

it('shows the check for ten seconds after each submit', () => {
  jest.useFakeTimers();
  const engine = submitted();
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(check()).toHaveClass('pileSubmitSuccessBadgeGone');
  // An edit brings back Submit, and the next submit its own check.
  act(() => engine.setState({ submittedSinceLastEdit: false }));
  expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeNull();
  act(() => engine.setState({ submittedSinceLastEdit: true }));
  expect(check()).not.toHaveClass('pileSubmitSuccessBadgeGone');
});
