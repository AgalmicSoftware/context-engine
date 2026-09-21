import { projectWorkerGroupResultsState } from './surveyResultsWorkerGroups';
import type { WorkerGroupCohort } from '../../domains/worker/workerGroupResultsFilter';
const a = '0x' + 'a'.repeat(40),
  b = '0x' + 'b'.repeat(40);
const source = {
  q: [
    { responder: a, response: { answer: { value: 'Member' } } },
    { responder: b, response: { answer: { value: 'Outside' } } },
  ],
};
const state = {
  viewMode: 'questions',
  aggregatorQuestionResponses: source,
  sbtFilteredAggregatorQuestionResponses: source,
  questionResponses: { q: { [a]: { answer: { value: 'Member' } }, [b]: { answer: { value: 'Outside' } } } },
  filteredQuestionsCount: 1,
  filteredResponsesCount: 2,
  isFilterActive: false,
};
const cohort: WorkerGroupCohort = {
  active: true,
  status: 'ready',
  message: '',
  selection: {
    sessionSlug: 'test',
    sessionId: 'session',
    workerUrl: 'https://worker.example',
    creatorInclude: [],
    creatorExclude: [],
    responderInclude: [{ groupId: 'eddy', label: 'EDDY' }],
    responderExclude: [],
  },
  members: { eddy: new Set([a]) },
};
it('projects the shared display/export/AI rows without overwriting original data', () => {
  const projected = projectWorkerGroupResultsState(state, {}, cohort);
  expect(projected.sbtFilteredAggregatorQuestionResponses).toEqual({ q: [source.q[0]] });
  expect(projected.questionResponses).toEqual({ q: { [a]: state.questionResponses.q[a] } });
  expect(projected.filteredResponsesCount).toBe(1);
  expect(state.sbtFilteredAggregatorQuestionResponses.q).toHaveLength(2);
  expect(projectWorkerGroupResultsState(state, {}, { ...cohort, active: false })).toBe(state);
});
it('prevents pending or unreadable membership from displaying/exporting unfiltered data', () => {
  for (const status of ['loading', 'error'] as const) {
    const projected = projectWorkerGroupResultsState(state, {}, { ...cohort, status });
    expect(projected.sbtFilteredAggregatorQuestionResponses).toEqual({});
    expect(projected.questionResponses).toEqual({});
    expect(projected.filteredResponsesCount).toBe(0);
  }
});
