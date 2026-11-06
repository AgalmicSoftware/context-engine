import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { QuestionFilter } from './QuestionFilter';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { upsertWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerConfigCache';

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);
jest.mock('./WorkerGroupResultsFilterControls', () => () => null);
jest.mock('./questionFilterRuntimeSupport', () => ({
  ...(jest.requireActual('./questionFilterRuntimeSupport') as object),
  readQuestionsCacheSync: () => ({
    '11155420': {
      questions: {
        q1: { id: 'q1', type: 'binary', prompt: 'Shown', tags: ['shown-tag'] },
        q2: { id: 'q2', type: 'binary', prompt: 'Hidden prompt', tags: ['hidden-tag'] },
      },
      questionResponses: {},
    },
  }),
}));

const storeSession = (hidden: string[]) =>
  upsertWorkerCanonicalSessionBootstrap({
    slug: 'edge',
    sessionIdHex: `0x${'1'.repeat(32)}`,
    workerOrigin: 'https://filter-worker.example.test',
    configRevision: 'r1',
    config: {
      slug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      corsWorkerUrl: 'https://filter-worker.example.test',
      BLOCKED_QUESTION_IDS: hidden,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    },
  });

const renderFilter = () => {
  const onCountUpdate = jest.fn();
  const ref = React.createRef<any>();
  render(
    <QuestionFilter
      {...({
        ref,
        resultsMode: true,
        filterModalOpen: true,
        network: { id: 11155420 },
        sessionConfig: { slug: 'edge', networkChainId: 11155420 },
        sessionSlug: 'edge',
        enableLocalStorage: false,
        toggleFilterModal: () => {},
        filterState: {},
        questions: [{ id: 'q1', type: 'binary', prompt: 'Shown', tags: ['shown-tag'] }],
        questionResponses: {},
        isQuestionCacheReady: true,
        isSBTCacheReady: true,
        onCountUpdate,
        onFilter: jest.fn(),
      } as any)}
    />,
  );
  return { onCountUpdate };
};

describe('QuestionFilter and hidden questions', () => {
  beforeEach(() => window.localStorage.clear());

  it('does not bring a hidden question back from the cache', async () => {
    storeSession(['q2']);
    const { onCountUpdate } = renderFilter();
    await waitFor(() => expect(onCountUpdate).toHaveBeenCalled());
    expect(onCountUpdate.mock.calls.at(-1)?.[0]).toBe(1);
  });

  it('still adds cached questions that are not hidden', async () => {
    storeSession([]);
    const { onCountUpdate } = renderFilter();
    await waitFor(() => expect(onCountUpdate).toHaveBeenCalled());
    expect(onCountUpdate.mock.calls.at(-1)?.[0]).toBe(2);
  });
});
