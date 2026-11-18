import { act, fireEvent, screen } from '@testing-library/react';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({
  __esModule: true,
  default: ({ isOpen, mode, openCount }: { isOpen: boolean; mode: string | null; openCount?: number }) =>
    isOpen ? (
      <div data-testid="voice-mode-dialog" data-open-count={openCount}>
        {mode || 'chooser'}
      </div>
    ) : null,
}));

type Engine = { setState: (patch: Record<string, unknown>) => void };

// The real pile view at the end of its set.
const atEndOfSet = (): Engine => {
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
    account: '0x00000000000000000000000000000000000000aa',
    loginComplete: true,
    sessionSlug: 'salon',
    activeSessionSlug: 'salon',
    sessionConfig: {
      slug: 'salon',
      networkChainId: 84532,
      __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
    },
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'What matters?' }],
  } as never);
  act(() => engine!.setState({ pileSetEndQuestionId: 'q1' }));
  return engine!;
};

it('talks it through in the one-person interview, not the chooser that offers the group one too', async () => {
  window.history.replaceState({}, '', '/session/salon');
  atEndOfSet();
  fireEvent.click(screen.getByRole('button', { name: 'Talk it through in the interview' }));
  expect(await screen.findByTestId('voice-mode-dialog')).toHaveTextContent('interview');
  // As choosing it would: a reload reopens the interview.
  expect(window.location.search).toBe('?mode=interview');
});

// One under way is resumed instead, as the transcript-claim tests pin.
it('starts a new interview each time it opens afresh', async () => {
  window.history.replaceState({}, '', '/session/salon');
  const engine = atEndOfSet();
  const talk = () => fireEvent.click(screen.getByRole('button', { name: 'Talk it through in the interview' }));
  talk();
  const first = Number((await screen.findByTestId('voice-mode-dialog')).dataset.openCount);
  expect(first).toBeGreaterThan(0);
  act(() => engine.setState({ showVoiceModeModal: false }));
  talk();
  expect(Number(screen.getByTestId('voice-mode-dialog').dataset.openCount)).toBe(first + 1);
});
