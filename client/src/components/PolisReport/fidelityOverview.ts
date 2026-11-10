import {
  collectSessionFidelityData,
  resultsResponseRows,
  scoreFidelityOverview,
  type FidelityOverview,
} from '../../../../shared/agentFidelity.mjs';

export type FidelityOverviewInput = {
  // Cached questions, keyed by ID.
  questions: Record<string, unknown>;
  // The report's rows by question, after its filters.
  questionResponses: unknown;
  // The session's smallest group to report on (interviewMode.fidelityMinimumPeople).
  minParticipants: number;
};

/**
 * Scores the AI-prefill drafts in the report's rows, or returns null when
 * there are none. Like each person's own score, it leaves out voice and
 * typed-context drafts, which restate what the person said.
 */
export const computeFidelityOverview = ({
  questions,
  questionResponses,
  minParticipants,
}: FidelityOverviewInput): FidelityOverview | null => {
  // Cached questions are keyed by ID and may not repeat it inside.
  const questionList = Object.entries(questions || {}).map(([id, question]) => ({
    id,
    ...(question && typeof question === 'object' ? question : {}),
  }));
  const { pairs } = collectSessionFidelityData({
    questions: questionList,
    payloads: resultsResponseRows({ filteredQuestionResponses: questionResponses }),
  });
  const prefill = pairs.filter((pair) => pair.origin === 'external_prefill');
  return prefill.length
    ? scoreFidelityOverview({ questions: questionList, pairs: prefill, options: { minParticipants } })
    : null;
};
