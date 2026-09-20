export type QuadraticQuestion = { options?: unknown; voiceCredits?: unknown };
export const DEFAULT_VOICE_CREDITS: 99;
export function getVoiceCredits(question?: QuadraticQuestion): number;
export function validateQuadraticQuestion(question?: QuadraticQuestion): string;
export function validateQuadraticAllocation(
  value: unknown,
  question?: QuadraticQuestion,
): string;
export function quadraticCreditsSpent(value: number[]): number;
export function formatQuadraticAllocation(
  value: unknown,
  options?: unknown[],
): string;
export function summarizeQuadraticAllocations(
  responses: unknown[],
  question: QuadraticQuestion,
): {
  options: { label: string; positive: number; negative: number; net: number }[];
  totalResponders: number;
  excludedResponses: number;
};
