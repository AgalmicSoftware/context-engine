// Types for the parts of the scorer the client uses; the method is in docs/agent-fidelity.md.
export const FIDELITY_METHOD_VERSION: string;

export type FidelityReviewEntry = {
  questionId: string;
  predicted: unknown;
  answered: unknown;
  confidence?: unknown;
  condition?: 'shown' | 'blind';
};

export type FidelityPair = {
  questionId: string;
  condition: 'shown' | 'blind' | 'separate';
  prediction: unknown;
  actual: unknown;
  confidence: number | null;
};

export type ParticipantFidelitySummary = {
  predictions: number;
  mirrorScore: number;
  choicePredictions: number;
  choiceMatches: number;
  hiddenChoicePredictions: number;
  hiddenChoiceMatches: number;
  hiddenPredictions: number;
  hiddenMatches: number;
  meanConfidence: number | null;
  confidentMisses: Array<{ questionId: string; prediction: unknown; actual: unknown; confidence: number }>;
};

export function fidelityPairsFromReview(input: { questions?: unknown[]; reviewed?: FidelityReviewEntry[] }): FidelityPair[];
export function summarizeParticipantFidelity(input: {
  questions?: unknown[];
  pairs?: FidelityPair[];
}): ParticipantFidelitySummary | null;
