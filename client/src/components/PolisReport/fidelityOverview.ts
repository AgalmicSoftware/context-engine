import {
  collectSessionFidelityData,
  resultsResponseRows,
  scoreFidelityOverview,
  type FidelityOverview,
} from '../../../../shared/agentFidelity.mjs';
import { isBlankQuadraticAllocation } from '../../utilities/survey/quadraticAnswer';

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
  const { answers, pairs } = collectSessionFidelityData({
    questions: questionList,
    payloads: resultsResponseRows({ filteredQuestionResponses: questionResponses }),
  });
  // Results reads a cleared allocation, every vote at 0, as no answer, so its draft has nothing to be
  // scored against. Only an allocation reads as a list of numbers. Pairs are dropped after each
  // person's latest answer is chosen, so an answer from before they cleared it doesn't count instead.
  const cleared = new Set(
    (answers as { participantId: string; questionId: string; value: unknown }[])
      .filter(({ value }) => isBlankQuadraticAllocation(value))
      .map(({ participantId, questionId }) => `${participantId} ${questionId}`),
  );
  const prefill = pairs.filter(
    (pair) => pair.origin === 'external_prefill' && !cleared.has(`${pair.participantId} ${pair.questionId}`),
  );
  return prefill.length
    ? // Results shows the condition and platform rows, so only those are withheld together.
      scoreFidelityOverview({
        questions: questionList,
        pairs: prefill,
        options: { minParticipants },
        tables: ['byCondition', 'byPlatform'],
      })
    : null;
};
