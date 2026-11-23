import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PolisReportFilterPanel } from './PolisReportFilters';
import { normalizeSurveyToolFilterState } from '../SurveyTool/surveyToolUtils';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

// The panel loads Raw Results' real filter; only its store connection and network-backed parts are left out.
jest.mock('../SurveyTool/QuestionFilter', () => ({
  __esModule: true,
  default:
    jest.requireActual<typeof import('../SurveyTool/QuestionFilter')>('../SurveyTool/QuestionFilter').QuestionFilter,
}));
jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);
jest.mock('../SurveyTool/WorkerGroupResultsFilterControls', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: { onChange: (value: unknown) => void }) =>
      createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            props.onChange({
              sessionId: '0x' + '1'.repeat(64),
              sessionSlug: 'filter-fixture',
              workerUrl: 'https://worker.example.test',
              creatorInclude: [],
              creatorExclude: [],
              responderInclude: [{ groupId: 'workshop', label: 'Workshop' }],
              responderExclude: [],
            }),
        },
        'Pick Workshop',
      ),
  };
});

const questions = {
  parks: { id: 'parks', type: 'binary', prompt: 'Parks should stay open at night.', tags: ['parks'] },
  homes: { id: 'homes', type: 'binary', prompt: 'New homes belong near the station.', tags: ['housing'] },
};
const answer = (responder: string, value: string) => ({
  responder,
  response: JSON.stringify({ type: 'binary', answer: { value } }),
});
const rows = { parks: [answer('0xA1', 'Agree')], homes: [answer('0xB2', 'Disagree')] };
const sessionConfig = {
  slug: 'filter-fixture',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
// What Raw Results set: one tag, its AI ranking and "answered by me".
const shared = {
  selectedTags: ['parks'],
  aiFilter: 'night buses',
  aiTopN: 5,
  aiCombine: true,
  responseStatus: { responded: true, notResponded: false },
};

const renderPanel = (filterState: unknown, onFilterChange = jest.fn()) => {
  render(
    <PolisReportFilterPanel
      id="report-filters"
      rows={rows}
      questions={questions}
      filterState={filterState}
      onFilterChange={onFilterChange}
      isQuestionCacheReady
      isSBTCacheReady
      sessionSlug="filter-fixture"
      sessionConfig={sessionConfig}
    />,
  );
  return onFilterChange;
};

describe('the Report’s filter panel', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.reject(new Error('no network in tests'))) as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows only filters the Report applies, and a pick there keeps the AI ranking and answered choice', async () => {
    const onFilterChange = renderPanel(shared);
    const housing = await screen.findByRole('button', { name: '#housing' });
    expect(screen.getByRole('button', { name: '#parks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('AI Filter')).not.toBeInTheDocument();
    expect(screen.queryByText('Response Status')).not.toBeInTheDocument();

    fireEvent.click(housing);
    await waitFor(() =>
      expect(onFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ...shared, selectedTags: expect.arrayContaining(['parks', 'housing']) }),
      ),
    );
    // Opening the panel never asks an AI to rank questions.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves the shared filter as it was when it opens', async () => {
    const before = { ...shared, questionTypes: ['binary'], topQuestions: { count: 1, by: 'responses' } };
    const onFilterChange = renderPanel(before);
    await screen.findByText(/question\(s\) match current filters/);
    await screen.findByRole('button', { name: 'Remove filter: Top 1 by # responses' });
    for (const [next] of onFilterChange.mock.calls) {
      expect(normalizeSurveyToolFilterState(next)).toEqual(normalizeSurveyToolFilterState(before));
    }
  });

  it('sends a Worker group pick on, and the session page’s filter keeps it', async () => {
    const onFilterChange = renderPanel({});
    fireEvent.click(await screen.findByRole('button', { name: 'Pick Workshop' }));
    await waitFor(() =>
      expect(onFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workerGroupFilter: expect.objectContaining({
            responderInclude: [{ groupId: 'workshop', label: 'Workshop' }],
          }),
        }),
      ),
    );
    const [last] = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1];
    expect(normalizeSurveyToolFilterState(last).workerGroupFilter).toEqual(last.workerGroupFilter);
  });
});
