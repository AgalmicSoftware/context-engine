import {
  asGroupRecord,
  filterWorkerGroupResponses,
  type WorkerGroupCohort,
} from '../../domains/worker/workerGroupResultsFilter';

type ResultsState = {
  viewMode: string;
  aggregatorQuestionResponses: Record<string, unknown>;
  questionResponses: Record<string, unknown>;
  sbtFilteredAggregatorQuestionResponses: Record<string, unknown>;
  filteredQuestionsCount: number | null;
  filteredResponsesCount: number;
  isFilterActive: boolean;
};
export function projectWorkerGroupResultsState<T extends ResultsState>(
  state: T,
  metadata: Record<string, unknown>,
  cohort: WorkerGroupCohort,
): T {
  if (!cohort.active || state.viewMode !== 'questions') return state;
  const rows: Record<string, Record<string, unknown>[]> = {};
  for (const [id, value] of Object.entries(state.sbtFilteredAggregatorQuestionResponses)) {
    if (Array.isArray(value)) rows[id] = value.map(asGroupRecord);
  }
  const filtered = filterWorkerGroupResponses(rows, metadata, cohort);
  const candidates = filterWorkerGroupResponses(state.aggregatorQuestionResponses, metadata, cohort);
  const questionResponses = Object.fromEntries(
    Object.entries(candidates).map(([id, entries]) => {
      const allowed = new Set(entries.map((row) => String(row.responder || '').toLowerCase()));
      return [
        id,
        Object.fromEntries(
          Object.entries(asGroupRecord(state.questionResponses[id])).filter(([address]) =>
            allowed.has(address.toLowerCase()),
          ),
        ),
      ];
    }),
  );
  return {
    ...state,
    questionResponses,
    workerGroupAllowedQuestionIds: Object.keys(candidates),
    sbtFilteredAggregatorQuestionResponses: filtered,
    filteredQuestionsCount: Object.keys(filtered).length,
    filteredResponsesCount: Object.values(filtered).reduce((count, entries) => count + entries.length, 0),
    isFilterActive: true,
  };
}
