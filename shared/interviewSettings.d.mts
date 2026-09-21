export type InterviewSettings = {
  openingMode: 'auto' | 'owner';
  openingPrompt: string;
  steeringPrompt: string;
  autoRegenerate: boolean;
  questionGrowthPercent: number;
  followNewQuestions: boolean;
  suggestQuestions: boolean;
  allowManualRefresh: boolean;
};
export const DEFAULT_INTERVIEW_SETTINGS: Readonly<InterviewSettings>;
export function normalizeInterviewSettings(value?: unknown): InterviewSettings;
export function validInterviewSettings(value?: unknown): boolean;
export function hasInterviewQuestionGrowth(baseline: number, currentCount: number, percent: number): boolean;
