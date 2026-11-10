import { act, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const account = '0x00000000000000000000000000000000000000aa';

// The real pile view, signed in on a session's page, just after a submit.
const submitted = () => {
  let engine: { setState: (patch: Record<string, unknown>) => void } | null = null;
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
  return screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR);
};

it('links the check after a submit to your profile in this session', () => {
  expect(submitted()).toHaveAttribute('href', `/u/${account}?session=rxc-ra-test-5`);
});
