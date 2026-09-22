export type PublicInterviewQuestion = {
  id: string;
  prompt: string;
  type: string;
  options: string[];
  singleSelect?: boolean;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  voiceCredits?: number;
};
export function normalizePublicInterviewQuestions(input: unknown, limit?: number): PublicInterviewQuestion[];
