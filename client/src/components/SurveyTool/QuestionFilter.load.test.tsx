import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuestionFilter } from './QuestionFilter';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);
jest.mock('./WorkerGroupResultsFilterControls', () => () => null);

const group = {
  sessionId: '0x' + '1'.repeat(64),
  sessionSlug: 'filter-fixture',
  workerUrl: 'https://worker.example.test',
  creatorInclude: [],
  creatorExclude: [],
  responderExclude: [],
  responderInclude: [{ groupId: 'workshop', label: 'Workshop' }],
};
const savedState = { workerGroupFilter: group, topQuestions: { count: 1, by: 'responses' } };
const token = serializeFilterState(savedState);
const config = {
  slug: 'filter-fixture',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};

describe.each([true, false])('saved-filter loader, inline=%s', (resultsMode) => {
  it.each(['empty', 'cleared', 'active'].flatMap((state) => ['token', 'URL'].map((format) => ({ state, format }))))(
    'loads a $format with $state filters and restores Group and Top 1',
    async ({ state, format }) => {
      const onFilterStateChange = jest.fn();
      render(
        <QuestionFilter
          resultsMode={resultsMode}
          filterModalOpen
          sessionConfig={config}
          sessionSlug="filter-fixture"
          enableLocalStorage={false}
          toggleFilterModal={() => {}}
          filterState={state === 'empty' ? {} : { questionTypes: ['binary'] }}
          questions={[{ id: 'q1', type: 'binary', prompt: 'Fixture question' }]}
          questionResponses={{}}
          isQuestionCacheReady
          isSBTCacheReady
          onFilterStateChange={onFilterStateChange}
        />,
      );
      if (state !== 'empty') await screen.findByRole('button', { name: 'Remove filter: binary' });
      if (state === 'cleared') {
        fireEvent.click(screen.getByTitle('Clear current filters'));
        await waitFor(() =>
          expect(screen.queryByRole('button', { name: 'Remove filter: binary' })).not.toBeInTheDocument(),
        );
      }
      fireEvent.click(screen.getByTitle('Load a saved filter'));
      const input = screen.getByPlaceholderText('Load filter from URL/string...');
      fireEvent.change(input, {
        target: { value: format === 'token' ? token : `https://example.test/session/filter-fixture?filter=${token}` },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Load' }));
      expect(await screen.findByRole('button', { name: 'Remove filter: Top 1 by # responses' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove filter: Responder include: Workshop' })).toBeInTheDocument();
      expect(onFilterStateChange).toHaveBeenLastCalledWith(expect.objectContaining(savedState));
    },
  );
});
