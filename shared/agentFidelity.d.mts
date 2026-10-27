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

export type FidelityCondition = 'shown' | 'blind' | 'separate';

// A per-person mean with a 95% interval; withheld below the minimum number of people.
export type FidelityEstimate = {
  value: number | null;
  interval: [number, number] | null;
  participants: number;
  suppressed?: true;
};

// Bins from fewer people than the minimum are withheld.
export type FidelityCalibrationBin =
  | {
      from: number;
      to: number;
      predictions: number;
      participants: number;
      meanConfidence: number;
      keepRate: number;
      suppressed?: undefined;
    }
  | { from: number; to: number; predictions: number; participants: number; suppressed: true };

export type FidelityCalibration =
  | { participants: number; suppressed: true }
  | {
      participants: number;
      predictions: number;
      brier: number;
      expectedCalibrationError: number;
      bins: FidelityCalibrationBin[];
      brierInterval: [number, number] | null;
      errorInterval: [number, number] | null;
      suppressed?: undefined;
    };

export type SessionFidelityPair = FidelityPair & {
  participantId: string;
  origin: string;
  platform: string;
  modelId: string;
};

export type FidelityOverview = {
  method: string;
  options: { bootstrapSamples: number; minParticipants: number; [key: string]: unknown };
  coverage: {
    participants: number;
    predictions: number;
    byCondition: Record<FidelityCondition, number>;
    [key: string]: unknown;
  };
  mirrorScore: {
    overall: FidelityEstimate;
    byCondition: Partial<Record<FidelityCondition, FidelityEstimate>>;
    byType: Record<string, FidelityEstimate>;
    byOrigin: Record<string, FidelityEstimate>;
    byPlatform: Record<string, FidelityEstimate>;
  };
  correctionRate: FidelityEstimate;
  calibration: Partial<Record<FidelityCondition, FidelityCalibration>>;
};

export function resultsResponseRows(source: unknown): unknown[];
export function collectSessionFidelityData(input: { questions?: unknown[]; payloads?: unknown[] }): {
  answers: unknown[];
  pairs: SessionFidelityPair[];
  skipped: Record<string, number>;
};
export function scoreFidelityOverview(input: {
  questions?: unknown[];
  pairs?: SessionFidelityPair[];
  options?: { bootstrapSamples?: number; seed?: number; minParticipants?: number };
}): FidelityOverview;
export function fidelityPairsFromReview(input: { questions?: unknown[]; reviewed?: FidelityReviewEntry[] }): FidelityPair[];
export function summarizeParticipantFidelity(input: {
  questions?: unknown[];
  pairs?: FidelityPair[];
}): ParticipantFidelitySummary | null;
